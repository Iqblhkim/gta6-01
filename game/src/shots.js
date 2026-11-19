// Kota Seja — staged scenes for screenshots.
// ?shot=start|drive|chase|mission (with &seed=1 for determinism) drives
// the game straight into a composed scene so the screenshots show the
// city, the HUD, the minimap and a mission at once. This only ever runs
// when the page is opened with a ?shot= query; normal play is untouched.
// Round 7 (2026-11-19): the scenes now prove the round-7 features
// too — the start scene is a bright MORNING (07:30) so the new
// day/night cycle, the thin zebra crossings and the sidewalks read
// clearly, and the drive scene is at NIGHT (21:00) with the
// headlights on, neon lit and stars out, so the night lighting,
// headlight pools and the landmark tower show in 2-drive.jpg.
import { startMission, enterCar, addWanted, spawnPolice } from './world.js';
import { dayPhaseAt } from './config.js';

export const SHOT_SCENES = ['start', 'drive', 'chase', 'mission'];

export function applyShot(world, name) {
  const city = world.city;
  const p = world.player;
  world.screen = 'playing';
  if (name === 'start') {
    // Rico on foot by the hideout in the morning, a taxi rolling past.
    // Round 7: morning (07:30) — bright sky, thin zebra crossings and
    // sidewalks visible at the intersection behind him.
    world.clockHours = 7.5;
    world.dayPhase = dayPhaseAt(world.clockHours);
    p.x = city.hideout.x + 4; p.z = city.hideout.z + 14;
    p.angle = Math.PI * 0.9;
    world.cameraYaw = Math.PI * 1.05;
    world.cameraPitch = 0.25;
    startMission(world);
    world.message = 'MISSION 1/8 — FRESH AIR: Steal any car';
    world.messageTimer = 30;
    world.radio = 'Radio: "Rico, this is Seja. Get yourself some wheels."';
    world.radioTimer = 30;
  } else if (name === 'drive') {
    // Rico driving a red sport car east along the beachfront road.
    // Round 7: NIGHT (21:00) with the headlights on — neon, stars,
    // lit windows and the headlight pools ahead of the car, plus the
    // landmark tower on the skyline, all in 2-drive.jpg.
    world.clockHours = 21;
    world.dayPhase = dayPhaseAt(world.clockHours);
    world.settings.lights = 'on';
    const car = world.cars.find((c) => c.model === 'sport') ?? world.cars[0];
    car.x = -26; car.z = 130; car.angle = Math.PI / 2; car.speed = 18;
    car.color = '#d94f3d';
    enterCar(world, car);
    // Stealing on camera is fine here: the shot is staged, keep wanted low.
    world.wanted = 0;
    world.cameraYaw = Math.PI / 2;
    world.cameraPitch = 0.3;
    startMission(world);
    world.mission.stage = 1;
    world.message = 'MISSION 1/8 — FRESH AIR: Drive the car to the hideout';
    world.messageTimer = 30;
    world.money = 750;
  } else if (name === 'chase') {
    // A three-star chase on an open intersection: patrol cars and foot
    // cops closing in, the player car rolling south down the avenue.
    const car = world.cars.find((c) => c.model === 'sedan' && c.owner !== 'police') ?? world.cars[0];
    car.x = 26; car.z = -26; car.angle = 0; car.speed = 20;
    enterCar(world, car);
    world.wanted = 0;
    addWanted(world, 3, 'The police are on you — lose them!');
    spawnPolice(world);
    world.cameraYaw = 0;
    world.cameraPitch = 0.3;
    startMission(world);
    world.mission.stage = 1;
    world.money = 1250;
    world.message = 'WANTED ★★★ — patrol cars are ramming you!';
    world.messageTimer = 30;
    world.radio = 'Radio: "All units, suspect heading Downtown. Do not let him through."';
    world.radioTimer = 30;
  } else if (name === 'mission') {
    // Mission 6, the sunset race: Rico on the east-west avenue at (26, 78),
    // facing west toward checkpoint 1, rivals lined up just behind him.
    world.mission.index = 5;
    startMission(world);
    const car = world.cars.find((c) => c.model === 'sport') ?? world.cars[0];
    car.x = 26; car.z = 78; car.angle = -Math.PI / 2; car.speed = 22;
    car.color = '#f2c14e';
    enterCar(world, car);
    world.rivals.forEach((r, i) => {
      r.x = 40 + i * 6; r.z = 78; r.angle = -Math.PI / 2; r.speed = 10;
    });
    world.wanted = 0;
    world.money = 3400;
    world.respect = 62;
    world.player.armour = 50;
    world.cameraYaw = -Math.PI / 2;
    world.cameraPitch = 0.28;
    world.message = 'MISSION 6/8 — SUNSET RUN: Hit checkpoint 1/3 before the rivals';
    world.messageTimer = 30;
    world.radio = 'Radio: "Three checkpoints, two rivals. Make Seja proud, Rico."';
    world.radioTimer = 30;
  }
  // A few pedestrians near the camera on the on-foot scene only, so the
  // driving scenes do not start by running them over.
  if (name === 'start') {
    for (let i = 0; i < 6; i++) {
      const pd = world.peds[i];
      if (!pd) break;
      pd.x = p.x + Math.sin(i * 1.1) * (6 + i);
      pd.z = p.z + Math.cos(i * 1.1) * (6 + i);
    }
  }
}

// Round 7 complete (2026-11-19): start scene at 07:30 (morning) and
// drive scene at 21:00 with headlights on (night) — the new
// day/night cycle, zebra, sidewalks, neon and headlights show in the
// screenshots. Scenes unchanged otherwise (start/drive/chase/mission).
