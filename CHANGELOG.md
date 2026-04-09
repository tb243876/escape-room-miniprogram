# CHANGELOG

## 使用规则

- 每次开始改代码前，必须先阅读本文件最近几次记录，确认最近改过的模块、已知风险、未完成验证项。
- 每次完成代码修改后，必须追加一条新记录，不能覆盖旧记录。
- 每次改完一个功能后，必须回头审查这个功能涉及到的全部相关代码和链路，确认本次改动没有把原有大功能带坏，也没有因为新增小功能引入连带问题。
- 每条记录至少要写清楚：
  - 改动时间
  - 改动原因
  - 涉及模块
  - 修改文件
  - 影响范围
  - 风险
  - 测试结果
- 是否已部署

---

## 2026-04-06 21:25:19 +0800

### 改动原因

- 用户反馈上一轮评价相关文案回调后，部分措辞比原来更生硬，需要按页面完整复查并调回更自然的玩家视角表达。

### 涉及模块

- 个人主页
- 主题详情页
- 独立评价页
- 评价服务前端适配层
- `themeReviewManage` 云函数返回文案

### 修改文件

- `CHANGELOG.md`
- `pages/profile/index.js`
- `pages/profile/index.wxml`
- `pages/theme-detail/index.js`
- `pages/theme-detail/index.wxml`
- `pages/theme-reviews/index.js`
- `pages/theme-reviews/index.wxml`
- `utils/cloudbase.js`
- `cloudfunctions/themeReviewManage/index.js`

### 具体影响

- 把评价链路里偏硬、偏系统提示的文案收回到更自然的玩家语气，例如“打不开”“删掉后”“内容加载失败”等表达。
- 统一了个人页、主题详情页、独立评价页和云函数回传错误语义，减少同一功能前后口径不一致的情况。
- 顺手修正了 `pages/theme-reviews/index.js` 中一处缩进脏点，避免后续继续在错误上下文里补改。

### 风险

- 本次只改用户可见文案和前端展示语义，没有改评价功能数据结构与业务判断；如果后续还要继续收口，应以真实页面逐屏确认观感为准。

### 测试结果

- `node -c pages/profile/index.js` 通过。
- `node -c pages/theme-detail/index.js` 通过。
- `node -c pages/theme-reviews/index.js` 通过。
- `node -c utils/cloudbase.js` 通过。
- `node -c cloudfunctions/themeReviewManage/index.js` 通过。
- `npm run test:business` 通过。

### 部署情况

- 代码已修改
- 尚未上传前端

---

## 2026-04-06 19:47:21 +0800

### 改动原因

- 用户要求不要只按某一类词零散清扫，而是对当前这批页面做一轮完整的用户文案收口。

### 涉及模块

- 个人主页
- 主题详情页
- 独立评价页

### 修改文件

- `CHANGELOG.md`
- `pages/profile/index.wxml`
- `pages/profile/index.js`
- `pages/theme-detail/index.wxml`
- `pages/theme-detail/index.js`
- `pages/theme-reviews/index.wxml`

### 具体影响

- 个人页里“常用入口”“联系门店”“我的权益”“最近体验场次”等文案统一改成更像玩家能直接理解的表达。
- 删掉了残留的内部口吻，例如“资料速览”“可展示的信息”这类字眼。
- 主题详情页和独立评价页的错误态、空态文案也一起收口，避免同一批页面里语气不一致。

### 风险

- 本次只调整用户可见文案，不改功能逻辑。

### 测试结果

- `node -c pages/profile/index.js` 通过。
- `node -c pages/theme-detail/index.js` 通过。
- `node -c pages/theme-reviews/index.js` 通过。

### 部署情况

- 代码已修改
- 尚未上传前端

---

## 2026-04-06 18:59:19 +0800

### 改动原因

- 用户要求再过一遍评价功能，检查是否还有类似的细小问题。

### 涉及模块

- 主题详情页
- 个人主页

### 修改文件

- `CHANGELOG.md`
- `pages/theme-detail/index.js`
- `pages/profile/index.wxml`

### 具体影响

- 修复了从独立评价页返回主题详情后，评价摘要不自动刷新、仍显示旧统计的问题。
- 修复了“我的评价”删到最后一条后弹层主体变空白、没有任何空状态提示的问题。
- 修复了“待评价”空状态时头部副标题和列表空态重复显示相近文案的问题。

### 风险

- 本次只补前端状态刷新和空态展示，不改评价数据结构。

### 测试结果

- `node -c pages/theme-detail/index.js` 通过。
- `node -c pages/profile/index.js` 通过。
- `npm run test:business` 通过。

### 部署情况

- 代码已修改
- 尚未上传前端

---

## 2026-04-06 18:54:24 +0800

### 改动原因

- 用户要求补上“删除评价”功能，不能只支持发布 / 回复 / 点赞，自己的评价需要可回收，并且删除后数据要重新对齐。

### 涉及模块

- 主题评价页
- 个人主页
- 主题评价云函数
- 前端评价服务层

### 修改文件

- `CHANGELOG.md`
- `cloudfunctions/themeReviewManage/index.js`
- `utils/cloudbase.js`
- `pages/theme-reviews/index.js`
- `pages/theme-reviews/index.wxml`
- `pages/theme-reviews/index.wxss`
- `pages/profile/index.js`
- `pages/profile/index.wxml`
- `pages/profile/index.wxss`

### 具体影响

- 云函数新增 `deleteReview` 动作，只允许删除当前玩家自己发布的评价或回复。
- 删除主评价时，会一并下掉该评价下的回复，并清理对应点赞记录。
- 删除回复时，会同步回刷主评价回复数。
- 删除完成后会重算主题评价统计、精选评价摘要，并更新主题页展示。
- 个人页“我的评价”增加删除入口；删除后会同步刷新“我的评价”和相关评价展示。
- 评价页里自己的评价和回复也会显示删除按钮，使用程序内确认弹窗，不走微信默认白弹窗。

### 风险

- 当前删除走的是软删除，历史文档仍保留在库里，但前台不可见。
- 删除主评价时会同时移除该评价下所有回复；这是按“整条讨论链一起消失”的规则处理的。

### 测试结果

- `node -c pages/profile/index.js` 通过。
- `node -c pages/theme-reviews/index.js` 通过。
- `node -c utils/cloudbase.js` 通过。
- `node -c cloudfunctions/themeReviewManage/index.js` 通过。
- `npm run test:business` 通过。

### 部署情况

- 代码已修改
- 尚未上传前端
- 尚未上传云函数

---

## 2026-04-06 18:46:59 +0800

### 改动原因

- 用户要求把这次新增的评价功能相关文案重新扫一遍，去掉不该暴露给用户的实现说明、技术错误语义，并优化用户可见文案。

### 涉及模块

- 主题评价页
- 主题详情页
- 个人主页
- 主题评价云函数
- 前端评价服务层

### 修改文件

- `CHANGELOG.md`
- `pages/theme-reviews/index.wxml`
- `pages/theme-reviews/index.js`
- `pages/theme-detail/index.wxml`
- `pages/theme-detail/index.js`
- `pages/profile/index.wxml`
- `pages/profile/index.js`
- `cloudfunctions/themeReviewManage/index.js`
- `utils/cloudbase.js`

### 具体影响

- 评价页顶部文案从“主题评价”调整为更自然的“玩家反馈”，统计项文案统一改成“评价数 / 综合评分 / 推荐率”。
- 去掉了“详情页只保留摘要、完整评论去独立页”这类产品实现说明，改成玩家能直接理解的提示语。
- 清掉了“初始化失败、上传云函数、集合缺失、本地评价/本地点赞”等不适合给用户看到的技术表达，统一改成用户侧可理解的失败文案。
- 待评价 / 我的评价弹层副标题改成面向玩家的自然表达，不再暴露“同步展示到主题页”等实现细节。
- 回复相关按钮文案调整为“展开回复 / 回复TA / 展开更多回复”，整体语气更统一。

### 风险

- 本次只改文案语义和错误提示，不改评价功能逻辑。
- 云函数错误码未变；如果外部还有按 message 精确匹配的逻辑，需要同步确认。

### 测试结果

- `node -c pages/profile/index.js` 通过。
- `node -c pages/theme-reviews/index.js` 通过。
- `node -c utils/cloudbase.js` 通过。
- `node -c cloudfunctions/themeReviewManage/index.js` 通过。
- `npm run test:business` 通过。

### 部署情况

- 代码已修改
- 尚未上传前端
- 尚未上传云函数

---

## 2026-04-06 01:24:00 +0800

### 改动原因

- 用户明确纠正了“我的评价”入口位置：不是放在个人页“待评价”卡片右上角，而是放在点进“待评价”后的弹层右上角。

### 涉及模块

- 个人主页

### 修改文件

- `CHANGELOG.md`
- `pages/profile/index.wxml`
- `pages/profile/index.wxss`

### 具体影响

- 移除了挂在“待评价”功能卡片右上角的小入口。
- “我的评价”现在只出现在“待评价”弹层右上角，位置更符合用户要求。
- `待评价` 主入口保持始终可点；即使没有待评价记录，也能打开弹层并从右上角进入“我的评价”。

### 风险

- 本次只调整入口位置，不影响“我的评价”未读计数和列表逻辑。

### 测试结果

- 本次仅修改 WXML/WXSS，未涉及 JS 逻辑。

### 部署情况

- 代码已修改
- 尚未上传前端

---

## 2026-04-06 01:18:00 +0800

### 改动原因

- 用户要求“我的评价”入口上的角标不要显示总数，只显示还没点进去看过的未读评价数量。

### 涉及模块

- 个人主页

### 修改文件

- `CHANGELOG.md`
- `pages/profile/index.js`

### 具体影响

- “我的评价”角标改为本地未读计数，不再直接展示总评价数。
- 规则改为：
  - 新出现、且本地还没看过的评价会计入角标
  - 进入一次“我的评价”列表后，当前这批评价会被标记为已读
  - 后续只有新增评价才会重新出现角标

### 风险

- 已读状态是本地存储，不跨设备同步；这属于 UI 角标状态，不影响真实评价数据。

### 测试结果

- `node -c pages/profile/index.js` 通过。
- `npm run test:business` 通过。

### 部署情况

- 代码已修改
- 尚未上传前端

---

## 2026-04-06 01:10:00 +0800

### 改动原因

- 用户要求在个人页“待评价”旁增加“我的评价”入口，方便直接查看自己已经发过的主题评价。

### 涉及模块

- 个人主页
- 主题评论云函数
- 前端评论服务层

### 修改文件

- `CHANGELOG.md`
- `cloudfunctions/themeReviewManage/index.js`
- `utils/cloudbase.js`
- `pages/profile/index.js`
- `pages/profile/index.wxml`
- `pages/profile/index.wxss`

### 具体影响

- `themeReviewManage` 新增 `listMyReviews` 动作，返回当前玩家最近发布的主题评价列表。
- 个人页常用入口新增“我的评价”，显示最近评价数量。
- 点击“我的评价”后会弹出纯资料列表，展示：
  - 主题名
  - 评价时间
  - 评价正文摘要

### 风险

- 该功能依赖重新上传 `themeReviewManage` 云函数，否则前端入口会因为找不到 `listMyReviews` 动作而无法读取数据。

### 测试结果

- `node -c cloudfunctions/themeReviewManage/index.js` 通过。
- `node -c utils/cloudbase.js` 通过。
- `node -c pages/profile/index.js` 通过。
- `npm run test:business` 通过。

### 部署情况

- 代码已修改
- 尚未上传前端与云函数

---

## 2026-04-06 01:00:00 +0800

### 改动原因

- 用户要求把主题详情页里的“主题信息”卡继续压缩，认为当前这块的留白、信息格子和标签仍然偏大。

### 涉及模块

- 主题详情页

### 修改文件

- `CHANGELOG.md`
- `pages/theme-detail/index.wxss`

### 具体影响

- “主题信息”卡整体缩小一档：
  - 卡片内边距更小
  - 标题、副标签、主题编号字号更小
  - 信息格子更紧凑
  - 恐怖星级更小
  - 标签胶囊更小

### 风险

- 本次只改样式，不影响主题详情数据和交互逻辑。

### 测试结果

- 本次仅修改 WXSS，未涉及 JS 逻辑。

### 部署情况

- 样式已修改
- 尚未上传前端

---

## 2026-04-06 00:54:00 +0800

### 改动原因

- 用户指出主题详情页里“完整评论区”说明卡片是冗余的，因为下面已经有“查看全部评价”按钮，没必要再多占一块空间。

### 涉及模块

- 主题详情页

### 修改文件

- `CHANGELOG.md`
- `pages/theme-detail/index.wxml`
- `pages/theme-detail/index.wxss`

### 具体影响

- 删除了主题详情页评价区里“完整评论区”说明卡片。
- 现在该区域只保留精选评价摘要和“查看全部评价”按钮，纵向空间更紧凑。

### 风险

- 本次只删冗余说明 UI，不影响评价跳转和评论功能。

### 测试结果

- 本次仅修改 WXML/WXSS，未涉及 JS 逻辑。

### 部署情况

- 代码已修改
- 尚未上传前端

---

## 2026-04-06 00:50:00 +0800

### 改动原因

- 用户要求把主题详情页里的评价摘要卡继续缩小，避免详情页里“评价”这一段本身也占太大面积。

### 涉及模块

- 主题详情页

### 修改文件

- `CHANGELOG.md`
- `pages/theme-detail/index.wxss`

### 具体影响

- 主题详情页里的评价摘要区整体收紧：
  - “总评价数 / 平均分 / 好评率”三张统计卡再缩小
  - 精选评价卡更紧凑
  - 说明区更紧凑
  - “查看全部评价”按钮进一步缩小

### 风险

- 本次只改样式，不影响评论跳转和评价功能。

### 测试结果

- 本次仅修改 WXSS，未涉及 JS 逻辑。

### 部署情况

- 样式已修改
- 尚未上传前端

---

## 2026-04-06 00:45:00 +0800

### 改动原因

- 用户继续要求把独立评价页顶部“主题评价”卡再缩小，认为当前只放主题名和两个操作按钮，不需要占这么大面积。

### 涉及模块

- 独立评价页

### 修改文件

- `CHANGELOG.md`
- `pages/theme-reviews/index.wxss`

### 具体影响

- 顶部主题评价卡再次收紧：
  - 外边距、内边距缩小
  - 标题、副标题字号再降一档
  - 标签胶囊更小
  - “返回主题详情 / 写评价”按钮继续缩成更轻的紧凑按钮

### 风险

- 本次只调整顶部卡视觉尺寸，没有修改任何评论功能逻辑。

### 测试结果

- 本次仅修改 WXSS，未涉及 JS 逻辑。

### 部署情况

- 样式已修改
- 尚未上传前端

---

## 2026-04-06 00:39:00 +0800

### 改动原因

- 用户继续要求把独立评价页顶部主题卡、统计卡再缩小，并明确提出“回复不要平铺，默认折叠”。

### 涉及模块

- 独立评价页

### 修改文件

- `CHANGELOG.md`
- `pages/theme-reviews/index.js`
- `pages/theme-reviews/index.wxml`
- `pages/theme-reviews/index.wxss`

### 具体影响

- 独立评价页顶部主题卡进一步缩小，标题、副标题、标签和按钮区都更紧凑。
- “总评价数 / 平均分 / 好评率”三张统计卡再压一档，减少首屏高度占用。
- 每条评论下方的回复现在默认折叠，只显示“查看回复 / 收起回复”切换，不再一进页就把回复全部平铺展开。

### 风险

- 回复默认折叠后，用户需要多点一步才能看到回复正文；这是本次为了降低列表高度做的明确取舍。

### 测试结果

- `node -c pages/theme-reviews/index.js` 通过。

### 部署情况

- 代码已修改
- 尚未上传前端

---

## 2026-04-06 00:31:00 +0800

### 改动原因

- 用户继续反馈独立评价页里“每条评论还是吃很大面积”，需要把评论区进一步压成紧凑列表，而不是只是轻微缩小。

### 涉及模块

- 独立评价页

### 修改文件

- `CHANGELOG.md`
- `pages/theme-reviews/index.wxss`

### 具体影响

- 独立评价页评论列表再次整体压缩：
  - 评论卡片内边距、圆角、上下间距继续缩小
  - 头像缩到 46rpx
  - 作者名、时间、评分、正文、标签、按钮字号全部再压一档
  - 回复区块、回复文案、查看更多回复也同步压缩
- 整体视觉更接近“列表流”，不再是一条评论就占一大块竖向空间。

### 风险

- 本次只改样式密度，没有动评论逻辑；仍建议你在真机上看一眼可读性，确认不会因为过度压缩导致字体显得过小。

### 测试结果

- 本次仅修改 WXSS，未涉及 JS 逻辑。

### 部署情况

- 样式已修改
- 尚未上传前端

---

## 2026-04-06 00:24:00 +0800

### 改动原因

- 用户反馈主题详情页里的“查看全部评价”入口按钮过大，独立评价页里的单条评论卡片也过于松散，占屏面积太大。

### 涉及模块

- 主题详情页
- 独立评价页

### 修改文件

- `CHANGELOG.md`
- `pages/theme-detail/index.wxss`
- `pages/theme-reviews/index.wxss`

### 具体影响

- 主题详情页里的“查看全部评价”入口由整行大按钮改为右侧小号胶囊按钮。
- 独立评价页里的评论卡片整体压缩了一档：
  - 外边距和内边距更小
  - 头像尺寸更小
  - 作者名、时间、正文、标签、操作按钮字号同步收紧
  - 回复区块和“查看更多回复”也一并缩小

### 风险

- 本次只调整样式密度，没有改评论交互逻辑；但仍需在开发者工具里看一眼实际观感，确认小屏设备上不会因为压缩过度而显得拥挤。

### 测试结果

- 本次仅修改 WXSS，未涉及 JS 逻辑。

### 部署情况

- 样式已修改
- 尚未上传前端

---

## 2026-04-06 00:12:00 +0800

### 改动原因

- 用户明确指出主题详情页里的评论随着数量增长会把页面继续拉长，希望改成“主题详情只看摘要，全部评价进独立页面”的结构。

### 涉及模块

- 主题详情页
- 主题评价页
- 个人主页待评价入口
- 页面路由配置

### 修改文件

- `CHANGELOG.md`
- `app.json`
- `pages/theme-detail/index.js`
- `pages/theme-detail/index.wxml`
- `pages/theme-detail/index.wxss`
- `pages/theme-reviews/index.js`
- `pages/theme-reviews/index.json`
- `pages/theme-reviews/index.wxml`
- `pages/theme-reviews/index.wxss`
- `pages/profile/index.js`

### 具体影响

- 新增独立页面 `pages/theme-reviews/index`，完整评论、回复、点赞、筛选、写评价统一放到这里。
- 主题详情页现在只保留：
  - 评论摘要
  - 精选评价
  - “查看全部评价”入口
- 个人主页“待评价”入口不再跳到主题详情页内联弹框，而是直接进入独立评价页并自动打开评价框。
- 旧的 `theme-detail?id=xxx&autoReview=1` 链路会自动重定向到新的独立评价页，避免旧跳转失效。

### 风险

- 新增了一张业务页面，需同步上传前端代码，否则“查看全部评价”会因页面未发布而无法进入。
- 主题详情页里保留了一部分旧评论脚本函数但不再渲染对应 UI；这不会影响运行，但后续如继续重构可以再收一遍死代码。

### 测试结果

- `node -c pages/theme-reviews/index.js` 通过。
- `node -c pages/theme-detail/index.js` 通过。
- `node -c pages/profile/index.js` 通过。
- `npm run test:business` 通过。

### 部署情况

- 代码已修改
- 尚未上传前端

---

## 2026-04-05 22:26:00 +0800

### 改动原因

- 用户反馈主题评论里的场次时间显示为原始 ISO 字符串，发布时间展示不对。
- 用户继续提供真实错误现象后定位到：评论回复和点赞失败不是接口没调，而是云函数把超长 `reviewId/rootReviewId` 截断成 48 位，导致后续查文档直接 `REVIEW_NOT_FOUND`。

### 涉及模块

- 主题详情页
- `themeReviewManage` 云函数

### 修改文件

- `CHANGELOG.md`
- `pages/theme-detail/index.js`
- `pages/theme-detail/index.wxml`
- `cloudfunctions/themeReviewManage/index.js`

### 具体影响

- 主题详情页里的评论时间和待评价场次时间改为本地可读格式，不再直接展示 ISO 原始字符串。
- 评论回复、点赞、查看更多回复这三条链路统一改成使用完整评论文档 ID，不再因为 48 位截断导致查不到评价文档。
- 点赞去重文档 ID 也同步改为基于完整评论 ID 生成，避免不同长 ID 仅前缀相同时互相冲突。

