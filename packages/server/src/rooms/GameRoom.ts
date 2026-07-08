import { Room, type Client } from "@colyseus/core";
import { GAME_CONFIG, getPlayerBoxAnchorX, type GiftReceivedEvent, type PlayerInputState } from "@douyin-game/shared";
import { liveBridge } from "../live/liveBridge.js";
import { resolveGiftBoxGain } from "../live/giftNormalizer.js";
import { GameState, PlayerState } from "../state/schema.js";

const GRAVITY = 1500;
const FIXED_DELTA_MS = 1000 / 60;
const PLAYER_COLORS = ["#60a5fa", "#f472b6", "#f59e0b", "#34d399", "#c084fc", "#fb7185", "#2dd4bf", "#f97316"];

interface JoinOptions {
  name?: string;
}

export class GameRoom extends Room<GameState> {
  maxClients = GAME_CONFIG.maxPlayers;

  private readonly inputs = new Map<string, PlayerInputState>();
  private readonly lastGroundedAt = new Map<string, number>();
  private readonly lastJumpPressedAt = new Map<string, number>();
  private readonly jumpConsumed = new Set<string>();
  private roundStartedAt = 0;
  private giftHandler?: (event: GiftReceivedEvent) => void;

  onCreate() {
    const state = new GameState();
    state.roomId = this.roomId;
    state.timeLeftMs = GAME_CONFIG.roundDurationMs;
    this.setState(state);

    this.roundStartedAt = Date.now();

    this.onMessage("input", (client, message: PlayerInputState) => {
      this.inputs.set(client.sessionId, message);
      if (message.jumpPressed) {
        this.lastJumpPressedAt.set(client.sessionId, Date.now());
      }
    });

    this.onMessage("gift:trigger", (client, message: { targetPlayerId?: string }) => {
      const player = this.getPlayerBySessionId(client.sessionId);
      if (!player) {
        return;
      }

      this.handleGift({
        type: "gift.received",
        roomId: this.roomId,
        senderId: client.sessionId,
        giftName: "debug-rose",
        giftType: "rose",
        giftCount: 1,
        giftValue: 1,
        targetPlayerId: message.targetPlayerId,
        ts: Date.now()
      });
    });

    this.onMessage("camera:hit-box", (client) => {
      const player = this.getPlayerBySessionId(client.sessionId);
      if (!player || player.boxCount <= 0) {
        return;
      }

      player.boxCount -= 1;
      this.broadcast("box:consumed", {
        playerId: player.sessionId,
        boxCount: player.boxCount
      });
    });

    this.giftHandler = (event) => {
      if (event.roomId === this.roomId) {
        this.handleGift(event);
      }
    };

    liveBridge.on("gift", this.giftHandler);

    this.setSimulationInterval((deltaTime) => {
      this.update(deltaTime);
    }, FIXED_DELTA_MS);
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new PlayerState();
    const index = this.state.players.length;
    player.sessionId = client.sessionId;
    player.name = options.name?.trim() || `Player ${index + 1}`;
    player.x = getPlayerBoxAnchorX(index, GAME_CONFIG.maxPlayers);
    player.y = GAME_CONFIG.groundY;
    player.color = PLAYER_COLORS[index % PLAYER_COLORS.length];

    this.state.players.push(player);
    this.inputs.set(client.sessionId, {
      left: false,
      right: false,
      jumpPressed: false,
      jumpHeld: false,
      tick: 0
    });
    this.lastGroundedAt.set(client.sessionId, Date.now());
  }

  onLeave(client: Client) {
    const idx = this.state.players.findIndex((player) => player.sessionId === client.sessionId);
    if (idx >= 0) {
      this.state.players.splice(idx, 1);
    }
    this.inputs.delete(client.sessionId);
    this.lastGroundedAt.delete(client.sessionId);
    this.lastJumpPressedAt.delete(client.sessionId);
    this.jumpConsumed.delete(client.sessionId);
  }

  onDispose() {
    if (this.giftHandler) {
      liveBridge.off("gift", this.giftHandler);
    }
  }

