import Phaser from "phaser";
import { Client, Room } from "colyseus.js";
import { RUNNER_CONFIG, RUNNER_RULES, type RunnerBlock, type RunnerLevel, type RunnerObstacle, type RunnerPlatform } from "@douyin-game/shared";
import { PoseJumpController } from "../camera/PoseJumpController";
import { LEVEL_1 } from "../runner/level1";

type RunStatus = "playing" | "won" | "lost";

type ActiveBlock = RunnerBlock & {
  sprite: Phaser.GameObjects.Container;
  broken: boolean;
};

type ActiveBridge = {
  platform: RunnerPlatform;
  sprite: Phaser.GameObjects.Rectangle;
  expireAt: number;
};

export class RunnerScene extends Phaser.Scene {
  private level: RunnerLevel = LEVEL_1;
  private room?: Room<{ roomId: string }>;
  private readonly playerName = `冒险家${Math.floor(Math.random() * 900 + 100)}`;

  private world?: Phaser.GameObjects.Container;
  private playerContainer?: Phaser.GameObjects.Container;
  private hud?: Phaser.GameObjects.Text;
  private help?: Phaser.GameObjects.Text;
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

  private platformSprites: Phaser.GameObjects.Rectangle[] = [];
  private obstacleSprites: Phaser.GameObjects.Rectangle[] = [];
  private blocks: ActiveBlock[] = [];
  private bridges: ActiveBridge[] = [];
  private goalSprite?: Phaser.GameObjects.Container;
  private shieldAura?: Phaser.GameObjects.Arc;

  private cameraOverlay?: HTMLElement | null;
  private cameraFeed?: HTMLVideoElement | null;
  private mediaStream?: MediaStream;
  private poseJumpController?: PoseJumpController;
  private cameraJumpDown = false;
  private cameraCalibrated = false;

  constructor() {
    super("runner");
  }

  async create() {
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.startedAt = performance.now();

    this.world = this.add.container(0, 0);
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
      this.showToast("离线模式：礼物快捷键仍可用");
    }

