'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { UMAMI_EVENTS, trackUmamiEvent } from '@kit/shared/analytics';

import { Button } from '../shadcn/button';
import { Trans } from './trans';

export const COOKIE_CONSENT_STATUS = 'cookie_consent_status';
export const COOKIE_CONSENT_CHANGE_EVENT = 'cookie-consent-change';

export type CookieConsentStatus = 'accepted' | 'rejected' | 'unknown';

const ConsentStatus = {
  Accepted: 'accepted',
  Rejected: 'rejected',
  Unknown: 'unknown',
} as const satisfies Record<string, CookieConsentStatus>;

interface CookieBannerProps {
  policyHref?: string;
}

export function CookieBanner({
  policyHref = '/cookie-policy',
}: CookieBannerProps = {}) {
  const { status, accept, reject } = useCookieConsent();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  if (status !== ConsentStatus.Unknown) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      // This banner is fixed and knows nothing about the page under it, so a
      // full-height layout cannot tell that its lower edge is covered. The
      // attribute lets a page reserve room with :has() for exactly as long as
      // the banner is mounted, without lifting state or threading props.
      data-consent-banner=""
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      className={
        'bg-card text-card-foreground animate-in fade-in slide-in-from-bottom-4 fill-mode-both fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 border-t px-4 py-2.5 shadow-lg duration-300 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5'
      }
    >
      <div className="min-w-0 space-y-0.5 sm:flex-1">
        <h2
          id="cookie-consent-title"
          className="text-foreground text-sm font-semibold"
        >
          <Trans
            i18nKey={'common:cookieBanner.title'}
            defaults={'Cookies and privacy'}
          />
        </h2>
        <p
          id="cookie-consent-description"
          className="text-muted-foreground text-xs leading-5 sm:line-clamp-1"
        >
          <Trans i18nKey={'common:cookieBanner.description'} />
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Button
          type={'button'}
          size={'sm'}
          onClick={accept}
          className={'h-8 min-w-[5rem] px-3 sm:flex-none'}
        >
          <Trans i18nKey={'common:cookieBanner.accept'} />
        </Button>

        <Button
          type={'button'}
          size={'sm'}
          variant={'outline'}
          onClick={reject}
          className={'h-8 min-w-[5rem] px-3 sm:flex-none'}
        >
          <Trans i18nKey={'common:cookieBanner.reject'} />
        </Button>

        <a
          href={policyHref}
          className={
            'text-muted-foreground hover:text-foreground inline-flex h-9 items-center text-xs underline underline-offset-4'
          }
        >
          <Trans i18nKey={'common:cookieBanner.learnMore'} />
        </a>
      </div>
    </div>
  );
}

interface CookieSettingsTriggerProps {
  className?: string;
}

/**
 * @name CookieSettingsTrigger
 * @description Inline control (e.g. in a site footer) that clears the stored
 * cookie consent choice and re-shows the {@link CookieBanner}, so visitors can
 * change or withdraw consent at any time.
 */
export function CookieSettingsTrigger({
  className,
}: CookieSettingsTriggerProps = {}) {
  const { clear } = useCookieConsent();

  return (
    <button
      type={'button'}
      onClick={clear}
      data-test={'cookie-settings-trigger'}
      className={
        className ??
        'text-muted-foreground hover:text-foreground text-sm underline-offset-2 transition-colors hover:underline'
      }
    >
      <Trans
        i18nKey={'common:cookieBanner.manage'}
        defaults={'Cookie settings'}
      />
    </button>
  );
}

export function useCookieConsent() {
  const initialState = getStatusFromLocalStorage();
  const [status, setStatus] = useState<CookieConsentStatus>(initialState);

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    const handleConsentChange = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: CookieConsentStatus }>)
        .detail;

      setStatus(detail?.status ?? getStatusFromLocalStorage());
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && event.key !== COOKIE_CONSENT_STATUS) {
        return;
      }

      setStatus(getStatusFromLocalStorage());
    };

    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsentChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(
        COOKIE_CONSENT_CHANGE_EVENT,
        handleConsentChange,
      );
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const accept = useCallback(() => {
    const status = ConsentStatus.Accepted;

    trackUmamiEvent(UMAMI_EVENTS.cookieConsentDecided, {
      'consent-status': status,
    });

    setStatus(status);
    storeStatusInLocalStorage(status);
  }, []);

  const reject = useCallback(() => {
    const status = ConsentStatus.Rejected;

    // Recorded before the state change. Rejecting unmounts the tracker
    // script, so a moment later there is no `window.umami` left to record it.
    trackUmamiEvent(UMAMI_EVENTS.cookieConsentDecided, {
      'consent-status': status,
    });

    setStatus(status);
    storeStatusInLocalStorage(status);
  }, []);

  const clear = useCallback(() => {
    const status = ConsentStatus.Unknown;

    setStatus(status);
    storeStatusInLocalStorage(status);
  }, []);

  return useMemo(() => {
    return {
      clear,
      status,
      accept,
      reject,
    };
  }, [clear, status, accept, reject]);
}

function storeStatusInLocalStorage(status: CookieConsentStatus) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(COOKIE_CONSENT_STATUS, status);
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, {
      detail: { status },
    }),
  );
}

function getStatusFromLocalStorage() {
  if (!isBrowser()) {
    return ConsentStatus.Unknown;
  }

  const status = localStorage.getItem(COOKIE_CONSENT_STATUS);

  if (isConsentStatus(status)) {
    return status;
  }

  return ConsentStatus.Unknown;
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function isConsentStatus(status: string | null): status is CookieConsentStatus {
  return (
    status === ConsentStatus.Accepted ||
    status === ConsentStatus.Rejected ||
    status === ConsentStatus.Unknown
  );
}