### 风险

- 需要重新上传 `themeReviewManage` 云函数，否则云端仍然会保留旧的 48 位截断逻辑。
- 历史已经失败的点赞/回复请求不会自动补写，需要在新函数部署后重新操作一次。

### 测试结果

- `node -c cloudfunctions/themeReviewManage/index.js` 通过。
- `node -c pages/theme-detail/index.js` 通过。
- 尚未做开发者工具里的真实点击回归。

### 部署情况

- 代码已修改
- 尚未部署云函数

---

## 2026-04-05 22:08:00 +0800

### 改动原因

- 用户提供了真实云函数日志，确认主题评价失败的直接原因不是前端，也不是评价资格逻辑，而是云端缺少 `theme_reviews` 集合，首次写入时直接报 `database collection not exists`。
- 需要把评论集合缺失的情况改成可自恢复，并在失败时返回明确错误，避免继续落成笼统的“评价服务暂不可用”。

### 涉及模块

- `themeReviewManage` 云函数

### 修改文件

- `CHANGELOG.md`
- `cloudfunctions/themeReviewManage/index.js`

### 具体影响

- `themeReviewManage` 入口现在会先检查并自动补建以下评论相关集合：
  - `theme_reviews`
  - `theme_review_likes`
  - `theme_review_stats`
- 首次进入评论链路时，如果集合还不存在，云函数会优先调用 `db.createCollection()` 创建，而不是直接在第一次 `set()` 时炸掉。
- 对云端“集合已存在但返回文案不稳定”的情况补了一层只读探测，避免把已存在集合误判成失败。
- 如果集合仍然无法创建或读取，返回值会优先落到 `REVIEW_COLLECTION_MISSING`，方便直接定位到评论集合初始化问题。

### 风险

- 这次修复依赖 `themeReviewManage` 云函数部署目录内已安装 `wx-server-sdk`，否则仍会在云端启动时报缺依赖。
- 如果当前云环境本身禁止动态建集合，云函数会继续返回失败，但现在会明确暴露为评论集合初始化问题，不再误导成通用服务异常。

### 测试结果

- `node -c cloudfunctions/themeReviewManage/index.js` 通过。
- 未在微信开发者工具里做真实评论提交流程回归，仍需你重新上传该云函数后再点一次评论链路确认。

### 部署情况

- 代码已修改
- 尚未部署云函数

---

## 2026-04-04 16:28:00 +0800

### 改动原因

- 修正排行榜榜单切换区和 summary 小卡片“像空白”的样式问题。
- 个人资料页的称号展示需要改成“只展示玩家自己选中的项”，并补上徽章/场次的可点击明细弹窗。
- 用户看板顶部四张小卡片需要能点进对应数据，同时移除下方重复的大卡片和最近活跃用户区块。
- 门店工作台首页需要把“运营数据”并入主入口，改成四张更紧凑的功能卡。

### 涉及模块

- 排行榜页
- 个人资料页
- 个人资料编辑页
- 用户看板
- 门店工作台首页
- `staffManage` 云函数统计面板数据

### 修改文件

- `CHANGELOG.md`
- `pages/leaderboard/index.wxss`
- `pages/profile/index.js`
- `pages/profile/index.wxml`
- `pages/profile/index.wxss`
- `pages/profile/view-model.js`
- `packages/profile/edit/index.js`
- `packages/profile/edit/index.wxml`
- `packages/staff/dashboard/index.js`
- `packages/staff/dashboard/index.wxml`
- `packages/staff/dashboard/index.wxss`
- `packages/staff/dashboard/view-model.js`
- `packages/staff/revenue/index.wxss`
- `packages/staff/sessions/index.wxml`
- `packages/staff/sessions/index.wxss`
- `packages/staff/store/index.js`
- `packages/staff/store/index.wxml`
- `packages/staff/store/index.wxss`
- `packages/staff/users/index.js`
- `packages/staff/users/index.wxml`
- `packages/staff/users/index.wxss`
- `utils/domain/profile.js`
- `cloudfunctions/staffManage/index.js`
- `cloudfunctions/getLeaderboard/profile-domain.js`
- `cloudfunctions/getProfile/profile-domain.js`
- `cloudfunctions/staffManage/profile-domain.js`

### 具体影响

- `leaderboard` 新增榜单切换 pill 样式，并把三个 summary 小卡片改回可见的暖棕卡面和深色文字。
- `profile` 不再对没有 `displayLabels` 的档案做默认展示回退；玩家不选称号时，头像旁边不再自动显示“新客玩家”等默认项。
- `profile` 将选中的展示项合并到头像旁同一行区域，统一使用同一套 badge 样式。
- `profile` 右侧“场次 / 徽章”改成可点击卡片：
  - 徽章：弹窗展示当前账号已获得的全部徽章，且每枚徽章都可继续点开查看解锁文案
  - 场次：弹窗展示最近 5 场体验记录
- 徽章规则扩充了一批中后段成就，补充了 30 场 / 80 场、主题探索、组局发起、固定队、夜场、节日、回流、挑战、分享等长尾徽章，降低“几场就快集齐”的问题。
- 同步对齐 `getProfile / getLeaderboard / staffManage` 三处徽章规则副本，避免不同页面看到的徽章数和称号不一致。
- 徽章总览弹层增加底部安全区留白，减少底部内容被遮挡的问题。
- `staff dashboard` 首页改成四张紧凑入口卡：用户看板、场次管理、门店管理、运营数据。
- `sessions / store / revenue` 三个工作台子页面的 hero 和卡片体积同步压缩，保留暖棕主色但拆出各自的细微层次差异。
- `store` 页面底部残留的“运营数据”按钮已删除，避免和工作台首页入口重复。
- `staff users` 删除下方四张大 insight 卡和“最近活跃用户”列表，顶部四张统计卡改为直接打开对应数据面板。
- `staffManage.getDashboard` 新增 `memberPanels` 数据：
  - 累计用户
  - 近 30 天活跃用户
  - 近 30 天已结算场次
  - 本周新增用户
- 用户看板明细面板中，如果展示的是玩家列表，点击玩家即可继续打开资料卡。
- 修正 `近30天完成场次` 面板把 `session.result` 对象直接拼成字符串的问题；现在统一转成可读文本，不再出现对象乱码。
- 用户看板明细里的玩家卡片和场次卡片进一步缩小，减少一屏只放下很少内容的问题。

### 测试结果

- 已通过 `node -c` 静态语法检查：
  - `pages/profile/index.js`
  - `pages/profile/view-model.js`
  - `packages/staff/store/index.js`
  - `packages/profile/edit/index.js`
  - `packages/staff/users/index.js`
  - `packages/staff/dashboard/index.js`
  - `packages/staff/dashboard/view-model.js`
  - `utils/domain/profile.js`
  - `cloudfunctions/getLeaderboard/profile-domain.js`
  - `cloudfunctions/getProfile/profile-domain.js`
  - `cloudfunctions/staffManage/index.js`
  - `cloudfunctions/staffManage/profile-domain.js`

### 部署情况

- 前端页面改动已落地到本地代码
- `staffManage` 云函数有返回结构调整，需要重新上传部署后用户看板明细才会生效
- 未上传体验版

---

## 2026-04-04 13:42:07 +0800

### 改动原因

- 排查确认工作台头像上一版没生效的根因：修在了前端层，但工作台真实头像出口在 `staffManage` 云函数。
- 将工作台头像处理改回与房间页、排行榜一致的链路，在云函数层统一把 `cloud://` 头像转换为可展示链接。

### 涉及模块

- 工作台玩家头像出口
- 工作台员工头像出口
- `staffManage` 资料卡头像归一化

### 修改文件

- `cloudfunctions/staffManage/index.js`
- `cloudfunctions/staffManage/profile-domain.js`
- `CHANGELOG.md`

### 影响范围

- 工作台用户看板 `memberList`
- 工作台门店管理 `staffMembers`
- 这两个列表对应的玩家资料卡 `profileCard`

以上出口现在都在云函数返回前完成头像链接转换，不再依赖前端页面切换或静默续签才显示。

### 风险

- 本次修复需要重新部署 `staffManage` 云函数才会生效；如果只重新编译前端，工作台头像问题不会变化。

### 测试结果

- 已执行语法检查：
  - `node -c cloudfunctions/staffManage/index.js`
  - `node -c cloudfunctions/staffManage/profile-domain.js`
- 未做真机验证；需要部署后进入工作台实际确认用户看板、门店管理资料卡头像是否正常。

### 部署情况

- 已修改本地代码
- 未部署云函数
- 未上传体验版

## 2026-04-04 13:22:35 +0800

### 改动原因

- 用户要求头像不要依赖整页前台刷新，避免页面切回时整页闪动。
- 统一补齐“玩家资料卡/头像展示页”的静默头像续签逻辑。

### 涉及模块

- 头像临时链接续签
- 玩家资料卡头像展示
- 工作台用户/员工头像展示
- 排行榜与队伍房间头像展示

### 修改文件

- `utils/platform/avatar.js`
- `utils/domain/profile.js`
- `utils/domain/leaderboard.js`
- `utils/cloudbase.js`
- `pages/leaderboard/index.js`
- `packages/staff/users/index.js`
- `packages/staff/store/index.js`
- `packages/staff/session/index.js`
- `pages/team-room/index.js`
- `CHANGELOG.md`

### 影响范围

- 新增公共头像工具：保留 `avatarFileId`，可在前端静默把云文件头像续签为新的临时链接。
- 排行榜、员工管理、用户看板、场次详情、队伍房间的资料卡打开前会先静默续签头像，不再依赖整页刷新。
- 排行榜、员工管理、用户看板、场次详情在页面 `onShow` 时，如果已有数据，会只静默 patch 头像相关字段，不整页重载。
- 服务层返回的工作台看板、场次详情、排行榜、房间数据，也会先做一轮头像链接归一化，减少 `cloud://` 直出失败。

### 风险

- 本次主要优化头像续签链路，没有改业务字段；但部分页面 `onShow` 从“强制重载”改成“已有数据时仅静默续签头像”，业务数据刷新更多依赖显式操作、自动轮询或重新进入页面。

### 测试结果

- 已执行语法检查：
  - `node -c utils/platform/avatar.js`
  - `node -c utils/domain/profile.js`
  - `node -c utils/domain/leaderboard.js`
  - `node -c utils/cloudbase.js`
  - `node -c pages/leaderboard/index.js`
  - `node -c packages/staff/users/index.js`
  - `node -c packages/staff/store/index.js`
  - `node -c packages/staff/session/index.js`
  - `node -c pages/team-room/index.js`
- 未做真机长时间挂页验证；需要在开发者工具或真机上停留一段时间后再次打开玩家资料卡，确认头像能静默恢复且页面不闪。

### 部署情况

- 已修改本地代码
- 未部署云函数
- 未上传体验版

## 2026-04-04 13:10:36 +0800

### 改动原因

- 用户要求生成店员码后不要再使用微信系统白弹窗，统一改为项目内自定义弹窗样式。

### 涉及模块

- 门店管理授权码弹窗

### 修改文件

- `packages/staff/store/index.js`
- `packages/staff/store/index.wxml`
- `packages/staff/store/index.wxss`
- `CHANGELOG.md`

### 影响范围

- 生成店员码后将展示项目内自定义弹窗，不再弹出微信原生白色 `showModal`。
- 自定义弹窗保留“复制授权码”和“关闭”两个操作，视觉风格与当前工作台页面保持一致。

### 风险

- 本次只改前端弹窗展示，不改授权码生成接口；若后续工作台继续新增弹窗，建议统一沉淀到共享弹窗组件，避免页面内状态继续增多。

### 测试结果

- 已执行语法检查：
  - `node -c packages/staff/store/index.js`
- 未做真机交互回归；需要在工作台门店管理页实际点一次“生成授权码”，确认弹窗样式、复制按钮和关闭逻辑正常。

### 部署情况

- 已修改本地代码
- 未上传体验版

## 2026-04-04 12:56:18 +0800

### 改动原因

- 修复已结束队伍仍残留“已有其他队伍”拦截的问题。
- 修复其他玩家头像在房间和排行榜里经常拿到 `cloud://` 但无法直接展示的问题。
- 修复资料编辑保存时可能把头像临时链接误写回数据库的问题。
- 增加大厅和房间页的手动下拉刷新，避免用户只能等自动轮询。

### 涉及模块

- 组局参与状态同步
- 队伍房间成员资料卡
- 排行榜头像展示
- 资料编辑头像持久化
- 页面刷新交互

### 修改文件

- `utils/domain/group.js`
- `utils/cloudbase.js`
- `cloudfunctions/groupManage/group-domain.js`
- `cloudfunctions/groupManage/index.js`
- `cloudfunctions/getProfile/index.js`
- `cloudfunctions/getLeaderboard/index.js`
- `utils/domain/team-room.js`
- `pages/lobby/index.js`
- `pages/lobby/index.json`
- `pages/team-room/index.js`
- `pages/team-room/index.json`
- `CHANGELOG.md`

### 影响范围

- 云端返回的组局列表会先按前端统一规则归一化，再决定是否保留本地 `activeGroup` 缓存；已结算、已取消、或已过期可清理的队伍不再继续阻塞加入新队伍。
- 队伍房间成员资料卡现在优先使用云端档案里的头像信息；若头像存的是 `cloud://` 文件 ID，会先转换成临时可访问链接再下发。
- 排行榜玩家头像也统一做了 `cloud:// -> temp URL` 转换，减少“有头像但看不到”的情况。
- 资料编辑保存时，如果当前展示的是头像临时链接，会自动还原为原始云文件 ID 再提交，避免数据库里落入会过期的 URL。
- 大厅页和队伍房间页支持下拉刷新，现有 10 秒自动刷新保留不变。

### 风险

- `cloud://` 临时链接有有效期，过期后需要重新进入页面或下拉刷新获取新链接，这是云存储临时地址的正常行为。
- 本次没有改动组局核心创建/加入流程，但涉及 `groupManage`、`getProfile`、`getLeaderboard` 三个云函数，发布时需要确保这三个函数已重新上传部署。

### 测试结果

- 已执行语法检查：
  - `node -c utils/domain/group.js`
  - `node -c utils/cloudbase.js`
  - `node -c utils/domain/team-room.js`
  - `node -c pages/lobby/index.js`
  - `node -c pages/team-room/index.js`
  - `node -c cloudfunctions/getProfile/index.js`
  - `node -c cloudfunctions/getLeaderboard/index.js`
  - `node -c cloudfunctions/groupManage/group-domain.js`
  - `node -c cloudfunctions/groupManage/index.js`
- 未执行真机流程回归；需要在微信开发者工具里实际验证“结束队伍后再加入新队伍”和“查看其他玩家头像”两条路径。

### 部署情况

- 已修改本地代码
- 未部署云函数
- 未上传体验版

## 2026-04-04 02:40:00 +0800

### 改动原因

- 用户要求首页头部卡片更小，并移除卡片内三个按钮及背景竖线纹理。

### 涉及模块

- 首页头图卡布局
- 首页无用跳转方法清理

### 修改文件

- `pages/home/index.wxml`
- `pages/home/index.js`
- `pages/home/index.wxss`
- `CHANGELOG.md`

### 影响范围

- 首页头图卡缩小了内边距、标题字号和整体视觉高度。
- 删除了头图卡内的三个操作按钮。
- 删除了卡片背景中的竖线状纹理样式。
- 清理了首页中不再使用的 `goLobby / goActivities / goProfile` 方法。

### 风险

- 无业务风险，仅首页展示和无用代码清理。

### 测试结果

- 静态确认首页头图卡已不再渲染三个按钮，相关样式与方法已同步移除。

### 部署情况

- 未部署

---

## 2026-04-04 02:34:00 +0800

### 改动原因

- 用户要求不要把“当前称号”和“个人页展示”拆成两张卡，避免编辑页信息重复。

### 涉及模块

- 资料编辑页布局

### 修改文件

- `packages/profile/edit/index.wxml`
- `packages/profile/edit/index.wxss`
- `CHANGELOG.md`

### 影响范围

- 已将“个人页展示”选择区合并进“当前称号”卡片。
- 编辑页现在只保留一个称号相关区块：上面看当前称号/荣誉，下面直接选个人页展示项。

### 风险

- 无业务风险，仅布局收敛。

### 测试结果

- 静态确认编辑页称号相关区块已合并为单卡展示。

### 部署情况

- 未部署

---

## 2026-04-04 02:29:00 +0800

### 改动原因

- 用户反馈取消选择 `新客玩家` 后个人页仍然展示，暴露出 `displayLabels` 空数组被错误回退为默认展示的问题。

### 涉及模块

- 档案展示回退逻辑
- 资料编辑页回显逻辑

### 修改文件

- `utils/domain/profile.js`
- `packages/profile/edit/index.js`
- `CHANGELOG.md`

### 影响范围

- 现在会正确区分：
  - 未配置 `displayLabels`：回退到默认可展示项
  - 已配置但为空数组：严格按“一个都不展示”处理
- 玩家取消勾选 `新客玩家` 后，个人页不会再自动把它补回来。

### 风险

- 无业务风险，属于展示选择状态修正。

### 测试结果

- 静态确认 `displayLabels: []` 不再触发默认回退逻辑。
- 当前未跑自动化。

### 部署情况

- 未部署

---

## 2026-04-04 02:23:00 +0800

### 改动原因

- 用户要求删除默认荣誉“新档案建立”。

### 涉及模块

- 档案领域默认值
- 排行榜档案聚合
- 工作台档案聚合

### 修改文件

- `utils/domain/profile.js`
- `cloudfunctions/getLeaderboard/profile-domain.js`
- `cloudfunctions/staffManage/profile-domain.js`
- `CHANGELOG.md`

### 影响范围

- 新档案默认不再附带“新档案建立”荣誉。
- 若玩家当前没有任何可展示荣誉，则个人页和相关档案卡片将不再硬塞默认荣誉占位。
- 排行榜与工作台侧使用同一口径，不再回退出该默认荣誉。

### 风险

- 无业务风险，仅移除默认保底文案。

### 测试结果

- 静态确认前后端档案荣誉生成逻辑已不再包含“新档案建立”。

### 部署情况

- 未部署

---

## 2026-04-04 02:18:00 +0800

### 改动原因

- 用户要求“展示哪几个称号/荣誉”由玩家自己选择，而不是系统固定展示。

### 涉及模块

- 档案领域模型
- 资料编辑页
- 个人主页展示逻辑
- `updateProfile` 云函数字段同步

### 修改文件

- `utils/domain/profile.js`
- `cloudfunctions/updateProfile/index.js`
- `packages/profile/edit/index.js`
- `packages/profile/edit/index.wxml`
- `packages/profile/edit/index.wxss`
- `pages/profile/index.wxml`
- `CHANGELOG.md`

### 影响范围

- 新增 `displayLabels` 持久化字段，玩家可自行选择最多 3 个展示项。
- 编辑页新增“个人页展示”选择区，称号/荣誉由玩家手动勾选。
- 个人主页改为只展示玩家选中的内容：
  - 第 1 个作为主称号
  - 其余作为下方荣誉标签

### 风险

- 该功能依赖新字段 `displayLabels`；旧档案没有该字段时会自动回退为展示当前可用称号/荣誉，不会空白。

### 测试结果

- 当前未运行自动化；已静态打通前端选择、云端 patch、个人页回显链路。

### 部署情况

- 未部署

---

## 2026-04-04 02:10:00 +0800

### 改动原因

- 用户要求将个人页“当前称号”改成可选展示，不再固定显示。

### 涉及模块

- 个人主页主信息区

### 修改文件

- `pages/profile/index.wxml`
- `CHANGELOG.md`

### 影响范围

- 当前称号改为仅在 `profile.titleLabel` 有值时展示。
- 无称号时不再占用额外空间，其他主信息展示不变。

### 风险

- 无业务风险，仅调整展示条件。

### 测试结果

- 静态确认称号节点已加 `wx:if` 条件判断。

### 部署情况

- 未部署

---

## 2026-04-04 02:06:00 +0800

### 改动原因

- 用户指出个人页头像区“成长值”胶囊被误删，需要恢复；原意只删除重复展示，不删除主信息区。

### 涉及模块

- 个人主页主信息区

### 修改文件

- `pages/profile/index.wxml`
- `CHANGELOG.md`

### 影响范围

- 已恢复头像区主信息行中的“成长值 {{profile.growthValue}}”胶囊。
- 下方重复的成长值展示、胶片条、最近体验主题等仍保持移除状态。

### 风险

- 无业务风险，仅恢复单个展示字段。

### 测试结果

- 静态确认 `pages/profile/index.wxml` 已重新渲染成长值胶囊。

### 部署情况

- 未部署

---

