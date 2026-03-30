# Phase 1 测试记录

更新时间：2026-03-27

## 一、测试目的

本记录用于明确当前第一阶段代码到底验证到了什么程度，避免把“页面骨架已完成”误认为“全链路已经可上线”。

## 二、已执行检查

### 1. 静态检查

- `npm run lint`
- `npm run test:phase1`
- `npm run test:business`
- `npm run test:flows`
- `npm run test:api`
- `npm run test:perf`
- `npm run test:ui`
- `npm run test:ui:player`
- `npm run test:ui:staff`
- `npm run test:ui:session`
- `npm run test:regression`

### 2. 结构核对范围

- `app.json` 页面注册完整性
- 第一阶段核心页面文件是否齐全
- 核心文档是否在仓库内同步沉淀
- 关键领域模块是否已拆出

### 3. 主流程自动化覆盖范围

- 首页内容读取：`getHomeData`
- 主题列表 / 筛选 / 详情读取：`getThemes`、`getThemeDetail`
- 活动列表读取：`getActivities`
- 档案与排行榜读取：`getProfile`、`getLeaderboard`
- 个人资料保存：`updateProfile`
- 组局大厅主流程：加载、创建、冲突拦截、取消、删除、加入、退出
- 队伍房间读取：`getTeamRoom`
- 队伍成员玩家卡片字段校验：`getTeamRoom.members[].playerCard`
- 门店工作台主流程：授权码绑定、工作台读取、场次读取、确认成员、开始场次、结束场次、集锦列表读取

### 4. 接口契约自动化覆盖范围

- 服务层返回结构完整性校验
- 首页、主题、活动、档案、组局、房间、工作台、排行榜核心字段契约校验
- 适用于当前小程序“无独立 HTTP 后端、以服务编排层为接口边界”的代码结构

### 5. 性能冒烟覆盖范围

- `getHomeData`
- `getThemes`
- `getActivities`
- `getLobbyList`
- `getProfile`
- `getLeaderboard`

说明：

- 当前性能测试是服务层性能冒烟，不是 FPS、首屏渲染或真机交互流畅度压测
- 当前 mock 场景下主要用于拦截明显性能回退

### 6. UI 自动化覆盖范围

- 首页加载
- 组局大厅加载
- 发起组局页输入校验
- 档案页加载
- 员工授权页输入授权码
- 跳转至门店工作台
- 玩家链路拆分校验：
  - 首页加载
  - 组局大厅加载
  - 发起组局表单校验
  - 创建组局成功返回大厅
  - “我的”页出现我发起的队伍
  - 进入队伍房间
- 员工链路拆分校验：
  - 店长授权码输入
  - 跳转门店工作台
  - 工作台核心入口渲染
- 场次链路拆分校验：
  - 进入场次管理页
  - 确认成员
  - 开始场次
  - 结束场次

说明：

- 拆分 UI 自动化必须串行执行，不要并行拉起多个 `miniprogram-automator` 会话
- 并行运行时会争抢微信开发者工具连接，容易出现 `Connection closed`，这属于测试基础设施冲突，不是业务逻辑失败
- 日常建议直接跑 `npm run test:regression`，该命令已内置固定顺序，会先跑静态与服务层，再串行跑全部 UI 自动化
- 当前本机微信开发者工具冷启动偏慢，UI helper 已固定采用：
  - `timeout: 90000`
  - `trustProject: true`
  - 固定端口 `9420`

## 三、当前已确认可用范围

### 1. 玩家端

- 首页、主题、活动、档案、徽章页面仍保留
- 组局大厅、发起组局、队伍房间页面已具备第一阶段演示链路
- 排行榜页面已补齐

### 2. 门店端

- 授权码绑定页可进入工作台
- 工作台可查看今日场次列表
- 场次管理页可查看成员、时间轴和动作链说明
- 集锦管理页已补齐

### 3. 工程化

- `utils/domain/` 已补到 `group / team-room / staff / leaderboard`
- 新增 `scripts/phase1-smoke-check.cjs` 作为基础结构校验
- 新增 `scripts/business-rules-check.cjs` 作为领域规则校验
- 新增 `scripts/main-flow-check.cjs` 作为主流程自动化校验
- 新增 `scripts/interface-contract-check.cjs` 作为接口契约自动化校验
- 新增 `scripts/perf-smoke-check.cjs` 作为性能冒烟校验
- 新增 `scripts/ui-flow-check.cjs` 作为小程序 UI 自动化校验
- 新增 `scripts/ui-player-flow-check.cjs` 作为玩家主流程 UI 自动化校验
- 新增 `scripts/ui-staff-flow-check.cjs` 作为员工登录与工作台 UI 自动化校验
- 新增 `scripts/ui-session-flow-check.cjs` 作为场次状态流转 UI 自动化校验
- 新增 `scripts/regression-check.cjs` 作为统一全量回归入口
- 文档已同步到仓库内，不再只存在外部目录

## 四、当前仍是模拟或未接通部分

- 组局大厅当前仍以本地 mock 为主，不是正式云端组局数据
- 门店授权码当前仍是本地 mock，不是真实可失效的云端授权码
- 场次管理的开始 / 结束 / 上传集锦 仍是演示态，未接真实云函数
- 排行榜当前仍是本地演示数据，未接真实自动结算结果
- 自动结算云函数 `endSessionAndSettle` 仍未正式实现

## 五、下一阶段建议顺序

1. 接通门店授权码云端模型
2. 接通场次状态流转云函数
3. 实现结束场次后的自动结算
4. 再把排行榜和集锦切到真实数据
