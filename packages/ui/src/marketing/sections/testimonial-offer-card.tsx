'use client';

import { useCallback, useState, useTransition } from 'react';
import type { ReactNode } from 'react';

import { cn } from '#utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Trans } from '../../makerkit/trans';
import { Button } from '../../shadcn/button';
import { Checkbox } from '../../shadcn/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../shadcn/form';
import { SpotlightInput, SpotlightTextarea } from '../spotlight-input';

const TestimonialOfferSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().min(1).email().max(254),
  testimonial: z.string().trim().min(1).max(5000),
  postUrl1: z.string().trim().min(1).url().max(2048),
  postUrl2: z.string().trim().min(1).url().max(2048),
  subscribeToNewsletter: z
    .boolean()
    .refine((value) => value === true, 'required'),
});

type TestimonialOfferFormValues = z.infer<typeof TestimonialOfferSchema>;

type TestimonialOfferActionInput = {
  name: string;
  email: string;
  testimonial: string;
  postUrl1: string;
  postUrl2: string;
  subscribeToNewsletter: boolean;
  captchaToken: string;
  source?: string;
};

type TestimonialOfferActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      errorCode?: string;
      message: string;
    };

export interface TestimonialOfferCardProps {
  captchaField?: ReactNode;
  captchaReady?: boolean;
  getCaptchaToken?: () => Promise<string>;
  resetCaptcha?: () => void;
  submitAction: (
    data: TestimonialOfferActionInput,
  ) => Promise<TestimonialOfferActionResult>;
  productName: string;
  wporgUrl: string;
  presentation?: 'overlay' | 'embedded-wide';
}

