import { createSlatePlugin } from '@kit/plate';

const PM_AI_SUGGESTION = 'ai-suggestion';

export const AISuggestionPlugin = createSlatePlugin({
  key: PM_AI_SUGGESTION,
  node: { isElement: true, isInline: true },
}).extend(() => ({
  parsers: {
    html: {
      deserializer: {
        rules: [
          {
            validAttribute: { 'data-pm-block': [PM_AI_SUGGESTION] },
          },
        ],
        parse({ element }: { element: HTMLElement }) {
          const accepted = element.getAttribute('data-accepted');
          return {
            type: PM_AI_SUGGESTION,
            accepted:
              accepted === 'true'
                ? true
                : accepted === 'false'
                  ? false
                  : null,
            suggestionId:
              element.getAttribute('data-suggestion-id') ?? undefined,
          };
        },
      },
      serializer: {
        parse({ node }: { node: Record<string, unknown> }) {
          const parts = [`data-pm-block="${PM_AI_SUGGESTION}"`];
          if (node.accepted != null)
            parts.push(`data-accepted="${node.accepted}"`);
          if (node.suggestionId)
            parts.push(
              `data-suggestion-id="${String(node.suggestionId).replace(/"/g, '&quot;')}"`,
            );
          return `<span ${parts.join(' ')}>`;
        },
      },
    },
  },
}));