## 2026-04-04 01:41:00 +0800

### 改动原因

- 继续收尾排行榜头图标签在深底上的发虚问题，补最后一处对比度微调。

### 涉及模块

- 排行榜头图区视觉对比度

### 修改文件

- `pages/leaderboard/index.wxss`
- `CHANGELOG.md`

### 影响范围

- 将头图 tag 的背景从过淡的 `red-dim` 提亮为半透明暖米白，更贴合暖棕深底。

### 风险

- 仅视觉微调，无业务风险。

### 测试结果

- 样式静态检查完成。

### 部署情况

- 未部署

---

## 2026-04-04 01:36:00 +0800

### 改动原因

- 用户反馈样式仍有“不对的地方”，继续做全量样式巡检，重点修复浅底浅字和残留冷色状态块。

### 涉及模块

- 通用样式可读性修正
- 主题详情 / 排行榜字色修正
- 档案页标签与徽章详情可读性修正
- 工作台场次列表最终冷色清理

### 修改文件

- `app.wxss`
- `pages/theme-detail/index.wxss`
- `pages/leaderboard/index.wxss`
- `pages/profile/index.wxss`
- `packages/profile/edit/index.wxss`
- `packages/staff/sessions/index.wxss`
- `CHANGELOG.md`

### 影响范围

- 修正了浅色弹窗标题、玩家卡统计数字、浅底标签等低对比项。
- 修正了主题详情和排行榜头图的前景文字配色，使其与暖棕深底一致。
- 将 `packages/staff/sessions` 最后一处蓝色“进行中”状态标签回退为暖棕体系。

### 风险

- 本轮仍只调整样式，不影响业务逻辑和数据结构。

### 测试结果

- 已做全量样式检索，冷蓝工作台残留和深黑残留已清空。
- 当前未运行自动化。

### 部署情况

- 未部署

---

## 2026-04-04 01:18:00 +0800

### 改动原因

- 用户要求把上一轮没有改完的深色/暗红残留全部清掉，整体回到原先的暖棕视觉，不允许只改表层。

### 涉及模块

- 全局样式 token 收口
- 首页 / 大厅 / 队伍房间暖棕回退
- 主题页 / 档案页 / 创建页暖棕回退
- 工作台与个人分包页暖棕回退

### 修改文件

- `app.wxss`
- `pages/home/index.wxss`
- `pages/lobby/index.wxss`
- `pages/team-room/index.wxss`
- `pages/themes/index.wxss`
- `pages/profile/index.wxss`
- `pages/lobby-create/index.wxss`
- `packages/staff/session/index.wxss`
- `packages/staff/dashboard/index.wxss`
- `packages/staff/highlights/index.wxss`
- `packages/staff/store/index.wxss`
- `packages/staff/auth-code/index.wxss`
- `packages/staff/users/index.wxss`
- `packages/profile/badges/index.wxss`
- `packages/profile/edit/index.wxss`
- `CHANGELOG.md`

### 影响范围

- 清除了顶部 hero、底部弹层、活动/主题/组局卡片、统计卡、徽章卡、资料抽屉里残留的深灰底和暗红渐变。
- 将仍然使用深色文本/深色遮罩的局部块统一调整为暖米白、浅棕和棕金过渡，避免页面上下层次割裂。
- 全局 `player-card-joined`、关闭态色值等残留 token 一并收口，减少后续再混回冷色/暗红的入口。

### 风险

- 本轮只处理样式，不改业务逻辑；如果仍有别的页面在 WXML 中写死了颜色类名，视觉上可能还会有零散偏差，需要继续按页面补扫。

### 测试结果

- 已执行样式残留搜索：
  - 深黑/暗红残留搜索结果为空
  - 冷蓝工作台残留搜索结果为空
- 当前未运行自动化；本轮为样式层清理，不涉及业务逻辑。

### 部署情况

- 未部署

## 2026-04-03 22:46:00 +0800

### 改动原因

- 用户要求直接排查“首页没有数据展示”。实际核查发现不是前端渲染故障，而是正式集合 `themes` / `activities` 为空。

### 涉及模块

- 正式集合目录检查
- 正式集合基础目录补写
- 正式环境授权码补写
- 真实 UI 冒烟

### 修改文件

- `scripts/inspect-prod-catalog.cjs`
- `scripts/seed-prod-base-catalog.cjs`
- `CHANGELOG.md`

### 影响范围

- 通过 `inspect-prod-catalog.cjs` 核查到补写前正式集合状态：
  - `themes(status='online') = 0`
  - `activities = 0`
  - `staff_auth_codes` 中 `OWN826` 已存在且为 `active`
- 通过 `seed-prod-base-catalog.cjs` 已向正式集合补写：
  - `themes`: 6 条
  - `activities`: 2 条
- 已额外执行 `seed-store-manager-auth-codes.cjs`，确认 `OWN826` 可继续作为店长授权码使用。

### 风险

- 当前首页目录数据已经补齐，但如果后续有人手工清空 `themes` / `activities`，首页仍会再次暴露真实空态，不会再有本地假数据兜底。

### 测试结果

- `npm run lint` 通过
- `node scripts/ui-prod-runtime-smoke-check.cjs` 通过
  - 首页通过
  - 大厅通过
  - 档案通过
  - 排行榜通过
  - 队伍房间通过

### 部署情况

- 已直接对 `trial/prod` 正式集合补写首页目录数据

---

## 2026-04-03 22:20:00 +0800

### 改动原因

- 用户要求把正式云环境里残留的人机样本也一起物理清理，不能只停留在仓库层面删除入口。

### 涉及模块

- 线上数据清理脚本
- 发布记录

### 修改文件

- `scripts/inspect-prod-catalog.cjs`
- `scripts/cleanup-seed-runtime-data.cjs`
- `scripts/seed-prod-base-catalog.cjs`
- `CHANGELOG.md`

### 影响范围

- 新增只针对正式集合人机样本的清理脚本，匹配范围限定为：
  - `profiles._id` 以 `seed-user-` 开头
  - 对应 seed 组局 `group-001/002/003`
  - 对应 seed 场次 `session-group-001/002/003`
  - 以及关联的 `staff_highlights` / `staff_bindings`
- 实际执行结果：
  - `profiles`：扫描 1 条，命中 0 条，删除 0 条
  - `groups`：扫描 0 条，命中 0 条，删除 0 条
  - `staff_sessions`：扫描 0 条，命中 0 条，删除 0 条
  - `staff_highlights`：扫描 0 条，命中 0 条，删除 0 条
  - `staff_bindings`：扫描 0 条，命中 0 条，删除 0 条

### 风险

- 本轮脚本只按 seed 样本规则删除；如果后续又有人手工写入别的假数据命名，不会被这条规则自动命中。

### 测试结果

- 线上清理脚本执行成功

### 部署情况

- 已直接对 `trial/prod` 正式集合执行清理

---

## 2026-04-03 22:14:00 +0800

### 改动原因

- 把排行榜清理收尾，移除 `mock/data.js` 中最后残留的空榜单字段名，避免后续有人再次把本地榜单样本接回运行链路。

### 涉及模块

- 本地 mock 数据文件

### 修改文件

- `mock/data.js`
- `CHANGELOG.md`

### 影响范围

- 本地 mock 数据文件里不再保留 `playerProfiles`、`leaderboard` 结构名，排行榜假人入口彻底移除。

### 风险

- 无新增业务风险。

### 测试结果

- 待执行 `npm run lint`

### 部署情况

- 否

---

## 2026-04-03 22:10:00 +0800

### 改动原因

- 继续清理遗漏的排行榜本地假人兜底，避免排行榜和玩家资料卡再从本地榜单样本里拼出“假玩家”。

### 涉及模块

- 排行榜前端领域层
- 玩家资料卡前端领域层
- 服务编排层

### 修改文件

- `utils/domain/leaderboard.js`
- `utils/domain/profile.js`
- `utils/cloudbase.js`
- `CHANGELOG.md`

### 影响范围

- 排行榜前端不再保留本地 `mockData.leaderboard` 的月榜/总榜 fallback。
- 玩家资料卡不再尝试从本地 `playerProfiles` 或本地榜单样本反查队友资料。
- 当前排行榜只能展示云函数 `getLeaderboard` 返回的真实数据；如果云端没有真实玩家，页面会显示真实空态或错误，不会再渲染假人榜单。

### 风险

- 若云端正式集合当前没有真实档案数据，排行榜会直接呈现空数据；这属于真实状态，不再由本地样本兜底。

### 测试结果

- 待执行 `npm run lint`
- 待执行 `npm run test:business`

### 部署情况

- 否

---

## 2026-04-03 22:02:00 +0800

### 改动原因

- 用户要求清掉仓库里所有不再需要的本地 mock / 假玩家代码与样本数据，避免后续再通过“人机数据”跑通页面或把假玩家重新种回环境。

### 涉及模块

- 本地 mock 数据文件
- 初始化/重置种子
- 导入样本
- 离线回归脚本
- 回归脚本配置与文档

### 修改文件

- `mock/data.js`
- `cloudbase-init.json`
- `cloudbase-seeds-import/groups.json`
- `cloudbase-seeds-import/profiles.json`
- `cloudbase-seeds-import/staff_sessions.json`
- `cloudbase-seeds-import/staff_highlights.json`
- `cloudfunctions/initData/seed-data.js`
- `cloudfunctions/runtimeReset/seed-data.js`
- `scripts/business-rules-check.cjs`
- `scripts/cleanup-seed-runtime-data.cjs`
- `scripts/regression-check.cjs`
- `package.json`
- `README.md`
- `AGENT_WORKFLOW.md`
- `CODEMAP.md`
- `AGENT_PROMPT.md`
- `ERROR_CODES.md`
- `CHANGELOG.md`

### 删除文件

- `scripts/test-helpers/mock-miniapp-env.cjs`
- `scripts/group-regression-check.cjs`
- `scripts/main-flow-check.cjs`
- `scripts/interface-contract-check.cjs`
- `scripts/perf-smoke-check.cjs`

### 影响范围

- 本地 `mock/data.js` 现在不再携带任何假玩家、假组局、假场次、假集锦数据，即使有人误开 mock 分支，也拿不到人机样本。
- `initData` / `runtimeReset` 的种子只保留主题、活动、授权码与基础码表，不再内置假玩家档案、假队伍、假场次、假集锦。
- `cloudbase-seeds-import` 里的玩家/组局/场次/集锦导入文件已清空，避免手工导入时把 seed 用户重新写回集合。
- 删除了依赖本地 mock 数据的离线回归脚本，`test:regression` 默认只保留 `lint -> phase1 -> business`，不再把“离线人机跑通”当成有效验证。

### 风险

- 这轮只清理了仓库里的假数据源和生成入口，没有直接物理删除你当前云环境里已经存在的历史假玩家文档。
- 如果要把云数据库里已存在的 `seed-user-*` 假数据一起删除，还需要单独执行一次线上清理动作。

### 测试结果

- 待执行 `npm run lint`
- 待执行 `npm run test:phase1`
- 待执行 `npm run test:business`

### 部署情况

- 否

---

## 2026-04-03 21:34:00 +0800

### 改动原因

- 用户明确要求彻底停用 `test/_test` 与本地 mock 运行口径，避免开发版、体验版继续把脏数据写到测试集合或在云能力异常时偷偷回退本地数据。

### 涉及模块

- 运行时环境路由
- 云函数集合路由工具
- 资料页维护文案
- 脚本与顶层文档

### 修改文件

- `app.js`
- `utils/platform/env-config.js`
- `utils/platform/runtime.js`
- `utils/platform/data-env.js`
- `pages/profile/index.js`
- `cloudfunctions/getProfile/utils.js`
- `cloudfunctions/updateProfile/utils.js`
- `cloudfunctions/getLeaderboard/utils.js`
- `cloudfunctions/groupManage/utils.js`
- `cloudfunctions/staffManage/utils.js`
- `cloudfunctions/initData/utils.js`
- `cloudfunctions/runtimeReset/utils.js`
- `cloudfunctions/clearData/utils.js`
- `cloudfunctions/shared/utils.js`
- `scripts/business-rules-check.cjs`
- `scripts/seed-store-manager-auth-codes.cjs`
- `scripts/ui-online-flow-check.cjs`
- `README.md`
- `PROJECT_CONTEXT.md`
- `AGENT_WORKFLOW.md`
- `DB_SCHEMA.md`
- `cloudfunctions/README.md`
- `cloudfunctions/initData/seed-data.js`
- `cloudfunctions/runtimeReset/seed-data.js`
- `CHANGELOG.md`

### 影响范围

- `release / trial / develop` 现在统一映射到正式集合 `prod`，前端不再存在 `develop -> test` 的数据分流。
- `runtime.useMock()` 和 `app.js` 不再因为 `wx.cloud` 缺失或初始化失败自动切回 mock，本地/体验版出现云能力异常时会直接暴露真实错误，而不是继续读写本地假数据。
- 所有云函数目录内的 `normalizeDataEnvTag()` 与 `getCollectionName()` 统一收口到正式集合名，后续即使有人手工传 `__dataEnvTag: 'test'` 也不会再落到 `*_test`。
- 资料页“清除缓存”文案同步改成当前版本口径：仅允许清本地缓存，不再暗示还有测试环境云端清空入口。
- 店长授权码补写脚本不再补写 `test` 口径授权码，只保留 `trial/prod` 的正式授权码补写。
- 线上自动化日志同步改成 `trial/prod` 口径，避免继续把“线上联调”误记成 “test env”。
- 维护种子里原先残留的 `TOW826` 店长码已统一替换为 `OWN826`，避免后续误跑旧维护脚本时再把测试口径授权码写回去。

### 风险

- 这轮是硬切正式集合口径，任何此前只存在于 `_test` 集合里的主题、活动、授权码、组局、场次都不会再被当前版本读取。
- `initData / runtimeReset / clearData` 仍保留代码文件，但由于环境归一到 `prod` 且已有正式环境守卫，实际将保持不可用状态；如果后续真要恢复维护能力，必须重新设计独立安全通道。

### 测试结果

- `npm run lint` 通过
- `npm run test:business` 通过

### 部署情况

- 否

## 2026-04-03 20:12:00 +0800

### 改动原因

- 继续排查“首页无数据”和“工作台授权自动化卡死”两条主链，发现自动化脚本本身跑错了环境口径和授权码，且授权页缺少可追踪日志。

### 涉及模块

- 工作台授权页
- 真实云自动化脚本

### 修改文件

- `packages/staff/auth-code/index.js`
- `scripts/test-cloud-data-check.cjs`
- `scripts/ui-online-flow-check.cjs`

### 影响范围

- 工作台授权页补充提交前后日志，授权失败时会明确记录返回内容和异常。
- `test-cloud-data-check.cjs` 不再走 `develop/test + TOW826`，改为显式切到 `trial/prod + OWN826`，并输出授权页状态日志。
- `ui-online-flow-check.cjs` 同步改为显式切到 `trial/prod + OWN826`，避免脚本因为跑错环境或用错授权码而误判业务失败。

### 风险

- 自动化脚本已修正，但如果线上云函数仍是旧部署包，脚本依然会因为云端旧错误而失败。
- 微信开发者工具自动化 HTTP 端口当前不稳定，脚本偶发会先在一个端口拉起失败，再切到下一个端口成功。

### 测试结果

- `npm run lint` 通过

### 部署情况

- 本轮主要是本地脚本与日志修正，前端未重新上传体验版
- `staffManage` 单独重部署时命中腾讯云 `Updating` 锁，未成功完成更新

---

## 2026-04-03 20:04:00 +0800

### 改动原因

- 用户确认首页不应再保留“初始化数据”入口，该能力只属于测试维护，不应暴露在真实业务页面上。
- 实际排查中发现云函数独立部署后会丢失 `../shared/utils`，导致 `initData` 等函数在线上直接报 `Cannot find module '../shared/utils'`。

### 涉及模块

- 首页
- 测试 / 线上自动化脚本
- 云函数打包结构

### 修改文件

- `pages/home/index.js`
- `pages/home/index.wxml`
- `scripts/test-cloud-data-check.cjs`
- `scripts/ui-online-flow-check.cjs`
- `cloudfunctions/getProfile/index.js`
- `cloudfunctions/updateProfile/index.js`
- `cloudfunctions/getLeaderboard/index.js`
- `cloudfunctions/groupManage/index.js`
- `cloudfunctions/staffManage/index.js`
- `cloudfunctions/initData/index.js`
- `cloudfunctions/runtimeReset/index.js`
- `cloudfunctions/clearData/index.js`
- `cloudfunctions/getProfile/utils.js`
- `cloudfunctions/updateProfile/utils.js`
- `cloudfunctions/getLeaderboard/utils.js`
- `cloudfunctions/groupManage/utils.js`
- `cloudfunctions/staffManage/utils.js`
- `cloudfunctions/initData/utils.js`
- `cloudfunctions/runtimeReset/utils.js`
- `cloudfunctions/clearData/utils.js`

### 影响范围

- 首页不再展示也不再保留“初始化数据”前端入口和相关 dead code，避免误导店员/玩家。
- 两条真实自动化脚本改为只校验现有云端数据，不再调用已下线的首页初始化方法。
- 所有受影响云函数改成引用各自目录内的 `utils.js`，避免独立部署后因找不到 `../shared/utils` 而直接运行失败。

### 风险

- 首页入口已删除，如果测试环境确实需要补基础数据，只能通过内部脚本/云函数维护方式执行，不能再从首页触发。
- 这轮前端修改发生在你刚上传体验版之后；若要让体验版也去掉该入口，需要重新上传前端代码。

### 测试结果

- `npm run lint` 通过

### 部署情况

- 已重新部署：`initData`
- 其余受 `shared/utils` 影响的云函数代码已本地修正，批量重部署仍在处理/待继续确认
- 未重新上传体验版前端代码

---

## 2026-04-03 18:04:50 +0800

### 改动原因

- 用户要求以当前产品功能为准，不允许为了跑回归去改页面文案或功能逻辑。
- 本轮主要收口发布前检查：同步自动化断言、跑稳定回归、部署业务主链云函数，准备体验版上传。

### 涉及模块

- 组队链路自动化
- 云函数部署
- 发布记录

### 修改文件

- `scripts/group-regression-check.cjs`
- `CHANGELOG.md`

### 影响范围

- 组队回归脚本把已结算组局卡片文案断言同步为当前产品文案 `冒险已归档`，不再反向要求页面改回旧文案。
- 未改动前端功能逻辑；大厅、我的、房间等页面现有展示口径保持不变。
- 从隔离快照 `/tmp/miniapp-release-20260403-180138` 部署业务主链云函数：`getProfile`、`updateProfile`、`getLeaderboard`、`groupManage`、`staffManage`。

### 风险

- 本轮未代传体验版，前端页面是否进入体验版还取决于后续是否使用该快照目录重新上传。
- 稳定回归已通过，但 UI 自动化仍未纳入本次发布门槛；真机页面联动仍建议你上传后再过一遍首页 / 大厅 / 房间 / 工作台主路径。

### 测试结果

- `npm run test:regression` 通过

### 部署情况

- 已部署云函数：`getProfile`、`updateProfile`、`getLeaderboard`、`groupManage`、`staffManage`
- 未上传体验版前端代码

---

## 2026-04-03 21:06:48 +0800

### 改动原因

- 修正 `20:42:00` 这批改动里遗漏的真实 bug，避免月榜在 mock / fallback 模式下仍显示总榜数据，同时补齐这次修复的记录。

### 涉及模块

- 排行榜
- 组局云函数
- 门店运营数据页

### 修改文件

- `utils/cloudbase.js`
- `utils/domain/leaderboard.js`
- `pages/leaderboard/view-model.js`
- `pages/leaderboard/index.wxml`
- `mock/data.js`
- `packages/staff/revenue/index.js`
- `cloudfunctions/groupManage/index.js`

### 影响范围

- `packages/staff/revenue/index.js` 补上首屏重复请求守卫，避免 `onLoad + onShow` 首次进入时并发打两次运营分析接口。
- `utils/cloudbase.js` 在 mock / fallback 模式下正式识别 `period`，月榜改为走 `buildMockMonthlyLeaderboard`，不再把总榜数据直接塞进“近30天”页签。
- `pages/leaderboard/view-model.js` 新增 `summaryCards`，并按 `summary.period` 切换摘要卡口径：月榜显示“近30天场次”，总榜显示“总徽章数”。
- `pages/leaderboard/index.wxml` 改为循环渲染摘要卡，避免模板和数据结构继续分叉。
- `mock/data.js` 为榜单样本补入 `monthGrowthValue` / `monthPlayedCount`，让月榜在本地和 mock 环境下有真实可区分的数据表现。
- `cloudfunctions/groupManage/index.js` 的信誉分计算兼容老档案 `playRecords` / `totalPlayCount`，避免只读 `punchRecords` 导致老玩家信誉分偏低。

