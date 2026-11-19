// Seeded deterministic random numbers (mulberry32) plus small helpers.
// The whole city, traffic and pedestrian population come out of one seed,
// so the same seed always builds the same Kota Seja.
// Round 6 (2026-11-19): untouched by the round-6 rework — the seed
// still builds the exact same city, so saves and screenshots stay
// comparable with round 5. (The new facade/tree data in city.js is
// drawn from this same RNG stream, in build order, so determinism
// holds: same seed, same windows, same trees.)
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
    // Round 7 — pick one entry of [value, weight] pairs, weighted by
    // the second element. Used for district building types (a Downtown
    // block is mostly apartments with a few glass offices) and for
    // NPC hair/outfit variety, where some looks are rarer than others.
    weightedPick(pairs) {
      let total = 0;
      for (const [, w] of pairs) total += w;
      let roll = next() * total;
      for (const [v, w] of pairs) {
        roll -= w;
        if (roll <= 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
    // Round 7 — Fisher-Yates shuffle of a copy: the street-prop
    // planter deals candidate spots from a shuffled deck so hydrants,
    // signs and benches spread evenly instead of clustering at the
    // first intersections the loop happens to reach.
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    // Round 7 — a child RNG seeded from a parent seed plus a label, so
    // one subsystem (roof details, NPC looks) can draw without
    // disturbing the main stream: the city layout stays byte-identical
    // to the seed even when a later system adds its own rolls.
    child(label) {
      return makeRng((seed ^ this.hash(label)) >>> 0);
    },
  };
}

// Round 7 (2026-11-19): weightedPick / shuffle / child — the new
// helpers above keep the old stream untouched (same seed, same city
// layout as round 6; the new systems draw from child streams), so
// saves and screenshots stay comparable with round 6.
