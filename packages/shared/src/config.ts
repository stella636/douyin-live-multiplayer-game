export const GAME_CONFIG = {
  roomName: "gift-box-battle",
  maxPlayers: 8,
  minPlayers: 2,
  roundDurationMs: 3 * 60 * 1000,
  mapWidth: 1280,
  mapHeight: 720,
  groundY: 620,
  // Higher on screen so standing cannot touch; jump required.
  boxAnchorY: 168,
  boxWidth: 232,
  boxHitHeight: 182,
  boxLanePadding: 180,
  playerSpeed: 280,
  airControl: 0.75,
  jumpVelocity: 1120,
  jumpCutMultiplier: 0.45,
  coyoteTimeMs: 120,
  jumpBufferMs: 140,
  boxSize: 28,
  boxGap: 4,
  maxBoxes: 99,
  defaultGiftBoxGain: 1,
  headBounceVelocity: 180,
  playerBody: {
    width: 42,
    height: 58,
    offsetX: 11,
    offsetY: 6
  }
} as const;

export const MVP_RULES = {
  winCondition: "round-end-lowest-box-count",
  supportedPlayerCount: "2-8 players",
  giftTargeting: "self-by-seat-or-random-online",
  collisionRule: "upward-head-hit-removes-one-box",
  debugControls: {
    move: "ArrowLeft / ArrowRight or A / D",
    jump: "Space / ArrowUp / W",
    giftSelf: "Digit1",
    giftRandom: "Digit2"
  }
} as const;

export const GIFT_BOX_MAP: Record<string, number> = {
  rose: 1,
  heart: 2,
  diamond: 5
};

export function getPlayerBoxAnchorX(slotIndex: number, totalSlots: number) {
  return GAME_CONFIG.mapWidth / 2;
}
