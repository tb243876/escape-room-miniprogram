# CloudBase 使用说明

当前小程序前端已经按 CloudBase 结构预留好接法。

## 0. 默认约束

后续所有 CloudBase 云函数，默认必须满足以下规则：

1. 优先级按 `安全性 -> 性能 -> 用户体验`
2. 所有云函数必须包含事务处理
3. 所有多文档更新必须放在事务内完成
4. 所有写操作必须考虑幂等，避免重复请求导致脏数据
5. 所有云函数必须先做参数校验，再做身份/权限校验
6. 所有异常返回必须区分：
   - 给前端看的用户提示
   - 给开发排查用的错误日志

建议默认结构：

- 参数校验
- 身份校验
- 开启事务
- 查询当前状态
- 执行业务更新
- 提交事务
- 返回统一结果

不建议把以下关键逻辑只写在前端：

- 会员等级累计
- 勋章解锁
- 库存扣减
- 多角色状态流转

额外统一规范见：

- `FINAL_DEVELOPMENT_SPEC.md`
- `ARCHITECTURE.md`
- `TEMPLATE.md`

## 1. 需要你自己配置的内容

在 `app.js` 里改这两个值：

- `envId`
- `useMockData`

建议：

- 开发初期：`useMockData: true`
- CloudBase 集合建好后：`useMockData: false`

## 2. 第一版建议的数据库集合

建议先创建这 4 个集合：

1. `themes`
2. `activities`
3. `groups`
4. `profiles`

并新增云函数：

1. `getProfile`

## 3. 集合结构建议

### themes

```json
{
  "_id": "theme-shixiong",
  "name": "尸兄",
  "slogan": "微恐入门本，用压迫氛围慢慢把你拖进故事里。",
  "difficulty": "进阶",
  "horror": "微恐",
  "people": "4-6人",
  "duration": "90分钟",
  "tags": ["微恐", "新手友好", "剧情沉浸"],
  "coverImage": "/assets/themes/shixiong.jpeg",
  "story": "一场看似普通的旧楼探访，因为一段失踪往事逐渐变得不再正常。",
  "highlights": ["适合新手", "氛围代入强"],
  "reviews": ["很适合带朋友入门"],
  "coverGradient": "linear-gradient(135deg, #5a463d, #9b7b63)",
  "isHot": true,
  "status": "online",
  "sort": 1
}
```

### activities

```json
{
  "_id": "activity-spring",
  "title": "春季双人组局周",
  "time": "4月1日 - 4月15日",
  "status": "进行中",
  "summary": "工作日夜场组局成功可获饮品券和主题徽章。",
  "highlight": "鼓励老客带新客进场",
  "sort": 1
}
```

### groups

```json
{
  "_id": "group-001",
  "themeName": "红宅来信",
  "date": "03月29日",
  "timeSlot": "19:30",
  "currentPeople": 4,
  "neededPeople": 2,
  "note": "希望是玩过演绎本的玩家，一起冲高完成度。",
  "status": "open",
  "sort": 1
}
```

### profiles

```json
{
  "_id": "demo-user",
  "nickname": "档案室常客",
  "level": "进阶会员",
  "totalPlayCount": 6,
  "badgeCount": 4,
  "nextLevelHint": "再完成 2 个主题即可解锁老玩家会员",
  "recentThemes": ["旧档案室", "午夜电台", "长夜站台"],
  "perks": ["生日月专属福利", "新主题优先报名", "老客夜场券"]
}
```

## 4. 后续建议

- 下一步可以先把 `themes` 和 `activities` 接真数据
- 然后再做 `groups`
- 最后再做登录用户和 `profiles`
- 后续真实场次结算、角色状态流转和集锦上传应优先切云端
