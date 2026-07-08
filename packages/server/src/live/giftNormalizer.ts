import { GIFT_BOX_MAP, GAME_CONFIG, type GiftReceivedEvent, type GiftType } from "@douyin-game/shared";

export interface RawGiftPayload {
  roomId: string;
  senderId: string;
  giftName: string;
  giftType?: GiftType;
  giftCount?: number;
  giftValue?: number;
  targetPlayerId?: string;
}

export function normalizeGiftEvent(payload: RawGiftPayload): GiftReceivedEvent {
  const giftType = payload.giftType ?? "custom";
  const giftCount = Math.max(1, payload.giftCount ?? 1);
  const fallbackValue = GIFT_BOX_MAP[giftType] ?? GAME_CONFIG.defaultGiftBoxGain;

  return {
    type: "gift.received",
    roomId: payload.roomId,
    senderId: payload.senderId,
    giftName: payload.giftName,
    giftType,
    giftCount,
    giftValue: payload.giftValue ?? fallbackValue,
    targetPlayerId: payload.targetPlayerId,
    ts: Date.now()
  };
}

export function resolveGiftBoxGain(event: GiftReceivedEvent): number {
  const perGift = GIFT_BOX_MAP[event.giftType] ?? GAME_CONFIG.defaultGiftBoxGain;
  return Math.max(1, event.giftCount * perGift);
}
