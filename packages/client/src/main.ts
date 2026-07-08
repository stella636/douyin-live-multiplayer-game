import Phaser from "phaser";
import { RUNNER_CONFIG } from "@douyin-game/shared";
import { RunnerScene } from "./scenes/RunnerScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-stage",
  width: RUNNER_CONFIG.viewportWidth,
  height: RUNNER_CONFIG.viewportHeight,
  backgroundColor: "#38bdf8",
  transparent: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [RunnerScene]
});

window.addEventListener("beforeunload", () => {
  game.destroy(true);
});
