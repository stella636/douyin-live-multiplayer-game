import Phaser from "phaser";
import { GAME_CONFIG, getPlayerBoxAnchorX, type PlayerSnapshot } from "@douyin-game/shared";
import { BoxStack } from "./BoxStack";

function parseColor(color: string) {
  return Number.parseInt(color.replace("#", "0x"), 16);
}

export class PlayerAvatar {
  private readonly boxStack: BoxStack;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private displayedCount = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.boxStack = new BoxStack(scene);
    this.nameLabel = scene.add.text(0, 0, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#fef3c7",
      stroke: "#7f1d1d",
      strokeThickness: 4
    }).setOrigin(0.5);
  }

  sync(snapshot: PlayerSnapshot, isLocal: boolean, slotIndex: number, totalSlots: number) {
    const fill = parseColor(snapshot.color);
    const boxX = getPlayerBoxAnchorX(slotIndex, GAME_CONFIG.maxPlayers || totalSlots);
    this.displayedCount = snapshot.boxCount;
    this.boxStack.update(boxX, this.displayedCount, fill);
    this.nameLabel.setText(isLocal ? "冒险宝箱" : `${snapshot.name} 的宝箱`);
    this.nameLabel.setPosition(boxX, GAME_CONFIG.boxAnchorY + GAME_CONFIG.boxHitHeight * 0.5 + 34);
  }

  applyConsumedCount(boxCount: number) {
    this.displayedCount = boxCount;
    this.boxStack.setCount(boxCount);
    return this.boxStack.playHitFeedback();
  }

  flashHit() {
    this.boxStack.playHitFeedback();
  }

  destroy() {
    this.nameLabel.destroy();
    this.boxStack.destroy();
  }
}
