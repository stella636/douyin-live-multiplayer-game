/** 直播间竖屏壳层比例：上摄像头 / 中游戏 / 下弹幕礼物安全区 */
export const LIVE_LAYOUT = {
  shellWidth: 430,
  shellHeight: 932,
  cameraRatio: 0.5,
  gameRatio: 0.35,
  danmuSafeRatio: 0.15
} as const;

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
  roundDurationMs: 90_000,
  shieldDurationMs: 3000,
  bridgeDurationMs: 6000,
  maxReviveCharges: 2
} as const;

export type RunnerPlatform = {
  x: number;
  y: number;
  width: number;
  height?: number;
};

export type RunnerObstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "low" | "spike";
};

export type RunnerBlock = {
  x: number;
  y: number;
  reward: "coin" | "star";
};

export type RunnerLevel = {
  id: string;
  name: string;
  length: number;
  platforms: RunnerPlatform[];
  obstacles: RunnerObstacle[];
  blocks: RunnerBlock[];
  goalX: number;
};

export const RUNNER_RULES = {
  winCondition: "reach-goal-before-timeout",
  layout: "portrait-live-camera-top-game-middle-danmu-bottom",
  controls: "camera-jump-or-space",
  giftBridge: "玫瑰 rose / 1 → 前方架桥",
  giftShield: "小心心 heart / 2 → 护盾 3 秒",
  giftRevive: "钻石 diamond / 3 → 复活 +1"
} as const;

export const RUNNER_GIFT_EFFECTS = {
  rose: "bridge",
  heart: "shield",
  diamond: "revive"
} as const;

export type RunnerGiftEffect = (typeof RUNNER_GIFT_EFFECTS)[keyof typeof RUNNER_GIFT_EFFECTS];
