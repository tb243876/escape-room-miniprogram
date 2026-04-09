# 项目工作手册

本文件是当前项目唯一权威工作手册。

## 1. 进入项目先读什么

固定阅读顺序：

1. `CHANGELOG.md`
2. `PROJECT_CONTEXT.md`
3. `AGENT_WORKFLOW.md`
4. `CODEMAP.md`
5. `STATE_MACHINE.md`
6. `ERROR_CODES.md`
7. `DB_SCHEMA.md`

默认原则：

- 不要一上来全量扫描仓库
- 先确认需求属于哪条业务链路
- 只继续打开对应页面、领域模块、云函数

## 2. 当前运行口径

- `release`：真实云环境 + 正式集合 `prod`
- `trial`：真实云环境 + 正式集合 `prod`
- `develop`：真实云环境 + 正式集合 `prod`
- 所有运行版本都不允许依赖 mock 数据
- `useMockData`、`useMockGroups` 在真实运营链路必须为 `false`
- `initData`、`runtimeReset`、`clearData` 已退出当前真实运营链路，默认视为停用维护能力

当前目标只有一个：

- 体验版必须可以直接拿到线下跑真实业务，不依赖测试种子兜底

## 3. 单一真相源

- 状态流转：`STATE_MACHINE.md`
- 错误码和前端可读文案：`ERROR_CODES.md`
- 集合结构和推荐索引：`DB_SCHEMA.md`
- 页面入口、云函数入口、分包规划：`CODEMAP.md`
- 长期业务口径、权限矩阵、成长体系：`PROJECT_CONTEXT.md`

改动状态、接口、鉴权、集合字段时，必须同步改对应文档，不允许只改代码。

## 4. 核心开发规则

- 每次改代码前先看 `CHANGELOG.md` 最近几条
- 每次改完代码后必须追加一条 `CHANGELOG.md`
- 不允许盲传体验版，不允许直接从脏工作区随手上传
- 发布前必须用隔离快照构建，避免把本地脏改动或回滚误带上去
- 不允许把真实业务链路建立在 seed/test 数据之上
- 不允许再新增 `_test` 集合依赖或任何本地 mock fallback 作为运行兜底
- 新用户进入时必须能自动建档，不能靠昵称兜底猜身份
- 所有玩家资料主键默认按 `openid`
- 组局、房间、场次必须按状态机流转，不能把状态判断散在页面里
- “删除记录”和“删除真实业务数据”必须分开设计；默认优先做个人视角隐藏
- 云端异常必须返回可读错误；新改云函数默认补齐 `errorCode + message + retryable`

## 5. 三条高风险主链路

### 5.1 玩家资料链路

必须保证：

- 首次进入小程序即可拿到可用档案
- 头像、昵称、签名、成长值、荣誉、称号可稳定展示
- 门店侧查看玩家信息时，资料卡和玩家侧档案口径一致

### 5.2 组局链路

必须保证：

- 真实成员以 `groups.participants` 为准
- 本地 `activeGroup / recentGroup` 只做缓存，不是业务真相
- 大厅只展示公共可报名队伍
- 删除记录默认是写 `hiddenForOpenIds`，不是删整条 `groups` 文档

### 5.3 场次与结算链路

必须保证：

- 店员确认成员后才能开始
- 开始后才能结束
- 结束后同一次结算要同步驱动 `profiles`、排行榜读取口径、队伍房间、集锦状态

## 6. 错误返回规范

统一失败返回目标结构：

```json
{
  "ok": false,
  "errorCode": "GROUP_FULL",
  "message": "这个组局已经满员了",
  "retryable": false
}
```

说明：

- `message` 是直接给前端展示的文案
- `errorCode` 是唯一机器可读标识
- `retryable` 表示前端是否应展示“重试”动作
- 具体码表见 `ERROR_CODES.md`

当前存量函数有些仍只返回 `message`，后续凡是触碰到的云函数都要顺手补齐。

## 7. Mock 退出检查项

只有同时满足以下条件，才允许把任何真实链路相关的 mock 开关留在关闭状态并用于体验版/线下：

1. `groupManage`、`staffManage`、`getProfile`、`getLeaderboard` 已部署到目标环境
2. 真实联调通过：
   - 发起组局
   - 加入组局
   - 队伍房间查看成员资料
   - 工作台确认成员 / 开始 / 结束
   - 结算后档案和排行榜可见
3. 回归脚本全绿
4. 真实集合已具备基础运营数据：
   - `themes`
   - `activities`
   - 至少 1 个可用店长或店员授权码
5. `CHANGELOG.md` 和发布快照已补齐

少一条都不允许把体验版当成可线下使用版本。

## 8. 回归脚本说明

基础脚本：

- `npm run lint`
  - 静态检查全部 JS 文件，拦截明显语法和风格问题。
- `npm run test:phase1`
  - 校验核心页面、核心文档、核心模块是否存在，并阻止旧 `group/punch` 页面回流。
- `npm run test:business`
  - 校验成长/徽章/档案归一化、组局状态归一化、员工场次状态推进、环境路由口径。
- 已删除依赖本地 mock / 假玩家数据的离线脚本，不再用“人机数据”证明业务闭环。

UI 自动化：

- `npm run test:ui`
  - UI 总冒烟：首页、大厅、发起组局、档案编辑、工作台授权与进入。
- `npm run test:ui:player`
  - 玩家链路：发起组局、切“我的”、进队伍房间、看成员资料卡。
- `npm run test:ui:staff`
  - 员工链路：授权绑定、工作台首页、进入场次管理入口。
- `npm run test:ui:session`
  - 场次链路：确认成员、开始场次、结束场次、进入待上传集锦。
- `npm run test:ui:online`
  - 真实云测试链路：测试环境初始化、排行榜、工作台授权、线上结束场次、队伍房间核验。

总回归：

- `npm run test:regression`
  - 默认只执行稳定项：`lint -> phase1 -> business`。
  - 如需把 UI 自动化一起纳入总回归，显式执行 `INCLUDE_UI_REGRESSION=1 npm run test:regression`。

## 9. 发布前检查

上传体验版前，至少确认：

1. 上传目录是不是隔离快照
2. `trial -> prod` 路由是不是仍然成立
3. 目标云函数是否已部署到同一环境
4. 关键回归脚本是否已执行并通过
5. `CHANGELOG.md` 是否已经补记

具体隔离快照和发布步骤见 `AGENT_PROMPT.md`。
