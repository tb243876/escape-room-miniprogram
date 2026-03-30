# 密室小程序（迷场档案馆）

基于微信原生小程序 + CloudBase 构建的密室门店小程序。

## 功能概览

### 玩家端

- 首页：浏览主题、活动入口
- 主题列表/详情：查看主题信息、恐怖星级
- 活动页：查看门店活动
- 组局大厅：发起/加入组局
- 队伍房间：查看组局成员、互相查看玩家卡片
- 排行榜：查看玩家排名、荣誉、徽章
- 档案：查看个人通关记录、徽章、成长值
- 资料编辑：头像、昵称、签名、性别

### 员工端（工作台）

- 授权绑定：本机授权码绑定
- 场次管理：确认成员、开始场次、结束场次、上传集锦
- 集锦管理：查看/上传照片视频

## 技术架构

```
pages/                 # 页面目录
  home/                # 首页
  themes/              # 主题列表
  theme-detail/        # 主题详情
  activities/          # 活动页
  lobby/               # 组局大厅
  lobby-create/        # 发起组局
  team-room/           # 队伍房间
  leaderboard/         # 排行榜
  profile/             # 我的/档案
  profile-edit/        # 资料编辑
  badges/              # 徽章页
  staff-auth-code/     # 工作台授权
  staff-dashboard/     # 工作台首页
  staff-session/       # 场次管理
  staff-sessions/      # 场次列表
  staff-highlights/    # 集锦管理
  staff-store/         # 门店管理
  staff-users/         # 用户管理

utils/                 # 公共工具
  cloudbase.js         # 统一服务入口
  platform/            # 平台相关（运行时、存储、性能）
  domain/              # 业务领域（主题、档案、组局、店员、排行榜）
```

### 云函数

- `getProfile`: 获取/创建用户档案
- `updateProfile`: 更新用户资料
- `groupManage`: 组局管理（创建/加入/退出/取消）
- `staffManage`: 门店管理（授权/场次/集锦）
- `getLeaderboard`: 排行榜数据聚合

## 运行配置

在 `app.js` 中配置：

- `envId`: CloudBase 环境 ID
- `useMockData`: 是否使用 Mock 数据
- `useMockGroups`: 组局是否使用 Mock
- `enablePerfTracing`: 是否开启性能追踪日志

## 测试脚本

```bash
npm run lint                # 代码静态检查
npm run test:phase1         # 结构/规则/流程校验
npm run test:business       # 业务规则校验
npm run test:flows          # 主流程校验
npm run test:api            # 接口契约校验
npm run test:perf           # 性能校验
npm run test:ui             # UI 冒烟校验
npm run test:ui:player      # 玩家端 UI 校验
npm run test:ui:staff       # 员工端 UI 校验
npm run test:ui:session     # 场次 UI 校验
npm run test:regression     # 完整回归测试
```

## 开发约束

1. 安全性 > 性能 > 用户体验
2. 所有写操作需考虑幂等和重复提交
3. 用户可见错误返回可读提示，不暴露底层异常
4. 涉及用户身份、积分、勋章、库存的逻辑放云端

## 相关文档

- `PROJECT_CONTEXT.md`: 项目长期上下文
- `CURRENT_STATUS.md`: 当前状态
- `ARCHITECTURE.md`: 架构说明
- `FINAL_DEVELOPMENT_SPEC.md`: 开发规范
- `docs/PHASE1_DEVELOPMENT_GUIDE.md`: 开发指南
- `docs/UI_STYLE_GUIDE.md`: UI 风格规范
- `docs/UI_FLOW_GUIDE.md`: UI 流程规范
