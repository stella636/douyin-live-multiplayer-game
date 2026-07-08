import Phaser from "phaser";
import { GAME_CONFIG } from "@douyin-game/shared";

const LOOT_COLORS = [0xfbbf24, 0xf472b6, 0x60a5fa, 0xa3e635, 0xf87171, 0xe879f9, 0x38bdf8];
type LootType = "sword" | "shield" | "scroll" | "potion" | "coin" | "gem";
const LOOT_TYPES: LootType[] = ["sword", "shield", "scroll", "potion", "coin", "gem"];
type LootDropResult = { type: LootType; side: "left" | "right" };

type ChestStage = "royal" | "gold" | "wood" | "cracked" | "empty";

export class BoxStack {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly bodyShade: Phaser.GameObjects.Rectangle;
  private readonly lid: Phaser.GameObjects.Rectangle;
  private readonly lidLip: Phaser.GameObjects.Rectangle;
  private readonly band: Phaser.GameObjects.Rectangle;
  private readonly lockPlate: Phaser.GameObjects.Rectangle;
  private readonly lockKeyhole: Phaser.GameObjects.Ellipse;
  private readonly cornerL: Phaser.GameObjects.Rectangle;
  private readonly cornerR: Phaser.GameObjects.Rectangle;
  private readonly sparkleL: Phaser.GameObjects.Star;
  private readonly sparkleR: Phaser.GameObjects.Star;
  private readonly counterText: Phaser.GameObjects.Text;
  private readonly hitGlow: Phaser.GameObjects.Rectangle;
  private isPlayingHit = false;
  private baseColor = 0xc4a574;
  private stage: ChestStage = "wood";

  constructor(scene: Phaser.Scene) {
    const w = GAME_CONFIG.boxWidth;
    const h = GAME_CONFIG.boxHitHeight;
    this.scene = scene;
    this.container = scene.add.container(0, 0);

    this.hitGlow = scene.add.rectangle(0, 8, w + 48, h + 44, 0xfde68a, 0);
    this.hitGlow.setStrokeStyle(8, 0xfbbf24, 0);

    this.shadow = scene.add.ellipse(0, h * 0.42, w * 0.92, 22, 0x000000, 0.22);

    // MapleStory-like wooden chest body
    this.body = scene.add.rectangle(0, 18, w, h * 0.72, 0xc4a574, 1);
    this.body.setStrokeStyle(5, 0x5b3a1a, 1);
    this.bodyShade = scene.add.rectangle(0, 34, w - 16, h * 0.28, 0xa67c52, 0.55);

    // Lid sits on top like classic adventure chests
    this.lid = scene.add.rectangle(0, -h * 0.28, w + 10, h * 0.38, 0xd4b483, 1);
    this.lid.setStrokeStyle(5, 0x5b3a1a, 1);
    this.lidLip = scene.add.rectangle(0, -h * 0.12, w + 18, 14, 0x8b5e34, 1);
    this.lidLip.setStrokeStyle(3, 0x3f2a14, 1);

    // Metal straps / lock
    this.band = scene.add.rectangle(0, 8, 28, h * 0.7, 0xf59e0b, 1);
    this.band.setStrokeStyle(3, 0xb45309, 1);
    this.lockPlate = scene.add.rectangle(0, 22, 36, 34, 0xfbbf24, 1);
    this.lockPlate.setStrokeStyle(3, 0xb45309, 1);
    this.lockKeyhole = scene.add.ellipse(0, 24, 10, 12, 0x451a03, 1);

    this.cornerL = scene.add.rectangle(-w * 0.42, 18, 16, h * 0.55, 0xf59e0b, 1);
    this.cornerR = scene.add.rectangle(w * 0.42, 18, 16, h * 0.55, 0xf59e0b, 1);
    this.cornerL.setStrokeStyle(2, 0xb45309, 1);
    this.cornerR.setStrokeStyle(2, 0xb45309, 1);

    this.sparkleL = scene.add.star(-w * 0.38, -h * 0.42, 5, 5, 12, 0xfef08a, 1);
    this.sparkleR = scene.add.star(w * 0.38, -h * 0.36, 5, 4, 10, 0xfde68a, 1);

    this.counterText = scene.add.text(0, 48, "0", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "54px",
      color: "#7f1d1d",
      stroke: "#fff7ed",
      strokeThickness: 8
    }).setOrigin(0.5);

