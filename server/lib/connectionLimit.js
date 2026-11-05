// Counts how many connections each IP address has open right now.
// The app refuses a new connection once an address is at its limit, so one machine cannot open thousands of connections and use up the server (or its room cap).
export function createConnectionCounter() {
  const counts = new Map(); // ip -> open connections

  return {
    count(ip) {
      return counts.get(ip) ?? 0;
    },
    add(ip) {
      counts.set(ip, (counts.get(ip) ?? 0) + 1);
    },
    remove(ip) {
      const left = (counts.get(ip) ?? 0) - 1;
      if (left > 0) counts.set(ip, left);
      else counts.delete(ip); // never keep an empty entry: the table must not grow forever
    },
    get size() {
      return counts.size;
    },
  };
}
