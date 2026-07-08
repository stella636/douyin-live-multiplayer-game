import Phaser from "phaser";
import { RUNNER_CONFIG, type DynamicObstacleKind, type RunnerPlatform } from "@douyin-game/shared";
import { buildBlockSprite, buildGrassPlatform } from "./mapleAssets";

export type SpawnedObstacle = {
  id: string;
  kind: DynamicObstacleKind;
  x: number;
  sprite: Phaser.GameObjects.Container;
  hitbox?: { x: number; y: number; width: number; height: number };
  headBlock?: {
    x: number;
    y: number;
    broken: boolean;
    sprite: Phaser.GameObjects.Container;
  };
};

export function splitPlatformForCliff(
  segments: RunnerPlatform[],
  cliffX: number,
  gapWidth: number
): RunnerPlatform[] {
  const gapStart = cliffX;
  const gapEnd = cliffX + gapWidth;
  const next: RunnerPlatform[] = [];

  for (const segment of segments) {
    const segEnd = segment.x + segment.width;
    if (gapEnd <= segment.x || gapStart >= segEnd) {
      next.push(segment);
      continue;
    }

    if (gapStart > segment.x) {
      next.push({ ...segment, width: gapStart - segment.x });
    }
    if (gapEnd < segEnd) {
      next.push({ ...segment, x: gapEnd, width: segEnd - gapEnd });
    }
  }

  return next;
}

export function pickObstacleKind(): DynamicObstacleKind {
  const roll = Math.random();
  if (roll < 0.38) {
    return "cliff";
  }
  if (roll < 0.72) {
    return "wall";
  }
  return "headBlock";
}

export function spawnObstacle(
  scene: Phaser.Scene,
  world: Phaser.GameObjects.Container,
  kind: DynamicObstacleKind,
  x: number
): SpawnedObstacle {
  const id = `${kind}-${x}-${Math.random().toString(36).slice(2, 6)}`;
  const G = RUNNER_CONFIG.groundY;

  if (kind === "cliff") {
    const width = RUNNER_CONFIG.cliffGapWidth;
    const leftSign = scene.add.text(x + width / 2, G - 58, "悬崖", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#fecaca",
      stroke: "#7f1d1d",
      strokeThickness: 3
    }).setOrigin(0.5);
    const markerL = scene.add.triangle(x, G - 8, 0, 0, 12, 18, 24, 0, 0xef4444, 0.9);
    const markerR = scene.add.triangle(x + width, G - 8, 0, 0, 12, 18, 24, 0, 0xef4444, 0.9);
    const sprite = scene.add.container(0, 0, [markerL, markerR, leftSign]);
    world.add(sprite);
    return { id, kind, x, sprite, hitbox: { x, y: G - 40, width, height: 40 } };
  }

  if (kind === "wall") {
    const w = RUNNER_CONFIG.wallWidth;
    const h = RUNNER_CONFIG.wallHeight;
    const body = scene.add.rectangle(x + w / 2, G - h / 2, w, h, 0x78716c, 1);
    body.setStrokeStyle(3, 0x44403c, 1);
    const cap = scene.add.rectangle(x + w / 2, G - h - 6, w + 8, 10, 0xa8a29e, 1);
    const label = scene.add.text(x + w / 2, G - h - 24, "高墙", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#fef3c7"
    }).setOrigin(0.5);
    const sprite = scene.add.container(0, 0, [body, cap, label]);
    world.add(sprite);
    return {
      id,
      kind,
      x,
      sprite,
      hitbox: { x, y: G - h, width: w, height: h }
    };
  }

  const blockY = G - 128;
  const blockSprite = buildBlockSprite(scene, Math.random() > 0.7 ? "star" : "coin");
  blockSprite.setPosition(x + 24, blockY);
  const hint = scene.add.text(x + 24, blockY - 34, "顶一顶", {
    fontFamily: "Arial",
    fontSize: "12px",
    color: "#fef08a",
    stroke: "#7c2d12",
    strokeThickness: 2
  }).setOrigin(0.5);
  const sprite = scene.add.container(0, 0, [blockSprite, hint]);
  world.add(sprite);
  return {
    id,
    kind,
    x,
    sprite,
    headBlock: { x: x + 24, y: blockY, broken: false, sprite: blockSprite }
  };
}

export function rebuildPlatformVisuals(
  scene: Phaser.Scene,
  world: Phaser.GameObjects.Container,
  segments: RunnerPlatform[],
  visuals: Phaser.GameObjects.Container[]
) {
  visuals.forEach((v) => v.destroy());
  visuals.length = 0;
  for (const platform of segments) {
    if (platform.width <= 0) {
      continue;
    }
    const visual = buildGrassPlatform(scene, platform);
    world.add(visual);
    visuals.push(visual);
  }
}