    this.container.add([
      this.hitGlow,
      this.shadow,
      this.body,
      this.bodyShade,
      this.lid,
      this.lidLip,
      this.band,
      this.cornerL,
      this.cornerR,
      this.lockPlate,
      this.lockKeyhole,
      this.sparkleL,
      this.sparkleR,
      this.counterText
    ]);

    // Idle gentle bob
    scene.tweens.add({
      targets: this.sparkleL,
      alpha: { from: 0.4, to: 1 },
      scale: { from: 0.85, to: 1.15 },
      duration: 700,
      yoyo: true,
      repeat: -1
    });
    scene.tweens.add({
      targets: this.sparkleR,
      alpha: { from: 1, to: 0.35 },
      scale: { from: 1.1, to: 0.8 },
      duration: 900,
      yoyo: true,
      repeat: -1
    });
  }

  update(x: number, boxCount: number, color: number) {
    this.container.setPosition(x, GAME_CONFIG.boxAnchorY);
    this.baseColor = color;
    this.stage = resolveChestStage(boxCount);
    if (!this.isPlayingHit) {
      this.applyStageStyle();
    }
    this.setCount(boxCount);
  }

  setCount(boxCount: number) {
    this.counterText.setText(String(boxCount));
  }

  playHitFeedback() {
    this.isPlayingHit = true;
    this.hitGlow.setAlpha(0.7);
    this.hitGlow.setStrokeStyle(8, 0xfbbf24, 1);
    this.lid.setFillStyle(0xfde68a, 1);
    this.counterText.setColor("#b91c1c");

    // Lid pop open
    this.scene.tweens.killTweensOf([this.container, this.lid]);
    this.lid.setAngle(0);
    this.scene.tweens.add({
      targets: this.lid,
      angle: -28,
      y: this.lid.y - 18,
      duration: 120,
      yoyo: true,
      ease: "Back.easeOut"
    });

    this.scene.tweens.add({
      targets: this.container,
      y: GAME_CONFIG.boxAnchorY - 26,
      scaleX: 1.08,
      scaleY: 0.9,
      duration: 100,
      yoyo: true,
      repeat: 1,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.container.setScale(1);
        this.container.y = GAME_CONFIG.boxAnchorY;
        this.hitGlow.setAlpha(0);
        this.hitGlow.setStrokeStyle(8, 0xfbbf24, 0);
        this.counterText.setColor("#7f1d1d");
        this.applyStageStyle();
        this.lid.setAngle(0);
        this.isPlayingHit = false;
      }
    });

    const lootDrop = this.spawnLootBurst();
    this.spawnShockwave();
    return lootDrop;
  }

  private spawnShockwave() {
    const ring = this.scene.add.circle(this.container.x, this.container.y + 28, 36, 0xfde047, 0.42);
    ring.setStrokeStyle(6, 0xfbbf24, 0.95);
    this.scene.tweens.add({
      targets: ring,
      scale: 5.8,
      alpha: 0,
      duration: 620,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private spawnLootBurst(): LootDropResult {
    const originX = this.container.x;
    const originY = this.container.y + 8;
    const count = 6 + Math.floor(Math.random() * 4);
    const lootType = LOOT_TYPES[Math.floor(Math.random() * LOOT_TYPES.length)];
    const side: "left" | "right" = Math.random() > 0.5 ? "right" : "left";
    const sideDirection = side === "right" ? 1 : -1;

    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI / 2 + sideDirection * (0.2 + Math.random() * 0.7);
      const speed = 120 + Math.random() * 180;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 80;
      const color = LOOT_COLORS[i % LOOT_COLORS.length];

      let particle: Phaser.GameObjects.GameObject & { x: number; y: number; alpha: number; angle: number; scaleX: number; scaleY: number };

      if (Math.random() > 0.5) {
        particle = this.scene.add.star(originX, originY, 5, 5, 12 + Math.random() * 8, color, 1);
      } else {
        particle = this.scene.add.circle(originX, originY, 6 + Math.random() * 8, color, 1);
      }

      const duration = 700 + Math.random() * 500;
      this.scene.tweens.add({
        targets: particle,
        x: originX + vx * 0.55,
        y: originY + vy * 0.28 + 140 + Math.random() * 56,
        angle: (Math.random() - 0.5) * 420,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration,
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy()
      });
    }

    const lootIcon = this.createLootIcon(lootType, originX + sideDirection * 10, originY - 18);
    lootIcon.setScale(2.25);
    const flash = this.scene.add.circle(originX, originY + 8, 34, 0xfef08a, 0.9);
    const shadow = this.scene.add.ellipse(originX, originY + 214, 120, 30, 0x000000, 0.18);
    this.scene.tweens.add({
      targets: flash,
      scale: 3.8,
      alpha: 0,
      duration: 320,
      ease: "Cubic.easeOut",
      onComplete: () => flash.destroy()
    });
    this.scene.tweens.add({
      targets: lootIcon,
      y: originY + 232,
      x: originX + sideDirection * (170 + Math.random() * 60),
      angle: sideDirection * (18 + Math.random() * 16),
      duration: 1320,
      ease: "Bounce.easeOut",
      onComplete: () => {
        this.scene.tweens.add({
          targets: lootIcon,
          alpha: 0,
          scaleX: 1.55,
          scaleY: 1.55,
          duration: 420,
          onComplete: () => lootIcon.destroy()
        });
      }
    });
    this.scene.tweens.add({
      targets: shadow,
      scaleX: 2.2,
      alpha: 0,
      duration: 1450,
      ease: "Quad.easeOut",
      onComplete: () => shadow.destroy()
    });

    return { type: lootType, side };
  }

  private createLootIcon(type: LootType, x: number, y: number) {
    const container = this.scene.add.container(x, y);

    if (type === "coin") {
      const coinBack = this.scene.add.ellipse(0, 0, 38, 42, 0xd97706, 1);
      const coin = this.scene.add.ellipse(0, -2, 38, 42, 0xfbbf24, 1);
      coin.setStrokeStyle(4, 0xb45309, 1);
      const shine = this.scene.add.rectangle(-8, -8, 10, 26, 0xfef3c7, 0.9).setAngle(20);
      container.add([coinBack, coin, shine]);
    } else if (type === "gem") {
      const gemShadow = this.scene.add.star(0, 4, 5, 12, 26, 0x1e40af, 0.65);
      const gem = this.scene.add.star(0, -2, 5, 12, 26, 0x60a5fa, 1);
      gem.setStrokeStyle(3, 0x1d4ed8, 1);
      container.add([gemShadow, gem]);
    } else if (type === "potion") {
      const bottleBack = this.scene.add.rectangle(0, 8, 28, 36, 0x7e22ce, 0.65);
      const bottle = this.scene.add.rectangle(0, 4, 28, 36, 0xf472b6, 1);
      bottle.setStrokeStyle(3, 0x7e22ce, 1);
      const cap = this.scene.add.rectangle(0, -20, 14, 10, 0x92400e, 1);
      const liquid = this.scene.add.rectangle(0, 10, 18, 18, 0xf9a8d4, 0.75);
      container.add([bottleBack, bottle, cap, liquid]);
    } else if (type === "scroll") {
      const paper = this.scene.add.rectangle(0, 0, 28, 38, 0xfef3c7, 1);
      paper.setStrokeStyle(3, 0x92400e, 1);
      const rollTop = this.scene.add.ellipse(0, -20, 24, 10, 0xf59e0b, 0.9);
      const rollBottom = this.scene.add.ellipse(0, 20, 24, 10, 0xf59e0b, 0.9);
      const line1 = this.scene.add.rectangle(0, -8, 14, 2, 0x92400e, 0.8);
      const line2 = this.scene.add.rectangle(0, 4, 12, 2, 0x92400e, 0.8);
      container.add([paper, rollTop, rollBottom, line1, line2]);
    } else if (type === "shield") {
      const shieldBack = this.scene.add.triangle(0, 4, 0, -24, 22, -6, 0, 30, 0x1e3a8a, 0.7);
      const shield = this.scene.add.triangle(0, 0, 0, -24, 22, -6, 0, 30, 0x38bdf8, 1);
      shield.setStrokeStyle(4, 0x1e40af, 1);
      const crest = this.scene.add.circle(0, 4, 6, 0xfef08a, 0.9);
      container.add([shieldBack, shield, crest]);
    } else {
      const bladeBack = this.scene.add.rectangle(2, -6, 8, 40, 0x94a3b8, 0.55);
      const blade = this.scene.add.rectangle(0, -8, 8, 40, 0xe5e7eb, 1);
      blade.setStrokeStyle(2, 0x94a3b8, 1);
      const guard = this.scene.add.rectangle(0, 8, 22, 6, 0xfbbf24, 1);
      const handle = this.scene.add.rectangle(0, 20, 7, 14, 0x7c2d12, 1);
      container.add([bladeBack, blade, guard, handle]);
    }

    return container;
  }

  private applyStageStyle() {
    const style = getStageStyle(this.stage, this.baseColor);
    this.body.setFillStyle(style.body, 1);
    this.bodyShade.setFillStyle(style.shade, 0.65);
    this.lid.setFillStyle(style.lid, 1);
    this.lidLip.setFillStyle(style.lidLip, 1);
    this.band.setFillStyle(style.band, 1);
    this.lockPlate.setFillStyle(style.lock, 1);
    this.cornerL.setFillStyle(style.band, 1);
    this.cornerR.setFillStyle(style.band, 1);
    this.sparkleL.setVisible(style.sparkles);
    this.sparkleR.setVisible(style.sparkles);

    if (this.stage === "cracked") {
      this.counterText.setScale(0.94);
      this.bodyShade.setAngle(-2);
    } else if (this.stage === "empty") {
      this.counterText.setScale(0.88);
      this.bodyShade.setAlpha(0.35);
      this.lid.setAngle(-8);
    } else {
      this.counterText.setScale(1);
      this.bodyShade.setAngle(0);
      this.bodyShade.setAlpha(0.65);
    }
  }

  destroy() {
    this.container.destroy(true);
  }
}

function blendWoodColor(tint: number) {
  // Keep wooden base while letting team tint softly show
  const wood = 0xc4a574;
  return mixColor(wood, tint, 0.25);
}

function resolveChestStage(boxCount: number): ChestStage {
  if (boxCount <= 0) {
    return "empty";
  }
  if (boxCount >= 20) {
    return "royal";
  }
  if (boxCount >= 10) {
    return "gold";
  }
  if (boxCount >= 4) {
    return "wood";
  }
  return "cracked";
}

function getStageStyle(stage: ChestStage, tint: number) {
  switch (stage) {
    case "royal":
      return {
        body: mixColor(0x7c3aed, tint, 0.16),
        shade: 0x5b21b6,
        lid: 0xa78bfa,
        lidLip: 0x6d28d9,
        band: 0xfbbf24,
        lock: 0xfde68a,
        sparkles: true
      };
    case "gold":
      return {
        body: mixColor(0xd4a72c, tint, 0.12),
        shade: 0xb7791f,
        lid: 0xf4d35e,
        lidLip: 0xb45309,
        band: 0x92400e,
        lock: 0xfef08a,
        sparkles: true
      };
    case "wood":
      return {
        body: blendWoodColor(tint),
        shade: 0xa67c52,
        lid: blendLidColor(tint),
        lidLip: 0x8b5e34,
        band: 0xf59e0b,
        lock: 0xfbbf24,
        sparkles: true
      };
    case "cracked":
      return {
        body: mixColor(0x8b6a43, tint, 0.1),
        shade: 0x6b4f31,
        lid: 0xa9835c,
        lidLip: 0x5b3a1a,
        band: 0x78716c,
        lock: 0xa8a29e,
        sparkles: false
      };
    case "empty":
      return {
        body: 0x4b5563,
        shade: 0x374151,
        lid: 0x9ca3af,
        lidLip: 0x4b5563,
        band: 0x6b7280,
        lock: 0xd1d5db,
        sparkles: false
      };
  }
}

function blendLidColor(tint: number) {
  const lid = 0xd4b483;
  return mixColor(lid, tint, 0.2);
}

function mixColor(a: number, b: number, t: number) {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
