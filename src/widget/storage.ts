/** localStorage wrapper for widget state persistence. */

const PREFIX = 'sm_widget_';

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // localStorage unavailable (private browsing, quota, etc.)
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // noop
  }
}
