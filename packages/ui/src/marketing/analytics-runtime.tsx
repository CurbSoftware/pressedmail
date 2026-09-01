'use client';

import { useEffect } from 'react';

import {
  identifyUmamiSession,
  onUmamiReady,
  resolveDelegatedClick,
  setUmamiGlobalProps,
  trackUmamiEvent,
} from '@kit/shared/analytics';

export { trackUmamiEvent };

/**
 * The one client component that turns page structure into Umami events.
 *
 * It covers what cannot be expressed as a `data-umami-event` attribute: things
 * that happen over time (section visibility, scroll depth, video progress) and
 * things inferable from a link's destination (outbound clicks, downloads,
 * mailto/tel). Named conversion surfaces (CTAs, pricing buttons, forms)
 * carry explicit attributes instead, and this runtime steps out of their way
 * so nothing is counted twice.
 *
 * Every call no-ops until the Umami script has loaded, which is itself gated
 * on the visitor not having rejected cookies.
 */

interface MarketingAnalyticsRuntimeProps {
  product: string;
  edition?: string;
  locale?: string;
  loggedIn?: boolean;
}

function getVideoName(video: HTMLVideoElement, index: number) {
  return (
    video.dataset.analyticsVideo?.trim() ||
    video.getAttribute('aria-label')?.trim() ||
    video.id ||
    `video-${index + 1}`
  );
}

export function MarketingAnalyticsRuntime({
  product,
  edition,
  locale,
  loggedIn,
}: MarketingAnalyticsRuntimeProps) {
  // Session data and the injected event globals.
  //
  // Both are needed and they are not interchangeable: `identify` attaches to
  // the session, which is the only way declarative `data-umami-event-*` clicks
  // can be segmented by product, while the global props ride along on every
  // imperative event so a single event row is readable on its own.
  useEffect(() => {
    setUmamiGlobalProps({ product });

    // The tracker script loads after this effect runs, so `identify` has to
    // wait for it. Otherwise the session data is dropped and declarative
    // clicks lose their only means of product segmentation.
    return onUmamiReady(() =>
      identifyUmamiSession({
        product,
        edition,
        locale,
        'logged-in': loggedIn ?? false,
      }),
    );
  }, [edition, locale, loggedIn, product]);

  // Section visibility.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      return;
    }

    const path = window.location.pathname;
    const viewedSections = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const element = entry.target as HTMLElement;
          const section = element.dataset.analyticsSection?.trim();

          if (!section || viewedSections.has(section)) {
            continue;
          }

          viewedSections.add(section);
          trackUmamiEvent('section_viewed', {
            path,
            product,
            section,
          });
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.5,
      },
    );

    document
      .querySelectorAll<HTMLElement>('[data-analytics-section]')
      .forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [product]);

  // Delegated clicks: outbound links, downloads, mailto/tel, and opted-in CTAs.
  //
  // One listener on the document rather than a handler per component. Capture
  // phase, so a click is still recorded when a component's own handler calls
  // stopPropagation, or when the click removes the element from the DOM.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Left and middle button only: a middle-click opens a new tab and is
      // still intent, but a right-click is a context menu, not a visit.
      if (event.button !== 0 && event.button !== 1) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const result = resolveDelegatedClick(target, {
        currentHost: window.location.host,
        path: window.location.pathname,
      });

      if (result) {
        trackUmamiEvent(result.event, result.payload);
      }
    };

    document.addEventListener('click', onClick, true);

    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Scroll depth, throttled to one measurement per animation frame.
  useEffect(() => {
    const path = window.location.pathname;
    const thresholds = [25, 50, 75, 100];
    const reached = new Set<number>();
    let frame = 0;

    const measure = () => {
      frame = 0;

      const viewport = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // A page that does not scroll has no depth to report; treating it as
      // 100% would drown the metric in single-screen pages.
      if (documentHeight <= viewport) {
        return;
      }

      const depth = Math.min(
        100,
        Math.round(((window.scrollY + viewport) / documentHeight) * 100),
      );

      for (const threshold of thresholds) {
        if (depth >= threshold && !reached.has(threshold)) {
          reached.add(threshold);
          trackUmamiEvent('scroll_depth_reached', { depth: threshold, path });
        }
      }
    };

    const onScroll = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [product]);

  // Video engagement.
  useEffect(() => {
    const path = window.location.pathname;
    const progressThresholds = [25, 50, 75];
    const cleanups: Array<() => void> = [];

    document
      .querySelectorAll<HTMLVideoElement>('video[data-analytics-video]')
      .forEach((video, index) => {
        const videoName = getVideoName(video, index);
        const trackedProgress = new Set<number>();

        const basePayload = {
          path,
          product,
          video: videoName,
        };

        const onPlay = () => {
          trackUmamiEvent('video_played', basePayload);
        };

        const onPause = () => {
          if (!video.ended) {
            trackUmamiEvent('video_paused', {
              ...basePayload,
              currentTime: Math.round(video.currentTime),
            });
          }
        };

        const onEnded = () => {
          trackUmamiEvent('video_completed', basePayload);
        };

        const onTimeUpdate = () => {
          if (!Number.isFinite(video.duration) || video.duration <= 0) {
            return;
          }

          const progress = Math.floor(
            (video.currentTime / video.duration) * 100,
          );

          for (const threshold of progressThresholds) {
            if (progress < threshold || trackedProgress.has(threshold)) {
              continue;
            }

            trackedProgress.add(threshold);
            trackUmamiEvent('video_progress', {
              ...basePayload,
              progress: threshold,
            });
          }
        };

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        video.addEventListener('timeupdate', onTimeUpdate);

        cleanups.push(() => {
          video.removeEventListener('play', onPlay);
          video.removeEventListener('pause', onPause);
          video.removeEventListener('ended', onEnded);
          video.removeEventListener('timeupdate', onTimeUpdate);
        });
      });

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [product]);

  return null;
}
