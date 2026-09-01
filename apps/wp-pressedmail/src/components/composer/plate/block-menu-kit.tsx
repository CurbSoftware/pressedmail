'use client';

import { BlockSelectionPlugin } from '@kit/plate/selection/react';
import { getPluginTypes, KEYS } from '@kit/plate';

import { BlockSelection } from './block-selection';

/**
 * Block selection (multi-block highlight + selection API). The right-click
 * menu is the NATIVE browser context menu, no custom block context menu is
 * registered. All block actions stay reachable via the toolbar and the
 * selection bubble menu.
 *
 * BlockSelectionPlugin still pulls in BlockMenuPlugin (key 'blockMenu'), whose
 * default `onMouseDown` calls `preventDefault()` on a right-click. That does
 * NOT suppress the browser's native context menu, preventing `mousedown` does
 * not cancel the separate `contextmenu` event (verified in a real browser:
 * after such a mousedown, contextmenu still fires with defaultPrevented=false).
 * The custom menu only ever appeared because of the now-deleted BlockContextMenu
 * render + the block-draggable `onContextMenu` handler, both removed. So do not
 * "re-fix" this by overriding the BlockMenuPlugin handler.
 */
export const BlockMenuKit = [
  BlockSelectionPlugin.configure(({ editor }) => ({
    options: {
      enableContextMenu: false,
      isSelectable: (element: { type: string }) =>
        !getPluginTypes(editor, [KEYS.td, KEYS.tr, KEYS.table]).includes(
          element.type,
        ),
    },
    render: {

      belowRootNodes: (props: any) => <BlockSelection {...props} />,
    },
  })),
];
