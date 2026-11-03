import { useEffect, useState } from "react";

function read() {
  const vv = window.visualViewport;
  return vv ? { height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale } : null;
}

function same(a, b) {
  if (!a || !b) return a === b;
  return a.height === b.height && a.offsetTop === b.offsetTop && a.scale === b.scale;
}

// The part of the screen you can actually see (see game/viewport.js for why it
// matters). Updates while the keyboard opens and closes. null if the browser
// does not report it.
export function useVisualViewport() {
  const [box, setBox] = useState(read);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox((previous) => (same(previous, read()) ? previous : read()));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return box;
}
