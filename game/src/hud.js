// Kota Seja — HUD: mission panel, police dispatch, wanted stars, money,
// clock, rank, weapons, crew abilities, minimap, health/armor, dialog,
// speedometer and radio. All drawn on the 2D canvas over the 3D view.
export const HUD_STATE = {
  mission: { name: 'GOLDEN HOUR PURSUIT', stage: 2, stages: 5, progress: 64, next: 'Lose the KSPD tail — reach the Marina safehouse', story: 3, storyTotal: 12, side: 4 },
  dispatch: [
    { unit: 'UNIT 7 — CRUISER', role: 'Pursuit', dist: 42 },
    { unit: 'UNIT 12 — INTERCEPTOR', role: 'Ramming', dist: 88 },
    { unit: 'HELI 1 — AIR ONE', role: 'Spotlight', dist: 120 },
    { unit: 'UNIT 3 — CRUISER', role: 'Flanking', dist: 156 },
    { unit: 'UNIT 9 — ROADBLOCK', role: 'Roadblock', dist: 240 },
  ],
  wanted: 3, money: 48250, time: '18:42', day: 'FRI', rank: 'STREET KING', rp: 71,
  weapons: ['PISTOL', 'SMG', 'SHOTGUN', 'RIFLE', 'SNIPER'],
  owned: [true, true, false, false, false],
  abilities: [
    { key: 'Q', name: 'NIA — GHOST', ready: true },
    { key: 'E', name: 'DRE — RAM', ready: true },
    { key: 'R', name: 'MARA — SMOKE', ready: false },
  ],
  health: 82, armor: 55,
  dialog: { name: 'NIA TORRES', role: 'CREW — DRIVER', text: 'Rico, the heli has your plate. Cut through Palm Row and lose them in the marina tunnels.' },
  speed: 132, car: 'SEJA GT COUPE', condition: 88, radio: 'RADIO SEJA 98.5 — "Golden Hour" by Los Velas',
};

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.fillStyle = `rgba(12,10,22,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,180,90,0.45)';
  ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function text(ctx, s, x, y, size, color, bold = false, align = 'left') {
  ctx.font = `${bold ? '700' : '400'} ${size}px Arial, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  ctx.fillText(s, x, y);
}
function stars(ctx, x, y, n, size = 20) {
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < n ? '#ffd166' : 'rgba(255,255,255,0.22)';
    ctx.font = `700 ${size}px Arial`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('★', x + i * (size + 2), y);
  }
}

