// Tiny external store shared between the global toggle button
// (DevSectionOverlay) and the per-marker labels (DevSectionLabel). Keeps the
// "show section/container labels" state in one place without a React context,
// so any marker rendered anywhere in the tree reacts to the single toggle.

let open = false;
const listeners = new Set<() => void>();

export function subscribeDevSections(callback: () => void) {
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
  };
}

export function getDevSectionsOpen() {
  return open;
}

export function getDevSectionsServerSnapshot() {
  return false;
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function toggleDevSections() {
  open = !open;
  emit();
}

export function setDevSections(value: boolean) {
  open = value;
  emit();
}
