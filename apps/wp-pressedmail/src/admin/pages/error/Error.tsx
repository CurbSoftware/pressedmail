import { __ } from "@wordpress/i18n";
import { useRouteError } from "react-router-dom";

import { Button } from "@kit/ui/plugin";

/**
 * A lazy screen whose file is gone. A tab left open across a plugin update
 * still runs the old entry, and the update removed the files it points at.
 * Each browser words the failure its own way.
 */
function isStaleChunkError(message: string): boolean {
  return /dynamically imported module|module script failed|unable to preload css/i.test(
    message,
  );
}

const Error = () => {
  const error = (useRouteError() ?? {}) as {
    statusText?: string;
    message?: string;
  };
  const detail = error.statusText || error.message || "";
  const stale = isStaleChunkError(detail);

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center lg:fixed w-full h-full">
      <h1>
        {stale
          ? __("PressedMail was updated", "pressedmail")
          : __("Oops!", "pressedmail")}
      </h1>
      <p>
        {stale
          ? __(
              "This tab is still running the previous version. Reload to load the new one.",
              "pressedmail",
            )
          : __("Sorry, an unexpected error has occurred.", "pressedmail")}
      </p>
      {detail && !stale ? (
        <p>
          <i>{detail}</i>
        </p>
      ) : null}
      {/* A reload is the way out of both, and an installed app window has no
          browser reload button to fall back on. */}
      <Button
        type="button"
        data-test="error-page-reload"
        onClick={() => window.location.reload()}>
        {__("Reload", "pressedmail")}
      </Button>
    </div>
  );
};

export default Error;
