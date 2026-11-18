// SOLANO CITY simulation: the player on foot and in cars, traffic and
// pedestrians, a wanted level with police who respond, three story
// missions, and combat. Pure logic — no DOM, no audio — so the unit
// tests can drive it in Node.

import { createCity, districtAt, roadX, roadY } from './city.js';
import { createRandom } from './random.js';
import {
  STEP,
  WORLD_W,
  WORLD_H,
  COLS,
  ROWS,
  ROAD_SPACING,
  ROAD_ORIGIN,
  ROAD_HALF,
  WALK_SPEED,
  RUN_SPEED,
  CAR_ACCEL,
  CAR_BRAKE,
  CAR_MAX_SPEED,
  CAR_REVERSE_MAX,
  CAR_TURN,
  TRAFFIC_SPEED,
  POLICE_SPEED,
  COP_SPEED,
  PLAYER_HEALTH,
  MAG_SIZE,
  RESERVE_AMMO,
  BULLET_SPEED,
  BULLET_DAMAGE,
  ENEMY_BULLET_DAMAGE,
  SHOOT_COOLDOWN,
  WANTED_MAX,
  WANTED_COOL_AFTER,
  WANTED_DECAY_EVERY,
  START_CASH,
} from './config.js';

// The three story missions. Rico Vega owes $50,000; these jobs pay it down.
export const MISSION_DEFS = [
  {
    name: 'The Getaway',
    reward: 500,
    timer: 150,
    briefing: 'Steal the getaway sedan, then drive it to the drop-off in Old Town.',
  },
  {
    name: 'The Package',
    reward: 800,
    timer: 180,
    briefing: 'Pick up the package in Northgate and deliver it to the Harbor — the cops will notice.',
  },
  {
    name: 'Harbor Showdown',
    reward: 1500,
    timer: 300,
    briefing: 'Meet the crew at the docks. It is a trap — clear the ambush and get out.',
  },
];

const GETAWAY_SPOT = { x: 560, y: 566 };
const PLAYER_SPAWN = { x: 700, y: 560 };
const ENTER_RANGE = 130;
const CAR_COLORS = ['#d8d3c8', '#c94f42', '#4a7fb5', '#c9a227', '#5a6b52', '#8a6fb5', '#3d3d3d', '#e0e0e0'];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function turnToward(angle, target, maxStep) {
  let d = target - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return angle + clamp(d, -maxStep, maxStep);
}

// Push a circle out of every building rectangle it overlaps.
// Returns true when a wall was hit.
function pushOutOfBuildings(p, r, buildings) {
  let hit = false;
  for (const b of buildings) {
    const cx = clamp(p.x, b.x, b.x + b.w);
    const cy = clamp(p.y, b.y, b.y + b.h);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
    } else {
      p.y = b.y - r;
    }
  }
  return hit;
}

