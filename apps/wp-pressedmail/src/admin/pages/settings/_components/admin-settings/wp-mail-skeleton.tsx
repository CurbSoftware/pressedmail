import { __ } from "@wordpress/i18n";

/**
 * What WordPress email draws while its settings load: the strip of tabs, then
 * two cards at the least height a connection card has (min-h-56, in the same
 * two-column grid), so the page does not jump when the state lands. The
 * status region names what is loading, as every settings wait does
 * (SettingsSkeleton).
 */
export function WpMailSkeleton() {
  const label = __("Loading WordPress email settings", "pressedmail");

  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      aria-live="polite"
      className="w-full min-w-0 max-w-6xl space-y-4"
      data-test="wp-mail-loading"
      data-testid="wp-mail-loading">
      <span className="block text-sm text-muted-foreground">{label}</span>
      <div
        aria-hidden="true"
        className="animate-pulse space-y-4 motion-reduce:animate-none">
        <div className="flex items-center gap-6 border-b pb-3">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((card) => (
            <div
              key={card}
              className="min-h-56 space-y-3 rounded-lg border bg-card p-4">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-3/4 rounded bg-muted/70" />
              <div className="h-3 w-1/2 rounded bg-muted/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