### 风险

- 月榜 mock 数据现在和总榜刻意拉开，若后续再改榜单 UI 或统计口径，需要同步维护 `mock/data.js` 中的月榜字段。
- 摘要卡改为按 `summary.period` 切换，若未来后端再新增榜单周期，需要同步扩展前端映射。

### 测试结果

- `npm run lint` 通过
- `node scripts/main-flow-check.cjs` 通过

### 是否已部署

- 否

---

## 2026-04-03 20:42:00 +0800

### 改动原因

- 继续落实 PDF 产品优化报告中尚未完成的功能：信誉分补全（未到场扣分、信誉警告展示）、留存率工具（赛季/月榜、退出原因问卷、分享卡片）、门店管理（集锦刷新 bug 修复、运营数据页）。
- 用户明确排除动态调价与支付功能，其余 PDF 列出的功能全部落地。

### 涉及模块

- 信誉分系统
- 队伍房间
- 组局云函数
- 工作台结算云函数
- 排行榜
- 队伍大厅
- 集锦管理
- 门店工作台（新增运营数据页）

### 修改文件

- `cloudfunctions/staffManage/index.js`
- `cloudfunctions/groupManage/index.js`
- `cloudfunctions/getLeaderboard/index.js`
- `pages/team-room/view-model.js`
- `pages/team-room/index.wxml`
- `pages/leaderboard/index.js`
- `pages/leaderboard/index.wxml`
- `pages/lobby/index.js`
- `pages/lobby/index.wxml`
- `packages/staff/highlights/index.js`
- `utils/cloudbase.js`
- `app.json`

### 新增文件

- `packages/staff/revenue/index.js`
- `packages/staff/revenue/index.wxml`
- `packages/staff/revenue/index.wxss`
- `packages/staff/revenue/index.json`

### 具体影响

**信誉分补全：**
- `applySettlement` 结算时检测未到场成员：将 `group.participants[].status === 'active'` 中未出现在 `session.members` 里的玩家 `cancelCount +1`（`db.command.inc`），行为与主动退出一致。
- `handleGetTeamRoom` 在返回房间数据时，为每个成员补取 `profiles` 里的 `cancelCount` 和 `punchRecords.length`，按公式 `max(0, min(100, 100 - cancelCount*8 + min(playCount*2, 40)))` 计算 `reputationScore`，随成员数据一起下发。
- `pages/team-room/view-model.js` 新增 `reputationWarning: score < 60` 字段。
- `pages/team-room/index.wxml` 在成员名字行新增 **信誉低** 标签（`wx:if="{{item.reputationWarning}}"`）。
- `handleCancelActiveGroup` 新增 `reason` 参数，退出时将原因写入 `participants[].leftReason`。

**赛季/月榜：**
- `cloudfunctions/getLeaderboard/index.js` 新增 `period` 参数支持：`total`（默认全时间总榜）和 `month`（近30天）。月榜模式按每个玩家 `punchRecords` 中近30天内的记录重新计算成长值和场次，只展示本期有活跃记录的玩家。
- `utils/cloudbase.js` 的 `getLeaderboard(period)` 支持传入 period；新增 `getStaffAnalytics()` 函数调用 `staffManage:getAnalytics` action。
- `pages/leaderboard/index.js` 新增 `activePeriod`、`periodTabs` 状态与 `changePeriod` 方法；新增 `onShareAppMessage`（"一起来挑战密室排行榜"）。
- `pages/leaderboard/index.wxml` 在头图和内容区之间插入 **总榜 / 近30天** tab 切换条；榜单标题随 period 动态切换。

**退出原因问卷：**
- `pages/lobby/index.js`：非发起人点击"退出队伍"时，先弹出原因选择面板（5个选项），选择确认后再走取消流程，选择原因随 `cancelActiveGroup` 一起传给云函数；发起人取消队伍流程不变，直接弹确认框。
- `pages/lobby/index.wxml`：新增退出原因模态面板，含选项列表和操作按钮。
- `pages/lobby/index.js` 新增 `onShareAppMessage`，文案动态显示当前大厅招募中的队伍数量。

**集锦刷新 bug 修复：**
- `packages/staff/highlights/index.js` 新增 `isFetching` 页面级守卫，防止 `onLoad + onShow` 并发触发两次 `loadHighlights` 导致旧数据覆盖新结果；`isLoading: false` 统一收到 `finally` 块里执行。

**运营数据页（新增）：**
- `cloudfunctions/staffManage/index.js` 新增 `getAnalytics` action（需 `view_statistics` 权限），汇总已结算场次，返回：整体摘要（总场次/本月/本周/平均人数）、主题场次分布（Top 10）、近6个月月度趋势（北京时间分组）。
- 新建 `packages/staff/revenue/` 完整页面，展示以上三部分数据，加载/错误/空状态均有 UI 处理。
- `app.json` 的 staff 分包新增 `revenue/index`。
- `packages/staff/store/index.js` 新增 `goAnalytics()` 导航方法，`index.wxml` 在管理区新增"运营数据"入口按钮。

### 风险

- 队伍房间成员信誉分需要为每个成员单独读取 `profiles`，增加了 `handleGetTeamRoom` 的 DB 读取次数（与成员数量正相关），成员人数多时需关注响应时长。
- 月榜当前使用"近30天滚动窗口"而非自然月，语义上与"本月"略有差异，后续如需改为自然月可切为按 `seasonId` 分组。
- 未到场扣分依赖 `session.members`（店员签到结果）和 `group.participants`（报名名单），若店员结算时未完整完成签到流程，可能出现漏扣或误扣；建议结合真实业务场景验证后确认策略。
- 运营数据页当前无分页，如历史已结算场次量级极大，`listAll` 会全量加载。

### 测试结果

- 待本轮 lint / 主流程脚本校验

### 部署情况

- 未部署云函数
- 未上传体验版

---

## 2026-04-03 18:08:15 +0800

### 改动原因

- 继续落实 PDF 里剩下但不依赖新增云函数的产品项，优先补齐“想玩清单”“挑战任务”“分享战绩/分享主题”这三类能直接提升回访和传播的能力。

### 涉及模块

- 主题详情
- 个人主页
- 本地存储与资料领域层

### 修改文件

- `utils/domain/wishlist.js`
- `utils/platform/storage.js`
- `utils/domain/profile.js`
- `pages/theme-detail/index.js`
- `pages/theme-detail/index.wxml`
- `pages/theme-detail/index.wxss`
- `pages/profile/index.js`
- `pages/profile/index.wxml`
- `pages/profile/index.wxss`
- `pages/profile/view-model.js`

### 影响范围

- 主题详情页支持把主题加入/移出“想玩清单”，并支持直接分享主题。
- 个人主页新增挑战任务区块，把现有成长数据转成可见进度；同时新增想玩清单展示和移除入口。
- 个人主页新增分享战绩按钮，便于把当前场次/徽章进度分享出去。
- 想玩清单走本地存储，不依赖云端结构调整，当前适合先在线下运营验证使用习惯。

### 风险

- 想玩清单当前是设备本地能力，未跨设备同步；如果后续确认要正式运营，需要再补云端字段和同步逻辑。

### 测试结果

- 待本轮 lint / 主流程脚本校验

### 是否已部署

- 否

## 2026-04-03 17:39:52 +0800

### 改动原因

- 根据代码审查继续收尾 PDF 这轮体验改造里的细节问题，消除重复工具函数、空标签渲染和无效 WXSS 写法，避免后续留下表面优化、实际不稳的实现。

### 涉及模块

- 前端共享时间工具
- 队伍房间
- 门店工作台首页
- 个人主页
- 主题详情

### 修改文件

- `utils/platform/time.js`
- `packages/staff/dashboard/index.js`
- `packages/staff/dashboard/index.wxss`
- `pages/team-room/index.js`
- `pages/team-room/index.wxss`
- `pages/profile/index.wxss`
- `pages/theme-detail/index.wxml`

### 影响范围

- 把同步时间格式提取到共享工具，避免 dashboard 和 team-room 两处各自维护。
- 队伍房间概览卡片改成冷色半透明样式，和当前赛博房间头图保持一致。
- 去掉多个页面里无效的 `@media`，改成 `flex-wrap` 自适应布局，避免在微信小程序里写了但实际不生效。
- 主题详情的顶部标签改成按非空字段渲染，避免旧主题数据出现空白胶囊标签。

### 风险

- 主要是样式层调整，需在不同尺寸设备上再看一次间距和折行表现；未涉及云函数协议。

### 测试结果

- `npm run lint` 通过
- `node scripts/main-flow-check.cjs` 通过

### 是否已部署

- 否

## 2026-04-03 17:25:34 +0800

### 改动原因

- 根据 `escape-room-product-report.pdf` 继续落地一轮可直接上线的体验优化，优先处理前台核心页面的视觉方向统一、实时状态感知和门店工作台的信息分层。

### 涉及模块

- 首页
- 队伍大厅
- 队伍房间
- 主题详情
- 排行榜
- 个人主页
- 门店工作台首页
- 门店集锦库

### 修改文件

- `pages/home/index.wxml`
- `pages/home/index.wxss`
- `pages/lobby/index.wxml`
- `pages/lobby/index.wxss`
- `pages/team-room/index.js`
- `pages/team-room/index.wxml`
- `pages/team-room/index.wxss`
- `pages/team-room/view-model.js`
- `pages/theme-detail/index.wxml`
- `pages/theme-detail/index.wxss`
- `pages/leaderboard/index.wxml`
- `pages/leaderboard/index.wxss`
- `pages/profile/index.wxml`
- `pages/profile/index.wxss`
- `packages/staff/dashboard/index.js`
- `packages/staff/dashboard/index.wxml`
- `packages/staff/dashboard/index.wxss`
- `packages/staff/dashboard/view-model.js`
- `packages/staff/highlights/index.wxml`
- `packages/staff/highlights/index.wxss`

### 影响范围

- 首页新增沉浸式快捷入口，缩短从选题到拼场/活动/个人档案的跳转路径。
- 队伍大厅增加招募看板卡片，并把大厅筛选视觉调整为高级灰方向，降低此前暖色卡片过重造成的信息噪音。
- 队伍房间新增最近同步时间和三项概览指标，强化“房间正在推进中”的实时感。
- 主题详情、排行榜、个人主页分别补齐沉浸式标签、榜单机制提示和胶片式战绩摘要，提升页面辨识度。
- 门店工作台首页新增 30 秒同步提示和摘要卡片，集锦库增加上传规则说明，降低店员理解成本。

### 风险

- 本次主要修改 WXML/WXSS 与轻量页面数据拼装，未改动云函数协议；风险集中在前端布局兼容和小屏显示，需要继续在开发者工具中做真机尺寸回看。

### 测试结果

- `npm run lint` 通过
- `node scripts/main-flow-check.cjs` 通过

### 是否已部署

- 否

## 2026-04-03 15:11:08 +0800

### 改动原因

- 继续清理剩余低优先级技术债，把云函数重复 helper 和前端重复样式真正抽到共享层，避免后续继续复制扩散。

### 涉及模块

- 云函数 shared 工具层
- 全局共享 WXSS
- 相关云函数与页面样式引用

### 修改文件

- `cloudfunctions/shared/utils.js`
- `cloudfunctions/clearData/index.js`
- `cloudfunctions/initData/index.js`
- `cloudfunctions/runtimeReset/index.js`
- `cloudfunctions/getLeaderboard/index.js`
- `cloudfunctions/getProfile/index.js`
- `cloudfunctions/updateProfile/index.js`
- `cloudfunctions/groupManage/index.js`
- `cloudfunctions/staffManage/index.js`
- `app.wxss`
- `packages/staff/store/index.wxss`
- `packages/staff/users/index.wxss`
- `pages/leaderboard/index.wxss`
- `pages/team-room/index.wxss`

### 具体影响

- 新增 `cloudfunctions/shared/utils.js`，统一承载 `normalizeDataEnvTag`、`getCollectionName`、`stripInternalId`、`getStoreManagerBinding`。
- `clearData / initData / runtimeReset / getLeaderboard / getProfile / updateProfile / groupManage / staffManage` 已接入共享 helper，云函数内部重复定义已清空。
- `status-ok / status-pending / status-disabled` 以及整套 `player-card-*` 样式已提升到 `app.wxss`，相关页面删除本地重复定义，后续改一处即可全局生效。

### 风险

- 共享样式统一后，工作台资料卡与排行榜/房间资料卡的细微视觉差异被主动收敛为同一套样式，如需再次做页面级差异化，应在共享层之上追加局部覆盖而不是复制整块样式。

### 测试结果

- `npm run lint`：通过
- `node scripts/main-flow-check.cjs`：通过

### 部署情况

- 仅本地代码整改，尚未重新部署云函数或上传体验版

---

## 2026-04-03 14:57:58 +0800

### 改动原因

- 继续收尾剩余的结构性问题，减少工作台重复样板代码和重复全量查询，并补齐运行态重置的大批量告警。

### 涉及模块

- 工作台页面公共鉴权跳转
- 工作台 dashboard 数据聚合
- 房间领域本地档案读取
- 运行态重置日志

### 修改文件

- `utils/domain/staff.js`
- `packages/staff/dashboard/index.js`
- `packages/staff/sessions/index.js`
- `packages/staff/store/index.js`
- `packages/staff/users/index.js`
- `packages/staff/session/index.js`
- `cloudfunctions/staffManage/index.js`
- `utils/domain/team-room.js`
- `cloudfunctions/runtimeReset/index.js`

### 具体影响

- 新增工作台公共鉴权跳转方法，`dashboard / sessions / store / users / session` 五个页面不再各自重复维护同一套“未绑定则 toast + redirect”逻辑。
- `buildDashboard()` 改为按权限一次性共享 `profiles / groups / bindings / auth_codes` 查询结果，避免同一次请求里重复全量查表。
- `team-room` 领域在本地路径下改为单次读取 `getLocalProfile()` 后向下传递，减少一次房间渲染过程中重复触发 storage I/O。
- `runtimeReset` 在清理大于 200 条文档时会追加 warning 日志，方便后续排查大批量删除导致的慢请求或超时风险。

### 风险

- 本轮主要是结构性收敛，行为保持不变；若后续再新增工作台页面，仍需要显式接入公共鉴权方法，避免又复制回分散写法。

### 测试结果

- `npm run lint`：通过
- `node scripts/business-rules-check.cjs`：通过
- `node scripts/main-flow-check.cjs`：通过

### 部署情况

- 仅本地代码整改，尚未重新部署云函数或上传体验版

---

## 2026-04-03 14:50:20 +0800

### 改动原因

- 按最新扫描出的高优先级 bug 集中修复安全风险、数据丢失风险、运行时异常和前端状态误判，并同步清理仓库中的明文授权码与示例手机号。

### 涉及模块

- 本地存储与缓存清理
- 组局云函数
- 工作台结算云函数
- 玩家档案与排行榜统计
- 大厅 / 房间 / 工作台前端页面
- 首页云端内容聚合
- 自动化脚本与种子数据
- 工程配置与仓库敏感信息管理

### 修改文件

- `utils/platform/storage.js`
- `cloudfunctions/groupManage/index.js`
- `cloudfunctions/groupManage/group-domain.js`
- `cloudfunctions/staffManage/index.js`
- `cloudfunctions/staffManage/profile-domain.js`
- `cloudfunctions/getProfile/index.js`
- `cloudfunctions/getProfile/profile-domain.js`
- `cloudfunctions/getLeaderboard/profile-domain.js`
- `utils/domain/profile.js`
- `utils/domain/group.js`
- `utils/domain/team-room.js`
- `utils/cloudbase.js`
- `utils/platform/runtime.js`
- `pages/lobby/index.js`
- `pages/lobby/view-model.js`
- `pages/profile/index.js`
- `pages/theme-detail/index.js`
- `pages/team-room/view-model.js`
- `pages/leaderboard/index.wxml`
- `packages/staff/highlights/index.js`
- `packages/staff/store/index.js`
- `packages/staff/dashboard/index.js`
- `app.js`
- `project.config.json`
- `scripts/main-flow-check.cjs`
- `scripts/regression-check.cjs`
- `.gitignore`
- `mock/data.js`
- `cloudbase-init.json`
- `cloudbase-seeds-import/*.json`
- `cloudfunctions/initData/seed-data.js`
- `cloudfunctions/runtimeReset/seed-data.js`
- `scripts/*.cjs`

### 具体影响

- 修复 `clearBusinessStorage()` 会误删当前 `profile v3` 缓存的问题，避免清缓存时把当前玩家档案一并清空。
- 修复 `groupManage` 在事务里同步玩家档案的写法，改为事务外补档，避开事务内 profile 写入兼容性风险。
- 修复重复加入组局时的误导提示，改为明确返回“你已经在这个组局里了”。
- 修复成员退出组局后 `currentPeople` 最低被错误锁死为 `1` 的问题，允许最后一人退出后正确归零。
- 修复 `staffManage` 结算链路单个玩家写档失败会拖垮整场结算的问题，改为容忍局部失败并记录失败 openId。
- 修复移除员工后授权码被恢复为 `active` 的问题，改为直接置为 `disabled`，避免已用授权码复活。
- 统一前后端档案统计的时间字段优先级，改为 `punchedAt -> playedAt -> 0`，并补齐缺失时间时的兜底。
- 主题专属徽章改为优先按 `themeId` 判定，并兼容历史 `themeName` 数据，避免改主题名后徽章静默失效。
- 修复大厅页“可删除”误判、lobby 过滤死条件、空集锦页不刷新、主题详情重试取参错误、房间结果显示 `+0` 等前端问题。
- 首页云端 banner 不再写死固定主题/活动，改为根据当前线上 `themes` / `activities` 动态生成，减少内容下架后的陈旧展示。
- `getProfile` 批量查询超过 12 个 openId 时改为显式报错，不再静默截断；档案自动建档/回写失败补充告警日志。
- 工作台首页轮询从 `5s` 调整为 `30s`，降低重接口高频刷新的云端消耗。
- 仓库内明文授权码与示例手机号已统一替换为演示占位值，并新增 `.gitignore` 预留 `.env` / `secrets/` 管理入口。
- `project.config.json` 已开启 `minified`，避免继续带着未压缩配置走发布链路。

### 风险

- `groupManage` 的并发满员保护当前依赖云数据库事务串行化能力，虽然已避开事务内 profile 写入风险，但如果后续要进一步放大并发量，仍建议继续演进为更显式的条件更新方案。
- 本轮把仓库里的历史授权码和示例手机号全部替换为占位值，若外部文档或手工测试记录仍引用旧值，需要同步更新。

### 测试结果

- `npm run lint`：通过
- `node scripts/business-rules-check.cjs`：通过
- `node scripts/group-regression-check.cjs`：通过
- `node scripts/main-flow-check.cjs`：通过
- `node scripts/interface-contract-check.cjs`：通过

### 部署情况

- 仅本地代码整改，尚未重新部署云函数或上传体验版

---

## 2026-04-02 13:58:00 +0800

### 改动原因

- 按“整体整改”要求先收口运行环境和高风险入口，避免体验版继续误连测试集合或误触发初始化/重置能力。

### 涉及模块

- 小程序运行环境配置
- 测试数据初始化入口
- 运行态重置入口
- 基础回归脚本
- 当前状态文档

### 修改文件

- `app.js`
- `utils/platform/env-config.js`
- `cloudfunctions/initData/index.js`
- `cloudfunctions/runtimeReset/index.js`
- `scripts/business-rules-check.cjs`
- `CURRENT_STATUS.md`

### 具体影响

- 运行环境配置收敛到单一模块，避免前端不同位置各自解释 `trial / release / develop`
- `trial` 改为直接走 `prod` 数据集合，目标是让体验版具备线下真实业务可用性
- `develop` 继续走 `test` 集合，用于调试和测试数据隔离
- 小程序侧初始化种子数据、运行态重置两类危险入口在 `prod` 环境下直接拒绝执行
- 补充环境配置自动化校验，防止后续再把体验版配回测试集合

### 风险

- 体验版切回正式集合后，任何仍依赖 `_test` 数据的页面或云函数都会暴露真实缺口，需要继续逐链路回归
- 如果后续有人仍通过脚本直接向正式集合写演示数据，本次前端/云函数收口无法替代完整运维规范

### 测试结果

- 待执行 `node scripts/business-rules-check.cjs`

### 部署情况

- 仅本地代码整改，尚未重新部署云函数或上传体验版

---

## 2026-04-02 16:52:51 +0800

### 改动原因

- 进入真实环境部署阶段，需要补一组按当前“体验版走正式链路”口径的冒烟脚本，并把本轮云函数和体验版真正发上去。

