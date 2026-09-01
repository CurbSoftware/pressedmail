/**
 * Free-edition AI toolbar button: renders nothing.
 *
 * The composer toolbar is shared and referenced this button unconditionally, so
 * the Pro AI entry point stayed in the Free bundle behind a runtime check.
 *
 * The prop type mirrors the real component so call sites typecheck identically
 * in both editions. `import type` is erased at build time, so no Pro code
 * follows it into the bundle.
 */
import type * as React from 'react';

import type { ToolbarButton } from '@/components/composer/toolbar';

export function AIToolbarButton(
  _props: React.ComponentProps<typeof ToolbarButton>,
) {
  return null;
}