    await this.setupCameraPreview();
    this.showToast("自动前进！跳起来过坑、顶砖块、到达终点");
  }

  update(_time: number, delta: number) {
    if (!this.world || !this.playerContainer) {
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
    this.playerContainer.setPosition(this.playerX, this.playerY);
    this.shieldAura?.setPosition(this.playerX + RUNNER_CONFIG.playerWidth / 2, this.playerY + RUNNER_CONFIG.playerHeight / 2);
    this.updateHud();
  }

  shutdown() {
    this.poseJumpController?.stop();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    void this.room?.leave();
  }

  private buildHud() {
    this.hud = this.add.text(20, 20, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f8fafc",
      stroke: "#020617",
      strokeThickness: 4
    }).setDepth(100);

    this.help = this.add.text(20, 52, [
      "冒险岛式闯关 MVP",
      "角色自动前进，摄像头起跳或按 Space 跳跃",
      "顶砖块拿金币，躲障碍，到达终点旗通关",
      `礼物/调试：1 架桥  2 护盾  (${RUNNER_RULES.giftBridge})`
    ], {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#cbd5e1",
      lineSpacing: 8,
      stroke: "#020617",
      strokeThickness: 3
    }).setDepth(100);

    this.resultText = this.add.text(RUNNER_CONFIG.viewportWidth / 2, 120, "", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#fef08a",
      stroke: "#7c2d12",
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(101);
  }

  private buildLevel() {
    if (!this.world) {
      return;
    }

    const skyBand = this.add.rectangle(this.level.length / 2, 120, this.level.length, 240, 0x0f172a, 0.18);
    this.world.add(skyBand);

    for (const platform of this.level.platforms) {
      const height = platform.height ?? RUNNER_CONFIG.viewportHeight - platform.y;
      const rect = this.add.rectangle(
        platform.x + platform.width / 2,
        platform.y + height / 2,
        platform.width,
        height,
        0x166534,
        0.92
      );
      rect.setStrokeStyle(3, 0x4ade80, 0.8);
      const top = this.add.rectangle(platform.x + platform.width / 2, platform.y, platform.width, 10, 0x86efac, 1);
      this.world.add([rect, top]);
      this.platformSprites.push(rect);
    }

    for (const obstacle of this.level.obstacles) {
      const color = obstacle.kind === "spike" ? 0xef4444 : 0xb45309;
      const rect = this.add.rectangle(
        obstacle.x + obstacle.width / 2,
        obstacle.y + obstacle.height / 2,
        obstacle.width,
        obstacle.height,
        color,
        1
      );
      rect.setStrokeStyle(2, 0x7f1d1d, 1);
      this.world.add(rect);
      this.obstacleSprites.push(rect);
    }

    for (const block of this.level.blocks) {
      const sprite = this.createBlockSprite(block);
      this.world.add(sprite);
      this.blocks.push({ ...block, sprite, broken: false });
    }

    this.goalSprite = this.createGoalSprite(this.level.goalX);
    this.world.add(this.goalSprite);
  }

  private buildPlayer() {
    if (!this.world) {
      return;
    }

    const body = this.add.rectangle(0, 18, 30, 34, 0x60a5fa, 1);
    body.setStrokeStyle(2, 0x1d4ed8, 1);
    const head = this.add.circle(0, -8, 12, 0xfcd34d, 1);
    head.setStrokeStyle(2, 0xb45309, 1);
    const eye = this.add.circle(4, -10, 2, 0x111827, 1);
    const bootL = this.add.rectangle(-8, 34, 12, 8, 0x7c2d12, 1);
    const bootR = this.add.rectangle(8, 34, 12, 8, 0x7c2d12, 1);

    this.playerContainer = this.add.container(this.playerX, this.playerY, [bootL, bootR, body, head, eye]);
    this.world.add(this.playerContainer);

    this.shieldAura = this.add.circle(0, 0, 34, 0x38bdf8, 0.22);
    this.shieldAura.setStrokeStyle(3, 0x7dd3fc, 0.8);
    this.shieldAura.setVisible(false);
    this.world.add(this.shieldAura);
  }

  private createBlockSprite(block: RunnerBlock) {
    const fill = block.reward === "star" ? 0xfbbf24 : 0xea580c;
    const body = this.add.rectangle(0, 0, 44, 44, fill, 1);
    body.setStrokeStyle(3, 0x7c2d12, 1);
    const mark = this.add.text(0, 0, block.reward === "star" ? "★" : "?", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#fff7ed"
    }).setOrigin(0.5);
    return this.add.container(block.x, block.y, [body, mark]);
  }

  private createGoalSprite(goalX: number) {
    const pole = this.add.rectangle(0, -70, 8, 140, 0xe2e8f0, 1);
    const flag = this.add.triangle(24, -118, 0, -20, 48, 0, 0, 20, 0x22c55e, 1);
    const base = this.add.rectangle(0, 0, 60, 12, 0x94a3b8, 1);
    const label = this.add.text(0, -150, "终点", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#fef08a"
    }).setOrigin(0.5);
    return this.add.container(goalX, RUNNER_CONFIG.groundY - 6, [base, pole, flag, label]);
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
          prevFeet <= top + 8
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

    if (this.playerY > RUNNER_CONFIG.viewportHeight + 80) {
      this.lose("掉进坑里啦！按 R 重开");
      return;
    }

    this.resolveBlockHits(playerBox);
    this.resolveObstacleHits(playerBox);
  }

  private getSolidPlatforms(): RunnerPlatform[] {
    const bridges = this.bridges.map((bridge) => bridge.platform);
    return [...this.level.platforms, ...bridges];
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

      const left = block.x - 22;
      const right = block.x + 22;
      const bottom = block.y + 22;
      const top = block.y - 22;
      const head = playerBox.top;
      const prevHead = head - this.vy * (1 / 60);

      if (
        playerBox.right > left &&
        playerBox.left < right &&
        head <= bottom &&
        prevHead >= bottom - 6
      ) {
        this.breakBlock(block);
        this.playerY = bottom;
        this.vy = 120;
      } else if (playerBox.right > left && playerBox.left < right && head < top && playerBox.bottom > bottom) {
        this.playerY = bottom;
        this.vy = 0;
      }
    }
  }

  private breakBlock(block: ActiveBlock) {
    if (block.broken) {
      return;
    }
    block.broken = true;
    this.coins += block.reward === "star" ? 5 : 1;
    this.showToast(block.reward === "star" ? "顶到星星砖！+5" : "顶到金币砖！+1");
    this.tweens.add({
      targets: block.sprite,
      y: block.sprite.y - 18,
      alpha: 0,
      scaleX: 0.7,
      scaleY: 0.7,
      duration: 260,
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
        this.lose(obstacle.kind === "spike" ? "碰到尖刺！按 R 重开" : "撞上障碍！按 R 重开");
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
    this.resultText?.setText("通关成功！");
    this.showToast(`到达终点，金币 ${this.coins}`);
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
      this.playerContainer?.setScale(1.04, 0.94);
      this.time.delayedCall(90, () => this.playerContainer?.setScale(1, 1));
    }
  }

  private bufferJump() {
    this.jumpBufferedAt = performance.now();
  }

  private async triggerGift(kind: "bridge" | "shield") {
    if (kind === "bridge") {
      this.spawnBridge();
      this.showToast("礼物生效：前方生成临时桥");
    } else {
      this.applyShield();
      this.showToast("礼物生效：护盾 3 秒");
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
    const startX = this.playerX + 180;
    const platform: RunnerPlatform = {
      x: startX,
      y: RUNNER_CONFIG.groundY,
      width: 220,
      height: 24
    };
    const sprite = this.add.rectangle(
      platform.x + platform.width / 2,
      platform.y + 12,
      platform.width,
      24,
      0x38bdf8,
      0.95
    );
    sprite.setStrokeStyle(3, 0x0ea5e9, 1);
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
    const shieldLeft = Math.max(0, Math.ceil((this.shieldUntil - performance.now()) / 1000));
    this.hud?.setText([
      `关卡: ${this.level.name}`,
      `进度: ${Math.min(100, Math.round((this.playerX / this.level.goalX) * 100))}%`,
      `金币: ${this.coins}`,
      `剩余时间: ${timeLeft}s`,
      `摄像头: ${this.cameraCalibrated ? (this.cameraJumpDown ? "起跳中" : "已就绪") : "校准中"}`,
      `护盾: ${shieldLeft > 0 ? `${shieldLeft}s` : "无"}`
    ]);
  }

  private async setupCameraPreview() {
    this.cameraOverlay = document.getElementById("camera-overlay");
    this.cameraFeed = document.getElementById("camera-feed") as HTMLVideoElement | null;
    if (!this.cameraOverlay || !this.cameraFeed) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraOverlay.textContent = "当前浏览器不支持摄像头，可用 Space 跳跃";
      return;
    }

    try {
      this.cameraOverlay.textContent = "正在连接摄像头...";
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
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
      this.cameraOverlay.textContent = "摄像头就绪：跳起来闯关！";
    } catch (error) {
      this.cameraOverlay.textContent = "摄像头不可用，可用 Space 跳跃";
      this.showToast(`摄像头启动失败: ${(error as Error).message}`);
    }
  }

  private showToast(message: string) {
    const text = this.add.text(RUNNER_CONFIG.viewportWidth / 2, 170, message, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#fef08a",
      backgroundColor: "#7f1d1dcc",
      padding: { left: 14, right: 14, top: 8, bottom: 8 }
    }).setOrigin(0.5).setDepth(120);

    this.tweens.add({
      targets: text,
      y: 130,
      alpha: 0,
      duration: 1400,
      ease: "Quad.easeOut",
      onComplete: () => text.destroy()
    });
  }
}
