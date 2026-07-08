# 抖音直播间盒子大战

一个基于 `Phaser 3 + Colyseus + Node.js` 的多人直播互动小游戏原型。

## 当前能力

- **竖屏直播间布局**（上摄像头 / 中游戏条 / 下弹幕礼物安全区）
- **冒险岛风横版闯关 MVP**（`feature/runner-mvp`）
  - 像素草地平台、砖块、Q 版角色、视差背景
  - 自动前进 + 摄像头起跳 / Space 跳跃
  - 顶砖块、过障碍、终点旗通关
  - 礼物调试：`1` 架桥、`2` 护盾
- 旧版礼盒玩法（`GameScene` 保留）
- Colyseus 房间服 + 模拟礼物接口
- 抖音直播接入要求文档：`docs/douyin-live-setup.md`

## 目录结构

- `packages/client`：Phaser 客户端
- `packages/server`：Colyseus 房间服与直播接入层
- `packages/shared`：共享配置与事件定义
- `docs/oss-references.md`：参考的开源项目清单
- `docs/douyin-live-setup.md`：抖音直播间搭建与接入要求

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

### 竖屏跑酷闯关 MVP（当前默认）

- 竖屏：上摄像头 / 中跑酷条 / 下弹幕礼物区
- **默认无障碍**：匀速走完约 **30 分钟**通关
- 摄像头起跳或 `Space` 跳跃
- **礼物增加障碍**：每刷 1 个礼物，约 10 秒后在路上 +1 个障碍
- 障碍间隔约 **10 秒路程**（喘息机会）
- 障碍类型：悬崖（跳空）、高墙（跳过）、顶一顶砖块
- 调试：`1` +1 障碍，`2` +2，`3` +3
- 失败按 `R` 重开

### 旧版礼盒玩法（`GameScene`）

- 使用 `A / D` 或方向键左右移动
- 使用 `W / Space / 上方向键` 跳跃
- 按 `1` 给自己增加盒子
- 按 `2` 给随机在线玩家增加盒子

## 接入真实抖音直播礼物

当前服务端已保留两层接口：

- `packages/server/src/live/douyinIngest.ts`
- `packages/server/src/live/giftNormalizer.ts`

后续只要把真实抖音消息解析结果转换成统一的 `gift.received` 事件，即可无缝驱动游戏房间。
