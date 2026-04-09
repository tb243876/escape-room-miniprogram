# 密室小程序（迷场档案馆）

基于微信原生小程序 + CloudBase 构建的密室门店小程序。

## 功能概览

### 玩家端

- 首页：浏览主题、活动入口
- 组局大厅：发起/加入组局
- 队伍房间：查看成员、查看玩家资料卡、查看结算和集锦
- 排行榜：查看成长值、荣誉、称号、徽章
- 档案：查看个人记录与成长
- 资料编辑：头像、昵称、签名、性别

### 员工端

- 授权绑定：本机授权码绑定
- 工作台：查看待处理场次和统计
- 场次管理：确认成员、开始、结束、自动结算
- 集锦管理：上传和维护照片/视频
- 门店管理：授权码、员工、店长转移

## 当前运行口径

- `release -> prod`
- `trial -> prod`
- `develop -> prod`
- 所有运行版本都禁止依赖 mock 或本地数据 fallback
- `initData / runtimeReset / clearData` 已退出真实运行链路，不再作为日常体验版维护手段

## 当前云函数

业务函数：

- `getProfile`
- `updateProfile`
- `groupManage`
- `staffManage`
- `getLeaderboard`

维护函数：

- `initData`
- `runtimeReset`
- `clearData`

说明：

- 组局的 `create/join/cancel/delete/getTeamRoom` 当前是 `groupManage.action`
- 场次的 `confirm/start/end` 当前是 `staffManage.action='runSessionAction'`
- 当前没有独立排行榜写入函数；排行榜通过 `profiles` 聚合读取

## 核心文档

- `PROJECT_CONTEXT.md`：业务上下文、成长体系、权限矩阵、多门店口径
- `AGENT_WORKFLOW.md`：开发规则、Mock 退出条件、回归与发布要求
- `CODEMAP.md`：代码入口、云函数地图、分包方案
- `STATE_MACHINE.md`：组局 / 房间 / 场次状态机
- `ERROR_CODES.md`：错误码和前端展示文案
- `DB_SCHEMA.md`：集合结构与索引规范
- `cloudfunctions/README.md`：云函数接口契约
- `AGENT_PROMPT.md`：标准开工和发布 SOP

## 测试脚本

```bash
npm run lint
npm run test:phase1
npm run test:business
npm run test:ui
npm run test:ui:player
npm run test:ui:staff
npm run test:ui:session
npm run test:regression
```

说明：

- 已移除依赖本地 mock / 假玩家数据的离线脚本，不再保留“人机数据跑通”回归口径
- `npm run test:regression` 当前默认只跑稳定的非 UI 检查
- 如需把 UI 自动化一起跑，使用 `INCLUDE_UI_REGRESSION=1 npm run test:regression`
