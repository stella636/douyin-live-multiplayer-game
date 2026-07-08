import Phaser from "phaser";
import { Client, Room } from "colyseus.js";
import {
  RUNNER_CONFIG,
  getObstacleBreathDistance,
  type RunnerPlatform
} from "@douyin-game/shared";
import { PoseJumpController } from "../camera/PoseJumpController";
import { LEVEL_1 } from "../runner/level1";
import {
  createParallaxLayers,
  registerHeroAnimations,
  registerMapleAssets
} from "../runner/mapleAssets";
import {
  pickObstacleKind,
  rebuildPlatformVisuals,
  spawnObstacle,
  splitPlatformForCliff,
  type SpawnedObstacle
} from "../runner/obstacleSpawner";

type RunStatus = "playing" | "won" | "lost";

export class RunnerScene extends Phaser.Scene {
  private level = LEVEL_1;
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
  private startedAt = 0;
  private scrollX = 0;

  private platformSegments: RunnerPlatform[] = [...this.level.platforms];
  private readonly platformVisuals: Phaser.GameObjects.Container[] = [];
  private readonly spawnedObstacles: SpawnedObstacle[] = [];
  private pendingObstacleCount = 0;
  private nextSpawnWorldX = 0;
  private totalSpawned = 0;
  private goalSprite?: Phaser.GameObjects.Container;

  private cameraOverlay?: HTMLElement | null;
  private cameraFeed?: HTMLVideoElement | null;
  private mediaStream?: MediaStream;
  private poseJumpController?: PoseJumpController;
  private cameraJumpDown = false;

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
    this.nextSpawnWorldX = this.playerX + RUNNER_CONFIG.runSpeed * 12;

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
    this.input.keyboard?.on("keydown-ONE", () => {
      this.queueGiftObstacles(1, "玫瑰");
      void this.triggerMockGift(1);
    });
    this.input.keyboard?.on("keydown-TWO", () => {
      this.queueGiftObstacles(2, "小心心");
      void this.triggerMockGift(2);
    });
    this.input.keyboard?.on("keydown-THREE", () => {
      this.queueGiftObstacles(3, "钻石");
      void this.triggerMockGift(3);
    });

    try {
      const client = new Client(import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567");
      this.room = await client.joinOrCreate("gift-box-battle", { name: this.playerName });
      this.room.onMessage("gift:applied", (payload: { giftName?: string; gain?: number }) => {
        const count = Math.max(1, payload.gain ?? 1);
        this.queueGiftObstacles(count, payload.giftName ?? "礼物");
      });
    } catch {
      this.showToast("离线模式：1/2/3 模拟刷礼物加障碍");
    }

    await this.setupCameraPreview();
    this.showToast("平安大道：无障碍约30分钟通关，礼物会加障碍");
  }

