import { createSlatePlugin } from '@kit/plate';

const PM_ATTACHMENT = 'attachment';

export const AttachmentCardPlugin = createSlatePlugin({
  key: PM_ATTACHMENT,
  node: { isElement: true, isInline: true, isVoid: true },
}).extend(() => ({
  parsers: {
    html: {
      deserializer: {
        rules: [
          {
            validAttribute: { 'data-pm-block': [PM_ATTACHMENT] },
          },
        ],
        parse({ element }: { element: HTMLElement }) {
          return {
            type: PM_ATTACHMENT,
            filename: element.getAttribute('data-filename') ?? '',
            size: element.getAttribute('data-size') ?? '',
            id: element.getAttribute('data-attachment-id') ?? '',
            children: [{ text: '' }],
          };
        },
      },
      serializer: {
        parse({ node }: { node: Record<string, unknown> }) {
          const parts = [`data-pm-block="${PM_ATTACHMENT}"`];
          if (node.filename)
            parts.push(
              `data-filename="${String(node.filename).replace(/"/g, '&quot;')}"`,
            );
          if (node.size) parts.push(`data-size="${node.size}"`);
          if (node.id) parts.push(`data-attachment-id="${node.id}"`);
          return `<span ${parts.join(' ')}>${node.filename || 'attachment'}</span>`;
        },
      },
    },
  },
}));
