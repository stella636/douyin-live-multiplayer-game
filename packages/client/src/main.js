import Phaser from "phaser";
import { GAME_CONFIG } from "@douyin-game/shared";
import { GameScene } from "./scenes/GameScene";
const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-layer",
    width: GAME_CONFIG.mapWidth,
    height: GAME_CONFIG.mapHeight,
    backgroundColor: "rgba(0,0,0,0)",
    transparent: true,
    scene: [GameScene]
});
window.addEventListener("beforeunload", () => {
    game.destroy(true);
});
