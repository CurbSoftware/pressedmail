'use client';

import React, { useCallback, useState, useSyncExternalStore } from 'react';

import { Check, Copy } from 'lucide-react';

import {
  type DevSectionKind,
  formatDevSectionCopyText,
} from './dev-section-contract';
import {
  getDevSectionsOpen,
  getDevSectionsServerSnapshot,
  subscribeDevSections,
} from './dev-section-store';

interface DevSectionLabelProps {
  name: string;
  path: string;
  kind: DevSectionKind;
}

export function getDevSectionLabelStyle(
  kind: DevSectionKind,
): React.CSSProperties {
  const isContainer = kind === 'container';

  return {
    position: 'absolute',
    top: 4,
    ...(isContainer ? { right: 4 } : { left: 4 }),
    zIndex: 2147483646,
    display: 'inline-flex',
    maxWidth: 'min(520px, calc(100% - 0.5rem))',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    border: '1px solid',
    borderColor: isContainer
      ? 'rgba(252, 211, 77, 0.72)'
      : 'rgba(103, 232, 249, 0.72)',
    borderRadius: 6,
    backgroundColor: 'rgba(2, 6, 23, 0.96)',
    color: isContainer ? 'rgb(254, 243, 199)' : 'rgb(207, 250, 254)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.38)',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 11,
    lineHeight: 1.2,
    cursor: 'pointer',
  };
}

// Label pinned to the TOP of its marker (not sticky to the viewport): it
// scrolls away with the section/container. Click copies "Name - path".
export function DevSectionLabel({ name, path, kind }: DevSectionLabelProps) {
  const open = useSyncExternalStore(
    subscribeDevSections,
    getDevSectionsOpen,
    getDevSectionsServerSnapshot,
  );
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        formatDevSectionCopyText({ name, path }),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard unavailable (e.g. insecure context), ignore.
    }
  }, [name, path]);

  if (!open) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${kind} ${name} source path`}
      title={`Copy "${formatDevSectionCopyText({ name, path })}"`}
      style={getDevSectionLabelStyle(kind)}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          opacity: 0.72,
        }}
      >
        {kind}
      </span>
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}
      >
        {name}
      </span>
      {copied ? (
        <Check size={12} style={{ flexShrink: 0 }} aria-hidden="true" />
      ) : (
        <Copy
          size={12}
          style={{ flexShrink: 0, opacity: 0.72 }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
