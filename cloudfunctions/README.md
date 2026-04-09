# 云函数接口契约

本文件定义当前 CloudBase 云函数的统一约束和各函数标准条目。

## 1. 统一返回结构

成功：

```json
{
  "ok": true,
  "message": "可选提示",
  "...": "业务数据"
}
```

失败：

```json
{
  "ok": false,
  "errorCode": "GROUP_FULL",
  "message": "这个组局已经满员了",
  "retryable": false
}
```

说明：

- 当前部分存量函数仍只有 `message`；后续凡是改动到的函数，都要补齐 `errorCode` 和 `retryable`
- 错误码取值见 `../ERROR_CODES.md`
- 状态流转见 `../STATE_MACHINE.md`
- 集合结构见 `../DB_SCHEMA.md`

## 2. 统一规则

1. 先做参数校验，再做身份和权限校验
2. 多文档写入必须事务化或保证幂等
3. 所有正式业务写操作都必须明确副作用集合
4. 不允许前端自行推导与云端冲突的状态机
5. 不允许用 mock 返回掩盖正式环境错误

## 3. 云函数清单

### 3.1 `getProfile`

用途：

- 获取当前玩家档案
- 批量获取成员档案
- 缺档时自动建档

调用方：

- `pages/profile`
- `pages/team-room`
- 工作台成员资料卡聚合

入参：

- 默认读取当前用户：

```json
{
  "__dataEnvTag": "prod"
}
```

- 批量读取：

```json
{
  "action": "listProfiles",
  "openIds": ["openid-a", "openid-b"],
  "identities": [
    {
      "openId": "openid-a",
      "nickname": "阿杰",
      "contactPhone": "13900000000"
    }
  ],
  "__dataEnvTag": "prod"
}
```

出参：

- 默认读取：

```json
{
  "ok": true,
  "profile": {}
}
```

- 批量读取：

```json
{
  "ok": true,
  "profiles": []
}
```

副作用：

- 可能写入 `profiles`

错误码：

- `REQUEST_PARAM_INVALID`
- `AUTH_OPENID_MISSING`
- `PROFILE_READ_FAILED`

### 3.2 `updateProfile`

用途：

- 更新头像、昵称、签名、性别

调用方：

- `packages/profile/edit`

入参：

```json
{
  "nickname": "资料测试员",
  "signature": "这是签名",
  "gender": "male|female|not_set",
  "avatarUrl": "cloud://... 或 https://...",
  "__dataEnvTag": "prod"
}
```

出参：

```json
{
  "ok": true,
  "profile": {}
}
```

副作用：

- 写 `profiles`

错误码：

- `AUTH_OPENID_MISSING`
- `PROFILE_SAVE_FAILED`

### 3.3 `groupManage`

用途：

- 组局大厅、发起组局、加入组局、退出/取消、个人删除、队伍房间

调用方：

- `pages/lobby`
- `pages/lobby-create`
- `pages/team-room`

逻辑接口：

| `action` | 入参要点 | 出参要点 | 副作用集合 |
| --- | --- | --- | --- |
| `listGroups` | `__dataEnvTag` | `groups[]/activeGroup/recentGroup` | 无 |
| `createGroup` | `payload.themeId/themeName/dateValue/timeSlot/contactName/contactPhone/targetPeople` | `group/groups/activeGroup` | `groups`、`profiles` |
| `joinGroup` | `groupId + payload.contactName/contactPhone`；当前通过事务执行读取、满员校验和成员写入，前端需处理并发失败后的刷新重试 | `group/groups/activeGroup` | `groups`、`profiles` |
| `cancelActiveGroup` | `groupId?` | `groups/activeGroup/recentGroup` | `groups` |
| `deleteGroupRecord` | `groupId` | `groups/activeGroup/recentGroup` | `groups.hiddenForOpenIds` |
| `getTeamRoom` | `groupId` | `room` | 无 |

补充说明：

- 只要存在 `staff_sessions` 文档，`staff_sessions.stageKey` 就是场次状态唯一权威来源
- `groups.roomStage` 只保留给玩家侧列表/房间读取做兼容缓存，不能单独作为状态真相源

错误码：

- `REQUEST_PARAM_INVALID`
- `AUTH_OPENID_MISSING`
- `GROUP_NOT_FOUND`
- `GROUP_CANCELLED`
- `GROUP_FULL`
- `GROUP_ALREADY_ACTIVE`
- `GROUP_PHONE_DUPLICATED`
- `GROUP_STATE_INVALID`
- `GROUP_DELETE_FORBIDDEN`
- `GROUP_ROOM_LOAD_FAILED`
- `UNKNOWN_ACTION`

