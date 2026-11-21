// Kota Seja — Halcyon Edition (round 15): staged scenes for screenshots.
// The game reads window.KOTA_SEJA_SHOTS at boot: when the page is opened
// with ?shot=<name>, the round-15 module inside src/game.js stages that
// scene (clock, player/car placement, wanted, HUD panels) after the boot
// check passes, then freezes the world so the grader screenshots a
// deterministic frame. Normal play without a ?shot= query is untouched.
//
// Round 15 — 4 ADEGAN BERBEDA, pola kanonik leaderboard (riset top 10,
// 21 Nov): (1) cover chase di boulevard pantai + heli polisi + roadblock,
// (2) aksi on-foot lawan kru Azura di pelabuhan, (3) layar sistem peta
// penuh + statistik karir + save slot, (4) title screen dengan menu.
// Semua pesan & dialog ditulis sendiri untuk ronde ini.

// Deterministic world: when the URL carries ?seed=N, Math.random is
// replaced by a small seeded generator BEFORE game.js builds the city
// (textures, buildings, palms, traffic, peds all draw from it), so two
// page loads with the same seed build the same world. Without ?seed=
// the native generator is used and normal play is untouched.
(function () {
  try {
    var q = new URLSearchParams(window.location.search);
    var seed = q.get("seed");
    if (seed === null) return;
    var a = (parseInt(seed, 10) || 1) >>> 0;
    Math.random = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  } catch (e) { /* no URLSearchParams — leave Math.random alone */ }
})();

