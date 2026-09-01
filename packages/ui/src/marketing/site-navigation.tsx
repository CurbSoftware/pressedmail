'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
  BookOpen,
  Download,
  History,
  Mail,
  Map,
  Menu,
  Newspaper,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Trans } from '../makerkit/trans';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../shadcn/dropdown-menu';
import { NavLink, NavMenu, NavMenuItem, ResourceItem } from './navbar-menu';

interface ResourceItemConfig {
  labelKey: string;
  descKey: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
}

export interface CategoryInfo {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * A feature group rendered as a card in the Features mega-menu.
 */
export interface FeatureMenuGroup {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Paid-product Features mega-menu configuration. When supplied, the navigation
 * renders a Features control (overview + groups + a two-button action card)
 * instead of the legacy flat Product link, and omits the Free download CTA.
 *
 * Target sites activate this in the PR that canonicalizes `/features` and adds
 * real feature content (PRs 7/8); until then targets still pass `freePluginUrl`
 * and render the legacy nav unchanged.
 */
export interface FeatureMenuConfig {
  overview: { href: string; title: string; description: string };
  groups: readonly FeatureMenuGroup[];
  actions: {
    primary: { href: string; label: string };
    secondary: { href: string; label: string };
  };
}

export interface SiteNavigationProps {
  /**
   * @deprecated Supplied by not-yet-migrated targets. Paid products pass
   * `features` instead. Removed once PRs 7/8 migrate both target consumers.
   */
  freePluginUrl?: string;
  features?: FeatureMenuConfig;
  className?: string;
}

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

export function SiteNavigation({ freePluginUrl, features }: SiteNavigationProps) {
  const t = useTranslations('marketing');
  const [active, setActive] = useState<string | null>(null);

  const productLabel = t('product');
  const featuresLabel = t('features');
  const resourcesLabel = t('resources');

  const resourceItems: ResourceItemConfig[] = [
    {
      labelKey: 'nav.documentation',
      descKey: 'nav.documentationDesc',
      path: '/docs',
      icon: BookOpen,
    },
    {
      labelKey: 'nav.blog',
      descKey: 'nav.blogDesc',
      path: '/blog',
      icon: Newspaper,
    },
    {
      labelKey: 'nav.roadmap',
      descKey: 'nav.roadmapDesc',
      path: '/roadmap',
      icon: Map,
    },
    {
      labelKey: 'nav.changelog',
      descKey: 'nav.changelogDesc',
      path: '/changelog',
      icon: History,
    },
    {
      labelKey: 'nav.contact',
      descKey: 'nav.contactDesc',
      path: '/contact',
      icon: Mail,
    },
  ];

  // The Free download resource is a deprecated, legacy-only entry: a paid
  // product (features supplied, no freePluginUrl) never advertises a Free build.
  if (freePluginUrl && !features) {
    resourceItems.push({
      labelKey: 'nav.getFreeVersion',
      descKey: 'nav.getFreeVersionDesc',
      path: freePluginUrl,
      icon: Download,
      external: isExternalHref(freePluginUrl),
    });
  }

  const primaryFeaturesHref = features?.overview.href ?? '/features';

  return (
    <div
      className="flex items-center gap-1"
      data-analytics-section="site-navigation"
    >
      {/* Desktop Navigation */}
      <div className="relative hidden lg:flex">
        <NavMenu active={active} setActive={setActive}>
          <NavLink href="/" analyticsLabel="home">
            <Trans i18nKey="marketing:home" defaults="Home" />
          </NavLink>

          {features ? (
            <NavMenuItem
              item={featuresLabel}
              active={active}
              setActive={setActive}
            >
              <div className="flex flex-col gap-4">
                <div className="w-130">
                  <ResourceItem
                    href={features.overview.href}
                    icon={Map}
                    title={features.overview.title}
                    description={features.overview.description}
                  />
                </div>
                {features.groups.length > 0 ? (
                  <div className="grid w-130 [grid-auto-rows:5rem] grid-cols-2 gap-3">
                    {features.groups.map((group) => (
                      <ResourceItem
                        key={group.href}
                        href={group.href}
                        icon={group.icon}
                        title={group.title}
                        description={group.description}
                      />
                    ))}
                  </div>
                ) : null}
                {/* See it in action: two vertically stacked, full-width buttons. */}
                <div className="flex w-full flex-col gap-2 border-t pt-3">
                  <Link
                    href={features.actions.primary.href}
                    prefetch={true}
                    data-umami-event="nav_link_clicked"
                    data-umami-event-nav-label="features-primary"
                    data-umami-event-nav-location="desktop"
                    data-umami-event-nav-target={features.actions.primary.href}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                  >
                    {features.actions.primary.label}
                  </Link>
                  <Link
                    href={features.actions.secondary.href}
                    prefetch={true}
                    data-umami-event="nav_link_clicked"
                    data-umami-event-nav-label="features-secondary"
                    data-umami-event-nav-location="desktop"
                    data-umami-event-nav-target={
                      features.actions.secondary.href
                    }
                    className="inline-flex h-9 w-full items-center justify-center rounded-md border border-slate-400/60 bg-slate-200/10 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-200/20"
                  >
                    {features.actions.secondary.label}
                  </Link>
                </div>
              </div>
            </NavMenuItem>
          ) : (
            <NavLink href="/features" analyticsLabel="features">
              {features ? featuresLabel : productLabel}
            </NavLink>
          )}

          <NavLink href="/pricing" analyticsLabel="pricing">
            <Trans i18nKey="marketing:pricing" defaults="Pricing" />
          </NavLink>

          <NavMenuItem
            item={resourcesLabel}
            active={active}
            setActive={setActive}
          >
            <div className="grid w-130 [grid-auto-rows:5rem] grid-cols-3 gap-3">
              {resourceItems.map((item) => (
                <ResourceItem
                  key={item.path}
                  href={item.path}
                  icon={item.icon}
                  title={t(item.labelKey)}
                  description={t(item.descKey)}
                  external={item.external}
                />
              ))}
            </div>
          </NavMenuItem>
        </NavMenu>
      </div>

      {/* Mobile Menu Button */}
      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md"
            title="Navigation menu"
            aria-label="Toggle navigation menu"
            data-umami-event="nav_menu_opened"
            data-umami-event-nav-label="mobile-menu"
            data-umami-event-nav-location="mobile"
          >
            <Menu className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link
                href="/"
                data-umami-event="nav_link_clicked"
                data-umami-event-nav-label="home"
                data-umami-event-nav-location="mobile"
                data-umami-event-nav-target="/"
              >
                <Trans i18nKey="marketing:home" defaults="Home" />
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href={primaryFeaturesHref}
                data-umami-event="nav_link_clicked"
                data-umami-event-nav-label={features ? 'features' : 'product'}
                data-umami-event-nav-location="mobile"
                data-umami-event-nav-target={primaryFeaturesHref}
              >
                {features ? featuresLabel : productLabel}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/pricing"
                data-umami-event="nav_link_clicked"
                data-umami-event-nav-label="pricing"
                data-umami-event-nav-location="mobile"
                data-umami-event-nav-target="/pricing"
              >
                <Trans i18nKey="marketing:pricing" defaults="Pricing" />
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Resources */}
            {resourceItems.map((item) => (
              <DropdownMenuItem key={item.path} asChild>
                {item.external ? (
                  <a
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                    data-umami-event="nav_link_clicked"
                    data-umami-event-nav-label={t(item.labelKey)}
                    data-umami-event-nav-location="mobile"
                    data-umami-event-nav-target={item.path}
                  >
                    <item.icon className="h-4 w-4" />
                    {t(item.labelKey)}
                  </a>
                ) : (
                  <Link
                    href={item.path}
                    className="flex items-center gap-2"
                    data-umami-event="nav_link_clicked"
                    data-umami-event-nav-label={t(item.labelKey)}
                    data-umami-event-nav-location="mobile"
                    data-umami-event-nav-target={item.path}
                  >
                    <item.icon className="h-4 w-4" />
                    {t(item.labelKey)}
                  </Link>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
