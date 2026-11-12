import { Fragment, type ReactNode } from "react";

/**
 * A translated sentence with `value` in place of its `%s` (or `%1$s`). The
 * sentence takes its direction from its own words, so English shown in a
 * right-to-left admin still reads left to right, and a right-to-left
 * translation right to left. Its first strong letter decides, and the
 * auto-direction algorithm skips `<bdi>` and anything with its own `dir`, so
 * `value` never does.
 */
export function withValue(sentence: string, value: ReactNode): ReactNode {
  return (
    <span dir="auto">
      {sentence.split(/%(?:1\$)?s/).map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? value : null}
          {part}
        </Fragment>
      ))}
    </span>
  );
}

/** withValue() for a name, isolated, so a name in one direction keeps its place in a sentence in the other. */
export function named(sentence: string, name: string): ReactNode {
  return withValue(sentence, <bdi>{name}</bdi>);
}
