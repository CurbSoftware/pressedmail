import { createSlatePlugin } from '@kit/plate';

const PM_SIGNATURE = 'signature';

export const SignatureBlockPlugin = createSlatePlugin({
  key: PM_SIGNATURE,
  node: { isElement: true },
}).extend(() => ({
  parsers: {
    html: {
      deserializer: {
        rules: [
          {
            validAttribute: { 'data-pm-block': [PM_SIGNATURE] },
          },
        ],
        parse({ element }: { element: HTMLElement }) {
          return {
            type: PM_SIGNATURE,
            accountId: element.getAttribute('data-account-id')
              ? Number(element.getAttribute('data-account-id'))
              : null,
            signatureId: element.getAttribute('data-signature-id')
              ? Number(element.getAttribute('data-signature-id'))
              : null,
          };
        },
      },
      serializer: {
        parse({ node }: { node: Record<string, unknown> }) {
          const parts = [`data-pm-block="${PM_SIGNATURE}"`];
          if (node.accountId != null)
            parts.push(`data-account-id="${node.accountId}"`);
          if (node.signatureId != null)
            parts.push(`data-signature-id="${node.signatureId}"`);
          return `<div ${parts.join(' ')}>`;
        },
      },
    },
  },
}));
