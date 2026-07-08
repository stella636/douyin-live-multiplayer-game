# 开源参考项目

## 人物控制

- `asadm/playroom-docs/examples/2dparkour`
  - 重点借鉴：可变跳高、空中控制、墙跳思路
- `yandeu/phaser3-typescript-platformer-example`
  - 重点借鉴：Phaser 3 + TypeScript 工程组织与平台跳跃骨架

## 多人同步

- `colyseus/tutorial-phaser`
  - 重点借鉴：Phaser 客户端接入 Colyseus 的基础流程
- `b3nk4n/phaser3-colyseus-jump-n-run`
  - 重点借鉴：平台跳跃玩法与房间状态同步结合方式

## 直播礼物接入

- `jwwsjlm/douyinLive`
  - 重点借鉴：抖音直播消息监听与礼物事件解析
- `vamnguyen/tiktok-live-games`
  - 重点借鉴：直播事件桥接到游戏逻辑的服务结构

## 本项目中的落地方式

- 客户端手感采用 Phaser 自定义角色控制器实现
- 房间状态由 Colyseus 作为权威源统一维护
- 直播平台适配被隔离在 `packages/server/src/live` 下，避免影响游戏核心逻辑
