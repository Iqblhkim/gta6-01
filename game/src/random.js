// Seeded deterministic random numbers (mulberry32) plus small helpers.
// The whole city, traffic and pedestrian population come out of one seed,
// so the same seed always builds the same Kota Seja.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [min, max).
    range(min, max) { return min + next() * (max - min); },
    // Integer in [min, max] inclusive.
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    // Pick one element of an array.
    pick(list) { return list[Math.floor(next() * list.length)]; },
    // True with probability p.
    chance(p) { return next() < p; },
    // A stable hash of a string, for per-entity seeds.
    hash(str) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    },
  };
}
