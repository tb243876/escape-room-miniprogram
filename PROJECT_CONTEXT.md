# 项目长期上下文

本文件用于沉淀这个项目的长期上下文。

目的：

1. 避免终端关闭或对话重开后丢失关键背景
2. 让后续开发在进入项目时能快速恢复上下文
3. 约束每次新增功能后都要同步更新本文件

---

## 一、项目结构

- 小程序目录：`/Users/edy/Documents/密室小程序/miniapp`
- Web 后台目录：`/Users/edy/Documents/密室小程序/admin-web`
- 外部产品文档目录：`/Users/edy/Documents/密室小程序/docs`
- 外部开发文档目录：`/Users/edy/Documents/密室小程序/开发文档`

当前分工：

- `miniapp`：当前主方向，承接主题展示、活动、档案、徽章、组局大厅、队伍房间、排行榜、门店工作台
- `admin-web`：保留历史原型，不再作为第一阶段主方向

---

## 二、当前业务目标

当前项目目标是做一个密室门店的小程序生态，并且以“统一小程序多角色方案”作为第一阶段正式方向：

1. 用户在小程序看主题和活动
2. 用户在小程序进入组局大厅，发起或加入意向组局
3. 门店在小程序内的工作台确认真实到店成员
4. 门店在工作台点击开始和结束场次
5. 场次结束后系统自动结算档案、徽章、会员成长和排行榜数据
6. 店员上传照片和视频集锦，玩家在有效期内查看

当前第一阶段明确不再以“玩家手动输入打卡码”为主流程，不再以独立 `admin-web` 作为核心运营入口。`pages/punch` 已下线，玩家成长、徽章、排行榜统一由真实场次结算自动驱动。

---

## 三、当前运行策略

当前以“先跑通第一阶段核心闭环，再逐步把云端和结构补齐”为主。

第一阶段核心闭环定义：

1. 首页 / 主题 / 活动可稳定浏览
2. 组局大厅可用
3. 队伍房间可用
4. 门店工作台可用
5. 场次管理链路可用：
   - 确认成员
   - 开始场次
   - 结束场次
   - 自动结算
   - 上传集锦
6. 档案、徽章、成长值、排行榜能被自动结算驱动

当前小程序关键配置：

- `useMockData: false`
- `useMockGroups: true`
- `enablePerfTracing: true`

含义：

- 首页、主题、活动等基础数据优先读云端
- 组局列表 / 发起组局 / 报名组局 当前优先走本地数据，避免云端 `groups` 未接通时页面白屏
- 档案页当前由真实场次记录驱动，优先读本地档案缓存或云端档案
- 开发阶段开启性能追踪日志，便于配合开发者工具的大纲 / 时间线定位页面加载链路

当前需要注意：

- 玩家手动输入场次码链路已从当前小程序主代码中移除
- 第一阶段新增功能默认优先落在统一小程序结构内，不以 `admin-web` 承接新业务

---

## 四、用户明确要求

这是项目中的高优先级长期要求，后续开发默认必须遵守：

1. 每次改问题前，必须先审查相关代码链路，不能只修单点
2. 修一个问题时，要同步检查同类问题会不会出现在其他页面或逻辑里
3. 不要用临时假方案糊弄界面或交互
4. 页面体验优先考虑真实可用，不要做“看起来解决了、实际上只是绕过去”的改法
5. 详情页可以是完整页面，不要强行改成半弹层
6. 布局要自适应，不能靠硬顶高度或大块留白凑效果
7. 每次新增功能、重要改动、运行模式变化、已知遗留问题，都要同步更新本文件
8. 每次新增功能或优化功能时，必须同时整理代码结构，保证前端、后台、云函数、mock、配置、文档边界清晰
9. 代码仓库要朝“教科书式、可维护、职责分明”的方向持续优化，不能接受大杂烩式堆代码
10. 修改一个功能点时，必须评估是否会影响其他功能点，不能因为修一处把别处带坏
11. 所有新增功能除了写代码，还必须同步沉淀：
   - 实现规范
   - UI 规范
   - UI 流程规范