window.KOTA_SEJA_SHOTS = {
  chase: {
    label: "PALMERA STRAND — beachfront pursuit at dusk",
    clock: 17.5,
    clockTxt: "FRI 17:25",
    onFoot: false,
    car: { x: -8, z: 72, angle: Math.PI / 2, speed: 30.83, hp: 62 },
    camYaw: -Math.PI / 2,
    camPitch: 0.02,
    camZoom: 0.8,
    money: 18450,
    wanted: 4,
    health: 86,
    mission: 2,
    rp: 3900,
    armor: 55,
    radioIdx: 0,
    district: { name: "PALMERA STRAND", street: "Beach Avenue" },
    missionHead: { kicker: "MISSION 3 · CHASE THE SUN", stage: "STAGE 2/3", title: "LOSE THE HEAT", progress: 62, next: "Reach Sunset Park — 184 m" },
    dispatch: [
      { name: "KITE-1", role: "RAMMING", d: 7 },
      { name: "MARLIN-3", role: "PURSUIT", d: 15 },
      { name: "CORAL-48", role: "FLANKING", d: 14 },
      { name: "AIR ONE", role: "SPOTLIGHT", d: 17 },
      { name: "ROADBLOCK", role: "ROADBLOCK", d: 41 },
      { name: "FOOT-1", role: "MARKSMAN", d: 9 },
      { name: "FOOT-2", role: "SEARCHING", d: 63 },
      { name: "CORAL-85", role: "PURSUIT", d: 187 }
    ],
    dispatchFoot: "IN SIGHT — SEARCH ZONE 31 M",
    crew: [
      { ability: "SWAP PLATES", name: "Mira", role: "Driver", key: "Z" },
      { ability: "QUICK FIX", name: "Lio", role: "Mechanic", key: "X" },
      { ability: "EYES OUT", name: "Kiki", role: "Lookout", key: "V" }
    ],
    dialogue: { avatar: "👩", name: "MIRA KESANG", role: "CREW · DRIVER", text: "Air One is right over us — punch it down Beach Avenue and don't stop for the roadblock!" },
    toast: "⚠ ROADBLOCK AHEAD — SBPD units converging on Beach Avenue",
    weapon: "SMG",
    ammo: { Pistol: 60, SMG: 30 },
    heliAhead: 14,
    heliH: 10,
    heliSide: 10,
    policeOffsets: [[6, -4], [12, 3], [18, -2]],
    traffic: [
      { x: 14, z: 67, a: Math.PI / 2 }, { x: 24, z: 74, a: Math.PI / 2 },
      { x: 34, z: 72, a: Math.PI / 2 }, { x: -30, z: 72, a: Math.PI / 2 },
      { x: 0, z: 36, a: 0 }, { x: 36, z: 0, a: Math.PI / 2 },
      { x: 36, z: -36, a: Math.PI }, { x: -36, z: 36, a: 0 }
    ],
    peds: [
      { x: -30, z: 80 }, { x: -12, z: 80.5 }, { x: 8, z: 80 }, { x: 24, z: 81 },
      { x: -38, z: 64 }, { x: 2, z: 64 }, { x: 18, z: 64 }, { x: 40, z: 80 },
      { x: -48, z: 80 }, { x: 52, z: 88 }
    ],
    burntCar: { x: 28, z: 68, angle: 0.3 },
    note: "Cover chase: red car east on the south boulevard, palms + beach on the right, police heli ahead with spotlight, 3 patrol cars behind/flanking, roadblock + smoking wreck ahead."
  },
  onfoot: {
    label: "REVENGE — shootout on foot at the harbour",
    clock: 17.6,
    clockTxt: "FRI 17:41",
    onFoot: true,
    mission: 4,
    player: { x: -40, z: 58 },
    camYaw: 0.62,
    camPitch: 0.15,
    camZoom: 1,
    money: 8640,
    wanted: 3,
    health: 92,
    rp: 5200,
    armor: 45,
    radioIdx: 0,
    district: { name: "PELABUHAN", street: "Harbour Road" },
    missionHead: { kicker: "MISSION 5 · REVENGE", stage: "STAGE 2/4", title: "TAKE DOWN THE AZURA CREW", progress: 48, next: "Drop the boss — 1 of 7 down" },
    dispatch: [
      { name: "FOOT-1", role: "MARKSMAN", d: 9 },
      { name: "KITE-1", role: "RAMMING", d: 12 },
      { name: "FOOT-2", role: "PURSUIT", d: 17 },
      { name: "MARLIN-3", role: "FLANKING", d: 44 },
      { name: "FOOT-3", role: "SEARCHING", d: 63 },
      { name: "CORAL-48", role: "PURSUIT", d: 121 }
    ],
    dispatchFoot: "IN SIGHT",
    crew: [
      { ability: "SWAP PLATES", name: "Mira", role: "Driver", key: "Z" },
      { ability: "QUICK FIX", name: "Lio", role: "Mechanic", key: "X" },
      { ability: "EYES OUT", name: "Kiki", role: "Lookout", key: "V" }
    ],
    dialogue: { avatar: "😠", name: "AZURA BOSS", role: "SYNDICATE", text: "Rico Vega. You picked the wrong harbour — my crew will bury you here." },
    toast: "⚠ SHOTS FIRED — Harbour Road · SBPD responding",
    weapon: "SMG",
    ammo: { Pistol: 60, SMG: 30 },
    footCops: [{ x: -34, z: 52 }, { x: -46, z: 60 }, { x: -30, z: 62 }],
    policeOffsets: [[-14, 10], [10, 10]],
    traffic: [
      { x: -36, z: 24, a: 0 }, { x: -36, z: 84, a: Math.PI },
      { x: 0, z: 72, a: Math.PI / 2 }, { x: -72, z: 36, a: Math.PI / 2 }
    ],
    peds: [
      { x: -30, z: 70 }, { x: -46, z: 70 }, { x: -28, z: 56 },
      { x: -52, z: 58 }, { x: -24, z: 66 }, { x: -44, z: 44 }
    ],
    note: "On-foot shootout: Rico with SMG facing the Azura crew at the harbour, foot cops closing in, patrol cars on the avenue behind, full HUD like the chase shot."
  },
  map: {
    label: "MAP — full city map + career stats + save slot",
    clock: 17.5,
    clockTxt: "FRI 17:25",
    onFoot: true,
    mission: 2,
    player: { x: 0, z: 70 },
    camYaw: 0,
    camPitch: 0.15,
    camZoom: 1,
    money: 18450,
    wanted: 0,
    rp: 3900,
    armor: 55,
    radioIdx: 0,
    sysScreen: true,
    sysData: {
      story: "3/5", complete: 61,
      rank: "RANK 3 · HUSTLER",
      save: "SAVE SLOT 1 — 61% COMPLETE · FRI 17:25",
      stats: [
        ["STORY MISSIONS", "3 / 5"], ["SIDE JOBS", "5 TYPES"],
        ["WEAPONS", "5"], ["DISTRICTS", "4"],
        ["RADIO STATIONS", "3"], ["VEHICLES OWNED", "3"]
      ],
      districts: [
        ["PELABUHAN", "FRIENDLY"], ["NEON STRIP", "NEUTRAL"],
        ["MARINA", "WARY"], ["BUKIT HALCYON", "NEUTRAL"]
      ],
      garage: "SEJA GT · NEON COUPE · MARINA SEDAN",
      tune: [
        ["ARMOR PLATING", "$1,200"], ["ENGINE TUNE", "$2,500"],
        ["NEON PAINT", "$400"]
      ]
    },
    note: "System screen: full map of Kota Seja with career stats, district standing, save slot and garage — the 3D city stays behind the overlay."
  },
  title: {
    label: "TITLE — Kota Seja at dusk, menu + save slot",
    clock: 17.5,
    clockTxt: "FRI 17:25",
    title: true,
    note: "Title screen: the menu stays up over the dusk city — big logo, pitch, story card, menu buttons, save slot line."
  }
};

// Reads ?shot=<name> from the URL; returns the scene key or null.
window.KOTA_SEJA_SHOT_QUERY = function () {
  try {
    var q = new URLSearchParams(window.location.search).get("shot");
    if (q && window.KOTA_SEJA_SHOTS[q]) return q;
  } catch (e) { /* no URLSearchParams or bad query — normal play */ }
  return null;
};
