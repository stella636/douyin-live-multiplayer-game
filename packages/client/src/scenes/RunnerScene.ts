import Phaser from "phaser";
import { Client, Room } from "colyseus.js";
import { RUNNER_CONFIG, type RunnerBlock, type RunnerLevel, type RunnerPlatform } from "@douyin-game/shared";
import { PoseJumpController } from "../camera/PoseJumpController";
import { LEVEL_1 } from "../runner/level1";
import {
  buildBlockSprite,
  buildGrassPlatform,
  createParallaxLayers,
  registerHeroAnimations,
  registerMapleAssets
} from "../runner/mapleAssets";

type RunStatus = "playing" | "won" | "lost";

type ActiveBlock = RunnerBlock & {
  sprite: Phaser.GameObjects.Container;
  broken: boolean;
};

type ActiveBridge = {
  platform: RunnerPlatform;
  sprite: Phaser.GameObjects.Container;
  expireAt: number;
};

export class RunnerScene extends Phaser.Scene {
  private level: RunnerLevel = LEVEL_1;
  private room?: Room<{ roomId: string }>;
  private readonly playerName = `冒险家${Math.floor(Math.random() * 900 + 100)}`;

  private world?: Phaser.GameObjects.Container;
  private parallax?: ReturnType<typeof createParallaxLayers>;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private hud?: Phaser.GameObjects.Text;
  private resultText?: Phaser.GameObjects.Text;

  private playerX = 80;
  private playerY = RUNNER_CONFIG.groundY - RUNNER_CONFIG.playerHeight;
  private vy = 0;
  private grounded = false;
  private lastGroundedAt = 0;
  private jumpBufferedAt = 0;
  private prevJumpDown = false;
  private status: RunStatus = "playing";
  private coins = 0;
  private shieldUntil = 0;
  private startedAt = 0;
  private scrollX = 0;

  private blocks: ActiveBlock[] = [];
  private bridges: ActiveBridge[] = [];
  private goalSprite?: Phaser.GameObjects.Container;
  private shieldAura?: Phaser.GameObjects.Arc;
  private obstacleSprites: Phaser.GameObjects.Image[] = [];

  private cameraOverlay?: HTMLElement | null;
  private cameraFeed?: HTMLVideoElement | null;
  private mediaStream?: MediaStream;
  private poseJumpController?: PoseJumpController;
  private cameraJumpDown = false;
  private cameraCalibrated = false;

  constructor() {
    super("runner");
  }

  preload() {
    registerMapleAssets(this);
  }

