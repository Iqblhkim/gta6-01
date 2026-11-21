// game.js — Kota Seja: Golden Hour Pursuit.
// A 2D-canvas open-world crime game (1280x720) with a pseudo-3D street view:
// sunset sky, beach road, police dispatch, crew abilities, radio, saves.
// Rendering is deterministic in ?shot=N mode: fixed seed, frozen animation,
// fixed clock and HUD values, so two captures of the same shot are identical.
// Live play (no ?shot=) runs the same renderer with a scrolling world.
(function () {
  'use strict';

  var D = window.SEJA_DATA;
  var SHOTS = window.SEJA_SHOTS;
  var W = 1280, H = 720, HORIZON = 252;

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

  // ------------------------------------------------------------ state
  var G = {
    screen: 'title',      // title | game | map | pause (pause overlays game)
    driving: false,
    frozen: false,        // true in ?shot= mode
    shot: 0, shotName: '',
    clockText: 'FRI 17:25',
    cash: '$18,450',
    mission: D.missions[2], missionStage: '2/3', missionPct: 62,
    missionNext: 'Reach Sunset Park — 184 m', storyDone: '2/5',
    rankLabel: 'RANK 3 · HUSTLER', rpLabel: '3,900 / 5,000 RP', rpPct: 78,
    wanted: 4, district: 'PALMERA STRAND', roadName: 'Beach Avenue',
    health: 86, armor: 55, speed: 0,
    carName: 'NEON COUPE', carCond: 62, carCondLabel: 'CONDITION 62% · DENTED',
    radioIdx: 0, weapon: 4,
    statusLine: 'IN SIGHT — SEARCH ZONE 31 M',
    dispatch: D.dispatchChase,
    toastKey: null, dialogKey: 'miraChase',
    camera: { x: 50, y: 0, zoom: 1.0 },
    world: null, player: null,
    saved: false, paused: false,
    // live-play fields
    px: 50, py: 0, camY: 0, vel: 0, keys: {},
    liveWorld: null, missionIdx: 2, lastTick: 0
  };
  window.SejaGame = G;

  // ------------------------------------------------------------ projection
  // Street space: x 0..100 across the road, y metres ahead of the camera.
  // Near objects are big and low on screen; far objects shrink toward the horizon.
  function project(x, y, cam) {
    var t = 1 - clamp(y, 0, 205) / 220;             // 1 near, ~0.07 far
    var half = (10 + 430 * Math.pow(t, 1.45)) * cam.zoom;
    var sx = 640 + ((x - cam.x) / 50) * half;
    var sy = HORIZON + (H - HORIZON) * Math.pow(t, 1.3);
    var s = (0.12 + 1.75 * Math.pow(t, 1.5)) * cam.zoom;
    return { sx: sx, sy: sy, s: s, t: t };
  }

  // ------------------------------------------------------------ sky & sea
  function drawSky(ctx, frozen, timeMs) {
    var g = ctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, '#7b4b94');
    g.addColorStop(0.45, '#c65f8e');
    g.addColorStop(0.75, '#ff8a5c');
    g.addColorStop(1, '#ffc46b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 300);
    // low sun with glow
    var sunX = 980, sunY = 205;
    var glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
    glow.addColorStop(0, 'rgba(255,240,180,0.95)');
    glow.addColorStop(0.35, 'rgba(255,190,90,0.55)');
    glow.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(sunX, sunY, 34, 0, Math.PI * 2); ctx.fill();
    // slow clouds (frozen in shot mode)
    var drift = frozen ? 0 : (timeMs * 0.004) % 60;
    ctx.fillStyle = 'rgba(255,220,230,0.5)';
    var clouds = [[180, 70, 150], [520, 110, 190], [880, 55, 130], [1150, 130, 160]];
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      ctx.beginPath();
      ctx.ellipse(c[0] + drift - 30, c[1], c[2] / 2, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // distant skyline silhouette
    ctx.fillStyle = '#4a2b63';
    var rng = mulberry32(90210);
    var bx = 0;
    while (bx < W) {
      var bw = 46 + rng() * 70, bh = 26 + rng() * 66;
      ctx.fillRect(bx, HORIZON - bh, bw, bh);
      bx += bw + 4;
    }
    // sea band on the right, behind the beach
    var sea = ctx.createLinearGradient(0, 210, 0, 300);
    sea.addColorStop(0, '#e8836b');
    sea.addColorStop(1, '#2e7f8f');
    ctx.fillStyle = sea;
    ctx.fillRect(880, 212, 400, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (var w = 0; w < 5; w++) ctx.fillRect(900 + w * 70, 232 + w * 7, 52, 3);
  }

  function drawBeach(ctx, cam) {
    // sand strip along the right edge of the road
    ctx.fillStyle = '#e8c98f';
    ctx.beginPath();
    ctx.moveTo(640 + 430 * cam.zoom, H);
    ctx.lineTo(640 + 60 * cam.zoom, HORIZON + 6);
    ctx.lineTo(W, HORIZON + 6);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    // beach umbrellas (fixed positions, seeded): all on the sand, clear of
    // the road edge (the road's right kerb is street x = 94)
    var rng = mulberry32(4242);
    var spots = [[96, 26], [96, 58], [97, 92], [97, 130]];
    for (var i = 0; i < spots.length; i++) {
      var p = project(spots[i][0], spots[i][1], cam);
      var us = p.s;
      ctx.strokeStyle = '#8a6b3f'; ctx.lineWidth = Math.max(1, 2 * us);
      ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.sx, p.sy - 26 * us); ctx.stroke();
      ctx.fillStyle = i % 2 ? '#ff5c8a' : '#ffd166';
      ctx.beginPath(); ctx.arc(p.sx, p.sy - 26 * us, 15 * us, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.sx, p.sy - 26 * us, 15 * us, Math.PI, 0); ctx.fill();
      ctx.fillStyle = i % 2 ? '#ff5c8a' : '#ffd166';
      ctx.beginPath(); ctx.moveTo(p.sx - 15 * us, p.sy - 26 * us); ctx.lineTo(p.sx, p.sy - 26 * us); ctx.lineTo(p.sx, p.sy - 40 * us); ctx.closePath(); ctx.fill();
    }
    void rng;
  }

  // ------------------------------------------------------------ street furniture
  function drawBuilding(ctx, side, y, color, rng, label) {
    // side: -1 left, +1 right. Buildings stand just off the road edge.
    var baseX = side < 0 ? 2 : 98;
    var p = project(baseX, y, G.camera);
    var w = 150 * p.s, h = (120 + rng() * 90) * p.s;
    var x0 = side < 0 ? p.sx - w : p.sx;
    ctx.fillStyle = color;
    ctx.fillRect(x0, p.sy - h, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x0, p.sy - h, w, 6 * p.s);
    // lit windows
    ctx.fillStyle = 'rgba(255,230,150,0.9)';
    var rows = Math.max(2, Math.floor(h / (26 * p.s)));
    var cols = Math.max(2, Math.floor(w / (26 * p.s)));
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (rng() < 0.55) {
          ctx.fillRect(x0 + 8 * p.s + c * 26 * p.s, p.sy - h + 12 * p.s + r * 26 * p.s, 12 * p.s, 14 * p.s);
        }
      }
    }
    if (label) {
      var fs = Math.max(9, 15 * p.s);
      ctx.font = '900 ' + fs + 'px Arial';
      ctx.fillStyle = '#0d0a1a';
      var tw = ctx.measureText(label).width;
      ctx.fillStyle = '#e8f6ff';
      ctx.fillRect(x0 + 6 * p.s, p.sy - h + 18 * p.s, tw + 12, fs + 8);
      ctx.fillStyle = '#123a5c';
      ctx.fillText(label, x0 + 12 * p.s, p.sy - h + 18 * p.s + fs + 1);
    }
  }

  function drawPalm(ctx, x, y, cam, rng) {
    var p = project(x, y, cam);
    var s = p.s;
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = Math.max(1.5, 5 * s);
    ctx.beginPath(); ctx.moveTo(p.sx, p.sy);
    ctx.quadraticCurveTo(p.sx + 6 * s, p.sy - 30 * s, p.sx + 2 * s, p.sy - 52 * s);
    ctx.stroke();
    ctx.strokeStyle = '#2f9e44';
    ctx.lineWidth = Math.max(1.5, 4 * s);
    for (var f = 0; f < 6; f++) {
      var a = -Math.PI * (0.12 + f * 0.16);
      ctx.beginPath(); ctx.moveTo(p.sx + 2 * s, p.sy - 52 * s);
      ctx.quadraticCurveTo(
        p.sx + 2 * s + Math.cos(a) * 26 * s, p.sy - 52 * s + Math.sin(a) * 18 * s - 8 * s,
        p.sx + 2 * s + Math.cos(a) * 34 * s, p.sy - 52 * s + Math.sin(a) * 30 * s + 6 * s);
      ctx.stroke();
    }
    void rng;
  }

  function drawCarRear(ctx, x, y, cam, color, opts) {
    opts = opts || {};
    var p = project(x, y, cam);
    var s = p.s;
    var w = 92 * s, h = 46 * s;
    var ang = opts.angle || 0;
    ctx.save();
    ctx.translate(p.sx, p.sy);
    ctx.rotate(ang);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-w / 2 - 4 * s, 2 * s, w + 8 * s, 10 * s);
    // wheels
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(-w / 2 - 2 * s, -h * 0.28, 10 * s, 16 * s);
    ctx.fillRect(w / 2 - 8 * s, -h * 0.28, 10 * s, 16 * s);
    // body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h, w, h, 8 * s);
    ctx.fill();
    // cabin / roof
    ctx.fillStyle = 'rgba(20,24,32,0.92)';
    ctx.beginPath();
    ctx.roundRect(-w * 0.36, -h - 22 * s, w * 0.72, 24 * s, 6 * s);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(-w * 0.36, -h - 24 * s, w * 0.72, 5 * s);
    // tail light strip
    ctx.fillStyle = '#ff2e3d';
    ctx.fillRect(-w / 2 + 6 * s, -h + 8 * s, w - 12 * s, 6 * s);
    // plate
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-14 * s, -h + 20 * s, 28 * s, 9 * s);
    if (opts.police) {
      // roof light bar: red / blue, frozen flash phase in shot mode
      var phase = opts.lights === 'B' ? 1 : 0;
      ctx.fillStyle = phase ? '#2f7bff' : '#ff2e3d';
      ctx.fillRect(-w * 0.3, -h - 30 * s, w * 0.28, 7 * s);
      ctx.fillStyle = phase ? '#ff2e3d' : '#2f7bff';
      ctx.fillRect(w * 0.02, -h - 30 * s, w * 0.28, 7 * s);
      ctx.fillStyle = '#fff';
      ctx.font = '900 ' + Math.max(8, 11 * s) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SBPD', 0, -h + 34 * s);
      ctx.textAlign = 'left';
    }
    ctx.restore();
    if (opts.smoke) {
      // exhaust smoke: dark, soft and rising in a column, not hard bubbles
      ctx.fillStyle = 'rgba(64,64,70,0.38)';
      var puffs = [[-16, -14], [4, -28], [18, -44]];
      for (var i = 0; i < puffs.length; i++) {
        ctx.beginPath();
        ctx.arc(p.sx + puffs[i][0] * s, p.sy - h + puffs[i][1] * s, (12 + i * 6) * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCarSide(ctx, x, y, cam, color) {
    var p = project(x, y, cam);
    var s = p.s * 1.35;
    var w = 150 * s, h = 40 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(p.sx - w / 2, p.sy + 2, w, 8 * s);
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath(); ctx.arc(p.sx - w * 0.3, p.sy, 13 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.sx + w * 0.3, p.sy, 13 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(p.sx - w / 2, p.sy - h, w, h, 10 * s);
    ctx.fill();
    ctx.fillStyle = 'rgba(15,20,28,0.9)';
    ctx.beginPath();
    ctx.roundRect(p.sx - w * 0.28, p.sy - h - 20 * s, w * 0.56, 22 * s, 6 * s);
    ctx.fill();
    ctx.fillStyle = '#ff2e3d';
    ctx.fillRect(p.sx - w / 2 + 4 * s, p.sy - h + 8 * s, w - 8 * s, 5 * s);
  }

  function drawPerson(ctx, x, y, cam, shirt, suit) {
    var p = project(x, y, cam);
    var s = p.s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy, 16 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.strokeStyle = suit ? '#14141c' : '#1d2a4a';
    ctx.lineWidth = Math.max(2, 6 * s);
    ctx.beginPath(); ctx.moveTo(p.sx - 4 * s, p.sy - 26 * s); ctx.lineTo(p.sx - 6 * s, p.sy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.sx + 4 * s, p.sy - 26 * s); ctx.lineTo(p.sx + 6 * s, p.sy); ctx.stroke();
    // torso
    ctx.fillStyle = suit || shirt;
    ctx.fillRect(p.sx - 11 * s, p.sy - 52 * s, 22 * s, 28 * s);
    // arms
    ctx.strokeStyle = suit || shirt;
    ctx.lineWidth = Math.max(2, 5 * s);
    ctx.beginPath(); ctx.moveTo(p.sx - 11 * s, p.sy - 48 * s); ctx.lineTo(p.sx - 17 * s, p.sy - 30 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.sx + 11 * s, p.sy - 48 * s); ctx.lineTo(p.sx + 17 * s, p.sy - 30 * s); ctx.stroke();
    // head
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(p.sx, p.sy - 60 * s, 9 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(p.sx, p.sy - 63 * s, 9 * s, Math.PI, 0); ctx.fill();
    if (suit) {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(p.sx - 7 * s, p.sy - 62 * s, 14 * s, 3 * s); // shades
      ctx.fillStyle = '#fff';
      ctx.fillRect(p.sx - 2 * s, p.sy - 51 * s, 4 * s, 12 * s); // tie
    }
  }

  function drawHeli(ctx, frozen, timeMs) {
    // Police helicopter, upper right, with a spotlight cone to the road.
    // Kept fully inside the frame: the body sits low enough that the tilted
    // rotor clears the top edge.
    var hx = 735, hy = 128;
    var rotor = frozen ? 0.25 : (timeMs * 0.02) % (Math.PI * 2);
    // spotlight cone: heli belly down to a bright pool on the road
    var cone = ctx.createLinearGradient(hx, hy + 20, 830, 430);
    cone.addColorStop(0, 'rgba(255,246,190,0.55)');
    cone.addColorStop(1, 'rgba(255,246,190,0.06)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(hx - 14, hy + 22); ctx.lineTo(hx + 14, hy + 22);
    ctx.lineTo(900, 440); ctx.lineTo(770, 440);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,246,190,0.5)';
    ctx.beginPath(); ctx.ellipse(835, 440, 90, 16, 0, 0, Math.PI * 2); ctx.fill();
    // tail
    ctx.fillStyle = '#101418';
    ctx.beginPath(); ctx.moveTo(hx - 90, hy + 4); ctx.lineTo(hx - 10, hy - 8); ctx.lineTo(hx - 10, hy + 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#101418';
    ctx.fillRect(hx - 108, hy - 22, 10, 26);
    // body
    ctx.fillStyle = '#161c22';
    ctx.beginPath(); ctx.ellipse(hx + 10, hy, 62, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath(); ctx.ellipse(hx + 38, hy - 4, 22, 12, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 13px Arial'; ctx.textAlign = 'center';
    ctx.fillText('SBPD', hx - 2, hy + 5);
    ctx.textAlign = 'left';
    // skids
    ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(hx - 30, hy + 26); ctx.lineTo(hx + 50, hy + 26); ctx.stroke();
    // main rotor (frozen angle in shot mode) + tail rotor
    ctx.strokeStyle = 'rgba(20,20,24,0.9)'; ctx.lineWidth = 5;
    ctx.save(); ctx.translate(hx + 6, hy - 30); ctx.rotate(rotor);
    ctx.beginPath(); ctx.moveTo(-72, 0); ctx.lineTo(72, 0); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(hx - 104, hy - 10); ctx.rotate(frozen ? 0.6 : timeMs * 0.03);
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
    ctx.restore();
    // searchlight dot
    ctx.fillStyle = '#fff7c0';
    ctx.beginPath(); ctx.arc(hx, hy + 24, 6, 0, Math.PI * 2); ctx.fill();
  }

  function drawRoad(ctx, cam) {
    // road trapezoid: wide at the bottom, narrow at the horizon
    var nearL = project(6, 0, cam).sx, nearR = project(94, 0, cam).sx;
    var farL = project(6, 205, cam).sx, farR = project(94, 205, cam).sx;
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath();
    ctx.moveTo(nearL, H); ctx.lineTo(farL, HORIZON + 4);
    ctx.lineTo(farR, HORIZON + 4); ctx.lineTo(nearR, H);
    ctx.closePath(); ctx.fill();
    // centre dashes
    ctx.fillStyle = '#ffd166';
    for (var y = 4; y < 200; y += 16) {
      var p0 = project(50, y, cam), p1 = project(50, y + 7, cam);
      var w = Math.max(2, 4 * p0.s);
      ctx.fillRect(p0.sx - w / 2, p1.sy, w, p0.sy - p1.sy);
    }
    // crosswalk near the camera
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (var i = 0; i < 9; i++) {
      var cx0 = project(8 + i * 10, 10, cam), cx1 = project(8 + i * 10, 16, cam);
      var cw = Math.max(3, 6 * cx0.s);
      ctx.fillRect(cx0.sx - cw / 2, cx1.sy, cw, cx0.sy - cx1.sy);
    }
    // kerbs
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(nearL - 8, HORIZON + 4, 8, H - HORIZON - 4);
    ctx.fillRect(nearR, HORIZON + 4, 8, H - HORIZON - 4);
  }

  // ------------------------------------------------------------ main scene
  function drawStreet(ctx, frozen, timeMs) {
    var cam = G.camera;
    var rng = mulberry32(20261121 + G.shot * 131);
    drawSky(ctx, frozen, timeMs);
    drawRoad(ctx, cam);
    if (G.world && G.world.beach) drawBeach(ctx, cam);
    // buildings: left row and right row, seeded colours
    var colors = ['#2e7f8f', '#e8590c', '#d64570', '#7c5cff', '#3a7ca5', '#c94f3d'];
    var shops = (G.world && G.world.shops) || [];
    for (var i = 0; i < 7; i++) {
      var yL = 18 + i * 28 + rng() * 8;
      var yR = 26 + i * 28 + rng() * 8;
      drawBuilding(ctx, -1, yL, pick(rng, colors), rng, i === 2 ? shops[1] : null);
      drawBuilding(ctx, 1, yR, pick(rng, colors), rng, i === 1 ? shops[0] : (i === 4 ? shops[2] : null));
    }
    // palms along both kerbs
    var palms = (G.world && G.world.palms) || [10, 26, 44, 62, 80, 92];
    for (var p = 0; p < palms.length; p++) {
      var side = p % 2 === 0 ? 3 : 97;
      drawPalm(ctx, side, 14 + p * 26, cam, rng);
    }
    // pedestrians
    var peds = (G.world && G.world.pedestrians) || [];
    for (var q = 0; q < peds.length; q++) {
      drawPerson(ctx, peds[q].x, peds[q].y, cam, pick(rng, ['#ffd166', '#51e39a', '#ff8a5c']), null);
    }
    // traffic
    var traf = (G.world && G.world.traffic) || [];
    for (var t = 0; t < traf.length; t++) drawCarRear(ctx, traf[t].x, traf[t].y, cam, traf[t].color, {});
    // roadblock (crossed police cars ahead)
    var rb = (G.world && G.world.roadblock) || [];
    for (var r = 0; r < rb.length; r++) {
      drawCarRear(ctx, rb[r].x, rb[r].y, cam, rb[r].color, { police: true, lights: r ? 'B' : 'A', angle: rb[r].angle });
    }
    // police pursuit cars
    var pol = (G.world && G.world.police) || [];
    for (var u = 0; u < pol.length; u++) {
      drawCarRear(ctx, pol[u].x, pol[u].y, cam, pol[u].color, { police: true, lights: pol[u].lights });
    }
    // parked car (on-foot shot)
    if (G.world && G.world.parkedCar) {
      drawCarSide(ctx, G.world.parkedCar.x, G.world.parkedCar.y, cam, G.world.parkedCar.color);
    }
    // player car / player on foot
    if (G.world && G.world.playerCar) {
      drawCarRear(ctx, G.world.playerCar.x, G.world.playerCar.y, cam, G.world.playerCar.color, { smoke: G.world.playerCar.smoke });
      var puffs = G.world.smokePuffs || [];
      // one rising plume above the car: each puff higher, bigger and softer
      var rise = [34, 52, 70];
      ctx.fillStyle = 'rgba(64,64,70,0.35)';
      for (var s = 0; s < puffs.length; s++) {
        var pp = project(puffs[s].x, puffs[s].y, cam);
        ctx.beginPath(); ctx.arc(pp.sx, pp.sy - rise[s] * pp.s, (12 + s * 6) * pp.s, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (G.player) drawPerson(ctx, G.player.x, G.player.y, cam, G.player.shirt, null);
    var crew = (G.world && G.world.crew) || [];
    for (var c = 0; c < crew.length; c++) drawPerson(ctx, crew[c].x, crew[c].y, cam, null, crew[c].suit);
    // helicopter last: it flies above everything
    if (G.world && G.world.heli && G.world.heli.spotlight) drawHeli(ctx, frozen, timeMs);
  }

  // ------------------------------------------------------------ title skyline
  function drawTitleSkyline(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5b2a72');
    g.addColorStop(0.5, '#c65f8e');
    g.addColorStop(0.8, '#ff8a5c');
    g.addColorStop(1, '#2b1a3d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(900, 300, 46, 0, Math.PI * 2); ctx.fill();
    var glow = ctx.createRadialGradient(900, 300, 10, 900, 300, 190);
    glow.addColorStop(0, 'rgba(255,220,140,0.6)');
    glow.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = glow; ctx.fillRect(700, 100, 400, 400);
    var rng = mulberry32(777);
    // back row (far, darker)
    for (var x = 0; x < W; x += 74) {
      var bh = 190 + rng() * 130;
      ctx.fillStyle = '#3a2050';
      ctx.fillRect(x, 560 - bh, 66, bh);
    }
    // front row with lit windows
    for (var x2 = -20; x2 < W; x2 += 96) {
      var bh2 = 120 + rng() * 180;
      ctx.fillStyle = x2 % 192 === 0 ? '#1f7a8c' : (x2 % 288 === 0 ? '#a33d4f' : '#241a3d');
      ctx.fillRect(x2, 620 - bh2, 84, bh2);
      ctx.fillStyle = 'rgba(255,220,130,0.85)';
      for (var wy = 620 - bh2 + 14; wy < 600; wy += 26) {
        for (var wx = x2 + 10; wx < x2 + 74; wx += 22) {
          if (rng() < 0.45) ctx.fillRect(wx, wy, 10, 13);
        }
      }
    }
    // street + sea reflection at the bottom: horizontal gold streaks under the sun
    ctx.fillStyle = '#191024';
    ctx.fillRect(0, 620, W, 100);
    ctx.fillStyle = 'rgba(255,209,102,0.65)';
    var streaks = [[660, 640, 260], [700, 660, 180], [740, 680, 110], [770, 700, 60]];
    for (var st = 0; st < streaks.length; st++) {
      ctx.fillRect(streaks[st][0], streaks[st][1], streaks[st][2], 3);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var z = 0; z < 8; z++) ctx.fillRect(80 + z * 150, 668, 70, 6);
  }

  // ------------------------------------------------------------ minimap & map
  function drawMinimap() {
    var cv = $('minimap'); if (!cv) return;
    var ctx = cv.getContext('2d');
    var S = 220;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(110, 110, 110, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1d5c33'; ctx.fillRect(0, 0, S, S);
    // beach strip on the right
    ctx.fillStyle = '#e8c98f'; ctx.fillRect(182, 0, 38, S);
    ctx.fillStyle = '#2e7f8f'; ctx.fillRect(200, 0, 20, S);
    // road grid
    ctx.strokeStyle = '#0d0d12'; ctx.lineWidth = 9;
    for (var i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(i * 36, 0); ctx.lineTo(i * 36, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 36); ctx.lineTo(S, i * 36); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,209,102,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 108); ctx.lineTo(S, 108); ctx.stroke();
    // shops / markers
    var rng = mulberry32(5150 + G.shot * 7);
    ctx.fillStyle = '#ffd166';
    for (var m = 0; m < 7; m++) { ctx.beginPath(); ctx.arc(20 + rng() * 160, 20 + rng() * 170, 3, 0, Math.PI * 2); ctx.fill(); }
    // mission marker
    ctx.fillStyle = '#ff2e3d';
    ctx.beginPath(); ctx.arc(150, 62, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(150, 62, 12, 0, Math.PI * 2); ctx.stroke();
    // police dots
    ctx.fillStyle = '#4dabff';
    var pd = [[70, 90], [120, 130], [60, 150], [170, 100]];
    for (var k = 0; k < pd.length; k++) { ctx.beginPath(); ctx.arc(pd[k][0], pd[k][1], 4, 0, Math.PI * 2); ctx.fill(); }
    // player dot
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(104, 128, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d21f2b';
    ctx.beginPath(); ctx.arc(104, 128, 4.5, 0, Math.PI * 2); ctx.fill();
    // compass
    ctx.fillStyle = '#fff'; ctx.font = '900 13px Arial'; ctx.textAlign = 'center';
    ctx.fillText('N', 110, 18);
    ctx.restore();
  }

  function drawMapCanvas() {
    var cv = $('mapCanvas'); if (!cv) return;
    var ctx = cv.getContext('2d');
    var S = 560;
    ctx.fillStyle = '#1d5c33'; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#0d0d12'; ctx.lineWidth = 20;
    for (var i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(i * 92, 0); ctx.lineTo(i * 92, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 92); ctx.lineTo(S, i * 92); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,209,102,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 280); ctx.lineTo(S, 280); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(280, 0); ctx.lineTo(280, S); ctx.stroke();
    // blocks
    var rng = mulberry32(31337);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (var by = 0; by < 5; by++) for (var bx = 0; bx < 5; bx++) {
      if (rng() < 0.7) ctx.fillRect(bx * 92 + 18, by * 92 + 18, 56, 56);
    }
    // district labels
    ctx.fillStyle = '#fff'; ctx.font = '900 15px Arial'; ctx.textAlign = 'left';
    ctx.fillText('MARINA', 24, 40);
    ctx.fillText('BUKIT HALCYON', 400, 40);
    ctx.fillText('TAMAN SENJA', 220, 300);
    ctx.fillText('PELABUHAN', 24, 530);
    ctx.fillText('NEON STRIP', 400, 530);
    // markers: mission, player, shops, police
    function dot(x, y, color, r) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke();
    }
    dot(150, 150, '#ff2e3d', 9);
    dot(280, 330, '#4dabff', 9);
    ctx.fillStyle = '#ffd166';
    var shops = [[90, 90], [380, 200], [200, 420], [460, 380], [120, 250]];
    for (var s = 0; s < shops.length; s++) { ctx.beginPath(); ctx.arc(shops[s][0], shops[s][1], 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#4dabff';
    var cops = [[420, 90], [90, 400], [350, 470]];
    for (var c = 0; c < cops.length; c++) { ctx.beginPath(); ctx.arc(cops[c][0], cops[c][1], 6, 0, Math.PI * 2); ctx.fill(); }
  }

  // ------------------------------------------------------------ HUD
  function buildWeapons() {
    var box = $('weapons'); if (!box) return;
    box.innerHTML = '';
    D.weapons.forEach(function (w) {
      var el = document.createElement('div');
      el.className = 'wslot' + (w.slot === G.weapon ? ' active' : '') + (w.locked ? ' locked' : '');
      el.innerHTML = '<div class="w-num">' + w.slot + '</div><div class="w-ico">' + w.icon + '</div>' +
        '<div class="w-name">' + w.name + '</div><div class="w-ammo">' + w.ammo + '</div>';
      box.appendChild(el);
    });
  }
  function buildCrew() {
    var box = $('crew'); if (!box) return;
    box.innerHTML = '';
    D.crew.forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'crew-row';
      el.innerHTML = '<div class="c-av">' + c.icon + '</div><div class="c-body"><div class="c-name">' +
        c.name + '</div><div class="c-sub">' + c.who + '</div></div>' +
        '<div class="c-key">' + c.key + '</div><div class="c-state">' + c.state + '</div>';
      box.appendChild(el);
    });
  }
  function buildDispatch() {
    var rows = $('dRows'); if (!rows) return;
    rows.innerHTML = '';
    G.dispatch.forEach(function (u) {
      var el = document.createElement('div');
      el.className = 'd-row';
      el.innerHTML = '<span>' + u.name + '</span><span class="d-role ' + u.cls + '">' + u.role +
        '</span><span class="d-dist">' + u.dist + ' m</span>';
      rows.appendChild(el);
    });
    var cnt = $('dCount'); if (cnt) cnt.textContent = G.dispatch.length + ' UNITS';
    var foot = $('dFoot'); if (foot) foot.textContent = G.statusLine;
  }
  function buildMapPanels() {
    var grid = $('statGrid'); if (grid) {
      grid.innerHTML = '';
      D.career.forEach(function (s) {
        var el = document.createElement('div');
        el.className = 'stat-cell';
        el.innerHTML = '<div class="s-k">' + s.k + '</div><div class="s-v">' + s.v + '</div>';
        grid.appendChild(el);
      });
    }
    var stand = $('standList'); if (stand) {
      stand.innerHTML = '';
      D.districts.slice(0, 4).forEach(function (d) {
        var el = document.createElement('div');
        el.className = 'stand-row';
        var pill = d.standing === 'FRIENDLY' ? 'st-friendly' : (d.standing === 'WARY' ? 'st-wary' : 'st-neutral');
        el.innerHTML = '<span>' + d.name + '</span><span class="stand-pill ' + pill + '">' + d.standing + '</span>';
        stand.appendChild(el);
      });
    }
    var gar = $('garList'); if (gar) {
      gar.innerHTML = '';
      var head = document.createElement('div');
      head.className = 'gar-row';
      head.innerHTML = '<span>🚗 ' + D.garage.owned.join(' · ') + '</span><span class="price">3 OWNED</span>';
      gar.appendChild(head);
      D.garage.upgrades.forEach(function (u) {
        var el = document.createElement('div');
        el.className = 'gar-row';
        el.innerHTML = '<span>' + u.name + '</span><span class="price">' + u.price + '</span>';
        gar.appendChild(el);
      });
    }
    var save = $('saveStrip'); if (save) {
      save.textContent = '💾 SAVE SLOT 1 — 61% COMPLETE · ' + G.clockText + ' · ' + G.cash + ' · ' + G.rankLabel;
    }
  }

  function applyHud() {
    var set = function (id, txt) { var e = $(id); if (e) e.textContent = txt; };
    set('cashAmt', G.cash);
    set('clock', G.clockText);
    set('mKicker', 'MISSION ' + G.mission.id + ' · ' + G.mission.name);
    set('mStage', 'STAGE ' + G.missionStage + ' · ' + G.missionPct + '%');
    set('mTitle', G.mission.title);
    var bar = $('mBarFill'); if (bar) bar.style.width = G.missionPct + '%';
    set('mNext', 'NEXT: ' + G.missionNext);
    set('mSub', '▣ STORY ' + G.storyDone + '  ·  ◉ Side: 0');
    set('rankLabel', G.rankLabel);
    set('rpLabel', G.rpLabel);
    var rp = $('rpFill'); if (rp) rp.style.width = G.rpPct + '%';
    var stars = $('stars');
    if (stars) {
      var s = '';
      for (var i = 0; i < 5; i++) s += i < G.wanted ? '★' : '<span class="off">☆</span>';
      stars.innerHTML = s;
    }
    set('distName', G.district);
    set('distRoad', G.roadName);
    var hp = $('hpFill'); if (hp) hp.style.width = G.health + '%';
    var ar = $('arFill'); if (ar) ar.style.width = G.armor + '%';
    set('hpNum', String(G.health));
    set('arNum', String(G.armor));
    set('speedNum', String(G.speed));
    set('carLine', '');
    var carLine = $('carLine');
    if (carLine) {
      carLine.innerHTML = G.carName ? (G.carName + '&nbsp; <span class="gold">' + G.carCondLabel + '</span>') : '';
    }
    var cond = $('condFill'); if (cond) cond.style.width = G.carCond + '%';
    var radio = D.radio[G.radioIdx % D.radio.length];
    set('radioLine', '♪ ' + radio.station + ' — ' + radio.track);
    var dlg = D.dialogues[G.dialogKey] || D.dialogues.miraChase;
    set('dlgName', dlg.name);
    set('dlgText', dlg.text);
    set('dlgAv', dlg.avatar);
    var toast = $('toast');
    if (toast) {
      if (G.toastKey && D.toasts[G.toastKey]) {
        toast.textContent = D.toasts[G.toastKey];
        toast.style.display = '';
      } else {
        toast.style.display = 'none';
      }
    }
    var speedo = $('speedo'), onfoot = $('onfootBar');
    if (speedo) speedo.style.display = G.driving ? '' : 'none';
    if (onfoot) onfoot.classList.toggle('hidden', G.driving);
    buildWeapons();
    buildCrew();
    buildDispatch();
    drawMinimap();
  }

  // ------------------------------------------------------------ screens
  function showScreen(name) {
    G.screen = name;
    var hud = $('hud'), title = $('titleScreen'), map = $('mapScreen'), pause = $('pauseScreen');
    if (title) title.classList.toggle('hidden', name !== 'title');
    if (map) map.classList.toggle('hidden', name !== 'map');
    if (pause) pause.classList.toggle('hidden', name !== 'pause');
    if (hud) hud.classList.toggle('hidden', name === 'title' || name === 'map');
    if (name === 'map') { buildMapPanels(); drawMapCanvas(); }
  }

  function showToast(key, ms) {
    G.toastKey = key;
    applyHud();
    if (ms && !G.frozen) {
      setTimeout(function () {
        if (G.toastKey === key) { G.toastKey = null; applyHud(); }
      }, ms);
    }
  }

  // ------------------------------------------------------------ live world
  function genLiveWorld() {
    var rng = mulberry32(20261121);
    var colors = ['#2e7f8f', '#e8590c', '#d64570', '#7c5cff', '#3a7ca5', '#c94f3d'];
    var w = {
      beach: true,
      shops: ['HOTEL AZURA', 'PALM CAFE', 'SEJA SURF'],
      palms: [8, 20, 33, 46, 59, 72, 85, 94],
      pedestrians: [], traffic: [], police: [], roadblock: [],
      playerCar: { x: 50, y: 8, color: '#d21f2b', smoke: false },
      smokePuffs: [], heli: { x: 78, y: 150, altitude: 1, spotlight: true },
      buildings: []
    };
    for (var i = 0; i < 6; i++) {
      w.pedestrians.push({ x: 12 + rng() * 76, y: 20 + rng() * 120 });
      w.traffic.push({ x: 26 + rng() * 48, y: 30 + rng() * 150, color: pick(rng, ['#2b6cb0', '#b7791f', '#4a5568', '#718096']) });
    }
    for (var p = 0; p < 3; p++) {
      w.police.push({ x: 30 + p * 18, y: 60 + p * 22, color: '#101418', lights: p % 2 ? 'B' : 'A' });
    }
    w.roadblock = [
      { x: 30, y: 150, angle: -0.6, color: '#101418' },
      { x: 62, y: 154, angle: 0.6, color: '#141a20' }
    ];
    void colors;
    return w;
  }

  function startGame(fresh) {
    if (fresh) {
      G.missionIdx = 2;
      G.mission = D.missions[2];
      G.missionPct = 0;
      G.cash = '$18,450';
      G.wanted = 4;
      G.health = 86; G.armor = 55;
      G.speed = 0; G.driving = false;
      G.camY = 0; G.px = 50;
      G.liveWorld = genLiveWorld();
      G.world = G.liveWorld;
      G.world.playerCar = null;
      G.player = { x: 50, y: 26, shirt: '#e8590c' };
      G.dialogKey = 'miraChase';
      G.toastKey = 'roadblock';
    }
    G.paused = false;
    showScreen('game');
    applyHud();
    var cv = $('scene');
    render(cv.getContext('2d'), 0);
  }

  function toggleMap() {
    if (G.screen === 'map') { showScreen('game'); }
    else if (G.screen === 'game') { showScreen('map'); }
  }
  function togglePause() {
    if (G.screen === 'pause') { G.paused = false; showScreen('game'); }
    else if (G.screen === 'game') { G.paused = true; showScreen('pause'); }
  }
  function saveGame() {
    G.saved = true;
    try { localStorage.setItem('kota-seja-save-1', JSON.stringify({ cash: G.cash, pct: G.missionPct, clock: G.clockText })); } catch (e) { /* storage may be unavailable */ }
    showToast('saved', 2600);
    var pt = $('pauseText');
    if (pt) pt.innerHTML = 'Mission ' + G.mission.id + ' · ' + G.mission.name + ' — progress saved to slot 1.<br>Press P or ESC to resume.';
  }
  function useCrew(idx) {
    var c = D.crew[idx]; if (!c) return;
    c.state = 'USED';
    buildCrew();
    showToast(null, 0);
    G.toastKey = null;
    var toast = $('toast');
    if (toast) { toast.textContent = '✔ ' + c.name + ' — ' + c.who + ' · ability fired'; toast.style.display = ''; }
    setTimeout(function () { c.state = 'READY'; buildCrew(); }, 5000);
  }

  // ------------------------------------------------------------ update + render
  function update(dt) {
    var k = G.keys;
    if (G.driving) {
      if (k['arrowup'] || k['w']) G.vel = Math.min(G.vel + 60 * dt, 120);
      else if (k['arrowdown'] || k['s']) G.vel = Math.max(G.vel - 80 * dt, -20);
      else G.vel *= Math.max(0, 1 - 0.8 * dt);
      if (k['arrowleft'] || k['a']) G.px = clamp(G.px - 26 * dt * (0.4 + Math.abs(G.vel) / 120), 12, 88);
      if (k['arrowright'] || k['d']) G.px = clamp(G.px + 26 * dt * (0.4 + Math.abs(G.vel) / 120), 12, 88);
      G.speed = Math.round(Math.abs(G.vel));
      G.camY += G.vel * dt * 0.55;
      if (G.camY > 240) G.camY -= 240;
      G.world.playerCar.x = G.px;
      G.missionPct = clamp(G.missionPct + dt * 0.55, 0, 100);
      if (G.missionPct >= 100) {
        G.missionPct = 0;
        G.cash = '$' + (parseInt(G.cash.replace(/[^0-9]/g, ''), 10) + 2500).toLocaleString('en-US');
        showToast('missionPassed', 3000);
        G.missionIdx = Math.min(G.missionIdx + 1, D.missions.length - 1);
        G.mission = D.missions[G.missionIdx];
        G.dialogKey = G.missionIdx === 4 ? 'azuraBoss' : 'vance';
      }
      // police close in while wanted
      G.world.police.forEach(function (pc, i) {
        pc.y = Math.max(28, pc.y - dt * (2 + i));
        pc.x += (G.px - pc.x) * dt * 0.25;
      });
    } else {
      var step = 22 * dt;
      if (k['arrowup'] || k['w']) G.py = clamp(G.py + step, 0, 60);
      if (k['arrowdown'] || k['s']) G.py = clamp(G.py - step, 0, 60);
      if (k['arrowleft'] || k['a']) G.px = clamp(G.px - step, 12, 88);
      if (k['arrowright'] || k['d']) G.px = clamp(G.px + step, 12, 88);
      G.speed = 0;
      if (G.player) { G.player.x = G.px; G.player.y = 26 + G.py * 0.2; }
    }
    G.camera.x = 50 + (G.px - 50) * 0.25;
  }

  function render(ctx, timeMs) {
    if (G.screen === 'title') { drawTitleSkyline(ctx); return; }
    if (G.screen === 'map') {
      // dim city backdrop behind the map overlay
      ctx.fillStyle = '#17112e'; ctx.fillRect(0, 0, W, H);
      drawMapCanvas();
      return;
    }
    drawStreet(ctx, G.frozen, timeMs);
    if (G.screen === 'game' || G.screen === 'pause') drawMinimap();
  }

  function loop(ts) {
    if (G.frozen) return;
    if (G.screen === 'title' || G.screen === 'map') {
      var cv0 = $('scene');
      render(cv0.getContext('2d'), ts);
      requestAnimationFrame(loop);
      return;
    }
    var dt = G.lastTick ? Math.min(0.05, (ts - G.lastTick) / 1000) : 0.016;
    G.lastTick = ts;
    if (!G.paused && G.screen === 'game') update(dt);
    var cv = $('scene');
    render(cv.getContext('2d'), ts);
    if (G.screen === 'game' || G.screen === 'pause') applyHudThrottled(ts);
    requestAnimationFrame(loop);
  }
  var lastHud = 0;
  function applyHudThrottled(ts) {
    if (ts - lastHud > 200) { lastHud = ts; applyHud(); }
  }

  // ------------------------------------------------------------ input
  function onKeyDown(e) {
    var key = (e.key || '').toLowerCase();
    G.keys[key] = true;
    if (G.screen === 'title') {
      if (key === 'enter') startGame(true);
      return;
    }
    if (key === 'p' || key === 'escape') { togglePause(); return; }
    if (G.screen === 'pause') return;
    if (key === 'm') { toggleMap(); return; }
    if (G.screen === 'map') {
      if (key === 's') saveGame();
      return;
    }
    if (key === 'e') {
      // enter / exit the nearest car
      G.driving = !G.driving;
      if (G.driving) {
        G.world = G.liveWorld || G.world;
        if (G.world) G.world.playerCar = { x: G.px, y: 8, color: '#d21f2b', smoke: false };
        G.player = null;
        G.dialogKey = 'miraChase';
        showToast('roadblock', 2600);
      } else {
        G.player = { x: G.px, y: 26, shirt: '#e8590c' };
        if (G.world) G.world.playerCar = null;
        G.dialogKey = 'kiki';
      }
      applyHud();
      return;
    }
    if (key === 's' && !G.driving) { /* S saves only from map/pause in this build */ }
    if (key >= '1' && key <= '5') {
      var n = parseInt(key, 10);
      if (!D.weapons[n - 1].locked) { G.weapon = n; applyHud(); }
      return;
    }
    if (key === 'z') useCrew(0);
    if (key === 'x') useCrew(1);
    if (key === 'v') useCrew(2);
    if (key === ' ') { e.preventDefault(); }
  }
  function onKeyUp(e) { G.keys[(e.key || '').toLowerCase()] = false; }

  // ------------------------------------------------------------ boot
  function init() {
    // touch UI only on coarse-pointer devices, never in shot mode
    try {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        document.body.classList.add('touch-live');
      }
    } catch (e) { /* matchMedia unavailable */ }

    var params = new URLSearchParams(window.location.search || '');
    var shotParam = params.get('shot');
    if (shotParam !== null) {
      var n = parseInt(shotParam, 10);
      if (!(n >= 1 && n <= 4)) n = 1;
      document.body.classList.add('shot-mode');
      document.body.classList.remove('touch-live');
      var cfg = SHOTS.apply(n, G);
      var cv = $('scene');
      var ctx = cv.getContext('2d');
      if (cfg.screen === 'title') {
        showScreen('title');
        drawTitleSkyline(ctx);
      } else if (cfg.screen === 'map') {
        showScreen('map');
        render(ctx, 0);
      } else {
        showScreen('game');
        applyHud();
        render(ctx, 0);
      }
      document.title = 'Kota Seja — shot ' + n + ' (' + cfg.name + ')';
      window.__sejaReady = true;
      window.__sejaShot = n;
      return;
    }

    // live game
    G.liveWorld = genLiveWorld();
    G.world = G.liveWorld;
    G.player = { x: 50, y: 26, shirt: '#e8590c' };
    showScreen('title');
    var cv2 = $('scene');
    render(cv2.getContext('2d'), 0);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    var bind = function (id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); };
    bind('btnNew', function () { startGame(true); });
    bind('btnContinue', function () { startGame(false); });
    bind('btnControls', function () {
      var h = $('howto');
      if (h) h.innerHTML = '<h4>CONTROLS</h4><div>' + D.controls.map(function (c) {
        return '<b>' + c[0] + '</b> — ' + c[1];
      }).join('<br>') + '</div>';
    });
    bind('btnSettings', function () {
      var h = $('howto');
      if (h) h.innerHTML = '<h4>SETTINGS</h4><div>Radio: <b>' + D.radio[0].station + '</b><br>Hints: <b>' +
        D.hints[0] + '</b><br><br>' + D.hints.slice(1, 4).join('<br>') + '</div>';
    });
    bind('btnResume', function () { togglePause(); });
    bind('btnSave', function () { saveGame(); });
    bind('btnQuit', function () { G.paused = false; showScreen('title'); render($('scene').getContext('2d'), 0); });
    requestAnimationFrame(loop);
    window.__sejaReady = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
