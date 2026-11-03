// On a phone, the on-screen keyboard shrinks the part of the page you can SEE (the
// "visual viewport") but not the page itself. Anything pinned to the bottom of the
// page, like the chat sheet, then sits behind the keyboard.
//
// keyboardInset says how many pixels the bottom of the page is covered: the gap
// between the bottom of the page and the bottom of what you can see.
export function keyboardInset(layoutHeight, visual) {
  if (!visual) return 0;
  if (visual.scale > 1.01) return 0; // the user pinched to zoom: that is not a keyboard
  return Math.max(0, Math.round(layoutHeight - visual.height - visual.offsetTop));
}
