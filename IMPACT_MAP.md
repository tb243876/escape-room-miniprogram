# 影响图与回归闭环

本文件只服务两件事：

1. 改一个功能时，快速定位必须联查的文件
2. 改完后，按固定回归点闭环，不再靠人工临时补测

进入项目后的最小阅读顺序：

1. `PROJECT_CONTEXT.md`
2. `CURRENT_STATUS.md`
3. `CODEMAP.md`
4. 本文件
5. 只打开当前需求对应链路中的文件

---

## 一、组队链路

这是当前最高风险链路，后续任何组队相关改动都必须按本节回查。

### 单一真相源

- 云端真实成员：`groups.participants`
- 本地 `activeGroup / recentGroup`：只做缓存与兜底，不是真实成员源
- 房间成员展示：必须由 `participants` 推导，`roomMembers` 只能补充状态，不能反向覆盖成员身份

### 关联文件

- 页面入口：
  - `pages/lobby/index.js`
  - `pages/lobby/view-model.js`
  - `pages/lobby-create/index.js`
  - `pages/team-room/index.js`
  - `pages/team-room/view-model.js`
- 前端服务与领域：
  - `utils/cloudbase.js`
  - `utils/domain/group.js`
  - `utils/domain/team-room.js`
  - `utils/platform/storage.js`
- 云函数：
  - `cloudfunctions/groupManage/index.js`
  - `cloudfunctions/groupManage/group-domain.js`

### 改动一个点时必须联查的地方

- 改“创建组队”：
  - 查 `validateCreatePayload`
  - 查 `handleCreateGroup`
  - 查 `normalizeGroupDoc`
  - 查大厅卡片人数与成员预览是否仍一致
- 改“加入组队”：
  - 查 `validateJoinPayload`
  - 查 `handleJoinGroup`
  - 查 `buildMyParticipation`
  - 查 `syncGroupParticipationState`
  - 查房间成员是否同步出现自己
- 改“退出 / 取消组队”：
  - 查 `handleCancelActiveGroup`
  - 查本地 `activeGroup` 清理
  - 查“我的”页和大厅页是否一致
  - 查队伍房间是否还能打开或应提示失效
- 改“删除队伍记录”：
  - 查 `handleDeleteGroupRecord`
  - 查云端是否仍保留真实组局，只对当前用户隐藏
  - 查 `buildListResponse` / `buildMyParticipation` 是否已经过滤个人隐藏记录
  - 查已删除记录是否还能通过房间直链重新打开
- 改“大厅卡片成员展示”：
  - 查 `toGroupListItem`
  - 查 `normalizeGroupItem`
  - 查 `normalizeLobbyList`
  - 查 `buildPreviewRoomFromGroup` / `mergeRoomWithGroup`
- 改“房间成员展示”：
  - 查 `buildTeamRoom`
  - 查 `normalizeRoomItem`
  - 查 `ensureActiveMemberInRoom`
  - 查成员卡片头像是否仍能命中个人资料

### 组队链路固定回归项

每次改动组队链路后，至少回归下面 8 项：

1. 新建队伍后，大厅不应再给自己显示“可加入”
2. 新建队伍后，“我的”里必须有该队伍，房间里必须有自己
3. 加入别人队伍后，大厅卡片人数、我的队伍、房间成员三处一致
4. 已加入队伍时，不能继续加入其他队伍
5. 已加入同一队伍时，不能重复加入
6. 退出队伍后，“我的”里消失，大厅人数同步减少
7. 发起人取消后，公共大厅不展示，但“我的”可见且可删除
8. 历史脏数据下，云端不存在参与关系时，前端不能一直卡在“我已加入”
9. 删除已取消 / 已结算 / 已过期记录后，只对当前用户消失，其他参与人不受影响

组队链路自动化入口：

- `npm run test:groups`
- 覆盖：历史数据归一化、房间成员来源、创建/加入/退出闭环、脏本地状态恢复

### 组队链路禁止事项

- 不允许把 `activeGroup` 当成真实成员源去渲染最终房间成员
- 不允许只改页面层文案而不校对云端 `participants`
- 不允许新增一套平行成员字段继续漂移

---

## 二、个人资料链路

### 单一真相源

- 云端真实资料：`profiles`
- 本地资料：只做缓存与离线兜底

### 关联文件

- `pages/profile/index.js`
- `pages/profile/view-model.js`
- `pages/profile-edit/index.js`
- `utils/cloudbase.js`
- `utils/domain/profile.js`
- `cloudfunctions/getProfile/index.js`
- `cloudfunctions/updateProfile/index.js`

### 固定回归项

1. 编辑昵称 / 头像 / 签名后，返回个人页立即同步
2. 组队成员卡片中的本人头像能同步命中个人资料头像
3. 云端失败时，本地兜底提示不能冒充真实已同步

---

## 三、工作台链路

### 单一真相源

- 授权关系：`staff_bindings`
- 授权码：`staff_auth_codes`
- 场次与成员确认：`staff_sessions`
- 玩家端已确认成员展示，必须与门店确认结果一致

### 关联文件

- `pages/staff-dashboard/index.js`
- `pages/staff-users/index.js`
- `pages/staff-sessions/index.js`
- `pages/staff-session/index.js`
- `pages/staff-store/index.js`
- `pages/staff-auth-code/index.js`
- `utils/cloudbase.js`
- `utils/domain/staff.js`
- `cloudfunctions/staffManage/index.js`
- `cloudfunctions/staffManage/staff-domain.js`

### 固定回归项

1. 绑定授权码后，重新进入仍能直达工作台
2. 工作台入口不能反复闪屏重载
3. 店长能看到员工列表、授权码入口、转移店长入口
4. 成员确认、开始、结束、集锦四条链必须还能继续走通

---

## 四、以后改代码的执行规则

以后同类需求默认按这套流程处理：

1. 先从本文件确定业务链和关联文件
2. 只读对应链路文件，不做全仓扫描
3. 先找单一真相源，再找页面是否吃了旧缓存或旧快照
4. 改完后按本文件中的固定回归项自查
5. 重要链路变化后，同步更新本文件，而不是只改代码

---

## 五、对话时可直接复用的最省 token 提示

你后面可以直接这样说：

`先读 PROJECT_CONTEXT.md、CURRENT_STATUS.md、CODEMAP.md、IMPACT_MAP.md。不要全量扫描。只看组队链路相关文件，按 IMPACT_MAP 的固定回归项自查后再改。`
