import type { FC } from "react";
import type { ISvgIcon } from "./type";

const CommonInboxIcon: FC<ISvgIcon> = ({ className, color }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    className={className}
    style={color ? { color } : undefined}>
    <path
      fill="currentColor"
      d="M19 8V5H5v3h4a3 3 0 0 0 3 3a3 3 0 0 0 3-3zm0-5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 15h6a3 3 0 0 0 3 3a3 3 0 0 0 3-3h6v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
    />
  </svg>
);

export default CommonInboxIcon;
