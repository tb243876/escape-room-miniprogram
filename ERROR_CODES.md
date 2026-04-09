# 错误码

本文件定义云函数统一错误码、默认前端文案和是否允许重试。

统一失败结构目标：

```json
{
  "ok": false,
  "errorCode": "GROUP_FULL",
  "message": "这个组局已经满员了",
  "retryable": false
}
```

说明：

- `message`：用户可直接看到的文案
- `errorCode`：机器可读标识
- `retryable`：前端是否应展示“重试”

## 1. 身份与档案

| 错误码 | 默认文案 | 可重试 | 说明 |
| --- | --- | --- | --- |
| `REQUEST_PARAM_INVALID` | 请求参数不完整或格式不正确，请检查后重试 | 否 | 通用参数错误 |
| `UNKNOWN_ACTION` | 未知操作类型 | 否 | 云函数 `action` 不受支持 |
| `AUTH_OPENID_MISSING` | 当前身份校验失败，请重新进入小程序后再试 | 否 | `wxContext.OPENID` 不存在 |
| `PROFILE_READ_FAILED` | 档案读取失败，请稍后重试 | 是 | 云端读取失败 |
| `PROFILE_SAVE_FAILED` | 个人资料保存失败，请稍后重试 | 是 | 更新资料失败 |
| `PROFILE_NOT_FOUND` | 没有找到对应档案 | 否 | 仅用于严格读，不适用于自动建档接口 |
| `PROFILE_SEED_CONFLICT` | 档案身份信息冲突，请联系门店处理 | 否 | 保留码，处理 `openid/手机号/昵称` 冲突 |

## 2. 组局与房间

| 错误码 | 默认文案 | 可重试 | 说明 |
| --- | --- | --- | --- |
| `GROUP_NOT_FOUND` | 组局不存在或已下架，请刷新后重试 | 否 | `groupId` 无效 |
| `GROUP_CANCELLED` | 这场组局已经取消了 | 否 | 取消后的组局再次操作 |
| `GROUP_FULL` | 这个组局已经满员了 | 否 | 人数已满或已进入不可报名态 |
| `GROUP_ALREADY_ACTIVE` | 你已经在参与其他组局，请先结束后再试 | 否 | 一个玩家同时间只允许一个活动组局 |
| `GROUP_PHONE_DUPLICATED` | 这个手机号已经报过这场组局了 | 否 | 同手机号重复报名 |
| `GROUP_STATE_INVALID` | 当前组局状态不允许此操作 | 否 | 非法状态流转 |
| `GROUP_DELETE_FORBIDDEN` | 进行中的队伍不能直接删除 | 否 | 仅结算/取消/归档后允许个人视角删除 |
| `GROUP_ROOM_LOAD_FAILED` | 队伍房间加载失败，请稍后重试 | 是 | 队伍房间聚合失败 |

## 3. 工作台与权限

| 错误码 | 默认文案 | 可重试 | 说明 |
| --- | --- | --- | --- |
| `STAFF_BINDING_REQUIRED` | 当前身份还没有门店工作台权限，请先完成授权绑定 | 否 | 未绑定员工身份 |
| `STAFF_PERMISSION_DENIED` | 当前身份没有该操作权限 | 否 | 无权限执行员工动作 |
| `AUTH_CODE_EMPTY` | 请输入授权码 | 否 | 输入为空 |
| `AUTH_CODE_FORMAT_INVALID` | 授权码格式不正确，请输入 6 位授权码 | 否 | 授权码长度不对 |
| `AUTH_CODE_INVALID` | 授权码无效或已失效，请联系店长重新获取 | 否 | 无效/已使用/已禁用 |
| `AUTH_CODE_GENERATE_FAILED` | 授权码生成失败，请重试 | 是 | 生成逻辑失败 |
| `STAFF_TARGET_NOT_FOUND` | 没有找到该员工 | 否 | 移除或转移目标不存在 |
| `STAFF_TARGET_INVALID` | 当前目标不允许执行该员工操作 | 否 | 例如移除店长、转移给错误角色 |

## 4. 场次、结算、集锦

| 错误码 | 默认文案 | 可重试 | 说明 |
| --- | --- | --- | --- |
| `SESSION_NOT_FOUND` | 没有找到这个场次，请返回工作台重试 | 否 | `sessionId` 无效 |
| `SESSION_PARAM_INVALID` | 操作参数缺失，请返回工作台重试 | 否 | 缺必要参数 |
| `SESSION_MEMBER_NOT_FOUND` | 没有找到要确认的成员，请刷新后重试 | 否 | `openId` 不在场次成员里 |
| `SESSION_MEMBER_TOGGLE_FORBIDDEN` | 当前阶段不能再调整成员到店状态 | 否 | 非 `pending_confirm` 阶段操作 |
| `SESSION_ACTION_INVALID` | 当前操作不存在或已失效，请刷新后重试 | 否 | action 不存在 |
| `SESSION_ACTION_FORBIDDEN` | 当前阶段不能执行这个操作 | 否 | 例如未确认完就开始 |
| `SESSION_SETTLEMENT_FAILED` | 场次结算失败，请稍后重试 | 是 | 结束场次后写档案失败 |
| `HIGHLIGHT_NOT_FOUND` | 没有找到对应的集锦包，请先完成场次结算 | 否 | 无 highlight 文档 |
| `HIGHLIGHT_LIMIT_EXCEEDED` | 单场最多保留 9 个集锦内容 | 否 | 超出上限 |
| `HIGHLIGHT_STAGE_INVALID` | 请在场次结算后再上传集锦 | 否 | 只有 `settled` 才能上传 |

## 5. 排行榜与内部错误

| 错误码 | 默认文案 | 可重试 | 说明 |
| --- | --- | --- | --- |
| `LEADERBOARD_READ_FAILED` | 排行榜加载失败，请稍后重试 | 是 | 聚合读取失败 |
| `INTERNAL_SERVICE_ERROR` | 服务处理失败，请稍后重试 | 是 | 未分类内部错误 |

## 6. 维护与高风险操作

| 错误码 | 默认文案 | 可重试 | 说明 |
| --- | --- | --- | --- |
| `MAINTENANCE_FORBIDDEN` | 正式运营环境禁止执行该维护操作 | 否 | 阻止在 `prod` 运行高风险维护函数 |

## 7. 前端处理规则

- `retryable = false`
  - 优先展示文案，不自动重试
  - 如有必要，仅提供“返回上一页”或“刷新列表”
- `retryable = true`
  - 允许展示“重试”
  - 不允许静默 fallback 到 mock 或本地假数据
