import { cn } from '#utils';

import { ScreenshotMockupFrame } from '../screenshot-mockup-frame';
import type { ServerSectionProps } from './types';

export interface NeverLeaveDashboardSectionProps extends ServerSectionProps {
  productName: string;
  desktopScreenshotBasePath: string;
  desktopScreenshotExtension?: string;
}

function MobileCalendarFrame({ children }: { children: React.ReactNode }) {
  return (
    <ScreenshotMockupFrame
      label="Calendar"
      className="rounded-xl shadow-lg"
      toolbarClassName="px-3 py-2"
      contentClassName="bg-muted"
      dotClassName="h-2 w-2"
      labelClassName="text-muted-foreground/40 text-[10px]"
    >
      {children}
    </ScreenshotMockupFrame>
  );
}

export function NeverLeaveDashboardSection({
  t: _t,
  productName,
  desktopScreenshotBasePath,
  desktopScreenshotExtension = 'png',
  className,
}: NeverLeaveDashboardSectionProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden py-20 md:py-28 lg:py-36',
        className,
      )}
    >
      {/* Floor spotlight */}
      <div className="bg-primary/10 pointer-events-none absolute -bottom-[200px] left-1/2 z-0 h-[400px] w-[120%] -translate-x-1/2 rounded-[50%] blur-[80px]" />

      <div className="relative z-10 container">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center">
            <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Never Leave Your Dashboard
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base leading-relaxed md:text-lg">
              Manage your email workflow without ever leaving WordPress. Your
              inbox, calendar, and contacts, all in one place.
            </p>
          </div>

          {/* Overlapping Screenshots */}
          <div className="relative mx-auto mt-12 md:mt-16 lg:max-w-5xl">
            {/* Desktop Screenshot - Large */}
            <div className="relative z-10">
              <ScreenshotMockupFrame
                label={productName}
                className="rounded-2xl shadow-xl"
                dotClassName="h-3 w-3"
                labelClassName="text-muted-foreground/40"
                image={{
                  basePath: desktopScreenshotBasePath,
                  alt: `${productName} desktop inbox view in WordPress dashboard`,
                  width: 1200,
                  height: 700,
                  ext: desktopScreenshotExtension,
                  className: 'h-auto w-full',
                  sizes: '(max-width: 1200px) 100vw, 1200px',
                }}
              />
            </div>

            {/* Mobile Screenshot - Overlapping and Rotated */}
            <div className="absolute -right-4 -bottom-8 z-20 w-[35%] max-w-[280px] rotate-[-2deg] md:-right-8 md:-bottom-12 md:max-w-[320px] lg:-top-4 lg:-right-12">
              <MobileCalendarFrame>
                <div className="bg-muted relative aspect-[10/16] overflow-hidden">
                  {/* Calendar placeholder UI */}
                  <div className="flex h-full flex-col p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-foreground text-sm font-semibold">
                          February 2025
                        </div>
                        <div className="text-muted-foreground text-xs">
                          3 events today
                        </div>
                      </div>
                      <div className="bg-primary/20 text-primary rounded-lg px-2 py-1 text-xs font-medium">
                        Today
                      </div>
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <div
                          key={`day-${index}`}
                          className="text-muted-foreground/60 text-[10px]"
                        >
                          {day}
                        </div>
                      ))}
                      {[...Array(28)].map((_, i) => {
                        const isToday = i + 1 === 23;
                        const hasEvent = [12, 15, 23].includes(i + 1);
                        return (
                          <div
                            key={`date-${i}`}
                            className={`relative flex aspect-square items-center justify-center rounded-md text-xs ${
                              isToday
                                ? 'bg-primary text-primary-foreground font-semibold'
                                : hasEvent
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {i + 1}
                            {hasEvent && !isToday && (
                              <div className="bg-primary absolute bottom-0.5 h-1 w-1 rounded-full" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Events list */}
                    <div className="mt-3 space-y-2">
                      <div className="border-border/40 rounded-lg border p-2">
                        <div className="text-foreground text-xs font-semibold">
                          Team Standup
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          9:00 AM - 9:30 AM
                        </div>
                      </div>
                      <div className="border-border/40 rounded-lg border p-2">
                        <div className="text-foreground text-xs font-semibold">
                          Client Call
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          2:00 PM - 3:00 PM
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </MobileCalendarFrame>
            </div>
          </div>

          {/* Feature bullets */}
          <div className="mt-12 flex flex-wrap justify-center gap-6 md:mt-16 lg:gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="text-foreground text-sm font-medium">
                Fully responsive
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="text-foreground text-sm font-medium">
                App-like experience
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <span className="text-foreground text-sm font-medium">
                Modern and fast
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
