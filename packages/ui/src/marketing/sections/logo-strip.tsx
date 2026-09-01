'use client';

import { useState } from 'react';

interface Provider {
  name: string;
  icon: string;
  hoverColor: string;
}

function ProviderIcon({ provider }: { provider: Provider }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group flex snap-center flex-row items-center gap-2.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        aria-hidden="true"
        className="block h-8 w-8 shrink-0 transition-all duration-200 ease-out group-hover:scale-110"
        style={{
          WebkitMaskImage: `url(${provider.icon})`,
          maskImage: `url(${provider.icon})`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          backgroundColor: isHovered
            ? provider.hoverColor
            : 'var(--color-foreground)',
        }}
      />
      <span
        className="text-lg font-semibold transition-colors duration-200"
        style={{
          color: isHovered ? provider.hoverColor : 'var(--color-foreground)',
        }}
      >
        {provider.name}
      </span>
    </div>
  );
}

export interface LogoStripProps {
  providers?: Provider[];
  className?: string;
}

function getSharedProviderIconUrl(fileName: string) {
  return `/images/providers/${fileName}`;
}

const DEFAULT_PROVIDERS: Provider[] = [
  {
    name: 'Gmail',
    icon: getSharedProviderIconUrl('gmail-icon.svg'),
    hoverColor: '#ef4444',
  },
  {
    name: 'Outlook/Hotmail',
    icon: getSharedProviderIconUrl('outlook-icon.svg'),
    hoverColor: '#0078d4',
  },
  {
    name: 'Yahoo Mail',
    icon: getSharedProviderIconUrl('yahoo-icon.svg'),
    hoverColor: '#6001d2',
  },
  {
    name: 'iCloud Mail',
    icon: getSharedProviderIconUrl('icloud-icon.svg'),
    hoverColor: '#3b82f6',
  },
  {
    name: 'Proton Mail',
    icon: getSharedProviderIconUrl('protonmail-icon.svg'),
    hoverColor: '#6d4aff',
  },
  {
    name: 'Custom Email',
    icon: getSharedProviderIconUrl('custom-email-icon.svg'),
    hoverColor: 'var(--color-primary)',
  },
];

export function LogoStrip({ providers = DEFAULT_PROVIDERS }: LogoStripProps) {
  return (
    <section className="border-border border-b py-10 md:py-14">
      <div className="container">
        <div className="flex snap-x snap-mandatory items-start justify-start gap-5 overflow-x-auto sm:flex-wrap sm:justify-center sm:overflow-visible md:gap-8 lg:gap-10">
          {providers.map((provider) => (
            <ProviderIcon key={provider.name} provider={provider} />
          ))}
        </div>
      </div>
    </section>
  );
}
