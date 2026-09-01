/**
 * PressedMail Email Editor Sidebar Plugin.
 *
 * Adds sidebar panels to the email template block editor:
 *   1. Email Settings (subject, preheader)
 *   2. Dynamic Data Sources configuration
 *   3. Contact List selector
 *   4. Template Variables reference with copy-able codes
 *
 * Only active when editing pm_email_tpl post types.
 * Variable data comes from window.pressedmailEmailEditor (localized by PHP).
 */
import { __ } from "@wordpress/i18n";
import { registerPlugin } from "@wordpress/plugins";
import { PluginDocumentSettingPanel } from "@wordpress/editor";
import { useSelect, useDispatch } from "@wordpress/data";
import {
  Button,
  TextControl,
  TextareaControl,
  CheckboxControl,
  SelectControl,
} from "@wordpress/components";
import { useState, useEffect, useCallback } from "@wordpress/element";

function parseDynamicSources(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const CATEGORY_LABELS = {
  sender: __("Sender", "pressedmail"),
  recipient: __("Recipient", "pressedmail"),
  contact: __("Contact", "pressedmail"),
  general: __("General", "pressedmail"),
};

const DYNAMIC_SOURCE_OPTIONS = [
  {
    id: "contact_list",
    label: __("Contact List (merge fields)", "pressedmail"),
    description: __(
      "Send to contacts in a list with personalized fields like {{first_name}}",
      "pressedmail",
    ),
  },
  {
    id: "wp_recent_posts",
    label: __("WordPress Recent Posts", "pressedmail"),
    description: __(
      "Include recent blog posts as cards in the email",
      "pressedmail",
    ),
  },
  {
    id: "wp_site_info",
    label: __("WordPress Site Info", "pressedmail"),
    description: __(
      "Include site name, URL, description, or current date",
      "pressedmail",
    ),
  },
];

function CopyableVariable({ name }) {
  const [copied, setCopied] = useState(false);
  const code = `{{${name}}}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 0",
      }}>
      <code
        style={{
          backgroundColor: "#f0f0f0",
          padding: "2px 6px",
          borderRadius: "3px",
          fontSize: "12px",
        }}>
        {code}
      </code>
      <Button
        icon="admin-page"
        label={__("Copy", "pressedmail")}
        onClick={handleCopy}
        size="small"
        style={{
          color: copied ? "#00a32a" : undefined,
        }}
      />
    </div>
  );
}

/**
 * Email Settings Panel: subject line and preheader text.
 */
function EmailSettingsPanel() {
  const { editPost } = useDispatch("core/editor");

  const { emailSubject, emailPreheader } = useSelect((select) => {
    const meta = select("core/editor").getEditedPostAttribute("meta") || {};
    return {
      emailSubject: meta._pm_email_subject || "",
      emailPreheader: meta._pm_email_preheader || "",
    };
  }, []);

  const updateMeta = useCallback(
    (key, value) => {
      editPost({ meta: { [key]: value } });
    },
    [editPost],
  );

  return (
    <PluginDocumentSettingPanel
      name="pressedmail-email-settings"
      title={__("Email Settings", "pressedmail")}>
      <TextControl
        label={__("Email Subject", "pressedmail")}
        help={__(
          "Default subject line when composing from this template. Supports variables like {{first_name}}.",
          "pressedmail",
        )}
        value={emailSubject}
        onChange={(value) => updateMeta("_pm_email_subject", value)}
        placeholder={__(
          "e.g. Hello {{first_name}}, check this out!",
          "pressedmail",
        )}
      />
      <TextareaControl
        label={__("Preheader Text", "pressedmail")}
        help={__(
          "Preview text shown in email clients before opening the email.",
          "pressedmail",
        )}
        value={emailPreheader}
        onChange={(value) => updateMeta("_pm_email_preheader", value)}
        rows={2}
        placeholder={__("Brief preview text...", "pressedmail")}
      />
    </PluginDocumentSettingPanel>
  );
}

/**
 * Dynamic Data Sources Panel: configure which dynamic data the template uses.
 */
function DynamicDataSourcesPanel() {
  const { editPost } = useDispatch("core/editor");

  const { dynamicSources } = useSelect((select) => {
    const meta = select("core/editor").getEditedPostAttribute("meta") || {};
    const sources = parseDynamicSources(meta._pm_dynamic_sources);
    return { dynamicSources: sources };
  }, []);

  const toggleSource = useCallback(
    (sourceId) => {
      const updated = dynamicSources.includes(sourceId)
        ? dynamicSources.filter((s) => s !== sourceId)
        : [...dynamicSources, sourceId];
      editPost({ meta: { _pm_dynamic_sources: JSON.stringify(updated) } });
    },
    [dynamicSources, editPost],
  );

  return (
    <PluginDocumentSettingPanel
      name="pressedmail-dynamic-sources"
      title={__("Dynamic Data Sources", "pressedmail")}>
      <p style={{ color: "#757575", fontSize: "13px", marginBottom: "12px" }}>
        {__(
          "Select the types of dynamic data this template uses. Dynamic content is resolved when creating an email from this template.",
          "pressedmail",
        )}
      </p>
      {DYNAMIC_SOURCE_OPTIONS.map((source) => (
        <div key={source.id} style={{ marginBottom: "8px" }}>
          <CheckboxControl
            label={source.label}
            help={source.description}
            checked={dynamicSources.includes(source.id)}
            onChange={() => toggleSource(source.id)}
          />
        </div>
      ))}
    </PluginDocumentSettingPanel>
  );
}

/**
 * Contact List Panel: select a default contact list for mail merge.
 */
function ContactListPanel() {
  const { editPost } = useDispatch("core/editor");
  const [contactLists, setContactLists] = useState([]);
  const [loading, setLoading] = useState(true);

  const { contactListId, dynamicSources } = useSelect((select) => {
    const meta = select("core/editor").getEditedPostAttribute("meta") || {};
    const sources = parseDynamicSources(meta._pm_dynamic_sources);
    return {
      contactListId: meta._pm_contact_list_id || 0,
      dynamicSources: sources,
    };
  }, []);

  // Only show if contact_list dynamic source is enabled.
  const isContactListEnabled = dynamicSources.includes("contact_list");

  useEffect(() => {
    if (!isContactListEnabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    // Fetch contact lists from PressedMail REST API.
    const fetchLists = async () => {
      try {
        const namespace =
          window.pressedmailPlugin?.restNamespace ?? "pressedmail/v1";
        const response = await window.wp.apiFetch({
          path: `/${namespace}/contacts/lists`,
          signal: controller.signal,
        });
        const lists = response?.data || response || [];
        setContactLists(Array.isArray(lists) ? lists : []);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setContactLists([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLists();

    return () => controller.abort();
  }, [isContactListEnabled]);

  if (!isContactListEnabled) {
    return null;
  }

  const options = [
    { label: __("Select a contact list", "pressedmail"), value: "0" },
    ...contactLists.map((list) => ({
      label: list.name,
      value: String(list.id),
    })),
  ];

  return (
    <PluginDocumentSettingPanel
      name="pressedmail-contact-list"
      title={__("Default Contact List", "pressedmail")}>
      {loading ? (
        <p style={{ color: "#757575", fontStyle: "italic" }}>
          {__("Loading contact lists...", "pressedmail")}
        </p>
      ) : (
        <SelectControl
          label={__("Send to Contact List", "pressedmail")}
          help={__(
            "When composing from this template, this contact list will be pre-selected for mail merge.",
            "pressedmail",
          )}
          value={String(contactListId)}
          options={options}
          onChange={(value) =>
            editPost({ meta: { _pm_contact_list_id: parseInt(value, 10) } })
          }
        />
      )}
    </PluginDocumentSettingPanel>
  );
}

/**
 * Template Variables Panel: reference of available merge codes.
 */
function TemplateVariablesPanel() {
  const editorData = window.pressedmailEmailEditor || {};
  const variables = editorData.variables || [];

  // Group variables by category.
  const grouped = {};
  for (const v of variables) {
    const cat = v.category || "general";
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(v);
  }

  return (
    <PluginDocumentSettingPanel
      name="pressedmail-template-variables"
      title={__("Template Variables", "pressedmail")}>
      {Object.entries(grouped).map(([category, vars]) => (
        <div key={category} style={{ marginBottom: "12px" }}>
          <h4
            style={{
              margin: "0 0 4px",
              fontSize: "11px",
              textTransform: "uppercase",
              color: "#757575",
              letterSpacing: "0.5px",
            }}>
            {CATEGORY_LABELS[category] || category}
          </h4>
          {vars.map((v) => (
            <CopyableVariable key={v.name} name={v.name} />
          ))}
        </div>
      ))}
      {variables.length === 0 && (
        <p style={{ color: "#757575", fontStyle: "italic" }}>
          {__("No variables available.", "pressedmail")}
        </p>
      )}
    </PluginDocumentSettingPanel>
  );
}

function PressedMailEmailSidebar() {
  const editorData = window.pressedmailEmailEditor || {};
  const targetPostType = editorData.postType || "pm_email_tpl";

  const currentPostType = useSelect(
    (select) => select("core/editor").getCurrentPostType(),
    [],
  );

  // Only render for email template post type.
  if (currentPostType !== targetPostType) {
    return null;
  }

  return (
    <>
      <EmailSettingsPanel />
      <DynamicDataSourcesPanel />
      <ContactListPanel />
      <TemplateVariablesPanel />
    </>
  );
}

registerPlugin("pressedmail-email-editor-sidebar", {
  render: PressedMailEmailSidebar,
  icon: "email-alt",
});
