import type { ReactNode } from 'react';

import { cn } from '#utils';
import {
  AlertTriangle,
  CalendarDays,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { ScreenshotMockupFrame } from '../screenshot-mockup-frame';
import type { ServerSectionProps } from './types';

export interface FeatureSpotlightsProps extends ServerSectionProps {
  /** Base paths for themed screenshots (light/dark). Each key maps to a screenshot location. */
  images: {
    unifiedInbox: string;
    messageDetail: string;
    inboxSplit: string;
    inboxInitial: string;
    freeInbox: string;
    securitySettings: string;
    credentialEncryption: string;
  };
  imageExtension?: string;
  productName?: string;
}

function SpotlightScreenshotFrame({
  basePath,
  alt,
  className,
  imageContainerClassName,
  imageClassName,
  sizes,
  imageExtension = 'png',
  children,
}: {
  basePath: string;
  alt: string;
  className?: string;
  imageContainerClassName: string;
  imageClassName: string;
  sizes: string;
  imageExtension?: string;
  children?: ReactNode;
}) {
  return (
    <ScreenshotMockupFrame
      label="PressedMail"
      className={cn('shadow-none', className)}
      image={{
        basePath,
        alt,
        fill: true,
        ext: imageExtension,
        className: imageClassName,
        sizes,
      }}
      imageContainerClassName={imageContainerClassName}
    >
      {children}
    </ScreenshotMockupFrame>
  );
}

export function FeatureSpotlights({
  t,
  images,
  imageExtension = 'png',
  className,
}: FeatureSpotlightsProps) {
  return (
    <section className={cn('py-20 md:py-28 lg:py-36', className)}>
      <div className="container">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          {/* Block 1: Unified Inbox proof */}
          <div className="border-border/20 bg-card overflow-hidden rounded-3xl border">
            <div className="border-border/20 border-b p-8 pb-6 lg:p-12 lg:pb-8">
              <h3 className="font-heading text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {t('marketing:featureSpotlights.block1Heading')}
              </h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                {t('marketing:featureSpotlights.block1Desc')}
              </p>
            </div>

            <SpotlightScreenshotFrame
              className="group rounded-none border-0"
              imageContainerClassName="min-h-[280px] md:min-h-[360px] lg:min-h-[460px]"
              basePath={images.unifiedInbox}
              alt="Unified inbox with top filter controls"
              imageClassName="object-cover object-top"
              imageExtension={imageExtension}
              sizes="(max-width: 1280px) 100vw, 1200px"
            >
              <div className="from-background/45 pointer-events-none absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />

              {/* Combined inbox filter highlight */}
              <div className="border-primary/80 bg-primary/15 group-hover:bg-primary/25 pointer-events-none absolute top-[5%] left-1/2 z-20 h-11 w-[220px] -translate-x-1/2 rounded-xl border-2 shadow-[0_0_26px_var(--primary)/0.25] transition-all duration-300 group-hover:shadow-[0_0_34px_var(--primary)/0.45] md:w-[260px]" />

              {/* Tooltip overlay */}
              <div className="border-border/70 bg-background/90 text-foreground pointer-events-none absolute top-[16%] left-1/2 z-20 w-fit max-w-[85%] -translate-x-1/2 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur md:text-sm">
                Combined inbox filter across all connected accounts
              </div>

              {/* Hover emphasis layer */}
              <div className="inbox-filter-overlay bg-primary/10 pointer-events-none absolute top-[5%] left-1/2 z-10 h-11 w-[220px] -translate-x-1/2 rounded-xl md:w-[260px]" />
            </SpotlightScreenshotFrame>
          </div>

          {/* Block 2: AI workflow animation */}
          <div className="border-border/20 bg-card overflow-hidden rounded-3xl border">
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr]">
              <div className="border-border/20 order-2 overflow-hidden border-t lg:order-1 lg:border-t-0 lg:border-r">
                <SpotlightScreenshotFrame
                  className="h-full rounded-none border-0"
                  imageContainerClassName="min-h-[300px] md:min-h-[360px] lg:min-h-[430px]"
                  basePath={images.messageDetail}
                  alt="Message detail view used for AI draft workflow"
                  imageClassName="object-cover object-top"
                  imageExtension={imageExtension}
                  sizes="(max-width: 1024px) 100vw, 60vw"
                >
                  <div className="from-background/60 pointer-events-none absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />

                  <div className="border-border/70 bg-background/85 text-foreground ai-generated-draft pointer-events-none absolute right-4 bottom-20 hidden w-[240px] rounded-lg border p-3 text-xs shadow-xl backdrop-blur-sm sm:block">
                    <p className="text-foreground font-medium">
                      AI Draft Ready
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Suggested response from thread context.
                    </p>
                  </div>

                  <div className="border-border/70 bg-background/85 pointer-events-none absolute right-4 bottom-4 left-4 grid grid-cols-2 gap-2 rounded-lg border p-2 text-[10px] sm:grid-cols-4 sm:text-xs">
                    <div className="workflow-step-1 border-border/50 rounded-md border px-2 py-1 text-center">
                      Click reply
                    </div>
                    <div className="workflow-step-2 border-border/50 rounded-md border px-2 py-1 text-center">
                      Click AI
                    </div>
                    <div className="workflow-step-3 border-border/50 rounded-md border px-2 py-1 text-center">
                      Draft appears
                    </div>
                    <div className="workflow-step-4 border-border/50 rounded-md border px-2 py-1 text-center">
                      Edit + send
                    </div>
                  </div>

                  <div className="bg-primary/90 ai-cursor ring-primary/20 absolute top-14 right-44 z-20 hidden h-3.5 w-3.5 rounded-full ring-4 sm:block" />
                </SpotlightScreenshotFrame>
              </div>

              <div className="order-1 flex flex-col justify-center p-8 lg:order-2 lg:p-12">
                <h3 className="font-heading text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  {t('marketing:featureSpotlights.block2Heading')}
                </h3>

                <p className="text-muted-foreground mb-4 text-base leading-relaxed">
                  {t('marketing:featureSpotlights.block2Desc')}
                </p>

                <div className="border-border/60 bg-muted/40 text-foreground/85 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs">
                  <Sparkles
                    className="text-primary h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  Requires your own OpenAI-compatible key.
                </div>
              </div>
            </div>
          </div>

          {/* Block 3: Inbox + Contacts + Calendar */}
          <div className="border-border/20 bg-card overflow-hidden rounded-3xl border">
            <div className="border-border/20 border-b p-8 pb-6 lg:p-12 lg:pb-8">
              <h3 className="font-heading text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {t('marketing:featureSpotlights.block3aHeading')}
              </h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                {t('marketing:featureSpotlights.block3aDesc')}
              </p>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[1.25fr_0.95fr]">
              <SpotlightScreenshotFrame
                className="border-border/30 rounded-2xl"
                imageContainerClassName="min-h-[260px] md:min-h-[340px]"
                basePath={images.inboxSplit}
                alt="Inbox panel in split workspace"
                imageClassName="object-cover object-left-top"
                imageExtension={imageExtension}
                sizes="(max-width: 1024px) 100vw, 55vw"
              >
                <div className="from-background/30 pointer-events-none absolute inset-0 bg-gradient-to-tr via-transparent to-transparent" />

                <div className="border-border/70 bg-background/90 text-foreground absolute top-4 left-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  Inbox
                </div>
              </SpotlightScreenshotFrame>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
                <SpotlightScreenshotFrame
                  className="border-border/30 rounded-2xl"
                  imageContainerClassName="min-h-[180px]"
                  basePath={images.inboxInitial}
                  alt="Calendar panel attached to inbox workspace"
                  imageClassName="object-cover object-right-top"
                  imageExtension={imageExtension}
                  sizes="(max-width: 1024px) 100vw, 40vw"
                >
                  <div className="from-background/60 via-background/20 pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent" />

                  <div className="border-border/70 bg-background/88 text-foreground absolute inset-x-4 top-4 rounded-lg border p-3 text-xs shadow-sm backdrop-blur-sm">
                    <p className="mb-2 inline-flex items-center gap-2 font-medium">
                      <CalendarDays
                        className="text-primary h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Calendar panel
                    </p>

                    <div className="text-muted-foreground space-y-1.5 text-[11px]">
                      <p>09:30 Client handoff call</p>
                      <p>13:00 Support triage</p>
                      <p>16:30 Follow-up reminders</p>
                    </div>
                  </div>
                </SpotlightScreenshotFrame>

                <SpotlightScreenshotFrame
                  className="border-border/30 rounded-2xl"
                  imageContainerClassName="min-h-[180px]"
                  basePath={images.freeInbox}
                  alt="Contact sidebar context"
                  imageClassName="object-cover object-left-top"
                  imageExtension={imageExtension}
                  sizes="(max-width: 1024px) 100vw, 40vw"
                >
                  <div className="from-background/65 via-background/20 pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent" />

                  <div className="border-border/70 bg-background/88 text-foreground absolute inset-x-4 top-4 rounded-lg border p-3 text-xs shadow-sm backdrop-blur-sm">
                    <p className="mb-2 font-medium">Contact sidebar</p>
                    <div className="text-muted-foreground space-y-1.5 text-[11px]">
                      <p>Ryan McBeth &bull; Key account</p>
                      <p>Recent threads: 12</p>
                      <p>Last touchpoint: 2 days ago</p>
                    </div>
                  </div>
                </SpotlightScreenshotFrame>
              </div>
            </div>
          </div>

          {/* Block 4: Security evidence */}
          <div className="border-border/20 bg-card overflow-hidden rounded-3xl border">
            <div className="border-border/20 border-b p-8 pb-6 lg:p-12 lg:pb-8">
              <p className="text-muted-foreground mb-2 text-xs tracking-[0.2em] uppercase">
                Security controls
              </p>

              <h3 className="font-heading text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {t('marketing:featureSpotlights.block3bHeading')}
              </h3>

              <p className="text-muted-foreground text-base leading-relaxed">
                {t('marketing:featureSpotlights.block3bDesc')}
              </p>
            </div>

            <div className="grid gap-4 p-4 pb-12 md:grid-cols-3">
              <SpotlightScreenshotFrame
                className="border-border/30 overflow-visible rounded-2xl"
                imageContainerClassName="min-h-[190px] overflow-visible"
                basePath={images.messageDetail}
                alt="Impersonation warning indicator in thread view"
                imageClassName="object-cover object-right-top"
                imageExtension={imageExtension}
                sizes="(max-width: 768px) 100vw, 33vw"
              >
                <div className="from-destructive/35 via-background/25 pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent" />

                <div className="border-destructive/60 bg-background/92 text-foreground absolute right-4 bottom-0 left-4 z-10 h-[88px] translate-y-[40%] rounded-lg border p-3 text-xs shadow-md">
                  <p className="mb-1 inline-flex items-center gap-2 font-medium">
                    <AlertTriangle
                      className="text-destructive h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    Phishing - Impersonation warning
                  </p>

                  <p className="text-muted-foreground text-[11px]">
                    Sender domain mismatch flagged before reply.
                  </p>
                </div>
              </SpotlightScreenshotFrame>

              <SpotlightScreenshotFrame
                className="border-border/30 overflow-visible rounded-2xl"
                imageContainerClassName="min-h-[190px] overflow-visible"
                basePath={images.securitySettings}
                alt="Security settings panel"
                imageClassName="object-cover object-right-top"
                imageExtension={imageExtension}
                sizes="(max-width: 768px) 100vw, 33vw"
              >
                <div className="from-background/65 pointer-events-none absolute inset-0 bg-gradient-to-b via-transparent to-transparent" />

                <div className="border-border/70 bg-background/92 text-foreground absolute right-4 bottom-0 left-4 z-10 h-[88px] translate-y-[40%] rounded-lg border p-3 text-xs shadow-md">
                  <p className="mb-1 inline-flex items-center gap-2 font-medium">
                    <ShieldCheck
                      className="text-primary h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    Security settings panel
                  </p>

                  <p className="text-muted-foreground text-[11px]">
                    Theme, identity, and workspace controls in one place.
                  </p>
                </div>
              </SpotlightScreenshotFrame>

              <SpotlightScreenshotFrame
                className="border-border/30 overflow-visible rounded-2xl"
                imageContainerClassName="min-h-[190px] overflow-visible"
                basePath={images.credentialEncryption}
                alt="Credential encryption status view"
                imageClassName="object-cover object-left-top"
                imageExtension={imageExtension}
                sizes="(max-width: 768px) 100vw, 33vw"
              >
                <div className="via-background/25 pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-500/20 to-transparent" />

                <div className="bg-background/92 text-foreground absolute right-4 bottom-0 left-4 z-10 h-[88px] translate-y-[40%] rounded-lg border border-emerald-500/50 p-3 text-xs shadow-md">
                  <p className="mb-1 inline-flex items-center gap-2 font-medium">
                    <KeyRound
                      className="h-3.5 w-3.5 text-emerald-500"
                      aria-hidden="true"
                    />
                    Credential encryption status
                  </p>

                  <p className="text-muted-foreground text-[11px]">
                    SMTP and OAuth secrets encrypted at rest and in transit.
                  </p>
                </div>
              </SpotlightScreenshotFrame>
            </div>
          </div>

          <style>{`
            .inbox-filter-overlay {
              animation: inbox-filter-pulse 2.8s ease-in-out infinite;
            }

            .ai-cursor {
              animation: ai-cursor-path 8s ease-in-out infinite;
            }

            .ai-generated-draft {
              animation: ai-draft-state 8s ease-in-out infinite;
            }

            .workflow-step-1,
            .workflow-step-2,
            .workflow-step-3,
            .workflow-step-4 {
              transition: border-color 180ms ease, background-color 180ms ease,
                opacity 180ms ease;
              opacity: 0.5;
            }

            .workflow-step-1 { animation: workflow-step-1 8s ease-in-out infinite; }
            .workflow-step-2 { animation: workflow-step-2 8s ease-in-out infinite; }
            .workflow-step-3 { animation: workflow-step-3 8s ease-in-out infinite; }
            .workflow-step-4 { animation: workflow-step-4 8s ease-in-out infinite; }

            @keyframes inbox-filter-pulse {
              0%, 100% { opacity: 0.45; transform: translateX(-50%) scale(1); }
              50% { opacity: 0.85; transform: translateX(-50%) scale(1.03); }
            }

            @keyframes ai-cursor-path {
              0%, 18% { top: 18%; right: 33%; }
              30%, 45% { top: 18%; right: 18%; }
              58%, 74% { top: 58%; right: 26%; }
              84%, 100% { top: 18%; right: 12%; }
            }

            @keyframes ai-draft-state {
              0%, 48% { opacity: 0; transform: translateY(10px); }
              58%, 84% { opacity: 1; transform: translateY(0); }
              100% { opacity: 0.55; transform: translateY(0); }
            }

            @keyframes workflow-step-1 {
              0%, 23% { opacity: 1; border-color: color-mix(in oklab, var(--primary) 45%, transparent); background-color: color-mix(in oklab, var(--primary) 16%, transparent); }
              26%, 100% { opacity: 0.5; }
            }

            @keyframes workflow-step-2 {
              0%, 24% { opacity: 0.5; }
              26%, 46% { opacity: 1; border-color: color-mix(in oklab, var(--primary) 45%, transparent); background-color: color-mix(in oklab, var(--primary) 16%, transparent); }
              50%, 100% { opacity: 0.5; }
            }

            @keyframes workflow-step-3 {
              0%, 47% { opacity: 0.5; }
              50%, 74% { opacity: 1; border-color: color-mix(in oklab, var(--primary) 45%, transparent); background-color: color-mix(in oklab, var(--primary) 16%, transparent); }
              78%, 100% { opacity: 0.5; }
            }

            @keyframes workflow-step-4 {
              0%, 74% { opacity: 0.5; }
              78%, 100% { opacity: 1; border-color: color-mix(in oklab, var(--primary) 45%, transparent); background-color: color-mix(in oklab, var(--primary) 16%, transparent); }
            }

            @media (prefers-reduced-motion: reduce) {
              .inbox-filter-overlay,
              .ai-cursor,
              .ai-generated-draft,
              .workflow-step-1,
              .workflow-step-2,
              .workflow-step-3,
              .workflow-step-4 {
                animation: none !important;
              }
            }
          `}</style>
        </div>
      </div>
    </section>
  );
}
