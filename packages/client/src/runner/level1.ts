import { RUNNER_CONFIG, getRunnerLevelLength, type RunnerLevel } from "@douyin-game/shared";

const G = RUNNER_CONFIG.groundY;
const LENGTH = getRunnerLevelLength();

/** 默认长直道，无任何障碍；礼物动态刷障碍 */
export const LEVEL_1: RunnerLevel = {
  id: "live-peace-road",
  name: "直播平安大道",
  length: LENGTH,
  platforms: [{ x: 0, y: G, width: LENGTH }],
  goalX: LENGTH - 240
};
