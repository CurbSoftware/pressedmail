import React, { type ReactNode } from 'react';

import type { DevSectionMetadata } from './dev-section-contract';
import { DevSectionLabel } from './dev-section-label';

interface DevSectionMarkerProps extends DevSectionMetadata {
  children: ReactNode;
  enabled?: boolean;
}

export function DevSectionMarker({
  name,
  path,
  kind = 'section',
  children,
  enabled = process.env.NODE_ENV === 'development',
}: DevSectionMarkerProps) {
  if (!enabled) {
    return children;
  }

  return (
    <div
      data-dev-section-name={name}
      data-dev-section-path={path}
      data-dev-section-kind={kind}
      style={{ position: 'relative' }}
    >
      <DevSectionLabel name={name} path={path} kind={kind} />
      {children}
    </div>
  );
}
