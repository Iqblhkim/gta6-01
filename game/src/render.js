// Drawing only: the world state and the current screen in, pixels out.
// The camera follows the player; the HUD, the minimap and the menus are
// drawn on top. Nothing here touches the simulation.

import { COLS, ROWS, ROAD_SPACING, ROAD_ORIGIN, ROAD_HALF, WORLD_W, WORLD_H } from './config.js';
import { roadX, roadY } from './city.js';
import { MISSION_DEFS } from './world.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function computeCamera(world, w, h) {
  const p = world.state.player;
  return {
    x: clamp(p.x - w / 2, 0, Math.max(0, WORLD_W - w)),
    y: clamp(p.y - h / 2, 0, Math.max(0, WORLD_H - h)),
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car, flash) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = car.wrecked ? '#2b2b2b' : car.color;
  rr(ctx, -21, -11, 42, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 30, 40, 0.85)';
  rr(ctx, -6, -9, 13, 18, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-2, -9, 4, 18);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-12, -11, 8, 22);
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-16, -8, 6, 7);
    ctx.fillStyle = flash ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-16, 1, 6, 7);
  }
  if (car.wrecked) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(10, 8);
    ctx.moveTo(10, -8);
    ctx.lineTo(-14, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMinimap(ctx, world, x, y, w, h) {
  const s = stateOf(world);
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 18, 0.82)';
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Roads.
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 2;
  for (let c = 0; c < COLS; c += 1) {
    ctx.beginPath();
    ctx.moveTo(x + roadX(c) * sx, y);
    ctx.lineTo(x + roadX(c) * sx, y + h);
    ctx.stroke();
  }
  for (let r = 0; r < ROWS; r += 1) {
    ctx.beginPath();
    ctx.moveTo(x, y + roadY(r) * sy);
    ctx.lineTo(x + w, y + roadY(r) * sy);
    ctx.stroke();
  }
  // Park, beach, harbour.
  ctx.fillStyle = '#4d7a3d';
  ctx.fillRect(x + s.city.park.x0 * sx, y + s.city.park.y0 * sy,
    (s.city.park.x1 - s.city.park.x0) * sx, (s.city.park.y1 - s.city.park.y0) * sy);
  ctx.fillStyle = '#2d6a8a';
  ctx.fillRect(x + 3400 * sx, y, 200 * sx, h);
  // Mission target.
  const target = s.mission.target;
  if (target) {
    ctx.fillStyle = '#ffd166';
    const tx = x + target.x * sx;
    const ty = y + target.y * sy;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 6);
    ctx.lineTo(tx + 5, ty);
    ctx.lineTo(tx, ty + 6);
    ctx.lineTo(tx - 5, ty);
    ctx.closePath();
    ctx.fill();
  }
  // Police, then the player on top.
  for (const car of s.police) {
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + s.player.x * sx, y + s.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', x + 6, y + 14);
}

function stateOf(world) {
  return world.state;
}

