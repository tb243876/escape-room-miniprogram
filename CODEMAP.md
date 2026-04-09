# 代码地图

本文件用于减少每次进入项目时的全仓扫描成本。

## 1. 建议阅读顺序

1. `CHANGELOG.md`
2. `PROJECT_CONTEXT.md`
3. `AGENT_WORKFLOW.md`
4. `STATE_MACHINE.md`
5. `ERROR_CODES.md`
6. `DB_SCHEMA.md`
7. 本文件

## 2. 顶层入口

- 小程序入口：`app.js`
- 环境路由：`utils/platform/env-config.js`
- 页面注册：`app.json`
- 工程配置：`project.config.json`
- 服务编排总入口：`utils/cloudbase.js`
- 云函数目录：`cloudfunctions/`

## 3. 业务链路到代码入口

### 3.1 内容浏览链路

- 首页：`pages/home/`
- 主题列表：`pages/themes/`
- 主题详情：`pages/theme-detail/`
- 活动页：`pages/activities/`
- 领域模块：`utils/domain/theme.js`

### 3.2 组局与房间链路

- 大厅：`pages/lobby/`
- 发起组局：`pages/lobby-create/`
- 队伍房间：`pages/team-room/`
- 前端领域模块：
  - `utils/domain/group.js`
  - `utils/domain/team-room.js`
- 云端领域模块：
  - `cloudfunctions/groupManage/index.js`
  - `cloudfunctions/groupManage/group-domain.js`

### 3.3 玩家资料与排行榜链路

- 我的页：`pages/profile/`
- 资料编辑：`packages/profile/edit/`
- 徽章页：`packages/profile/badges/`
- 排行榜：`pages/leaderboard/`
- 前端领域模块：
  - `utils/domain/profile.js`
  - `utils/domain/leaderboard.js`
- 云端模块：
  - `cloudfunctions/getProfile/`
  - `cloudfunctions/updateProfile/`
  - `cloudfunctions/getLeaderboard/`

### 3.4 工作台与场次链路

- 工作台授权：`packages/staff/auth-code/`
- 工作台首页：`packages/staff/dashboard/`
- 员工列表：`packages/staff/users/`
- 场次列表：`packages/staff/sessions/`
- 场次详情：`packages/staff/session/`
- 集锦管理：`packages/staff/highlights/`
- 门店管理：`packages/staff/store/`
- 前端领域模块：`utils/domain/staff.js`
- 云端模块：
  - `cloudfunctions/staffManage/index.js`
  - `cloudfunctions/staffManage/staff-domain.js`
  - `cloudfunctions/staffManage/profile-domain.js`

## 4. 云函数地图

当前物理云函数分两层理解：

- 物理函数：真正部署到 CloudBase 的目录
- 逻辑接口：通过 `action` 或动作参数暴露的业务能力

### 4.1 物理函数总表

| 物理函数 | 主要逻辑接口 | 主要调用方 | 主要写集合 |
| --- | --- | --- | --- |
| `getProfile` | 当前用户档案、批量成员档案 | `pages/profile`、`pages/team-room`、工作台成员资料 | `profiles` |
| `updateProfile` | 更新头像/昵称/签名/性别 | `packages/profile/edit` | `profiles` |
| `groupManage` | `listGroups/createGroup/joinGroup/cancelActiveGroup/deleteGroupRecord/getTeamRoom` | `pages/lobby`、`pages/lobby-create`、`pages/team-room` | `groups`、`profiles` |
| `staffManage` | `redeemAuthCode/getDashboard/getSession/toggleSessionMember/runSessionAction/getHighlights/saveHighlights/...` | 所有 `packages/staff/*` 页面 | `staff_bindings`、`staff_auth_codes`、`staff_sessions`、`staff_highlights`、`groups`、`profiles` |
| `getLeaderboard` | 排行榜聚合读取 | `pages/leaderboard` | 无直接写入 |
| `initData` | 测试数据初始化 | 开发/测试工具 | 多个测试集合 |
| `runtimeReset` | 测试环境重置 | 开发/测试工具 | 多个测试集合 |
| `clearData` | 维护清理 | 脚本工具 | 多个测试集合 |

### 4.2 契约标准入口

- 云函数统一返回、入参/出参、错误码基线：`cloudfunctions/README.md`
- 状态流转：`STATE_MACHINE.md`
- 错误码：`ERROR_CODES.md`
- 集合结构与索引：`DB_SCHEMA.md`

### 4.3 当前关键事实

- 组局并没有拆成独立的 `createGroup/joinGroup/cancelGroup` 物理函数，当前统一收敛在 `groupManage.action`
- 场次开始/结束也不是独立物理函数，当前统一收敛在 `staffManage.action='runSessionAction'` + `actionKey='start'|'end'`
- 当前没有独立“排行榜写入云函数”；排行榜通过 `getLeaderboard` 从 `profiles` 聚合读取，正式结算写入发生在 `staffManage` 的结束场次链路

## 5. 回归脚本入口

| 命令 | 覆盖内容 |
| --- | --- |
| `npm run lint` | JS 静态检查 |
| `npm run test:phase1` | 核心页面/文档/模块存在性 |
| `npm run test:business` | 业务规则、环境路由、状态推进 |
| `npm run test:ui` | UI 总冒烟 |
| `npm run test:ui:player` | 玩家 UI 链路 |
| `npm run test:ui:staff` | 员工 UI 链路 |
| `npm run test:ui:session` | 场次 UI 链路 |
| `npm run test:ui:online` | 真实云测试链路 |
| `npm run test:regression` | 串行全量回归 |

补充说明：

- 已移除依赖本地 mock / 假玩家样本的离线脚本，当前仓库不再维护“人机数据”回归通道。

## 6. 分包策略

当前状态：

- 当前分包已真实落地到 `app.json`
- 工作台页和档案扩展页已物理迁移到 `packages/` 目录

主包：

- `pages/home/index`
- `pages/lobby/index`
- `pages/lobby-create/index`
- `pages/team-room/index`
- `pages/activities/index`
- `pages/themes/index`
- `pages/theme-detail/index`
- `pages/profile/index`
- `pages/leaderboard/index`

当前已落地分包：

- 玩家扩展分包：
  - `packages/profile/edit/index`
  - `packages/profile/badges/index`
- 工作台分包：
  - `packages/staff/auth-code/index`
  - `packages/staff/dashboard/index`
  - `packages/staff/users/index`
  - `packages/staff/sessions/index`
  - `packages/staff/store/index`
  - `packages/staff/session/index`
  - `packages/staff/highlights/index`

### 维护要求

1. 新增工作台或档案扩展页时，默认优先进入已有分包，不要重新塞回主包
2. 变更分包页面路径后，必须同步回归所有 `navigateTo/reLaunch/switchTab`

## 7. 维护要求

1. 新增页面后，要把页面目录和主要依赖补到本文件
2. 新增云函数或新增 `action` 后，要把契约和调用方补到本文件
3. 状态、错误码、集合结构变更时，要同步更新对应权威文档