12. 视觉设计必须延续当前小程序暖棕金、圆角卡片、档案馆式风格，不能新增另一套割裂风格
13. 第一阶段开工前，默认必须先读实现文档、UI 规范和 UI 流程图，再开始写代码

---

## 五、当前已落地的重要约定

1. 主题恐怖星级需要展示为星级，而不是只显示文字描述
2. 如果云端 `themes` 数据没有 `horrorStars` 字段，前端需要按恐怖等级兜底映射：
   - `微恐 -> 1`
   - `中恐 -> 3`
   - `重恐 -> 5`
3. “我的”页内容过多时必须可滚动，不能把联系门店挤到不可点击区域
4. 后续功能开发除了做功能本身，还要同步做结构收敛，避免单文件越来越臃肿
5. 门店场次管理必须明确拆分为五个阶段：
   - 确认成员
   - 开始场次
   - 结束场次
   - 自动结算
   - 上传集锦
6. 开始和结束必须是两个独立动作，不能合并成一个按钮
7. 玩家端不再保留“手动输入打卡码”页面或相关入口
8. 工作台授权码一旦本机绑定成功，后续进入工作台应直接进入工作台而不是重复要求输入授权码

---

## 六、当前已知事实

1. 腾讯 CloudBase 环境已接通过一次
2. 当前用户更关心小程序真实体验能跑通
3. 用户对界面细节、留白、按钮大小、交互稳定性非常敏感
4. 用户已经明确要求后续开发要记住这些偏好，而不是每次重新解释
5. 代码结构现在开始按“服务编排层 + 领域工具层”收敛，不再把所有逻辑持续堆在单一入口文件里
6. 产品主方向已经切换为“统一小程序 + 玩家 / 店员 / 副店长 / 店长多角色权限”
7. 最新外部产品与设计资料已经生成，但必须同步收敛到代码仓库内文档，不能只留在外部目录

---

## 七、当前已知遗留关注点

以下问题后续开发前要优先核对：

1. 主题星级如果界面仍不显示，需要直接打运行日志核对页面拿到的真实数据
2. “我的”页滚动布局每次再改结构时，都要回归验证：
   - 最近体验主题变多
   - 小功能区仍可见
   - 联系门店可滑动到并可点击
3. 档案、徽章、排行榜和真实场次结算之间的联动，后续每次改动都要一起回归验证
4. 当前第一阶段目录已补齐到仓库：
   - `pages/lobby/`
   - `pages/team-room/`
   - `pages/leaderboard/`
   - `pages/staff-auth-code/`
   - `pages/staff-dashboard/`
   - `pages/staff-session/`
   - `pages/staff-highlights/`
5. 历史文档里仍有部分 “web 后台生成场次码 + 玩家输入打卡码” 的旧描述，后续必须以新的统一小程序方案为准
6. 第一阶段第一批页面骨架已落地：
   - `pages/lobby/`
   - `pages/lobby-create/`
   - `pages/team-room/`
   - `pages/staff-auth-code/`
   - `pages/staff-dashboard/`
   - `pages/staff-session/`
7. 底部 tab 第二区已从“打卡”切换为“组局”，旧打卡页已下线
8. “我的”页小功能区已新增“工作台”入口，已支持本机授权持久化直达
9. 组局大厅当前采用“同一 tab 内双页面切换”结构：
   - 页面一：大厅，只看公共可浏览组局
   - 页面二：我的，只看与当前用户相关的组局
   - “我的”页内只区分：我发起的 / 我加入的
   - 大厅当前只保留主题筛选；状态筛选已移除