### 涉及模块

- 正式链路 UI 冒烟脚本
- 云函数部署
- 体验版上传

### 修改文件

- `scripts/ui-prod-runtime-smoke-check.cjs`

### 具体影响

- 新增一组面向正式链路的 UI 冒烟脚本，目标是验证首页、大厅、档案、排行榜和可进入房间的基础不报错
- 已部署云函数：
  - `groupManage`
  - `staffManage`
  - `initData`
  - `runtimeReset`
- 已上传体验版：
  - 版本号：`2026.04.02.4`
  - 描述：`整体整改：体验版切正式链路、门店玩家自动建档、组局状态修正`

### 风险

- 新的正式链路 UI 冒烟脚本当前运行时卡在等待条件，没有产出明确成功或失败结论，暂时不能把它当作有效通过
- 这意味着“代码已部署 + 体验版已上传”已经完成，但“真链路自动化验收”还没有闭环

### 测试结果

- `npx eslint scripts/ui-prod-runtime-smoke-check.cjs`：通过
- WeChat CLI 云函数部署：`groupManage` 首次因云端 `Updating` 锁失败，重试后通过
- WeChat CLI 体验版上传：通过
- `node scripts/ui-prod-runtime-smoke-check.cjs`：阻塞，无明确通过/失败结论，未计入通过项

### 部署情况

- 云函数已部署到 `mini-escape-main-9f3bjb2e7249ec8`
- 体验版 `2026.04.02.4` 已上传

---

## 2026-04-02 17:55:14 +0800

### 改动原因

- 继续做真实环境诊断，确认体验版切正式链路后的实际可用状态，并修复线上 `getProfile` 缺依赖导致的个人主页加载失败。

### 涉及模块

- 云函数补部署
- 正式环境自动化诊断
- 线上状态记录

### 修改文件

- `CHANGELOG.md`

### 具体影响

- 重新部署了 `getProfile`，修复线上 `Cannot find module 'wx-server-sdk'` 错误
- 自动化诊断确认：
  - 首页：不报错，但正式集合当前没有主题数据，进入空态
  - 大厅：不报错，但正式集合当前没有组局数据，列表为空
  - 档案：修复后已可正常加载，自动建出最小可用档案
  - 排行榜：云函数可正常返回，但正式集合当前为空榜
- 当前问题已从“多页报错”收敛为“正式环境真实业务数据本身为空 + 部分链路待继续验证”

### 风险

- 现在最大的剩余问题不再是前端或 `getProfile` 崩溃，而是正式环境业务数据为空，导致线下直接使用仍然缺主题、组局、排行榜内容
- 工作台、玩家资料卡头像完整性、真实结算联动还需要继续基于真实业务数据验证

### 测试结果

- WeChat automator 诊断：
  - `home`：空态，无报错
  - `lobby`：空列表，无报错
  - `profile`：加载通过
  - `getLeaderboard`：返回空榜但无报错
- `getProfile` 云函数直调：修复后返回成功

### 部署情况

- `getProfile` 已重新部署到 `mini-escape-main-9f3bjb2e7249ec8`
- 体验版仍为 `2026.04.02.4`

---

## 2026-04-02 16:41:01 +0800

### 改动原因

- 继续补结算链路，修复“玩家第一次在结束场次时被写入 `profiles`，但档案可能丢掉本场昵称/手机号，最终沉淀成默认匿名档案”的风险。

### 涉及模块

- 场次结算写档案
- 员工侧档案领域
- 基础业务规则校验

### 修改文件

- `cloudfunctions/staffManage/index.js`
- `scripts/business-rules-check.cjs`

### 具体影响

- 结算写回 `profiles` 前会先按当前场次成员身份做种子补齐
- 对于首次在结算时建档的玩家，会尽量保留本场成员昵称和手机号
- 避免结算把真实玩家沉淀成“档案室常客”这类默认匿名档案

### 风险

- 如果历史场次成员本身缺少 `openId` 或昵称/手机号字段为空，这次补齐仍然只能基于已有字段保底，无法凭空恢复缺失身份

### 测试结果

- `node scripts/business-rules-check.cjs`：通过
- `npx eslint cloudfunctions/staffManage/index.js scripts/business-rules-check.cjs`：通过

### 部署情况

- 仅本地代码整改，尚未重新部署云函数或上传体验版

---

## 2026-04-02 16:38:43 +0800

### 改动原因

- 继续收口组局状态机边界，修复“用户退出队伍后，在列表中被当成完全无关，导致我的记录可能丢失”的问题。

### 涉及模块

- 云端组局列表返回口径
- 前端参与态映射
- 大厅/我的 删除按钮规则
- 组队回归脚本

### 修改文件

- `cloudfunctions/groupManage/group-domain.js`
- `utils/domain/group.js`
- `pages/lobby/view-model.js`
- `scripts/group-regression-check.cjs`

### 具体影响

- 云端组局列表对当前用户的 `viewerRelated / viewerStatus` 不再只看活跃成员，已退出成员也能保留个人关联态
- “我的”页签会正确保留已退出但仍需查看/删除的个人记录
- 已退出记录在大厅中继续隐藏，在“我的”里允许删除
- 补充对应自动化回归，防止后续再把退出态误判成无关数据

### 风险

- 如果线上存在更早期、没有 `participants.openId` 的历史脏数据，退出态展示仍可能受旧数据完整性影响，需要继续结合真实数据复核

### 测试结果

- `node scripts/group-regression-check.cjs`：通过
- `node scripts/business-rules-check.cjs`：通过
- `npx eslint cloudfunctions/groupManage/group-domain.js utils/domain/group.js pages/lobby/view-model.js scripts/group-regression-check.cjs`：通过

### 部署情况

- 仅本地代码整改，尚未重新部署云函数或上传体验版

---

## 2026-04-02 16:22:00 +0800

### 改动原因

- 用户要求把项目里分散、重复、互相打架的规则类文档整合，没用的直接删掉。
- 同时补齐项目内可复用的 `skill` 和标准开工 `prompt`，避免后续继续靠口头交接。

### 涉及模块

- 项目文档治理
- 项目内协作 skill
- 开工 prompt
- 结构基线脚本

### 修改文件

- `AGENT_WORKFLOW.md`
- `AGENT_PROMPT.md`
- `skills/escape-room-miniapp/SKILL.md`
- `skills/escape-room-miniapp/agents/openai.yaml`
- `README.md`
- `CODEMAP.md`
- `PROJECT_CONTEXT.md`
- `cloudfunctions/README.md`
- `scripts/phase1-smoke-check.cjs`

### 删除文件

- `ARCHITECTURE.md`
- `CURRENT_STATUS.md`
- `DEVELOPMENT_RULES.md`
- `FINAL_DEVELOPMENT_SPEC.md`
- `IMPACT_MAP.md`
- `test.txt`

### 具体影响

- 顶层权威文档收敛为：`README.md`、`CHANGELOG.md`、`PROJECT_CONTEXT.md`、`AGENT_WORKFLOW.md`、`CODEMAP.md`、`AGENT_PROMPT.md`
- 原来分散在多份规则文件里的运行口径、开发要求、回归要求被收口到 `AGENT_WORKFLOW.md`
- 新增项目内 `skill`，后续可直接按项目规则触发
- 新增标准开工 `prompt`，后续新会话可直接复用
- 文档基线脚本同步改为检查新的主文档集合

### 风险

- 仓库内其他历史文档或脚本如果仍引用已删除文件，后续可能还会暴露残余死链，需要继续扫尾
- 本次主要是文档治理，还没有替代真实业务回归本身

### 测试结果

- 待执行文档引用排查
- 待执行 `node scripts/phase1-smoke-check.cjs`

### 部署情况

- 仅本地文档与工程整理，未部署

---

## 2026-04-02 17:08:00 +0800

### 改动原因

- 继续按“整体整改”推进内核治理，优先处理两类高风险问题：
  - 体验版/正式运行时仍可能静默回退 mock，形成假在线
  - 门店侧玩家看板过度依赖现成 `profiles` 文档，真实参与过但未主动建档的玩家容易缺失

### 涉及模块

- 运行时 mock 回退策略
- 首页 / 主题链路真实云端兜底
- 门店玩家建档与看板聚合
- 基础业务规则校验

### 修改文件

- `utils/platform/env-config.js`
- `app.js`
- `utils/cloudbase.js`
- `cloudfunctions/staffManage/index.js`
- `cloudfunctions/staffManage/profile-domain.js`
- `scripts/business-rules-check.cjs`

### 具体影响

- `release / trial` 明确禁止启动阶段静默回退 mock，仅 `develop` 允许开发期兜底
- 首页、主题列表、主题详情在真实云端模式下不再因为集合为空就偷偷回退 mock 数据
- 门店看板会把 `groups` / `staff_sessions` 里真实出现过的玩家身份并入资料聚合，缺失档案时自动补建最小可用 `profiles`
- 门店查看玩家资料时，不再强依赖“玩家本人先打开过我的页”这一前置条件
- 补充自动化校验，防止后续又把体验版改回假在线逻辑

### 风险

- 门店看板首次聚合真实参与玩家时，可能会把历史未建档玩家补写入 `profiles`，需要继续关注线上老数据规模
- 首页/主题链路去掉假数据回退后，如果正式集合确实为空，会直接暴露真实空态，这属于预期行为

### 测试结果

- 待执行 `node scripts/business-rules-check.cjs`

### 部署情况

- 仅本地代码整改，尚未重新部署云函数或上传体验版

---

## 2026-04-01 15:51:38 +0800

### 改动原因

- 用户反馈真实业务联调中存在多项问题：
  - 队伍成员资料卡只能看到昵称，看不到头像、签名、基础信息
  - 门店用户/员工资料展示不完整
  - 授权码时间不是北京时间
  - 集锦只有上传者自己能看到内容，其他人只能看到记录
  - 集锦页按钮存在小屏越界风险
  - 多张图片连续上传时标题始终从“图片 1”开始
  - 真实业务线上数据里，创建者自己的队伍在“结束场次”时会报错
- 同时补充开发流程规范：
  - 线上问题必须用真实云数据回归
  - 新增按钮必须做小屏约束
  - 产品交互禁止默认微信弹窗

### 涉及模块

- 用户资料读取与资料卡展示
- 门店工作台
- 队伍房间
- 集锦上传与预览
- 开发规范

### 修改文件

- `cloudfunctions/getProfile/index.js`
- `cloudfunctions/groupManage/index.js`
- `cloudfunctions/staffManage/index.js`
- `utils/cloudbase.js`
- `utils/domain/profile.js`
- `pages/staff-dashboard/view-model.js`
- `pages/staff-highlights/index.js`
- `pages/staff-highlights/index.wxml`
- `pages/staff-highlights/index.wxss`
- `pages/staff-store/index.wxml`
- `pages/staff-store/index.wxss`
- `pages/staff-users/index.js`
- `pages/staff-users/index.wxml`
- `pages/staff-users/index.wxss`
- `DEVELOPMENT_RULES.md`

### 具体影响

- 资料读取改为以 `openid` 为主键强绑定查询，减少昵称兜底导致的误匹配
- 队伍房间和门店侧资料卡在没有完整档案时，保留基于 `openid`/当前成员信息的最小可展示能力
- 门店用户看板新增最近活跃用户列表和资料弹层
- 授权码创建时间、员工绑定时间统一按北京时间展示
- 集锦预览地址改为服务端下发，提升跨账号可见性
- 集锦删除确认改为项目自定义弹窗
- 集锦上传按钮改为更安全的小屏布局
- 图片/视频标题支持按已有内容累计命名，不再每次都从 1 开始
- “结束场次”改为先写入主场次数据，再尽力同步组队房间快照，避免真实老数据把结算主流程拖死
- 开发规范中新增：
  - 正式业务数据回归强制要求
  - 移动端按钮/弹窗规范

### 风险

- 集锦跨账号可见性依赖云存储临时链接能力；如果文件权限策略本身被外部改动，仍可能影响预览
- 门店用户看板新增列表后，数据量继续扩大时可能需要分页
- 真实业务线上已有脏数据如果结构异常更重，仍可能在队伍房间快照同步里产生告警，但不应再阻断“结束场次”主流程
- 目前自动化线上回归跑的是云端在线流程，不等于已逐条验证用户手里的正式业务脏数据样本

### 测试结果

- `npm run lint`：通过
- `npm run test:api`：通过
- `npm run test:flows`：通过
- `npm run test:ui:online`：通过
- 云函数部署：
  - `getProfile`：已部署
  - `groupManage`：已部署
  - `staffManage`：已部署

### 部署情况

- 云函数已部署到当前云环境
- 小程序前端代码已本地修改，但是否进入体验版/正式版还取决于后续上传代码

### 后续排查提示

- 如果后面再查“结束场次报错”，优先看真实业务数据里的：
  - `staff_sessions`
  - `groups`
  - `staff_highlights`
- 如果后面再查“资料看不到”，优先看：
  - `profiles`
  - `getProfile listProfiles`
  - 相关成员是否真的带 `openid`
- 如果后面再查“集锦别人看不到”，优先看：
  - 服务端返回的 `previewUrl`
  - 云文件本身权限和临时链接返回结果

---

## 2026-04-01 16:04:03 +0800

### 改动原因

- 用户反馈集锦管理页“继续补传 / 上传内容”按钮在手机上仍然接近超出边界，之前修复不彻底。

### 涉及模块

- 集锦管理页 UI

### 修改文件

- `pages/staff-highlights/index.wxml`
- `pages/staff-highlights/index.wxss`

### 具体影响

- 集锦卡片头部改为纵向布局
- 状态标签不再与标题强行并排
- 上传按钮改为更保守的铺满布局
- 补充 `box-sizing`、`max-width`、`word-break`、`overflow-wrap`，避免小屏被按钮文本和 padding 撑破

### 风险

- 标题区改成纵向后，单卡高度会略增
- 需要重新上传体验版前端代码后，体验版才能看到这次 UI 修复

### 测试结果

- 待本地 lint 校验
- 待体验版真机复测按钮边界

### 部署情况

- 仅前端代码修改，尚未上传体验版

---

## 2026-04-01 16:41:33 +0800

### 改动原因

- 用户要求把正式线上数据清空，回到干净状态。

### 涉及模块

- 正式云端数据清理
- 清库工具脚本

### 修改文件

- `cloudfunctions/clearData/index.js`
- `scripts/prod-clear-data.cjs`

### 具体影响

- 扩展了清库范围，覆盖正式环境主业务集合：
  - `themes`
  - `activities`
  - `profiles`
  - `groups`
  - `staff_auth_codes`
  - `staff_bindings`
  - `staff_sessions`
  - `staff_highlights`
  - `punch_codes`
- 使用一次性清库脚本触发正式环境清理
- 清理完成后，`clearData` 云函数已恢复正常权限校验版本，没有把临时管理员通道留在线上

### 风险

- 正式线上数据已被清空，不可恢复
- 现在正式环境是空数据状态，相关页面如果没有空态兜底，需要重新验证

### 测试结果

- 正式环境清空返回成功
- 实际清理结果：
  - `themes`: 6
  - `activities`: 2
  - `profiles`: 0
  - `groups`: 3
  - `staff_auth_codes`: 3
  - `staff_bindings`: 0
  - `staff_sessions`: 3
  - `staff_highlights`: 2
  - `punch_codes`: 3

### 部署情况

- `clearData` 云函数已部署执行
- 执行完成后已再次部署回安全版本

---

## 2026-04-01 16:52:59 +0800

### 改动原因

- 用户发现“我明明说清线上数据，但体验版里队伍和个人资料还在”，需要纠正环境口径并把体验版对应的 `_test` 数据一起清空。

### 涉及模块

- 正式/体验版数据环境区分
- 正式与测试集合清理

### 修改文件

- `cloudfunctions/clearData/index.js`
- `scripts/prod-clear-data.cjs`

### 具体影响

- 重新确认：
  - `release` 走 `prod`
  - `trial / develop` 走 `test`
- 已额外清空体验版对应的 `test` 集合
- 清空完成后，`clearData` 云函数再次恢复安全版本

### 风险

- 如果用户手机本地还有旧缓存，页面在重新进入前可能短暂显示旧数据
- 需要重新进入小程序或清本地缓存，才能看到最新空数据状态

### 测试结果

- `test` 集合实际清理结果：
  - `themes`: 6
  - `activities`: 2
  - `profiles`: 15
  - `groups`: 4
  - `staff_auth_codes`: 4
  - `staff_bindings`: 1
  - `staff_sessions`: 4
  - `staff_highlights`: 4
  - `punch_codes`: 3

### 部署情况

- `clearData` 已执行并恢复安全版本

---

## 2026-04-01 17:03:04 +0800

### 改动原因

- 用户清空线上数据后，需要重新补一个可用的店长授权码。

### 涉及模块

- 门店授权码补写

### 修改文件

- `scripts/seed-store-manager-auth-codes.cjs`

### 具体影响

- 正式环境补写店长授权码：`OWN826`
- 体验版 / 测试环境补写店长授权码：`TOW826`

### 风险

- 这是直接写库操作，后续如果再次清空数据，授权码会一起消失

### 测试结果

- `staff_auth_codes` 写入成功：`OWN826`
- `staff_auth_codes_test` 写入成功：`TOW826`

### 部署情况

- 无云函数改动
- 已直接写入云数据库

---

## 2026-04-01 17:27:04 +0800

### 改动原因

- 用户继续反馈 3 个真实联调问题：
  - 各处玩家资料卡仍看不到对方头像
  - 后台把场次结束后，大厅队伍状态没有及时从“游戏中”同步出来
  - 房间里的集锦只能稳定看到自己上传的，别人上传的内容在房间侧不同步

### 涉及模块

- 玩家头像持久化
- 队伍大厅与房间状态同步
- 队伍房间集锦可见性与轮询

### 修改文件

- `utils/cloudbase.js`
- `cloudfunctions/updateProfile/index.js`
- `cloudfunctions/groupManage/index.js`
- `pages/team-room/index.js`

### 具体影响

- 资料编辑保存时，头像不再直接把本机临时路径写进 `profiles.avatarUrl`，而是先上传到云存储后再落库
- 服务端读取队伍列表/房间时，会优先用 `staff_sessions` 的最新 `stageKey/members/timeline/result` 覆盖 `groups` 快照，减少后台已改状态但大厅仍旧卡在旧状态的问题
- 房间页不再把服务端已下发的集锦 `previewUrl` 再次用客户端权限覆盖
- 房间页在 `settled` 后继续轮询，因此别人补传集锦后，房间页面能继续拉到新内容
- `updateProfile` 云函数额外拦截本地临时头像路径，避免错误数据再次写进云端

### 风险

- 历史上已经写进云库的错误本地头像路径无法自动还原；对应用户需要重新选择并保存一次头像，之后其他人才能看到
- 队伍状态现在会优先信任 `staff_sessions`，如果有人直接手改了异常 `staff_sessions` 文档，也会同步反映到大厅/房间

### 测试结果

- `npm run lint`：通过
- `npm run test:api`：通过
- `npm run test:flows`：通过
- `npm run test:groups`：通过
- `npm run test:cloud:testdata`：通过
- `npm run test:ui:online`：通过
- 真实云数据检查结果：
  - `themes`: 6
  - `activities`: 2
  - `profiles`: 7
  - `groups`: 3
  - `staffAuthCodes`: 3
  - `staffSessions`: 3
  - `staffHighlights`: 2
  - `punchCodes`: 3

### 部署情况

- 云函数已部署：
  - `groupManage`
  - `updateProfile`
- 前端代码已上传：
  - 版本号：`2026.4.1.1727`
  - 说明：`修复头像持久化、大厅状态同步、房间集锦刷新`

---

## 2026-04-02 16:01:39 +0800

### 改动原因

- 用户明确要求体验版可以直接拿到线下使用，不接受依赖测试种子兜底。
- 当前真实链路里，新玩家如果还没有 `profile` 文档，队伍房间资料卡只能显示兜底内容，不能保证资料完整可用。
- 需要把“新玩家自动建档、队伍资料卡补全、体验版部署”一次补齐。

### 涉及模块

- 玩家档案自动建档
- 队伍参与即建档
- 队伍房间资料卡读取
- 体验版部署

### 修改文件

- `cloudfunctions/getProfile/index.js`
- `cloudfunctions/getProfile/profile-domain.js`
- `cloudfunctions/groupManage/index.js`
- `utils/cloudbase.js`
- `scripts/business-rules-check.cjs`

### 具体影响