  private update(deltaTime: number) {
    const now = Date.now();
    const deltaSeconds = deltaTime / 1000;
    this.state.timeLeftMs = Math.max(0, GAME_CONFIG.roundDurationMs - (now - this.roundStartedAt));

    for (const player of this.state.players) {
      const input = this.inputs.get(player.sessionId);
      if (!input) {
        continue;
      }

      const grounded = player.y >= GAME_CONFIG.groundY;
      if (grounded) {
        player.y = GAME_CONFIG.groundY;
        player.vy = Math.max(0, player.vy);
        this.lastGroundedAt.set(player.sessionId, now);
        this.jumpConsumed.delete(player.sessionId);
      } else {
        player.vy += GRAVITY * deltaSeconds;
      }

      const desiredDirection = Number(input.right) - Number(input.left);
      const speedMultiplier = grounded ? 1 : GAME_CONFIG.airControl;
      player.vx = desiredDirection * GAME_CONFIG.playerSpeed * speedMultiplier;

      if (desiredDirection !== 0) {
        player.facing = desiredDirection > 0 ? "right" : "left";
      }

      const canUseBufferedJump = now - (this.lastJumpPressedAt.get(player.sessionId) ?? 0) <= GAME_CONFIG.jumpBufferMs;
      const canUseCoyote = now - (this.lastGroundedAt.get(player.sessionId) ?? 0) <= GAME_CONFIG.coyoteTimeMs;
      if (canUseBufferedJump && canUseCoyote && !this.jumpConsumed.has(player.sessionId)) {
        player.vy = -GAME_CONFIG.jumpVelocity;
        this.jumpConsumed.add(player.sessionId);
      }

      if (!input.jumpHeld && player.vy < 0) {
        player.vy *= GAME_CONFIG.jumpCutMultiplier;
      }

      player.x += player.vx * deltaSeconds;
      player.y += player.vy * deltaSeconds;

      if (player.x < 20) {
        player.x = 20;
      }
      if (player.x > GAME_CONFIG.mapWidth - 20) {
        player.x = GAME_CONFIG.mapWidth - 20;
      }
      if (player.y > GAME_CONFIG.groundY) {
        player.y = GAME_CONFIG.groundY;
        player.vy = 0;
      }

      this.tryConsumeOwnBox(player);
    }

    if (this.state.timeLeftMs === 0 && !this.state.winnerId) {
      this.state.winnerId = this.resolveWinnerId();
      this.broadcast("round:ended", { winnerId: this.state.winnerId });
    }
  }

  private handleGift(event: GiftReceivedEvent) {
    const gain = resolveGiftBoxGain(event);
    const targetPlayer = event.targetPlayerId
      ? this.getPlayerBySessionId(event.targetPlayerId)
      : this.pickGiftTarget(event.senderId);

    if (!targetPlayer) {
      return;
    }

    targetPlayer.boxCount = Math.min(GAME_CONFIG.maxBoxes, targetPlayer.boxCount + gain);
    this.broadcast("gift:applied", {
      targetPlayerId: targetPlayer.sessionId,
      gain,
      giftName: event.giftName
    });
  }

  private pickGiftTarget(senderId: string) {
    const self = this.getPlayerBySessionId(senderId);
    if (self) {
      return self;
    }

    if (this.state.players.length === 0) {
      return undefined;
    }

    const randomIndex = Math.floor(Math.random() * this.state.players.length);
    return this.state.players[randomIndex];
  }

  private tryConsumeOwnBox(player: PlayerState) {
    if (player.boxCount <= 0 || player.vy >= -20) {
      return;
    }

    const playerIndex = this.state.players.findIndex((candidate) => candidate.sessionId === player.sessionId);
    if (playerIndex < 0) {
      return;
    }

    const boxX = getPlayerBoxAnchorX(playerIndex, GAME_CONFIG.maxPlayers);
    const boxBottomY = GAME_CONFIG.boxAnchorY + GAME_CONFIG.boxHitHeight * 0.5;
    const headY = player.y - GAME_CONFIG.playerBody.height;
    const withinBoxX = Math.abs(player.x - boxX) <= GAME_CONFIG.boxWidth * 0.5;

    if (withinBoxX && headY <= boxBottomY) {
      player.boxCount -= 1;
      player.vy = GAME_CONFIG.headBounceVelocity;
      this.broadcast("box:consumed", {
        playerId: player.sessionId,
        boxCount: player.boxCount
      });
    }
  }

  private getPlayerBySessionId(sessionId: string) {
    return this.state.players.find((player) => player.sessionId === sessionId);
  }

  private resolveWinnerId() {
    const sorted = [...this.state.players].sort((a, b) => a.boxCount - b.boxCount);
    return sorted[0]?.sessionId ?? "";
  }
}