### 3.4 `staffManage`

用途：

- 员工授权、工作台、场次管理、结算、集锦、门店管理

调用方：

- `packages/staff/auth-code`
- `packages/staff/dashboard`
- `packages/staff/sessions`
- `packages/staff/session`
- `packages/staff/highlights`
- `packages/staff/store`
- `packages/staff/users`

逻辑接口：

| `action` | 入参要点 | 出参要点 | 副作用集合 |
| --- | --- | --- | --- |
| `redeemAuthCode` | `code` | `binding` | `staff_bindings`、`staff_auth_codes` |
| `generateAuthCode` | `role` | `authCode/dashboard` | `staff_auth_codes` |
| `getDashboard` | 无 | `dashboard`；其中 `memberList` 当前按最近活跃时间倒序截取最多 30 条，暂未分页 | 可能补齐 `profiles` |
| `removeStaffBinding` | `targetOpenId` | `dashboard` | `staff_bindings`、`staff_auth_codes` |
| `transferManager` | `targetOpenId` | `dashboard` | `staff_bindings` |
| `getSession` | `sessionId` | `session` | 可能补齐 `staff_sessions` |
| `toggleSessionMember` | `sessionId/openId` | `session` | `staff_sessions`、`groups` |
| `runSessionAction` | `sessionId/actionKey(confirm|start|end)` | `session` | `staff_sessions`、`groups`、`profiles`、`staff_highlights` |
| `getHighlights` | 无 | `highlights[]` | 无 |
| `saveHighlights` | `highlightId/media[]` | `highlight` | `staff_highlights` |

关键说明：

- `startSession`、`endSession` 当前不是独立物理函数，而是 `runSessionAction`
- 正式结算发生在 `runSessionAction(actionKey='end')`
- 结算会写 `profiles`，排行榜由 `getLeaderboard` 从 `profiles` 聚合读取

错误码：

- `REQUEST_PARAM_INVALID`
- `AUTH_OPENID_MISSING`
- `STAFF_BINDING_REQUIRED`
- `STAFF_PERMISSION_DENIED`
- `AUTH_CODE_EMPTY`
- `AUTH_CODE_FORMAT_INVALID`
- `AUTH_CODE_INVALID`
- `AUTH_CODE_GENERATE_FAILED`
- `STAFF_TARGET_NOT_FOUND`
- `STAFF_TARGET_INVALID`
- `SESSION_NOT_FOUND`
- `SESSION_PARAM_INVALID`
- `SESSION_MEMBER_NOT_FOUND`
- `SESSION_MEMBER_TOGGLE_FORBIDDEN`
- `SESSION_ACTION_INVALID`
- `SESSION_ACTION_FORBIDDEN`
- `SESSION_SETTLEMENT_FAILED`
- `HIGHLIGHT_NOT_FOUND`
- `HIGHLIGHT_LIMIT_EXCEEDED`
- `HIGHLIGHT_STAGE_INVALID`
- `UNKNOWN_ACTION`

### 3.5 `getLeaderboard`

用途：

- 从 `profiles` 聚合排行榜

调用方：

- `pages/leaderboard`

入参：

```json
{
  "__dataEnvTag": "prod",
  "pageSize": 20,
  "pageToken": "0"
}
```

出参：

```json
{
  "ok": true,
  "leaderboard": [],
  "summary": {
    "totalPlayers": 0,
    "totalGrowth": 0,
    "totalBadges": 0
  },
  "pageToken": "0",
  "pageSize": 20,
  "nextPageToken": "",
  "hasMore": false
}
```

副作用：

- 无直接写入

错误码：

- `LEADERBOARD_READ_FAILED`

### 3.6 维护函数

仅测试/维护用途，不得进入正式运营链路：

- `initData`
- `runtimeReset`
- `clearData`

这三者如果被前端正式页面依赖，视为严重发布问题。

补充约束：

- `initData`、`runtimeReset`、`clearData` 当前都不允许在 `prod` 执行
- `clearData` 已补 `MAINTENANCE_FORBIDDEN` 返回，用于阻止正式集合物理清除
- `initData`、`runtimeReset` 也已补统一失败结构：`errorCode + message + retryable`
