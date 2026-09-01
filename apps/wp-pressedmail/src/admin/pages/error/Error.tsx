import { __ } from "@wordpress/i18n";
import { useRouteError } from "react-router-dom";

const Error = () => {
  const error: any = useRouteError();
  return (
    <div className="flex flex-col items-center justify-center lg:fixed w-full h-full">
      <h1>{__("Oops!", "pressedmail")}</h1>
      <p>{__("Sorry, an unexpected error has occurred.", "pressedmail")}</p>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  );
};

export default Error;
