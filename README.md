# 密室店小程序原型

这是一个基于微信原生小程序 + CloudBase 结构搭建的简易原型。

建议你在微信开发者工具导入这个目录：

- `/Users/edy/Documents/密室小程序/miniapp`

当前目标不是把所有业务做完，而是先把这几个点做成可看的第一版：

- 首页
- 主题列表
- 主题详情
- 活动页
- 组局页
- 会员/我的页

## 技术方向

当前代码按 CloudBase 方式组织：

- `app.js`
  - 预留了 `wx.cloud.init`
- `utils/cloudbase.js`
  - 统一数据入口
  - 已支持 mock / CloudBase 双模式
- `mock/data.js`
  - 演示数据
- `cloudbase-init.json`
  - 第一批建议导入 CloudBase 的初始化数据
- `cloudfunctions/README.md`
  - CloudBase 集合和接入说明

## 默认开发约束

后续继续开发时，默认按以下优先级处理：

1. 安全性
2. 性能
3. 用户体验

同时默认遵守以下约束：

- 所有云函数必须包含事务处理
- 所有写操作默认考虑幂等和重复提交
- 所有用户可见错误都要返回可读提示，不直接暴露底层异常
- 涉及用户身份、积分、勋章、库存、次数累计的逻辑，优先放到云端而不是只放前端

最终统一规则见：

- `FINAL_DEVELOPMENT_SPEC.md`

## 如何看

1. 用微信开发者工具打开这个目录
2. 直接预览页面
3. 当前 `appid` 使用的是 `touristappid`

## 如何切到真实 CloudBase

### 第一步

在 CloudBase 创建环境，拿到 `envId`

### 第二步

修改 `app.js`

```js
globalData: {
  envId: "你的-cloudbase-env-id",
  useMockData: false,
}
```

### 第三步

在 CloudBase 数据库创建集合：

- `themes`
- `activities`
- `groups`
- `profiles`

### 第四步

用 `cloudbase-init.json` 里的示例数据初始化集合

## 当前状态

- 页面原型已可看
- 数据层已支持切 CloudBase
- 还没做登录、组局表单提交、后台管理端

## 后面最值得继续补的

1. CloudBase 真数据接通
2. 用户登录
3. 通关档案真实用户绑定
4. 组局发布表单
5. B 端 Web 管理页
