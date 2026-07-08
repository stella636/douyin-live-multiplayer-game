import Phaser from "phaser";

function drawRoundedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: number,
  alpha = 1
) {
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, r);
}

export function registerMapleAssets(scene: Phaser.Scene) {
  if (scene.textures.exists("ms-grass")) {
    return;
  }

  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.clear();
  drawRoundedRect(g, 0, 10, 64, 22, 8, 0x4ade80);
  drawRoundedRect(g, 4, 0, 56, 18, 10, 0x86efac);
  drawRoundedRect(g, 0, 24, 64, 40, 4, 0x92400e);
  g.generateTexture("ms-grass", 64, 64);

  g.clear();
  drawRoundedRect(g, 0, 0, 64, 64, 6, 0x78350f);
  drawRoundedRect(g, 6, 6, 52, 20, 4, 0x92400e, 0.7);
  g.generateTexture("ms-dirt", 64, 64);

  g.clear();
  drawRoundedRect(g, 0, 0, 48, 48, 6, 0xf97316);
  drawRoundedRect(g, 4, 4, 40, 40, 4, 0xea580c);
  g.generateTexture("ms-brick", 48, 48);

  g.clear();
  drawRoundedRect(g, 0, 0, 48, 48, 6, 0xfbbf24);
  drawRoundedRect(g, 4, 4, 40, 40, 4, 0xf59e0b);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(24, 24, 10);
  g.fillStyle(0xf59e0b, 1);
  g.fillRect(22, 14, 4, 20);
  g.generateTexture("ms-question", 48, 48);

  g.clear();
  g.fillStyle(0xfbbf24, 1);
  g.fillCircle(16, 16, 14);
  g.fillStyle(0xfef08a, 0.9);
  g.fillCircle(12, 12, 5);
  g.generateTexture("ms-coin", 32, 32);

  g.clear();
  g.fillStyle(0xef4444, 1);
  g.fillTriangle(16, 0, 32, 28, 0, 28);
  g.fillStyle(0xffffff, 0.9);
  g.fillTriangle(16, 8, 24, 24, 8, 24);
  g.generateTexture("ms-spike", 32, 28);

  g.clear();
  drawRoundedRect(g, 0, 8, 40, 24, 6, 0xb45309);
  drawRoundedRect(g, 4, 0, 32, 16, 8, 0xd97706);
  g.generateTexture("ms-stump", 40, 32);

  g.clear();
  g.fillStyle(0x93c5fd, 0.35);
  g.fillEllipse(120, 70, 220, 90);
  g.fillStyle(0x6ee7b7, 0.45);
  g.fillEllipse(300, 90, 260, 100);
  g.fillStyle(0x34d399, 0.35);
  g.fillEllipse(520, 75, 200, 80);
  g.generateTexture("ms-hills", 720, 160);

  g.clear();
  g.fillStyle(0xffffff, 0.85);
  g.fillEllipse(40, 30, 70, 28);
  g.fillEllipse(70, 24, 50, 20);
  g.fillStyle(0xffffff, 0.65);
  g.fillEllipse(150, 40, 90, 30);
  g.generateTexture("ms-cloud", 220, 70);

  for (let frame = 0; frame < 4; frame += 1) {
    g.clear();
    const bob = frame % 2 === 0 ? 0 : 2;
    g.fillStyle(0x1d4ed8, 1);
    g.fillRoundedRect(10, 28 + bob, 12, 18, 4);
    g.fillRoundedRect(30, 28 - bob, 12, 18, 4);
    g.fillStyle(0xf472b6, 1);
    g.fillCircle(26, 14 + bob, 14);
    g.fillStyle(0xfcd34d, 1);
    g.fillCircle(26, 12 + bob, 12);
    g.fillStyle(0x111827, 1);
    g.fillCircle(30, 12 + bob, 2);
    g.fillStyle(0x7c2d12, 1);
    g.fillRect(18, 2 + bob, 16, 6);
    g.generateTexture(`ms-hero-run-${frame}`, 52, 52);
  }

  g.clear();
  g.fillStyle(0x1d4ed8, 1);
  g.fillRoundedRect(8, 24, 14, 20, 4);
  g.fillRoundedRect(30, 20, 14, 24, 4);
  g.fillStyle(0xf472b6, 1);
  g.fillCircle(26, 12, 14);
  g.fillStyle(0xfcd34d, 1);
  g.fillCircle(26, 10, 12);
  g.generateTexture("ms-hero-jump", 52, 52);

  g.clear();
  g.fillStyle(0xe2e8f0, 1);
  g.fillRect(14, 0, 6, 80);
  g.fillStyle(0x22c55e, 1);
  g.fillTriangle(20, 8, 56, 24, 20, 40);
  g.fillStyle(0x16a34a, 1);
  g.fillRect(18, 78, 20, 8);
  g.generateTexture("ms-flag", 64, 88);

  g.destroy();
}

export function createParallaxLayers(scene: Phaser.Scene, worldLength: number) {
  const sky = scene.add.rectangle(worldLength / 2, 120, worldLength + 800, 260, 0x7dd3fc, 0.25);
  const hills = scene.add.tileSprite(worldLength / 2, 300, worldLength + 800, 160, "ms-hills");
  hills.setTileScale(1.2);
  hills.setAlpha(0.9);
  const cloudA = scene.add.image(200, 70, "ms-cloud").setAlpha(0.85);
  const cloudB = scene.add.image(900, 50, "ms-cloud").setScale(1.2).setAlpha(0.7);
  const cloudC = scene.add.image(1800, 80, "ms-cloud").setScale(0.9).setAlpha(0.75);
  return { sky, hills, cloudA, cloudB, cloudC };
}

export function buildGrassPlatform(
  scene: Phaser.Scene,
  platform: { x: number; y: number; width: number; height?: number }
) {
  const height = platform.height ?? 120;
  const container = scene.add.container(platform.x, platform.y);
  const tiles = Math.ceil(platform.width / 64);
  for (let i = 0; i < tiles; i += 1) {
    const grass = scene.add.image(i * 64 + 32, 0, "ms-grass").setOrigin(0.5, 0);
    const dirtH = Math.max(48, height - 20);
    const dirt = scene.add.tileSprite(i * 64 + 32, 18, 64, dirtH, "ms-dirt").setOrigin(0.5, 0);
    container.add([dirt, grass]);
  }
  return container;
}

export function buildBlockSprite(scene: Phaser.Scene, reward: "coin" | "star") {
  const key = reward === "star" ? "ms-question" : "ms-brick";
  const sprite = scene.add.image(0, 0, key);
  if (reward === "star") {
    const star = scene.add.text(0, -2, "★", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#fff7ed"
    }).setOrigin(0.5);
    return scene.add.container(0, 0, [sprite, star]);
  }
  return scene.add.container(0, 0, [sprite]);
}

export function registerHeroAnimations(scene: Phaser.Scene) {
  if (scene.anims.exists("ms-run")) {
    return;
  }
  scene.anims.create({
    key: "ms-run",
    frames: [0, 1, 2, 3].map((frame) => ({ key: `ms-hero-run-${frame}` })),
    frameRate: 10,
    repeat: -1
  });
  scene.anims.create({
    key: "ms-jump",
    frames: [{ key: "ms-hero-jump" }],
    frameRate: 1,
    repeat: -1
  });
}
