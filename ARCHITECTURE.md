# 项目架构说明

本文件用于说明当前仓库的目录结构、职责边界和后续维护约束。

目标：

1. 让新进入项目的人能快速看懂仓库结构
2. 让后续功能开发有明确落点
3. 避免代码继续回退成平铺式大杂烩

---

## 一、整体结构

当前项目由两个主要部分组成：

### 1. 小程序端

路径：

- `/Users/edy/Documents/密室小程序/miniapp`

职责：

- 展示主题
- 展示活动
- 展示会员档案和徽章
- 发起组局 / 报名组局
- 承接门店工作台与集锦流程

补充说明：

- 第一阶段正式方向已经升级为统一小程序多角色方案
- 小程序后续将承接组局大厅、队伍房间、排行榜、门店工作台

### 2. Web 后台端

路径：

- `/Users/edy/Documents/密室小程序/admin-web`

职责：

- 保留历史原型参考
- 非第一阶段核心业务入口

补充说明：

- `admin-web` 当前保留为历史原型
- 第一阶段正式业务主方向已切换到统一小程序多角色方案
- 后续新增核心业务默认优先放在 `miniapp`

---

## 二、小程序目录说明

### 1. `pages/`

职责：

- 放所有页面
- 每个页面目录内只放该页面自己的 WXML / WXSS / JS / JSON

当前要求：

1. `index.js` 只负责：
   - 生命周期
   - 页面状态
   - 交互编排
   - 调用 service
2. 页面辅助计算、视图衍生状态、默认表单结构，优先拆到同目录下的 `view-model.js`
3. 页面不要直接承载大量底层业务规则

当前已经按此模式整理的页面：

- `pages/home/`
- `pages/profile/`
- `pages/themes/`
- `pages/theme-detail/`
- `pages/activities/`
- `pages/badges/`
- `pages/lobby/`
- `pages/lobby-create/`
- `pages/team-room/`
- `pages/leaderboard/`
- `pages/staff-auth-code/`
- `pages/staff-dashboard/`
- `pages/staff-session/`
- `pages/staff-highlights/`

第一阶段计划新增并按相同模式拆分的页面：

- `pages/lobby/`
- `pages/lobby-create/`
- `pages/team-room/`
- `pages/leaderboard/`
- `pages/staff-auth-code/`
- `pages/staff-dashboard/`
- `pages/staff-session/`
- `pages/staff-highlights/`

### 2. `utils/`

职责：

- 放小程序公共业务逻辑

当前分层：

#### `utils/cloudbase.js`

职责：

- 小程序统一服务入口
- 对页面提供稳定 API
- 负责业务编排

要求：

- 不继续堆底层实现
- 尽量保持为“薄编排层”

#### `utils/platform/`

职责：

- 放平台能力与环境适配

当前内容：

- `runtime.js`
  - app 配置读取
  - mock 模式判断
  - CloudBase 调用
  - 延迟模拟
- `storage.js`
  - 本地缓存读写
  - 业务缓存清理
- `perf.js`
  - 开发期性能追踪
  - 统一链路计时
  - 控制台调试日志输出

#### `utils/domain/`

职责：

- 放领域规则和数据整理逻辑

当前内容：

- `theme.js`
  - 主题过滤
  - 活动状态整理
  - 恐怖星级兜底
  - 主题展示字段整理
- `profile.js`
  - 档案归一化
  - 等级与徽章规则
  - 本地档案读写
- `group.js`
  - 组局对象归一化
  - 组局表单校验
  - 本地组局读写

第一阶段建议补充：

- `team-room.js`
  - 队伍房间状态归一化
  - 房间展示字段整理
  - 时间轴数据整理
- `staff.js`
  - 员工角色判断
  - 授权码状态判断
  - 场次按钮状态映射
- `leaderboard.js`
  - 排行榜数据整理
  - 排名展示字段映射

当前已补齐：

- `team-room.js`
- `staff.js`
- `leaderboard.js`

维护要求：

1. 新增公共业务规则，优先放 `domain/`
2. 新增平台相关能力，优先放 `platform/`
3. 不要让页面跨层直连底层实现

### 3. `cloudfunctions/`

职责：

- 放需要云端一致性保证的业务逻辑

当前原则：

1. 云函数入口 `index.js` 只做：
   - 参数读取
   - 事务编排
   - 错误捕获
   - 返回结果
2. 云函数内部规则、档案处理、结果构造优先拆到同目录独立模块

当前结构示例：

- `cloudfunctions/getProfile/`
  - `index.js`
  - `profile-domain.js`

第一阶段计划新增云函数目录：

