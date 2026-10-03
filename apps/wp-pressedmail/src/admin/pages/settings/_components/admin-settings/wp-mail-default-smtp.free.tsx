import type { WpMailState } from "@/lib/wp-mail-api";

export interface WpMailDefaultSmtpProps {
  state: WpMailState;
  onStateChange: (state: WpMailState) => void;
  disabled?: boolean;
}

/** Free keeps one SMTP server, so there is no default to choose. */
export function WpMailDefaultSmtp(props: WpMailDefaultSmtpProps) {
  void props;
  return null;
}