function drawHud(ctx, world, view) {
  const s = stateOf(world);
  const p = s.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top-left panel: cash, health, stars, ammo, speed.
  ctx.fillStyle = 'rgba(10, 14, 18, 0.72)';
  rr(ctx, 14, 14, 240, 108, 10);
  ctx.fill();
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${s.cash.toLocaleString('en-US')}`, 26, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('RICO VEGA', 26, 66);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(26, 74, 120, 10);
  ctx.fillStyle = p.health > 35 ? '#4ade80' : '#ef4444';
  ctx.fillRect(26, 74, 120 * clamp(p.health / 100, 0, 1), 10);
  // Wanted stars.
  ctx.font = '22px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < s.wanted ? '★' : '☆';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(stars, 26, 106);
  // Ammo and speed.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`AMMO ${s.ammo} / ${s.reserve}`, 160, 84);
  const car = p.onFoot ? null : world.playerCar();
  if (car) {
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.62)} mph`, 160, 106);
  }
  // Objective, top centre.
  const def = MISSION_DEFS[s.mission.index];
  let objective = 'Free roam — press ENTER to start the next job';
  if (s.mission.active && def) {
    const stageText = {
      getCar: 'Steal the getaway sedan',
      drive: 'Drive to the drop-off',
      pickup: 'Pick up the package',
      deliver: 'Deliver the package',
      goto: 'Go to the docks',
      fight: 'Clear the ambush',
      escape: 'Escape to the safehouse',
    }[s.mission.stage] ?? '';
    objective = `${def.name} — ${stageText}  (${Math.ceil(s.mission.timer)}s)`;
  } else if (s.missionsDone >= MISSION_DEFS.length) {
    objective = 'All jobs done — Solano City is yours';
  }
  ctx.font = 'bold 15px sans-serif';
  const ow = ctx.measureText(objective).width;
  ctx.fillStyle = 'rgba(10, 14, 18, 0.72)';
  rr(ctx, view.w / 2 - ow / 2 - 14, 14, ow + 28, 30, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'center';
  ctx.fillText(objective, view.w / 2, 35);
  ctx.textAlign = 'left';
  // District + clock under the minimap.
  drawMinimap(ctx, world, view.w - 204, 14, 190, 148);
  const hour = Math.floor((s.clock / 3600) % 24);
  const minute = Math.floor((s.clock / 60) % 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    `${world.district()}  •  ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    view.w - 14, 184,
  );
  ctx.textAlign = 'left';
  // Mission banner.
  if (s.banner) {
    const alpha = clamp(s.banner.t, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(10, 14, 18, 0.78)';
    const bw = 460;
    rr(ctx, view.w / 2 - bw / 2, 190, bw, 74, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.banner.text, view.w / 2, 222);
    if (s.banner.sub) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px sans-serif';
      ctx.fillText(s.banner.sub, view.w / 2, 248);
    }
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

function drawScreenOverlay(ctx, world, screen, view, saveExists) {
  const s = stateOf(world);
  ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  if (screen === 'title') {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLANO CITY', view.w / 2, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('An open-world crime game — fresh out of prison, $50,000 in debt', view.w / 2, 228);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Steal cars. Outrun the police. Run three jobs for the crew.', view.w / 2, 258);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('SPACE — New game', view.w / 2, 330);
    if (saveExists) ctx.fillText('C — Continue where you left off', view.w / 2, 362);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('WASD walk / drive   •   SHIFT run   •   E steal or exit a car   •   Mouse aim, click shoot   •   R reload', view.w / 2, 420);
    ctx.fillText('ENTER start a job   •   P pause   •   M mute', view.w / 2, 446);
  } else if (screen === 'paused') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('PAUSED', view.w / 2, 330);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Press P to keep playing', view.w / 2, 368);
  } else if (screen === 'busted') {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('BUSTED', view.w / 2, 330);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('The Solano City police took you in — press SPACE to try again', view.w / 2, 368);
  } else if (screen === 'wasted') {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('WASTED', view.w / 2, 330);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Rico Vega did not make it out of Solano City — press SPACE to try again', view.w / 2, 368);
  }
  ctx.textAlign = 'left';
}

export function render(ctx, world, screen, view) {
  const s = stateOf(world);
  const cam = computeCamera(world, view.w, view.h);
  const hour = (s.clock / 3600) % 24;
  let dark = 0;
  if (hour < 5 || hour >= 20) dark = 0.55;
  else if (hour < 7) dark = (0.55 * (7 - hour)) / 2;
  else if (hour >= 18) dark = (0.55 * (hour - 18)) / 2;

  ctx.save();
  ctx.clearRect(0, 0, view.w, view.h);
  // Ground: grass everywhere, sand on the beach, concrete at the harbour.
  ctx.fillStyle = '#7da65c';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(3400, 0, 160, WORLD_H);
  ctx.fillStyle = '#2d6a8a';
  ctx.fillRect(3560, 0, 40, WORLD_H);
  ctx.fillStyle = '#9a938a';
  ctx.fillRect(0, 2240, WORLD_W, WORLD_H - 2240);
  // Roads.
  ctx.fillStyle = '#3a3f45';
  for (let c = 0; c < COLS; c += 1) {
    ctx.fillRect(roadX(c) - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_H);
  }
  for (let r = 0; r < ROWS; r += 1) {
    ctx.fillRect(0, roadY(r) - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  }
  // Centre dashes.
  ctx.strokeStyle = '#d8c25a';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (let c = 0; c < COLS; c += 1) {
    ctx.beginPath();
    ctx.moveTo(roadX(c), 0);
    ctx.lineTo(roadX(c), WORLD_H);
    ctx.stroke();
  }
  for (let r = 0; r < ROWS; r += 1) {
    ctx.beginPath();
    ctx.moveTo(0, roadY(r));
    ctx.lineTo(WORLD_W, roadY(r));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Park.
  ctx.fillStyle = '#5d8a46';
  ctx.fillRect(s.city.park.x0, s.city.park.y0, s.city.park.x1 - s.city.park.x0, s.city.park.y1 - s.city.park.y0);
  // Skid marks.
  ctx.strokeStyle = 'rgba(20, 20, 20, 0.55)';
  ctx.lineWidth = 5;
  for (const k of s.skids) {
    ctx.beginPath();
    ctx.moveTo(k.x - Math.cos(k.angle) * 12, k.y - Math.sin(k.angle) * 12);
    ctx.lineTo(k.x + Math.cos(k.angle) * 12, k.y + Math.sin(k.angle) * 12);
    ctx.stroke();
  }
  // Containers.
  for (const c of s.city.containers) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }
  // Buildings: body, roof inset, door.
  for (const b of s.city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = 'rgba(255, 240, 200, 0.5)';
    ctx.fillRect(b.x + b.w / 2 - 5, b.y + b.h - 12, 10, 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // Trees.
  for (const t of s.city.trees) {
    ctx.fillStyle = '#3d6b2f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4d7a3d';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker: a pulsing ring at the target.
  const target = s.mission.target;
  if (target && s.mission.active) {
    const pulse = 24 + Math.sin(s.elapsed * 4) * 6;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 12);
    ctx.lineTo(target.x + 9, target.y);
    ctx.lineTo(target.x, target.y + 12);
    ctx.lineTo(target.x - 9, target.y);
    ctx.closePath();
    ctx.fill();
  }
  // Pedestrians.
  for (const ped of s.peds) {
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Cars: traffic and parked first, police next, the player's car last.
  const flash = Math.floor(s.elapsed * 4) % 2 === 0;
  for (const car of s.cars) {
    if (car.kind === 'police') continue;
    if (s.player.carId === car.id) continue;
    drawCar(ctx, car, flash);
  }
  for (const car of s.police) drawCar(ctx, car, flash);
  const playerCar = s.player.carId !== null ? world.playerCar() : null;
  if (playerCar) drawCar(ctx, playerCar, flash);
  // Enemies.
  for (const e of s.enemies) {
    ctx.fillStyle = '#c92a2a';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(angleTo(e, s.player)) * 18, e.y + Math.sin(angleTo(e, s.player)) * 18);
    ctx.stroke();
  }
  // The player on foot.
  if (s.player.onFoot) {
    const p = s.player;
    ctx.fillStyle = '#e8e4d8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
    ctx.stroke();
  }
  // Bullets.
  for (const b of s.bullets) {
    ctx.fillStyle = b.from === 'player' ? '#ffe066' : '#ff9f43';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Particles.
  for (const pt of s.particles) {
    ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Night: a dark wash, then the player's headlights cut through it.
  if (dark > 0.02) {
    ctx.fillStyle = `rgba(8, 12, 32, ${dark})`;
    ctx.fillRect(cam.x, cam.y, view.w, view.h);
    if (playerCar) {
      const hx = playerCar.x + Math.cos(playerCar.angle) * 30;
      const hy = playerCar.y + Math.sin(playerCar.angle) * 30;
      const grad = ctx.createRadialGradient(hx, hy, 10, hx, hy, 260);
      grad.addColorStop(0, 'rgba(255, 240, 180, 0.30)');
      grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(hx, hy, 260, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // Edge arrow toward an off-screen mission target.
  if (target && s.mission.active) {
    const tx = target.x - cam.x;
    const ty = target.y - cam.y;
    if (tx < 0 || tx > view.w || ty < 0 || ty > view.h) {
      const cx = clamp(tx, 60, view.w - 60);
      const cy = clamp(ty, 90, view.h - 60);
      const a = Math.atan2(ty - cy, tx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist(target.x, target.y, s.player.x, s.player.y))}m`, cx, cy + 28);
      ctx.textAlign = 'left';
    }
  }
  drawHud(ctx, world, view);
  if (screen !== 'play') {
    drawScreenOverlay(ctx, world, screen, view, view.saveExists === true);
  }
  ctx.restore();
}

function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