function freshState(city, rng) {
  const cars = [];
  // The getaway sedan: parked on the Northgate road, free to take,
  // and the car mission 1 asks for.
  cars.push({
    id: 'getaway', kind: 'player', x: GETAWAY_SPOT.x, y: GETAWAY_SPOT.y,
    angle: 0, speed: 0, health: 100, color: '#c94f42', wrecked: false,
  });
  // A few more parked cars around the city, free to take.
  const parkedSpots = [
    { x: 2000, y: 960 }, { x: 2600, y: 2160 }, { x: 1000, y: 2160 }, { x: 3000, y: 960 },
  ];
  parkedSpots.forEach((s, i) => {
    cars.push({
      id: `parked-${i}`, kind: 'player', x: s.x, y: s.y,
      angle: rng.range(0, Math.PI * 2), speed: 0, health: 100,
      color: CAR_COLORS[(i + 2) % CAR_COLORS.length], wrecked: false,
    });
  });
  // Fourteen traffic cars, spread over the road grid, kept away from
  // the getaway sedan so the player always steals that one first.
  const trafficSpots = [];
  let guard = 0;
  while (trafficSpots.length < 14 && guard < 400) {
    guard += 1;
    const col = rng.int(COLS);
    const row = rng.int(ROWS);
    const x = roadX(col);
    const y = roadY(row);
    if (dist(x, y, GETAWAY_SPOT.x, GETAWAY_SPOT.y) < 350) continue;
    if (trafficSpots.some((s) => dist(x, y, s.x, s.y) < 160)) continue;
    trafficSpots.push({ x, y });
  }
  trafficSpots.forEach((s, i) => {
    const nodeId = rng.int(COLS * ROWS);
    cars.push({
      id: `traffic-${i}`, kind: 'traffic', x: s.x, y: s.y,
      angle: rng.range(0, Math.PI * 2), speed: TRAFFIC_SPEED,
      health: 40, color: CAR_COLORS[i % CAR_COLORS.length],
      wrecked: false, node: nodeId, from: -1,
    });
  });
  // Twenty-six pedestrians on the sidewalks.
  const peds = [];
  for (let i = 0; i < 26; i += 1) {
    const horizontal = rng.next() < 0.5;
    const col = rng.int(COLS);
    const row = rng.int(ROWS);
    const along = rng.range(120, WORLD_W - 120);
    const side = rng.next() < 0.5 ? -1 : 1;
    const x = horizontal ? along : roadX(col) + side * (ROAD_HALF + 16);
    const y = horizontal ? roadY(row) + side * (ROAD_HALF + 16) : along;
    peds.push({
      x: clamp(x, 60, WORLD_W - 60), y: clamp(y, 60, WORLD_H - 60),
      angle: rng.range(0, Math.PI * 2), speed: 0, tx: 0, ty: 0, flee: 0,
      shirt: rng.pick(['#e8e4d8', '#7fb069', '#e07a5f', '#81b29a', '#f2cc8f']),
    });
  }

  return {
    city,
    player: {
      x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, angle: 0,
      onFoot: true, carId: null, health: PLAYER_HEALTH, invuln: 0,
    },
    cars,
    peds,
    police: [],
    cops: [],
    enemies: [],
    bullets: [],
    particles: [],
    skids: [],
    wanted: 0,
    lastCrime: -9999,
    elapsed: 0,
    clock: 8 * 3600,
    coolTimer: 0,
    spawnTimer: 0,
    copTimer: 0,
    cash: START_CASH,
    missionsDone: 0,
    mission: { index: 0, active: false, stage: 'idle', timer: 0, target: null },
    status: 'play',
    ammo: MAG_SIZE,
    reserve: RESERVE_AMMO,
    kills: 0,
    shootCooldown: 0,
    banner: null,
    rng,
  };
}