- `getProfile` 单人读取时，如果当前用户还没有档案，会自动创建默认档案并返回，不再只做临时兜底。
- `getProfile listProfiles` 批量读取时，如果成员还没有档案，会结合 `openid + nickname + contactPhone` 自动补档并回写到云端。
- 已存在但仍是默认占位昵称的档案，在批量读取时会优先吸收当前成员身份信息，避免长期停留在“档案室常客”。
- 创建队伍、加入队伍时会同步补齐最小档案，避免必须等到结算后才第一次落库。
- 玩家端拉队伍房间资料时，改为把成员身份信息一起传给后端，不再把未建档用户直接过滤掉。
- 体验版前端代码已重新上传，云函数 `getProfile`、`groupManage` 已重新部署。

### 风险

- 这次解决的是“新玩家无档案导致资料卡空洞”的问题，不等于系统能凭空生成真实头像图片；用户没上传过头像时，仍只会显示默认头像位。
- 已存在的历史脏档案如果字段结构被手工改坏，仍可能需要单独清理。
- 体验版能否最终被线下人员使用，还取决于微信后台是否把本次上传版本设为体验版。

### 测试结果

- `node scripts/business-rules-check.cjs`：通过
- `node scripts/group-regression-check.cjs`：通过
- `node scripts/interface-contract-check.cjs`：通过
- `npx eslint cloudfunctions/groupManage/index.js cloudfunctions/getProfile/index.js cloudfunctions/getProfile/profile-domain.js utils/cloudbase.js scripts/business-rules-check.cjs`：通过

### 部署情况

- 云函数已部署：
  - `getProfile`
  - `groupManage`
- 前端代码已上传：
  - 版本号：`2026.04.02.1`
  - 说明：`修复体验版新玩家自动建档、队伍资料卡补全、资料读取一致性`

---

## 2026-04-02 18:37:53 +0800

### 改动原因

- 现有项目已经明确依赖状态机、云函数契约、错误码、数据库结构、权限边界和发布流程，但这些规则原先散在多个文件和代码实现里，没有形成显式权威文档。
- 用户要求把状态机、云函数契约、错误码、回归脚本说明、发布 SOP、成长体系、多门店口径、权限矩阵、数据库索引和分包策略一次收敛，避免后续 agent 和人工继续各写各的。

### 涉及模块

- 顶层权威文档收敛
- 云函数接口契约文档
- 状态机文档
- 错误码文档
- 数据库模式与索引文档
- 项目内 skill agent 元数据

### 修改文件

- `AGENT_WORKFLOW.md`
- `AGENT_PROMPT.md`
- `CODEMAP.md`
- `PROJECT_CONTEXT.md`
- `README.md`
- `cloudfunctions/README.md`
- `skills/escape-room-miniapp/agents/openai.yaml`
- `STATE_MACHINE.md`
- `ERROR_CODES.md`
- `DB_SCHEMA.md`

### 具体影响

- 新增 `STATE_MACHINE.md`，把组局、房间、场次三条链路的状态流转、操作者和触发条件显式画出来。
- 新增 `ERROR_CODES.md`，统一云函数失败结构、错误码、前端文案和是否允许重试的规则。
- 新增 `DB_SCHEMA.md`，为当前真实集合补齐字段结构和推荐索引，并明确排行榜当前是从 `profiles` 聚合读取，不存在独立榜单写集合。
- 重写 `CODEMAP.md`，补齐实际物理云函数与逻辑接口映射，并把分包策略改成“文档先落地、物理迁移后再切包”的安全方案。
- 重写 `cloudfunctions/README.md`，为 `getProfile / updateProfile / groupManage / staffManage / getLeaderboard` 补齐标准化入参、出参、错误码、调用方和副作用说明。
- 重写 `PROJECT_CONTEXT.md`，补齐成长体系规则、权限矩阵、多门店当前口径，并把运行配置改到当前真实实现。
- 重写 `AGENT_WORKFLOW.md` 和 `AGENT_PROMPT.md`，补齐 Mock 退出检查项、回归脚本覆盖说明和隔离快照发布 SOP。
- 扩充项目 skill 的 `openai.yaml`，补充 paths、schemas 和安全约束，让 agent 进入项目时能直接定位权威文档和统一失败结构。

### 风险

- 这次主要是文档和规范收敛，没有同步把所有存量云函数都补成统一 `errorCode` 返回；当前文档已经定义了目标结构，后续触碰到相关云函数时应继续补齐。
- 分包这次只落了迁移方案，没有直接改 `app.json`，因为现有页面物理目录还没迁走，强切分包有把当前入口改坏的风险。

### 测试结果

- `node scripts/phase1-smoke-check.cjs`：通过

### 部署情况

- 仅本地文档整改，未部署云函数或上传体验版

---

## 2026-04-03 10:04:20 +0800

### 改动原因

- 把此前只写在文档里的分包方案真正落地成物理迁移，降低主包体积并修正分包页面路由。
- 把云端和本地/mock 分支的失败结构继续往统一 `errorCode / retryable` 契约收口，避免同一业务链路在不同运行态返回不一致。
- 修复 `scripts/phase1-smoke-check.cjs` 在 `subPackages.root` 存在时对 `pagePath` 缺少字符串安全处理的问题，防止出现 `pages/undefined` / `pages/null` 假路径。
- 追加本轮整改记录，满足“每次改动都必须写 changelog”的要求。

### 涉及模块

- 分包与页面路由
- 云函数失败结构
- 本地服务层失败结构
- 组局/场次领域校验
- Phase 1 结构校验脚本
- UI 自动化启动容错
- 文档与契约同步

### 修改文件

- `app.json`
- `packages/profile/edit/index.js`
- `packages/profile/badges/index.js`
- `packages/staff/auth-code/index.js`
- `packages/staff/dashboard/index.js`
- `packages/staff/users/index.js`
- `packages/staff/sessions/index.js`
- `packages/staff/store/index.js`
- `packages/staff/session/index.js`
- `packages/staff/session/view-model.js`
- `packages/staff/highlights/index.js`
- `pages/profile/index.js`
- `scripts/phase1-smoke-check.cjs`
- `scripts/business-rules-check.cjs`
- `scripts/ui-flow-check.cjs`
- `scripts/ui-staff-flow-check.cjs`
- `scripts/ui-session-flow-check.cjs`
- `scripts/ui-online-flow-check.cjs`
- `scripts/test-cloud-data-check.cjs`
- `scripts/test-helpers/ui-automator-helper.cjs`
- `utils/cloudbase.js`
- `utils/domain/group.js`
- `utils/domain/staff.js`
- `cloudfunctions/getProfile/index.js`
- `cloudfunctions/updateProfile/index.js`
- `cloudfunctions/getLeaderboard/index.js`
- `cloudfunctions/groupManage/group-domain.js`
- `cloudfunctions/groupManage/index.js`
- `cloudfunctions/staffManage/staff-domain.js`
- `cloudfunctions/staffManage/index.js`
- `CODEMAP.md`
- `cloudfunctions/README.md`
- `ERROR_CODES.md`

### 具体影响

- 员工页和档案扩展页已从主包迁到真实 `subPackages` 目录，`app.json` 与页面内部跳转路径同步改为 `packages/profile/*`、`packages/staff/*`。
- `phase1-smoke-check` 现在会同时校验主包和分包页面，且无论 `root` 是否有值都会先把 `pagePath` 做 `String(pagePath || '')` 和前导斜杠清洗。
- `groupManage / staffManage / getProfile / updateProfile / getLeaderboard` 相关返回结构继续统一，失败响应显式补齐 `errorCode` 和 `retryable`。
- `utils/cloudbase.js` 的本地/mock 失败分支补齐统一错误结构，组局、员工授权、场次、集锦等链路不再只返回裸 `message`。
- `utils/domain/group.js` 和 `utils/domain/staff.js` 的本地校验失败补上标准错误码，前端可按同一规则处理参数错误、组局冲突、场次非法操作等情况。
- UI 自动化 helper 改为按端口递增重试，避免因为固定端口 `9420` 被占用导致脚本直接假失败。

### 风险

- 分包目录已经真实迁移，后续新增页面如果仍按旧 `pages/staff-*` 路径引用，会再次造成路由或 `require` 路径错误。
- 当前 UI 自动化失败点停留在微信开发者工具自动化启动超时，不能据此证明页面业务失败，也不能把 UI 校验记为通过。
- 这次没有执行部署；如果要把这些整改带到体验版或线下环境，仍需重新部署云函数并上传小程序代码。

### 测试结果

- `npm run lint`：通过
- `node scripts/business-rules-check.cjs`：通过
- `node scripts/interface-contract-check.cjs`：通过
- `node scripts/phase1-smoke-check.cjs`：通过
- `WECHAT_AUTOMATOR_PORT=9430 node scripts/ui-flow-check.cjs`：失败，`miniprogram-automator` 启动微信开发者工具连续 3 次超时，未进入页面断言阶段

### 部署情况

- 未部署云函数
- 未上传体验版

---

## 2026-04-03 13:52:38 +0800

### 改动原因

- 按审查需求导出项目完整代码审查文本，方便把整个工程以单个 `.txt` 文件提交给外部审查方。

### 涉及模块

- 审查导出文件
- 变更记录

### 修改文件

- `CHANGELOG.md`
- `/Users/edy/Documents/密室小程序/miniapp-完整代码审查文本-20260403-140000.txt`

### 具体影响

- 生成了单文件审查文本，文件开头包含项目根目录、主要目录说明和完整目录总览。
- 目录总览之后按相对路径顺序拼接全部文本型源码与配置文件。
- 每个文件内容前都带有清晰的 `文件路径:` 标记，便于审查方定位原文件来源。
- 本次导出排除了 `assets` 图片、`node_modules`、`.git` 和 `.DS_Store`，保留 JS、CJS、JSON、MD、WXML、WXSS、YAML/YML 等可审查文本。

### 风险

- 该导出文件会随代码持续演进而过期；如果后续继续改代码，需要重新导出新的审查文本版本。
- 本次导出包含项目内说明文档和配置文件，不是只含运行时代码；如果审查方只要源码，后续可以再单独裁剪一版。

### 测试结果

- 已人工检查导出文件头部结构正确
- 已确认文件包含目录总览与逐文件源码两大部分
- 导出文件总行数：`32743`

### 部署情况

- 本次仅生成审查文本与更新变更记录
- 未部署云函数
- 未上传体验版

---

## 2026-04-03 14:04:09 +0800

### 改动原因

- 因完整审查文本单文件过大，按文件边界拆分成 5 个分卷，便于提交到上下文窗口较小的外部审查系统。

### 涉及模块

- 审查导出文件
- 变更记录

### 修改文件

- `CHANGELOG.md`
- `/Users/edy/Documents/密室小程序/miniapp-完整代码审查文本-5分卷-20260403-140800/01-代码审查分卷.txt`
- `/Users/edy/Documents/密室小程序/miniapp-完整代码审查文本-5分卷-20260403-140800/02-代码审查分卷.txt`
- `/Users/edy/Documents/密室小程序/miniapp-完整代码审查文本-5分卷-20260403-140800/03-代码审查分卷.txt`
- `/Users/edy/Documents/密室小程序/miniapp-完整代码审查文本-5分卷-20260403-140800/04-代码审查分卷.txt`
- `/Users/edy/Documents/密室小程序/miniapp-完整代码审查文本-5分卷-20260403-140800/05-代码审查分卷.txt`

### 具体影响

- 在新目录下生成了 5 个代码审查分卷文件。
- 每个分卷都保留了统一的文件头说明和目录总览，方便单独查看时仍能理解上下文。
- 拆分过程按原始“文件块”边界进行，没有把单个源码文件截断到两卷之间。
- 五个分卷的行数分别为：
  - `01`：`6276`
  - `02`：`6709`
  - `03`：`6806`
  - `04`：`6766`
  - `05`：`7381`

### 风险

- 由于每个分卷都重复携带文件头与目录总览，五卷合计行数会高于原始单文件总行数。
- 如果代码继续变化，这五个分卷也会和单文件审查文本一样过期，需要重新导出。

### 测试结果

- 已人工检查 `01-代码审查分卷.txt` 头部结构正确
- 已确认分卷目录下共 5 个文本文件
- 已确认分卷按文件边界拆分，没有在单个源码文件中间截断

### 部署情况

- 本次仅生成审查分卷与更新变更记录
- 未部署云函数
- 未上传体验版

---

## 2026-04-03 10:53:52 +0800

### 改动原因

- 继续收口维护链路，把 `initData`、`runtimeReset` 的失败结构补齐到统一错误码格式。
- 前端“清除缓存”入口需要和云端口径一致，正式环境只能清本地，不能再尝试触发云端清除。
- 同步修正 `CODEMAP.md` 与外部总开发文档中的过期描述，避免文档继续引用旧结论。

### 涉及模块

- 维护云函数错误结构
- 档案页清缓存入口
- 代码地图
- 外部总开发文档

### 修改文件

- `cloudfunctions/initData/index.js`
- `cloudfunctions/runtimeReset/index.js`
- `pages/profile/index.js`
- `CODEMAP.md`
- `cloudfunctions/README.md`
- `/Users/edy/Documents/密室小程序/小程序完整开发文档.md`
- `CHANGELOG.md`

### 具体影响

- `initData`、`runtimeReset` 现在也统一使用 `fail()` 返回失败结果，正式环境禁用、身份失败、确认口令错误、权限不足等场景都会带 `errorCode`。
- `pages/profile/index.js` 的清缓存入口现在按 `dataEnvTag !== 'prod'` 判断是否允许云端清除；店长在正式环境下只能清本地缓存，并看到明确提示文案。
- `CODEMAP.md` 的分包章节已改成当前真实状态，不再保留“`app.json` 仍是全量主包”的过期描述。
- 外部总开发文档已同步更新：维护函数错误结构、`clearData` 正式环境禁用、权限说明、遗留问题列表都已修正。

### 风险

- `allowCloudDataReset` 目前仍是保留开关，环境配置和前端行为还没有完全统一到同一个布尔量上；现在已经安全，但后续最好继续收敛。
- 本次仍未处理 UI 自动化启动超时问题，`test:regression` 默认跳过 UI 的策略保持不变。

### 测试结果

- `npm run lint`：通过
- `node scripts/business-rules-check.cjs`：通过
- `node scripts/regression-check.cjs`：通过（默认跳过 UI 自动化，仅执行稳定项）

### 部署情况

- 未部署云函数
- 未上传体验版

---

## 2026-04-03 10:21:57 +0800

### 改动原因

- 用户要求输出一份覆盖项目概况、目录结构、页面、云函数、数据库、状态机、权限、错误码、遗留问题、环境配置、发布流程的完整开发文档，并指定文档文件需直接放在 `/Users/edy/Documents/密室小程序` 目录下。

### 涉及模块

- 项目总文档整理
- 文档交付目录补充

### 修改文件

- `/Users/edy/Documents/密室小程序/小程序完整开发文档.md`
- `CHANGELOG.md`

### 具体影响

- 新增一份面向当前 `miniapp` 工程的总文档，覆盖：
  - 项目概况
  - 目录树与文件用途
  - 全部页面清单
  - 全部已实现云函数与空遗留函数目录说明
  - 集合结构与索引
  - 状态机
  - 页面与云函数权限矩阵
  - 错误码总表
  - 当前遗留问题和 TODO
  - 环境配置
  - 发布流程
- 文档位置不在仓库根目录内，而是在用户指定的 `/Users/edy/Documents/密室小程序` 下，便于单独查看和交付。

### 风险

- 该文档是基于当前代码快照生成，后续如果页面、云函数、集合字段继续变化而不维护这份外部文档，会再次产生文档漂移。
- 文档中已记录当前发现的高风险项，例如 `clearData` 未禁止 `prod`，但本次仅做文档整理，未同步修复代码。

### 测试结果

- 已人工核对并交叉引用：
  - `app.json`
  - `PROJECT_CONTEXT.md`
  - `CODEMAP.md`
  - `cloudfunctions/README.md`
  - `DB_SCHEMA.md`
  - `STATE_MACHINE.md`
  - `ERROR_CODES.md`
  - `AGENT_WORKFLOW.md`
  - `AGENT_PROMPT.md`
  - 关键页面与云函数源码

### 部署情况

- 本次仅新增文档与变更记录
- 未部署云函数
- 未上传体验版

---

## 2026-04-03 10:34:00 +0800

### 改动原因

- 基于最新一轮风险复查，优先修正 `clearData` 在正式集合下仍可物理清空数据的高危问题。
- 同时收口回归脚本口径，避免当前不稳定的 UI 自动化持续污染 `test:regression` 结果。

### 涉及模块

- 维护云函数安全守卫
- 总回归脚本
- 错误码与工作手册同步

### 修改文件

- `cloudfunctions/clearData/index.js`
- `scripts/regression-check.cjs`
- `ERROR_CODES.md`
- `cloudfunctions/README.md`
- `AGENT_WORKFLOW.md`
- `README.md`
- `CHANGELOG.md`

### 具体影响

- `clearData` 现在在 `dataEnvTag === 'prod'` 时直接拒绝执行，不再允许店长账号在正式集合上物理清除运行数据。
- `clearData` 失败返回补成统一 `fail()` 结构，身份失败、确认口令错误、权限不足、正式环境禁用都带标准错误码。
- 新增维护错误码 `MAINTENANCE_FORBIDDEN`，专门表达“正式环境禁止执行维护操作”。
- `scripts/regression-check.cjs` 改为默认只跑稳定的非 UI 检查；只有显式设置 `INCLUDE_UI_REGRESSION=1` 才会把 UI 自动化步骤纳入总回归。
- `scripts/regression-check.cjs` 同时补上 `cwd`，现在可以从仓库外层目录直接启动，不会再错误地去读取 `/Users/edy/package.json`。
- `README.md`、`AGENT_WORKFLOW.md`、`cloudfunctions/README.md` 已同步更新对应口径。

### 风险

- `clearData` 的正式环境硬拦截依赖前端/脚本传入的 `__dataEnvTag`；当前运行链路由 `runtime.callCloudFunction()` 统一注入，正常路径可生效，但如果后续有人绕开统一运行时手工直调云函数，仍需保持调用规范一致。
- 这次没有去动 `groupManage` 加入事务逻辑，因为当前代码本身已经使用 `runTransaction`，继续改写成简单 `push` 反而会削弱并发安全性。

### 测试结果

- `npm run lint`：通过
- `node scripts/business-rules-check.cjs`：通过
- `node scripts/regression-check.cjs`：通过（默认跳过 UI 自动化，仅执行稳定项）

### 部署情况

- 未部署云函数
- 未上传体验版

---

## 2026-04-03 11:00:16 +0800

### 改动原因

- 根据最新文档审阅意见，继续补齐外部总文档里的硬错误、交叉引用、权限表现说明、发布 SOP 和回归备注，避免文档与当前实现口径继续漂移。

### 涉及模块

- 外部完整开发文档
- 变更记录

### 修改文件

- `CHANGELOG.md`
- `/Users/edy/Documents/密室小程序/小程序完整开发文档.md`

### 具体影响

- 删除了 `4.2` 通用返回结构中的重复表述，避免同一句出现两次。
- 为 `5.4 groups.roomStage` 明确补上了与 `staff_sessions.stageKey` 的同步关系，并交叉引用第六章 `6.4` 状态机规则。
- 在 `11.2` 发布 SOP 的“部署云函数”步骤中补充了微信开发者工具里的实际操作方法。
- 为 `5.3 profiles` 补充了徽章来源说明，明确当前没有把 `badges[]` 作为真相源字段持久化，而是读取时按档案数据实时计算。
- 为 `4.5 cancelActiveGroup` 解释了 `payload.contactName/contactPhone` 的现用途，明确它们属于前端兼容快照字段，云端最终仍按 `openid + participants` 鉴别身份。
- 为 `7.2` 门店管理页补齐了普通店员进入后的前端表现说明，明确无权限动作会隐藏或禁用，云端也会二次拦截。
- 为 `4.7 getLeaderboard` 补上了与第九章 `9.2` 的关联说明，明确当前不支持赛季榜。
- 为 `4.3 getProfile` 写明 `openIds` 批量上限的来源是当前实现与 CloudBase 查询安全边界。
- 为 UI 回归脚本补上“不稳定、可能超时”的备注，并在附录 A 中写入“每次改动后必须同步更新文档”的维护规则。
- 为 `packages/staff/session` 与 `packages/staff/sessions` 两个目录名补上了区分提示，降低协作误用概率。

### 风险

- 本次仍然是文档修订，不涉及新的业务代码变更；如果后续实现继续演进但未同步更新外部总文档，仍会再次出现文档漂移。
- `profiles` 徽章来源说明基于当前实现口径；若未来改为持久化徽章明细，需要同步修正集合结构、接口契约和本文档描述。

### 测试结果

- 已通过人工检索确认以下关键信息已写入文档：
  - `roomStage` 交叉引用
  - `cancelActiveGroup` 入参说明
  - `getLeaderboard` 与 `9.2` 的关联
  - UI 脚本不稳定备注
  - 附录 A 文档维护规则

