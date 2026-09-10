// Safe localStorage wrapper with error handling
export function safeLocalStorage() {
  return {
    getItem: (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn("Failed to save to localStorage:", error);
      }
    },
    removeItem: (key: string): void => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn("Failed to remove from localStorage:", error);
      }
    },
  };
}
