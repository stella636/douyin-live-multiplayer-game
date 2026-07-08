import { ArraySchema, Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") sessionId = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  @type("string") facing: "left" | "right" = "right";
  @type("number") boxCount = 3;
  @type("string") color = "#6ee7b7";
  @type("boolean") connected = true;
}

export class GameState extends Schema {
  @type("string") roomId = "";
  @type([PlayerState]) players = new ArraySchema<PlayerState>();
  @type("string") winnerId = "";
  @type("number") timeLeftMs = 0;
}
