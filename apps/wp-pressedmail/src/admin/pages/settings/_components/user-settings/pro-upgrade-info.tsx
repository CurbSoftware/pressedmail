/**
 * PressedMail Pro information section for the Free build.
 *
 * WordPress.org compliant: a purely informational overview. It advertises the
 * separately distributed Pro plugin with outbound links and does NOT lock,
 * disable, or gate any built-in functionality. No license input, no checkout,
 * no `openUpgradeModal` (which is a no-op in Free anyway).
 */
import { __ } from "@wordpress/i18n";
import {
  Brain,
  Check,
  Contact,
  Crown,
  ExternalLink,
  Inbox,
  Infinity as InfinityIcon,
  Palette,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge, Button, Card, CardContent } from "@kit/ui/plugin";

const PRICING_URL = "https://pressedmail.com/pricing";

type ProFeature = {
  label: string;
  /** Included with Ultimate only, not every paid plan. */
  ultimate?: boolean;
};

type ProCategory = {
  icon: LucideIcon;
  title: string;
  description: string;
  features: ProFeature[];
  /** The whole group is Ultimate only. */
  ultimate?: boolean;
  /** Extra detail shown under the checklist. */
  note?: string;
};

const WHY_PRO = [
  {
    title: __("One inbox for every account", "pressedmail"),
    description: __(
      "Read all your accounts in one list, then snooze or schedule what can wait.",
      "pressedmail",
    ),
  },
  {
    title: __("People and dates next to your mail", "pressedmail"),
    description: __(
      "A contact book and a calendar live in WordPress, right beside your messages.",
      "pressedmail",
    ),
  },
  {
    title: __("Switch without starting over", "pressedmail"),
    description: __(
      "Compatible accounts, settings, and local data carry over from Free.",
      "pressedmail",
    ),
  },
];

/**
 * Every claim here has to be true of the shipped builds, and only genuinely
 * unlimited things belong in this strip. Sites are not: yearly plans are
 * priced by number of sites and Lifetime covers up to 100, so the site rule
 * lives in the closing section. Tags are unlimited in Free too
 * (readme-free.txt), so the unlimited line is about signatures, which Free
 * ships one of.
 */
const PRO_CAPABILITIES = [
  __("Unlimited accounts", "pressedmail"),
  __("Unlimited signatures", "pressedmail"),
  __("Unlimited contacts and calendars", "pressedmail"),
];

const feature = (label: string): ProFeature => ({ label });
const ultimateFeature = (label: string): ProFeature => ({
  label,
  ultimate: true,
});

/**
 * Tiers follow plugin-files/includes/Config/feature-flags.php: a
 * `licensed_value` is every paid plan, an `extended_value` is Ultimate only.
 * Only list features that ship in a released Pro build: this page ships in the
 * Free build and cannot be corrected until the next release.
 *
 * Left out on purpose: things Free already has (folders, the rich composer,
 * role access, site SMTP), flags with no screen yet (
 * audit log, webhooks, free/busy, custom shortcuts), licensing plumbing, and
 * anything not built (open/click tracking, delivery analytics, bounce
 * handling).
 */
