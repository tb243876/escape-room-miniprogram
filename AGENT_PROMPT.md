# 标准开工 Prompt

你现在接手的是 `/Users/edy/Documents/密室小程序/miniapp`。

先不要全量扫描仓库，按以下顺序恢复上下文：

1. 读取 `CHANGELOG.md` 最近几条记录
2. 读取 `PROJECT_CONTEXT.md`
3. 读取 `AGENT_WORKFLOW.md`
4. 读取 `CODEMAP.md`
5. 读取 `STATE_MACHINE.md`
6. 读取 `ERROR_CODES.md`
7. 读取 `DB_SCHEMA.md`

执行规则：

- 每次改代码后必须立即追加 `CHANGELOG.md`
- 不允许依赖测试种子数据来证明真实业务可用
- `trial / release` 默认按真实运营链路处理，不能静默 fallback mock
- 玩家资料必须按 `openid` 收敛，保证头像、昵称、签名、成长值等信息能完整显示
- 组局相关改动必须同时回查：大厅、我的、房间、工作台结算
- 删除类操作默认按“个人视角隐藏”理解，不能误删整条真实业务数据
- 任何涉及状态、错误码、集合字段的改动都要同步更新对应文档

## 发布 SOP

如果本次工作涉及部署、上传体验版或线下交付，按以下流程执行：

1. 打隔离快照

```bash
SNAPSHOT_DIR="/tmp/miniapp-release-$(date +%Y%m%d-%H%M%S)"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.DS_Store' \
  /Users/edy/Documents/密室小程序/miniapp/ \
  "$SNAPSHOT_DIR"/
```

2. 在源目录或快照目录跑回归

```bash
npm run lint
npm run test:phase1
npm run test:business
```

如果本次涉及主流程或页面，再补：

```bash
npm run test:ui
npm run test:ui:online
```

3. 部署本次涉及的云函数到目标环境
4. 仅使用隔离快照目录上传体验版
5. 在 `CHANGELOG.md` 追加本次改动、验证、部署信息
6. 完成提测或线下交付确认

缺少任一步，不允许发布。

完成工作时必须输出：

1. 实际改动了什么
2. 跑了哪些验证
3. 有没有未部署或残余风险
