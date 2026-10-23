// Copies text to the clipboard. Resolves to true if it worked, false if not.
//
// navigator.clipboard only exists on secure pages (https:// or localhost). On a
// plain http:// address, such as your computer's LAN IP, it is undefined, so we
// fall back to the older document.execCommand("copy"), which still works there.
export async function copyText(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* permission denied or similar: try the old way */
    }
  }
  return legacyCopy(text);
}

// Puts the text in a hidden <textarea>, selects it and asks the browser to copy
// the selection. It must run during a click (a user gesture), and it does.
function legacyCopy(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", ""); // stops phones from opening the keyboard
  field.setAttribute("aria-hidden", "true");
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
  document.body.appendChild(field);

  let copied = false;
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length); // select() alone is not enough on iOS
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    field.remove();
  }
  return copied;
}
