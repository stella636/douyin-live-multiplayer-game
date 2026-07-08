import { RUNNER_CONFIG, type RunnerLevel } from "@douyin-game/shared";

const G = RUNNER_CONFIG.groundY;

export const LEVEL_1: RunnerLevel = {
  id: "maple-forest-1",
  name: "彩虹村外 · 试炼小道",
  length: 3800,
  platforms: [
    { x: 0, y: G, width: 760 },
    { x: 940, y: G, width: 460 },
    { x: 1540, y: G, width: 380 },
    { x: 2060, y: G, width: 320 },
    { x: 2520, y: G, width: 460 },
    { x: 3120, y: G, width: 760 },
    { x: 1120, y: G - 72, width: 160 },
    { x: 1680, y: G - 96, width: 180 },
    { x: 2240, y: G - 80, width: 150 }
  ],
  obstacles: [
    { x: 640, y: G - 40, width: 36, height: 40, kind: "low" },
    { x: 1280, y: G - 40, width: 36, height: 40, kind: "low" },
    { x: 1880, y: G - 40, width: 36, height: 40, kind: "low" },
    { x: 2720, y: G - 26, width: 30, height: 26, kind: "spike" },
    { x: 2940, y: G - 26, width: 30, height: 26, kind: "spike" }
  ],
  blocks: [
    { x: 420, y: G - 138, reward: "coin" },
    { x: 560, y: G - 138, reward: "coin" },
    { x: 1180, y: G - 210, reward: "star" },
    { x: 1760, y: G - 234, reward: "coin" },
    { x: 2320, y: G - 214, reward: "coin" },
    { x: 2860, y: G - 138, reward: "star" }
  ],
  goalX: 3650
};
