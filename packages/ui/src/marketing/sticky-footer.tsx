'use client';

import React from 'react';

import Link from 'next/link';

import { cn } from '#utils';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import {
  GithubIcon,
  GlobeIcon,
  type LucideIcon,
  TwitterIcon,
  YoutubeIcon,
} from 'lucide-react';

import { UMAMI_EVENTS, umamiClick } from '@kit/shared/analytics';

import { CookieSettingsTrigger } from '../makerkit/cookie-banner';
import { Button } from '../shadcn/button';

const ICON_MAP: Record<string, LucideIcon> = {
  globe: GlobeIcon,
  twitter: TwitterIcon,
  github: GithubIcon,
  youtube: YoutubeIcon,
};

export interface StickyFooterLink {
  title: string;
  href: string;
  icon?: string;
  external?: boolean;
}

export interface StickyFooterLinkGroup {
  label: string;
  links: StickyFooterLink[];
}

export type StickyFooterProps = React.ComponentProps<'footer'> & {
  logo?: React.ReactNode;
  tagline?: string;
  socialLinks?: StickyFooterLink[];
  linkGroups?: StickyFooterLinkGroup[];
  copyright?: React.ReactNode;
  bottomText?: React.ReactNode;
  backgroundSvg?: React.ReactNode;
  languageSelector?: React.ReactNode;
};

function resolveIcon(name?: string) {
  if (!name) return null;
  return ICON_MAP[name] ?? null;
}

function useMountedReducedMotion() {
  const prefersReducedMotion = useReducedMotion();
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted && Boolean(prefersReducedMotion);
}

export function StickyFooter({
  className,
  logo,
  tagline,
  socialLinks,
  linkGroups,
  copyright,
  bottomText,
  backgroundSvg,
  languageSelector,
  ...props
}: StickyFooterProps) {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 0.02]);
  const shouldReduceMotion = useMountedReducedMotion();

  return (
    <footer
      className={cn('relative h-[720px] w-full', className)}
      style={{ clipPath: 'polygon(0% 0, 100% 0%, 100% 100%, 0 100%)' }}
      {...props}
    >
      <div className="bg-background fixed bottom-0 h-[720px] w-full">
        {backgroundSvg && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-0"
            style={{ opacity: shouldReduceMotion ? 0.02 : opacity }}
          >
            {backgroundSvg}
          </motion.div>
        )}

        <div className="sticky top-[calc(100vh-720px)] h-full overflow-y-auto">
          <div className="relative flex size-full flex-col justify-between gap-5 border-t px-4 pt-24 pb-8 md:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 isolate z-0 contain-strict"
            >
              <div className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)] absolute top-0 left-0 h-80 w-[35rem] -translate-y-[22rem] -rotate-45 rounded-full" />
              <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 left-0 h-80 w-60 [translate:5%_-50%] -rotate-45 rounded-full" />
              <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 left-0 h-80 w-60 -translate-y-[22rem] -rotate-45 rounded-full" />
            </div>

            <div className="mt-10 flex flex-col gap-8 md:flex-row xl:mt-0">
              <AnimatedContainer className="w-full max-w-sm min-w-2xs space-y-4">
                {logo && <div>{logo}</div>}

                {tagline && (
                  <p className="text-muted-foreground mt-8 text-sm md:mt-0">
                    {tagline}
                  </p>
                )}

                {socialLinks && socialLinks.length > 0 && (
                  <div className="flex gap-2">
                    {socialLinks.map((link) => (
                      <Button
                        key={link.title}
                        size="icon-sm"
                        variant="outline"
                        asChild
                      >
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={link.title}
                          {...umamiClick(UMAMI_EVENTS.footerLinkClicked, {
                            'footer-column': 'social',
                            'footer-label': link.title,
                            'footer-target': link.href,
                          })}
                        >
                          {link.icon &&
                            (() => {
                              const Icon = resolveIcon(link.icon);
                              return Icon ? <Icon className="size-4" /> : null;
                            })()}
                        </a>
                      </Button>
                    ))}
                  </div>
                )}
              </AnimatedContainer>

              <div className="grid w-full gap-8 sm:grid-cols-3 md:ml-auto md:max-w-3xl md:grid-cols-3 md:gap-8 lg:w-auto lg:grid-cols-[max-content_max-content_max-content] lg:gap-12 xl:gap-16">
                {linkGroups?.map((group, index) => (
                  <AnimatedContainer
                    key={group.label}
                    delay={0.1 + index * 0.1}
                    className="w-full"
                  >
                    <div className="mb-10 md:mb-0">
                      <h3 className="text-sm font-medium uppercase">
                        {group.label}
                      </h3>

                      <ul className="text-muted-foreground mt-4 space-y-2 text-sm md:text-xs lg:text-sm lg:whitespace-nowrap">
                        {group.links.map((link) => (
                          <li key={link.title}>
                            {link.external ? (
                              <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground inline-flex items-center transition-all duration-300"
                                {...umamiClick(UMAMI_EVENTS.footerLinkClicked, {
                                  'footer-column': group.label,
                                  'footer-label': link.title,
                                  'footer-target': link.href,
                                })}
                              >
                                {link.icon &&
                                  (() => {
                                    const Icon = resolveIcon(link.icon);
                                    return Icon ? (
                                      <Icon className="me-1 size-4" />
                                    ) : null;
                                  })()}
                                {link.title}
                              </a>
                            ) : (
                              <Link
                                href={link.href}
                                className="hover:text-foreground inline-flex items-center transition-all duration-300"
                                {...umamiClick(UMAMI_EVENTS.footerLinkClicked, {
                                  'footer-column': group.label,
                                  'footer-label': link.title,
                                  'footer-target': link.href,
                                })}
                              >
                                {link.icon &&
                                  (() => {
                                    const Icon = resolveIcon(link.icon);
                                    return Icon ? (
                                      <Icon className="me-1 size-4" />
                                    ) : null;
                                  })()}
                                {link.title}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </AnimatedContainer>
                ))}
              </div>
            </div>

            <div className="text-muted-foreground flex flex-col items-start gap-3 border-t pt-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col items-start gap-1">
                {copyright && <p>{copyright}</p>}
                {bottomText && <p>{bottomText}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <CookieSettingsTrigger className="hover:text-foreground text-sm underline-offset-2 transition-colors hover:underline" />
                {languageSelector && (
                  <div className="shrink-0">{languageSelector}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

type AnimatedContainerProps = React.ComponentProps<typeof motion.div> & {
  children?: React.ReactNode;
  delay?: number;
};

function AnimatedContainer({
  delay = 0.1,
  children,
  ...props
}: AnimatedContainerProps) {
  const shouldReduceMotion = useMountedReducedMotion();

  return (
    <motion.div
      initial={
        shouldReduceMotion
          ? false
          : { filter: 'blur(4px)', translateY: -8, opacity: 0 }
      }
      whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { delay, duration: 0.8 }
      }
      {...props}
    >
      {children}
    </motion.div>
  );
}
