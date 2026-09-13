'use client';

import * as React from 'react';
import { formatCodeBlock, isLangSupported } from '@kit/plate/code-block';
import { BracesIcon, Check, CheckIcon, CopyIcon } from 'lucide-react';
import { NodeApi, type TCodeBlockElement, type TCodeSyntaxLeaf } from '@kit/plate';
import {
  PlateElement,
  type PlateElementProps,
  PlateLeaf,
  type PlateLeafProps,
  useEditorRef,
  useElement,
  useReadOnly,
} from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@kit/ui/plugin';

import { cn } from '@/lib/utils';

/**
 * Code block with lowlight syntax highlighting, language picker, format and
 * copy buttons (template code-block-node.tsx port). Token colors live in
 * scoped CSS (tailwind-base.css `.hljs-*` rules) instead of the template's
 * `**:[.hljs-*]` arbitrary variants, which this build does not emit.
 * The <pre> wraps instead of scrolling, the content area never scrolls
 * horizontally. Email serialization uses code-block-node-static.tsx.
 */
export function CodeBlockElement(props: PlateElementProps<TCodeBlockElement>) {
  const { editor, element } = props;

  return (
    <PlateElement className="py-1" {...props}>
      <div className="relative rounded-md bg-transparent">
        <pre className="whitespace-pre-wrap break-words rounded-md border p-8 pr-4 font-mono text-sm leading-[normal] [tab-size:2] print:break-inside-avoid">
          <code>{props.children}</code>
        </pre>

        <div
          className="absolute right-1 top-1 z-10 flex select-none gap-0.5"
          contentEditable={false}
        >
          {isLangSupported(element.lang) && (
            <Button
              className="size-6 text-xs"
              onClick={() => formatCodeBlock(editor, { element })}
              size="icon"
              title={__('Format code', 'pressedmail')}
              variant="ghost"
            >
              <BracesIcon className="!size-3.5 text-muted-foreground" />
            </Button>
          )}

          <CodeBlockCombobox />

          <CopyButton
            className="size-6 gap-1 text-xs text-muted-foreground"
            size="icon"
            value={() => NodeApi.string(element)}
            variant="ghost"
          />
        </div>
      </div>
    </PlateElement>
  );
}

function CodeBlockCombobox() {
  const [open, setOpen] = React.useState(false);
  const readOnly = useReadOnly();
  const editor = useEditorRef();
  const element = useElement<TCodeBlockElement>();
  const value = element.lang || 'plaintext';
  const [searchValue, setSearchValue] = React.useState('');

  const items = React.useMemo(
    () =>
      languages.filter(
        (language) =>
          !searchValue ||
          languageLabel(language).toLowerCase().includes(searchValue.toLowerCase()),
      ),
    [searchValue],
  );

  if (readOnly) return null;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="h-6 select-none justify-between gap-1 px-2 text-xs text-muted-foreground"
          role="combobox"
          size="sm"
          variant="ghost"
        >
          {languageLabel(
            languages.find((language) => language.value === value) ?? {
              label: '',
              value: 'plaintext',
            },
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-0"
        onCloseAutoFocus={() => setSearchValue('')}
      >
        <Command shouldFilter={false}>
          <CommandInput
            className="h-9"
            onValueChange={(v: string) => setSearchValue(v)}
            placeholder={__('Search language…', 'pressedmail')}
            value={searchValue}
          />
          <CommandEmpty>{__('No language found.', 'pressedmail')}</CommandEmpty>

          <CommandList className="max-h-[344px] overflow-y-auto">
            <CommandGroup>
              {items.map((language) => (
                <CommandItem
                  className="cursor-pointer"
                  key={languageLabel(language)}
                  onSelect={(v: string) => {
                    editor.tf.setNodes<TCodeBlockElement>(
                      { lang: v },
                      { at: element },
                    );
                    setSearchValue(v);
                    setOpen(false);
                  }}
                  value={language.value}
                >
                  <Check
                    className={cn(
                      value === language.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {languageLabel(language)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CopyButton({
  value,
  ...props
}: { value: (() => string) | string } & Omit<
  React.ComponentProps<typeof Button>,
  'value'
>) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setHasCopied(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [hasCopied]);

  return (
    <Button
      onClick={() => {
        void navigator.clipboard.writeText(
          typeof value === 'function' ? value() : value,
        );
        setHasCopied(true);
      }}
      {...props}
    >
      <span className="sr-only">{__('Copy', 'pressedmail')}</span>
      {hasCopied ? (
        <CheckIcon className="!size-3" />
      ) : (
        <CopyIcon className="!size-3" />
      )}
    </Button>
  );
}

export function CodeLineElement(props: PlateElementProps) {
  return <PlateElement {...props} />;
}

export function CodeSyntaxLeaf(props: PlateLeafProps<TCodeSyntaxLeaf>) {
  const tokenClassName = props.leaf.className as string;

  return <PlateLeaf className={tokenClassName} {...props} />;
}

/**
 * Language names stay as written; the two entries that are words get
 * translated, on call, since the locale catalog loads after import.
 */
function languageLabel(language: { label: string; value: string }): string {
  if (language.value === 'auto') return __('Auto', 'pressedmail');
  if (language.value === 'plaintext') return __('Plain text', 'pressedmail');
  return language.label;
}

const languages: { label: string; value: string }[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'Plain Text', value: 'plaintext' },
  { label: 'Bash', value: 'bash' },
  { label: 'C', value: 'c' },
  { label: 'C#', value: 'csharp' },
  { label: 'C++', value: 'cpp' },
  { label: 'CSS', value: 'css' },
  { label: 'Diff', value: 'diff' },
  { label: 'Go', value: 'go' },
  { label: 'GraphQL', value: 'graphql' },
  { label: 'HTML', value: 'html' },
  { label: 'Java', value: 'java' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'JSON', value: 'json' },
  { label: 'Kotlin', value: 'kotlin' },
  { label: 'Less', value: 'less' },
  { label: 'Lua', value: 'lua' },
  { label: 'Makefile', value: 'makefile' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Objective-C', value: 'objectivec' },
  { label: 'Perl', value: 'perl' },
  { label: 'PHP', value: 'php' },
  { label: 'PowerShell', value: 'powershell' },
  { label: 'Python', value: 'python' },
  { label: 'R', value: 'r' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'Rust', value: 'rust' },
  { label: 'SCSS', value: 'scss' },
  { label: 'Shell', value: 'shell' },
  { label: 'SQL', value: 'sql' },
  { label: 'Swift', value: 'swift' },
  { label: 'TOML', value: 'toml' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'VB.Net', value: 'vbnet' },
  { label: 'WebAssembly', value: 'wasm' },
  { label: 'XML', value: 'xml' },
  { label: 'YAML', value: 'yaml' },
];
