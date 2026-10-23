const KEY = "ttt-room-id"; // this tab's room: survives a refresh, forgotten when the tab closes
const LAST_KEY = "ttt-last-room"; // the last room this browser was in: survives a closed tab

// Storage can throw when the browser blocks it (for example when cookies are
// blocked). Then the only things lost are rejoining after a refresh or a closed
// tab: the game itself keeps working.
//
// The storage is looked up BY NAME inside the try. In a browser that blocks
// storage even reading the global `localStorage` throws, so the lookup itself
// has to be inside the guard, not passed in from outside it.
function read(storageName, key) {
  try {
    return globalThis[storageName].getItem(key);
  } catch {
    return null;
  }
}

function write(storageName, key, value) {
  try {
    globalThis[storageName].setItem(key, value);
  } catch {
    /* rejoining will not work, everything else does */
  }
}

function remove(storageName, key) {
  try {
    globalThis[storageName].removeItem(key);
  } catch {
    /* nothing to clear */
  }
}

// Which room was this tab in? Used to rejoin automatically after a refresh.
export function getSavedRoom() {
  return read("sessionStorage", KEY);
}

// The last room this browser sat in. A player who closed their tab still holds
// their seat for a minute, and the lobby uses this to offer "Rejoin".
export function getLastRoom() {
  return read("localStorage", LAST_KEY);
}

export function saveRoom(roomId) {
  write("sessionStorage", KEY, roomId);
  write("localStorage", LAST_KEY, roomId);
}

export function clearSavedRoom() {
  remove("sessionStorage", KEY);
  remove("localStorage", LAST_KEY);
}
