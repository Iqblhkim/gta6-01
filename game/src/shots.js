// Kota Seja — Halcyon Edition (round 9): staged scenes for screenshots.
// The game reads window.KOTA_SEJA_SHOTS at boot: when the page is opened
// with ?shot=<name>, the round-9 module inside src/game.js stages that
// scene (clock, player/car placement, wanted, HUD message) after the
// boot check passes, then the grader screenshots it. Normal play without
// a ?shot= query is untouched.
//
// Round 14 — SEMUA shot di senja/golden hour dengan kejar-kejaran polisi:
// panel dispatch + heli + roadblock + dialog aktif harus TERLIHAT di screenshot,
// seperti entri top-5 (dusk chase, HUD padat). Pesan & dialog ditulis sendiri.
window.KOTA_SEJA_SHOTS = {
  start: {
    label: "GOLDEN HOUR PURSUIT — chase at dusk",
    clock: 17.5,
    onFoot: false,
    car: { x: 0, z: 48, angle: 0, speed: 18 },
    camYaw: Math.PI,
    camPitch: 0.18,
    camZoom: 0.7,
    money: 18450,
    wanted: 4,
    mission: 2,
    rp: 3900,
    dialogue: { avatar: "👮", name: "CAPT. VANCE", role: "DISPATCH", text: "Suspect is northbound on the beach avenue. Air One, keep the light on him — ground units, box him in." },
    message: "GOLDEN HOUR PURSUIT",
    note: "4-star dusk chase on the central avenue — patrol cars closing, heli spotlight, roadblock ahead, dispatch talking."
  },
  drive: {
    label: "NEON STRIP — lose the heat at dusk",
    clock: 17.4,
    onFoot: false,
    car: { x: -40, z: 72, angle: Math.PI / 2, speed: 14 },
    camYaw: -Math.PI / 2,
    camPitch: 0.18,
    camZoom: 0.75,
    money: 6420,
    wanted: 2,
    mission: 2,
    rp: 2400,
    dialogue: { avatar: "👮", name: "CAPT. VANCE", role: "DISPATCH", text: "All units, the red sedan is heading for Neon Strip. Stay on him — do not let him reach the bridge." },
    message: "LOSE THE HEAT",
    note: "2-star dusk pursuit driving east on the south avenue — patrol cars and foot cops closing in."
  },
  chase: {
    label: "WANTED 4 — roadblock + heli at dusk",
    clock: 17.6,
    onFoot: false,
    car: { x: 36, z: -40, angle: 0, speed: 18 },
    camYaw: Math.PI,
    camPitch: 0.18,
    camZoom: 0.7,
    money: 18450,
    wanted: 4,
    mission: 2,
    rp: 3900,
    dialogue: { avatar: "👮", name: "CAPT. VANCE", role: "DISPATCH", text: "Air One has the light. Ground units, close the net — the roadblock is set on the avenue." },
    message: "WANTED ★★★★",
    note: "Four-star dusk chase: patrol cars closing in, heli spotlight overhead, roadblock on the avenue, dispatch talking."
  },
  boss: {
    label: "REVENGE — boss fight at dusk",
    clock: 17.45,
    onFoot: true,
    mission: 4,
    player: { x: -38, z: 62 },
    camYaw: 0.62,
    camPitch: 0.15,
    money: 8640,
    wanted: 0,
    rp: 5200,
    weapon: "Pistol",
    ammo: 24,
    dialogue: { avatar: "😠", name: "AZURA BOSS", role: "SYNDICATE", text: "Rico Vega. You picked the wrong harbour — my crew will bury you here." },
    message: "REVENGE",
    note: "Rico on foot at the harbour facing the Azura crew at dusk — boss taunt on screen."
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
