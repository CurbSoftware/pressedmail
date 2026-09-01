'use client';

import { useCallback, useState, useTransition } from 'react';
import type { ReactNode } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  UMAMI_EVENTS,
  trackUmamiEvent,
} from '@kit/shared/analytics';

import { Button } from '../../shadcn/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../../shadcn/form';
import { SpotlightInput } from '../spotlight-input';

type NewsletterSubscribeActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      errorCode?: string;
      message: string;
    };

export interface NewsletterCtaFormProps {
  captchaField?: ReactNode;
  captchaReady?: boolean;
  getCaptchaToken?: () => Promise<string>;
  resetCaptcha?: () => void;
  subscribeAction: (data: {
    captchaToken: string;
    email: string;
  }) => Promise<NewsletterSubscribeActionResult>;
}

const NewsletterSchema = z.object({
  email: z.string().trim().email().max(254),
});

type NewsletterFormValues = z.infer<typeof NewsletterSchema>;

export function NewsletterCtaForm({
  captchaField,
  captchaReady = true,
  getCaptchaToken,
  resetCaptcha,
  subscribeAction,
}: NewsletterCtaFormProps) {
  const t = useTranslations('marketing');
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewsletterFormValues>({
    resolver: zodResolver(NewsletterSchema),
    defaultValues: { email: '' },
  });

  const handleSubmit = useCallback(
    (data: NewsletterFormValues) => {
      startTransition(async () => {
        try {
          const captchaToken = getCaptchaToken ? await getCaptchaToken() : '';
          const result = await subscribeAction({
            captchaToken,
            email: data.email,
          });

          if (result.success === false) {
            resetCaptcha?.();
            form.setError('email', {
              message: result.message,
            });
            trackUmamiEvent(UMAMI_EVENTS.newsletterFailed, {
              // The server hands back a bounded code; the human-readable
              // message is never sent.
              reason: result.errorCode ?? 'unknown',
            });

            return;
          }

          setSubmitted(true);
          resetCaptcha?.();
          trackUmamiEvent(UMAMI_EVENTS.newsletterSubscribed);
        } catch {
          resetCaptcha?.();
          form.setError('email', {
            message: t('siteCta.newsletterError'),
          });
          trackUmamiEvent(UMAMI_EVENTS.newsletterFailed, {
            reason: 'network',
          });
        }
      });
    },
    [form, getCaptchaToken, resetCaptcha, subscribeAction, t],
  );

  if (submitted) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="text-success flex items-center justify-center gap-2 text-sm"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <span>{t('siteCta.newsletterSuccess')}</span>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex w-full flex-col gap-3"
      >
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <div className="relative">
                    <Mail className="text-muted-foreground absolute top-1/2 left-3 z-20 h-4 w-4 -translate-y-1/2" />
                    <SpotlightInput
                      type="email"
                      maxLength={254}
                      placeholder={t('siteCta.newsletterPlaceholder')}
                      className="bg-background/80 border-border/20 focus:border-primary hover:border-border/20 h-11 pl-10 backdrop-blur-sm focus-visible:ring-0"
                      aria-label={t('siteCta.newsletterPlaceholder')}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            disabled={isPending || captchaReady === false}
            className="btn-shimmer h-11 px-6 font-semibold"
            data-umami-event="newsletter_form_submitted"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              t('siteCta.newsletterButton')
            )}
          </Button>
        </div>

        {captchaField ? <div className="pt-1">{captchaField}</div> : null}
      </form>
    </Form>
  );
}
