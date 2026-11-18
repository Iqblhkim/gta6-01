// The screenshot scenes behind ?shot=start|drive|chase|mission.
// Each one stages a real moment of the game — the title, a drive down
// a Northgate road, a three-star chase, a mission just completed —
// using the game's own systems, never a faked frame.

import { STEP } from './config.js';

// Returns the screen the shot should show: 'title' for the cover,
// 'play' for the three action shots.
export function applyShot(world, name) {
  const s = world.state;
  if (name === 'start') {
    s.clock = 9 * 3600;
    return 'title';
  }
  if (name === 'drive') {
    s.clock = 10 * 3600;
    s.player.x = 480;
    s.player.y = 566;
    world.enterCar();
    const car = world.playerCar();
    car.x = 900;
    car.y = 560;
    car.angle = 0;
    car.speed = 230;
    s.player.x = car.x;
    s.player.y = car.y;
    return 'play';
  }
  if (name === 'chase') {
    s.clock = 17 * 3600;
    s.player.x = 480;
    s.player.y = 566;
    world.enterCar();
    const car = world.playerCar();
    car.x = 1500;
    car.y = 960;
    car.angle = 0;
    car.speed = 250;
    s.player.x = car.x;
    s.player.y = car.y;
    world.addWanted(3);
    // Two patrol cars already on the player's tail.
    const spots = [
      { x: 1180, y: 960 },
      { x: 1060, y: 900 },
    ];
    spots.forEach((spot, i) => {
      const cop = {
        id: `police-shot-${i}`, kind: 'police',
        x: spot.x, y: spot.y, angle: 0, speed: 300,
        health: 100, color: '#20242a', wrecked: false, lost: 0,
      };
      s.police.push(cop);
      s.cars.push(cop);
    });
    return 'play';
  }
  if (name === 'mission') {
    s.clock = 11 * 3600;
    world.reset();
    world.startMission();
    const st = world.state;
    st.player.x = 600;
    st.player.y = 600;
    world.enterCar();
    const car = world.playerCar();
    car.x = 1160;
    car.y = 840;
    car.speed = 0;
    st.player.x = 1160;
    st.player.y = 840;
    for (let i = 0; i < 300 && st.missionsDone === 0; i += 1) {
      world.step(STEP, {});
    }
    return 'play';
  }
  return 'title';
}
