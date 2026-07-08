/** 直播间竖屏壳层比例：上摄像头 / 中游戏 / 下弹幕礼物安全区 */
export const LIVE_LAYOUT = {
  shellWidth: 430,
  shellHeight: 932,
  cameraRatio: 0.5,
  gameRatio: 0.35,
  danmuSafeRatio: 0.15
} as const;

/** 无障碍匀速走完约 30 分钟：210px/s × 1800s */
export const RUNNER_CONFIG = {
  viewportWidth: 720,
  viewportHeight: 400,
  groundY: 332,
  runSpeed: 210,
  jumpVelocity: 640,
  gravity: 1850,
  coyoteTimeMs: 130,
  jumpBufferMs: 170,
  playerWidth: 44,
  playerHeight: 56,
  playerScreenX: 190,
  levelDurationSeconds: 30 * 60,
  obstacleBreathSeconds: 10,
  giftSpawnDelaySeconds: 10,
  cliffGapWidth: 140,
  wallWidth: 34,
  wallHeight: 72
} as const;

export type RunnerPlatform = {
  x: number;
  y: number;
  width: number;
  height?: number;
};

export type DynamicObstacleKind = "cliff" | "wall" | "headBlock";

export type RunnerLevel = {
  id: string;
  name: string;
  length: number;
  platforms: RunnerPlatform[];
  goalX: number;
};

export const RUNNER_RULES = {
  winCondition: "reach-goal-without-falling",
  layout: "portrait-live-camera-top-game-middle-danmu-bottom",
  controls: "camera-jump-or-space",
  basePath: "默认无障碍，匀速约 30 分钟通关",
  giftEffect: "每刷 1 个礼物，10 秒后在道路上增加 1 个障碍",
  obstacleSpacing: "障碍之间约 10 秒喘息路程",
  obstacleTypes: "悬崖 / 高墙 / 顶一顶砖块"
} as const;

export function getRunnerLevelLength() {
  return RUNNER_CONFIG.runSpeed * RUNNER_CONFIG.levelDurationSeconds;
}

export function getObstacleBreathDistance() {
  return RUNNER_CONFIG.runSpeed * RUNNER_CONFIG.obstacleBreathSeconds;
}
