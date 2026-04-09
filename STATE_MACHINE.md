# 状态机

本文件定义当前版本三条业务链路的唯一状态真相。

说明：

- 组局主状态来自 `groups.status`
- 房间状态来自 `groups.roomStage`
- 场次状态来自 `staff_sessions.stageKey`
- 当前代码里没有 `draft`；组局创建成功后直接进入 `recruiting`
- `archived` 目前是保留态，用于后续归档或清理策略

## 1. 组局链路

字段：`groups.status`

```text
recruiting
  -> pending_store_confirm  条件：报名后 currentPeople >= targetPeople
  -> cancelled              操作者：发起人；条件：未开始

pending_store_confirm
  -> recruiting             操作者：普通成员；条件：退出后人数重新不足
  -> confirmed              操作者：店员；条件：创建/同步真实场次并确认成员
  -> cancelled              操作者：发起人；条件：未开始

confirmed
  -> playing                操作者：店员；条件：场次开始
  -> cancelled              操作者：发起人；条件：roomStage 仍未进入 playing/settled

playing
  -> settled                操作者：店员；条件：结束场次并完成结算

settled
  -> archived               操作者：系统/运营；条件：超过保留期或进入归档任务

cancelled
  -> 终态

archived
  -> 终态
```

### 组局状态说明

| 状态 | 含义 | 允许操作者 | 典型触发 |
| --- | --- | --- | --- |
| `recruiting` | 大厅可继续补人 | 玩家 | 发起组局、有人退出后未满员 |
| `pending_store_confirm` | 已满员，等待门店接管 | 玩家/店员 | 最后一名玩家加入 |
| `confirmed` | 门店已接管，等待开场 | 店员 | 成员确认完成 |
| `playing` | 场次进行中 | 店员 | 工作台开始场次 |
| `settled` | 已结束且已结算 | 店员 | 工作台结束场次 |
| `cancelled` | 发起人取消或不可继续 | 发起人 | 开场前取消 |
| `archived` | 归档态 | 系统/运营 | 保留期后归档 |

## 2. 房间链路

字段：`groups.roomStage`

```text
none
  -> pending_confirm  条件：门店为该组局生成真实场次快照

pending_confirm
  -> ready            操作者：店员；条件：所有真实到店成员确认完成

ready
  -> playing          操作者：店员；条件：点击开始场次

playing
  -> settled          操作者：店员；条件：点击结束场次并完成结算

settled
  -> archived         操作者：系统/运营；条件：归档任务执行
```

### 房间状态说明

| 状态 | 玩家端展示 | 允许操作者 | 备注 |
| --- | --- | --- | --- |
| `pending_confirm` | 待门店确认 | 店员 | 玩家已报名，但成员还未现场确认 |
| `ready` | 待开场 | 店员 | 玩家端应视为已确认锁房 |
| `playing` | 游戏中 | 店员 | 玩家不可再退出/取消 |
| `settled` | 已结束并结算 | 店员 | 可查看结果与集锦 |
| `archived` | 已归档 | 系统/运营 | 仅做历史保留 |

## 3. 场次链路

字段：`staff_sessions.stageKey`

```text
pending_confirm
  -> ready     操作者：店员/副店长/店长；条件：所有成员状态已到店，再执行 confirm

ready
  -> playing   操作者：店员/副店长/店长；条件：执行 start

playing
  -> settled   操作者：店员/副店长/店长；条件：执行 end，触发自动结算与集锦包创建

settled
  -> 终态
```

### 场次动作约束

| 当前状态 | 可执行动作 | 禁止动作 |
| --- | --- | --- |
| `pending_confirm` | `toggleSessionMember`、`confirm` | `start`、`end`、上传集锦 |
| `ready` | `start` | 再次确认成员、`end` |
| `playing` | `end` | 确认成员、再次开始 |
| `settled` | `saveHighlights` | 确认成员、开始、结束 |

## 4. 关键同步规则

- `staff_sessions.stageKey` 是场次状态唯一权威来源
- `groups.roomStage` 只作为玩家侧读取缓存；缓存过期时必须以 `staff_sessions.stageKey` 覆盖修正
- `groups.status` 是组局对外展示态，允许由权威 `stageKey` 推导修正
- `runSessionAction(actionKey='end')` 是当前唯一允许触发正式结算的入口
- 排行榜当前没有独立写入状态机；它由 `profiles` 结算结果聚合读取
