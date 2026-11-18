// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a tiny autopilot (drive toward the objective, keep on the road),
// so the frame is what a short game really looks like — and the same seed
// always gives the same frame (the world's RNG is seeded).
import { HQ_STREET } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const STEP = 1 / 60;

const IDLE = { keys: new Set(), pressed: new Set(), mouseDX: 0, mouseDY: 0, firing: false, aiming: false };

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Drive input toward (tx, tz): W always, steer toward the target bearing. */
function driveInput(world, tx, tz) {
  const car = world.playerCar();
  const keys = new Set(['KeyW']);
  if (car) {
    const want = Math.atan2(tx - car.x, tz - car.z);
    const diff = wrapAngle(want - car.angle);
    if (diff > 0.18) keys.add('KeyA');
    else if (diff < -0.18) keys.add('KeyD');
  }
  return { keys, pressed: new Set(), mouseDX: 0, mouseDY: 0, firing: false, aiming: false };
}

function runSteps(world, seconds, inputFn) {
  const events = [];
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    world.step(STEP, inputFn ? inputFn(i) : IDLE, events);
    events.length = 0;
  }
}

function uiFor(world) {
  return { currentStage: world.currentStageText(), endInfo: null, saveLine: '' };
}

/**
 * Set `world` to the named scene and return the screen, UI and sim time to draw.
 * start: title over the living city. drive: mission 1 delivery in a sports car.
 * chase: wanted 3 stars, police pursuit. mission: final mission, wave 2, shotgun out.
 */
export function stageShot(name, world) {
  const s = world.state;
  if (name === 'drive') {
    world.startMission(1, []);
    const car = s.cars.find((c) => c.model === 'sport' && c.parked) || s.cars[0];
    // Straight run west along the z=-150 road into the sunset — no turns,
    // no buildings in the way, HQ street is on this same road.
    car.x = 100; car.z = -150; car.angle = -Math.PI / 2;
    s.player.x = car.x; s.player.z = car.z;
    world.enterCar(car, []);
    s.cam.yaw = Math.PI / 2; // camera behind the car, looking west at the sun
    runSteps(world, 7, () => driveInput(world, HQ_STREET.x, HQ_STREET.z));
    // Two pedestrians mid-crossing on the zebra ahead (staged after the run
    // so they are frozen in frame at the shutter).
    const driven = world.playerCar();
    const aheadX = (driven ? driven.x : 0) - 22;
    [[0, 0], [1, -3]].forEach(([i, dz], k) => {
      const ped = s.peds[i];
      ped.x = aheadX - k * 7; ped.z = -150 + dz; ped.angle = Math.PI / 2; ped.dead = false;
      ped.target = { x: ped.x, z: ped.z };
    });
    return { screen: SCREEN_PLAY, ui: uiFor(world), time: 7 };
  }
  if (name === 'chase') {
    world.startMission(6, []);
    // A sedan (slower than the sport car) runs east along the z=0 road for
    // 5 s, so the police roadblock staged far ahead is still in front of it
    // — and in frame — when the shutter fires. The blockers are real police
    // entries: they turn and give chase the moment the run starts.
    const car = s.cars.find((c) => c.model === 'sedan' && c.parked) || s.cars[0];
    car.x = -150; car.z = 0; car.angle = Math.PI / 2;
    s.player.x = car.x; s.player.z = car.z;
    world.enterCar(car, []);
    // The blockers must start within the 160 m police despawn radius of the
    // player, and the run must be short (3 s) so they are still ahead — in
    // frame — when the shutter fires instead of already behind the camera.
    for (const [px, pz] of [[-60, 2], [-40, -2]]) {
      const pc = { id: s.cars.length, model: 'sedan', color: 0x1c2f6e, x: px, z: pz, angle: -Math.PI / 2, speed: 0, parked: false, traffic: false, damage: 0, axis: 'x', dir: -1, target: null, hp: 120 };
      s.cars.push(pc);
      s.police.push({ kind: 'car', x: px, z: pz, angle: -Math.PI / 2, speed: 0, hp: 120, carId: pc.id, arrest: 0 });
    }
    s.heat = 70; s.wanted = 3; s.lastCrime = 0;
    s.weapons.cur = 1;
    s.cam.yaw = -Math.PI / 2 + 0.35; // behind the car, slight side angle
    runSteps(world, 2.5, (i) => {
      const inp = driveInput(world, 150, 0);
      inp.firing = i % 40 < 3; // a few shots during the chase
      return inp;
    });
    return { screen: SCREEN_PLAY, ui: uiFor(world), time: 2.5 };
  }
  if (name === 'mission') {
    world.startMission(8, []);
    const m = s.mission;
    m.stageState = { wave: 2, spawned: 0, left: 0 };
    // Stage on the open z=50 road facing east toward the docks — the old
    // spot put the camera inside a warehouse footprint, which hid Rico.
    s.player.x = 170; s.player.z = 50;
    s.player.angle = Math.PI / 2; // facing the docks
    s.cam.yaw = Math.PI / 2 + Math.PI; // behind the player, cops in frame ahead
    s.weapons.owned = [true, true, true, true];
    s.weapons.cur = 3; s.weapons.ammo = [Infinity, 12, 30, 6]; s.weapons.reserve = [Infinity, 72, 150, 30];
    s.health = 82; s.armour = 60;
    s.heat = 130; s.wanted = 5; s.lastCrime = 0;
    s.money = 12400;
    runSteps(world, 3, () => IDLE);
    // Crowd the frame: dock workers + bystanders on the road ahead of
    // the player (facing back toward the camera) and two foot cops closing
    // in — staged after the run so they are frozen in frame at the shutter.
    const crowd = [
      [185, 45, -Math.PI / 2], [195, 55, -Math.PI / 2],
      [188, 58, -Math.PI / 2], [205, 48, -Math.PI / 2],
    ];
    crowd.forEach(([cx, cz, ca], i) => {
      const ped = s.peds[i];
      ped.x = cx; ped.z = cz; ped.angle = ca; ped.dead = false;
      ped.target = { x: cx, z: cz };
    });
    s.police.filter((c) => c.kind === 'foot').slice(0, 2).forEach((cop, i) => {
      cop.x = 195 + i * 10; cop.z = 50 + i * 5; cop.angle = -Math.PI / 2;
    });
    return { screen: SCREEN_PLAY, ui: uiFor(world), time: 3 };
  }
  // start (default): title screen over the living city at sunset.
  // Vantage on the beachfront road, looking west into the sun + skyline.
  s.player.x = 0; s.player.z = 100;
  s.cam.yaw = Math.PI / 2;
  runSteps(world, 5, () => IDLE);
  return { screen: SCREEN_TITLE, ui: uiFor(world), time: 5 };
}