- `cloudfunctions/createLobbyPost/`
- `cloudfunctions/joinLobbyPost/`
- `cloudfunctions/getLobbyList/`
- `cloudfunctions/getTeamRoom/`
- `cloudfunctions/createStaffAuthCode/`
- `cloudfunctions/redeemStaffAuthCode/`
- `cloudfunctions/getStaffDashboard/`
- `cloudfunctions/confirmSessionMembers/`
- `cloudfunctions/startSession/`
- `cloudfunctions/endSessionAndSettle/`
- `cloudfunctions/uploadHighlights/`
- `cloudfunctions/getLeaderboard/`

补充说明：

- 当前 `leaderboard`、`staff-highlights`、`staff-session` 仍先通过本地 mock 跑通前端和结构
- 等第一阶段真实云端链路接通后，再把状态流转和结算切到云函数

### 5. `scripts/`

职责：

- 放基础工程化校验脚本

当前内容：

- `phase1-smoke-check.cjs`
  - 校验第一阶段核心页面是否注册完整
  - 校验关键文档和领域模块是否存在

要求：

1. 脚本优先做轻量、稳定、零额外依赖的检查
2. 结构校验和静态检查要能被单人开发快速执行

### 4. `mock/`

职责：

- 放本地调试和演示数据

要求：

1. mock 数据结构必须尽量贴近真实云端结构
2. 如果真实字段变了，要同步检查 mock 是否漂移
3. 不要把页面逻辑写进 mock 文件

### 5. `assets/`

职责：

- 放静态资源

当前子目录：

- `assets/themes/`
- `assets/tabbar/`

### 6. `custom-tab-bar/`

职责：

- 放自定义 tabBar

要求：

- 仅负责 tabBar 展示和切换
- 不承载业务状态

---

## 三、后台目录说明

### `admin-web/`

当前为轻量后台端。

职责：

- 生成场次码
- 为后续后台管理扩展做基础

当前结构较轻，后续如果功能继续增加，也要按类似原则分层：

1. 页面展示
2. 后台 API / CloudBase 调用
3. 数据模型 / 字段整理
4. 轻量调试追踪
   - 当前后台调试日志前缀统一为 `[admin-perf]`
   - 关键链路至少覆盖连接、拉取、推送、创建

---

## 四、当前分层原则

后续所有新增功能默认按以下分层放置：

1. 页面展示与交互编排
   - `pages/<page>/index.js`
2. 页面视图辅助逻辑
   - `pages/<page>/view-model.js`
3. 小程序服务编排
   - `utils/cloudbase.js`
4. 平台适配
   - `utils/platform/*`
5. 业务领域规则
   - `utils/domain/*`
6. 云端一致性逻辑
   - `cloudfunctions/*`

7. 第一阶段实现与 UI 规范文档
   - `docs/PHASE1_DEVELOPMENT_GUIDE.md`
   - `docs/UI_STYLE_GUIDE.md`
   - `docs/UI_FLOW_GUIDE.md`

---

## 五、严格禁止的结构问题

后续开发中，以下情况默认禁止：

1. 把多个业务领域继续堆到一个超大工具文件里
2. 页面直接写大量业务规则、等级规则、字段整理规则
3. 平台适配逻辑和业务规则混写
4. 云函数入口文件膨胀成大杂烩
5. mock 数据结构长期偏离真实结构
6. 改一个公共字段却不检查页面、mock、云函数、后台是否一起受影响
7. 在旧流程文案里继续默认强调“玩家手动输入打卡码”为主路径
8. 新增门店功能时直接塞进玩家页面或把多角色逻辑混在一个页面里

---

## 六、基础工程工具链

当前项目已接入基础工程工具链：

1. `ESLint`
   - 负责基础静态检查
   - 目标是尽早发现未定义变量、无用变量、低级风格问题
2. `Prettier`
   - 负责基础格式统一
3. 开发调试追踪
   - 页面和关键业务链路可接入 `utils/platform/perf.js`
   - 调试日志统一输出 `[perf]`
   - 目标是让微信开发者工具的大纲、时间线、控制台日志能对应到具体业务步骤
   - 目标是避免代码风格持续漂移

默认命令：

- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`

---

## 七、后续维护方式

后续每次新增功能或重构时，默认按下面顺序判断落点：

1. 这是页面展示逻辑吗？
   - 放 `pages/<page>/`
2. 这是页面自己的视图辅助逻辑吗？
   - 放 `pages/<page>/view-model.js`
3. 这是多个页面共用的业务规则吗？
   - 放 `utils/domain/`
4. 这是运行时、存储、环境能力吗？
   - 放 `utils/platform/`
5. 这是必须云端保证一致性的逻辑吗？
   - 放 `cloudfunctions/`

---

## 八、当前结论

当前仓库已经从“平铺 + 单文件堆逻辑”开始收敛为：

- 页面编排层
- 页面 view-model 层
- 服务编排层
- 平台层
- 领域层
- 云函数入口层
- 云函数领域层

后续开发必须继续沿这个方向推进，不允许回退。
