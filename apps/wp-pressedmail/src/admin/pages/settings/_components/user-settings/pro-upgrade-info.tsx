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
  Code,
  Contact,
  ExternalLink,
  Inbox,
  Infinity as InfinityIcon,
  LayoutTemplate,
  Palette,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge, Button, cn } from "@kit/ui/plugin";

import { SettingsSectionCard } from "@/components/settings-ui";

const PRICING_URL = "https://pressedmail.com/pricing";

type ProFeature = {
  label: string;
  /** Included with Ultimate only, not every paid plan. */
  ultimate?: boolean;
};

type ProCategory = {
  /** Stable handle for the card, so tests do not lean on translated copy. */
  id: string;
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
export const PRO_CAPABILITIES = [
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
 * pro-upgrade-info.flags.test.ts holds the flag-to-row map and fails when a
 * paid flag is neither on this page nor in its list of reasons. The map lives
 * there because flag ids are Free-forbidden strings (edition-purity.json) and
 * this file ships in Free.
 *
 * Left out on purpose: things Free already has (folders, the rich composer,
 * role access, site SMTP, WordPress abilities), flags nobody can reach from a
 * screen (audit log, free/busy, auto-add contacts, custom contact fields, a
 * theme editor), licensing plumbing, and claims we do not make (open and
 * click tracking, delivery analytics, bounce handling).
 */
export const PRO_CATEGORIES: ProCategory[] = [
  {
    icon: Inbox,
    id: "mail",
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
    icon: LayoutTemplate,
    id: "templates",
    title: __("Templates, forms, and campaigns", "pressedmail"),
    description: __(
      "Write an email once, reuse it, and send it to a whole list.",
      "pressedmail",
    ),
    features: [
      feature(__("Email templates with personalized fields", "pressedmail")),
      feature(__("Reusable content blocks", "pressedmail")),
      feature(__("Signup forms that fill your contact lists", "pressedmail")),
      ultimateFeature(__("Campaigns to a contact list", "pressedmail")),
    ],
  },
  {
    icon: Contact,
    id: "contacts",
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
      feature(
        __("Sync with Google, Outlook, CardDAV, and CalDAV", "pressedmail"),
      ),
    ],
    note: __(
      "Sync needs the free PressedMail Contacts & Calendars plugin.",
      "pressedmail",
    ),
  },
  {
    icon: Brain,
    id: "ai",
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
    id: "hosted-ai",
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
    id: "look",
    title: __("Themes, layouts, and support", "pressedmail"),
    description: __(
      "Shape PressedMail around your look, your layout, and your device.",
      "pressedmail",
    ),
    features: [
      feature(__("Premium themes", "pressedmail")),
      feature(__("Premium layouts", "pressedmail")),
      feature(__("Custom keyboard shortcuts", "pressedmail")),
      feature(__("Priority support", "pressedmail")),
      ultimateFeature(__("White-labeling", "pressedmail")),
    ],
  },
  {
    icon: Users,
    id: "sharing",
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
      feature(__("Shared templates and blocks", "pressedmail")),
      feature(__("Choose who can view, reply, or edit", "pressedmail")),
    ],
  },
  {
    icon: Code,
    id: "developers",
    title: __("For developers", "pressedmail"),
    description: __("Connect PressedMail to your own tools.", "pressedmail"),
    features: [
      feature(__("REST API with scoped keys", "pressedmail")),
      feature(__("Webhooks for sent and received email", "pressedmail")),
    ],
    note: __(
      "Keys and webhooks are set up through the REST API. There is no settings screen for them yet.",
      "pressedmail",
    ),
  },
];

function UltimateBadge() {
  return (
    <Badge variant="outline" className="shrink-0">
      {__("Ultimate", "pressedmail")}
    </Badge>
  );
}

function PricingLink() {
  return (
    <Button asChild>
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

/** The bordered tile the Diagnostics tab uses for its grids. */
const TILE = "rounded-md border border-border/80 bg-muted/15 p-3";

/*
 * Spans, not paragraphs, for our own copy: wp-admin's unlayered common.css
 * `p { margin: 1em 0 }` beats every layered Tailwind utility.
 */
export function ProUpgradeInfo() {
  return (
    <div className="space-y-4">
      <SettingsSectionCard
        dataTest="pro-overview"
        title={
          <span role="heading" aria-level={2}>
            {__(
              "Everything in Free, plus contacts, a calendar, and AI",
              "pressedmail",
            )}
          </span>
        }
        description={__(
          "Pro adds a combined inbox for unlimited accounts, scheduled send, snooze, a contact book, a built-in calendar, email templates, signup forms, and AI that drafts, summarizes, and sorts. Ultimate adds team sharing and campaigns.",
          "pressedmail",
        )}
        contentClassName="space-y-3">
        <ul
          aria-label={__("Why Pro", "pressedmail")}
          className="grid gap-2 sm:grid-cols-3">
          {WHY_PRO.map((benefit) => (
            <li
              key={benefit.title}
              className={cn("flex items-start gap-2.5", TILE)}>
              <Check
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
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

        <ul
          aria-label={__("PressedMail Pro capability summary", "pressedmail")}
          className="grid gap-2 sm:grid-cols-3">
          {PRO_CAPABILITIES.map((capability) => (
            <li
              key={capability}
              className={cn("flex items-center gap-2", TILE)}>
              <InfinityIcon
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">
                {capability}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-start gap-3 pt-1 sm:flex-row sm:items-center">
          <PricingLink />
          {/* A legend, badge first, so translators get a whole sentence and
              the badge never wraps onto a line by itself. */}
          <span className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
            <UltimateBadge />
            <span>
              {__(
                "Needs an Ultimate plan. Every Pro plan includes everything else below.",
                "pressedmail",
              )}
            </span>
          </span>
        </div>
      </SettingsSectionCard>

      <section
        aria-label={__("PressedMail Pro features", "pressedmail")}
        className="grid gap-4 lg:grid-cols-2">
        {PRO_CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;

          return (
            <SettingsSectionCard
              key={category.id}
              dataTest={`pro-category-${category.id}`}
              title={
                <span className="flex items-center gap-2">
                  <CategoryIcon
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span role="heading" aria-level={2}>
                    {category.title}
                  </span>
                  {category.ultimate ? <UltimateBadge /> : null}
                </span>
              }
              description={category.description}
              contentClassName="space-y-3">
              {category.features.length > 0 ? (
                <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  {category.features.map((item) => (
                    <li key={item.label} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span className="text-sm leading-5 text-foreground">
                        {item.label}
                      </span>
                      {item.ultimate ? <UltimateBadge /> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {category.note ? (
                <span className="block text-xs leading-5 text-muted-foreground">
                  {category.note}
                </span>
              ) : null}
            </SettingsSectionCard>
          );
        })}
      </section>

      <SettingsSectionCard
        dataTest="pro-plans"
        title={
          <span role="heading" aria-level={2}>
            {__("Compare Pro plans", "pressedmail")}
          </span>
        }
        description={__(
          "Plans differ by how many sites they cover. The pricing page lists what each one includes.",
          "pressedmail",
        )}
        contentClassName="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs leading-5 text-muted-foreground">
          {__(
            "PressedMail Pro is a separate plugin. Nothing in PressedMail Free is locked behind a purchase.",
            "pressedmail",
          )}
        </span>
        <PricingLink />
      </SettingsSectionCard>
    </div>
  );
}

export default ProUpgradeInfo;
