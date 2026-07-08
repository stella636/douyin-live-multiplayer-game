import { normalizeGiftEvent } from "./giftNormalizer.js";
import { liveBridge } from "./liveBridge.js";

export interface DouyinGiftPayload {
  roomId: string;
  userId: string;
  giftName: string;
  repeatCount?: number;
  diamondCount?: number;
  targetPlayerId?: string;
}

export class DouyinIngestService {
  private connected = false;

  async connect() {
    this.connected = true;
  }

  async disconnect() {
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }

  ingestGift(payload: DouyinGiftPayload) {
    if (!this.connected) {
      throw new Error("Douyin ingest service is not connected.");
    }

    const event = normalizeGiftEvent({
      roomId: payload.roomId,
      senderId: payload.userId,
      giftName: payload.giftName,
      giftType: "custom",
      giftCount: payload.repeatCount ?? 1,
      giftValue: payload.diamondCount,
      targetPlayerId: payload.targetPlayerId
    });

    liveBridge.emitGift(event);
    return event;
  }
}

export const douyinIngestService = new DouyinIngestService();
