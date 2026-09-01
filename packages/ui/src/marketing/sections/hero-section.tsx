'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';

import Link from 'next/link';

import { cn } from '#utils';
import { ArrowRightIcon, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Trans } from '../../makerkit/trans';
import { Button } from '../../shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '../../shadcn/dialog';
import { HlsVideoPlayer } from '../hls-video-player';

export interface HeroVideoConfig {
  src: string;
  poster: string;
  fallbackImageLight: string;
  fallbackImageDark: string;
  fallbackImageAlt: string;
}

export interface HeroSectionProps {
  latestVersion?: string | null;
  versionPill?: React.ReactNode;
  primaryCta: { label: string; href: string; external?: boolean };
  secondaryCta?: { label: string; href: string };
  subLink?: { label: string; href: string; external?: boolean };
  video?: HeroVideoConfig;
  videoTriggerParallax?: boolean;
  mockup: React.ReactNode;
  mockupFooter?: ReactNode;
  className?: string;
}

const HERO_VIDEO_PARALLAX_INITIAL_OFFSET = 'clamp(-15rem, -18vw, -8rem)';

function getHeroVideoParallaxStartOffset() {
  if (window.innerWidth >= 1280) {
    return -240;
  }

  if (window.innerWidth >= 1024) {
    return -208;
  }

  if (window.innerWidth >= 768) {
    return -168;
  }

  return -128;
}

function getHeroVideoParallaxOffset(startOffset: number) {
  const scrollDistance = Math.max(window.innerHeight * 0.75, 1);
  const progress = Math.min(Math.max(window.scrollY / scrollDistance, 0), 1);

  return Math.round(startOffset * (1 - progress));
}

function VideoPlayButton({ video }: { video: HeroVideoConfig }) {
  const t = useTranslations('marketing');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t('hero.videoDialogTitle')}
          data-test="hero-video-play"
          data-umami-event="video_opened"
          data-umami-event-video="homepage-hero"
          className="group pointer-events-auto relative isolate flex flex-col items-center gap-3"
        >
          <span className="bg-primary/50 absolute top-1/2 left-1/2 isolate flex size-3/4 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full" />
          <span className="btn-shimmer border-primary border-1.5 relative isolate flex h-16 w-16 items-center justify-center rounded-full border-[3px] shadow-xl transition group-hover:scale-105 group-focus-visible:scale-105">
            <Play
              className="text-primary relative z-10 ml-0.5 h-7 w-7 fill-current drop-shadow"
              aria-hidden="true"
            />
            <span className="bg-primary/50 absolute inset-0 z-0 rounded-full blur-2xl" />
          </span>
          <span className="btn-shimmer border-primary border-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase shadow-lg">
            {t('hero.watchDemo')}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        className="border-none bg-transparent p-0 shadow-none sm:max-w-[min(92vw,1280px)]"
        data-test="hero-video-modal"
      >
        <DialogTitle className="sr-only">
          {t('hero.videoDialogTitle')}
        </DialogTitle>
        <div className="bg-background/95 relative overflow-hidden rounded-2xl border shadow-2xl">
          <HlsVideoPlayer
            src={video.src}
            title={t('hero.videoDialogTitle')}
            className="aspect-video w-full"
            autoplay={true}
            muted={true}
            poster={video.poster}
            fallbackImageLight={video.fallbackImageLight}
            fallbackImageDark={video.fallbackImageDark}
            fallbackImageAlt={video.fallbackImageAlt}
            dataTest="hero-video-player"
            dataAnalyticsVideo="homepage-hero-demo"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HeroVideoOverlay({
  video,
  parallax,
}: {
  video: HeroVideoConfig;
  parallax: boolean;
}) {
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parallax) {
      return;
    }

    const node = parallaxRef.current;

    if (!node) {
      return;
    }

    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    let frame: number | null = null;

    const setParallaxOffset = (offset: number) => {
      node.style.setProperty('--hero-video-parallax-y', `${offset}px`);
    };

    const updateParallax = () => {
      frame = null;

      const startOffset = getHeroVideoParallaxStartOffset();

      if (reducedMotionQuery.matches) {
        setParallaxOffset(startOffset);

        return;
      }

      setParallaxOffset(getHeroVideoParallaxOffset(startOffset));
    };

    const requestParallaxUpdate = () => {
      if (frame !== null) {
        return;
      }

      frame = window.requestAnimationFrame(updateParallax);
    };

    updateParallax();

    window.addEventListener('scroll', requestParallaxUpdate, {
      passive: true,
    });
    window.addEventListener('resize', requestParallaxUpdate);
    reducedMotionQuery.addEventListener('change', requestParallaxUpdate);

    return () => {
      window.removeEventListener('scroll', requestParallaxUpdate);
      window.removeEventListener('resize', requestParallaxUpdate);
      reducedMotionQuery.removeEventListener('change', requestParallaxUpdate);

      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [parallax]);

  const parallaxStyle = parallax
    ? ({
        '--hero-video-parallax-y': HERO_VIDEO_PARALLAX_INITIAL_OFFSET,
        transform: 'translate3d(0, var(--hero-video-parallax-y), 0)',
      } as CSSProperties)
    : undefined;

  return (
    <div
      ref={parallax ? parallaxRef : undefined}
      data-test={parallax ? 'hero-video-parallax-layer' : undefined}
      className={cn('pointer-events-none', parallax && 'will-change-transform')}
      style={parallaxStyle}
    >
      <VideoPlayButton video={video} />
    </div>
  );
}

