# 数据库模式与索引

本文件定义当前 CloudBase 集合结构、写入来源和推荐索引。

说明：

- `prod` 使用原集合名
- 当前所有运行版本统一使用原集合名，不再读写 `*_test` 集合同构副本
- 若字段结构变化，必须同步改本文件和相关云函数契约

## 1. `themes`

用途：

- 首页、主题列表、主题详情

核心字段：

- `_id`
- `name`
- `slogan`
- `difficulty`
- `horror`
- `horrorStars`
- `people`
- `duration`
- `tags`
- `coverImage`
- `story`
- `highlights`
- `reviewStats`
- `reviewHighlights`
- `coverGradient`
- `isHot`
- `status`
- `sort`

推荐索引：

- `status + sort`
- `isHot + sort`

备注：

- `coverImage` 当前使用小程序本地资源路径，约定格式为 `/assets/themes/*.jpeg`
- `reviewStats` 只保留评论摘要：`totalCount / avgScore / positiveRate / highlightCount / goodCount / neutralCount / badCount / repliedCount`
- `reviewHighlights` 只保留 3 到 5 条精选评价快照，不允许再把全量评论塞回 `themes`
- 全量评论已经迁移到独立集合 `theme_reviews`
- 如果后续迁移到云文件 URL 或 CDN 地址，必须同步更新种子数据、正式集合和前端默认兜底图逻辑

## 2. `activities`

用途：

- 首页活动入口、活动页

核心字段：

- `_id`
- `title`
- `time`
- `status`
- `summary`
- `highlight`
- `sort`

推荐索引：

- `sort`
- `status + sort`

## 3. `profiles`

用途：

- 玩家档案、成员资料卡、排行榜聚合、员工看板用户列表

核心字段：

- `_id`
- `nickname`
- `contactPhone`
- `avatarUrl`
- `signature`
- `gender`
- `level`
- `titleLabel`
- `honorLabels`
- `growthValue`
- `badgeCount`
- `streakDays`
- `totalPlayCount`
- `recentThemes`
- `redeemedCodes`
- `punchRecords`
- `perks`
- `lastPlayedAt`
- `createdAt`
- `updatedAt`

推荐索引：

- `_id` 默认主键索引
- `createdAt`
- `lastPlayedAt`
- `growthValue + totalPlayCount`

备注：

- 当前排行榜没有独立集合，直接从 `profiles` 聚合
- 当前没有把 `badges[]` 作为独立真相源字段持久化到 `profiles`
- `perks` 当前保存的是字符串列表，不是结构化对象数组
- `streakDays` 当前没有独立签到逻辑，而是在真实场次结算时按相邻结算日期计算连续活跃天数
- 徽章解锁结果由档案读取链路根据 `punchRecords`、`growthValue`、`recentThemes` 和场次统计实时计算
- 如果未来引入赛季榜，建议新增 `leaderboard_snapshots` 而不是继续在 `profiles` 上硬算所有赛季

## 4. `groups`

用途：

- 组局大厅、我的组局、队伍房间聚合入口

核心字段：

- `_id`
- `themeId`
- `themeName`
- `horror`
- `dateValue`
- `date`
- `timeSlot`
- `sortTime`
- `currentPeople`
- `targetPeople`
- `contactName`
- `contactPhone`
- `creatorName`
- `creatorOpenId`
- `note`
- `status`
- `participants`
- `roomStage`
- `roomMembers`
- `roomTimeline`
- `roomResult`
- `sessionId`
- `hiddenForOpenIds`
- `createdAt`
- `updatedAt`

推荐索引：

- `roomStage + updatedAt`
- `status + sortTime`
- `creatorOpenId + updatedAt`
- `creatorOpenId + status + updatedAt`
- `dateValue + timeSlot`

备注：

- 用户参与关系目前主要通过文档扫描 `participants` 计算；若数据量上来，需要补用户侧倒排集合或用户活动组局索引表
- `hiddenForOpenIds` 是个人视角删除标记，不是物理删除
- `staff_sessions.stageKey` 是场次状态唯一权威来源
- `roomStage` 只保留给玩家侧读取链路做兼容缓存；如果和 `staff_sessions.stageKey` 不一致，必须以 `stageKey` 为准

## 5. `staff_sessions`

用途：

- 工作台场次列表、场次详情、结算与集锦联动

核心字段：

- `_id`
- `groupId`
- `themeId`
- `themeName`
- `horror`
- `playDate`
- `timeSlot`
- `teamSize`
- `lateNight`
- `storeName`
- `stageKey`
- `stageLabel`
- `memberSummary`
- `metaText`
- `note`
- `members`
- `timeline`
- `actions`
- `settlementApplied`
- `result`
- `startedAt`
- `endedAt`
- `createdAt`
- `updatedAt`

