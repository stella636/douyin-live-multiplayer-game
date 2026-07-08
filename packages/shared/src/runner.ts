export const RUNNER_CONFIG = {
  viewportWidth: 1280,
  viewportHeight: 720,
  groundY: 580,
  runSpeed: 240,
  jumpVelocity: 700,
  gravity: 1900,
  coyoteTimeMs: 120,
  jumpBufferMs: 160,
  playerWidth: 38,
  playerHeight: 54,
  playerScreenX: 280,
  roundDurationMs: 90_000,
  shieldDurationMs: 3000,
  bridgeDurationMs: 6000
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
  controls: "camera-jump-or-space",
  giftBridge: "Digit1 / rose gift",
  giftShield: "Digit2 / heart gift"
} as const;