10. 组局大厅右上角状态需要始终保持明显，不允许再退回成“弱提示文字”导致用户难以快速区分场次状态
11. 组局大厅的筛选和确认交互统一使用页面自定义弹层，不再使用系统默认白色 `showActionSheet` / `showModal` 样式破坏整体视觉
12. 公共大厅禁止展示已取消队伍；已取消或已过期的个人队伍记录只允许在“我的”里保留，并提供显式删除按钮
13. 队伍房间里的成员必须支持点开查看基础玩家卡片，至少展示：通关次数、荣誉、称号、成长值、签名
14. “我的”页必须承接个人资料能力，当前第一版已开始支持：头像、昵称、签名、性别编辑；荣誉和称号优先按真实场次与徽章自动生成

---

## 八、最近一次结构优化结果

本次已完成的结构整理：

1. 将 `utils/cloudbase.js` 从单文件大杂烩拆为多模块协作
2. 新增运行时模块：
   - `utils/runtime.js`
3. 新增本地存储模块：
   - `utils/storage.js`
4. 新增主题领域模块：
   - `utils/theme.js`
5. 新增档案领域模块：
   - `utils/profile.js`
6. 新增组局领域模块：
   - `utils/group.js`
7. 云函数入口收敛为编排层：
   - `cloudfunctions/getProfile/index.js`
8. 页面层开始按“页面编排 + view-model”分层：
   - `pages/home/view-model.js`
   - `pages/profile/view-model.js`
   - `pages/themes/view-model.js`
   - `pages/theme-detail/view-model.js`
   - `pages/activities/view-model.js`
   - `pages/badges/view-model.js`
9. `utils` 目录已进一步收敛为分层结构：

- `utils/cloudbase.js` 作为统一服务编排入口
- `utils/platform/` 放运行时与存储适配
- `utils/domain/` 放主题、档案、组局等领域逻辑
- `utils/README.md` 记录目录职责边界

11. 已新增项目架构说明文档：

- `ARCHITECTURE.md`
- 后续进入项目时可用来快速理解仓库地图和目录边界

12. 云函数已补充独立架构与模板文档：

- `cloudfunctions/ARCHITECTURE.md`
- `cloudfunctions/TEMPLATE.md`
- 后续新增云函数默认按模板落地

13. 已开始接入基础工程工具链：

- `ESLint`
- `Prettier`
- 目标是先建立基础静态检查和统一格式能力

14. 已接入统一性能追踪能力：

- `utils/platform/perf.js` 作为统一埋点入口
- 关键链路已覆盖首页加载、主题详情加载、档案加载、组局加载/创建/加入
- 关键链路已继续补齐活动页、徽章页
- 开发期日志前缀统一为 `[perf]`
- 需要排查页面闪动、加载慢、状态异常时，优先结合微信开发者工具时间线与控制台日志一起看

15. 当前仓库主开发入口统一收敛在 `miniapp`，`admin-web` 仅保留历史原型参考，不再承担第一阶段主链路开发

当前目标：

- 页面层只处理页面状态和交互
- 服务入口只做业务编排
- 规则、字段映射、校验、本地状态分别沉到独立模块
- 后续新增功能优先复用这些模块，不要再把逻辑塞回单一大文件
- 第一阶段新增能力默认按业务域拆页，不再恢复旧 `group` 单页大而全模式
- 新增功能的 UI、流程、实现规范必须在代码仓库内同时存在
- 第一阶段下一步优先补齐：
  - 组局与房间云端数据结构
  - 自动结算云函数真实实现
  - 门店授权码云端模型
  - 场次状态流转真实云函数

16. 第一阶段补充收敛结果：

- 已新增 `pages/leaderboard/` 排行榜页
- 已新增 `pages/staff-highlights/` 集锦管理页
- 已新增 `pages/profile-edit/` 个人资料编辑页
- 已新增 `utils/domain/staff.js`
- 已新增 `utils/domain/leaderboard.js`
- 已补齐个人资料基础字段：
  - 头像
  - 昵称
  - 签名
  - 性别
  - 称号
  - 荣誉标签
- 已补齐队伍房间成员玩家卡片弹层
- 已新增基础结构校验脚本：
  - `scripts/phase1-smoke-check.cjs`
- 已新增业务规则校验脚本：
  - `scripts/business-rules-check.cjs`