export function drawHud(ctx, W, H, st = HUD_STATE) {
  // --- Top-left: mission panel.
  panel(ctx, 14, 14, 330, 118);
  text(ctx, 'MISSION', 26, 22, 11, '#ff9a3c', true);
  text(ctx, st.mission.name, 26, 38, 16, '#ffffff', true);
  text(ctx, `STAGE ${st.mission.stage}/${st.mission.stages}  •  ${st.mission.progress}%  •  STORY ${st.mission.story}/${st.mission.storyTotal}  •  SIDE ${st.mission.side}`, 26, 60, 11, '#ffd166');
  text(ctx, 'NEXT: ' + st.mission.next, 26, 78, 11, '#e8e8f0');
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(26, 104, 306, 7);
  ctx.fillStyle = '#ff9a3c'; ctx.fillRect(26, 104, 306 * st.mission.progress / 100, 7);
  // --- Top-left below: police dispatch.
  panel(ctx, 14, 140, 330, 132);
  text(ctx, 'KSPD DISPATCH — WANTED LEVEL ' + st.wanted, 26, 148, 11, '#ff5a5a', true);
  st.dispatch.forEach((d, i) => {
    const y = 168 + i * 20;
    text(ctx, d.unit, 26, y, 11, '#ffffff', true);
    text(ctx, d.role.toUpperCase(), 195, y, 11, '#ff9a3c', true);
    text(ctx, d.dist + ' m', 332, y, 11, '#c8c8d8', false, 'right');
  });
  // --- Top-right: wanted stars, money, clock, rank.
  panel(ctx, W - 344, 14, 330, 118);
  stars(ctx, W - 332, 22, st.wanted, 22);
  text(ctx, '$' + st.money.toLocaleString('en-US'), W - 26, 22, 22, '#7ee081', true, 'right');
  text(ctx, `${st.time}  ${st.day}  •  KOTA SEJA`, W - 26, 52, 12, '#ffffff', true, 'right');
  text(ctx, 'RANK: ' + st.rank, W - 26, 72, 12, '#ffd166', true, 'right');
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(W - 332, 96, 306, 7);
  ctx.fillStyle = '#ffd166'; ctx.fillRect(W - 332, 96, 306 * st.rp / 100, 7);
  text(ctx, `RP ${st.rp}% — next rank: HARBOR BOSS`, W - 26, 108, 10, '#c8c8d8', false, 'right');
  // --- Bottom-left: weapons + crew abilities.
  panel(ctx, 14, H - 178, 330, 104);
  text(ctx, 'WEAPONS  [1–5]', 26, H - 170, 11, '#ff9a3c', true);
  st.weapons.forEach((w, i) => {
    const x = 26 + i * 62;
    ctx.fillStyle = st.owned[i] ? (i === 0 ? '#ff9a3c' : 'rgba(255,255,255,0.16)') : 'rgba(255,255,255,0.07)';
    ctx.fillRect(x, H - 152, 56, 34);
    text(ctx, String(i + 1), x + 5, H - 149, 10, '#ffd166', true);
    text(ctx, st.owned[i] ? w : 'LOCKED', x + 5, H - 132, 9, st.owned[i] ? '#fff' : '#888', true);
  });
  st.abilities.forEach((a, i) => {
    const y = H - 108 + i * 0;
    const x = 26 + i * 106;
    ctx.fillStyle = a.ready ? 'rgba(126,224,129,0.25)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, H - 110, 100, 28);
    ctx.strokeStyle = a.ready ? '#7ee081' : '#555'; ctx.strokeRect(x + 0.5, H - 109.5, 99, 27);
    text(ctx, `[${a.key}] ${a.name}`, x + 6, H - 104, 9, a.ready ? '#7ee081' : '#999', true);
    text(ctx, a.ready ? 'READY' : 'RECHARGING', x + 6, H - 92, 9, a.ready ? '#7ee081' : '#999');
  });
  // --- Bottom-right: minimap + health/armor + speed.
  const mx = W - 170, my = H - 170, mr = 72;
  ctx.save();
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#1d2436'; ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  ctx.strokeStyle = '#4a4a55'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(mx, my - mr); ctx.lineTo(mx, my + mr); ctx.moveTo(mx - mr, my); ctx.lineTo(mx + mr, my); ctx.stroke();
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(mx - mr, my - 30); ctx.lineTo(mx + mr, my - 30); ctx.stroke();
  // Mission marker (gold diamond) + police dots.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.moveTo(mx + 34, my - 44); ctx.lineTo(mx + 40, my - 38); ctx.lineTo(mx + 34, my - 32); ctx.lineTo(mx + 28, my - 38); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a8cff';
  for (const [ox, oy] of [[-20, 18], [12, 26], [-38, -14]]) { ctx.beginPath(); ctx.arc(mx + ox, my + oy, 4, 0, Math.PI * 2); ctx.fill(); }
  // Player arrow (up = north).
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(mx, my - 10); ctx.lineTo(mx + 7, my + 8); ctx.lineTo(mx, my + 3); ctx.lineTo(mx - 7, my + 8); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.stroke();
  text(ctx, 'N', mx + mr - 12, my - mr - 18, 12, '#ffd166', true);
  // Health + armor bars under minimap.
  panel(ctx, W - 344, H - 88, 330, 74);
  text(ctx, 'HEALTH', W - 332, H - 80, 10, '#fff', true);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(W - 332, H - 66, 306, 8);
  ctx.fillStyle = '#ff5a5a'; ctx.fillRect(W - 332, H - 66, 306 * st.health / 100, 8);
  text(ctx, 'ARMOR', W - 332, H - 52, 10, '#fff', true);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(W - 332, H - 38, 306, 8);
  ctx.fillStyle = '#7fb3ff'; ctx.fillRect(W - 332, H - 38, 306 * st.armor / 100, 8);
  // --- Bottom-centre: dialog box.
  panel(ctx, W / 2 - 260, H - 108, 520, 94);
  ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.arc(W / 2 - 228, H - 78, 22, 0, Math.PI * 2); ctx.fill();
  text(ctx, 'NT', W / 2 - 228, H - 86, 13, '#14101f', true, 'center');
  text(ctx, st.dialog.name + '  —  ' + st.dialog.role, W / 2 - 196, H - 98, 12, '#ffd166', true);
  wrapText(ctx, st.dialog.text, W / 2 - 196, H - 78, 460, 13, '#ffffff');
  // --- Speedometer: left of the minimap, clear of its circle.
  text(ctx, st.speed + ' km/h', W - 256, H - 202, 26, '#ffffff', true, 'right');
  text(ctx, st.car + '  •  CONDITION ' + st.condition + '%', W - 256, H - 174, 11, '#c8c8d8', false, 'right');
  // --- Radio line: top centre, clear of both top panels.
  text(ctx, '♪ ' + st.radio, W / 2, 16, 11, '#ffd166', false, 'center');
}
function wrapText(ctx, s, x, y, maxW, size, color) {
  ctx.font = `400 ${size}px Arial, sans-serif`; ctx.fillStyle = color;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const words = s.split(' '); let line = '';
  let cy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, cy); line = w; cy += size + 4; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
}
