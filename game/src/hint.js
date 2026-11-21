// hint.js — static data for Kota Seja: missions, crew, weapons, radio,
// districts, dialogue lines and control hints. Pure data, no rendering.
// Everything in English, matching the in-game HUD language.
(function () {
  'use strict';

  var DATA = {
    gameTitle: 'Kota Seja — Golden Hour Pursuit',
    city: 'Kota Seja',
    districts: [
      { name: 'PELABUHAN', road: 'Harbour Road', standing: 'FRIENDLY', quadrant: 'SW', color: '#2f9e44' },
      { name: 'NEON STRIP', road: 'Neon Boulevard', standing: 'NEUTRAL', quadrant: 'SE', color: '#5c5f7a' },
      { name: 'MARINA', road: 'Marina Walk', standing: 'WARY', quadrant: 'NW', color: '#e8590c' },
      { name: 'BUKIT HALCYON', road: 'Halcyon Rise', standing: 'NEUTRAL', quadrant: 'NE', color: '#5c5f7a' },
      { name: 'PALMERA STRAND', road: 'Beach Avenue', standing: 'FRIENDLY', quadrant: 'E', color: '#2f9e44' },
      { name: 'TAMAN SENJA', road: 'Sunset Park Lane', standing: 'NEUTRAL', quadrant: 'C', color: '#5c5f7a' }
    ],

    missions: [
      { id: 1, name: 'WARM WELCOME', title: 'MEET MIRA AT THE DOCKS', stage: '1/3', pct: 18, next: 'Reach the harbour — 96 m', story: '1/5' },
      { id: 2, name: 'FIRST WHEELS', title: 'STEAL THE NEON COUPE', stage: '2/3', pct: 41, next: 'Lose the patrol — 2 stars left', story: '1/5' },
      { id: 3, name: 'CHASE THE SUN', title: 'LOSE THE HEAT', stage: '2/3', pct: 62, next: 'Reach Sunset Park — 184 m', story: '2/5' },
      { id: 4, name: 'GOLD PAINT', title: 'HIT THE AZURA CONVOY', stage: '1/4', pct: 27, next: 'Ambush the convoy — 312 m', story: '3/5' },
      { id: 5, name: 'REVENGE', title: 'TAKE DOWN THE AZURA CREW', stage: '2/4', pct: 48, next: 'Drop the boss — 1 of 7 down', story: '4/5' }
    ],

    crew: [
      { name: 'SWAP PLATES', who: 'Mira · Driver', key: 'Z', icon: '🔁', state: 'READY' },
      { name: 'QUICK FIX', who: 'Lio · Mechanic', key: 'X', icon: '🔧', state: 'READY' },
      { name: 'EYES OUT', who: 'Kiki · Lookout', key: 'V', icon: '👁️', state: 'READY' }
    ],

    weapons: [
      { slot: 1, name: 'FISTS', icon: '👊', ammo: '∞' },
      { slot: 2, name: 'KNIFE', icon: '🔪', ammo: '∞' },
      { slot: 3, name: 'PISTOL', icon: '🔫', ammo: '60 / 120' },
      { slot: 4, name: 'SMG', icon: '💥', ammo: '30 / 60' },
      { slot: 5, name: 'SHOTGUN', icon: '💣', ammo: 'LOCKED', locked: true }
    ],

    // SBPD dispatch units: name, tactical role, distance in metres.
    dispatchChase: [
      { name: 'KITE-1', role: 'RAMMING', cls: 'role-ram', dist: 7 },
      { name: 'FOOT-1', role: 'MARKSMAN', cls: 'role-mar', dist: 9 },
      { name: 'CORAL-48', role: 'FLANKING', cls: 'role-fla', dist: 14 },
      { name: 'MARLIN-3', role: 'PURSUIT', cls: 'role-pur', dist: 15 },
      { name: 'AIR ONE', role: 'SPOTLIGHT', cls: 'role-spo', dist: 17 },
      { name: 'ROADBLOCK', role: 'ROADBLOCK', cls: 'role-rdb', dist: 41 },
      { name: 'GULL-2', role: 'SEARCHING', cls: 'role-sea', dist: 88 },
      { name: 'TIDE-7', role: 'ROADBLOCK', cls: 'role-rdb', dist: 187 }
    ],
    dispatchOnFoot: [
      { name: 'FOOT-1', role: 'MARKSMAN', cls: 'role-mar', dist: 9 },
      { name: 'KITE-1', role: 'RAMMING', cls: 'role-ram', dist: 12 },
      { name: 'FOOT-2', role: 'PURSUIT', cls: 'role-pur', dist: 17 },
      { name: 'MARLIN-3', role: 'FLANKING', cls: 'role-fla', dist: 44 },
      { name: 'FOOT-3', role: 'SEARCHING', cls: 'role-sea', dist: 63 },
      { name: 'CORAL-48', role: 'PURSUIT', cls: 'role-pur', dist: 121 }
    ],

    radio: [
      { station: 'SEJA FM — Funk 98.1', track: 'Sunset Drive — The Palms' },
      { station: 'LAGOON FM — Island Pop 101.8', track: 'Golden Hour — Marina Blue' },
      { station: 'NEON FM — Synth 104.4', track: 'Night Strip — Chrome Hearts' }
    ],

    dialogues: {
      miraChase: {
        name: 'MIRA KESANG · CREW · DRIVER', avatar: '👩',
        text: 'Air One is right over us — punch it down Beach Avenue and don\u2019t stop for the roadblock!'
      },
      vance: {
        name: 'CAPT. VANCE · SBPD DISPATCH', avatar: '👮',
        text: 'All units, suspect is heading for Sunset Park. Box him in at the beachfront — do not let him reach the pier.'
      },
      azuraBoss: {
        name: 'AZURA BOSS · SYNDICATE', avatar: '😠',
        text: 'Rico Vega. You picked the wrong harbour — my crew will bury you here.'
      },
      lio: {
        name: 'LIO · CREW · MECHANIC', avatar: '🧑‍🔧',
        text: 'Your coupe is held together with hope and duct tape. Bring it by the garage and I will make it sing.'
      },
      kiki: {
        name: 'KIKI · CREW · LOOKOUT', avatar: '🕵️',
        text: 'Eyes out: two SBPD units on Neon Boulevard, one more circling the marina. You have a gap — take it.'
      }
    },

    toasts: {
      roadblock: '\u26A0 ROADBLOCK AHEAD — SBPD units converging on Beach Avenue',
      shotsFired: '\u26A0 SHOTS FIRED — Harbour Road · SBPD responding',
      vehicleStolen: 'VEHICLE STOLEN: NEON COUPE — A witness called the SBPD',
      saved: '✔ GAME SAVED — Slot 1 · 61% complete',
      missionPassed: '✔ MISSION PASSED — +$2,500 · +500 RP'
    },

    garage: {
      owned: ['SEJA GT', 'NEON COUPE', 'MARINA SEDAN'],
      upgrades: [
        { name: 'ARMOR PLATING', price: '$1,200' },
        { name: 'ENGINE TUNE', price: '$2,500' },
        { name: 'NEON PAINT', price: '$400' }
      ]
    },

    career: [
      { k: 'STORY MISSIONS', v: '3 / 5' },
      { k: 'SIDE JOBS', v: '5 TYPES' },
      { k: 'WEAPONS', v: '5' },
      { k: 'DISTRICTS', v: '4' },
      { k: 'RADIO STATIONS', v: '3' },
      { k: 'VEHICLES OWNED', v: '3' },
      { k: 'STORY', v: '3/5' },
      { k: 'COMPLETE', v: '61%' }
    ],

    hints: [
      'WASD or arrow keys move. E enters or exits a car.',
      'Press M for the map, garage and career stats.',
      'Z, X and V fire crew abilities when they read READY.',
      'Wanted stars only drop when no police unit can see you.',
      'Save often: P pauses, S saves to slot 1.',
      'The beach road is the fastest escape — but Air One watches it.'
    ],

    controls: [
      ['W A S D / Arrows', 'Walk / drive'],
      ['E', 'Enter or exit car'],
      ['Space', 'Attack / fire'],
      ['1 – 5', 'Switch weapon'],
      ['Z / X / V', 'Crew abilities'],
      ['M', 'Map & garage'],
      ['S', 'Save game'],
      ['P / Esc', 'Pause']
    ]
  };

  window.SEJA_DATA = DATA;
})();
