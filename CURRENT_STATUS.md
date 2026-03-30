# 当前状态

本文件只记录当前真实状态，控制在短、准、可续接。

进入项目时建议阅读顺序：

1. `PROJECT_CONTEXT.md`
2. `CURRENT_STATUS.md`
3. `CODEMAP.md`
4. 本次需求涉及的页面和模块

---

## 一、项目当前定位

- 当前主项目：`/Users/edy/Documents/密室小程序/miniapp`
- 当前主方向：统一小程序多角色方案
- `admin-web` 当前只保留历史原型参考，不作为第一阶段主入口

---

## 二、当前运行配置

来自 `app.js` 的当前有效配置：

- `envId: mini-escape-main-9f3bjb2e7249ec8`
- `useMockData: false`
- `useMockGroups: false`
- `enablePerfTracing: true`
- `storeName: 迷场档案馆`

当前含义：

- 首页、主题、活动、档案等优先走 CloudBase 或云函数
- 组局大厅、发起组局、加入组局、退出/取消组局、队伍房间已切到云端
- 工作台授权、工作台首页、场次管理、排行榜已补齐云端入口
- 开发阶段保留性能追踪日志

---

## 三、当前页面主链路

- 首页：可浏览
- 主题列表 / 详情：可浏览
- 活动页：可浏览
- 组局大厅：已接入
- 发起组局：已接入
- 队伍房间：已接入
- 排行榜：已接入
- 我的页：已接入
- 资料编辑：已接入
- 工作台授权：已接入
- 工作台首页：已接入
- 场次管理：已接入
- 集锦页：已接入

说明：

- “已接入”表示仓库内已有页面和主流程骨架，不等于所有真实云端闭环都已完成

---

## 四、当前结构状态

- 页面层基本采用 `index.js + view-model.js` 模式
- 公共逻辑已按 `utils/cloudbase.js + utils/platform/* + utils/domain/*` 分层
- 云函数已开始按“入口编排 + 同目录领域模块”模式收敛

当前已接通的云函数：

- `getProfile`
- `updateProfile`
- `groupManage`
- `staffManage`
- `getLeaderboard`

当前重点公共模块：

- `utils/cloudbase.js`
- `utils/platform/runtime.js`
- `utils/platform/storage.js`
- `utils/platform/perf.js`
- `utils/domain/theme.js`
- `utils/domain/profile.js`
- `utils/domain/group.js`
- `utils/domain/team-room.js`
- `utils/domain/staff.js`
- `utils/domain/leaderboard.js`

当前核心云端集合：

- `themes`
- `activities`
- `groups`
- `profiles`
- `staff_auth_codes`
- `staff_bindings`
- `staff_sessions`
- `staff_highlights`
- `punch_codes`

---

## 五、当前产品约束

- 不再以“玩家手动输入打卡码”为主流程
- 工作台场次管理必须保留五阶段：
  - 确认成员
  - 开始场次
  - 结束场次
  - 自动结算
  - 上传集锦
- 开始和结束必须是两个独立动作
- 工作台授权码本机绑定成功后，应直接进入工作台
- 视觉风格继续沿用暖棕金、圆角卡片、档案馆式方向

当前新增落实：

- 资料编辑已从“仅本地缓存”升级为“云函数持久化 + 本地缓存同步”
- 若 `updateProfile` 云函数未部署或当前云端异常，资料编辑会先兜底保存到本机，避免用户无法保存
- 组局大厅加入链路已从“直接确认”升级为“联系人称呼 + 手机号表单提交”
- 组队线上最小闭环已落地到 `groupManage` 云函数
- `groups` 集合初始化结构已补齐：主题、日期、发起人、参与成员、状态、创建时间
- 线上组队当前不再静默回退本地 mock；云端异常会直接报错，避免假在线
- 工作台链路已落地到 `staffManage` 云函数：授权、看板、场次详情、成员到店确认、开始、结束、集锦列表
- 场次结束后会写回 `profiles`，同步成长值、真实完成记录、最近主题，并驱动排行榜变化
- 排行榜已改为云函数实时读取 `profiles` 聚合，不单独维护静态榜单表
- 历史脏组局状态现在会按实际人数自动纠偏：未满员强制回到 `recruiting`，满员未开场强制进入 `pending_store_confirm`
- “删除队伍记录”已改为个人视角隐藏，不再误删整条真实组局，已取消 / 已结算 / 已过期记录都可按用户维度清理
- 工作台场次动作已补齐阶段校验：未确认成员不能开始，非待确认阶段不能再改成员到店状态
- 工作台子页在授权失效时会自动回跳授权页，不再停留在无权限空页

