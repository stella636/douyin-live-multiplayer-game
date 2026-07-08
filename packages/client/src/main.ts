import Phaser from "phaser";
import { RUNNER_CONFIG } from "@douyin-game/shared";
import { RunnerScene } from "./scenes/RunnerScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-layer",
  width: RUNNER_CONFIG.viewportWidth,
  height: RUNNER_CONFIG.viewportHeight,
  backgroundColor: "rgba(0,0,0,0)",
  transparent: true,
  scene: [RunnerScene]
});

window.addEventListener("beforeunload", () => {
  game.destroy(true);
});
