# 抖音直播间盒子大战

一个基于 `Phaser 3 + Colyseus + Node.js` 的多人直播互动小游戏原型。

## 当前能力

- 2 到 8 人多人房间
- Phaser H5 客户端
- 权威房间服同步玩家位置与盒子数量
- 模拟礼物接口增加盒子
- 角色跳跃碰撞自己的头顶盒子后减少盒子
- 预留真实抖音礼物接入层

## 目录结构

- `packages/client`：Phaser 客户端
- `packages/server`：Colyseus 房间服与直播接入层
- `packages/shared`：共享配置与事件定义
- `docs/oss-references.md`：参考的开源项目清单

## 本地运行

```bash
npm install
npm run dev:server
npm run dev:client
```

默认地址：

- 客户端：`http://localhost:5173`
- 服务端：`http://localhost:2567`

## 调试玩法

- 使用 `A / D` 或方向键左右移动
- 使用 `W / Space / 上方向键` 跳跃
- 按 `1` 给自己增加盒子
- 按 `2` 给随机在线玩家增加盒子

## 接入真实抖音直播礼物

当前服务端已保留两层接口：

- `packages/server/src/live/douyinIngest.ts`
- `packages/server/src/live/giftNormalizer.ts`

后续只要把真实抖音消息解析结果转换成统一的 `gift.received` 事件，即可无缝驱动游戏房间。
