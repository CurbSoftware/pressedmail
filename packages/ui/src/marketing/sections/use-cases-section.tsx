import { cn } from '#utils';
import {
  BrushCleaning,
  CircleUserRound,
  Cog,
  Database,
  FishSymbol,
  Lock,
  Mail,
  Paperclip,
  RefreshCw,
  Server,
} from 'lucide-react';

import { MailboxVectorTraditional } from '../mailbox-vector-traditional';
import type { ServerSectionProps } from './types';

interface UseCase {
  titleKey: string;
  descKey: string;
  illustration: 'accounts' | 'connections' | 'security';
  figLabel: string;
}

const USE_CASES: UseCase[] = [
  {
    titleKey: 'useCases.col1Title',
    descKey: 'useCases.col1Desc',
    illustration: 'accounts',
    figLabel: 'FIG 0.1',
  },
  {
    titleKey: 'useCases.col2Title',
    descKey: 'useCases.col2Desc',
    illustration: 'connections',
    figLabel: 'FIG 0.2',
  },
  {
    titleKey: 'useCases.col3Title',
    descKey: 'useCases.col3Desc',
    illustration: 'security',
    figLabel: 'FIG 0.3',
  },
];

const GRAPHIC_FRAME_CLASS = 'relative h-52 w-full max-w-82 overflow-visible';

const PROVIDER_BADGE_CLASS =
  'flex size-12 items-center justify-center overflow-hidden rounded-[1.35rem] border border-primary/12 bg-[var(--surface-elevated)] shadow-[var(--shadow-card)] ring-1 ring-[color:var(--surface-card-border)] backdrop-blur-[2px] motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out group-hover:border-primary/25 group-hover:shadow-[var(--shadow-elevated)]';

const SECURITY_BADGE_CLASS =
  'text-foreground/85 flex size-12 items-center justify-center overflow-hidden rounded-[1.35rem] border border-primary/12 bg-[var(--surface-elevated)] shadow-[var(--shadow-card)] ring-1 ring-[color:var(--surface-card-border)] backdrop-blur-[2px] motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out group-hover:border-primary/25 group-hover:shadow-[var(--shadow-elevated)]';

const CONNECTION_BADGE_CLASS =
  'text-foreground/85 relative z-10 flex size-20 items-center justify-center overflow-hidden rounded-[1.6rem] border border-primary/12 bg-[var(--surface-elevated)] shadow-[var(--shadow-card)] ring-1 ring-[color:var(--surface-card-border)] backdrop-blur-[2px] motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out group-hover:border-primary/25 group-hover:shadow-[var(--shadow-elevated)]';

const CONNECTION_LABEL_CLASS =
  'font-mono text-sm font-semibold tracking-[0.32em] text-muted-foreground/80';

const FLOAT_UP_CLASS =
  'motion-safe:[animation:pm-use-case-float-up_7.6s_ease-in-out_infinite] motion-safe:group-hover:[animation-play-state:paused] motion-reduce:[animation:none]';

const FLOAT_DOWN_CLASS =
  'motion-safe:[animation:pm-use-case-float-down_8.8s_ease-in-out_infinite] motion-safe:group-hover:[animation-play-state:paused] motion-reduce:[animation:none]';

function getSharedProviderIconUrl(fileName: string) {
  return `/images/providers/${fileName}`;
}

const PROVIDER_BADGES = [
  {
    label: 'Gmail',
    src: getSharedProviderIconUrl('gmail-icon.svg'),
    className: 'top-2 left-11',
    iconClassName: 'bg-foreground',
    floatClassName: FLOAT_UP_CLASS,
    motionClassName:
      'motion-safe:group-hover:-translate-x-1 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-6',
  },
  {
    label: 'Outlook',
    src: getSharedProviderIconUrl('outlook-icon.svg'),
    className: 'top-2 right-11',
    iconClassName: 'bg-primary',
    floatClassName: `${FLOAT_DOWN_CLASS} motion-safe:[animation-delay:-1.4s]`,
    motionClassName:
      'motion-safe:delay-75 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-6',
  },
  {
    label: 'Yahoo Mail',
    src: getSharedProviderIconUrl('yahoo-icon.svg'),
    className: 'top-[4.65rem] left-3',
    iconClassName: 'bg-muted-foreground',
    floatClassName: `${FLOAT_UP_CLASS} motion-safe:[animation-delay:-2.2s]`,
    motionClassName:
      'motion-safe:delay-100 motion-safe:group-hover:-translate-x-1 motion-safe:group-hover:scale-105',
  },
  {
    label: 'iCloud Mail',
    src: getSharedProviderIconUrl('icloud-icon.svg'),
    className: 'top-[4.65rem] right-3',
    iconClassName: 'bg-muted-foreground',
    floatClassName: `${FLOAT_DOWN_CLASS} motion-safe:[animation-delay:-0.8s]`,
    motionClassName:
      'motion-safe:delay-150 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:scale-105',
  },
  {
    label: 'Proton Mail',
    src: getSharedProviderIconUrl('protonmail-icon.svg'),
    className: 'bottom-2 right-11',
    iconClassName: 'bg-foreground',
    floatClassName: `${FLOAT_UP_CLASS} motion-safe:[animation-delay:-1.8s]`,
    motionClassName:
      'motion-safe:delay-100 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:translate-y-1 motion-safe:group-hover:rotate-6',
  },
  {
    label: 'Custom Email',
    src: getSharedProviderIconUrl('custom-email-icon.svg'),
    className: 'bottom-2 left-11',
    iconClassName: 'bg-primary',
    floatClassName: `${FLOAT_DOWN_CLASS} motion-safe:[animation-delay:-2.6s]`,
    motionClassName:
      'motion-safe:delay-75 motion-safe:group-hover:-translate-x-1 motion-safe:group-hover:translate-y-1 motion-safe:group-hover:-rotate-6',
  },
];