export function HeroSection({
  versionPill,
  primaryCta,
  secondaryCta,
  subLink,
  video,
  videoTriggerParallax = false,
  mockup,
  mockupFooter,
  className,
}: HeroSectionProps) {
  const t = useTranslations('marketing');

  return (
    <div className={cn('relative flex flex-col gap-12 md:gap-16', className)}>
      {/* Hero Content: 2-column on desktop */}
      <div className="relative z-10 grid grid-cols-1 items-end gap-8 lg:grid-cols-3">
        {/* Left 2/3: badge, headline, paragraph */}
        <div className="flex flex-col items-center gap-5 text-center lg:col-span-2 lg:items-start lg:text-left">
          {versionPill}

          <h1 className="font-heading max-w-4xl text-3xl leading-[1.1] font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <Trans
              i18nKey="marketing:hero.headline"
              components={{
                email: (
                  <span className="from-primary to-primary/70 bg-gradient-to-r bg-clip-text text-transparent" />
                ),
                wp: (
                  <span className="from-primary to-primary/70 bg-gradient-to-r bg-clip-text text-transparent" />
                ),
                finally: <span className="text-shimmer" />,
              }}
            />
          </h1>

          <p className="text-muted-foreground max-w-xl text-base sm:text-lg lg:text-xl">
            {t('hero.subheadline')}
          </p>
        </div>

        {/* Right 1/3: buttons + optional sub-link, bottom-right aligned */}
        <div className="flex flex-col items-center gap-2 lg:col-span-1 lg:items-end">
          <div className="flex items-center justify-center gap-3 lg:justify-end">
            <Button
              asChild
              size="lg"
              className="group shadow-primary/30 hover:shadow-primary/40 shadow-lg transition-all hover:shadow-xl"
            >
              {primaryCta.external ? (
                <a
                  href={primaryCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-test="hero-install-free"
                  data-umami-event="cta_clicked"
                  data-umami-event-cta-location="homepage-hero"
                  data-umami-event-cta-label={primaryCta.label}
                  data-umami-event-cta-target={primaryCta.href}
                >
                  {primaryCta.label}
                  <ArrowRightIcon
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              ) : (
                <Link
                  href={primaryCta.href}
                  data-test="hero-install-free"
                  data-umami-event="cta_clicked"
                  data-umami-event-cta-location="homepage-hero"
                  data-umami-event-cta-label={primaryCta.label}
                  data-umami-event-cta-target={primaryCta.href}
                >
                  {primaryCta.label}
                  <ArrowRightIcon
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              )}
            </Button>

            {secondaryCta && (
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="btn-shimmer group"
              >
                <Link
                  href={secondaryCta.href}
                  data-umami-event="cta_clicked"
                  data-umami-event-cta-location="homepage-hero"
                  data-umami-event-cta-label={secondaryCta.label}
                  data-umami-event-cta-target={secondaryCta.href}
                >
                  {secondaryCta.label}
                  <ArrowRightIcon
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            )}
          </div>

          {subLink &&
            (subLink.external ? (
              <a
                href={subLink.href}
                target="_blank"
                rel="noopener noreferrer"
                data-test="hero-install-free-sublink"
                className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 transition-colors hover:underline"
                data-umami-event="cta_clicked"
                data-umami-event-cta-location="homepage-hero"
                data-umami-event-cta-label={subLink.label}
                data-umami-event-cta-target={subLink.href}
              >
                {subLink.label}
              </a>
            ) : (
              <Link
                href={subLink.href}
                data-test="hero-install-free-sublink"
                className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 transition-colors hover:underline"
                data-umami-event="cta_clicked"
                data-umami-event-cta-location="homepage-hero"
                data-umami-event-cta-label={subLink.label}
                data-umami-event-cta-target={subLink.href}
              >
                {subLink.label}
              </Link>
            ))}
        </div>
      </div>

      {/* Hero Screenshot */}
      <div className="relative z-20 w-full">
        {/* Subtle glow behind screenshot */}
        <div className="bg-primary/15 absolute -inset-12 rounded-[40px] blur-3xl" />

        {/* Screenshot container */}
        <div className="relative rounded-xl border-[0.5px] border-[color:var(--surface-border)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-screenshot)] backdrop-blur-sm lg:rounded-2xl">
          {/* Video play button overlay */}
          {video && (
            <div className="pointer-events-none absolute inset-0 z-30 hidden items-center justify-center sm:flex">
              <HeroVideoOverlay video={video} parallax={videoTriggerParallax} />
            </div>
          )}

          {/* Mockup content */}
          {mockup}
        </div>

        {mockupFooter ? (
          <div className="mt-4 flex justify-center">{mockupFooter}</div>
        ) : null}
      </div>
    </div>
  );
}
