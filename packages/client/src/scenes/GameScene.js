import Phaser from "phaser";
import { Client } from "colyseus.js";
import { GAME_CONFIG, MVP_RULES } from "@douyin-game/shared";
import { PlayerAvatar } from "../entities/Player";
import { PoseJumpController } from "../camera/PoseJumpController";
export class GameScene extends Phaser.Scene {
    constructor() {
        super("game");
        this.avatars = new Map();
        this.playerName = `玩家${Math.floor(Math.random() * 900 + 100)}`;
        this.cameraJumpDown = false;
        this.cameraCalibrated = false;
        this.cameraHitBox = false;
        this.cameraHeadTopX = null;
        this.cameraHeadTopY = null;
        this.cameraFootCenterX = null;
        this.cameraGroundY = null;
        this.lastCameraHitAt = 0;
        this.groundLootEntries = [];
    }
    async create() {
        this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
        // Soft vignette only — no bottom avatar / ground character.
        this.add.rectangle(GAME_CONFIG.mapWidth / 2, GAME_CONFIG.mapHeight - 40, GAME_CONFIG.mapWidth, 80, 0x020617, 0.2);
        this.groundGuide = this.add.ellipse(GAME_CONFIG.mapWidth / 2, GAME_CONFIG.groundY + 18, 360, 36, 0xf8fafc, 0.08).setDepth(6);
        this.hud = this.add.text(20, 20, "连接中...", {
            fontFamily: "Arial",
            fontSize: "18px",
            color: "#f8fafc",
            stroke: "#020617",
            strokeThickness: 4
        });
        this.help = this.add.text(20, 52, [
            "礼盒抬高且变大：站着走进框不算",
            "必须跳起来顶中上方宝箱才会减 1",
            "掉落会贴着识别到的地面散开",
            "礼物调试仍可用数字键 1 / 2",
            `当前胜负规则: ${MVP_RULES.winCondition}`
        ], {
            fontFamily: "Arial",
            fontSize: "14px",
            color: "#cbd5e1",
            lineSpacing: 8,
            stroke: "#020617",
            strokeThickness: 3
        });
        this.roundResult = this.add.text(GAME_CONFIG.mapWidth / 2, 80, "", {
            fontFamily: "Arial",
            fontSize: "28px",
            color: "#fef08a"
        }).setOrigin(0.5);
        this.input.keyboard?.on("keydown-ONE", () => {
            void this.triggerMockGift("self");
        });
        this.input.keyboard?.on("keydown-TWO", () => {
            void this.triggerMockGift("random");
        });
        const client = new Client(import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567");
        this.room = await client.joinOrCreate(GAME_CONFIG.roomName, {
            name: this.playerName
        });
        this.room.onMessage("gift:applied", (payload) => {
            this.showToast(`礼物生效: ${payload.giftName} +${payload.gain}`);
        });
        this.room.onMessage("box:consumed", (payload) => {
            const avatar = this.avatars.get(payload.playerId);
            // Force local number update immediately from server event payload.
            const lootDrop = avatar?.applyConsumedCount(payload.boxCount);
            if (payload.playerId === this.room?.sessionId) {
                this.playLocalHitFx(payload.boxCount, lootDrop);
            }
        });
        this.room.onMessage("round:ended", (payload) => {
            this.roundResult?.setText(payload.winnerId === this.room?.sessionId ? "你赢了" : `回合结束，赢家: ${payload.winnerId}`);
        });
        await this.setupCameraPreview();
    }
    update() {
        if (!this.room) {
            return;
        }
        this.maybeSendCameraHit();
        this.renderFromState(this.room.state);
        this.updateGroundLoot();
    }
    renderFromState(state) {
        const seenIds = new Set();
        const players = state.players;
        for (const [index, snapshot] of players.entries()) {
            seenIds.add(snapshot.sessionId);
            let avatar = this.avatars.get(snapshot.sessionId);
            if (!avatar) {
                avatar = new PlayerAvatar(this);
                this.avatars.set(snapshot.sessionId, avatar);
            }
            avatar.sync(snapshot, snapshot.sessionId === this.room?.sessionId, index, players.length);
        }
        for (const [sessionId, avatar] of this.avatars.entries()) {
            if (!seenIds.has(sessionId)) {
                avatar.destroy();
                this.avatars.delete(sessionId);
            }
        }
        const self = players.find((player) => player.sessionId === this.room?.sessionId);
        const timeLeftSeconds = Math.ceil(state.timeLeftMs / 1000);
        this.hud?.setText([
            `房间: ${state.roomId}`,
            `你: ${self?.name ?? this.playerName}`,
            `礼盒数: ${self?.boxCount ?? 0}`,
            `剩余时间: ${timeLeftSeconds}s`,
            `摄像头: ${this.cameraCalibrated ? (this.cameraJumpDown ? "起跳中" : "已待命") : "校准中"}`,
            `地面识别: ${this.cameraGroundY !== null ? "已锁定" : "识别中"}`,
            `有效顶盒: ${this.cameraHitBox ? "跳跃命中！" : this.cameraJumpDown ? "起跳中未进框" : "需跳跃进黄框"}`
        ]);
        if (this.groundGuide) {
            const groundY = this.getEstimatedGroundY();
            this.groundGuide.setPosition(GAME_CONFIG.mapWidth / 2, groundY + 20);
            this.groundGuide.setAlpha(this.cameraGroundY !== null ? 0.13 : 0.05);
            this.groundGuide.setDisplaySize(420, this.cameraGroundY !== null ? 44 : 34);
        }
    }
    async triggerMockGift(mode) {
        if (!this.room) {
            return;
        }
        const body = {
            roomId: this.room.roomId,
            command: {
                senderId: this.room.sessionId,
                giftType: mode === "self" ? "heart" : "rose",
                giftCount: mode === "self" ? 1 : 2,
                targetPlayerId: mode === "self" ? this.room.sessionId : undefined
            }
        };
        await fetch(`${import.meta.env.VITE_HTTP_SERVER_URL ?? "http://localhost:2567"}/api/mock-gift`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    }
    showToast(message) {
        const text = this.add.text(GAME_CONFIG.mapWidth / 2, 130, message, {
            fontFamily: "Arial",
            fontSize: "22px",
            color: "#fef08a",
            backgroundColor: "#7f1d1dcc",
            padding: {
                left: 14,
                right: 14,
                top: 8,
                bottom: 8
            }
        }).setOrigin(0.5);
        this.tweens.add({
            targets: text,
            y: 90,
            alpha: 0,
            duration: 1600,
            ease: "Quad.easeOut",
            onComplete: () => text.destroy()
        });
    }
    playLocalHitFx(boxCount, lootDrop) {
        this.playCoinChime();
        if (lootDrop) {
            this.dropLootNearFeet(lootDrop);
        }
        this.showToast(lootDrop ? `顶中宝箱！宝物已散落到地面，剩余 ${boxCount}` : `顶中宝箱！剩余 ${boxCount}`);
        this.cameras.main.flash(320, 255, 240, 160, false);
    }
    playCoinChime() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            return;
        }
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const notes = [880, 1320, 1760, 2090];
        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, now + index * 0.045);
            gain.gain.setValueAtTime(0.0001, now + index * 0.045);
            gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.055 + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.055 + 0.16);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + index * 0.055);
            osc.stop(now + index * 0.055 + 0.18);
        });
        window.setTimeout(() => {
            void ctx.close();
        }, 550);
    }
    async setupCameraPreview() {
        this.cameraOverlay = document.getElementById("camera-overlay");
        this.cameraFeed = document.getElementById("camera-feed");
        if (!this.cameraOverlay || !this.cameraFeed) {
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            this.cameraOverlay.textContent = "当前浏览器不支持摄像头";
            return;
        }
        try {
            this.cameraOverlay.textContent = "正在连接本地摄像头...";
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user"
                },
                audio: false
            });
            this.cameraFeed.srcObject = this.mediaStream;
            this.cameraOverlay.textContent = "本地摄像头已连接，正在初始化姿态识别";
            this.poseJumpController = new PoseJumpController({
                onStateChange: (state) => {
                    this.cameraJumpDown = state.jumpDown;
                    this.cameraCalibrated = state.calibrated;
                    this.cameraHitBox = state.hitBox;
                    this.cameraHeadTopX = state.headTopX;
                    this.cameraHeadTopY = state.headTopY;
                    this.cameraFootCenterX = state.footCenterX;
                    this.cameraGroundY = state.groundY;
                },
                onStatusChange: (message) => {
                    if (this.cameraOverlay) {
                        this.cameraOverlay.textContent = message;
                    }
                }
            });
            await this.poseJumpController.start(this.cameraFeed);
        }
        catch (error) {
            this.cameraOverlay.textContent = "摄像头权限被拒绝或设备不可用";
            this.showToast(`摄像头启动失败: ${error.message}`);
        }
    }
    shutdown() {
        this.poseJumpController?.stop();
        this.mediaStream?.getTracks().forEach((track) => track.stop());
    }
    maybeSendCameraHit() {
        if (!this.room || !this.cameraCalibrated || !this.cameraHitBox) {
            return;
        }
        const now = performance.now();
        if (now - this.lastCameraHitAt < 700) {
            return;
        }
        this.lastCameraHitAt = now;
        this.room.send("camera:hit-box");
    }
    updateGroundLoot() {
        const now = performance.now();
        for (let index = this.groundLootEntries.length - 1; index >= 0; index -= 1) {
            const entry = this.groundLootEntries[index];
            if (entry.expireAt <= now) {
                const [removed] = this.groundLootEntries.splice(index, 1);
                this.tweens.add({
                    targets: removed.container,
                    alpha: 0,
                    y: removed.container.y + 16,
                    scaleX: 0.7,
                    scaleY: 0.7,
                    duration: 260,
                    onComplete: () => removed.container.destroy()
                });
            }
        }
    }
    dropLootNearFeet(loot) {
        const burstX = GAME_CONFIG.mapWidth / 2;
        const floorY = this.getEstimatedGroundY();
        const spreadX = loot.side === "left" ? -1 : 1;
        const footBiasX = this.cameraFootCenterX !== null ? (this.cameraFootCenterX - 0.5) * GAME_CONFIG.mapWidth * 0.18 : 0;
        const orbitRadiusX = 240;
        const orbitRadiusY = 62;
        const orbitAngle = spreadX * (0.45 + Math.random() * 0.75) + (Math.random() - 0.5) * 0.18;
        const orbitDepth = 0.18 + Math.random() * 0.82;
        const landingX = burstX + footBiasX + Math.sin(orbitAngle) * orbitRadiusX * orbitDepth;
        const landingY = floorY + Math.cos(orbitAngle) * orbitRadiusY * orbitDepth;
        const depthScale = 0.72 + orbitDepth * 0.52;
        const finalAngle = spreadX * (4 + Math.random() * 9) + (Math.random() - 0.5) * 6;
        const shadow = this.add.ellipse(0, 20, 70, 22, 0x000000, 0.24);
        const icon = this.createGroundLootIcon(loot.type);
        const container = this.add.container(burstX, GAME_CONFIG.boxAnchorY + 60, [shadow, icon]);
        container.setScale(1.5);
        container.setAngle(spreadX * (24 + Math.random() * 14));
        container.setDepth(20 + Math.round(landingY));
        this.tweens.add({
            targets: container,
            x: landingX,
            y: landingY,
            scaleX: depthScale,
            scaleY: depthScale,
            angle: finalAngle,
            duration: 1020,
            ease: "Cubic.easeOut"
        });
        this.tweens.add({
            targets: container,
            y: landingY + 8 + orbitDepth * 6,
            delay: 1020,
            duration: 240,
            yoyo: true,
            ease: "Quad.easeOut"
        });
        this.tweens.add({
            targets: shadow,
            scaleX: 0.95 + orbitDepth * 0.7,
            scaleY: 0.85 + orbitDepth * 0.45,
            alpha: 0.12 + orbitDepth * 0.18,
            duration: 1020,
            ease: "Cubic.easeOut"
        });
        this.tweens.add({
            targets: icon,
            angle: spreadX * (100 + Math.random() * 70),
            duration: 640,
            yoyo: true,
            ease: "Sine.easeOut"
        });
        this.groundLootEntries.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            container,
            expireAt: performance.now() + 30000
        });
    }
    createGroundLootIcon(type) {
        const parts = [];
        if (type === "coin") {
            const coinBack = this.add.ellipse(0, 0, 34, 38, 0xd97706, 1);
            const coin = this.add.ellipse(0, -2, 34, 38, 0xfbbf24, 1);
            coin.setStrokeStyle(3, 0xb45309, 1);
            const shine = this.add.rectangle(-8, -8, 10, 24, 0xfef3c7, 0.9).setAngle(20);
            parts.push(coinBack, coin, shine);
        }
        else if (type === "gem") {
            const gemShadow = this.add.star(0, 4, 5, 10, 24, 0x1e40af, 0.65);
            const gem = this.add.star(0, -2, 5, 10, 24, 0x60a5fa, 1);
            gem.setStrokeStyle(3, 0x1d4ed8, 1);
            parts.push(gemShadow, gem);
        }
        else if (type === "potion") {
            const bottleBack = this.add.rectangle(0, 3, 28, 36, 0x7e22ce, 0.65);
            const bottle = this.add.rectangle(0, -2, 28, 36, 0xf472b6, 1);
            bottle.setStrokeStyle(3, 0x7e22ce, 1);
            const cap = this.add.rectangle(0, -22, 14, 10, 0x92400e, 1);
            const liquid = this.add.rectangle(0, 5, 18, 18, 0xf9a8d4, 0.75);
            parts.push(bottleBack, bottle, cap, liquid);
        }
        else if (type === "scroll") {
            const paper = this.add.rectangle(0, 0, 28, 36, 0xfef3c7, 1);
            paper.setStrokeStyle(3, 0x92400e, 1);
            const rollTop = this.add.ellipse(0, -19, 24, 9, 0xf59e0b, 0.9);
            const rollBottom = this.add.ellipse(0, 19, 24, 9, 0xf59e0b, 0.9);
            const line1 = this.add.rectangle(0, -8, 14, 2, 0x92400e, 0.8);
            const line2 = this.add.rectangle(0, 3, 12, 2, 0x92400e, 0.8);
            parts.push(paper, rollTop, rollBottom, line1, line2);
        }
        else if (type === "shield") {
            const shieldBack = this.add.triangle(0, 3, 0, -24, 22, -6, 0, 30, 0x1e3a8a, 0.7);
            const shield = this.add.triangle(0, -2, 0, -24, 22, -6, 0, 30, 0x38bdf8, 1);
            shield.setStrokeStyle(4, 0x1e40af, 1);
            const crest = this.add.circle(0, 3, 6, 0xfef08a, 0.9);
            parts.push(shieldBack, shield, crest);
        }
        else {
            const bladeBack = this.add.rectangle(2, -10, 8, 40, 0x94a3b8, 0.55);
            const blade = this.add.rectangle(0, -12, 8, 40, 0xe5e7eb, 1);
            blade.setStrokeStyle(2, 0x94a3b8, 1);
            const guard = this.add.rectangle(0, 4, 22, 6, 0xfbbf24, 1);
            const handle = this.add.rectangle(0, 18, 7, 14, 0x7c2d12, 1);
            parts.push(bladeBack, blade, guard, handle);
        }
        return this.add.container(0, 0, parts);
    }
    getEstimatedGroundY() {
        if (this.cameraGroundY === null) {
            return GAME_CONFIG.groundY + 22;
        }
        return Phaser.Math.Clamp(this.cameraGroundY * GAME_CONFIG.mapHeight, GAME_CONFIG.groundY - 24, GAME_CONFIG.mapHeight - 18);
    }
}