### 部署情况

- 本次仅更新文档与变更记录
- 未部署云函数
- 未上传体验版

---

## 2026-04-03 23:28:59 +0800

### 改动原因

- 根据新的徽章清单统一重构玩家成长体系，替换旧徽章 ID / 名称 / 解锁文案，并把组队类徽章需要的结算字段补齐到云端档案记录里。

### 涉及模块

- 玩家档案前端领域模型
- 玩家档案云函数归一化
- 场次结算写档逻辑
- 排行榜档案聚合
- 徽章页展示文案
- 变更记录

### 修改文件

- `utils/domain/profile.js`
- `packages/profile/badges/view-model.js`
- `cloudfunctions/getProfile/profile-domain.js`
- `cloudfunctions/getLeaderboard/profile-domain.js`
- `cloudfunctions/staffManage/profile-domain.js`
- `cloudfunctions/staffManage/index.js`
- `CHANGELOG.md`

### 具体影响

- 前端档案页已切到新的徽章清单，主键从旧的 `badge-first / badge-three / badge-five...` 更换为新的 `badge-first-step / badge-rookie / badge-explorer...`，并同步使用新的未解锁文案和已解锁文案。
- 隐藏徽章统一改为锁定态显示“隐藏徽章，条件未知”，解锁后展示对应彩蛋文案，不再和普通徽章混用同一套说明。
- `staffManage` 结算时现在会把 `wasCreator / maxTeamSize / isFullHouse / teammateOpenIds / teammateNames / teamKey / newbieCount / broughtNewbie / startedAt / endedAt` 写入 `punchRecords`，后续组队类和节律类徽章有了真实计算依据。
- `getProfile` 与 `getLeaderboard` 已对齐新的徽章统计逻辑，避免前端、档案云函数、排行榜三处各算各的。
- 徽章墙列表页在已解锁状态下会展示 `unlockedDescription`，不再只显示锁定态描述。
- 动态称号和荣誉标签已修正默认值短路问题，旧默认 `新客玩家 / 新档案建立` 不会再压住新的动态称号与荣誉标签。

### 风险

- `wishlist / share / challenge / 开业首月 / 最速纪录 / 节假日` 这几类徽章目前优先读取已有字段或本地状态；如果后续要做完全云端统一口径，还需要补专门的持久化真相源。
- 旧玩家历史 `punchRecords` 不包含这次新增的组队字段时，相关徽章只会从新结算开始逐步补全，不会倒推修复历史场次。

### 测试结果

- 已通过 `node -c` 静态检查：
  - `utils/domain/profile.js`
  - `cloudfunctions/getProfile/profile-domain.js`
  - `cloudfunctions/getLeaderboard/profile-domain.js`
  - `cloudfunctions/staffManage/profile-domain.js`
  - `cloudfunctions/staffManage/index.js`
  - `packages/profile/badges/view-model.js`
- 已通过本地样本验证：
  - 前端 `normalizeProfile()` 能输出新的徽章 key、动态称号和荣誉标签
  - 云端 `applySessionSettlement()` 会写入新的 `punchRecords` 字段结构并正确计算徽章数量

### 部署情况

- 本次仅完成代码与变更记录更新
- 尚未部署云函数
- 尚未上传体验版

---

## 2026-04-03 23:41:45 +0800

### 改动原因

- 继续把徽章相关的分享、心愿单、挑战进度做成真实持久化，避免只存在本机缓存、换设备就丢失。

### 涉及模块

- 玩家档案本地归一化
- 玩家档案同步服务
- `updateProfile` 云函数
- 主题详情 / 档案页 / 排行榜 分享与心愿单入口
- 变更记录

### 修改文件

- `utils/domain/profile.js`
- `utils/cloudbase.js`
- `cloudfunctions/updateProfile/index.js`
- `cloudfunctions/getProfile/profile-domain.js`
- `cloudfunctions/getLeaderboard/profile-domain.js`
- `cloudfunctions/staffManage/profile-domain.js`
- `pages/theme-detail/index.js`
- `pages/profile/index.js`
- `pages/leaderboard/index.js`
- `CHANGELOG.md`

### 具体影响

- `wishThemes / shareStats / challengeStats / badgeSignals` 现在可以通过 `updateProfile` 云函数安全写入 `profiles` 集合，不再只有昵称、头像、签名能同步。
- 主题详情页的“加入想玩清单 / 移出想玩清单”已经改成“本地先更新 + 云端同步”，档案页移除心愿单也会同步回云端。
- 档案页和排行榜页的分享入口现在会累计 `shareStats.shareCount`，为隐藏徽章 `badge-sharer` 提供真实持久化数据来源。
- 本地 `saveLocalProfile()` 会把 `wishThemes` 同步回本地清单缓存，主题详情页读取到的想玩状态和云端档案保持一致。
- 挑战完成状态改为“持久化结果与实时结果取较大/取真”，不会因为旧的 `challengeStats.allCompleted=false` 把已经完成的挑战重新压回未完成。
- 删除最后一个想玩主题时也会正确把空数组持久化，不会再被旧本地缓存补回来。

### 风险

- 本次分享次数统计接在档案页和排行榜页分享入口；如果后续还要把其他分享场景也计入徽章，需要继续统一口径。
- `challengeStats` 当前仍以现有四个挑战卡的导出结果为准，若后续挑战体系扩展，需要同步更新导出规则。

### 测试结果

- 已通过 `node -c` 静态检查：
  - `utils/domain/profile.js`
  - `utils/cloudbase.js`
  - `cloudfunctions/updateProfile/index.js`
  - `cloudfunctions/getProfile/profile-domain.js`
  - `cloudfunctions/getLeaderboard/profile-domain.js`
  - `cloudfunctions/staffManage/profile-domain.js`
  - `pages/theme-detail/index.js`
  - `pages/profile/index.js`
  - `pages/leaderboard/index.js`

### 部署情况

- 本次仅完成代码与变更记录更新
- 尚未部署云函数
- 尚未上传体验版

---

## 2026-04-03 13:49:37 +0800

### 改动原因

- 根据最新代码审阅意见，修正队伍房间持续轮询、组局参与态死分支、工作台场次列表页的隐性性能误导，以及场次详情视图模型里的重复状态判断。

### 涉及模块

- 队伍房间页面
- 前端组局领域层
- 工作台场次列表页
- 工作台场次详情视图模型
- 变更记录

### 修改文件

- `pages/team-room/index.js`
- `utils/domain/group.js`
- `packages/staff/sessions/index.js`
- `packages/staff/session/view-model.js`
- `CHANGELOG.md`

### 具体影响

- `pages/team-room/index.js` 的自动刷新现在在 `settled` 和 `archived` 两种终态都会停止，不会再让已结算房间每 10 秒持续轮询。
- `utils/domain/group.js` 删除了 `item.rawStatus === 'full'` 的死分支；当前满员组局归一化后会是 `pending_store_confirm`，不会再出现永远不命中的 recent 判断条件。
- `packages/staff/sessions/index.js` 顶部补充了性能约束注释，明确当前页面复用 `getStaffDashboard()`，会触发完整 `buildDashboard`，后续需要拆独立 action。
- `packages/staff/session/view-model.js` 提取了统一的已到店状态常量，避免同一状态数组在同一映射里重复判断三次。

### 风险

- 本次没有拆 `getStaffDashboard()` 的接口粒度，只是把当前性能负担显式写明；如果继续往 dashboard 里堆字段，场次列表页的加载成本仍会继续上升。

### 测试结果

- `npm run lint`：通过
- `node scripts/group-regression-check.cjs`：通过
- `node scripts/business-rules-check.cjs`：通过

### 部署情况

- 未部署云函数
- 未上传体验版

---

## 2026-04-03 11:52:59 +0800

### 改动原因

- 根据最新代码审阅意见，修正一批真实存在的实现问题，重点包括 `updateProfile` 覆盖写、`runtimeReset` 删除失败不可追查、`clearData` 缺少失败文档 ID 日志，以及 `getProfile` 自动建档缺少追踪日志。

### 涉及模块

- 档案云函数
- 维护云函数
- 排行榜云函数
- 变更记录

### 修改文件

- `cloudfunctions/updateProfile/index.js`
- `cloudfunctions/runtimeReset/index.js`
- `cloudfunctions/clearData/index.js`
- `cloudfunctions/getProfile/index.js`
- `cloudfunctions/getLeaderboard/index.js`
- `cloudfunctions/initData/index.js`
- `CHANGELOG.md`

### 具体影响

- `updateProfile` 现在对已存在档案使用 `update()` 只写可编辑字段，不再用 `set()` 整体覆盖已有文档，避免用户改头像/昵称时把成长值、场次记录、徽章等其他字段抹掉。
- `updateProfile` 同时补上了 `blob:` 协议过滤，避免前端误把本地临时 URL 直接写入头像字段。
- `runtimeReset` 的集合清空改为 `Promise.allSettled()`，现在会记录失败的 `_id`，并在部分删除失败时返回可读错误和当前 `summary`，不再因为 `Promise.all()` 的首个异常直接中断且缺少定位信息。
- `clearData` 的 `clearCollection()` 现在会记录部分删除失败的 `_id` 和错误信息，方便追查残留数据。
- `getProfile` 在批量补档和当前用户自动建档时都补了 `console.info`，方便追踪谁触发了自动建档。
- `getProfile` 里 `openIds.slice(0, 12)` 旁边补了注释，明确这是对齐 CloudBase `where-in` 单次查询上限。
- `getLeaderboard` 补了“小数据量实现”阈值注释与超阈值告警，明确当前仍是全量读取后内存排序分页的实现。
- `initData` 删除了逻辑上不可达的 `prod` 分支解释歧义，保留为仅建模可执行的测试环境种子计划。

### 风险

- `runtimeReset` 现在会在某个集合部分清空失败时直接返回失败结果，避免继续回填该集合；这比之前静默抛错更可控，但如果前面几个集合已完成清空和回填，仍然可能留下“部分集合已重置、部分集合未重置”的中间态，需要按返回的 `summary` 决定是否再次执行。

### 测试结果

- `npm run lint`：通过
- `node scripts/interface-contract-check.cjs`：通过
- `node scripts/business-rules-check.cjs`：通过

### 部署情况

- 未部署云函数
- 未上传体验版

---

## 2026-04-03 11:46:49 +0800

### 改动原因

- 根据新一轮代码审阅意见，优先修正真正存在的高风险点：组局读取链路对 `groups.roomStage` 缓存的过度依赖、`clearData` 生产数据守卫前置不足，以及排行榜接口缺少分页能力。

### 涉及模块

- 组局云函数
- 工作台云函数
- 排行榜云函数
- season 工具
- 页面注释
- 文档与变更记录

### 修改文件

- `cloudfunctions/groupManage/index.js`
- `cloudfunctions/clearData/index.js`
- `cloudfunctions/getLeaderboard/index.js`
- `cloudfunctions/staffManage/index.js`
- `cloudfunctions/shared/season.js`
- `utils/season.js`
- `packages/staff/session/index.js`
- `packages/staff/sessions/index.js`
- `STATE_MACHINE.md`
- `DB_SCHEMA.md`
- `cloudfunctions/README.md`
- `/Users/edy/Documents/密室小程序/小程序完整开发文档.md`
- `CHANGELOG.md`

### 具体影响

- `groupManage` 现在会补拉 `staff_sessions` 对应的 `groupId` 并合并读取结果，即使 `groups.roomStage` 缓存过期，也会优先以 `staff_sessions.stageKey` 作为权威状态。
- `handleJoinGroup` 和 `handleCancelActiveGroup` 的事务内状态判断已切到“组局文档 + session 权威态”的组合读取，不再单独信任 `groups.roomStage` 缓存。
- `staffManage/index.js` 明确注释了 `staff_sessions.stageKey` 是唯一权威状态，`groups.roomStage` 只是玩家侧读取缓存。
- `clearData` 的 `prod` 守卫已前置到函数入口最开始，正式数据目标会在身份校验前直接拒绝执行。
- `getLeaderboard` 新增可选 `pageSize/pageToken` 入参，返回 `nextPageToken/hasMore`，默认行为仍兼容当前前端的前 20 名展示。
- 新增前后端统一 `seasonId` 工具：`utils/season.js` 与 `cloudfunctions/shared/season.js`，统一输出 `YYYY-MM` 格式。
- 给 `packages/staff/session` 与 `packages/staff/sessions` 两个页面入口文件补了区分注释，降低协作时误改风险。
- 文档口径同步更新为：`staff_sessions.stageKey` 权威、`groups.roomStage` 缓存、排行榜支持分页、目录树新增 season 工具。

### 风险

- `joinGroup` 当前仍保留事务方案，而没有改成用户建议的“单条条件更新 + 原子 push”，因为现有参与者结构是对象数组，还包含手机号去重与资料补齐逻辑；直接改成只 push openid 会丢失业务语义。当前事务回归已通过，但如果未来 CloudBase 事务能力或参与者结构发生变化，仍需重新评估。
- `groups.roomStage` 字段本轮没有物理删除，而是降级为缓存字段；旧数据仍会保留该字段，读取链路已改为以 `staff_sessions` 优先。

### 测试结果

- `npm run lint`：通过
- `node scripts/group-regression-check.cjs`：通过
- `node scripts/interface-contract-check.cjs`：通过
- `node scripts/business-rules-check.cjs`：通过

### 部署情况

- 未部署云函数
- 未上传体验版

---

## 2026-04-03 11:38:34 +0800

### 改动原因

- 继续根据审阅意见补齐档案字段说明、首页维护入口权限说明和工作台聚合接口边界，避免文档仍然遗漏真实实现细节。

### 涉及模块

- 外部完整开发文档
- 数据库结构文档
- 云函数接口文档
- 变更记录

### 修改文件

- `CHANGELOG.md`
- `/Users/edy/Documents/密室小程序/小程序完整开发文档.md`
- `DB_SCHEMA.md`
- `cloudfunctions/README.md`

### 具体影响

- 把 `profiles.perks` 从文档中的 `object[]` 修正为当前真实实现的 `string[]`，并补充了常见权益文案示例。
- 为 `profiles.streakDays` 增加了更新时机说明，明确当前没有独立签到逻辑，而是由 `staffManage` 在真实场次结算时按日期差更新。
- 在首页页面说明中补充了 `initData` 的真实权限口径，明确按钮展示受 `allowInitData` 和空首页数据影响，但真正执行仍要求店长角色。
- 为 `staffManage:getDashboard` 补充了 `dashboard.memberList` 的返回边界，明确当前按最近活跃时间排序后最多返回 30 条，且暂未分页。
- 同步把上述口径写入 `DB_SCHEMA.md` 和 `cloudfunctions/README.md`，避免仓库内外文档再次分叉。

### 风险

- 本次仍是文档修订，没有新增业务代码修改；如果后续把 `perks` 升级为结构化对象或给 `memberList` 加分页，需要再次同步更新文档。

### 测试结果

- 已人工核对当前代码与文档口径一致：
  - `getProfile/profile-domain.js` 与 `staffManage/profile-domain.js` 中 `perks` 当前均为字符串数组
  - `staffManage/profile-domain.js` 中 `streakDays` 由结算日期差计算
  - `staffManage/index.js` 中 `dashboard.memberList` 当前 `slice(0, 30)`
  - `initData/index.js` 中实际执行要求 `store_manager`

### 部署情况

- 本次仅更新文档与变更记录
- 未部署云函数
- 未上传体验版

---

## 2026-04-03 11:27:04 +0800

### 改动原因

- 继续收口仓库内文档口径，避免外部总文档已修正但 `DB_SCHEMA.md` 与云函数说明仍保留旧描述。

### 涉及模块

- 数据库结构文档
- 云函数接口文档
- 变更记录

### 修改文件

- `DB_SCHEMA.md`
- `cloudfunctions/README.md`
- `CHANGELOG.md`

### 具体影响

- 为 `DB_SCHEMA.md` 中的 `themes.coverImage` 补充了真实格式说明，明确当前使用的是 `/assets/themes/*.jpeg` 形式的小程序本地资源路径。
- 为 `DB_SCHEMA.md` 中的 `profiles` 集合补充了徽章来源说明，明确当前没有独立 `badges[]` 真相源，而是读取时动态计算。
- 为 `DB_SCHEMA.md` 中的 `groups.roomStage` 补充了与 `staff_sessions.stageKey` 的同步要求。
- 为 `cloudfunctions/README.md` 中的 `groupManage.joinGroup` 补充了并发说明，明确当前通过事务执行满员校验和成员写入，前端需处理事务失败后的刷新重试。

### 风险

- 本次仍然是文档同步，不涉及新的业务代码；若后续事务实现、主题资源来源或徽章持久化方案发生变化，需要再次同步这些文档。

### 测试结果

- 已人工检索确认：
  - `DB_SCHEMA.md` 已包含 `coverImage` 路径说明
  - `DB_SCHEMA.md` 已包含 `badges[]` 非真相源说明
  - `cloudfunctions/README.md` 已包含 `joinGroup` 事务说明

### 部署情况

- 本次仅更新文档与变更记录
- 未部署云函数
- 未上传体验版

---

## 2026-04-03 11:06:44 +0800

### 改动原因

- 根据新一轮审阅意见继续补齐外部总文档中遗漏的 Mock 退出条件、主题封面字段格式、`joinGroup` 并发口径和 `package.json` 版本维护规则。

### 涉及模块

- 外部完整开发文档
- 变更记录

### 修改文件

- `CHANGELOG.md`
- `/Users/edy/Documents/密室小程序/小程序完整开发文档.md`

### 具体影响

- 在第九章 `9.3` 增加了 Mock 退出检查项，明确只有主业务云函数联调通过、稳定回归全绿、测试集合具备稳定种子数据后，才允许关闭 `develop` 下的 `allowMockFallback`。
- 在第十章 `10.4.1` 新增 `allowMockFallback` 退出条件小节，把开关关闭条件和关闭后的行为约束写成显式规则。
- 为 `themes.coverImage` 字段补充了当前真实格式，明确它现在存的是小程序本地资源路径，如 `/assets/themes/*.jpeg`，并写明后续迁移到云存储或 CDN 时需要同步改造。
- 为 `groupManage:joinGroup` 补充了并发说明，明确当前代码已使用 `db.runTransaction(...)` 收口加入流程，并要求事务失败后前端重新拉取列表。
- 在第 `11.4` 节补充了 `package.json` 版本号维护口径，明确它不随每次体验版发布递增，默认保持 `1.0.0`。

### 风险

- 本次仍是文档修订，没有新增代码变更；如果后续实现口径再次变化而文档未同步更新，仍会继续产生漂移。
- `joinGroup` 文档说明基于当前事务实现；若后续改写数据库操作方式，必须同步回写这部分并发说明。

### 测试结果

- 已人工核对当前代码与文档口径一致：
  - `groupManage/index.js` 中 `joinGroup` 使用 `db.runTransaction(...)`
  - `env-config.js` 中仅 `develop` 允许 `allowMockFallback = true`
  - 主题封面资源当前位于 `assets/themes/`

### 部署情况

- 本次仅更新文档与变更记录
- 未部署云函数
- 未上传体验版

---

## 2026-04-04 00:11:57 +0800

### 改动原因

- 按最新视觉要求把小程序 C 端与 B 端主要页面统一切换为方案 C「暗红炭灰」主题，清理上一轮遗留的金色/青色与浅色奶咖风格样式。

### 涉及模块

- 全局样式 Token
- C 端首页/大厅/房间/主题详情/排行榜/个人页/主题页/组局创建页
- B 端工作台/集锦/场次详情/授权码/用户页
- 档案编辑页与徽章页

### 修改文件

- `CHANGELOG.md`
- `app.wxss`
- `pages/home/index.wxss`
- `pages/lobby/index.wxss`
- `pages/team-room/index.wxss`
- `pages/theme-detail/index.wxss`
- `pages/leaderboard/index.wxss`
- `pages/profile/index.wxss`
- `pages/themes/index.wxss`
- `pages/lobby-create/index.wxss`
- `packages/staff/dashboard/index.wxss`
- `packages/staff/highlights/index.wxss`
- `packages/staff/session/index.wxss`
- `packages/staff/users/index.wxss`
- `packages/staff/auth-code/index.wxss`
- `packages/profile/edit/index.wxss`
- `packages/profile/badges/index.wxss`

### 具体影响

- 全局背景、卡片、按钮、标签、弹层统一改为炭灰底、暗红高亮、米白主文字的方案 C 色板。
- 首页、主题列表、组局大厅、战队房间等此前仍带浅色渐变或青金配色的模块已全部切到深色沉浸式视觉。
- 工作台相关页面不再混用奶咖色头图与浅色卡片，B 端与 C 端在色板上保持统一但层级区分仍然保留。
- 清理了多个样式文件尾部的残留无效行，避免后续继续叠加脏样式。

