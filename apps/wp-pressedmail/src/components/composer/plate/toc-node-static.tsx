import { BaseTocPlugin, type Heading, isHeading } from '@kit/plate/toc';
import { NodeApi, type SlateEditor, type TElement } from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

const headingDepth: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

const depthIndent: Record<number, string> = {
  1: '0',
  2: '24px',
  3: '48px',
  4: '72px',
  5: '96px',
  6: '120px',
};

function getHeadingList(editor?: SlateEditor): Heading[] {
  if (!editor) return [];

  const options = editor.getOptions(BaseTocPlugin);
  if (options.queryHeading) return options.queryHeading(editor);

  const headingList: Heading[] = [];
  const values = editor.api.nodes<TElement>({
    at: [],
    match: (n) => isHeading(n),
  });
  if (!values) return [];

  Array.from(values).forEach(([node, path]) => {
    const title = NodeApi.string(node);
    const depth = headingDepth[node.type] ?? 1;
    const id = node.id as string;
    if (title) headingList.push({ id, depth, path, title, type: node.type });
  });

  return headingList;
}

/**
 * Email-safe static table of contents. Renders the document's heading titles as
 * an indented plain-text list with fully inline styles. Anchor navigation isn't
 * reliable across email clients (and headings carry no ids here), so we emit
 * readable indented titles rather than dead links.
 */
export function TocElementStatic(props: SlateElementProps) {
  const headingList = getHeadingList(props.editor);

  return (
    <SlateElement {...props}>
      <div style={{ marginBottom: '12px', padding: '8px 0' }}>
        {headingList.map((item) => (
          <p
            key={item.id || item.title}
            style={{
              margin: '4px 0',
              paddingLeft: depthIndent[item.depth] || '0',
              color: '#555',
            }}
          >
            {item.title}
          </p>
        ))}
      </div>
      {props.children}
    </SlateElement>
  );
}
