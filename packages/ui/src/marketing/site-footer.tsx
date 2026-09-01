import Link from 'next/link';

import { CookieSettingsTrigger } from '../makerkit/cookie-banner';
import { Trans } from '../makerkit/trans';

export interface FooterLink {
  href: string;
  label: React.ReactNode;
  external?: boolean;
}

export interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

export interface SiteFooterProps {
  productName: string;
  logo: React.ReactNode;
  columns: FooterColumn[];
  disclaimer?: string;
  languageSelector?: React.ReactNode;
}

export function SiteFooter({
  productName,
  logo,
  columns,
  disclaimer,
  languageSelector,
}: SiteFooterProps) {
  function renderLinkList(links: FooterLink[], columnIndex: number) {
    return (
      <ul className="flex flex-col gap-2.5">
        {links.map((link, linkIndex) => (
          <li key={`${columnIndex}-${link.href}-${linkIndex}`}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                data-umami-event="footer_link_clicked"
                data-umami-event-footer-column={columnIndex + 1}
                data-umami-event-footer-label={
                  typeof link.label === 'string' ? link.label : link.href
                }
                data-umami-event-footer-target={link.href}
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                data-umami-event="footer_link_clicked"
                data-umami-event-footer-column={columnIndex + 1}
                data-umami-event-footer-label={
                  typeof link.label === 'string' ? link.label : link.href
                }
                data-umami-event-footer-target={link.href}
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <footer
      className="site-footer border-t border-[color:var(--surface-border)] bg-[var(--surface-section-alt)] py-12 lg:py-16"
      data-analytics-section="site-footer"
    >
      <div className="container">
        {/* Footer Link Grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
          {columns.map((column, columnIndex) => (
            <div key={`${column.heading}-${columnIndex}`}>
              <h3 className="text-primary mb-4 text-xs font-medium tracking-wider uppercase">
                {column.heading}
              </h3>
              {renderLinkList(column.links, columnIndex)}
            </div>
          ))}
        </div>

        <div className="mt-10">
          {/* Logo */}
          <div>{logo}</div>

          {/* Copyright & Disclaimer */}
          <div className="border-border/10 mt-4 border-t pt-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="text-muted-foreground/60 flex flex-col gap-2 text-xs">
                <Trans
                  i18nKey="marketing:copyright"
                  values={{
                    product: productName,
                    year: new Date().getFullYear(),
                  }}
                />
                {disclaimer && (
                  <span className="max-w-lg leading-relaxed">{disclaimer}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <CookieSettingsTrigger className="text-muted-foreground/60 hover:text-foreground text-xs underline-offset-2 transition-colors hover:underline" />
                {languageSelector}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