const PRO_CATEGORIES: ProCategory[] = [
  {
    icon: Inbox,
    title: __("Mail and sending", "pressedmail"),
    description: __(
      "See what matters across every account, and send on your schedule.",
      "pressedmail",
    ),
    features: [
      feature(__("Combined inbox across accounts", "pressedmail")),
      feature(__("Snooze emails", "pressedmail")),
      feature(__("Automatic follow-up reminders", "pressedmail")),
      feature(__("Auto-replies", "pressedmail")),
      feature(__("Scheduled send", "pressedmail")),
      feature(__("Undo send", "pressedmail")),
      feature(__("Read receipts", "pressedmail")),
      feature(__("Multiple SMTP servers, routed by sender", "pressedmail")),
      feature(__("Managed mail settings for your domains", "pressedmail")),
    ],
  },
  {
    icon: Contact,
    title: __("Contacts and calendar", "pressedmail"),
    description: __(
      "Keep people and schedules next to every conversation.",
      "pressedmail",
    ),
    features: [
      feature(__("Contact book and lists", "pressedmail")),
      feature(__("Activity tracking and notes", "pressedmail")),
      feature(__("CSV and vCard import and export", "pressedmail")),
      feature(__("Built-in calendar", "pressedmail")),
      feature(__("Recurring events", "pressedmail")),
      feature(__("Add email invites to your calendar", "pressedmail")),
      feature(
        __("Calendar conflict warnings on scheduled send", "pressedmail"),
      ),
    ],
  },
  {
    icon: Brain,
    title: __("AI with your own key", "pressedmail"),
    description: __(
      "Connect your AI provider to draft, polish, summarize, and sort.",
      "pressedmail",
    ),
    features: [
      feature(__("Drafting and reply suggestions", "pressedmail")),
      feature(__("Enhance and polish", "pressedmail")),
      feature(__("Email summaries", "pressedmail")),
      feature(__("Auto-tagging", "pressedmail")),
      feature(__("Filing into folders", "pressedmail")),
      feature(__("Phishing detection", "pressedmail")),
    ],
  },
  {
    icon: Sparkles,
    title: __("Hosted AI", "pressedmail"),
    description: __(
      "No key to set up. Our hosted AI runs auto-tagging and phishing checks for you.",
      "pressedmail",
    ),
    features: [],
    note: __(
      "Hosted AI uses credits: one credit per email for spam and phishing together, and one for tagging. Paid plans include credits and you can buy more. Your own AI key never uses them.",
      "pressedmail",
    ),
  },
  {
    icon: Palette,
    title: __("Themes, layouts, and support", "pressedmail"),
    description: __(
      "Shape PressedMail around your look, your layout, and your device.",
      "pressedmail",
    ),
    features: [
      feature(__("Premium themes", "pressedmail")),
      feature(__("Premium layouts", "pressedmail")),
      feature(__("Priority support", "pressedmail")),
      ultimateFeature(__("White-labeling", "pressedmail")),
    ],
  },
  {
    icon: Users,
    title: __("Team sharing", "pressedmail"),
    description: __(
      "Share an inbox, calendar, or contact list with teammates on your site. You stay the owner and can remove anyone at any time.",
      "pressedmail",
    ),
    ultimate: true,
    features: [
      feature(__("Shared inboxes", "pressedmail")),
      feature(__("Shared calendars", "pressedmail")),
      feature(__("Shared contact lists", "pressedmail")),
      feature(__("Choose who can view, reply, or edit", "pressedmail")),
    ],
  },
];

/** Foreground text on the page background keeps small text above 4.5:1. */
const PRO_BADGE = "shrink-0 border-pro-border bg-background text-foreground";

function UltimateBadge() {
  return (
    <Badge variant="outline" className={PRO_BADGE}>
      {__("Ultimate", "pressedmail")}
    </Badge>
  );
}

function PricingLink() {
  return (
    <Button asChild className="bg-pro text-pro-foreground hover:bg-pro/90">
      <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">
        {__("See Pro plans", "pressedmail")}{" "}
        <span className="sr-only">
          {__("(opens in a new tab)", "pressedmail")}
        </span>
        <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    </Button>
  );
}