- 已新增主流程自动化校验脚本：
  - `scripts/main-flow-check.cjs`
- 已新增接口契约自动化校验脚本：
  - `scripts/interface-contract-check.cjs`
- 已新增性能冒烟校验脚本：
  - `scripts/perf-smoke-check.cjs`
- 已新增基础 UI 冒烟脚本：
  - `scripts/ui-flow-check.cjs`
- 已新增拆分式 UI 自动化脚本：
  - `scripts/ui-player-flow-check.cjs`
  - `scripts/ui-staff-flow-check.cjs`
  - `scripts/ui-session-flow-check.cjs`
- 当前自动化命令矩阵：
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
- UI 自动化执行约束：
  - 所有 `test:ui*` 脚本必须串行运行
  - 不允许并行启动多个 `miniprogram-automator` 会话
  - 如出现 `Connection closed`，先检查是否有并发 UI 测试会话，而不是先判定业务页面失败
  - 当前微信开发者工具启动在本机上存在明显冷启动波动，UI helper 已统一配置：
    - `timeout: 90000`
    - `trustProject: true`
    - 固定端口 `9420`
- 当前推荐回归入口：
  - 日常统一优先执行 `npm run test:regression`
  - 该命令固定顺序为：静态检查 -> 结构/规则/流程 -> 契约 -> 性能 -> UI 冒烟 -> 玩家 UI -> 员工 UI -> 场次 UI
- 已新增性能冒烟校验脚本：
  - `scripts/perf-smoke-check.cjs`
- 已新增 UI 自动化校验脚本：
  - `scripts/ui-flow-check.cjs`
- 已新增测试记录文档：
  - `docs/PHASE1_TEST_REPORT.md`

---

## 历史修复记录：Mock 数据泄漏导致徽章不一致（2026-03-29）

**问题现象**：排行榜显示 2 枚徽章，个人资料页显示 1 枚徽章。两处数据来源理论上相同（都从 punchRecords 计算），但结果不一致。

**根因**：客户端 `utils/domain/profile.js` 中的 `getPlayRecords` 优先读取 `playRecords` 字段。Mock 数据 `mock/data.js` 的 profile 包含 `playRecords: []`，而云端数据用的是 `punchRecords`。当客户端 `normalizeProfile` 合并 mock 默认值和云端数据时，空的 `playRecords: []` 被优先读取，导致徽章按空数据计算。排行榜不受影响是因为云端 `getLeaderboard` 的 `buildDefaultProfile` 没有 `playRecords` 字段。

**修复**：
1. `getPlayRecords` 改为优先检查 `punchRecords`，再 fallback 到 `playRecords`
2. 在 `DEVELOPMENT_RULES.md` 新增第七章，明确 mock 数据与云端数据隔离规范

**教训**：mock 数据的字段名、默认值、空数组都可能在合并时覆盖真实数据。云端模式下绝不应引用 mock 文件。

---

## 九、每次开发后必须更新

后续每次新增功能或重要改动后，必须至少补充以下内容：

1. 新增了什么功能
2. 改了哪些运行策略
3. 有没有新增已知问题
4. 有没有新的测试注意事项
5. 有没有影响到小程序、后台、云环境、导入数据之间的关系
6. 本次有没有顺手整理代码结构，或新增了哪些结构风险
7. 本次是否同步更新了：
   - `docs/PHASE1_DEVELOPMENT_GUIDE.md`
   - `docs/UI_STYLE_GUIDE.md`
   - `docs/UI_FLOW_GUIDE.md`

---

## 十、进入项目时的默认读取顺序

后续重新进入项目时，默认先读：

1. `FINAL_DEVELOPMENT_SPEC.md`
2. `PROJECT_CONTEXT.md`
3. `docs/PHASE1_DEVELOPMENT_GUIDE.md`
4. `docs/UI_STYLE_GUIDE.md`
5. `docs/UI_FLOW_GUIDE.md`
6. 当前被修改功能相关页面和工具文件

这样可以最快恢复正确上下文。