const SECURITY_CONTROLS = [
  {
    label: 'Lock',
    icon: Lock,
    className: 'top-2 left-12',
    floatClassName: FLOAT_UP_CLASS,
    motionClassName:
      'motion-safe:group-hover:-translate-x-1 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-6',
  },
  {
    label: 'Database',
    icon: Database,
    className: 'top-2 right-12',
    floatClassName: `${FLOAT_DOWN_CLASS} motion-safe:[animation-delay:-1.3s]`,
    motionClassName:
      'motion-safe:delay-75 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-6',
  },
  {
    label: 'User',
    icon: CircleUserRound,
    className: 'top-[4.6rem] left-3',
    floatClassName: `${FLOAT_UP_CLASS} motion-safe:[animation-delay:-2.1s]`,
    motionClassName:
      'motion-safe:delay-100 motion-safe:group-hover:-translate-x-1 motion-safe:group-hover:scale-105',
  },
  {
    label: 'Attachments',
    icon: Paperclip,
    className: 'top-[4.6rem] right-3',
    floatClassName: `${FLOAT_DOWN_CLASS} motion-safe:[animation-delay:-0.7s]`,
    motionClassName:
      'motion-safe:delay-150 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:scale-105',
  },
  {
    label: 'Broom',
    icon: BrushCleaning,
    className: 'bottom-2 left-12',
    floatClassName: `${FLOAT_DOWN_CLASS} motion-safe:[animation-delay:-2.5s]`,
    motionClassName:
      'motion-safe:delay-75 motion-safe:group-hover:-translate-x-1 motion-safe:group-hover:translate-y-1 motion-safe:group-hover:-rotate-6',
  },
  {
    label: 'Phishing',
    icon: FishSymbol,
    className: 'right-12 bottom-2',
    floatClassName: `${FLOAT_UP_CLASS} motion-safe:[animation-delay:-1.7s]`,
    motionClassName:
      'motion-safe:delay-100 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:translate-y-1 motion-safe:group-hover:rotate-6',
  },
];