### 风险

- 本次改动集中在 WXSS 视觉层，没有调整页面逻辑；仍需在微信开发者工具中逐页看一遍实际渲染，确认长文本、极端数据和安全区下没有布局溢出。

### 测试结果

- 已完成样式残留检索，旧方案中的青色/金色变量引用与主要浅色硬编码已从 `pages/`、`packages/` 主样式中清理。
- 已人工检查关键样式文件尾部，确认不存在本轮编辑产生的残片或多余无效声明。
- 已补齐 `app.json` 与自定义 `custom-tab-bar` 的深色配置，修复顶部导航栏和底部栏仍显示暖棕底色的问题。
- 已补齐活动页卡片与时间轴样式，并移除 `warm/plain` 旧命名。

### 部署情况

- 本次仅更新前端样式与变更记录
- 未部署云函数
- 未上传体验版

---

## 2026-04-05 16:34:00 +0800

### 改动原因

- 主题评论功能已经接入代码，但当前主题页一进入就主动拉评论；如果云函数未部署或评论集合暂不可用，用户会立刻看到“评论加载失败”提示，体验过于生硬。
- 评论入口只挂在主题详情页不够顺手，用户玩完一场后不应该还得自己回主题页找入口，需要在个人页补一个“待评价”聚合入口承接已结束未评价场次。

### 涉及模块

- 主题评论云函数
- 主题详情页
- 个人主页常用入口
- 前端主题评论服务层

### 修改文件

- `CHANGELOG.md`
- `cloudfunctions/themeReviewManage/index.js`
- `utils/cloudbase.js`
- `pages/theme-detail/index.js`
- `pages/theme-detail/index.wxml`
- `pages/theme-detail/index.wxss`
- `pages/profile/index.js`
- `pages/profile/index.wxml`
- `pages/profile/index.wxss`

### 具体影响

- `themeReviewManage` 新增 `listPendingReviews` 动作，按当前玩家已结束但未评价的场次生成待评价列表。
- 个人主页常用入口新增“待评价”入口，支持集中查看未评价场次并一键跳转到对应主题页发评价。
- 主题详情页评论改成懒加载：
  - 不再在页面初次进入时立刻请求评论
  - 只有展开评论区或从待评价入口直达时才会拉取评论数据
  - 评论接口异常时优先显示内联状态，不再一进页面就直接 toast 打断
- 从个人页待评价入口跳进主题页时，会自动切到评论区并预选对应已结束场次，提交后仍走原评论链路，评价会展示到主题页评论列表。
- 修正常用入口里的类名冲突，恢复原有“徽章”入口可见与可点击状态。
- 待评价跳转进入主题页时，允许直接打开评价框，不再被评论列表加载状态卡住。

### 风险

- `listPendingReviews` 依赖 `profiles.punchRecords / playRecords` 中存在可识别的 `themeId/themeName` 和 `sessionId/recordId`，如果历史老数据缺这些字段，对应记录不会进入待评价列表。
- 如果 `themeReviewManage` 云函数尚未重新部署，主题评论和待评价入口仍然无法正常读取。

### 测试结果

- 尚未做微信开发者工具里的待评价入口到主题评价提交的完整点击回归。

### 部署情况

- 已修改前端与 `themeReviewManage` 云函数代码
- 仍需重新上传 `themeReviewManage`

---

## 2026-04-05 15:46:00 +0800

### 改动原因

- 主题详情页原来的玩家评价仍然是 `themes.reviews[]` 静态数组，无法支持真实评论、回复、评分、点赞、筛选计数和大量分页读取。
- 评论数据结构需要从主题主文档里拆出，改成“主题摘要 + 独立评论表”的两层模型，避免后续评论增长后把详情页和主题集合一起拖慢。

### 涉及模块

- 主题详情页
- 主题服务层
- 主题评论云函数
- 主题评论数据库结构说明

### 修改文件

- `CHANGELOG.md`
- `DB_SCHEMA.md`
- `utils/domain/theme.js`
- `utils/cloudbase.js`
- `pages/theme-detail/index.js`
- `pages/theme-detail/index.wxml`
- `pages/theme-detail/index.wxss`
- `cloudfunctions/themeReviewManage/index.js`
- `cloudfunctions/themeReviewManage/utils.js`
- `cloudfunctions/themeReviewManage/package.json`

### 具体影响

- 新增 `themeReviewManage` 云函数，支持：
  - 主题评价分页读取
  - 顶层评价发布
  - 评价回复
  - 玩家 / 店家身份回复展示
  - 点赞切换
  - 最新 / 高赞排序
  - 全部 / 好评 / 中评 / 差评 / 有回复筛选
- 主题详情页评论区改成三层结构：
  - 评论摘要
  - 精选评价
  - 全部评价
- `themes` 集合只保留 `reviewStats` 和 `reviewHighlights` 摘要字段，不再继续依赖全量 `reviews[]` 作为真实评论来源。
- 评论作者昵称和头像改为写入快照字段，避免玩家后续改资料导致历史评论展示跳变。
- 顶层评价按 `sessionId + openId` 做唯一约束，同一已完成场次最多保留一条评价。
- 全部评价分页改为游标式读取，不再使用 offset。

### 风险

- 本次新增了全新的云函数与三张评论相关集合，上传代码后仍需要在云开发侧确认：
  - `themeReviewManage` 已部署
  - `wx-server-sdk` 已安装到该函数目录
  - 线上环境允许创建或读写 `theme_reviews / theme_review_likes / theme_review_stats`
- 当前评论审核状态字段已经预留为 `status`，但暂时默认直接写入 `approved`，后续如果接入人工审核，需要补后台操作入口。

### 测试结果

- 已对以下 JS 做语法检查，通过：
  - `cloudfunctions/themeReviewManage/index.js`
  - `pages/theme-detail/index.js`
  - `utils/cloudbase.js`
  - `utils/domain/theme.js`
- 未进行微信开发者工具中的评论发布、回复、点赞逐步点击回归。

### 部署情况

- 本次包含前端页面、服务层和新云函数
- 尚未部署云函数
- 尚未上传体验版

---

## 2026-04-04 00:45:19 +0800

### 改动原因

- 根据最新确认，放弃暗红炭灰方案，整体视觉回退到原来的暖棕方向，并优先修正首页、大厅、房间、活动页、系统导航和底部栏这些最直接可见的区域。

### 涉及模块

- 全局样式 Token
- 顶部导航与自定义 TabBar
- 首页、组队大厅、房间页、活动页
- 其他主要页面的 hero / 卡片暖棕回退

### 修改文件

- `CHANGELOG.md`
- `app.wxss`
- `app.json`
- `custom-tab-bar/index.wxss`
- `pages/activities/view-model.js`
- `pages/activities/index.wxss`
- `pages/home/index.wxss`
- `pages/lobby/index.wxss`
- `pages/team-room/index.wxss`
- 以及其余同步回退暖棕渐变的页面样式文件

### 具体影响

- 全局底色、卡片底色、描边和文字层重新回到浅米色 + 棕色强调的暖棕体系。
- 顶部导航栏、底部 TabBar、活动页头图、首页 hero、房间页 hero 和大厅氛围卡不再沿用暗红炭灰方案。
- 活动页恢复 `warm/plain` 这套原有卡片分层命名，避免继续混用上一版的深色命名。

### 风险

- 这次是从一版已经大范围改动过的深色样式上往回退，不是直接文件级整包还原，所以仍可能有个别深色装饰残留在次级页面；如果你看见具体页面还有问题，直接点名页面我继续收。

### 测试结果

- 已人工核对 `app.json`、`custom-tab-bar/index.wxss`、`pages/activities/index.wxss`、`pages/home/index.wxss`、`pages/lobby/index.wxss`、`pages/team-room/index.wxss` 当前都已回到暖棕主方向。

### 部署情况

- 本次仅更新前端样式与变更记录
- 未部署云函数
- 未上传体验版

---

## 2026-04-05 13:14:34 +0800

### 改动原因

- 日期与时间滚轮样式提亮后，中间选中层背景覆盖了 `picker-view` 文本，导致选中的时间不可见，需要修正选中层实现方式。

### 涉及模块

- 发起队伍页

### 修改文件

- `CHANGELOG.md`
- `pages/lobby-create/index.wxss`

### 具体影响

- 将滚轮中间选中层从实底背景改为透明高亮框，不再遮挡时间文字。
- 轻微提升未选中项透明度，避免整体文字过淡。

### 测试结果

- 已确认 `pages/lobby-create/index.js` 语法检查通过。
- 未在微信开发者工具里实际观察滚轮选中态。

### 部署情况

- 本次仅修改前端样式
- 未部署云函数
- 未上传体验版

---

## 2026-04-05 12:51:06 +0800

### 改动原因

- 发起队伍页的日期与时间虽然已经改为程序内滚动弹层，但列表式选择仍然过高，且时间范围不足 24 小时营业场景，需要进一步改成更紧凑的滚轮选择器。

### 涉及模块

- 发起队伍页

### 修改文件

- `CHANGELOG.md`
- `pages/lobby-create/index.js`
- `pages/lobby-create/index.wxml`
- `pages/lobby-create/index.wxss`
- `pages/lobby-create/view-model.js`

### 具体影响

- 日期与时间弹窗统一改成程序内滚轮选择器，使用自定义弹层承载，不再是长列表铺满视口。
- 日期显示文案缩短为 `MM-DD 周X`，并在滚轮里附加 `明天 / 后天 / N 天后` 辅助提示。
- 时间选项扩展为完整 24 小时、半小时粒度的可选列表。
- 日期与时间选择改为“滚动后点击确认”写回表单，避免滑动过程中频繁改值。

### 测试结果

- 已对 `pages/lobby-create/index.js` 与 `pages/lobby-create/view-model.js` 做语法检查，通过。
- 未在微信开发者工具里实际验证滚轮手感、滚动停靠与真机表现。

### 部署情况

- 本次仅修改前端页面
- 未部署云函数
- 未上传体验版

---

## 2026-04-05 12:47:57 +0800

### 改动原因

- 发起队伍页的日期与时间弹窗虽然已经改成程序内样式，但当前文案过长、弹层过高，视觉上仍接近铺满全屏；同时时间段不覆盖 24 小时营业场景，需要继续压缩并改成滚动选择。

### 涉及模块

- 发起队伍页

### 修改文件

- `CHANGELOG.md`
- `pages/lobby-create/index.wxml`
- `pages/lobby-create/index.wxss`
- `pages/lobby-create/view-model.js`

### 具体影响

- 日期字段显示改为更短的 `MM-DD 周X`，避免输入框内文案超出边界。
- 日期弹窗改成更矮的固定高度滚动弹层，不再视觉上盖满整个页面。
- 时间弹窗同样改成固定高度滚动弹层。
- 时间选项从原先有限时段扩展为完整 24 小时半小时粒度列表。
- 日期列表增加 `明天 / 后天 / N 天后` 这类简短提示，帮助快速定位。

### 测试结果

- 已对 `pages/lobby-create/index.js` 与 `pages/lobby-create/view-model.js` 做语法检查，通过。
- 未在微信开发者工具里实际滚动验证日期、时间弹层的手感与显示边界。

### 部署情况

- 本次仅修改前端页面
- 未部署云函数
- 未上传体验版

---

## 2026-04-05 12:42:17 +0800

### 改动原因

- 发起队伍页在主题选择改为程序弹窗后，日期与时间仍保留微信默认选择器，交互风格不统一，因此继续替换为程序内弹层。

### 涉及模块

- 发起队伍页

### 修改文件

- `CHANGELOG.md`
- `pages/lobby-create/index.js`
- `pages/lobby-create/index.wxml`
- `pages/lobby-create/view-model.js`

### 具体影响

- 组局日期与开场时间不再使用微信默认 `picker`。
- 日期改为程序内弹窗，提供未来 14 天可选日期，并显示为 `YYYY-MM-DD MM-DD 周X` 的可读格式。
- 时间改为程序内弹窗，提供固定时间段列表选择。
- 发起队伍页的主题、日期、时间三项现在都统一为程序内样式弹层。

### 测试结果

- 已对 `pages/lobby-create/index.js` 与 `pages/lobby-create/view-model.js` 做语法检查，通过。
- 未在微信开发者工具里逐项点击验证日期、时间弹窗交互。

### 部署情况

- 本次仅修改前端页面
- 未部署云函数
- 未上传体验版

---

## 2026-04-05 12:37:19 +0800

### 改动原因

- 发起队伍页的主题选择仍使用微信默认 `picker` 弹层，视觉风格与项目内其他自定义弹窗不一致，需要改为程序内弹窗。

### 涉及模块

- 发起队伍页

### 修改文件

- `CHANGELOG.md`
- `pages/lobby-create/index.js`
- `pages/lobby-create/index.wxml`
- `pages/lobby-create/index.wxss`

### 具体影响

- “选择主题”不再使用微信默认选择器。
- 改为项目内主题风格的自定义弹窗，列表中直接展示主题名称与关键信息。
- 当前已选主题会在弹窗内高亮显示。
- 日期与时间仍保持原生选择器，当前只替换主题选择这一处。

### 测试结果

- 已对 `pages/lobby-create/index.js` 做语法检查，通过。
- 未在微信开发者工具里实际点击验证弹窗交互。

### 部署情况

- 本次仅修改前端页面
- 未部署云函数
- 未上传体验版

---

## 2026-04-05 12:22:20 +0800

### 改动原因

- 修正主题文案中的错字。当前主题正式名称为“尸兄”，但徽章文案与主题匹配别名里仍残留“师兄”，会造成展示不一致。

### 涉及模块

- 主题别名匹配
- 徽章名称与解锁说明

### 修改文件

- `CHANGELOG.md`
- `utils/domain/profile.js`
- `cloudfunctions/getProfile/profile-domain.js`
- `cloudfunctions/getLeaderboard/profile-domain.js`
- `cloudfunctions/staffManage/profile-domain.js`

### 具体影响

- 用户可见文案统一从“师兄”改为“尸兄”。
- 相关徽章名称统一改为“尸兄不散”。
- 徽章解锁说明统一改为“完成【尸兄】主题即可解锁”。
- 已存量的 `honorLabels` / `titleLabel` 若仍残留旧值“师兄不散”，读取时会自动归一化为“尸兄不散”。
- 保留 `师兄` 作为主题别名兼容项，避免历史数据或旧记录匹配失败。
- 内部稳定主题 ID `theme-shixiong` 未改动，避免影响现有数据。

### 测试结果

- 已全局检索 `师兄|尸兄`，确认错误展示文案已清理，仅保留兼容别名中的 `师兄`。

### 部署情况

- 本次涉及前端与云函数文案
- 尚未部署云函数
- 尚未上传体验版

---

## 2026-04-04 21:56:57 +0800

### 改动原因

- 继续修正近期迭代里“功能一多就堆成长卡片、页面只能一路下滑”的展示问题，同时补上信誉分自然恢复规则与资料页说明，避免前后端规则不一致、弹窗过长难读。

### 涉及模块

- 信誉分规则与个人资料弹窗
- 用户看板、单场次管理、门店运营数据
- 门店管理页长列表展示
- 主题详情页内容结构

### 修改文件

- `CHANGELOG.md`
- `utils/domain/profile.js`
- `pages/profile/index.js`
- `pages/profile/index.wxml`
- `pages/profile/index.wxss`
- `packages/staff/store/index.js`
- `packages/staff/store/index.wxml`
- `packages/staff/store/index.wxss`
- `packages/staff/users/index.js`
- `packages/staff/users/index.wxml`
- `packages/staff/users/index.wxss`
- `packages/staff/session/index.js`
- `packages/staff/session/index.wxml`
- `packages/staff/session/index.wxss`
- `packages/staff/revenue/index.js`
- `packages/staff/revenue/index.wxml`
- `packages/staff/revenue/index.wxss`
- `pages/theme-detail/index.js`
- `pages/theme-detail/index.wxml`
- `pages/theme-detail/index.wxss`
- `cloudfunctions/groupManage/index.js`
- `cloudfunctions/getProfile/profile-domain.js`
- `cloudfunctions/getLeaderboard/profile-domain.js`
- `cloudfunctions/staffManage/profile-domain.js`

### 具体影响

- 信誉分恢复规则改为按自然日恢复：
  - 前 5 天每天恢复 1 分
  - 第 6 到 10 天每天恢复 2 分
  - 第 11 天起每天恢复 5 分
  - 满分 100 时不再继续恢复
- 玩家侧与云函数侧统一使用同一套信誉分恢复公式，避免资料页、排行榜、工作台、组队逻辑各算各的。
- 个人资料里的信誉分弹窗补充“明日预计恢复多少分”提示，并将原来一行一块的大卡片压缩为更紧凑的信息块。
- 门店管理页的授权码、员工列表、店长转移候选统一改成“预览 + 展开”结构，防止员工增多后整页无限拉长。
- 用户看板弹窗的玩家列表、场次列表统一改成前几条预览 + 展开全部，单条尺寸同步收紧。
- 单场次管理页的成员确认列表、处理记录改成预览展开，操作区按钮改成更紧凑的双列布局。
- 运营数据页的主题分布与月度趋势列表改成预览展开，单条数据行高度收紧。
- 主题详情页的剧情介绍、游玩建议、玩家评价改成折叠块，避免详情页天然过长。

### 风险

- 这次改动同时涉及多处弹窗和折叠状态管理，虽然逻辑不复杂，但仍需要在开发者工具里逐页点开确认“展开 / 收起”状态切换是否符合预期。
- 信誉分恢复规则已统一到前后端；如果线上已有依赖旧恢复逻辑的截图或说明文案，需要同步更新。

### 测试结果

- 已对以下前端 JS 做语法检查，通过：
  - `packages/staff/users/index.js`
  - `packages/staff/session/index.js`
  - `packages/staff/revenue/index.js`
  - `pages/theme-detail/index.js`
  - `pages/profile/index.js`
- 未进行微信开发者工具中的逐页点击回归。

### 部署情况

- 本次包含前端页面与云函数规则调整
- 尚未部署云函数
- 尚未上传体验版

---

## 2026-04-04 00:22:36 +0800

### 改动原因

- 继续优化方案 C 的视觉层次。上一版虽然已经去掉暖棕，但整体压得太黑，顶部、底部和活动页观感仍然偏闷，因此将整站主底色和 hero 渐变整体提亮一档。

### 涉及模块

- 全局色板
- 系统导航与自定义 TabBar
- 首页、大厅、房间、排行榜、活动页、个人页
- 主题页、组局创建页、徽章页、档案编辑页
- 工作台相关 hero 区块

### 修改文件

- `CHANGELOG.md`
- `app.wxss`
- `app.json`
- `custom-tab-bar/index.wxss`
- `pages/home/index.wxss`
- `pages/lobby/index.wxss`
- `pages/team-room/index.wxss`
- `pages/leaderboard/index.wxss`
- `pages/activities/index.wxss`
- `pages/themes/index.wxss`
- `pages/lobby-create/index.wxss`
- `pages/profile/index.wxss`
- `packages/profile/edit/index.wxss`
- `packages/profile/badges/index.wxss`
- `packages/staff/auth-code/index.wxss`
- `packages/staff/session/index.wxss`
- `packages/staff/users/index.wxss`
- `packages/staff/dashboard/index.wxss`
- `packages/staff/highlights/index.wxss`

### 具体影响

- 将全局底色从纯黑附近提升到偏蓝灰的炭灰层级，减少页面“糊成一片”的感觉。
- 卡片底色、次级底色和遮罩同步提亮，层次更容易分辨，文字呼吸感更好。
- 首页、房间、排行榜、活动页等 hero 区块不再使用过深的酒红黑渐变，改为更通透的炭灰红混合渐变。
- 系统导航栏和底部自定义 TabBar 一并提亮，与页面主内容不再割裂。
- 活动页卡片和时间线继续保留红灰方向，但降低了压迫感。

### 风险

- 本次仍然只涉及视觉样式，没有修改业务逻辑；但由于多个页面 hero 与卡片渐变一起调整，仍需要在真机或开发者工具里快速过一遍页面，确认图标、位图和深色文字没有出现新的对比度问题。

### 测试结果

- 已人工核对关键入口：
  - `app.json` 顶部导航与页面背景已切到更亮的炭灰底
  - `custom-tab-bar/index.wxss` 底栏已提亮并减轻压暗感
  - `pages/activities/index.wxss` 活动卡片与顶部区块已不再是上一版的过深底色

### 部署情况

- 本次仅更新前端样式与变更记录
- 未部署云函数
- 未上传体验版
