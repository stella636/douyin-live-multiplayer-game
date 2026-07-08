import type { MockGiftCommand } from "@douyin-game/shared";
import { normalizeGiftEvent } from "./giftNormalizer.js";
import { liveBridge } from "./liveBridge.js";

export function emitMockGift(roomId: string, command: MockGiftCommand) {
  const event = normalizeGiftEvent({
    roomId,
    senderId: command.senderId,
    giftName: command.giftType ?? "rose",
    giftType: command.giftType,
    giftCount: command.giftCount,
    targetPlayerId: command.targetPlayerId
  });

  liveBridge.emitGift(event);
  return event;
}
