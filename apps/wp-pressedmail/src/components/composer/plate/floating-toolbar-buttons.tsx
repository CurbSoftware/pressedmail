'use client';

/**
 * Buttons shown inside the selection bubble toolbar: Ask AI, Turn into, marks,
 * inline link, more. Comment/suggestion (collaboration) buttons are
 * intentionally omitted, the email composer has no collaboration surface.
 */

import * as React from 'react';
import { KEYS } from '@kit/plate';
import { useEditorReadOnly, useEditorRef } from '@kit/plate/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code2,
  WandSparkles,
} from 'lucide-react';

import { __ } from '@wordpress/i18n';

import { ToolbarGroup } from '@/components/composer/toolbar';
import { AIToolbarButton } from '@/components/composer/plate/ai-toolbar-button.active';
import { LinkToolbarButton } from './link-toolbar-button';
import { MarkToolbarButton } from './mark-toolbar-button';
import { MoreToolbarButton } from './more-toolbar-button';
import { TurnIntoToolbarButton } from './turn-into-toolbar-button';

export function FloatingToolbarButtons() {
  const editor = useEditorRef();
  const readOnly = useEditorReadOnly();
  // The AI kit is only registered when PlateComposer gets aiEnabled (feature
  // flag && configured); gate on plugin presence so AIToolbarButton never
  // touches a missing AIChatPlugin.
  const aiEnabled = Boolean(editor.plugins[KEYS.aiChat]);

  return (
    <>
      {!readOnly && (
        <>
          {aiEnabled && (
            <ToolbarGroup>
              <AIToolbarButton
                tooltip={__('AI commands', 'pressedmail')}
                className="gap-1.5 text-primary"
              >
                <WandSparkles className="size-4" />
                {__('Ask AI', 'pressedmail')}
              </AIToolbarButton>
            </ToolbarGroup>
          )}

          <ToolbarGroup>
            <TurnIntoToolbarButton />

            <MarkToolbarButton
              nodeType={KEYS.bold}
              tooltip={__('Bold', 'pressedmail')}
            >
              <Bold className="size-4" />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.italic}
              tooltip={__('Italic', 'pressedmail')}
            >
              <Italic className="size-4" />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.underline}
              tooltip={__('Underline', 'pressedmail')}
            >
              <UnderlineIcon className="size-4" />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.strikethrough}
              tooltip={__('Strikethrough', 'pressedmail')}
            >
              <Strikethrough className="size-4" />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.code}
              tooltip={__('Inline code', 'pressedmail')}
            >
              <Code2 className="size-4" />
            </MarkToolbarButton>

            <LinkToolbarButton />
          </ToolbarGroup>
        </>
      )}

      {!readOnly && (
        <ToolbarGroup>
          <MoreToolbarButton />
        </ToolbarGroup>
      )}
    </>
  );
}