export function createWorld(seed) {
  const rng = createRandom(seed * 7919 + 13);
  const city = createCity(createRandom(seed * 104729 + 5));
  let state = freshState(city, rng);

  const world = {
    get state() {
      return state;
    },

    reset() {
      const fresh = freshState(city, createRandom(seed * 7919 + 13));
      state = fresh;
    },

    district() {
      return districtAt(state.player.x, state.player.y);
    },

    playerCar() {
      if (state.player.carId === null) return null;
      return state.cars.find((c) => c.id === state.player.carId) ?? null;
    },

    addWanted(n) {
      state.wanted = Math.min(WANTED_MAX, state.wanted + n);
      state.lastCrime = state.elapsed;
      state.coolTimer = 0;
    },

    enterCar() {
      const p = state.player;
      if (!p.onFoot) return false;
      let best = null;
      let bestD = ENTER_RANGE;
      for (const c of state.cars) {
        if (c.wrecked) continue;
        const d = dist(p.x, p.y, c.x, c.y);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      // During the getaway stage the sedan is the job: take it even
      // if a traffic car happens to sit a little closer.
      if (state.mission.active && state.mission.stage === 'getCar') {
        const sedan = state.cars.find((c) => c.id === 'getaway');
        if (sedan && !sedan.wrecked && dist(p.x, p.y, sedan.x, sedan.y) < ENTER_RANGE) {
          best = sedan;
        }
      }
      if (!best) return false;
      p.onFoot = false;
      p.carId = best.id;
      p.x = best.x;
      p.y = best.y;
      p.angle = best.angle;
      if (best.kind === 'traffic') {
        this.addWanted(1);
        this.flash('Car stolen — the cops are coming');
      }
      if (state.mission.active && state.mission.stage === 'getCar' && best.id === 'getaway') {
        state.mission.stage = 'drive';
        state.mission.target = { x: 1160, y: 840, label: 'Drop-off' };
        this.flash('Getaway car taken', 'Drive to the drop-off in Old Town');
      }
      return true;
    },

    exitCar() {
      const p = state.player;
      if (p.onFoot) return false;
      const car = this.playerCar();
      if (car) {
        car.speed *= 0.3;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
        p.angle = car.angle;
      }
      p.onFoot = true;
      p.carId = null;
      return true;
    },

    startMission() {
      const m = state.mission;
      if (m.active) return false;
      if (m.index >= MISSION_DEFS.length) return false;
      const def = MISSION_DEFS[m.index];
      m.active = true;
      m.timer = def.timer;
      if (m.index === 0) {
        m.stage = 'getCar';
        m.target = { x: GETAWAY_SPOT.x, y: GETAWAY_SPOT.y, label: 'Getaway sedan' };
      } else if (m.index === 1) {
        m.stage = 'pickup';
        m.target = { x: 2760, y: 520, label: 'Pickup' };
      } else {
        m.stage = 'goto';
        m.target = { x: 840, y: 1840, label: 'The docks' };
      }
      this.flash(`${def.name}`, def.briefing);
      return true;
    },

    reload() {
      if (state.ammo >= MAG_SIZE || state.reserve <= 0) return false;
      const need = MAG_SIZE - state.ammo;
      const take = Math.min(need, state.reserve);
      state.ammo += take;
      state.reserve -= take;
      return true;
    },

    shoot(tx, ty) {
      const p = state.player;
      if (!p.onFoot) return false;
      if (state.shootCooldown > 0 || state.ammo <= 0) return false;
      state.ammo -= 1;
      state.shootCooldown = SHOOT_COOLDOWN;
      const a = angleTo(p.x, p.y, tx, ty);
      state.bullets.push({
        x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
        vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED,
        life: 1.2, from: 'player', damage: BULLET_DAMAGE,
      });
      p.angle = a;
      // Firing a gun is a crime: the heat clock restarts, though the
      // noise alone is not another star.
      state.lastCrime = state.elapsed;
      return true;
    },

    flash(text, sub = '') {
      state.banner = { text, sub, t: 4 };
    },

    step(dt, input = {}) {
      const s = state;
      if (s.status !== 'play') return;
      s.elapsed += dt;
      s.clock = (s.clock + dt) % 86400;
      s.shootCooldown = Math.max(0, s.shootCooldown - dt);
      s.player.invuln = Math.max(0, s.player.invuln - dt);
      if (s.banner) {
        s.banner.t -= dt;
        if (s.banner.t <= 0) s.banner = null;
      }

      this.stepPlayer(dt, input);
      this.stepTraffic(dt);
      this.stepPeds(dt);
      this.stepPolice(dt);
      this.stepEnemies(dt);
      this.stepBullets(dt);
      this.stepMission(dt);
      this.stepWanted(dt);

      // Particles and skid marks fade out.
      s.particles = s.particles.filter((pt) => (pt.life -= dt) > 0);
      for (const pt of s.particles) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
      }
      s.skids = s.skids.filter((k) => (k.life -= dt) > 0);
    },

    stepPlayer(dt, input) {
      const s = state;
      const p = s.player;
      if (p.onFoot) {
        let dx = 0;
        let dy = 0;
        if (input.up) dy -= 1;
        if (input.down) dy += 1;
        if (input.left) dx -= 1;
        if (input.right) dx += 1;
        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy);
          const speed = input.run ? RUN_SPEED : WALK_SPEED;
          p.x += (dx / len) * speed * dt;
          p.y += (dy / len) * speed * dt;
          p.angle = Math.atan2(dy, dx);
        }
        p.x = clamp(p.x, 24, WORLD_W - 24);
        p.y = clamp(p.y, 24, WORLD_H - 24);
        pushOutOfBuildings(p, 14, s.city.buildings);
        return;
      }
      const car = this.playerCar();
      if (!car || car.wrecked) return;
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      const moving = Math.abs(car.speed) > 12;
      if (moving) {
        car.angle += steer * CAR_TURN * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 120, 0.25, 1);
      }
      if (input.up) car.speed += CAR_ACCEL * dt;
      else if (input.down) {
        car.speed -= (car.speed > 0 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
      } else {
        car.speed -= car.speed * 0.6 * dt;
      }
      car.speed = clamp(car.speed, -CAR_REVERSE_MAX, CAR_MAX_SPEED);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 24, WORLD_W - 24);
      car.y = clamp(car.y, 24, WORLD_H - 24);
      const hitWall = pushOutOfBuildings(car, 17, s.city.buildings);
      if (hitWall && Math.abs(car.speed) > 90) {
        car.health -= 6;
        car.speed *= 0.45;
        this.sparks(car.x, car.y, 8);
      } else if (hitWall) {
        car.speed *= 0.6;
      }
      // Hard cornering leaves skid marks.
      if (Math.abs(steer) > 0 && Math.abs(car.speed) > 230) {
        s.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 5 });
        if (s.skids.length > 120) s.skids.shift();
      }
      // Bumping other cars: a traffic car shoved from behind speeds
      // away, so the player is slowed but rarely stopped dead.
      for (const other of s.cars) {
        if (other === car || other.wrecked) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d < 44 && d > 0.01) {
          const nx = (other.x - car.x) / d;
          const ny = (other.y - car.y) / d;
          const overlap = 44 - d;
          other.x += nx * overlap * 0.6;
          other.y += ny * overlap * 0.6;
          car.x -= nx * overlap * 0.4;
          car.y -= ny * overlap * 0.4;
          if (Math.abs(car.speed) > 120) {
            other.health -= 8;
            car.speed *= 0.85;
            if (other.kind === 'traffic') other.speed = Math.max(other.speed, 210);
            this.sparks(car.x, car.y, 5);
          }
          if (other.health <= 0) other.wrecked = true;
        }
      }
      if (car.health <= 30 && car.health > 0 && s.elapsed % 0.4 < dt) {
        this.smoke(car.x, car.y);
      }
      if (car.health <= 0 && !car.wrecked) {
        car.wrecked = true;
        car.speed = 0;
        this.sparks(car.x, car.y, 20);
        this.exitCar();
        this.flash('Car wrecked', 'Find another ride');
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
    },

    stepTraffic(dt) {
      const s = state;
      for (const c of s.cars) {
        if (c.kind !== 'traffic' || c.wrecked) continue;
        const node = s.city.graph.nodes[c.node];
        if (!node) continue;
        const d = dist(c.x, c.y, node.x, node.y);
        if (d < 24) {
          const neighbours = s.city.graph.edges.get(c.node) ?? [];
          const options = neighbours.filter((n) => n !== c.from);
          const next = options.length > 0
            ? options[Math.floor(s.rng.next() * options.length)]
            : neighbours[0];
          c.from = c.node;
          c.node = next ?? c.node;
          continue;
        }
        const want = angleTo(c.x, c.y, node.x, node.y);
        c.angle = turnToward(c.angle, want, 2.2 * dt);
        c.speed = TRAFFIC_SPEED;
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
      }
      // Keep traffic cars from piling onto each other.
      const moving = s.cars.filter((c) => c.kind === 'traffic' && !c.wrecked);
      for (let i = 0; i < moving.length; i += 1) {
        for (let j = i + 1; j < moving.length; j += 1) {
          const a = moving[i];
          const b = moving[j];
          const d = dist(a.x, a.y, b.x, b.y);
          if (d < 46 && d > 0.01) {
            const nx = (b.x - a.x) / d;
            const ny = (b.y - a.y) / d;
            const push = (46 - d) / 2;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }
    },

    stepPeds(dt) {
      const s = state;
      for (const ped of s.peds) {
        if (ped.flee > 0) {
          ped.flee -= dt;
          ped.x += Math.cos(ped.angle) * 170 * dt;
          ped.y += Math.sin(ped.angle) * 170 * dt;
        } else {
          const d = dist(ped.x, ped.y, ped.tx, ped.ty);
          if (d < 12 || (ped.tx === 0 && ped.ty === 0)) {
            const horizontal = s.rng.next() < 0.5;
            const col = s.rng.int(COLS);
            const row = s.rng.int(ROWS);
            const side = s.rng.next() < 0.5 ? -1 : 1;
            ped.tx = horizontal
              ? clamp(s.rng.range(120, WORLD_W - 120), 60, WORLD_W - 60)
              : roadX(col) + side * (ROAD_HALF + 16);
            ped.ty = horizontal
              ? roadY(row) + side * (ROAD_HALF + 16)
              : clamp(s.rng.range(120, WORLD_H - 120), 60, WORLD_H - 60);
          }
          const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
          ped.angle = a;
          ped.x += Math.cos(a) * 62 * dt;
          ped.y += Math.sin(a) * 62 * dt;
        }
        ped.x = clamp(ped.x, 24, WORLD_W - 24);
        ped.y = clamp(ped.y, 24, WORLD_H - 24);
        // A gunshot or a speeding car nearby sends them running.
        for (const b of s.bullets) {
          if (b.from === 'player' && dist(ped.x, ped.y, b.x, b.y) < 130) {
            ped.flee = 1.4;
            ped.angle = angleTo(b.x, b.y, ped.x, ped.y);
          }
        }
        for (const c of s.cars) {
          if (!c.wrecked && Math.abs(c.speed) > 60 && dist(ped.x, ped.y, c.x, c.y) < 95) {
            ped.flee = 1.2;
            ped.angle = angleTo(c.x, c.y, ped.x, ped.y);
          }
        }
      }
    },

    stepPolice(dt) {
      const s = state;
      const p = s.player;
      const freshHeat = s.elapsed - s.lastCrime < 25;
      // A fresh crime brings police cars, up to one per wanted star.
      if (s.wanted > 0 && freshHeat) {
        s.spawnTimer += dt;
        if (s.spawnTimer >= 2.5 && s.police.length < s.wanted) {
          s.spawnTimer = 0;
          const spot = this.policeSpawnSpot();
          const car = {
            id: `police-${s.elapsed.toFixed(0)}-${s.police.length}`, kind: 'police',
            x: spot.x, y: spot.y, angle: 0, speed: 0, health: 100,
            color: '#20242a', wrecked: false, lost: 0,
          };
          s.police.push(car);
          s.cars.push(car);
        }
        if (s.wanted >= 2) {
          s.copTimer += dt;
          if (s.copTimer >= 4 && s.cops.length < s.wanted - 1) {
            s.copTimer = 0;
            const a = s.rng.range(0, Math.PI * 2);
            const d = s.rng.range(600, 800);
            s.cops.push({
              x: clamp(p.x + Math.cos(a) * d, 40, WORLD_W - 40),
              y: clamp(p.y + Math.sin(a) * d, 40, WORLD_H - 40),
              angle: 0, arrest: 0, speed: COP_SPEED,
            });
          }
        }
      }
      // Police cars hunt the player and ram the player's car.
      for (const car of [...s.police]) {
        if (car.wrecked) continue;
        const d = dist(car.x, car.y, p.x, p.y);
        if (d > 900) {
          car.lost += dt;
          if (car.lost > 6) {
            s.police = s.police.filter((c) => c !== car);
            s.cars = s.cars.filter((c) => c !== car);
            continue;
          }
        } else {
          car.lost = 0;
        }
        const want = angleTo(car.x, car.y, p.x, p.y);
        car.angle = turnToward(car.angle, want, 3.2 * dt);
        car.speed = POLICE_SPEED;
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        pushOutOfBuildings(car, 17, s.city.buildings);
        if (!p.onFoot) {
          const pc = this.playerCar();
          if (pc && dist(car.x, car.y, pc.x, pc.y) < 46) {
            pc.health -= 4 * dt * 10;
            car.speed *= 0.92;
            if (pc.health <= 0 && !pc.wrecked) {
              pc.wrecked = true;
              pc.speed = 0;
              this.exitCar();
              this.flash('Car wrecked', 'Find another ride');
            }
          }
        }
      }
      // Officers on foot run the player down and make the arrest.
      for (const cop of [...s.cops]) {
        const d = dist(cop.x, cop.y, p.x, p.y);
        if (d > 900) {
          s.cops = s.cops.filter((c) => c !== cop);
          continue;
        }
        cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
        if (d > 30) {
          cop.x += Math.cos(cop.angle) * cop.speed * dt;
          cop.y += Math.sin(cop.angle) * cop.speed * dt;
        }
        if (p.onFoot && d < 46) {
          cop.arrest += dt;
          if (cop.arrest >= 1.5) {
            s.status = 'busted';
            this.flash('BUSTED', 'The Solano City police took you in');
            return;
          }
        } else {
          cop.arrest = Math.max(0, cop.arrest - dt);
        }
      }
    },

    policeSpawnSpot() {
      const s = state;
      const p = s.player;
      for (let tries = 0; tries < 12; tries += 1) {
        const col = s.rng.int(COLS);
        const row = s.rng.int(ROWS);
        const x = roadX(col);
        const y = roadY(row);
        const d = dist(x, y, p.x, p.y);
        if (d > 650 && d < 900) return { x, y };
      }
      return { x: clamp(p.x + 700, 40, WORLD_W - 40), y: clamp(p.y, 40, WORLD_H - 40) };
    },

    stepEnemies(dt) {
      const s = state;
      const p = s.player;
      // Enemies with no health left fall over.
      s.enemies = s.enemies.filter((e) => e.hp > 0);
      for (const e of s.enemies) {
        e.shootTimer -= dt;
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < 420 && d > 40) {
          const a = angleTo(e.x, e.y, p.x, p.y);
          e.x += Math.cos(a) * 55 * dt;
          e.y += Math.sin(a) * 55 * dt;
        }
        if (e.shootTimer <= 0 && d < 520) {
          e.shootTimer = s.rng.range(1.1, 2.0);
          const a = angleTo(e.x, e.y, p.x, p.y);
          s.bullets.push({
            x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20,
            vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
            life: 1.4, from: 'enemy', damage: ENEMY_BULLET_DAMAGE,
          });
        }
      }
    },

    stepBullets(dt) {
      const s = state;
      const p = s.player;
      for (const b of [...s.bullets]) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        let dead = b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H;
        if (!dead) {
          const inWall = s.city.buildings.some(
            (r) => b.x >= r.x && b.x <= r.x + r.w && b.y >= r.y && b.y <= r.y + r.h,
          );
          if (inWall) {
            this.sparks(b.x, b.y, 3);
            dead = true;
          }
        }
        if (!dead && b.from === 'player') {
          for (const e of s.enemies) {
            if (e.hp > 0 && dist(b.x, b.y, e.x, e.y) < 18) {
              e.hp -= b.damage;
              this.sparks(b.x, b.y, 6);
              if (e.hp <= 0) s.kills += 1;
              dead = true;
              break;
            }
          }
        }
        if (!dead && b.from === 'player') {
          for (const c of s.cars) {
            if (c.kind === 'traffic' && !c.wrecked && dist(b.x, b.y, c.x, c.y) < 20) {
              c.health -= b.damage;
              this.sparks(b.x, b.y, 4);
              if (c.health <= 0) c.wrecked = true;
              dead = true;
              break;
            }
          }
        }
        if (!dead && b.from === 'enemy') {
          if (p.onFoot && p.invuln <= 0 && dist(b.x, b.y, p.x, p.y) < 16) {
            p.health -= b.damage;
            p.invuln = 0.6;
            this.sparks(p.x, p.y, 8);
            if (p.health <= 0) {
              p.health = 0;
              s.status = 'wasted';
              this.flash('WASTED', 'Rico Vega did not make it out of Solano City');
            }
            dead = true;
          }
        }
        if (dead) s.bullets = s.bullets.filter((x) => x !== b);
      }
    },

    stepMission(dt) {
      const s = state;
      const m = s.mission;
      if (!m.active) return;
      m.timer -= dt;
      if (m.timer <= 0) {
        m.active = false;
        m.stage = 'idle';
        m.target = null;
        s.enemies = [];
        this.flash('Mission failed', 'Out of time — start the job again');
        return;
      }
      const p = s.player;
      if (m.index === 0 && m.stage === 'drive') {
        if (dist(p.x, p.y, 1160, 840) < 130) this.completeMission();
      } else if (m.index === 1 && m.stage === 'pickup') {
        if (dist(p.x, p.y, 2760, 520) < 110) {
          m.stage = 'deliver';
          m.target = { x: 520, y: 1840, label: 'Deliver' };
          this.addWanted(2);
          this.flash('Package picked up', 'The cops are on you — deliver it to the Harbor');
        }
      } else if (m.index === 1 && m.stage === 'deliver') {
        if (dist(p.x, p.y, 520, 1840) < 130) this.completeMission();
      } else if (m.index === 2 && m.stage === 'goto') {
        if (dist(p.x, p.y, 840, 1840) < 110) {
          m.stage = 'fight';
          m.target = { x: 840, y: 1840, label: 'Ambush' };
          for (let i = 0; i < 6; i += 1) {
            const a = (i / 6) * Math.PI * 2;
            s.enemies.push({
              x: 840 + Math.cos(a) * 130,
              y: 1840 + Math.sin(a) * 130,
              hp: 60, shootTimer: 0.8 + i * 0.25,
            });
          }
          this.flash('Ambush!', 'Six guns at the docks — clear them out');
        }
      } else if (m.index === 2 && m.stage === 'fight') {
        if (s.enemies.length === 0) {
          m.stage = 'escape';
          m.target = { x: 1480, y: 200, label: 'Escape' };
          this.flash('All clear', 'Get to the Northgate safehouse');
        }
      } else if (m.index === 2 && m.stage === 'escape') {
        if (dist(p.x, p.y, 1480, 200) < 130) this.completeMission();
      }
    },

    completeMission() {
      const s = state;
      const def = MISSION_DEFS[s.mission.index];
      s.cash += def.reward;
      s.missionsDone += 1;
      s.mission.index += 1;
      s.mission.active = false;
      s.mission.stage = 'idle';
      s.mission.target = null;
      s.enemies = [];
      this.flash(`Mission complete: ${def.name}`, `+$${def.reward.toLocaleString('en-US')}`);
    },

    stepWanted(dt) {
      const s = state;
      if (s.wanted <= 0) {
        s.coolTimer = 0;
        return;
      }
      const p = s.player;
      const policeNear = s.police.some((c) => dist(c.x, c.y, p.x, p.y) < 550);
      const copNear = s.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 550);
      if (s.elapsed - s.lastCrime > WANTED_COOL_AFTER && !policeNear && !copNear) {
        s.coolTimer += dt;
        if (s.coolTimer >= WANTED_DECAY_EVERY) {
          s.wanted -= 1;
          s.coolTimer = 0;
          s.lastCrime = s.elapsed;
        }
      } else {
        s.coolTimer = 0;
      }
    },

    sparks(x, y, n) {
      const s = state;
      for (let i = 0; i < n; i += 1) {
        const a = s.rng.range(0, Math.PI * 2);
        const sp = s.rng.range(40, 190);
        s.particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: s.rng.range(0.2, 0.55), color: '#ffd166', size: 3,
        });
      }
      if (s.particles.length > 220) s.particles.splice(0, s.particles.length - 220);
    },

    smoke(x, y) {
      const s = state;
      s.particles.push({
        x: x + s.rng.range(-8, 8), y: y + s.rng.range(-8, 8),
        vx: s.rng.range(-12, 12), vy: s.rng.range(-34, -14),
        life: s.rng.range(0.5, 0.9), color: '#5a5a5a', size: 7,
      });
    },
  };

  return world;
}