---

## 六、当前高频回归点

- 主题恐怖星级展示是否正常
- 我的页在内容增多后是否还能自然滚动
- 联系门店区域是否仍可滑到并点击
- 组局大厅是否错误展示已取消队伍
- 我的组局里已取消 / 已过期记录是否还能显式删除
- 新用户首次进入时，云数据库 `groups` 集合是否已有可展示的初始化数据
- 多人同时报名同一组局时，是否仍能正确限制满员
- 店员结束场次后，玩家档案、队伍房间、排行榜是否都已经基于同一次结算更新
- `staff_auth_codes` / `staff_bindings` 是否已导入且授权码状态正常
- 队伍房间成员卡片展示是否完整
- 场次结束后的档案、徽章、成长值、排行榜联动是否被改坏
- 工作台授权持久化后是否还能直达工作台
- 已删除的个人历史队伍记录是否真的只对当前用户隐藏，而不会影响其他参与人
- 工作台确认 / 开始 / 结束是否仍然严格按顺序执行，越级点击是否被拦住

---

## 七、当前已知现实情况

- CloudBase 环境已配置，项目里已有真实 `envId`
- 组局已新增 `groupManage` 云函数，前端默认按云端真实数据运行
- 资料读取走 `getProfile` 云函数，资料编辑已新增 `updateProfile` 云函数
- 工作台已新增 `staffManage` 云函数，默认按云端真实数据运行
- 排行榜已新增 `getLeaderboard` 云函数，默认按 `profiles` 实时聚合
- 仓库内已经沉淀了较完整的长期上下文和架构文档
- 项目已有 lint、业务规则、流程、接口、性能、UI、回归脚本入口
- 组队链路已新增独立回归脚本 `npm run test:groups`，用于专测历史数据、成员同步、退出恢复、脏缓存收敛

---

## 八、当前建议开发方式

以后新需求默认按这套顺序：

1. 先读 `PROJECT_CONTEXT.md`
2. 再读 `CURRENT_STATUS.md`
3. 再读 `IMPACT_MAP.md`
4. 再读 `CODEMAP.md`
5. 只打开本次需求涉及的页面目录和公共模块
6. 改完后同步更新上述文档，而不是靠聊天历史记忆

---

## 九、当前关键实现约束

- 组队链路当前唯一真实成员源是 `groups.participants`
- `activeGroup / recentGroup` 只做本地缓存，不允许再作为最终成员展示真相源
- 队伍房间成员必须由 `participants` 推导，`roomMembers` 只能补充阶段状态
- 以后凡是改组队相关逻辑，必须同时回查大厅列表、我的队伍、房间详情三处是否仍一致

---

## 十、下一次进入项目时可直接复用的提示词

示例：

`先不要全量扫描仓库。先读 PROJECT_CONTEXT.md、CURRENT_STATUS.md、IMPACT_MAP.md、CODEMAP.md。然后只看这次需求相关文件：xxx。`

---

## 十一、维护要求

1. 每次重要功能落地后，更新本文件中的“当前页面主链路”和“当前已知现实情况”
2. 每次运行策略变化后，更新本文件中的“当前运行配置”
3. 每次新增高风险功能后，把回归点补到本文件