  async create() {
    registerHeroAnimations(this);
    this.cameras.main.setBackgroundColor("#38bdf8");
    this.startedAt = performance.now();

    this.world = this.add.container(0, 0);
    this.parallax = createParallaxLayers(this, this.level.length);
    this.world.add([
      this.parallax.sky,
      this.parallax.hills,
      this.parallax.cloudA,
      this.parallax.cloudB,
      this.parallax.cloudC
    ]);

    this.buildLevel();
    this.buildPlayer();
    this.buildHud();

    this.input.keyboard?.on("keydown-SPACE", () => this.bufferJump());
    this.input.keyboard?.on("keydown-UP", () => this.bufferJump());
    this.input.keyboard?.on("keydown-W", () => this.bufferJump());
    this.input.keyboard?.on("keydown-ONE", () => void this.triggerGift("bridge"));
    this.input.keyboard?.on("keydown-TWO", () => void this.triggerGift("shield"));

    try {
      const client = new Client(import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567");
      this.room = await client.joinOrCreate("gift-box-battle", { name: this.playerName });
      this.room.onMessage("gift:applied", () => this.applyShield());
    } catch {
      this.showToast("离线模式：1架桥 2护盾");
    }

    await this.setupCameraPreview();
    this.showToast("自动前进！摄像头起跳或 Space");
  }

  update(_time: number, delta: number) {
    if (!this.world || !this.playerSprite) {
      return;
    }

    this.updateBridges();
    if (this.status === "playing") {
      this.tickJumpInput();
      this.simulate(delta / 1000);
      this.checkGoal();
      this.checkTimeout();
    }

    this.scrollX = this.playerX - RUNNER_CONFIG.playerScreenX;
    this.world.x = -this.scrollX;
    this.playerSprite.setPosition(this.playerX, this.playerY + RUNNER_CONFIG.playerHeight);
    this.shieldAura?.setPosition(this.playerX + RUNNER_CONFIG.playerWidth / 2, this.playerY + RUNNER_CONFIG.playerHeight / 2);

    if (this.parallax) {
      this.parallax.hills.tilePositionX = this.scrollX * 0.35;
      this.parallax.cloudA.x = 200 + this.scrollX * 0.15;
      this.parallax.cloudB.x = 900 + this.scrollX * 0.22;
      this.parallax.cloudC.x = 1800 + this.scrollX * 0.18;
    }

    if (this.grounded && this.playerSprite.anims.currentAnim?.key !== "ms-run") {
      this.playerSprite.play("ms-run", true);
    } else if (!this.grounded && this.playerSprite.anims.currentAnim?.key !== "ms-jump") {
      this.playerSprite.play("ms-jump", true);
    }

    this.updateHud();
  }

  shutdown() {
    this.poseJumpController?.stop();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    void this.room?.leave();
  }

  private buildHud() {
    this.hud = this.add.text(10, 8, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#14532d",
      backgroundColor: "#fef9c3cc",
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setDepth(100).setScrollFactor(0);

    this.resultText = this.add.text(RUNNER_CONFIG.viewportWidth / 2, 70, "", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#fef08a",
      stroke: "#7c2d12",
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
  }

  private buildLevel() {
    if (!this.world) {
      return;
    }

    for (const platform of this.level.platforms) {
      this.world.add(buildGrassPlatform(this, platform));
    }

    for (const obstacle of this.level.obstacles) {
      const key = obstacle.kind === "spike" ? "ms-spike" : "ms-stump";
      const img = this.add.image(
        obstacle.x + obstacle.width / 2,
        obstacle.y + obstacle.height / 2,
        key
      );
      if (obstacle.kind === "low") {
        img.setScale(1.1);
      }
      this.world.add(img);
      this.obstacleSprites.push(img);
    }

    for (const block of this.level.blocks) {
      const sprite = buildBlockSprite(this, block.reward);
      sprite.setPosition(block.x, block.y);
      this.world.add(sprite);
      this.blocks.push({ ...block, sprite, broken: false });
    }

    const flag = this.add.image(0, -44, "ms-flag");
    const glow = this.add.circle(0, 0, 28, 0xfef08a, 0.35);
    this.goalSprite = this.add.container(this.level.goalX, RUNNER_CONFIG.groundY - 8, [glow, flag]);
    this.world.add(this.goalSprite);
    this.tweens.add({ targets: glow, scale: 1.2, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
  }

  private buildPlayer() {
    if (!this.world) {
      return;
    }

    this.playerSprite = this.add.sprite(this.playerX, this.playerY + RUNNER_CONFIG.playerHeight, "ms-hero-run-0");
    this.playerSprite.setOrigin(0.5, 1);
    this.playerSprite.play("ms-run");
    this.world.add(this.playerSprite);

    this.shieldAura = this.add.circle(0, 0, 34, 0x38bdf8, 0.22);
    this.shieldAura.setStrokeStyle(3, 0x7dd3fc, 0.8);
    this.shieldAura.setVisible(false);
    this.world.add(this.shieldAura);
  }

  private simulate(dt: number) {
    const now = performance.now();
    this.playerX += RUNNER_CONFIG.runSpeed * dt;
    this.vy += RUNNER_CONFIG.gravity * dt;
    this.playerY += this.vy * dt;

    const platforms = this.getSolidPlatforms();
    const playerBox = this.getPlayerBox();
    let landed = false;

    if (this.vy >= 0) {
      for (const platform of platforms) {
        const top = platform.y;
        const left = platform.x;
        const right = platform.x + platform.width;
        const feet = playerBox.bottom;
        const prevFeet = feet - this.vy * dt;
        if (
          playerBox.right > left + 4 &&
          playerBox.left < right - 4 &&
          feet >= top &&
          prevFeet <= top + 10
        ) {
          this.playerY = top - RUNNER_CONFIG.playerHeight;
          this.vy = 0;
          landed = true;
          break;
        }
      }
    }

    this.grounded = landed;
    if (landed) {
      this.lastGroundedAt = now;
    }

    if (this.playerY > RUNNER_CONFIG.viewportHeight + 60) {
      this.lose("掉进坑里！按 R 重开");
      return;
    }

    this.resolveBlockHits(playerBox);
    this.resolveObstacleHits(playerBox);
  }

  private getSolidPlatforms(): RunnerPlatform[] {
    return [...this.level.platforms, ...this.bridges.map((b) => b.platform)];
  }

  private getPlayerBox() {
    return {
      left: this.playerX,
      right: this.playerX + RUNNER_CONFIG.playerWidth,
      top: this.playerY,
      bottom: this.playerY + RUNNER_CONFIG.playerHeight
    };
  }

  private resolveBlockHits(playerBox: ReturnType<typeof this.getPlayerBox>) {
    if (this.vy >= 0) {
      return;
    }

    for (const block of this.blocks) {
      if (block.broken) {
        continue;
      }

      const left = block.x - 24;
      const right = block.x + 24;
      const bottom = block.y + 24;
      const top = block.y - 24;
      const head = playerBox.top;
      const prevHead = head - this.vy * (1 / 60);

      if (playerBox.right > left && playerBox.left < right && head <= bottom && prevHead >= bottom - 8) {
        this.breakBlock(block);
        this.playerY = bottom;
        this.vy = 140;
      } else if (playerBox.right > left && playerBox.left < right && head < top && playerBox.bottom > bottom) {
        this.playerY = bottom;
        this.vy = 0;
      }
    }
  }

  private breakBlock(block: ActiveBlock) {
    block.broken = true;
    this.coins += block.reward === "star" ? 5 : 1;
    this.showToast(block.reward === "star" ? "★ 顶到星星砖 +5" : "? 顶到金币砖 +1");
    this.cameras.main.shake(80, 0.004);

    const coin = this.add.image(block.x, block.y, "ms-coin").setDepth(50);
    this.tweens.add({
      targets: coin,
      y: block.y - 40,
      alpha: 0,
      scale: 1.4,
      duration: 420,
      onComplete: () => coin.destroy()
    });

    this.tweens.add({
      targets: block.sprite,
      y: block.sprite.y - 16,
      alpha: 0,
      scaleX: 0.6,
      scaleY: 0.6,
      duration: 220,
      onComplete: () => block.sprite.setVisible(false)
    });
  }

  private resolveObstacleHits(playerBox: ReturnType<typeof this.getPlayerBox>) {
    if (performance.now() < this.shieldUntil) {
      return;
    }

    for (const obstacle of this.level.obstacles) {
      if (this.intersects(playerBox, {
        left: obstacle.x,
        right: obstacle.x + obstacle.width,
        top: obstacle.y,
        bottom: obstacle.y + obstacle.height
      })) {
        this.lose(obstacle.kind === "spike" ? "碰到尖刺！按 R 重开" : "撞上木桩！按 R 重开");
        return;
      }
    }
  }

  private intersects(
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number }
  ) {
    return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
  }

  private checkGoal() {
    if (this.playerX >= this.level.goalX - 20) {
      this.win();
    }
  }

  private checkTimeout() {
    if (performance.now() - this.startedAt >= RUNNER_CONFIG.roundDurationMs) {
      this.lose("时间到！按 R 重开");
    }
  }

  private win() {
    if (this.status !== "playing") {
      return;
    }
    this.status = "won";
    this.resultText?.setText("🎉 通关成功");
    this.showToast(`到达终点！金币 ${this.coins}`);
    this.cameras.main.flash(500, 120, 220, 120, false);
    this.input.keyboard?.once("keydown-R", () => this.scene.restart());
  }

  private lose(message: string) {
    if (this.status !== "playing") {
      return;
    }
    this.status = "lost";
    this.resultText?.setText(message);
    this.cameras.main.shake(220, 0.01);
    this.input.keyboard?.once("keydown-R", () => this.scene.restart());
  }

  private tickJumpInput() {
    const now = performance.now();
    const jumpEdge = this.cameraJumpDown && !this.prevJumpDown;
    this.prevJumpDown = this.cameraJumpDown;
    if (jumpEdge) {
      this.bufferJump();
    }

    const canCoyote = now - this.lastGroundedAt <= RUNNER_CONFIG.coyoteTimeMs;
    const canBuffer = now - this.jumpBufferedAt <= RUNNER_CONFIG.jumpBufferMs;
    if (canBuffer && (this.grounded || canCoyote)) {
      this.vy = -RUNNER_CONFIG.jumpVelocity;
      this.grounded = false;
      this.jumpBufferedAt = 0;
      this.playerSprite?.setScale(1.06, 0.94);
      this.time.delayedCall(90, () => this.playerSprite?.setScale(1, 1));
    }
  }

  private bufferJump() {
    this.jumpBufferedAt = performance.now();
  }

  private async triggerGift(kind: "bridge" | "shield") {
    if (kind === "bridge") {
      this.spawnBridge();
      this.showToast("🌉 礼物架桥");
    } else {
      this.applyShield();
      this.showToast("🛡️ 礼物护盾");
    }

    if (!this.room) {
      return;
    }

    await fetch(`${import.meta.env.VITE_HTTP_SERVER_URL ?? "http://localhost:2567"}/api/mock-gift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.room.roomId,
        command: {
          senderId: this.room.sessionId,
          giftType: kind === "bridge" ? "rose" : "heart",
          giftCount: 1,
          targetPlayerId: this.room.sessionId
        }
      })
    }).catch(() => undefined);
  }

  private spawnBridge() {
    const platform: RunnerPlatform = {
      x: this.playerX + 160,
      y: RUNNER_CONFIG.groundY,
      width: 200,
      height: 24
    };
    const sprite = buildGrassPlatform(this, platform);
    sprite.setAlpha(0.95);
    this.world?.add(sprite);
    this.bridges.push({
      platform,
      sprite,
      expireAt: performance.now() + RUNNER_CONFIG.bridgeDurationMs
    });
  }

  private applyShield() {
    this.shieldUntil = performance.now() + RUNNER_CONFIG.shieldDurationMs;
    this.shieldAura?.setVisible(true);
    this.tweens.add({
      targets: this.shieldAura,
      alpha: 0.35,
      duration: 220,
      yoyo: true,
      repeat: 6
    });
    this.time.delayedCall(RUNNER_CONFIG.shieldDurationMs, () => this.shieldAura?.setVisible(false));
  }

  private updateBridges() {
    const now = performance.now();
    this.bridges = this.bridges.filter((bridge) => {
      if (bridge.expireAt > now) {
        return true;
      }
      bridge.sprite.destroy();
      return false;
    });
  }

  private updateHud() {
    const elapsed = Math.floor((performance.now() - this.startedAt) / 1000);
    const timeLeft = Math.max(0, Math.ceil(RUNNER_CONFIG.roundDurationMs / 1000) - elapsed);
    const progress = Math.min(100, Math.round((this.playerX / this.level.goalX) * 100));
    this.hud?.setText(`🍁${this.level.name}  ${progress}%  💰${this.coins}  ⏱${timeLeft}s  ${this.cameraJumpDown ? "起跳!" : "跑"}`);
  }

  private async setupCameraPreview() {
    this.cameraOverlay = document.getElementById("camera-overlay");
    this.cameraFeed = document.getElementById("camera-feed") as HTMLVideoElement | null;
    if (!this.cameraOverlay || !this.cameraFeed) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraOverlay.textContent = "无摄像头 · 用 Space 跳跃";
      return;
    }

    try {
      this.cameraOverlay.textContent = "连接摄像头...";
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: "user" },
        audio: false
      });
      this.cameraFeed.srcObject = this.mediaStream;
      this.poseJumpController = new PoseJumpController({
        onStateChange: (state) => {
          this.cameraJumpDown = state.jumpDown;
          this.cameraCalibrated = state.calibrated;
        },
        onStatusChange: (message) => {
          if (this.cameraOverlay) {
            this.cameraOverlay.textContent = message;
          }
        }
      });
      await this.poseJumpController.start(this.cameraFeed);
      this.cameraOverlay.textContent = "跳起来！顶砖块、过障碍、冲终点";
    } catch (error) {
      this.cameraOverlay.textContent = "摄像头不可用 · Space 跳跃";
      this.showToast(`摄像头失败: ${(error as Error).message}`);
    }
  }

  private showToast(message: string) {
    const text = this.add.text(RUNNER_CONFIG.viewportWidth / 2, 36, message, {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#fef08a",
      backgroundColor: "#7f1d1dcc",
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    }).setOrigin(0.5).setDepth(120).setScrollFactor(0);

    this.tweens.add({
      targets: text,
      y: 24,
      alpha: 0,
      duration: 1200,
      ease: "Quad.easeOut",
      onComplete: () => text.destroy()
    });
  }
}
