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
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Badge, Button, Card, CardContent } from "@kit/ui/plugin";

const PRICING_URL = "https://pressedmail.com/pricing";

type ProCategory = {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
};

const WHY_PRO = [
  {
    title: __("Stay ahead of busy inboxes", "pressedmail"),
    description: __(
      "Prioritize, snooze, and follow up without losing track.",
      "pressedmail",
    ),
  },
  {
    title: __("Keep work connected", "pressedmail"),
    description: __(
      "Manage email, contacts, and calendars in one workspace.",
      "pressedmail",
    ),
  },
  {
    title: __("Make it your workspace", "pressedmail"),
    description: __(
      "Choose Pro themes, layouts, and mobile enhancements.",
      "pressedmail",
    ),
  },
];

const PRO_CAPABILITIES = [
  __("Unlimited accounts", "pressedmail"),
  __("Unlimited users & sites", "pressedmail"),
  __("Unlimited tags & signatures", "pressedmail"),
  __("Unlimited contacts & calendars", "pressedmail"),
];

const PRO_CATEGORIES: ProCategory[] = [
  {
    icon: Inbox,
    title: __("Inbox & Organization", "pressedmail"),
    description: __(
      "See what matters, organize every account, and keep follow-ups from slipping.",
      "pressedmail",
    ),
    features: [
      __("Combined inbox across accounts", "pressedmail"),
      __("Smart inbox prioritization", "pressedmail"),
      __("Snooze emails", "pressedmail"),
      __("Automatic follow-up reminders", "pressedmail"),
      __("Custom & smart folders", "pressedmail"),
      __("Unlimited tags", "pressedmail"),
    ],
  },
  {
    icon: Send,
    title: __("Writing & Sending", "pressedmail"),
    description: __(
      "Compose polished messages and send them on your schedule.",
      "pressedmail",
    ),
    features: [
      __("Scheduled send", "pressedmail"),
      __("Conditional signature rules", "pressedmail"),
      __("Rich composer", "pressedmail"),
    ],
  },
  {
    icon: Brain,
    title: __("AI Assistance", "pressedmail"),
    description: __(
      "Use your own API key to draft, refine, summarize, organize, and flag suspicious messages.",
      "pressedmail",
    ),
    features: [
      __("AI drafting", "pressedmail"),
      __("AI reply suggestions", "pressedmail"),
      __("AI enhance & polish", "pressedmail"),
      __("AI thread summaries", "pressedmail"),
      __("AI auto-tagger", "pressedmail"),
      __("AI inbox organizer", "pressedmail"),
      __("AI phishing detection", "pressedmail"),
    ],
  },
  {
    icon: Contact,
    title: __("Contacts & Calendar", "pressedmail"),
    description: __(
      "Keep people, context, and schedules close to every conversation.",
      "pressedmail",
    ),
    features: [
      __("Contact book", "pressedmail"),
      __("Contact lists & sharing", "pressedmail"),
      __("Activity tracking & notes", "pressedmail"),
      __("Custom contact fields", "pressedmail"),
      __("CSV & vCard import/export", "pressedmail"),
      __("Local calendar", "pressedmail"),
      __("Google & Outlook calendar sync", "pressedmail"),
      __("Recurring events", "pressedmail"),
    ],
  },
  {
    icon: ShieldCheck,
    title: __("Accounts & Protection", "pressedmail"),
    description: __(
      "Connect more mailboxes with modern sign-in and verify your Pro installation.",
      "pressedmail",
    ),
    features: [
      __("Plugin integrity checks", "pressedmail"),
      __("Unlimited accounts, users & sites", "pressedmail"),
      __("OAuth mail sign-in (XOAUTH2)", "pressedmail"),
    ],
  },
  {
    icon: Palette,
    title: __("Themes, Layouts & Support", "pressedmail"),
    description: __(
      "Shape PressedMail around your preferred look, layout, and device.",
      "pressedmail",
    ),
    features: [
      __("Premium themes", "pressedmail"),
      __("Premium layouts", "pressedmail"),
      __("Enhanced mobile layouts", "pressedmail"),
      __("Priority support", "pressedmail"),
    ],
  },
];

function PricingLink() {
  return (
    <Button asChild>
      <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">
        {__("Explore PressedMail Pro", "pressedmail")}
        <span className="sr-only">
          {__(" (opens in a new tab)", "pressedmail")}
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
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-pro-border bg-background/70 text-pro">
                  <Crown className="size-5" aria-hidden="true" />
                </span>
                <span className="text-base font-bold tracking-tight text-foreground">
                  {__("PressedMail Pro", "pressedmail")}
                </span>
                <Badge variant="secondary">
                  {__("Separate plugin", "pressedmail")}
                </Badge>
              </div>

              <h2 className="max-w-xl text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {__("Make every inbox easier to manage.", "pressedmail")}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {__(
                  "Bring smarter organization, AI-assisted writing, contacts, calendars, and workspace customization into one WordPress-native mail experience.",
                  "pressedmail",
                )}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <PricingLink />
                <span className="text-xs text-muted-foreground">
                  {__("Opens pressedmail.com in a new tab.", "pressedmail")}
                </span>
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
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {benefit.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {benefit.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <ul
            aria-label={__("PressedMail Pro capability summary", "pressedmail")}
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PRO_CAPABILITIES.map((capability) => (
              <li
                key={capability}
                className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
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
              <p className="text-sm text-muted-foreground">
                {__(
                  "Six focused toolsets for managing mail, people, schedules, and day-to-day follow-through.",
                  "pressedmail",
                )}
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
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {category.description}
                    </p>
                    <ul className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                      {category.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check
                            className="mt-0.5 size-3.5 shrink-0 text-pro"
                            aria-hidden="true"
                          />
                          <span className="text-xs leading-5 font-medium text-foreground">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="grid items-center gap-4 rounded-xl border border-pro-border bg-pro-muted px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {__("Ready to get more from your inbox?", "pressedmail")}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                {__(
                  "Add smarter organization, AI assistance, connected contacts and calendars, and a workspace that adapts to the way you work.",
                  "pressedmail",
                )}
              </p>
            </div>
            <PricingLink />
          </section>

          <p className="text-center text-xs text-muted-foreground">
            {__(
              "PressedMail Pro is separately distributed. Nothing in PressedMail Free is locked behind a purchase.",
              "pressedmail",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProUpgradeInfo;