export function ProUpgradeInfo() {
  return (
    <div className="space-y-4">
      <Card size="sm">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <section
            aria-label={__("PressedMail Pro upgrade overview", "pressedmail")}
            className="grid gap-5 overflow-hidden rounded-xl border border-pro-border bg-pro-muted p-5 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)] lg:items-stretch">
            <div className="flex min-w-0 flex-col items-start justify-center">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-pro-border bg-background/70 text-pro">
                  <Crown className="size-5" aria-hidden="true" />
                </span>
                {/* Stacked, not a badge beside the name: it fits a phone
                    without wrapping and reads on the tinted panel. */}
                <span className="min-w-0">
                  <span className="block text-base font-bold tracking-tight text-foreground">
                    {__("PressedMail Pro", "pressedmail")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {__("Separate plugin", "pressedmail")}
                  </span>
                </span>
              </div>

              <h2 className="max-w-xl text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {__(
                  "Everything in Free, plus contacts, a calendar, and AI",
                  "pressedmail",
                )}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {__(
                  "Pro adds a combined inbox for unlimited accounts, scheduled send, snooze, a contact book, a built-in calendar, and AI that drafts, summarizes, and sorts. Ultimate adds team sharing.",
                  "pressedmail",
                )}
              </p>

              <div className="mt-5">
                <PricingLink />
              </div>
            </div>

            <section
              aria-label={__("Why Pro", "pressedmail")}
              className="rounded-lg border border-pro-border bg-background/65 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {__("Why Pro", "pressedmail")}
              </h3>
              <ul className="mt-3 space-y-3">
                {WHY_PRO.map((benefit) => (
                  <li key={benefit.title} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-pro"
                      aria-hidden="true"
                    />
                    {/* Spans, not paragraphs: wp-admin's unlayered
                        common.css `p { margin: 1em 0 }` beats every layered
                        Tailwind utility, which pushed each title about 16px
                        below its check icon. */}
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {benefit.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {benefit.description}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <ul
            aria-label={__("PressedMail Pro capability summary", "pressedmail")}
            className="grid gap-2 sm:grid-cols-3">
            {PRO_CAPABILITIES.map((capability) => (
              <li
                key={capability}
                className="flex items-center gap-2 rounded-lg border border-pro-border bg-pro-muted px-3 py-2.5">
                <InfinityIcon
                  className="size-4 shrink-0 text-pro"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-foreground">
                  {capability}
                </span>
              </li>
            ))}
          </ul>

          <section
            aria-label={__("PressedMail Pro features", "pressedmail")}
            className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                {__("A more capable workspace, at a glance", "pressedmail")}
              </h2>
              {/* A legend, badge first, so translators get a whole sentence
                  and the badge never wraps onto a line by itself. */}
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <UltimateBadge />
                <span>
                  {__(
                    "Needs an Ultimate plan. Every Pro plan includes everything else below.",
                    "pressedmail",
                  )}
                </span>
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {PRO_CATEGORIES.map((category) => {
                const CategoryIcon = category.icon;

                return (
                  <article
                    key={category.title}
                    className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-pro-border bg-pro-muted text-pro">
                        <CategoryIcon className="size-4" aria-hidden="true" />
                      </span>
                      <h3 className="text-sm font-semibold text-foreground">
                        {category.title}
                      </h3>
                      {category.ultimate ? <UltimateBadge /> : null}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {category.description}
                    </p>
                    {category.features.length > 0 ? (
                      <ul className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                        {category.features.map((item) => (
                          <li
                            key={item.label}
                            className="flex items-start gap-2">
                            <Check
                              className="mt-0.5 size-3.5 shrink-0 text-pro"
                              aria-hidden="true"
                            />
                            <span className="text-xs leading-5 font-medium text-foreground">
                              {item.label}
                            </span>
                            {item.ultimate ? <UltimateBadge /> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {category.note ? (
                      <span className="mt-3 block text-xs leading-5 text-muted-foreground">
                        {category.note}
                      </span>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="grid items-center gap-4 rounded-xl border border-pro-border bg-pro-muted px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {__("Compare Pro plans", "pressedmail")}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                {__(
                  "Plans differ by how many sites they cover. The pricing page lists what each one includes.",
                  "pressedmail",
                )}
              </p>
            </div>
            <PricingLink />
          </section>

          <p className="text-center text-xs text-muted-foreground">
            {__(
              "PressedMail Pro is a separate plugin. Nothing in PressedMail Free is locked behind a purchase.",
              "pressedmail",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProUpgradeInfo;