function ProviderBadge(props: {
  label: string;
  src: string;
  className: string;
  iconClassName: string;
  floatClassName: string;
  motionClassName: string;
}) {
  return (
    <span className={cn('absolute', props.className, props.floatClassName)}>
      <span className={cn(PROVIDER_BADGE_CLASS, props.motionClassName)}>
        <span className="from-primary/12 to-primary/5 absolute inset-1 rounded-[1rem] bg-gradient-to-br via-transparent" />
        <span
          className={cn('relative z-10 block size-6', props.iconClassName)}
          style={{
            WebkitMaskImage: `url(${props.src})`,
            maskImage: `url(${props.src})`,
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />
      </span>
      <span className="sr-only">{props.label}</span>
    </span>
  );
}

function AccountsFigure() {
  return (
    <div className={GRAPHIC_FRAME_CLASS} aria-hidden="true">
      <div className="bg-primary/10 absolute top-1/2 left-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl group-hover:opacity-90 motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:scale-105" />

      <MailboxVectorTraditional className="text-primary relative z-10 mx-auto h-44 w-28 translate-y-2 drop-shadow-sm motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:scale-[1.03]" />

      {PROVIDER_BADGES.map((provider) => (
        <ProviderBadge key={provider.label} {...provider} />
      ))}
    </div>
  );
}

function SecurityControlBadge(props: {
  label: string;
  icon: typeof Lock;
  className: string;
  floatClassName: string;
  motionClassName: string;
}) {
  const Icon = props.icon;

  return (
    <span className={cn('absolute', props.className, props.floatClassName)}>
      <span className={cn(SECURITY_BADGE_CLASS, props.motionClassName)}>
        <span className="from-primary/12 to-primary/5 absolute inset-1 rounded-[1rem] bg-gradient-to-br via-transparent" />
        <Icon className="relative z-10 size-7" strokeWidth={1.85} />
      </span>
      <span className="sr-only">{props.label}</span>
    </span>
  );
}

function ConnectionsFigure() {
  return (
    <div className={GRAPHIC_FRAME_CLASS} aria-hidden="true">
      <div className="bg-primary/10 absolute top-1/2 left-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl group-hover:opacity-90 motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:scale-105" />

      <div className="from-primary/0 via-primary/30 to-primary/0 absolute top-1/2 right-[6.25rem] left-[6.25rem] h-px -translate-y-1/2 bg-gradient-to-r" />

      <div className="absolute top-1/2 left-4 z-10 flex -translate-y-1/2 flex-col items-center gap-4">
        <span
          className={cn(
            CONNECTION_BADGE_CLASS,
            'motion-safe:group-hover:-translate-x-1 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-6',
          )}
        >
          <span className="from-primary/12 to-primary/5 absolute inset-1 rounded-[1.05rem] bg-gradient-to-br via-transparent" />
          <Mail
            className="text-foreground relative z-10 size-16"
            strokeWidth={1.7}
          />
        </span>

        <span className={CONNECTION_LABEL_CLASS}>IMAP</span>
      </div>

      <div className="absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <span className="text-primary border-primary/20 relative flex size-16 items-center justify-center rounded-full border bg-[var(--surface-elevated)] shadow-[var(--shadow-card)] ring-1 ring-[color:var(--surface-card-border)] backdrop-blur-[2px] motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:rotate-180">
          <span className="from-primary/12 to-primary/5 absolute inset-1 rounded-full bg-gradient-to-br via-transparent" />
          <RefreshCw className="relative z-10 size-9" strokeWidth={1.85} />
        </span>
      </div>

      <div className="absolute top-1/2 right-4 z-10 flex -translate-y-1/2 flex-col items-center gap-4">
        <span
          className={cn(
            CONNECTION_BADGE_CLASS,
            'motion-safe:group-hover:translate-x-1 motion-safe:group-hover:translate-y-1 motion-safe:group-hover:rotate-6',
          )}
        >
          <span className="from-primary/12 to-primary/5 absolute inset-1 rounded-[1.05rem] bg-gradient-to-br via-transparent" />
          <Server
            className="text-foreground relative z-10 size-16"
            strokeWidth={1.7}
          />
        </span>

        <span className={CONNECTION_LABEL_CLASS}>SMTP</span>
      </div>
    </div>
  );
}

function SecurityControlFigure() {
  return (
    <div className={GRAPHIC_FRAME_CLASS} aria-hidden="true">
      <div className="bg-primary/10 absolute top-1/2 left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl group-hover:opacity-90 motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:scale-105" />

      <Cog
        className="text-primary absolute top-1/2 left-1/2 size-28 -translate-x-1/2 -translate-y-1/2 motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:scale-105 motion-safe:group-hover:rotate-12"
        strokeWidth={1.6}
      />

      {SECURITY_CONTROLS.map((control) => (
        <SecurityControlBadge key={control.label} {...control} />
      ))}
    </div>
  );
}

function UseCaseFigure(props: { illustration: UseCase['illustration'] }) {
  if (props.illustration === 'accounts') {
    return <AccountsFigure />;
  }

  if (props.illustration === 'connections') {
    return <ConnectionsFigure />;
  }

  return <SecurityControlFigure />;
}

export type UseCasesSectionProps = ServerSectionProps;

export function UseCasesSection({ t, className }: UseCasesSectionProps) {
  return (
    <section
      className={cn(
        'relative bg-[var(--surface-section-alt)] bg-[image:var(--surface-section-chrome)] py-20 md:py-28 lg:py-36',
        className,
      )}
    >
      <style>{`
        @keyframes pm-use-case-float-up {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }

          50% {
            transform: translate3d(0, -4px, 0);
          }
        }

        @keyframes pm-use-case-float-down {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }

          50% {
            transform: translate3d(0, 3px, 0);
          }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(900px_circle_at_center,white,transparent)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent)]" />
      </div>

      <div className="relative z-10 container">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
            <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t('marketing:useCases.headline')}
            </h2>

            <p className="text-muted-foreground mt-4 text-base leading-relaxed md:text-lg">
              {t('marketing:useCases.subheadline')}
            </p>
          </div>

          <div className="divide-border/20 grid grid-cols-1 md:grid-cols-3 md:divide-x">
            {USE_CASES.map((useCase) => (
              <div
                key={useCase.titleKey}
                className="group grid grid-rows-[auto_auto_auto] gap-5 px-6 py-6 first:pl-0 last:pr-0 md:grid-rows-[auto_minmax(14rem,1fr)_auto] md:gap-6 md:py-0 lg:px-8"
              >
                <span className="text-primary font-mono text-xs tracking-widest">
                  {useCase.figLabel}
                </span>

                <div className="relative flex items-center justify-center py-6 md:py-8 lg:pt-6">
                  <UseCaseFigure illustration={useCase.illustration} />
                </div>

                <div className="flex min-h-[7.5rem] flex-col gap-2">
                  <h3 className="text-foreground text-lg font-semibold">
                    {t(`marketing:${useCase.titleKey}`)}
                  </h3>

                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(`marketing:${useCase.descKey}`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
