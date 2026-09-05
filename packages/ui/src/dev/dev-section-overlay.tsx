'use client';

import React, { useSyncExternalStore } from 'react';

import { Tags } from 'lucide-react';

import {
  getDevSectionsOpen,
  getDevSectionsServerSnapshot,
  subscribeDevSections,
  toggleDevSections,
} from './dev-section-store';

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  bottom: 12,
  left: 12,
  zIndex: 2147483647,
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export function getDevSectionToggleStyle(open: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    height: 40,
    alignItems: 'center',
    gap: 8,
    padding: '0 12px',
    border: '1px solid',
    borderColor: open
      ? 'rgba(103, 232, 249, 0.82)'
      : 'rgba(148, 163, 184, 0.38)',
    borderRadius: 9999,
    backgroundColor: open ? 'rgba(8, 47, 73, 0.97)' : 'rgba(2, 6, 23, 0.95)',
    color: open ? 'rgb(207, 250, 254)' : 'rgb(241, 245, 249)',
    boxShadow: open
      ? '0 10px 30px rgba(8, 145, 178, 0.28)'
      : '0 10px 30px rgba(0, 0, 0, 0.38)',
    backdropFilter: 'blur(12px)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition:
      'background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease',
  };
}

// Global toggle button (pinned bottom-left). It only flips shared state; the
// actual labels are rendered by each DevSectionMarker at the top of its
// section/container, so they scroll with the page instead of floating.
export function DevSectionOverlay() {
  const open = useSyncExternalStore(
    subscribeDevSections,
    getDevSectionsOpen,
    getDevSectionsServerSnapshot,
  );

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div data-dev-overlay style={OVERLAY_STYLE}>
      <button
        type="button"
        onClick={() => toggleDevSections()}
        style={getDevSectionToggleStyle(open)}
        aria-pressed={open}
        aria-label={
          open
            ? 'Hide development section labels'
            : 'Show development section labels'
        }
      >
        <Tags size={16} aria-hidden="true" />
        Sections
      </button>
    </div>
  );
}
