import {
  createRecipientFromEmail,
  isValidEmail,
  type Recipient,
} from "@/types/recipients";

/**
 * The browser Contact Picker API (Chrome on Android today). The picker hands
 * back only what the user chose. The composer keeps it in the browser; the
 * contact book import sends it to this site as a vCard file.
 */
type PickerProperty = "name" | "email" | "tel";

interface DeviceContact {
  name?: string[];
  email?: string[];
  tel?: string[];
}

interface ContactPicker {
  select(
    properties: PickerProperty[],
    options: { multiple: boolean },
  ): Promise<DeviceContact[]>;
  getProperties?(): Promise<string[]>;
}

/** One picked person, as the contact book import keeps it. */
export interface DeviceCard {
  name: string;
  email: string;
  tel: string;
}

function picker(): ContactPicker | null {
  try {
    const contacts = (navigator as Navigator & { contacts?: ContactPicker })
      .contacts;
    return typeof contacts?.select === "function" ? contacts : null;
  } catch {
    return null;
  }
}

async function select(
  contacts: ContactPicker,
  wanted: PickerProperty[],
): Promise<DeviceContact[]> {
  let properties = wanted;
  if (wanted.includes("tel") && typeof contacts.getProperties === "function") {
    try {
      const supported = await contacts.getProperties();
      properties = wanted.filter((p) => p !== "tel" || supported.includes(p));
    } catch {
      properties = wanted.filter((p) => p !== "tel");
    }
  }
  try {
    return (await contacts.select(properties, { multiple: true })) ?? [];
  } catch {
    return [];
  }
}

export function isDeviceContactPickerAvailable(): boolean {
  return picker() !== null;
}

/**
 * Opens the phone's contact sheet and returns one recipient per picked contact
 * that has an email. Cancel, denial or an unsupported browser returns [].
 */
export async function pickDeviceContacts(): Promise<Recipient[]> {
  const contacts = picker();
  if (!contacts) return [];
  const picked = await select(contacts, ["name", "email"]);
  // ponytail: first valid email per contact; add a chooser if people ask.
  return picked.flatMap((contact) => {
    const email = contact.email?.map((e) => e.trim()).find(isValidEmail);
    if (!email) return [];
    const recipient = createRecipientFromEmail(email);
    const name = contact.name?.[0]?.trim();
    return [name ? { ...recipient, displayName: name } : recipient];
  });
}

/**
 * Opens the phone's contact sheet for the contact book: name, email and phone
 * number per person. People without a valid email are kept, so the preview
 * can say how many will be skipped. Cancel or no picker returns [].
 */
export async function pickDeviceCards(): Promise<DeviceCard[]> {
  const contacts = picker();
  if (!contacts) return [];
  const picked = await select(contacts, ["name", "email", "tel"]);
  return picked.map((contact) => ({
    name: contact.name?.map((n) => n.trim()).find(Boolean) ?? "",
    email: contact.email?.map((e) => e.trim()).find(isValidEmail) ?? "",
    tel: contact.tel?.map((t) => t.trim()).find(Boolean) ?? "",
  }));
}

function vcardText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");
}

/** vCard 3.0 for the cards that have an email; the import keys on it. */
export function cardsToVcard(cards: DeviceCard[]): string {
  return cards
    .filter((card) => card.email !== "")
    .map((card) => {
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${vcardText(card.name || card.email)}`,
        `EMAIL;TYPE=INTERNET:${vcardText(card.email)}`,
      ];
      if (card.tel) lines.push(`TEL:${vcardText(card.tel)}`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
    })
    .join("\r\n")
    .concat("\r\n");
}
