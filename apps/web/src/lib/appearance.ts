/**
 * Light and dark mode for the signed-in site — the choice under More → Switch
 * appearance.
 *
 * Automatic (the default) follows the device. Picking Light or Dark sticks to
 * this browser only (localStorage): it's a per-device preference, the way the
 * device setting it overrides is, so no account round-trip and nothing to wait
 * for before the first paint.
 *
 * The choice lands as a `dark` class on <html>. That class alone changes
 * nothing: globals.css scopes the `dark:` variant to the signed-in shell, so
 * marketing pages, admin and the player keep their looks whatever is set here.
 *
 * Framework-free so the root layout (a server component) can inline
 * APPEARANCE_SCRIPT while client components use the rest.
 */

export type Appearance = "auto" | "light" | "dark";

const KEY = "mm-appearance";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before anything paints, so a dark-mode member never sees a
 * white flash on load. Keep in step with applyAppearance() below.
 */
export const APPEARANCE_SCRIPT = `(function(){try{var a=localStorage.getItem("${KEY}");var d=a==="dark"||(a!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function getAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  } catch {
    return "auto";
  }
}

export function applyAppearance() {
  const appearance = getAppearance();
  const dark =
    appearance === "dark" ||
    (appearance === "auto" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
}

const listeners = new Set<() => void>();

export function setAppearance(appearance: Appearance) {
  try {
    if (appearance === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, appearance);
  } catch {
    // Storage blocked (a private window): still switch for this page view.
  }
  applyAppearance();
  listeners.forEach((l) => l());
}

/**
 * For useSyncExternalStore. Also keeps <html> in step while the page is open:
 * the device switching between light and dark (Automatic), and the choice
 * changing in another tab.
 */
export function subscribeAppearance(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    applyAppearance();
    onChange();
  };
  listeners.add(onChange);
  media.addEventListener("change", applyAppearance);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", applyAppearance);
    window.removeEventListener("storage", onStorage);
  };
}
