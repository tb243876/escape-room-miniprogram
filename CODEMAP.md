# 代码地图

本文件用于减少每次进入项目时的全仓扫描成本。

使用方式：

1. 先读 `PROJECT_CONTEXT.md`
2. 再读 `CURRENT_STATUS.md`
3. 再读 `IMPACT_MAP.md`
4. 再读本文件，定位需求对应的代码入口
5. 只继续阅读目标页面目录和相关 service / domain 文件

---

## 一、项目总入口

- 小程序入口：`app.js`
- 页面注册与 tab 配置：`app.json`
- 工程配置：`project.config.json`
- 服务编排总入口：`utils/cloudbase.js`
- 长期上下文：`PROJECT_CONTEXT.md`
- 当前状态：`CURRENT_STATUS.md`
- 影响图与回归闭环：`IMPACT_MAP.md`
- 架构边界：`ARCHITECTURE.md`

---

## 二、页面功能到文件映射

### 1. 首页

- 页面目录：`pages/home/`
- 主要文件：
  - `pages/home/index.js`
  - `pages/home/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/theme.js`

### 2. 主题列表

- 页面目录：`pages/themes/`
- 主要文件：
  - `pages/themes/index.js`
  - `pages/themes/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/theme.js`

### 3. 主题详情

- 页面目录：`pages/theme-detail/`
- 主要文件：
  - `pages/theme-detail/index.js`
  - `pages/theme-detail/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/theme.js`

### 4. 活动页

- 页面目录：`pages/activities/`
- 主要文件：
  - `pages/activities/index.js`
  - `pages/activities/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/theme.js`

### 5. 组局大厅

- 页面目录：`pages/lobby/`
- 主要文件：
  - `pages/lobby/index.js`
  - `pages/lobby/view-model.js`
- 相关页面：
  - `pages/lobby-create/`
  - `pages/team-room/`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/group.js`
  - `utils/domain/team-room.js`

### 6. 发起组局

- 页面目录：`pages/lobby-create/`
- 主要文件：
  - `pages/lobby-create/index.js`
  - `pages/lobby-create/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/group.js`

### 7. 队伍房间

- 页面目录：`pages/team-room/`
- 主要文件：
  - `pages/team-room/index.js`
  - `pages/team-room/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/team-room.js`
  - `utils/domain/group.js`
  - `utils/domain/profile.js`

### 8. 排行榜

- 页面目录：`pages/leaderboard/`
- 主要文件：
  - `pages/leaderboard/index.js`
  - `pages/leaderboard/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/leaderboard.js`

### 9. 我的页

- 页面目录：`pages/profile/`
- 主要文件：
  - `pages/profile/index.js`
  - `pages/profile/view-model.js`
- 相关页面：
  - `pages/profile-edit/`
  - `pages/badges/`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/profile.js`
  - `utils/domain/staff.js`

### 10. 徽章页

- 页面目录：`pages/badges/`
- 主要文件：
  - `pages/badges/index.js`
  - `pages/badges/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/profile.js`

### 11. 工作台授权

- 页面目录：`pages/staff-auth-code/`
- 主要文件：
  - `pages/staff-auth-code/index.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/staff.js`

### 12. 工作台首页

- 页面目录：`pages/staff-dashboard/`
- 主要文件：
  - `pages/staff-dashboard/index.js`
  - `pages/staff-dashboard/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/staff.js`

### 13. 场次管理

- 页面目录：`pages/staff-session/`
- 主要文件：
  - `pages/staff-session/index.js`
  - `pages/staff-session/view-model.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/staff.js`
  - `utils/domain/profile.js`

### 14. 集锦页

- 页面目录：`pages/staff-highlights/`
- 主要文件：
  - `pages/staff-highlights/index.js`
- 主要依赖：
  - `utils/cloudbase.js`
  - `utils/domain/staff.js`

---

## 三、公共层代码地图

### 1. 服务编排层

- `utils/cloudbase.js`
  - 页面统一调用入口
  - 聚合 mock、本地缓存、CloudBase、领域规则

### 2. 平台层

- `utils/platform/runtime.js`
  - 运行模式
  - app 全局配置读取
  - CloudBase 调用
- `utils/platform/storage.js`
  - 本地缓存读写
  - 业务缓存清理
- `utils/platform/perf.js`
  - 性能追踪和调试日志

### 3. 领域层

- `utils/domain/theme.js`
  - 主题展示整理
  - 恐怖星级兜底
  - 活动展示整理
- `utils/domain/profile.js`
  - 档案归一化
  - 徽章、成长值、称号整理
- `utils/domain/group.js`
  - 组局列表归一化
  - 发起 / 加入 / 取消 / 删除相关规则
- `utils/domain/team-room.js`
  - 队伍房间展示结构
  - 房间时间轴和成员卡片数据整理
- `utils/domain/staff.js`
  - 工作台授权
  - 员工角色
  - 场次状态和操作映射
- `utils/domain/leaderboard.js`
  - 排行榜字段整理

---

## 四、云函数地图

- 云函数目录：`cloudfunctions/`
- 当前已落地：
  - `cloudfunctions/getProfile/`
  - `cloudfunctions/updateProfile/`
- 阅读顺序建议：
  - `cloudfunctions/README.md`
  - `cloudfunctions/ARCHITECTURE.md`
  - 具体云函数目录下的 `index.js`
  - 同目录领域模块

---

## 五、测试与回归入口

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

---

## 六、以后提需求时建议这样描述

示例一：

`先读 PROJECT_CONTEXT.md、CODEMAP.md。这次只看 pages/lobby、pages/team-room、utils/domain/group.js。问题是大厅已取消队伍还在公共列表显示。`

示例二：

`先读 CURRENT_STATUS.md、CODEMAP.md。这次只看 pages/profile、pages/profile-edit、utils/domain/profile.js。我想继续做资料编辑链路。`

---

## 七、维护要求

1. 新增页面后，要把页面目录和主要依赖补到本文件
2. 新增公共模块后，要把职责补到本文件
3. 如果某个功能主链路发生迁移，要更新本文件，不要继续沿用旧入口
