import { __ } from "@wordpress/i18n";
import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTitleRow,
  AlertDescription,
  AlertTitle,
  Label,
  Switch,
} from "@kit/ui/plugin";
import {
  SettingsRow,
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";

interface DangerZoneCardProps {
  purgeEnabled: boolean;
  onPurgeChange: (enabled: boolean) => void;
}

export function DangerZoneCard({
  purgeEnabled,
  onPurgeChange,
}: DangerZoneCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handlePurgeToggle = (enabled: boolean) => {
    if (!enabled) {
      onPurgeChange(false);
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmEnable = () => {
    onPurgeChange(true);
    setConfirmOpen(false);
  };

  return (
    <SettingsSectionCard
      className="border-destructive/50"
      title={
        <span className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {__("Danger Zone", "pressedmail")}
        </span>
      }
      description={__(
        "These settings can permanently remove PressedMail data.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.dangerZone}
      docHref={settingsInfoDocHrefs.dangerZone}
      contentClassName="space-y-4">
      <SettingsRow
        className="rounded-md border border-destructive/30 bg-destructive/5 px-3"
        title={
          <span className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4 text-destructive" />
            {__("Delete plugin data on uninstall", "pressedmail")}
          </span>
        }
        description={__(
          "When enabled, uninstalling PressedMail permanently deletes accounts, messages, contacts, calendars, and settings.",
          "pressedmail",
        )}
        control={
          <>
            <Label htmlFor="purge-data" className="sr-only">
              {__("Toggle plugin data deletion on uninstall", "pressedmail")}
            </Label>
            <Switch
              id="purge-data"
              data-test="purge-data-toggle"
              checked={purgeEnabled}
              onCheckedChange={handlePurgeToggle}
            />
          </>
        }
      />

      {purgeEnabled && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {__("Warning: Data deletion enabled", "pressedmail")}
          </AlertTitle>
          <AlertDescription>
            {__(
              "All PressedMail data will be permanently deleted when the plugin is uninstalled. This includes all email accounts, cached messages, contacts, calendar events, and settings. This action cannot be undone.",
              "pressedmail",
            )}
          </AlertDescription>
        </Alert>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          className="sm:max-w-md"
          data-test="danger-zone-confirm"
          data-testid="danger-zone-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertDialogTitleRow variant="destructive">
                <Trash2 />
                <span>
                  {__("Delete plugin data on uninstall?", "pressedmail")}
                </span>
              </AlertDialogTitleRow>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {__(
                "This can permanently delete PressedMail accounts, messages, contacts, calendars, and settings when the plugin is removed.",
                "pressedmail",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setConfirmOpen(false)}
              data-test="danger-zone-confirm-cancel"
              data-testid="danger-zone-confirm-cancel">
              {__("Cancel", "pressedmail")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-test="danger-zone-confirm-accept"
              data-testid="danger-zone-confirm-accept"
              onClick={handleConfirmEnable}>
              {__("Are you sure?", "pressedmail")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSectionCard>
  );
}
