// shots.js — deterministic staging for the four ?shot=N captures.
// Each shot is a plain config: which screen to show, where the camera sits,
// which world objects exist, and exactly what every HUD field reads.
// No randomness here: the same shot number always stages the same frame.
// The live game (no ?shot=) never calls this file's staging.
(function () {
  'use strict';

  // Shared chase HUD values (rank 1 template: dense, canonical).
  var CHASE_HUD = {
    cash: '$18,450', clock: 'FRI 17:25',
    mission: 3, stage: '2/3', pct: 62, next: 'Reach Sunset Park — 184 m', story: '2/5',
    rank: 'RANK 3 · HUSTLER', rp: '3,900 / 5,000 RP', rpPct: 78, wanted: 4,
    district: 'PALMERA STRAND', road: 'Beach Avenue',
    health: 86, armor: 55,
    speed: 111, car: 'NEON COUPE', cond: 62, condLabel: 'CONDITION 62% · DENTED',
    radio: 0, weapon: 4,
    statusLine: 'IN SIGHT — SEARCH ZONE 31 M'
  };

  var ONFOOT_HUD = {
    cash: '$8,640', clock: 'FRI 17:41',
    mission: 5, stage: '2/4', pct: 48, next: 'Drop the boss — 1 of 7 down', story: '4/5',
    rank: 'RANK 4 · FIXER', rp: '5,200 / 10,000 RP', rpPct: 52, wanted: 3,
    district: 'PELABUHAN', road: 'Harbour Road',
    health: 92, armor: 45,
    speed: 0, car: '', cond: 0, condLabel: '',
    radio: 1, weapon: 4,
    statusLine: 'IN SIGHT'
  };

  // World objects are placed in "street space": x is metres across the road
  // (0 = left kerb, 100 = right kerb), y is metres ahead of the camera.
  // The renderer projects them onto the 1280x720 canvas.
  var SHOTS = {
    1: {
      name: 'chase',
      screen: 'game', driving: true, hud: CHASE_HUD,
      toast: 'roadblock', dialog: 'miraChase',
      camera: { x: 50, y: 0, zoom: 1.0 },
      world: {
        heli: { x: 78, y: 150, altitude: 1.0, spotlight: true },
        police: [
          { x: 28, y: 54, color: '#101418', lights: 'A' },
          { x: 50, y: 76, color: '#141a20', lights: 'B' },
          { x: 72, y: 62, color: '#101418', lights: 'A' }
        ],
        roadblock: [
          { x: 30, y: 128, angle: -0.6, color: '#101418' },
          { x: 62, y: 132, angle: 0.6, color: '#141a20' }
        ],
        playerCar: { x: 50, y: 40, color: '#d21f2b', smoke: true },
        smokePuffs: [{ x: 44, y: 34 }, { x: 56, y: 32 }, { x: 50, y: 36 }],
        palms: [8, 20, 33, 46, 59, 72, 85, 94],
        beach: true, shops: ['HOTEL AZURA', 'PALM CAFE', 'SEJA SURF'],
        pedestrians: [{ x: 18, y: 40 }, { x: 88, y: 90 }],
        traffic: [{ x: 24, y: 100, color: '#2b6cb0' }, { x: 76, y: 110, color: '#b7791f' }]
      }
    },
    2: {
      name: 'onfoot',
      screen: 'game', driving: false, hud: ONFOOT_HUD,
      toast: 'shotsFired', dialog: 'azuraBoss',
      camera: { x: 50, y: 0, zoom: 1.3 },
      world: {
        heli: null,
        police: [{ x: 90, y: 46, color: '#101418', lights: 'A' }],
        roadblock: [],
        playerCar: null,
        player: { x: 46, y: 22, shirt: '#e8590c' },
        crew: [
          { x: 58, y: 30, suit: '#1a1a22' },
          { x: 62, y: 34, suit: '#22222c' },
          { x: 52, y: 36, suit: '#1a1a22' }
        ],
        parkedCar: { x: 90, y: 40, color: '#0f766e' },
        palms: [12, 88],
        beach: false, shops: ['HARBOUR MARKET', 'AZURA CLUB'],
        pedestrians: [{ x: 22, y: 55 }],
        traffic: []
      }
    },
    3: {
      name: 'map',
      screen: 'map', driving: false, hud: CHASE_HUD,
      toast: null, dialog: null,
      camera: { x: 50, y: 0, zoom: 1.0 },
      world: null
    },
    4: {
      name: 'title',
      screen: 'title', driving: false, hud: CHASE_HUD,
      toast: null, dialog: null,
      camera: { x: 50, y: 0, zoom: 1.0 },
      world: null
    }
  };

  // Apply one shot config onto the live game object G (from game.js).
  // Returns the config so game.js can render from it.
  function applyShot(n, G) {
    var cfg = SHOTS[n] || SHOTS[1];
    var D = window.SEJA_DATA;
    var hud = cfg.hud;
    var mission = null;
    for (var i = 0; i < D.missions.length; i++) {
      if (D.missions[i].id === hud.mission) mission = D.missions[i];
    }
    G.shot = n;
    G.shotName = cfg.name;
    G.screen = cfg.screen;
    G.driving = cfg.driving;
    G.frozen = true; // freeze every animation: wheels, gulls, rotor, timers
    G.clockText = hud.clock;
    G.cash = hud.cash;
    G.mission = mission;
    G.missionStage = hud.stage;
    G.missionPct = hud.pct;
    G.missionNext = hud.next;
    G.storyDone = hud.story;
    G.rankLabel = hud.rank;
    G.rpLabel = hud.rp;
    G.rpPct = hud.rpPct;
    G.wanted = hud.wanted;
    G.district = hud.district;
    G.roadName = hud.road;
    G.health = hud.health;
    G.armor = hud.armor;
    G.speed = hud.speed;
    G.carName = hud.car;
    G.carCond = hud.cond;
    G.carCondLabel = hud.condLabel;
    G.radioIdx = hud.radio;
    G.weapon = hud.weapon;
    G.statusLine = hud.statusLine;
    G.dispatch = (n === 2) ? D.dispatchOnFoot : D.dispatchChase;
    G.toastKey = cfg.toast;
    G.dialogKey = cfg.dialog;
    G.camera = { x: cfg.camera.x, y: cfg.camera.y, zoom: cfg.camera.zoom };
    G.world = cfg.world;
    G.player = cfg.world && cfg.world.player ? cfg.world.player : null;
    return cfg;
  }

  function shotCount() { return 4; }

  window.SEJA_SHOTS = { list: SHOTS, apply: applyShot, count: shotCount };
})();
