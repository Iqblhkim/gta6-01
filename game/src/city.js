// Solano City — the procedural city: a road grid, building blocks,
// a park, a beach and a harbour, all deterministic from one seed.

import {
  COLS,
  ROWS,
  ROAD_SPACING,
  ROAD_ORIGIN,
  ROAD_HALF,
  WORLD_W,
  WORLD_H,
} from './config.js';

// X of a road column, Y of a road row.
export function roadX(col) {
  return ROAD_ORIGIN + col * ROAD_SPACING;
}
export function roadY(row) {
  return ROAD_ORIGIN + row * ROAD_SPACING;
}

// The five named districts of Solano City.
export function districtAt(x, y) {
  if (y < 760) return 'Northgate';
  if (y > 2240) return 'Harbor';
  if (x > 2960) return 'Marina';
  if (x < 1500) return 'Old Town';
  return 'Downtown';
}

const BUILDING_COLORS = [
  '#c9a37e', '#b98d6f', '#a8b0b8', '#9aa5ad', '#d0b48f',
  '#8f9aa3', '#c2b49a', '#b5a58c', '#7e8b96', '#d6c9a8',
];
const CONTAINER_COLORS = ['#b5502a', '#2a6db5', '#3d8a4f', '#b5892a', '#7a4a8a'];

// Spots the city must leave open: mission points, the getaway car,
// the player's spawn. No building may stand within the radius.
const CLEAR_SPOTS = [
  { x: 560, y: 566, r: 150 },
  { x: 1160, y: 840, r: 170 },
  { x: 2760, y: 520, r: 130 },
  { x: 520, y: 1840, r: 130 },
  { x: 840, y: 1840, r: 150 },
  { x: 1480, y: 200, r: 130 },
  { x: 700, y: 560, r: 110 },
];

// The park block (column 4, row 2) holds trees instead of buildings.
const PARK_COL = 4;
const PARK_ROW = 2;

function clearOfSpots(x, y, pad) {
  for (const s of CLEAR_SPOTS) {
    if (Math.hypot(x - s.x, y - s.y) < s.r + pad) return false;
  }
  return true;
}

export function createCity(rng) {
  // The road graph: one node per intersection, edges to the
  // right and down neighbours, so every road reaches every other.
  const nodes = [];
  const edges = new Map();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const id = row * COLS + col;
      nodes.push({ id, x: roadX(col), y: roadY(row) });
      edges.set(id, []);
    }
  }
  const link = (a, b) => {
    edges.get(a).push(b);
    edges.get(b).push(a);
  };
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const id = row * COLS + col;
      if (col + 1 < COLS) link(id, id + 1);
      if (row + 1 < ROWS) link(id, id + COLS);
    }
  }
  const graph = { nodes, edges };

  // Buildings: one or two per block, in fixed left/right slots
  // so they never overlap each other or a road.
  const buildings = [];
  for (let row = 0; row < ROWS - 1; row += 1) {
    for (let col = 0; col < COLS - 1; col += 1) {
      if (col === PARK_COL && row === PARK_ROW) continue;
      const bx0 = roadX(col) + ROAD_HALF + 16;
      const bx1 = roadX(col + 1) - ROAD_HALF - 16;
      const by0 = roadY(row) + ROAD_HALF + 16;
      const by1 = roadY(row + 1) - ROAD_HALF - 16;
      const count = 1 + rng.int(2);
      for (let slot = 0; slot < count; slot += 1) {
        const w = rng.range(95, 165);
        const h = rng.range(70, 125);
        const midX = (bx0 + bx1) / 2;
        const x = slot === 0
          ? rng.range(bx0, Math.max(bx0 + 1, midX - w - 8))
          : rng.range(Math.max(midX + 8, bx1 - w), Math.max(bx1 - w, midX + 9));
        const y = rng.range(by0, Math.max(by0 + 1, by1 - h));
        const cx = x + w / 2;
        const cy = y + h / 2;
        if (!clearOfSpots(cx, cy, 70)) continue;
        buildings.push({
          x, y, w, h,
          color: rng.pick(BUILDING_COLORS),
          roof: rng.pick(['#5d6b76', '#7a6a55', '#4f5a52', '#6e5a6e']),
        });
      }
    }
  }

  // The park: a green block full of trees.
  const trees = [];
  const px0 = roadX(PARK_COL) + ROAD_HALF + 20;
  const px1 = roadX(PARK_COL + 1) - ROAD_HALF - 20;
  const py0 = roadY(PARK_ROW) + ROAD_HALF + 20;
  const py1 = roadY(PARK_ROW + 1) - ROAD_HALF - 20;
  for (let i = 0; i < 28; i += 1) {
    trees.push({
      x: rng.range(px0, px1),
      y: rng.range(py0, py1),
      r: rng.range(13, 22),
    });
  }
  // A few palms along the beach, east edge.
  for (let i = 0; i < 8; i += 1) {
    trees.push({ x: rng.range(3410, 3530), y: rng.range(300, 2400), r: rng.range(12, 18) });
  }

  // The harbour: shipping containers in the southern strip.
  const containers = [];
  for (let i = 0; i < 10; i += 1) {
    containers.push({
      x: 2420 + i * 100,
      y: 2630 + (i % 2) * 55,
      w: 88,
      h: 42,
      color: CONTAINER_COLORS[i % CONTAINER_COLORS.length],
    });
  }

  return {
    buildings,
    trees,
    containers,
    graph,
    park: { x0: px0, y0: py0, x1: px1, y1: py1 },
    beach: { x0: 3400, x1: 3560 },
    bounds: { w: WORLD_W, h: WORLD_H },
  };
}

// True when every intersection is reachable from the first one.
export function roadGraphConnected(graph) {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const id = queue.pop();
    for (const next of graph.edges.get(id) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === graph.nodes.length;
}
