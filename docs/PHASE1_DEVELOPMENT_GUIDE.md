# 第一阶段开发文档

本文件是第一阶段开工文档。

目标：

1. 把第一阶段实际要做的范围说清楚
2. 把页面落点、数据落点、云函数落点说清楚
3. 让开发开始写代码前，先有统一边界

---

## 一、第一阶段目标

第一阶段不是做完整社交平台，而是先跑通“真实组局闭环”。

闭环定义：

1. 玩家浏览首页、主题、活动
2. 玩家进入组局大厅
3. 玩家发起或加入意向组局
4. 门店确认真实到店成员
5. 系统生成真实队伍房间
6. 门店开始场次
7. 门店结束场次
8. 系统自动结算档案、徽章、成长值、排行榜
9. 店员上传集锦
10. 玩家回看结果和集锦

---

## 二、不属于第一阶段主路径的内容

以下内容不作为第一阶段主路径：

1. 玩家手动输入打卡码
2. 独立 `admin-web` 作为核心后台入口
3. 完整实时聊天
4. 支付和订单系统
5. 复杂社交关系链

---

## 三、页面清单

### 玩家域

1. `pages/home/`
2. `pages/themes/`
3. `pages/theme-detail/`
4. `pages/activities/`
5. `pages/profile/`
6. `pages/badges/`
7. `pages/lobby/`
8. `pages/lobby-create/`
9. `pages/team-room/`
10. `pages/leaderboard/`

### 门店域

1. `pages/staff-auth-code/`
2. `pages/staff-dashboard/`
3. `pages/staff-session/`
4. `pages/staff-highlights/`

---

## 四、每个页面的职责

### `pages/lobby/`

- 展示组局大厅列表
- 提供筛选能力
- 提供“加入组局”和“去发起组局”入口

### `pages/lobby-create/`

- 发起意向组局
- 只收最低必要字段

### `pages/team-room/`

- 展示真实队伍状态
- 展示成员列表
- 展示时间轴
- 展示结算结果
- 展示集锦入口

### `pages/leaderboard/`

- 展示成长榜、通关榜、探索榜

### `pages/staff-auth-code/`

- 员工首次输入授权码

### `pages/staff-dashboard/`

- 展示今日待办
- 展示待确认、待开始、进行中、待上传集锦的列表

### `pages/staff-session/`

- 承接单个场次管理
- 必须完整覆盖：
  - 确认成员
  - 开始场次
  - 结束场次
  - 自动结算
  - 上传集锦

### `pages/staff-highlights/`

- 上传集锦
- 查看集锦素材状态

---

## 五、服务与领域模块建议

建议新增：

### 页面 view-model

- `pages/lobby/view-model.js`
- `pages/team-room/view-model.js`
- `pages/leaderboard/view-model.js`
- `pages/staff-dashboard/view-model.js`
- `pages/staff-session/view-model.js`

### 领域模块

- `utils/domain/lobby.js`
- `utils/domain/team-room.js`
- `utils/domain/staff.js`
- `utils/domain/leaderboard.js`

职责：

1. 统一状态字段
2. 整理展示文案
3. 做按钮状态映射
4. 做表单校验

---

## 六、云函数建议

第一阶段建议按动作拆分：

1. `createLobbyPost`
2. `joinLobbyPost`
3. `getLobbyList`
4. `getTeamRoom`
5. `createStaffAuthCode`
6. `redeemStaffAuthCode`
7. `getStaffDashboard`
8. `confirmSessionMembers`
9. `startSession`
10. `endSessionAndSettle`
11. `uploadHighlights`
12. `getLeaderboard`

---

## 七、强制状态流转

### 玩家端

1. 首页
2. 主题详情
3. 组局大厅
4. 发起 / 加入组局
5. 待门店确认
6. 真实队伍房间
7. 结果页
8. 档案 / 徽章 / 排行榜

### 门店端

1. 工作台入口
2. 首次授权
3. 工作台首页
4. 场次管理
5. 确认成员
6. 开始场次
7. 结束场次
8. 自动结算
9. 上传集锦

---

## 八、最关键的按钮规则

`pages/staff-session/` 必须满足：

1. `pending_confirm`
   - 只能显示 `确认成员`
2. `ready`
   - 只能显示 `开始场次`
3. `playing`
   - 只能显示 `结束场次`
4. `settling`
   - 只能显示禁用态 `正在结算`
5. `settled`
   - 显示 `上传集锦`
6. `archived`
   - 不显示操作按钮

---

## 九、第一阶段测试最小清单

1. 大厅列表正常展示
2. 可发起组局
3. 可加入组局
4. 门店可确认成员
5. 门店可开始场次
6. 门店可结束场次
7. 结束后系统自动结算
8. 玩家档案、徽章、成长值、排行榜联动更新
9. 店员可上传集锦
10. 玩家可在有效期内查看集锦

---

## 十、开工顺序建议

1. `pages/lobby/`
2. `pages/lobby-create/`
3. `pages/team-room/`
4. `pages/staff-auth-code/`
5. `pages/staff-dashboard/`
6. `pages/staff-session/`
7. 自动结算云函数
8. `pages/leaderboard/`
9. `pages/staff-highlights/`

---

## 十一、配套规范文件

开工前默认同时阅读：

1. `FINAL_DEVELOPMENT_SPEC.md`
2. `PROJECT_CONTEXT.md`
3. `docs/UI_STYLE_GUIDE.md`
4. `docs/UI_FLOW_GUIDE.md`
