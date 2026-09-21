/**
 * Free build "Add to calendar" affordances.
 *
 * The calendar feature ships in the Pro edition only, and the reading pane
 * passes no calendar callback without it, so both buttons are already
 * unreachable here. Returning null says that in the artifact instead of
 * leaving Pro copy behind a false condition.
 */
export interface AddToCalendarIconButtonProps {
  onClick: () => void;
  filename: string;
}

export function AddToCalendarIconButton(
  _props: AddToCalendarIconButtonProps,
): null {
  return null;
}

export interface AddToCalendarBannerButtonProps {
  onClick: () => void;
}

export function AddToCalendarBannerButton(
  _props: AddToCalendarBannerButtonProps,
): null {
  return null;
}
