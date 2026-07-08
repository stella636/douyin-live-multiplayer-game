import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GAME_CONFIG, MVP_RULES, type MockGiftCommand } from "@douyin-game/shared";
import { emitMockGift } from "./live/mockGiftEmitter.js";
import { douyinIngestService } from "./live/douyinIngest.js";
import { GameRoom } from "./rooms/GameRoom.js";

const PORT = Number(process.env.PORT ?? 2567);
const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    roomName: GAME_CONFIG.roomName,
    rules: MVP_RULES,
    douyinConnected: douyinIngestService.isConnected()
  });
});

app.post("/api/mock-gift", (req, res) => {
  const body = req.body as { roomId?: string; command?: MockGiftCommand };
  if (!body.roomId || !body.command) {
    res.status(400).json({ error: "roomId and command are required." });
    return;
  }

  const event = emitMockGift(body.roomId, body.command);
  res.json({ ok: true, event });
});

app.post("/api/douyin/connect", async (_req, res) => {
  await douyinIngestService.connect();
  res.json({ ok: true });
});

app.post("/api/douyin/gift", (req, res) => {
  try {
    const event = douyinIngestService.ingestGift(req.body);
    res.json({ ok: true, event });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
});

gameServer.define(GAME_CONFIG.roomName, GameRoom);

server.listen(PORT, () => {
  console.log(`Game server listening on http://localhost:${PORT}`);
});
