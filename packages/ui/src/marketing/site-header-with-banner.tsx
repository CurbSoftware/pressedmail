'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import Link from 'next/link';

import { cn } from '#utils';
import { ArrowRight, X } from 'lucide-react';

import { UMAMI_EVENTS, umamiClick } from '@kit/shared/analytics';

import {
  BANNER_DISMISSED_KEY,
  BANNER_STYLES,
  getBannerDismissalId,
  normalizeBannerStyle,
} from './promo-banner-config';

export interface SiteHeaderBanner {
  text: string;
  link_url: string | null;
  link_text: string | null;
  style: string;
}

export interface SiteHeaderWithBannerProps {
  logo: React.ReactNode;
  navigation: React.ReactNode;
  actions: React.ReactNode;
  banner?: SiteHeaderBanner | null;
}

const HEADER_HEIGHT = 56;
const SCROLL_THRESHOLD = 100;
const BANNER_DISMISSED_EVENT = 'promo-banner-dismissed-change';

function subscribeToBannerDismissed(callback: () => void) {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === BANNER_DISMISSED_KEY) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(BANNER_DISMISSED_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(BANNER_DISMISSED_EVENT, callback);
  };
}

function getBannerDismissedSnapshot() {
  try {
    return window.localStorage.getItem(BANNER_DISMISSED_KEY);
  } catch {
    return null;
  }
}

function getBannerDismissedServerSnapshot() {
  return undefined;
}

export function SiteHeaderWithBanner({
  logo,
  navigation,
  actions,
  banner,
}: SiteHeaderWithBannerProps) {
  const dismissedHash = useSyncExternalStore(
    subscribeToBannerDismissed,
    getBannerDismissedSnapshot,
    getBannerDismissedServerSnapshot,
  );
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  const currentBannerHash = useMemo(
    () => (banner ? getBannerDismissalId(banner) : null),
    [banner],
  );

  const bannerDismissed = dismissedHash === currentBannerHash;

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateHeaderVisibility = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > SCROLL_THRESHOLD) {
        if (currentScrollY > lastScrollY) {
          setIsHeaderHidden(true);
        } else {
          setIsHeaderHidden(false);
        }
      } else {
        setIsHeaderHidden(false);
      }

      lastScrollY = currentScrollY;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeaderVisibility);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const handleDismissBanner = useCallback(() => {
    if (currentBannerHash) {
      try {
        window.localStorage.setItem(BANNER_DISMISSED_KEY, currentBannerHash);
        window.dispatchEvent(new Event(BANNER_DISMISSED_EVENT));
      } catch {
        // Ignore storage failures; the banner remains visible if persistence is unavailable.
      }
    }
  }, [currentBannerHash]);

  const showBanner = dismissedHash !== undefined && banner && !bannerDismissed;

  return (
    <div className="contents" data-site-header-shell>
      {/* Header */}
      <div
        className={cn(
          'site-header bg-background border-border sticky top-0 z-100 w-full border-b shadow-sm transition-transform duration-300 dark:border-b-0 dark:shadow-none',
          isHeaderHidden && '-translate-y-full',
        )}
      >
        <div className="container">
          <div className="flex h-14 items-center justify-between">
            <div>{logo}</div>
            <div className="flex items-center gap-x-4">
              {navigation}
              {actions}
            </div>
          </div>
        </div>
      </div>

      {/* Promotional Banner */}
      {showBanner && (
        <PromoBanner
          banner={banner}
          isHeaderHidden={isHeaderHidden}
          onDismiss={handleDismissBanner}
        />
      )}

      {/* Spacer when banner is shown but might be hidden */}
      {showBanner && !isHeaderHidden && (
        <div style={{ height: 0 }} aria-hidden="true" />
      )}
    </div>
  );
}

function PromoBanner({
  banner,
  isHeaderHidden,
  onDismiss,
}: {
  banner: {
    text: string;
    link_url: string | null;
    link_text: string | null;
    style: string;
  };
  isHeaderHidden: boolean;
  onDismiss: () => void;
}) {
  const styleKey = normalizeBannerStyle(banner.style);
  const style = BANNER_STYLES[styleKey];

  return (
    <div
      className={cn(
        'sticky z-99 w-full py-2.5 text-center transition-all duration-300',
        style.baseBg,
        style.text,
      )}
      style={{
        top: isHeaderHidden ? 0 : HEADER_HEIGHT,
      }}
    >
      <div className="relative z-10 container flex items-center justify-center gap-3">
        <p className="text-sm font-medium">
          {banner.text}
          {banner.link_url && banner.link_text && (
            <>
              {' '}
              <Link
                href={banner.link_url}
                className={cn(
                  'inline-flex items-center gap-1 underline underline-offset-2 transition-colors',
                  style.link,
                )}
                {...umamiClick(UMAMI_EVENTS.bannerClicked, {
                  // The banner has no identifier of its own; its copy is what
                  // distinguishes one campaign from the next.
                  'banner-id': banner.text.slice(0, 60),
                  'link-target': banner.link_url,
                })}
              >
                {banner.link_text}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </p>

        <button
          onClick={onDismiss}
          className={cn(
            'ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
            style.dismiss,
          )}
          aria-label="Dismiss banner"
          {...umamiClick(UMAMI_EVENTS.bannerDismissed, {
            'banner-id': banner.text.slice(0, 60),
          })}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
