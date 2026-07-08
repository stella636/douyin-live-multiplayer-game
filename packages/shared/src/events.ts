export type GiftType = "rose" | "heart" | "diamond" | "custom";

export interface GiftReceivedEvent {
  type: "gift.received";
  roomId: string;
  senderId: string;
  giftName: string;
  giftType: GiftType;
  giftCount: number;
  giftValue: number;
  targetPlayerId?: string;
  ts: number;
}

export interface MockGiftCommand {
  senderId: string;
  giftType?: GiftType;
  giftCount?: number;
  targetPlayerId?: string;
}

export interface PlayerInputState {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  tick: number;
}

export interface PlayerSnapshot {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: "left" | "right";
  boxCount: number;
  color: string;
  connected: boolean;
}

export interface RoomSnapshot {
  roomId: string;
  players: PlayerSnapshot[];
  winnerId?: string;
  timeLeftMs: number;
}

export interface ServerMessageMap {
  "gift:trigger": MockGiftCommand;
}
