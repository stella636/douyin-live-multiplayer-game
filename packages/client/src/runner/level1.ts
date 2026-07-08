import { RUNNER_CONFIG, type RunnerLevel } from "@douyin-game/shared";

const G = RUNNER_CONFIG.groundY;

export const LEVEL_1: RunnerLevel = {
  id: "forest-1",
  name: "森林试炼",
  length: 4200,
  platforms: [
    { x: 0, y: G, width: 900 },
    { x: 1080, y: G, width: 520 },
    { x: 1760, y: G, width: 420 },
    { x: 2320, y: G, width: 360 },
    { x: 2840, y: G, width: 520 },
    { x: 3520, y: G, width: 760 },
    { x: 1260, y: G - 88, width: 180 },
    { x: 1980, y: G - 120, width: 220 },
    { x: 2580, y: G - 96, width: 180 }
  ],
  obstacles: [
    { x: 760, y: G - 42, width: 34, height: 42, kind: "low" },
    { x: 1420, y: G - 42, width: 34, height: 42, kind: "low" },
    { x: 2140, y: G - 42, width: 34, height: 42, kind: "low" },
    { x: 3060, y: G - 28, width: 28, height: 28, kind: "spike" },
    { x: 3320, y: G - 28, width: 28, height: 28, kind: "spike" }
  ],
  blocks: [
    { x: 520, y: G - 150, reward: "coin" },
    { x: 680, y: G - 150, reward: "coin" },
    { x: 1320, y: G - 238, reward: "star" },
    { x: 2040, y: G - 270, reward: "coin" },
    { x: 2640, y: G - 246, reward: "coin" },
    { x: 3180, y: G - 150, reward: "star" }
  ],
  goalX: 4050
};
