import ReactMarkdown, { type Components } from "react-markdown";

import { cn } from "@/lib/utils";

interface EmailSummaryMarkdownProps {
  markdown: string;
  className?: string;
}

const summaryMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="mb-2 text-base font-semibold leading-6 text-foreground">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 text-sm font-semibold leading-5 text-foreground">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1.5 text-sm font-semibold leading-5 text-foreground">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
      {children}
    </h5>
  ),
  p: ({ children }) => (
    <p className="my-2 whitespace-pre-wrap leading-6 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 leading-6 first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 leading-6 first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.92em] text-foreground">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-auto rounded-md bg-muted p-2 text-xs leading-5">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline underline-offset-2">
      {children}
    </a>
  ),
};

export function EmailSummaryMarkdown({
  markdown,
  className,
}: EmailSummaryMarkdownProps) {
  return (
    <div
      className={cn(
        "text-sm leading-6 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}>
      <ReactMarkdown components={summaryMarkdownComponents} skipHtml>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export default EmailSummaryMarkdown;