export function TestimonialOfferCard({
  captchaField,
  captchaReady = true,
  getCaptchaToken,
  resetCaptcha,
  submitAction,
  productName,
  wporgUrl,
  presentation = 'overlay',
}: TestimonialOfferCardProps) {
  const t = useTranslations('marketing');
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const embeddedWide = presentation === 'embedded-wide';

  const form = useForm<TestimonialOfferFormValues>({
    resolver: zodResolver(TestimonialOfferSchema),
    defaultValues: {
      name: '',
      email: '',
      testimonial: '',
      postUrl1: '',
      postUrl2: '',
      subscribeToNewsletter: false,
    },
  });

  const handleSubmit = useCallback(
    (values: TestimonialOfferFormValues) => {
      setSubmitError(null);

      startTransition(async () => {
        try {
          const captchaToken = getCaptchaToken ? await getCaptchaToken() : '';
          const result = await submitAction({
            ...values,
            captchaToken,
          });

          if (result.success === false) {
            resetCaptcha?.();
            setSubmitError(result.message);

            return;
          }

          setSubmittedEmail(values.email);
          resetCaptcha?.();
        } catch {
          resetCaptcha?.();
          setSubmitError(t('testimonialOffer.errorDefault'));
        }
      });
    },
    [getCaptchaToken, resetCaptcha, submitAction, t],
  );

  if (submittedEmail) {
    return (
      <div
        className={cn(
          'pointer-events-none z-20 flex items-center justify-center',
          embeddedWide ? 'relative w-full' : 'absolute inset-0 p-4',
        )}
      >
        <div
          className={cn(
            'text-card-foreground pointer-events-auto rounded-2xl border border-[color:var(--surface-card-border)] bg-[var(--surface-card)] bg-[image:var(--card-highlight-chrome)] p-6 text-left shadow-[var(--shadow-elevated)] backdrop-blur-sm',
            embeddedWide
              ? 'w-full max-w-5xl'
              : 'w-[24rem] max-w-[92vw] sm:w-[34rem]',
          )}
        >
          <div
            role="alert"
            aria-live="polite"
            className="flex flex-col items-center gap-3 py-6 text-center"
          >
            <CheckCircle2
              className="text-success h-10 w-10"
              aria-hidden="true"
            />
            <p className="text-foreground text-base leading-relaxed">
              {t('testimonialOffer.success', { email: submittedEmail })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'pointer-events-none z-20 flex items-center justify-center',
        embeddedWide ? 'relative w-full' : 'absolute inset-0 p-4',
      )}
    >
      <div
        className={cn(
          'text-card-foreground pointer-events-auto rounded-2xl border border-[color:var(--surface-card-border)] bg-[var(--surface-card)] bg-[image:var(--card-highlight-chrome)] p-6 text-left shadow-[var(--shadow-elevated)] backdrop-blur-sm',
          embeddedWide
            ? 'w-full max-w-5xl'
            : 'max-h-[90vh] w-[24rem] max-w-[92vw] overflow-y-auto sm:w-[34rem]',
        )}
      >
        <div className="flex flex-col gap-4">
          <div>
            <span className="bg-primary/10 text-primary mb-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              {t('testimonialOffer.badge')}
            </span>
            <h3 className="font-heading text-foreground text-2xl font-bold tracking-tight">
              {t('testimonialOffer.heading')}
            </h3>
          </div>

          <p className="text-foreground text-sm leading-relaxed">
            {t('testimonialOffer.terms')}
          </p>

          <p className="text-muted-foreground text-sm leading-relaxed">
            <Trans
              i18nKey="marketing.testimonialOffer.installFree"
              values={{ product: productName }}
              components={{
                link: (chunks: ReactNode) => (
                  <a
                    href={wporgUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    {chunks}
                  </a>
                ),
              }}
            />
          </p>

          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('testimonialOffer.renewalNote', { product: productName })}
          </p>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className={cn(
                'gap-3',
                embeddedWide ? 'grid md:grid-cols-2' : 'flex flex-col',
              )}
              noValidate
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('testimonialOffer.nameLabel')}</FormLabel>
                    <FormControl>
                      <SpotlightInput
                        maxLength={200}
                        autoComplete="name"
                        className="bg-background/80 border-border/20 focus:border-primary hover:border-border/20 focus-visible:ring-0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('testimonialOffer.emailLabel')}</FormLabel>
                    <FormControl>
                      <SpotlightInput
                        type="email"
                        maxLength={254}
                        autoComplete="email"
                        className="bg-background/80 border-border/20 focus:border-primary hover:border-border/20 focus-visible:ring-0"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('testimonialOffer.emailHint')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="testimonial"
                render={({ field }) => (
                  <FormItem className={cn(embeddedWide && 'md:col-span-2')}>
                    <FormLabel>
                      {t('testimonialOffer.testimonialLabel')}
                    </FormLabel>
                    <FormControl>
                      <SpotlightTextarea
                        maxLength={5000}
                        className="bg-background/80 border-border/20 focus:border-primary hover:border-border/20 min-h-28 focus-visible:ring-0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postUrl1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('testimonialOffer.postUrl1Label')}</FormLabel>
                    <FormControl>
                      <SpotlightInput
                        type="url"
                        inputMode="url"
                        maxLength={2048}
                        className="bg-background/80 border-border/20 focus:border-primary hover:border-border/20 focus-visible:ring-0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postUrl2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('testimonialOffer.postUrl2Label')}</FormLabel>
                    <FormControl>
                      <SpotlightInput
                        type="url"
                        inputMode="url"
                        maxLength={2048}
                        className="bg-background/80 border-border/20 focus:border-primary hover:border-border/20 focus-visible:ring-0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subscribeToNewsletter"
                render={({ field }) => (
                  <FormItem
                    className={cn(
                      'flex flex-row items-start gap-3 space-y-0',
                      embeddedWide && 'md:col-span-2',
                    )}
                  >
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        {t('testimonialOffer.newsletterLabel')}
                      </FormLabel>
                      <FormDescription>
                        {t('testimonialOffer.newsletterHint')}
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {captchaField ? (
                <div className={cn('pt-1', embeddedWide && 'md:col-span-2')}>
                  {captchaField}
                </div>
              ) : null}

              {submitError ? (
                <p
                  role="alert"
                  className={cn(
                    'text-destructive text-sm leading-relaxed',
                    embeddedWide && 'md:col-span-2',
                  )}
                >
                  {submitError}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                disabled={isPending || captchaReady === false}
                className={cn(
                  'btn-shimmer w-full font-semibold',
                  embeddedWide && 'md:col-span-2',
                )}
                data-umami-event="testimonial_offer_form_submitted"
              >
                {isPending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  t('testimonialOffer.submitButton')
                )}
              </Button>
            </form>
          </Form>

          <p className="text-muted-foreground text-xs leading-relaxed">
            {t('testimonialOffer.disclaimer')}
          </p>
        </div>
      </div>
    </div>
  );
}
