import React from 'react';

import { cn } from '../lib/utils';

interface FooterSection {
  heading: React.ReactNode;
  links: Array<{
    href: string;
    label: React.ReactNode;
  }>;
}

interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  logo: React.ReactNode;
  description: React.ReactNode;
  copyright: React.ReactNode;
  sections: FooterSection[];
}

export const Footer: React.FC<FooterProps> = ({
  className,
  logo,
  description,
  copyright,
  sections,
  ...props
}) => {
  return (
    <footer
      className={cn(
        'site-footer bg-muted/20 relative mt-auto w-full py-8 xl:py-16 2xl:py-20',
        className,
      )}
      {...props}
    >
      <div className="container">
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-y-0">
          <div className="flex w-full gap-x-3 lg:w-4/12 xl:w-4/12 xl:space-x-6 2xl:space-x-8">
            <div className="flex flex-col gap-y-4">
              <div>{logo}</div>

              <div className="flex flex-col gap-y-4">
                <div>
                  <div className="text-muted-foreground text-sm">
                    {description}
                  </div>
                </div>

                <div className="text-muted-foreground flex text-xs">
                  <div>{copyright}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-1 flex-col gap-y-4 lg:flex-row lg:justify-end lg:gap-x-6 lg:gap-y-0 xl:gap-x-12">
            {sections.map((section, index) => (
              <div key={index}>
                <div className="flex flex-col gap-y-1">
                  <div className="lg:hidden">
                    <details className="border-border/60 rounded-lg border px-4 py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between">
                        <FooterSectionHeading>
                          {section.heading}
                        </FooterSectionHeading>
                        <span className="text-muted-foreground text-xs">+</span>
                      </summary>
                      <div className="mt-3">
                        <FooterSectionList>
                          {section.links.map((link, linkIndex) => (
                            <FooterLink key={linkIndex} href={link.href}>
                              {link.label}
                            </FooterLink>
                          ))}
                        </FooterSectionList>
                      </div>
                    </details>
                  </div>

                  <div className="hidden lg:block">
                    <FooterSectionHeading>
                      {section.heading}
                    </FooterSectionHeading>
                    <FooterSectionList>
                      {section.links.map((link, linkIndex) => (
                        <FooterLink key={linkIndex} href={link.href}>
                          {link.label}
                        </FooterLink>
                      ))}
                    </FooterSectionList>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

function FooterSectionHeading(props: React.PropsWithChildren) {
  return (
    <span className="font-heading text-secondary-foreground/90 text-sm font-medium">
      {props.children}
    </span>
  );
}

function FooterSectionList(props: React.PropsWithChildren) {
  return <ul className="flex flex-col gap-y-1">{props.children}</ul>;
}

function isExternalLink(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://');
}

function FooterLink({
  href,
  children,
}: React.PropsWithChildren<{ href: string }>) {
  const isExternal = isExternalLink(href);

  return (
    <li className="text-muted-foreground text-sm font-medium hover:underline [&>a]:transition-colors">
      <a
        href={href}
        {...(isExternal && {
          target: '_blank',
          rel: 'noopener noreferrer',
        })}
      >
        {children}
      </a>
    </li>
  );
}
