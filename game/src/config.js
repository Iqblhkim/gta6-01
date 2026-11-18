// Solano City — tuning constants for the open world.
// One place for the numbers the city, the world and the renderer share,
// so a tweak here moves the whole game at once.

export const STEP = 1 / 60;

export const WORLD_W = 3600;
export const WORLD_H = 2800;

// The road grid: 9 columns by 7 rows of intersections, 400 apart,
// the first road 160 from the world's edge.
export const COLS = 9;
export const ROWS = 7;
export const ROAD_SPACING = 400;
export const ROAD_ORIGIN = 160;
export const ROAD_HALF = 34;

// Movement.
export const WALK_SPEED = 185;
export const RUN_SPEED = 285;
export const CAR_ACCEL = 310;
export const CAR_BRAKE = 520;
export const CAR_MAX_SPEED = 345;
export const CAR_REVERSE_MAX = 130;
export const CAR_TURN = 2.5;
export const TRAFFIC_SPEED = 150;
export const POLICE_SPEED = 360;
export const COP_SPEED = 195;

// Combat.
export const PLAYER_HEALTH = 100;
export const MAG_SIZE = 12;
export const RESERVE_AMMO = 60;
export const BULLET_SPEED = 720;
export const BULLET_DAMAGE = 35;
export const ENEMY_BULLET_DAMAGE = 8;
export const SHOOT_COOLDOWN = 0.18;

// Wanted.
export const WANTED_MAX = 5;
export const WANTED_COOL_AFTER = 12; // seconds without a crime before heat can fall
export const WANTED_DECAY_EVERY = 10; // seconds of hiding per lost star

// The player's starting cash. Mission 1 pays $500 on top of it.
export const START_CASH = 200;
