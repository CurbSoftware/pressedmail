import { createSlatePlugin } from '@kit/plate';

const PM_QUOTE = 'quote';

export const QuoteBlockPlugin = createSlatePlugin({
  key: PM_QUOTE,
  node: { isElement: true },
}).extend(() => ({
  parsers: {
    html: {
      deserializer: {
        rules: [
          {
            validAttribute: { 'data-pm-block': [PM_QUOTE] },
          },
        ],
        parse({ element }: { element: HTMLElement }) {
          return {
            type: PM_QUOTE,
            collapsed: element.getAttribute('data-collapsed') === 'true',
            sourceFrom: element.getAttribute('data-source-from') ?? null,
            sourceDate: element.getAttribute('data-source-date') ?? null,
            sourceMessageId:
              element.getAttribute('data-source-message-id') ?? null,
          };
        },
      },
      serializer: {
        parse({ node }: { node: Record<string, unknown> }) {
          const parts = [
            `data-pm-block="${PM_QUOTE}"`,
            `data-collapsed="${node.collapsed ? 'true' : 'false'}"`,
          ];
          if (node.sourceFrom)
            parts.push(
              `data-source-from="${String(node.sourceFrom).replace(/"/g, '&quot;')}"`,
            );
          if (node.sourceDate)
            parts.push(
              `data-source-date="${String(node.sourceDate).replace(/"/g, '&quot;')}"`,
            );
          if (node.sourceMessageId)
            parts.push(
              `data-source-message-id="${String(node.sourceMessageId).replace(/"/g, '&quot;')}"`,
            );
          return `<blockquote ${parts.join(' ')}>`;
        },
      },
    },
  },
}));
