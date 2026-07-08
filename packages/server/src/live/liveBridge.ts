import { EventEmitter } from "node:events";
import type { GiftReceivedEvent } from "@douyin-game/shared";

class LiveBridge extends EventEmitter {
  emitGift(event: GiftReceivedEvent) {
    this.emit("gift", event);
  }
}

export const liveBridge = new LiveBridge();
