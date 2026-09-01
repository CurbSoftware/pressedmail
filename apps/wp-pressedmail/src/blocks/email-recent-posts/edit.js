import { __ } from "@wordpress/i18n";
import { useBlockProps, InspectorControls } from "@wordpress/block-editor";
import {
  PanelBody,
  RangeControl,
  SelectControl,
  ToggleControl,
} from "@wordpress/components";
import { useSelect } from "@wordpress/data";

export default function Edit({ attributes, setAttributes }) {
  const {
    postCount,
    postType,
    category,
    displayStyle,
    showExcerpt,
    showThumbnail,
    excerptLength,
  } = attributes;

  const blockProps = useBlockProps();

  // Fetch a preview of posts for the editor.
  const posts = useSelect(
    (select) => {
      const query = {
        per_page: postCount,
        status: "publish",
        _embed: true,
      };
      if (category) {
        query.categories = category;
      }
      return select("core").getEntityRecords("postType", postType, query) || [];
    },
    [postCount, postType, category],
  );

  // Fetch categories for the filter dropdown.
  const categories = useSelect(
    (select) =>
      select("core").getEntityRecords("taxonomy", "category", {
        per_page: 50,
      }) || [],
    [],
  );

  const categoryOptions = [
    { label: __("All Categories", "pressedmail"), value: "" },
    ...categories.map((cat) => ({
      label: cat.name,
      value: String(cat.id),
    })),
  ];

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Posts Settings", "pressedmail")}>
          <RangeControl
            label={__("Number of Posts", "pressedmail")}
            value={postCount}
            onChange={(val) => setAttributes({ postCount: val })}
            min={1}
            max={10}
          />
          <SelectControl
            label={__("Display Style", "pressedmail")}
            value={displayStyle}
            options={[
              { label: __("Cards", "pressedmail"), value: "cards" },
              { label: __("List", "pressedmail"), value: "list" },
              { label: __("Minimal", "pressedmail"), value: "minimal" },
            ]}
            onChange={(val) => setAttributes({ displayStyle: val })}
          />
          <SelectControl
            label={__("Category", "pressedmail")}
            value={category}
            options={categoryOptions}
            onChange={(val) => setAttributes({ category: val })}
          />
          <ToggleControl
            label={__("Show Excerpt", "pressedmail")}
            checked={showExcerpt}
            onChange={(val) => setAttributes({ showExcerpt: val })}
          />
          <ToggleControl
            label={__("Show Thumbnail", "pressedmail")}
            checked={showThumbnail}
            onChange={(val) => setAttributes({ showThumbnail: val })}
          />
          {showExcerpt && (
            <RangeControl
              label={__("Excerpt Length (words)", "pressedmail")}
              value={excerptLength}
              onChange={(val) => setAttributes({ excerptLength: val })}
              min={10}
              max={100}
            />
          )}
        </PanelBody>
      </InspectorControls>

      <div {...blockProps}>
        <div
          style={{
            border: "1px dashed #ccc",
            borderRadius: "4px",
            padding: "16px",
            backgroundColor: "#f9f9f9",
          }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
              fontSize: "13px",
              color: "#666",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
            <span
              className="dashicons dashicons-admin-post"
              style={{ fontSize: "16px" }}
            />
            {__("Recent Posts", "pressedmail")} ({displayStyle}, {postCount}{" "}
            {postCount === 1
              ? __("post", "pressedmail")
              : __("posts", "pressedmail")}
            )
          </div>

          {posts.length === 0 ? (
            <p style={{ color: "#999", fontStyle: "italic", margin: 0 }}>
              {__("Loading preview...", "pressedmail")}
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {posts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fff",
                    borderRadius: "4px",
                    border: "1px solid #e0e0e0",
                  }}>
                  <strong style={{ fontSize: "14px" }}>
                    {post.title?.rendered || __("Untitled", "pressedmail")}
                  </strong>
                  {showExcerpt && post.excerpt?.rendered && (
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "12px",
                        color: "#666",
                      }}>
                      {post.excerpt.rendered
                        .replace(/<[^>]+>/g, "")
                        .slice(0, 100) + "..."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <p
            style={{
              marginTop: "8px",
              fontSize: "11px",
              color: "#999",
              fontStyle: "italic",
            }}>
            {__(
              "Dynamic content. Posts will be fetched when the email is sent.",
              "pressedmail",
            )}
          </p>
        </div>
      </div>
    </>
  );
}
