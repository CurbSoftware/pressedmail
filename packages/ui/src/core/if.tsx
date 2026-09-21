import type { ReactNode } from 'react';

/**
 * Anything JavaScript considers falsy, plus whatever the caller is testing.
 */
type Condition<Value> = Value | false | null | undefined | 0 | '';

type IfProps<Value> = {
  condition: Condition<Value>;
  /** Rendered when the condition is truthy. A function receives the value. */
  children: ReactNode | ((value: Value) => ReactNode);
  /** Rendered otherwise. Nothing renders when it is omitted. */
  fallback?: ReactNode | (() => ReactNode);
};

function call<Value>(
  branch: ReactNode | ((value: Value) => ReactNode),
  value: Value,
): ReactNode {
  return typeof branch === 'function' ? branch(value) : branch;
}

/**
 * Conditional rendering with a narrowed value in the truthy branch.
 *
 * `{cond && <X/>}` renders a literal `0` for a numeric condition, and gives the
 * children no typed access to what was tested. This does neither.
 */
export function If<Value = unknown>({
  condition,
  children,
  fallback = null,
}: IfProps<Value>) {
  if (condition) {
    return <>{call(children, condition as Value)}</>;
  }

  return <>{typeof fallback === 'function' ? fallback() : fallback}</>;
}