推荐索引：

- `groupId` 唯一索引
- `stageKey + updatedAt`
- `stageKey + createdAt`
- `updatedAt`

## 6. `staff_highlights`

用途：

- 集锦列表、队伍房间集锦展示

核心字段：

- `_id`
- `sessionId`
- `groupId`
- `themeName`
- `sessionLabel`
- `status`
- `expireHint`
- `uploaderRole`
- `uploaderName`
- `media`
- `createdAt`
- `updatedAt`

推荐索引：

- `_id` 默认主键索引
- `groupId`
- `sessionId`
- `updatedAt`

## 7. `theme_reviews`

用途：

- 主题详情页全部评价、回复链路、点赞与分页读取

核心字段：

- `_id`
- `themeId`
- `themeName`
- `sessionId`
- `authorOpenId`
- `authorNicknameSnapshot`
- `authorAvatarSnapshot`
- `authorAvatarFileId`
- `authorRoleKey`
- `authorRoleLabel`
- `content`
- `rating`
- `tags`
- `likeCount`
- `replyCount`
- `type`
- `rootReviewId`
- `parentReviewId`
- `replyToNicknameSnapshot`
- `latestOrderKey`
- `hotOrderKey`
- `status`
- `isPinned`
- `createdAt`
- `updatedAt`

推荐索引：

- `themeId + type + status + latestOrderKey`
- `themeId + type + status + hotOrderKey`
- `rootReviewId + type + status + latestOrderKey`
- `authorOpenId + type + status + latestOrderKey`
- `authorOpenId + themeId + type + status`

备注：

- 顶层评价 `type=review`，回复 `type=reply`
- 当前读取链路只展示 `status=approved`
- 历史评论作者昵称和头像必须使用快照字段，不能直接实时引用当前资料
- 同一玩家对同一 `sessionId` 最多保留一条顶层评价

## 8. `theme_review_likes`

用途：

- 主题评价点赞去重

核心字段：

- `_id`
- `reviewId`
- `themeId`
- `openId`
- `createdAt`

推荐索引：

- `reviewId`
- `openId + reviewId`
- `themeId + reviewId`

## 9. `theme_review_stats`

用途：

- 主题评论摘要聚合缓存，写入后再同步回 `themes.reviewStats`

核心字段：

- `_id`
- `themeId`
- `totalCount`
- `totalScore`
- `avgScore`
- `positiveRate`
- `highlightCount`
- `goodCount`
- `neutralCount`
- `badCount`
- `repliedCount`
- `updatedAt`

推荐索引：

- `_id` 默认主键索引
- `themeId`
- `updatedAt`

## 10. 当前线上必须补齐的索引

以下索引是当前玩家链路和评价链路最优先需要补齐的，否则云函数容易退化到 fallback 查询：

### `groups`

- `roomStage + updatedAt`
- `status + sortTime`
- `creatorOpenId + updatedAt`

### `staff_sessions`

- `groupId` 唯一索引
- `stageKey + updatedAt`

### `theme_reviews`

- `themeId + type + status + latestOrderKey`
- `themeId + type + status + hotOrderKey`
- `rootReviewId + type + status + latestOrderKey`
- `authorOpenId + type + status + latestOrderKey`
- `authorOpenId + themeId + type + status`

### `theme_review_likes`

- `reviewId`
- `openId + reviewId`

## 11. `staff_bindings`

用途：

- 员工身份绑定、权限判断

核心字段：

- `_id`
- `role`
- `roleLabel`
- `storeName`
- `authCode`
- `permissions`
- `boundAt`

推荐索引：

- `_id` 默认主键索引
- `role + boundAt`

## 12. `staff_auth_codes`

用途：

- 工作台授权码生成、发放、回收

核心字段：

- `_id`
- `role`
- `roleLabel`
- `storeName`
- `status`
- `createdAt`
- `createdBy`
- `usedBy`
- `usedAt`

推荐索引：

- `_id` 默认主键索引
- `status + createdAt`
- `createdBy + createdAt`

## 13. 维护类集合

### `initData` / `runtimeReset` / `clearData`

说明：

- 它们是维护入口，不是正式业务集合
- 正式运营链路禁止依赖这些入口生成真实业务数据

## 14. 多门店预留

当前版本是单店口径，没有强制 `storeId`。

如果要升级多门店，以下集合必须补 `storeId` 并重建索引：

- `groups`
- `staff_sessions`
- `staff_highlights`
- `staff_bindings`
- `staff_auth_codes`

推荐复合索引：

- `storeId + stageKey + updatedAt`
- `storeId + status + sortTime`
- `storeId + role + boundAt`
