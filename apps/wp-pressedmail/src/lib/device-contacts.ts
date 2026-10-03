import {
  createRecipientFromEmail,
  isValidEmail,
  type Recipient,
} from "@/types/recipients";

/**
 * The browser Contact Picker API (Chrome on Android today). Everything stays on
 * the device: the picker hands back what the user chose, nothing is stored and
 * nothing leaves the browser.
 */
interface DeviceContact {
  name?: string[];
  email?: string[];
}

interface ContactPicker {
  select(
    properties: Array<"name" | "email">,
    options: { multiple: boolean },
  ): Promise<DeviceContact[]>;
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
  let picked: DeviceContact[];
  try {
    picked = await contacts.select(["name", "email"], { multiple: true });
  } catch {
    return [];
  }
  // ponytail: first valid email per contact; add a chooser if people ask.
  return (picked ?? []).flatMap((contact) => {
    const email = contact.email?.map((e) => e.trim()).find(isValidEmail);
    if (!email) return [];
    const recipient = createRecipientFromEmail(email);
    const name = contact.name?.[0]?.trim();
    return [name ? { ...recipient, displayName: name } : recipient];
  });
}
