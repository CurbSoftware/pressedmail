'use client';

import { useMemo } from 'react';

import { Computer, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '../lib/utils';
import { Button } from '../shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../shadcn/card';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '../shadcn/dropdown-menu';
import { Trans } from './trans';

const MODES = ['light', 'dark', 'system'];

export function SubMenuModeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();

  const MenuItems = useMemo(
    () =>
      MODES.map((mode) => {
        const isSelected = theme === mode;

        return (
          <DropdownMenuItem
            className={cn('flex cursor-pointer items-center gap-x-2', {
              'bg-muted': isSelected,
            })}
            key={mode}
            onClick={() => {
              setTheme(mode);
              setCookeTheme(mode);
            }}
          >
            <Icon theme={mode} />

            <Trans i18nKey={`common.${mode}Theme`} />
          </DropdownMenuItem>
        );
      }),
    [setTheme, theme],
  );

  return (
    <DropdownMenuGroup>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          className={
            'hidden w-full items-center justify-between gap-x-2 lg:flex'
          }
        >
          <Icon theme={resolvedTheme} />

          <Trans i18nKey={'common.theme'} />
        </DropdownMenuSubTrigger>

        <DropdownMenuSubContent>{MenuItems}</DropdownMenuSubContent>
      </DropdownMenuSub>

      <div className={'lg:hidden'}>
        <DropdownMenuLabel>
          <Trans i18nKey={'common.theme'} />
        </DropdownMenuLabel>

        {MenuItems}
      </div>
    </DropdownMenuGroup>
  );
}

function setCookeTheme(theme: string) {
  document.cookie = `theme=${theme}; path=/; max-age=31536000`;
}

function Icon({ theme }: { theme: string | undefined }) {
  switch (theme) {
    case 'light':
      return <Sun className="h-4" />;
    case 'dark':
      return <Moon className="h-4" />;
    case 'system':
      return <Computer className="h-4" />;
  }
}

export function ThemePreferenceCard({
  currentTheme,
}: {
  currentTheme: string;
}) {
  const { setTheme, theme = currentTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans i18nKey="common.theme" />
        </CardTitle>

        <CardDescription>
          <Trans i18nKey="common.themeDescription" />
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {MODES.map((mode) => {
            const isSelected = theme === mode;

            return (
              <Button
                key={mode}
                variant={isSelected ? 'default' : 'outline'}
                className={'flex items-center justify-center gap-2'}
                onClick={() => {
                  setTheme(mode);
                  setCookeTheme(mode);
                }}
              >
                {mode === 'light' && <Sun className="size-4" />}
                {mode === 'dark' && <Moon className="size-4" />}
                {mode === 'system' && <Computer className="size-4" />}

                <span className="text-sm">
                  <Trans i18nKey={`common.${mode}Theme`} />
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
