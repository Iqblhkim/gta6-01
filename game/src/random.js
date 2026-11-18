// Solano City — a small deterministic random source.
// Every random choice in the city and the world flows through this,
// so the same seed always builds the same city.

export function createRandom(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    // Integer in [0, n).
    int(n) {
      return Math.floor(next() * n);
    },
    // Float in [a, b).
    range(a, b) {
      return a + next() * (b - a);
    },
    // One element of the array.
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
