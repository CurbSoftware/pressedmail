'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Image from 'next/image';

import { cn } from '#utils';

interface HlsVideoPlayerProps {
  src: string;
  title?: string;
  showTitleTooltip?: boolean;
  className?: string;
  videoClassName?: string;
  aspectRatio?: '16/9' | '4/3' | '1/1' | '9/16';
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  poster?: string;
  startLevel?: number;
  preload?: 'none' | 'metadata' | 'auto';
  fallbackImage?: string;
  fallbackImageLight?: string;
  fallbackImageDark?: string;
  fallbackImageAlt?: string;
  fallbackImageClassName?: string;
  dataAnalyticsVideo?: string;
  dataTest?: string;
  /** Fires when playback reaches the end. Only meaningful with `loop` off. */
  onEnded?: () => void;
  /** Playback speed. 1 is natural; hls.js resets it on attach, so it is reapplied. */
  playbackRate?: number;
}

function isHlsSource(src: string): boolean {
  return src.endsWith('.m3u8') || src.includes('.m3u8?');
}

export function HlsVideoPlayer({
  src,
  title = 'Video',
  showTitleTooltip = false,
  className,
  videoClassName,
  aspectRatio = '16/9',
  autoplay = false,
  muted = false,
  loop = false,
  controls = true,
  poster,
  startLevel,
  preload = 'metadata',
  fallbackImage,
  fallbackImageLight,
  fallbackImageDark,
  fallbackImageAlt,
  fallbackImageClassName,
  dataAnalyticsVideo,
  dataTest,
  onEnded,
  playbackRate,
}: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  const destroyHls = useCallback(() => {
    const hls = hlsRef.current;

    if (hls) {
      hls.destroy();

      if (hlsRef.current === hls) {
        hlsRef.current = null;
      }
    }
  }, []);

  const handleError = useCallback(() => {
    destroyHls();
    setIsLoading(false);
    setHasError(true);
  }, [destroyHls]);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    const video = videoRef.current;
    if (!video || !src) return;

    // For MP4 or other direct video sources, use native playback (no HLS.js)
    if (!isHlsSource(src)) {
      video.src = src;

      if (autoplay) {
        video.play().catch(() => {
          // Autoplay was prevented
        });
      }

      return () => {
        video.src = '';
      };
    }

    // HLS source: dynamically import hls.js only when needed
    let cancelled = false;
    let retriedNetworkError = false;
    let retriedMediaError = false;

    const showFallback = () => {
      if (cancelled) return;

      destroyHls();
      setIsLoading(false);
      setHasError(true);
    };

    void import('hls.js')
      .then((HlsModule) => {
        if (cancelled) return;

        const Hls = HlsModule.default;

        // Check for native HLS support first (Safari)
        const hasNativeHlsSupport =
          video.canPlayType('application/vnd.apple.mpegurl') !== '';

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            ...(startLevel === undefined ? {} : { startLevel }),
          });

          hlsRef.current = hls;

          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;

            if (autoplay) {
              video.play().catch(() => {
                // Autoplay was prevented
              });
            }
          });

          hls.on(
            Hls.Events.ERROR,
            (_event: string, data: { fatal: boolean; type: string }) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    if (!retriedNetworkError) {
                      retriedNetworkError = true;
                      hls.startLoad();
                    } else {
                      showFallback();
                    }
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    if (!retriedMediaError) {
                      retriedMediaError = true;
                      hls.recoverMediaError();
                    } else {
                      showFallback();
                    }
                    break;
                  default:
                    showFallback();
                    break;
                }
              }
            },
          );
        } else if (hasNativeHlsSupport) {
          video.src = src;

          if (autoplay) {
            video.play().catch(() => {
              // Autoplay was prevented
            });
          }
        } else {
          showFallback();
        }
      })
      .catch(() => {
        showFallback();
      });

    return () => {
      cancelled = true;

      const hls = hlsRef.current;

      if (hls) {
        hls.destroy();

        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }
      }
    };
  }, [src, autoplay, startLevel, destroyHls]);

  // Attaching a source resets the element's rate, so apply it now and again
  // whenever new media metadata lands.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || playbackRate === undefined) return;

    const apply = () => {
      video.playbackRate = playbackRate;
    };

    apply();
    video.addEventListener('loadedmetadata', apply);

    return () => video.removeEventListener('loadedmetadata', apply);
  }, [playbackRate, src]);

  const renderFallback = () => {
    if (fallbackImageLight && fallbackImageDark) {
      return (
        <>
          <Image
            src={fallbackImageLight}
            alt={fallbackImageAlt || title}
            fill
            className={cn('object-cover dark:hidden', fallbackImageClassName)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
          />
          <Image
            src={fallbackImageDark}
            alt={fallbackImageAlt || title}
            fill
            className={cn(
              'hidden object-cover dark:block',
              fallbackImageClassName,
            )}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
          />
        </>
      );
    }

    if (fallbackImage) {
      return (
        <Image
          src={fallbackImage}
          alt={fallbackImageAlt || title}
          fill
          className={cn('object-cover', fallbackImageClassName)}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
        />
      );
    }

    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
          <svg
            className="text-muted-foreground size-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm font-medium">
            Video unavailable
          </p>
          <p className="text-muted-foreground/70 text-xs">
            This video could not be loaded
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-lg bg-black',
        className,
      )}
      style={{ aspectRatio }}
      data-test={dataTest}
    >
      {isLoading && !hasError && !poster && (
        <div className="bg-muted/50 absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="border-primary/30 border-t-primary size-8 animate-spin rounded-full border-2" />
            <span className="text-muted-foreground text-sm">
              Loading video...
            </span>
          </div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          {renderFallback()}
        </div>
      )}

      <video
        ref={videoRef}
        aria-label={title}
        title={showTitleTooltip ? title : undefined}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        poster={poster}
        preload={preload}
        onCanPlay={handleCanPlay}
        onError={handleError}
        onEnded={onEnded}
        data-analytics-video={dataAnalyticsVideo}
        className={cn(
          'absolute inset-0 h-full w-full object-contain',
          videoClassName,
          (hasError || (isLoading && !poster)) && 'invisible',
        )}
      />
    </div>
  );
}
