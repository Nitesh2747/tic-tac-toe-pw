import { useSyncExternalStore } from "react";

// true while the browser window matches a CSS media query, e.g. "(min-width: 980px)".
// It updates by itself when the window is resized or rotated.
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches
  );
}