  update(_time: number, delta: number) {
    if (!this.world || !this.playerSprite) {
      return;
    }

    if (this.status === "playing") {
      this.tickJumpInput();
      this.tickObstacleSpawner();
      this.simulate(delta / 1000);
      this.checkGoal();
    }

    this.scrollX = this.playerX - RUNNER_CONFIG.playerScreenX;
    this.world.x = -this.scrollX;
    this.playerSprite.setPosition(this.playerX, this.playerY + RUNNER_CONFIG.playerHeight);

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
    this.hud = this.add.text(8, 6, "", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#14532d",
      backgroundColor: "#fef9c3cc",
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setDepth(100).setScrollFactor(0);

    this.resultText = this.add.text(RUNNER_CONFIG.viewportWidth / 2, 68, "", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#fef08a",
      stroke: "#7c2d12",
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
  }

  private buildLevel() {
    if (!this.world) {
      return;
    }

    rebuildPlatformVisuals(this, this.world, this.platformSegments, this.platformVisuals);

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
  }

  private queueGiftObstacles(count: number, label: string) {
    this.pendingObstacleCount += count;
    const delaySec = RUNNER_CONFIG.giftSpawnDelaySeconds;
    this.nextSpawnWorldX = Math.max(
      this.nextSpawnWorldX,
      this.playerX + RUNNER_CONFIG.runSpeed * delaySec
    );
    this.showGiftBanner(`${label} x${count} → ${delaySec}s 后路上 +${count} 障碍`);
  }

  private async triggerMockGift(count: number) {
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
          giftType: "rose",
          giftCount: count,
          targetPlayerId: this.room.sessionId
        }
      })
    }).catch(() => undefined);
  }

  private tickObstacleSpawner() {
    const breath = getObstacleBreathDistance();
    const spawnLead = RUNNER_CONFIG.runSpeed * RUNNER_CONFIG.giftSpawnDelaySeconds;

    if (this.pendingObstacleCount > 0 && this.nextSpawnWorldX < this.playerX + spawnLead) {
      this.nextSpawnWorldX = Math.max(this.nextSpawnWorldX, this.playerX + spawnLead);
    }

    while (this.pendingObstacleCount > 0 && this.playerX + 720 >= this.nextSpawnWorldX - 40) {
      this.placeObstacle(this.nextSpawnWorldX);
      this.pendingObstacleCount -= 1;
      this.nextSpawnWorldX += breath;
    }
  }

  private placeObstacle(x: number) {
    if (!this.world) {
      return;
    }

    const kind = pickObstacleKind();
    const spawned = spawnObstacle(this, this.world, kind, x);

    if (kind === "cliff") {
      this.platformSegments = splitPlatformForCliff(
        this.platformSegments,
        x,
        RUNNER_CONFIG.cliffGapWidth
      );
      rebuildPlatformVisuals(this, this.world, this.platformSegments, this.platformVisuals);
    }

    this.spawnedObstacles.push(spawned);
    this.totalSpawned += 1;
    this.showToast(`前方出现：${kind === "cliff" ? "悬崖" : kind === "wall" ? "高墙" : "顶一顶"}`);
  }

  private simulate(dt: number) {
    const now = performance.now();
    this.playerX += RUNNER_CONFIG.runSpeed * dt;
    this.vy += RUNNER_CONFIG.gravity * dt;
    this.playerY += this.vy * dt;

    const playerBox = this.getPlayerBox();
    let landed = false;

    if (this.vy >= 0) {
      for (const platform of this.platformSegments) {
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
      this.lose("掉进悬崖！按 R 重开");
      return;
    }

    this.resolveHeadBlocks(playerBox);
    this.resolveWallHits(playerBox);
  }

  private getPlayerBox() {
    return {
      left: this.playerX,
      right: this.playerX + RUNNER_CONFIG.playerWidth,
      top: this.playerY,
      bottom: this.playerY + RUNNER_CONFIG.playerHeight
    };
  }

  private resolveHeadBlocks(playerBox: ReturnType<typeof this.getPlayerBox>) {
    if (this.vy >= 0) {
      return;
    }

    for (const obstacle of this.spawnedObstacles) {
      const block = obstacle.headBlock;
      if (!block || block.broken) {
        continue;
      }

      const left = block.x - 24;
      const right = block.x + 24;
      const bottom = block.y + 24;
      const top = block.y - 24;
      const head = playerBox.top;
      const prevHead = head - this.vy * (1 / 60);

      if (playerBox.right > left && playerBox.left < right && head <= bottom && prevHead >= bottom - 8) {
        block.broken = true;
        this.coins += 1;
        this.vy = 120;
        this.playerY = bottom;
        this.showToast("顶一顶！+1 金币");
        this.tweens.add({
          targets: block.sprite,
          y: block.sprite.y - 14,
          alpha: 0,
          duration: 220,
          onComplete: () => block.sprite.setVisible(false)
        });
      } else if (playerBox.right > left && playerBox.left < right && head < top && playerBox.bottom > bottom) {
        this.playerY = bottom;
        this.vy = 0;
      }
    }
  }

  private resolveWallHits(playerBox: ReturnType<typeof this.getPlayerBox>) {
    for (const obstacle of this.spawnedObstacles) {
      if (!obstacle.hitbox || obstacle.kind !== "wall") {
        continue;
      }
      const box = obstacle.hitbox;
      if (this.intersects(playerBox, {
        left: box.x,
        right: box.x + box.width,
        top: box.y,
        bottom: box.y + box.height
      })) {
        this.lose("撞上高墙！按 R 重开");
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
    if (this.playerX >= this.level.goalX) {
      this.win();
    }
  }

  private win() {
    if (this.status !== "playing") {
      return;
    }
    this.status = "won";
    this.resultText?.setText("🎉 通关成功");
    this.showToast(`到达终点！障碍 ${this.totalSpawned} 个，金币 ${this.coins}`);
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

  private updateHud() {
    const elapsed = Math.floor((performance.now() - this.startedAt) / 1000);
    const progress = Math.min(100, Math.round((this.playerX / this.level.goalX) * 100));
    const etaMin = Math.max(0, Math.ceil((RUNNER_CONFIG.levelDurationSeconds - elapsed) / 60));
    this.hud?.setText(
      `🍁${this.level.name} ${progress}% | 已走${Math.floor(elapsed / 60)}分${elapsed % 60}秒 | 预计剩余${etaMin}分 | 障碍${this.totalSpawned} 队列${this.pendingObstacleCount}`
    );
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
        },
        onStatusChange: (message) => {
          if (this.cameraOverlay) {
            this.cameraOverlay.textContent = message;
          }
        }
      });
      await this.poseJumpController.start(this.cameraFeed);
      this.cameraOverlay.textContent = "跳起来过悬崖/高墙，顶一顶砖块";
    } catch (error) {
      this.cameraOverlay.textContent = "摄像头不可用 · Space 跳跃";
      this.showToast(`摄像头失败: ${(error as Error).message}`);
    }
  }

  private showGiftBanner(message: string) {
    this.showToast(message);
    const banner = this.add.text(RUNNER_CONFIG.viewportWidth / 2, 82, message, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#fef08a",
      backgroundColor: "#9f1239cc",
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    }).setOrigin(0.5).setDepth(130).setScrollFactor(0);
    this.tweens.add({
      targets: banner,
      y: 66,
      alpha: 0,
      duration: 1500,
      onComplete: () => banner.destroy()
    });
  }

  private showToast(message: string) {
    const text = this.add.text(RUNNER_CONFIG.viewportWidth / 2, 34, message, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#fef08a",
      backgroundColor: "#7f1d1dcc",
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    }).setOrigin(0.5).setDepth(120).setScrollFactor(0);

    this.tweens.add({
      targets: text,
      y: 22,
      alpha: 0,
      duration: 1100,
      ease: "Quad.easeOut",
      onComplete: () => text.destroy()
    });
  }
}
