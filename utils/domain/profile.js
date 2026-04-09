'use strict';

const storage = require('../platform/storage');
const wishlistService = require('./wishlist');

const GENDER_LABELS = {
  male: '男',
  female: '女',
  not_set: '未设置',
};

const LEVEL_RULES = [
  {
    minGrowth: 0,
    name: '入局新人',
    nextMinGrowth: 90,
    benefits: ['建立个人档案', '场次记录自动沉淀', '可参与基础拼场'],
  },
  {
    minGrowth: 90,
    name: '线索学徒',
    nextMinGrowth: 200,
    benefits: ['新主题上新提醒', '周末热门场次优先通知', '个人档案展示成长等级'],
  },
  {
    minGrowth: 200,
    name: '密档访客',
    nextMinGrowth: 340,
    benefits: ['多人局匹配优先提醒', '夜场活动优先通知', '成长称号展示升级'],
  },
  {
    minGrowth: 340,
    name: '机关探索者',
    nextMinGrowth: 520,
    benefits: ['多人局匹配优先提醒', '夜场活动优先通知', '成长称号展示升级'],
  },
  {
    minGrowth: 520,
    name: '迷城行者',
    nextMinGrowth: 760,
    benefits: ['新主题内测优先排队', '热门时段拼场提醒增强', '生日月福利升级'],
  },
  {
    minGrowth: 760,
    name: '破局专员',
    nextMinGrowth: 1060,
    benefits: ['高热主题优先通知', '门店活动优先报名', '组局档案高级标识'],
  },
  {
    minGrowth: 1060,
    name: '夜巡档案官',
    nextMinGrowth: 1420,
    benefits: ['隐藏活动候补优先', '门店重磅主题优先提醒', '长期玩家专属标识'],
  },
  {
    minGrowth: 1420,
    name: '图鉴搜证官',
    nextMinGrowth: 1840,
    benefits: ['隐藏活动候补优先', '门店重磅主题优先提醒', '长期玩家专属标识'],
  },
  {
    minGrowth: 1840,
    name: '馆藏策展人',
    nextMinGrowth: 2320,
    benefits: ['传奇档案标识', '隐藏活动优先邀请', '门店核心玩家优先通知'],
  },
  {
    minGrowth: 2320,
    name: '传说破局者',
    nextMinGrowth: null,
    benefits: ['传奇档案标识', '隐藏活动优先邀请', '门店核心玩家优先通知'],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const STORE_THEME_MATCHERS = [
  ['theme-shixiong', ['theme-shixiong', '尸兄', '师兄']],
  ['theme-jishengchong', ['theme-jishengchong', '寄生虫']],
  ['theme-yixueyuan', ['theme-yixueyuan', '医学院']],
  ['theme-xishiren', ['theme-xishiren', '戏尸人']],
  ['theme-wenchuanzhongxue', ['theme-wenchuanzhongxue', '文川中学', '文川']],
  ['theme-tonglingren', ['theme-tonglingren', '瞳灵人']],
];

function buildDefaultReputationMeta() {
  return {
    penaltyTotal: 0,
    creatorCancelCount: 0,
    creatorLateCancelCount: 0,
    recentCreatorCancelTimestamps: [],
    lastPenaltyAt: '',
    lastPenaltyReason: '',
    lastCancelWindowHours: 0,
  };
}

function normalizeReputationMeta(meta = {}) {
  const base = buildDefaultReputationMeta();
  return {
    penaltyTotal: Math.max(0, Number(meta.penaltyTotal || base.penaltyTotal)),
    creatorCancelCount: Math.max(0, Number(meta.creatorCancelCount || base.creatorCancelCount)),
    creatorLateCancelCount: Math.max(
      0,
      Number(meta.creatorLateCancelCount || base.creatorLateCancelCount)
    ),
    recentCreatorCancelTimestamps: Array.isArray(meta.recentCreatorCancelTimestamps)
      ? meta.recentCreatorCancelTimestamps
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .slice(-10)
      : [],
    lastPenaltyAt: String(meta.lastPenaltyAt || base.lastPenaltyAt).trim(),
    lastPenaltyReason: String(meta.lastPenaltyReason || base.lastPenaltyReason).trim(),
    lastCancelWindowHours: Math.max(
      0,
      Number(meta.lastCancelWindowHours || base.lastCancelWindowHours)
    ),
  };
}

function getBeijingDaySerial(value) {
  const timestamp = new Date(value || '').getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 0;
  }
  return Math.floor((timestamp + BEIJING_OFFSET_MS) / DAY_MS);
}

function computeReputationRecovery(meta = {}, now = Date.now()) {
  const reputationMeta = normalizeReputationMeta(meta);
  const lastPenaltyAt = String(reputationMeta.lastPenaltyAt || '').trim();
  if (!lastPenaltyAt) {
    return 0;
  }

  const todaySerial = getBeijingDaySerial(now);
  const penaltyDaySerial = getBeijingDaySerial(lastPenaltyAt);
  if (!todaySerial || !penaltyDaySerial || todaySerial <= penaltyDaySerial) {
    return 0;
  }

  const elapsedDays = todaySerial - penaltyDaySerial;
  const firstStage = Math.min(elapsedDays, 5);
  const secondStage = Math.min(Math.max(elapsedDays - 5, 0), 5) * 2;
  const thirdStage = Math.max(elapsedDays - 10, 0) * 5;
  return firstStage + secondStage + thirdStage;
}

function computeReputationScore(profile = {}, totalPlayCount = 0) {
  const cancelPenalty = Math.max(0, Number(profile.cancelCount || 0)) * 6;
  const reputationMeta = normalizeReputationMeta(profile.reputationMeta || {});
  const recovery = computeReputationRecovery(reputationMeta);
  return Math.max(
    0,
    Math.min(100, 100 - cancelPenalty - reputationMeta.penaltyTotal + recovery)
  );
}

function getReputationTier(score = 100) {
  const value = Math.max(0, Math.min(100, Number(score || 0)));
  if (value >= 80) {
    return { key: 'normal', label: '正常', restrictionText: '正常用户，无额外限制' };
  }
  if (value >= 60) {
    return { key: 'warning', label: '警示', restrictionText: '加入组队时会显示警示标签' };
  }
  if (value >= 40) {
    return { key: 'no_create', label: '限制创建', restrictionText: '当前不能发起新队伍，但仍可加入' };
  }
  if (value >= 20) {
    return {
      key: 'manual_review',
      label: '待审批',
      restrictionText: '加入新队伍需要房主或门店人工审批',
    };
  }
  return { key: 'blocked', label: '已封禁', restrictionText: '当前功能已冻结，请联系门店处理' };
}

const BADGE_RULES = [
  {
    key: 'badge-first-step',
    name: '踏入者',
    description: '完成你的第一场冒险即可解锁',
    unlockedDescription: '你迈出了第一步，世界的门已经为你打开。',
    check: (stats) => stats.totalPlayCount >= 1,
  },
  {
    key: 'badge-rookie',
    name: '见习探员',
    description: '累计完成 3 场密室即可解锁',
    unlockedDescription: '三场历练，你已不再是新人。',
    check: (stats) => stats.totalPlayCount >= 3,
  },
  {
    key: 'badge-explorer',
    name: '迷宫猎手',
    description: '累计完成 5 场密室即可解锁',
    unlockedDescription: '五场冒险，你的名字开始在密室圈子里流传。',
    check: (stats) => stats.totalPlayCount >= 5,
  },
  {
    key: 'badge-veteran',
    name: '老炮儿',
    description: '累计完成 10 场密室即可解锁',
    unlockedDescription: '十场磨砺，你用经验换来了这枚勋章。',
    check: (stats) => stats.totalPlayCount >= 10,
  },
  {
    key: 'badge-master',
    name: '殿堂级玩家',
    description: '累计完成 20 场密室即可解锁',
    unlockedDescription: '二十场沉浮，你已是这个圈子里真正的老手。',
    check: (stats) => stats.totalPlayCount >= 20,
  },
  {
    key: 'badge-archivist',
    name: '档案编年者',
    description: '累计完成 40 场密室即可解锁',
    unlockedDescription: '三十场之后，你的经历已经可以写成一整本档案。',
    check: (stats) => stats.totalPlayCount >= 40,
  },
  {
    key: 'badge-everlasting',
    name: '不眠馆藏',
    description: '累计完成 90 场密室即可解锁',
    unlockedDescription: '能走到这里的人很少，你已经成了门店记忆的一部分。',
    check: (stats) => stats.totalPlayCount >= 90,
  },
  {
    key: 'badge-theme-tonglingren',
    name: '瞳界先行者',
    description: '完成【瞳灵人】主题即可解锁',
    unlockedDescription: '你是第一批凝视那双瞳孔的人，它也凝视了你。',
    check: (stats) => hasTheme(stats, 'theme-tonglingren'),
  },
  {
    key: 'badge-theme-wenchuan',
    name: '文川记忆者',
    description: '完成【文川】主题即可解锁',
    unlockedDescription: '那段历史被你亲历，无论结局如何，你都不会忘记。',
    check: (stats) => hasTheme(stats, 'theme-wenchuanzhongxue'),
  },
  {
    key: 'badge-theme-shixiong',
    name: '尸兄不散',
    description: '完成【尸兄】主题即可解锁',
    unlockedDescription: '你们找到了彼此，也找到了答案',
    check: (stats) => hasTheme(stats, 'theme-shixiong'),
  },
  {
    key: 'badge-theme-yixueyuan',
    name: '白色迷途',
    description: '完成【医学院】主题即可解锁',
    unlockedDescription: '走出那条走廊，你才知道自己有多勇敢',
    check: (stats) => hasTheme(stats, 'theme-yixueyuan'),
  },
  {
    key: 'badge-theme-jishengchong',
    name: '共生体验者',
    description: '完成【寄生虫】主题即可解锁',
    unlockedDescription: '与它共存，然后逃脱 你做到了',
    check: (stats) => hasTheme(stats, 'theme-jishengchong'),
  },
  {
    key: 'badge-theme-all',
    name: '全图鉴',
    description: '门店全部主题各至少完成一次即可解锁',
    unlockedDescription: '这家门店的每一个世界，都曾留下你的足迹',
    check: (stats) => stats.allStoreThemesCompleted,
  },
  {
    key: 'badge-theme-triple',
    name: '世界漫游者',
    description: '累计完成 5 场，且体验 3 个不同主题即可解锁',
    unlockedDescription: '你已经开始主动离开熟悉区域，去看更多世界。',
    check: (stats) => stats.uniqueThemeCount >= 3 && stats.totalPlayCount >= 5,
  },
  {
    key: 'badge-theme-quintet',
    name: '图鉴拓荒者',
    description: '累计完成 14 场，且体验 5 个不同主题即可解锁',
    unlockedDescription: '五个世界都留下过你的身影，这不是偶然，是习惯。',
    check: (stats) => stats.uniqueThemeCount >= 5 && stats.totalPlayCount >= 14,
  },
  {
    key: 'badge-first-captain',
    name: '初代队长',
    description: '第一次作为发起人成功成团即可解锁',
    unlockedDescription: '你召集了这支队伍，你是他们信任的那个人。',
    check: (stats) => stats.creatorFullGroupCount >= 1,
  },
  {
    key: 'badge-captain-x5',
    name: '老队长',
    description: '作为发起人成功成团 5 次即可解锁',
    unlockedDescription: '五次集结，每次都不让队友失望。',
    check: (stats) => stats.creatorFullGroupCount >= 5,
  },
  {
    key: 'badge-captain-x10',
    name: '集结核心',
    description: '累计完成 45 场，且作为发起人成功成团 10 次即可解锁',
    unlockedDescription: '十次成团之后，大家已经习惯等你发起那条消息。',
    check: (stats) => stats.creatorFullGroupCount >= 10 && stats.totalPlayCount >= 45,
  },
  {
    key: 'badge-social-butterfly',
    name: '交际花',
    description: '和 10 个不同的玩家并肩完成冒险即可解锁',
    unlockedDescription: '每一个并肩的人，都是独一份的缘分。',
    check: (stats) => stats.distinctTeammateCount >= 10,
  },
  {
    key: 'badge-social-circle',
    name: '人脉星图',
    description: '累计完成 30 场，且和 20 个不同的玩家并肩完成冒险即可解锁',
    unlockedDescription: '你不只是认识很多人，你已经在圈子里织出一张地图。',
    check: (stats) => stats.distinctTeammateCount >= 20 && stats.totalPlayCount >= 30,
  },
  {
    key: 'badge-bring-newbie',
    name: '带飞导师',
    description: '带至少 1 名首次参与的玩家完成组局即可解锁',
    unlockedDescription: '你把这个世界介绍给了别人，也许改变了他们的一部分。',
    check: (stats) => stats.newbieCarryCount >= 1,
  },
  {
    key: 'badge-bring-newbie-x3',
    name: '引路前辈',
    description: '累计完成 28 场，且带至少 3 名首次参与的玩家完成组局即可解锁',
    unlockedDescription: '你不只带过一次新人，你已经是很多人入坑的第一扇门。',
    check: (stats) => stats.newbieCarryCount >= 3 && stats.totalPlayCount >= 28,
  },
  {
    key: 'badge-squad-locked',
    name: '铁三角',
    description: '和固定队友组合完成 3 场冒险即可解锁',
    unlockedDescription: '默契不是天生的，是一场一场磨出来的。',
    check: (stats) => stats.maxTeamRepeatCount >= 3,
  },
  {
    key: 'badge-squad-core',
    name: '默契核心',
    description: '累计完成 36 场，且和固定队友组合完成 5 场冒险即可解锁',
    unlockedDescription: '你们已经不用解释太多，一个眼神就知道下一步该做什么。',
    check: (stats) => stats.maxTeamRepeatCount >= 5 && stats.totalPlayCount >= 36,
  },
  {
    key: 'badge-solo-warrior',
    name: '孤胆英雄',
    description: '完成一场仅 2 人的满员组局即可解锁',
    unlockedDescription: '人少不是理由，你证明了这一点。',
    check: (stats) => stats.duoFullHouseCount >= 1,
  },
  {
    key: 'badge-full-house',
    name: '满堂彩',
    description: '参与一场满员组局即可解锁',
    unlockedDescription: '那一晚整个房间都是人声，所有人都在为同一件事努力。',
    check: (stats) => stats.fullHouseCount >= 1,
  },
  {
    key: 'badge-full-house-x5',
    name: '满堂常客',
    description: '累计完成 34 场，且累计参与 5 场满员组局即可解锁',
    unlockedDescription: '满员对你来说已经不是偶然，而是常态。',
    check: (stats) => stats.fullHouseCount >= 5 && stats.totalPlayCount >= 34,
  },
  {
    key: 'badge-night-owl',
    name: '深夜特工',
    description: '完成一场夜间 21 点后开始的组局即可解锁',
    unlockedDescription: '夜越深，游戏越真实。',
    check: (stats) => stats.lateNight21Count >= 1,
  },
  {
    key: 'badge-night-owl-x3',
    name: '夜巡者',
    description: '累计完成 35 场，且完成 3 场夜间 21 点后开始的组局即可解锁',
    unlockedDescription: '深夜不是偶发的情绪，而是你固定出现的时间段。',
    check: (stats) => stats.lateNight21Count >= 3 && stats.totalPlayCount >= 35,
  },
  {
    key: 'badge-weekend-warrior',
    name: '周末战士',
    description: '连续两周在周末各完成一场冒险即可解锁',
    unlockedDescription: '你把周末留给了最值得的事。',
    check: (stats) => stats.consecutiveWeekendWeeks >= 2,
  },
  {
    key: 'badge-weekend-warrior-x4',
    name: '周末驻场',
    description: '累计完成 44 场，且连续四周在周末各完成一场冒险即可解锁',
    unlockedDescription: '别人把周末过成休息，你把周末过成了固定节律。',
    check: (stats) => stats.consecutiveWeekendWeeks >= 4 && stats.totalPlayCount >= 44,
  },
  {
    key: 'badge-streak-3',
    name: '三连闯关',
    description: '连续三周各完成至少一场冒险即可解锁',
    unlockedDescription: '三周不断，这需要真正的热情。',
    check: (stats) => stats.consecutivePlayWeeks >= 3,
  },
  {
    key: 'badge-streak-6',
    name: '半季常驻',
    description: '累计完成 50 场，且连续六周各完成至少一场冒险即可解锁',
    unlockedDescription: '连续六周保持频率，这已经不是临时热情，是生活的一部分。',
    check: (stats) => stats.consecutivePlayWeeks >= 6 && stats.totalPlayCount >= 50,
  },
  {
    key: 'badge-anniversary',
    name: '周年老友',
    description: '距首次参与满 365 天后再次参与即可解锁',
    unlockedDescription: '一年之后，你又回来了。有些东西从未改变',
    check: (stats) => stats.anniversaryCount >= 1,
  },
  {
    key: 'badge-holiday-raider',
    name: '节日突击队',
    description: '在节假日完成一场组局即可解锁',
    unlockedDescription: '别人在放假，你在冒险。',
    check: (stats) => stats.holidayCount >= 1,
  },
  {
    key: 'badge-holiday-raider-x3',
    name: '假日惯犯',
    description: '在节假日完成 3 场组局即可解锁',
    unlockedDescription: '节日对你来说不是休息，而是另一个更适合开局的时段。',
    check: (stats) => stats.holidayCount >= 3,
  },
  {
    key: 'badge-reliable',
    name: '靠谱的人',
    description: '信誉分保持 90 分以上且完成 5 场冒险即可解锁',
    unlockedDescription: '每次说到做到，队友都记得你的名字。',
    check: (stats) => stats.reputationScore >= 90 && stats.totalPlayCount >= 5,
  },
  {
    key: 'badge-reliable-elite',
    name: '稳定核心',
    description: '信誉分保持 95 分以上且累计完成 32 场冒险即可解锁',
    unlockedDescription: '能长期保持稳定，比一时热情更难得，你已经做到了。',
    check: (stats) => stats.reputationScore >= 95 && stats.totalPlayCount >= 32,
  },
  {
    key: 'badge-comeback',
    name: '归来者',
    description: '沉寂两个月后重返密室即可解锁',
    unlockedDescription: '消失了一段时间，但你终究还是回来了。',
    check: (stats) => stats.comebackCount >= 1,
  },
  {
    key: 'badge-comeback-x2',
    name: '再归档者',
    description: '累计完成 52 场，且沉寂两个月后重返密室 2 次即可解锁',
    unlockedDescription: '你不是偶尔回来看看，而是总会在某个时刻重新回到这里。',
    check: (stats) => stats.comebackCount >= 2 && stats.totalPlayCount >= 52,
  },
  {
    key: 'badge-wishlist-3',
    name: '有备而来',
    description: '在心愿单中加入 3 个想挑战的主题即可解锁',
    unlockedDescription: '有目标的人，走得更远',
    check: (stats) => stats.wishlistCount >= 3,
  },
  {
    key: 'badge-wishlist-done',
    name: '愿望达成',
    description: '完成一个你曾标记“想玩”的主题即可解锁',
    unlockedDescription: '你曾经许下的愿望，自己兑现了',
    check: (stats) => stats.wishlistDoneCount >= 1,
  },
  {
    key: 'badge-challenge-finisher',
    name: '任务完成者',
    description: '完成一项挑战任务即可解锁',
    unlockedDescription: '目标定下，就一定要做到。',
    check: (stats) => stats.challengeFinishedCount >= 1,
  },
  {
    key: 'badge-challenge-double',
    name: '持续达成者',
    description: '累计完成 54 场，且完成两项挑战任务即可解锁',
    unlockedDescription: '不是碰巧完成了一次，而是把目标真的一个个落地。',
    check: (stats) => stats.challengeFinishedCount >= 2 && stats.totalPlayCount >= 54,
  },
  {
    key: 'badge-all-challenges',
    name: '全勤挑战者',
    description: '完成当期全部挑战任务即可解锁',
    unlockedDescription: '这期没有一项任务难住你，你拿满了。',
    check: (stats) => stats.allChallengesComplete,
  },
  {
    key: 'badge-month-sprint',
    name: '本月高频档案',
    description: '累计完成 18 场，且 30 天内完成 5 场真实体验即可解锁',
    unlockedDescription: '你最近的出勤频率，已经让档案更新速度明显快过别人。',
    check: (stats) => stats.last30DaysCount >= 5 && stats.totalPlayCount >= 18,
  },
  {
    key: 'badge-year-round',
    name: '四季玩家',
    description: '累计完成 36 场，且 365 天内完成 12 场真实体验即可解锁',
    unlockedDescription: '不是某个阶段的一时上头，而是跨季节的稳定热爱。',
    check: (stats) => stats.last365DaysCount >= 12 && stats.totalPlayCount >= 36,
  },
  {
    key: 'badge-secret-first-day',
    name: '元老',
    description: '隐藏徽章，条件未知',
    unlockedDescription: '你在最开始就在这里了，是这里的第一批见证者',
    hidden: true,
    check: (stats) => stats.joinedDuringOpeningWindow,
  },
  {
    key: 'badge-unlucky',
    name: '运气不太好',
    description: '隐藏徽章，条件未知',
    unlockedDescription: '输了也要记录。这也是冒险的一部分。',
    hidden: true,
    check: (stats) => stats.failedEscapeCount >= 1,
  },
  {
    key: 'badge-unlucky-x2',
    name: '百折不回',
    description: '隐藏徽章，条件未知',
    unlockedDescription: '连续吃过亏的人才更懂得下一次胜利为什么值得记住。',
    hidden: true,
    check: (stats) => stats.failedEscapeCount >= 2 && stats.totalPlayCount >= 27,
  },
  {
    key: 'badge-speed-runner',
    name: '极速闯关',
    description: '隐藏徽章，条件未知',
    unlockedDescription: '比任何人都快，今天是你的最快纪录。',
    hidden: true,
    check: (stats) => stats.fastestRunCount >= 1,
  },
  {
    key: 'badge-midnight',
    name: '子夜行者',
    description: '隐藏徽章，条件未知',
    unlockedDescription: '快零点了，你们还没打算回家。',
    hidden: true,
    check: (stats) => stats.deepNight23Count >= 1,
  },
  {
    key: 'badge-repeat-theme',
    name: '执念',
    description: '隐藏徽章，条件未知',
    unlockedDescription: '三次回到同一个地方，你在这里寻找什么？',
    hidden: true,
    check: (stats) => stats.maxRepeatThemeCount >= 3,
  },
  {
    key: 'badge-repeat-theme-x5',
    name: '回廊执念',
    description: '隐藏徽章，条件未知',
    unlockedDescription: '五次回到同一主题，已经不是重温，而是一种执着。',
    hidden: true,
    check: (stats) => stats.maxRepeatThemeCount >= 5 && stats.totalPlayCount >= 48,
  },
  {
    key: 'badge-sharer',
    name: '传道者',
    description: '隐藏徽章，条件未知',
    unlockedDescription: '你愿意把这件事告诉别人，说明它对你真的有意义。',
    hidden: true,
    check: (stats) => stats.shareCount >= 3,
  },
  {
    key: 'badge-loudspeaker',
    name: '扩音器',
    description: '隐藏徽章，条件未知',
    unlockedDescription: '你不只是偶尔分享，而是在反复把自己的热爱向外扩散。',
    hidden: true,
    check: (stats) => stats.shareCount >= 5,
  },
  {
    key: 'badge-legend',
    name: '传说',
    description: '累计完成 50 场密室即可解锁',
    unlockedDescription: '五十场，这是一段很少有人能走完的旅程。',
    check: (stats) => stats.totalPlayCount >= 50,
  },
];

function getPlayRecords(profile = {}) {
  if (Array.isArray(profile.punchRecords) && profile.punchRecords.length) {
    return profile.punchRecords;
  }
  if (Array.isArray(profile.playRecords) && profile.playRecords.length) {
    return profile.playRecords;
  }
  if (Array.isArray(profile.punchRecords)) {
    return profile.punchRecords;
  }
  return [];
}

function normalizeThemeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getRecordTimestamp(record = {}) {
  const rawValue =
    record.startedAt || record.endedAt || record.punchedAt || record.playedAt || record.updatedAt || 0;
  const timestamp = new Date(rawValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildGrowthBreakdown(playRecords = []) {
  const breakdownMap = {
    base: { key: 'base', label: '基础通关', note: '每完成一场真实体验 +18', total: 0, count: 0 },
    uniqueTheme: {
      key: 'uniqueTheme',
      label: '新主题首通',
      note: '首次完成一个新主题额外 +10',
      total: 0,
      count: 0,
    },
    replayTheme: {
      key: 'replayTheme',
      label: '主题复刷',
      note: '重复体验同主题额外 +4',
      total: 0,
      count: 0,
    },
    fullHouse: {
      key: 'fullHouse',
      label: '满员协作',
      note: '满员组局额外 +6',
      total: 0,
      count: 0,
    },
    creator: {
      key: 'creator',
      label: '发起组局',
      note: '作为发起人完成场次额外 +8',
      total: 0,
      count: 0,
    },
    weekend: {
      key: 'weekend',
      label: '周末出勤',
      note: '周末完成场次额外 +3',
      total: 0,
      count: 0,
    },
    night: {
      key: 'night',
      label: '夜场挑战',
      note: '21:00 后开场 +3，23:00 后额外按 +5 记',
      total: 0,
      count: 0,
    },
    horror: {
      key: 'horror',
      label: '高惊吓挑战',
      note: '中恐 +2，重恐 +4',
      total: 0,
      count: 0,
    },
    holiday: {
      key: 'holiday',
      label: '节日出勤',
      note: '节假日完成场次额外 +4',
      total: 0,
      count: 0,
    },
    newbie: {
      key: 'newbie',
      label: '带新体验',
      note: '带新玩家完成场次额外 +6',
      total: 0,
      count: 0,
    },
  };
  const themeSeenSet = new Set();

  playRecords.forEach((record) => {
    breakdownMap.base.total += 18;
    breakdownMap.base.count += 1;

    const themeToken = normalizeThemeToken(record.themeId || record.themeName);
    if (themeToken && !themeSeenSet.has(themeToken)) {
      themeSeenSet.add(themeToken);
      breakdownMap.uniqueTheme.total += 10;
      breakdownMap.uniqueTheme.count += 1;
    } else if (themeToken) {
      breakdownMap.replayTheme.total += 4;
      breakdownMap.replayTheme.count += 1;
    }

    const teamSize = Number(record.teamSize || 0);
    const maxTeamSize = Number(record.maxTeamSize || record.teamSize || 0);
    const isFullHouse =
      Boolean(record.isFullHouse) || (maxTeamSize > 0 && teamSize > 0 && teamSize >= maxTeamSize);
    if (isFullHouse) {
      breakdownMap.fullHouse.total += 6;
      breakdownMap.fullHouse.count += 1;
    }

    if (record.wasCreator) {
      breakdownMap.creator.total += 8;
      breakdownMap.creator.count += 1;
    }

    const timestamp = getRecordTimestamp(record);
    if (timestamp) {
      const date = new Date(timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      if (day === 0 || day === 6) {
        breakdownMap.weekend.total += 3;
        breakdownMap.weekend.count += 1;
      }
      if (hour >= 21 || record.lateNight) {
        breakdownMap.night.total += hour >= 23 ? 5 : 3;
        breakdownMap.night.count += 1;
      }
      if (isHolidayRecord(record, timestamp)) {
        breakdownMap.holiday.total += 4;
        breakdownMap.holiday.count += 1;
      }
    }

    const horror = String(record.horror || '').trim();
    if (horror === '中恐') {
      breakdownMap.horror.total += 2;
      breakdownMap.horror.count += 1;
    } else if (horror === '重恐') {
      breakdownMap.horror.total += 4;
      breakdownMap.horror.count += 1;
    }

    if (record.broughtNewbie || Number(record.newbieCount || 0) > 0) {
      breakdownMap.newbie.total += 6;
      breakdownMap.newbie.count += 1;
    }
  });

  const breakdownList = Object.values(breakdownMap)
    .filter((item) => item.total > 0)
    .sort((left, right) => right.total - left.total);
  const totalGrowth = breakdownList.reduce((sum, item) => sum + item.total, 0);
  return {
    totalGrowth,
    breakdownList,
  };
}

function buildGrowthTimeline(playRecords = []) {
  const sortedRecords = playRecords
    .slice()
    .sort((left, right) => getRecordTimestamp(left) - getRecordTimestamp(right));
  const seenThemeSet = new Set();

  return sortedRecords
    .map((record, index) => {
      let total = 18;
      const notes = ['基础 +18'];
      const themeToken = normalizeThemeToken(record.themeId || record.themeName);
      if (themeToken && !seenThemeSet.has(themeToken)) {
        seenThemeSet.add(themeToken);
        total += 10;
        notes.push('首通 +10');
      } else if (themeToken) {
        total += 4;
        notes.push('复刷 +4');
      }

      const teamSize = Number(record.teamSize || 0);
      const maxTeamSize = Number(record.maxTeamSize || record.teamSize || 0);
      const isFullHouse =
        Boolean(record.isFullHouse) || (maxTeamSize > 0 && teamSize > 0 && teamSize >= maxTeamSize);
      if (isFullHouse) {
        total += 6;
        notes.push('满员 +6');
      }
      if (record.wasCreator) {
        total += 8;
        notes.push('发起 +8');
      }

      const timestamp = getRecordTimestamp(record);
      if (timestamp) {
        const date = new Date(timestamp);
        const hour = date.getHours();
        const day = date.getDay();
        if (day === 0 || day === 6) {
          total += 3;
          notes.push('周末 +3');
        }
        if (hour >= 23) {
          total += 5;
          notes.push('子夜 +5');
        } else if (hour >= 21 || record.lateNight) {
          total += 3;
          notes.push('夜场 +3');
        }
        if (isHolidayRecord(record, timestamp)) {
          total += 4;
          notes.push('节日 +4');
        }
      }

      const horror = String(record.horror || '').trim();
      if (horror === '中恐') {
        total += 2;
        notes.push('中恐 +2');
      } else if (horror === '重恐') {
        total += 4;
        notes.push('重恐 +4');
      }

      if (record.broughtNewbie || Number(record.newbieCount || 0) > 0) {
        total += 6;
        notes.push('带新 +6');
      }

      return {
        key: record.recordId || `growth-${index}`,
        total,
        themeName: String(record.themeName || '未知主题').trim() || '未知主题',
        dateText: String(record.punchedAt || record.playedAt || record.endedAt || record.startedAt || '')
          .replace('T', ' ')
          .slice(0, 16),
        noteText: notes.slice(0, 3).join(' · '),
        timestamp,
      };
    })
    .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0));
}

function getWeekIndex(timestamp) {
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return Math.floor(date.getTime() / (7 * DAY_MS));
}

function getMaxConsecutiveCount(values = []) {
  const sorted = Array.from(new Set(values.filter((item) => Number.isFinite(item)))).sort(
    (left, right) => left - right
  );
  let max = 0;
  let current = 0;
  let previous = null;

  sorted.forEach((value) => {
    if (previous === null || value !== previous + 1) {
      current = 1;
    } else {
      current += 1;
    }
    max = Math.max(max, current);
    previous = value;
  });

  return max;
}

function buildThemeTokenSet(records = []) {
  const tokenSet = new Set();
  records.forEach((item) => {
    [item.themeId, item.themeName].forEach((value) => {
      const token = normalizeThemeToken(value);
      if (token) {
        tokenSet.add(token);
      }
    });
  });
  return tokenSet;
}

function hasTheme(stats = {}, matcherKey = '') {
  const matchers =
    STORE_THEME_MATCHERS.find((item) => item[0] === matcherKey) || [];
  const candidates = Array.isArray(matchers[1]) ? matchers[1] : [];
  return candidates.some((item) => stats.themeTokenSet.has(normalizeThemeToken(item)));
}

function isHolidayRecord(record = {}, timestamp = 0) {
  if (record.holidayTag) {
    return true;
  }
  if (!timestamp) {
    return false;
  }
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 1 && day === 1) {
    return true;
  }
  return month === 10 && day >= 1 && day <= 7;
}

function cloneDefaultProfile() {
  return {
    _id: '',
    nickname: '档案室常客',
    avatarUrl: '',
    avatarFileId: '',
    signature: '先把第一场真实体验写进自己的档案里。',
    gender: 'not_set',
    genderText: '未设置',
    titleLabel: '入局新人',
    honorLabels: [],
    displayLabels: [],
    level: '入局新人',
    totalPlayCount: 0,
    badgeCount: 0,
    growthValue: 0,
    streakDays: 0,
    nextLevelHint: '距离「线索学徒」还差 90 成长值',
    recentThemes: [],
    perks: ['生日月专属福利', '新主题优先报名', '老客夜场券'],
    wishThemes: [],
    contactPhone: '',
    avatarText: '档',
    badges: [],
    redeemedCodes: [],
    punchRecords: [],
    shareStats: {
      shareCount: 0,
    },
    challengeStats: {
      completedCount: 0,
      allCompleted: false,
    },
    badgeSignals: {
      joinedDuringOpeningWindow: false,
      fastestRunCount: 0,
      failedEscapeCount: 0,
    },
    lastPlayedAt: '',
    createdAt: '',
    updatedAt: '',
    cancelCount: 0,
    reputationScore: 100,
    reputationMeta: buildDefaultReputationMeta(),
    growthBreakdown: [],
    growthRecentEvents: [],
    levelBenefits: LEVEL_RULES[0].benefits.slice(),
    nextLevelRemainingGrowth: 90,
    nextLevelTargetGrowth: 90,
    growthProgressPercent: 0,
  };
}

function getSafeNickname(profile = {}) {
  return String(profile.nickname || '').trim() || '新入档玩家';
}

function buildAvatarText(profile = {}) {
  const nickname = getSafeNickname(profile);
  return nickname.slice(0, 1);
}

function buildGenderText(gender) {
  return GENDER_LABELS[gender] || GENDER_LABELS.not_set;
}

function getLevelInfo(growthValue) {
  let current = LEVEL_RULES[0];
  LEVEL_RULES.forEach((rule) => {
    if (Number(growthValue || 0) >= rule.minGrowth) {
      current = rule;
    }
  });
  return current;
}

function buildNextLevelHint(growthValue) {
  const current = getLevelInfo(growthValue);
  if (!current.nextMinGrowth) {
    return '你已经达到当前最高等级，继续体验会累计更多成长值';
  }
  const remain = Math.max(0, Number(current.nextMinGrowth || 0) - Number(growthValue || 0));
  const nextRule = LEVEL_RULES.find((rule) => rule.minGrowth === current.nextMinGrowth);
  return `距离「${nextRule ? nextRule.name : '下一等级'}」还差 ${remain} 成长值`;
}

function normalizeLegacyHonorLabel(label) {
  const normalized = String(label || '').trim();
  if (normalized === '师兄不散') {
    return '尸兄不散';
  }
  return normalized;
}

function buildTitleLabel(profile = {}, stats = {}, badges = []) {
  const rawTitleLabel = normalizeLegacyHonorLabel(profile.titleLabel || '');
  const legacyLevelLabels = ['新客玩家', '沉浸玩家', '进阶会员', '馆藏玩家'];
  if (
    rawTitleLabel &&
    !legacyLevelLabels.includes(rawTitleLabel) &&
    !LEVEL_RULES.some((item) => item.name === rawTitleLabel)
  ) {
    return rawTitleLabel;
  }

  const badgeKeySet = new Set(badges.map((item) => item.key));
  if (badgeKeySet.has('badge-legend')) {
    return '传奇玩家';
  }
  if (badgeKeySet.has('badge-master')) {
    return '殿堂玩家';
  }
  if (badgeKeySet.has('badge-theme-all')) {
    return '全图鉴玩家';
  }
  if (badgeKeySet.has('badge-captain-x5')) {
    return '组局指挥官';
  }
  if (badgeKeySet.has('badge-social-butterfly')) {
    return '社交中心';
  }
  if (stats.uniqueThemeCount >= 3) {
    return '主题探索者';
  }

  return getLevelInfo(stats.growthValue || 0).name;
}

function buildHonorLabels(profile = {}, stats = {}, badges = []) {
  if (Array.isArray(profile.honorLabels) && profile.honorLabels.length) {
    return profile.honorLabels.map(normalizeLegacyHonorLabel).filter(Boolean).slice(0, 3);
  }

  const honors = badges.slice(0, 3).map((item) => normalizeLegacyHonorLabel(item.name));
  if (stats.fullHouseCount >= 1) {
    honors.unshift('拼场常客');
  }
  if (stats.consecutivePlayWeeks >= 3) {
    honors.unshift('本月高频');
  }
  return honors.slice(0, 3);
}

function normalizeDisplayLabels(displayLabels = [], availableLabels = []) {
  const availableSet = new Set(
    (Array.isArray(availableLabels) ? availableLabels : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  );
  const normalized = [];
  (Array.isArray(displayLabels) ? displayLabels : []).forEach((item) => {
    const label = String(item || '').trim();
    if (!label || !availableSet.has(label) || normalized.includes(label)) {
      return;
    }
    normalized.push(label);
  });
  return normalized.slice(0, 3);
}

function buildEditableProfilePatch(payload = {}) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'nickname')) {
    const nickname = String(payload.nickname || '').trim();
    patch.nickname = nickname.slice(0, 12) || '新入档玩家';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'signature')) {
    const signature = String(payload.signature || '').trim();
    patch.signature = signature.slice(0, 40) || '还没有留下签名，等你写下第一句档案备注。';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'gender')) {
    const gender = String(payload.gender || '').trim();
    patch.gender = GENDER_LABELS[gender] ? gender : 'not_set';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'avatarUrl')) {
    patch.avatarUrl = String(payload.avatarUrl || '').trim();
  }
  return patch;
}

function buildProfileMetaPatch(payload = {}) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'displayLabels')) {
    patch.displayLabels = (Array.isArray(payload.displayLabels) ? payload.displayLabels : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index)
      .slice(0, 3);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'wishThemes')) {
    patch.wishThemes = (Array.isArray(payload.wishThemes) ? payload.wishThemes : [])
      .map((item) => wishlistService.normalizeWishTheme(item))
      .filter(Boolean)
      .slice(0, 20);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'shareStats')) {
    const shareStats = payload.shareStats || {};
    patch.shareStats = {
      shareCount: Math.max(0, Number(shareStats.shareCount || 0)),
    };
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'challengeStats')) {
    const challengeStats = payload.challengeStats || {};
    patch.challengeStats = {
      completedCount: Math.max(0, Number(challengeStats.completedCount || 0)),
      allCompleted: Boolean(challengeStats.allCompleted),
    };
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'badgeSignals')) {
    const badgeSignals = payload.badgeSignals || {};
    patch.badgeSignals = {
      joinedDuringOpeningWindow: Boolean(badgeSignals.joinedDuringOpeningWindow),
      fastestRunCount: Math.max(0, Number(badgeSignals.fastestRunCount || 0)),
      failedEscapeCount: Math.max(0, Number(badgeSignals.failedEscapeCount || 0)),
    };
  }
  return patch;
}

function buildProfileSyncPatch(payload = {}) {
  return {
    ...buildEditableProfilePatch(payload),
    ...buildProfileMetaPatch(payload),
  };
}

function buildProfileStats(profile = {}) {
  const playRecords = getPlayRecords(profile);
  const now = Date.now();
  const day30 = 30 * DAY_MS;
  const day365 = 365 * DAY_MS;
  const totalPlayCount = playRecords.length || Number(profile.totalPlayCount || 0);
  const themeKeys = playRecords.map((item) => item.themeId || item.themeName).filter(Boolean);
  const themeTokenSet = buildThemeTokenSet(playRecords);
  const wishThemes = Array.isArray(profile.wishThemes) ? profile.wishThemes : [];
  const wishThemeIdSet = new Set(
    wishThemes
      .map((item) => normalizeThemeToken(item.id || item.themeId))
      .filter(Boolean)
  );

  const themeCountMap = {};
  themeKeys.forEach((key) => {
    themeCountMap[key] = (themeCountMap[key] || 0) + 1;
  });
  const maxRepeatThemeCount = Object.values(themeCountMap).reduce(
    (max, v) => Math.max(max, v),
    0
  );
  const sortedTimestamps = playRecords
    .map((item) => getRecordTimestamp(item))
    .filter((item) => item > 0)
    .sort((left, right) => left - right);
  const weekendWeeks = [];
  const allWeeks = [];
  const teammateSet = new Set();
  const teamKeyCountMap = {};
  let lateNight21Count = 0;
  let deepNight23Count = 0;
  let creatorFullGroupCount = 0;
  let fullHouseCount = 0;
  let duoFullHouseCount = 0;
  let newbieCarryCount = 0;
  let holidayCount = 0;
  let comebackCount = 0;
  let anniversaryCount = 0;
  let failedEscapeCount = 0;
  let fastestRunCount = 0;

  playRecords.forEach((item) => {
    const timestamp = getRecordTimestamp(item);
    const date = timestamp ? new Date(timestamp) : null;
    const hour = date ? date.getHours() : -1;
    const teamSize = Number(item.teamSize || 0);
    const maxTeamSize = Number(item.maxTeamSize || item.teamSize || 0);
    const isFullHouse =
      Boolean(item.isFullHouse) || (maxTeamSize > 0 && teamSize > 0 && teamSize >= maxTeamSize);
    const weekIndex = getWeekIndex(timestamp);

    if (hour >= 21 || item.lateNight) {
      lateNight21Count += 1;
    }
    if (hour >= 23) {
      deepNight23Count += 1;
    }
    if (Number.isFinite(weekIndex)) {
      allWeeks.push(weekIndex);
      const day = date ? date.getDay() : -1;
      if (day === 0 || day === 6) {
        weekendWeeks.push(weekIndex);
      }
    }
    if (isFullHouse) {
      fullHouseCount += 1;
      if (teamSize === 2) {
        duoFullHouseCount += 1;
      }
      if (item.wasCreator) {
        creatorFullGroupCount += 1;
      }
    }
    if (item.broughtNewbie || Number(item.newbieCount || 0) > 0) {
      newbieCarryCount += 1;
    }
    if (isHolidayRecord(item, timestamp)) {
      holidayCount += 1;
    }
    if (item.escaped === false) {
      failedEscapeCount += 1;
    }
    if (item.fastestRun) {
      fastestRunCount += 1;
    }
    const teammateOpenIds = Array.isArray(item.teammateOpenIds) ? item.teammateOpenIds : [];
    const teammateNames = Array.isArray(item.teammateNames) ? item.teammateNames : [];
    teammateOpenIds.forEach((value) => {
      const normalized = String(value || '').trim();
      if (normalized) {
        teammateSet.add(normalized);
      }
    });
    if (!teammateOpenIds.length) {
      teammateNames.forEach((value) => {
        const normalized = String(value || '').trim();
        if (normalized) {
          teammateSet.add(normalized);
        }
      });
    }
    const teamKey = String(item.teamKey || '').trim();
    if (teamKey) {
      teamKeyCountMap[teamKey] = (teamKeyCountMap[teamKey] || 0) + 1;
    }
  });

  for (let index = 1; index < sortedTimestamps.length; index += 1) {
    if (sortedTimestamps[index] - sortedTimestamps[index - 1] >= 60 * DAY_MS) {
      comebackCount += 1;
    }
  }
  if (sortedTimestamps.length >= 2) {
    const firstPlayedAt = sortedTimestamps[0];
    anniversaryCount = sortedTimestamps.some((value) => value - firstPlayedAt >= 365 * DAY_MS)
      ? 1
      : 0;
  }

  const maxTeamRepeatCount = Object.values(teamKeyCountMap).reduce(
    (max, value) => Math.max(max, value),
    0
  );
  const coreChallengeFinishedCount = [
    totalPlayCount >= 3,
    new Set(themeKeys).size >= 3,
    playRecords.filter((item) => Number(item.teamSize || 0) >= 4).length >= 1,
  ].filter(Boolean).length;
  const challengeCompletedCount = Number(
    (profile.challengeStats && profile.challengeStats.completedCount) || coreChallengeFinishedCount
  );
  const allChallengesComplete =
    Boolean(profile.challengeStats && profile.challengeStats.allCompleted) ||
    coreChallengeFinishedCount >= 3;
  const badgeSignals = profile.badgeSignals || {};
  const shareStats = profile.shareStats || {};
  const growthSummary = buildGrowthBreakdown(playRecords);
  const reputationMeta = normalizeReputationMeta(profile.reputationMeta || {});
  const derivedReputationScore = computeReputationScore(profile, totalPlayCount);
  const reputationTier = getReputationTier(derivedReputationScore);

  return {
    totalPlayCount,
    playRecords,
    themeIdSet: new Set(playRecords.map((item) => item.themeId).filter(Boolean)),
    themeNameSet: new Set(playRecords.map((item) => item.themeName).filter(Boolean)),
    themeTokenSet,
    uniqueThemeCount: new Set(themeKeys).size,
    horrorLevelSet: new Set(playRecords.map((item) => item.horror).filter(Boolean)),
    lateNightCount: playRecords.filter((item) => item.lateNight).length,
    lateNight21Count,
    teamPlayCount: playRecords.filter((item) => Number(item.teamSize || 0) >= 4).length,
    duoPlayCount: playRecords.filter((item) => Number(item.teamSize || 0) === 2).length,
    creatorPlayCount: playRecords.filter((item) => item.wasCreator).length,
    creatorFullGroupCount,
    fullHouseCount,
    duoFullHouseCount,
    distinctTeammateCount: teammateSet.size,
    newbieCarryCount,
    maxTeamRepeatCount,
    maxRepeatThemeCount,
    deepNightCount: deepNight23Count,
    deepNight23Count,
    weekendCount: playRecords.filter((item) => {
      const d = new Date(item.punchedAt || item.playedAt || 0);
      const dow = d.getDay();
      return d.getTime() > 0 && (dow === 0 || dow === 6);
    }).length,
    consecutiveWeekendWeeks: getMaxConsecutiveCount(weekendWeeks),
    consecutivePlayWeeks: getMaxConsecutiveCount(allWeeks),
    anniversaryCount,
    holidayCount,
    comebackCount,
    last30DaysCount: playRecords.filter(
      (item) => now - new Date(item.punchedAt || item.playedAt || 0).getTime() <= day30
    ).length,
    last365DaysCount: playRecords.filter(
      (item) => now - new Date(item.punchedAt || item.playedAt || 0).getTime() <= day365
    ).length,
    growthValue: growthSummary.totalGrowth,
    cancelCount: Number(profile.cancelCount || 0),
    reputationMeta,
    reputationScore: derivedReputationScore,
    reputationTierKey: reputationTier.key,
    reputationTierLabel: reputationTier.label,
    reputationRestrictionText: reputationTier.restrictionText,
    wishlistCount: wishThemes.length,
    wishlistDoneCount: Array.from(wishThemeIdSet).filter((item) => themeTokenSet.has(item)).length,
    challengeFinishedCount: challengeCompletedCount,
    allChallengesComplete,
    joinedDuringOpeningWindow: Boolean(badgeSignals.joinedDuringOpeningWindow),
    failedEscapeCount: Math.max(
      failedEscapeCount,
      Number(badgeSignals.failedEscapeCount || 0)
    ),
    fastestRunCount: Math.max(
      fastestRunCount,
      Number(badgeSignals.fastestRunCount || 0)
    ),
    shareCount: Number(shareStats.shareCount || profile.shareCount || 0),
    allStoreThemesCompleted: STORE_THEME_MATCHERS.every((item) =>
      item[1].some((matcher) => themeTokenSet.has(normalizeThemeToken(matcher)))
    ),
  };
}

function getUnlockedBadgesByStats(stats) {
  return BADGE_RULES.filter((rule) => rule.check(stats)).map((rule) => ({
    key: rule.key,
    name: rule.name,
    description: rule.description,
    unlockedDescription: rule.unlockedDescription || rule.description,
  }));
}

function buildBadgeCatalog(stats) {
  const unlockedKeySet = new Set(getUnlockedBadgesByStats(stats).map((item) => item.key));
  return BADGE_RULES.map((rule) => {
    const unlocked = unlockedKeySet.has(rule.key);
    return {
      key: rule.key,
      name: rule.name,
      description: rule.description,
      unlockedDescription: rule.unlockedDescription || rule.description,
      unlocked,
    };
  });
}

function normalizeBadgeItem(item = {}, fallbackUnlocked = false) {
  const key = String(item.key || '').trim();
  if (!key) {
    return null;
  }
  return {
    key,
    name: String(item.name || '').trim() || '未命名徽章',
    description: String(item.description || '').trim() || '解锁条件待补充',
    unlockedDescription:
      String(item.unlockedDescription || item.description || '').trim() || '解锁条件待补充',
    unlocked:
      typeof item.unlocked === 'boolean' ? item.unlocked : Boolean(fallbackUnlocked),
  };
}

function resolveBadgeState(profile = {}, stats = {}) {
  const derivedBadges = getUnlockedBadgesByStats(stats);
  const derivedBadgeCatalog = buildBadgeCatalog(stats);
  const serverBadges = Array.isArray(profile.badges)
    ? profile.badges.map((item) => normalizeBadgeItem(item, true)).filter(Boolean)
    : [];
  const serverBadgeCatalog = Array.isArray(profile.badgeCatalog)
    ? profile.badgeCatalog.map((item) => normalizeBadgeItem(item)).filter(Boolean)
    : [];

  if (!serverBadges.length && !serverBadgeCatalog.length) {
    return {
      badges: derivedBadges,
      badgeCatalog: derivedBadgeCatalog,
      badgeCount: derivedBadges.length,
    };
  }

  const unlockedKeySet = new Set(
    serverBadges
      .filter((item) => item.unlocked !== false)
      .map((item) => item.key)
  );

  const normalizedBadgeCatalog = serverBadgeCatalog.length
    ? serverBadgeCatalog.map((item) => ({
        ...item,
        unlocked: item.unlocked || unlockedKeySet.has(item.key),
      }))
    : derivedBadgeCatalog.map((item) => ({
        ...item,
        unlocked: unlockedKeySet.has(item.key),
      }));

  const normalizedBadges = normalizedBadgeCatalog.length
    ? normalizedBadgeCatalog.filter((item) => item.unlocked)
    : serverBadges
        .map((item) => ({
          ...item,
          unlocked: true,
        }))
        .filter((item) => item.unlocked);

  const derivedKeySignature = derivedBadges.map((item) => item.key).join('|');
  const serverKeySignature = normalizedBadges.map((item) => item.key).join('|');
  if (derivedKeySignature && serverKeySignature && derivedKeySignature !== serverKeySignature) {
    console.warn('profile badge state differs from local derived rules, using cloud result', {
      derivedKeys: derivedKeySignature,
      cloudKeys: serverKeySignature,
    });
  }

  return {
    badges: normalizedBadges.map((item) => ({
      key: item.key,
      name: item.name,
      description: item.description,
      unlockedDescription: item.unlockedDescription || item.description,
    })),
    badgeCatalog: normalizedBadgeCatalog.map((item) => ({
      key: item.key,
      name: item.name,
      description: item.description,
      unlockedDescription: item.unlockedDescription || item.description,
      unlocked: Boolean(item.unlocked),
    })),
    badgeCount: normalizedBadgeCatalog.filter((item) => item.unlocked).length,
  };
}

function buildChallengeTasks(stats = {}, badges = []) {
  const badgeCount = Array.isArray(badges) ? badges.length : 0;
  const challengeList = [
    {
      key: 'challenge-month-sprint',
      name: '本月三场冲刺',
      description: '30 天内完成 3 场真实体验，形成回访节奏。',
      current: Number(stats.last30DaysCount || 0),
      target: 3,
    },
    {
      key: 'challenge-theme-explorer',
      name: '主题探索者',
      description: '累计体验 3 个不同主题，别总在同一个舒适区打转。',
      current: Number(stats.uniqueThemeCount || 0),
      target: 3,
    },
    {
      key: 'challenge-team-play',
      name: '组局合流',
      description: '完成 1 场 4 人及以上组队场，解锁多人局体验。',
      current: Number(stats.teamPlayCount || 0),
      target: 1,
    },
    {
      key: 'challenge-badge-up',
      name: '徽章进度推进',
      description: '累计点亮 3 枚徽章，让档案页开始真正丰富起来。',
      current: badgeCount,
      target: 3,
    },
  ];

  return challengeList.map((item) => {
    const current = Math.max(0, Number(item.current || 0));
    const target = Math.max(1, Number(item.target || 1));
    const finished = current >= target;
    const safeCurrent = Math.min(current, target);
    return {
      ...item,
      finished,
      progressText: `${safeCurrent}/${target}`,
      statusText: finished ? '已完成' : `还差 ${target - safeCurrent}`,
      taskClass: finished ? 'challenge-card challenge-card-done' : 'challenge-card',
      progressPercent: Math.max(8, Math.min(100, Math.round((safeCurrent / target) * 100))),
    };
  });
}

function buildDerivedChallengeStats(profile = {}) {
  const normalizedProfile = normalizeProfile(profile);
  const challengeTasks = Array.isArray(normalizedProfile.challengeTasks)
    ? normalizedProfile.challengeTasks
    : [];
  return {
    completedCount: challengeTasks.filter((item) => item.finished).length,
    allCompleted: challengeTasks.length > 0 && challengeTasks.every((item) => item.finished),
  };
}

function normalizeProfile(profile) {
  const baseProfile = {
    ...cloneDefaultProfile(),
    ...profile,
  };
  const wishThemes =
    profile && Object.prototype.hasOwnProperty.call(profile, 'wishThemes')
      ? (Array.isArray(baseProfile.wishThemes) ? baseProfile.wishThemes : [])
      : wishlistService.getThemeWishlist();
  const playRecords = getPlayRecords(baseProfile);
  const totalPlayCount = playRecords.length || Number(baseProfile.totalPlayCount || 0);
  const stats = buildProfileStats({
    ...baseProfile,
    totalPlayCount,
    playRecords,
    wishThemes,
  });
  const growthSummary = buildGrowthBreakdown(playRecords);
  const growthTimeline = buildGrowthTimeline(playRecords);
  const growthValue = growthSummary.totalGrowth;
  const levelInfo = getLevelInfo(growthValue);
  const badgeState = resolveBadgeState(baseProfile, stats);
  const badges = badgeState.badges;
  const badgeCatalog = badgeState.badgeCatalog;
  const nickname = getSafeNickname(baseProfile);
  const gender = GENDER_LABELS[baseProfile.gender] ? baseProfile.gender : 'not_set';
  const titleLabel = buildTitleLabel(baseProfile, stats, badges);
  const honorLabels = buildHonorLabels(baseProfile, stats, badges);
  const availableDisplayLabels = Array.from(
    new Set(honorLabels.filter(Boolean))
  );
  const hasCustomDisplayLabels =
    profile && Object.prototype.hasOwnProperty.call(profile, 'displayLabels');
  const displayLabels = normalizeDisplayLabels(
    hasCustomDisplayLabels ? baseProfile.displayLabels : [],
    availableDisplayLabels
  );
  const signature =
    String(baseProfile.signature || '').trim() || '还没有留下签名，等你写下第一句档案备注。';
  const reputationScore = Number(stats.reputationScore || 0);
  const reputationTierKey = String(stats.reputationTierKey || '').trim();
  const reputationTierLabel = String(stats.reputationTierLabel || '').trim();
  const reputationRestrictionText = String(stats.reputationRestrictionText || '').trim();
  const avatarUrl = String(baseProfile.avatarUrl || '').trim();
  const avatarFileId = String(baseProfile.avatarFileId || '').trim() || (
    avatarUrl.startsWith('cloud://') ? avatarUrl : ''
  );
  const nextLevelTargetGrowth = Number(levelInfo.nextMinGrowth || 0);
  const nextLevelRemainingGrowth = nextLevelTargetGrowth
    ? Math.max(0, nextLevelTargetGrowth - growthValue)
    : 0;
  const growthProgressStart = Number(levelInfo.minGrowth || 0);
  const growthProgressBase = nextLevelTargetGrowth
    ? Math.max(1, nextLevelTargetGrowth - growthProgressStart)
    : 1;
  const growthProgressPercent = nextLevelTargetGrowth
    ? Math.max(
        0,
        Math.min(100, Math.round(((growthValue - growthProgressStart) / growthProgressBase) * 100))
      )
    : 100;
  const nextLevelRule = nextLevelTargetGrowth
    ? LEVEL_RULES.find((rule) => rule.minGrowth === nextLevelTargetGrowth)
    : null;

  return {
    ...baseProfile,
    nickname,
    avatarUrl,
    avatarFileId,
    avatarText: buildAvatarText({ nickname }),
    gender,
    genderText: buildGenderText(gender),
    signature,
    titleLabel,
    honorLabels,
    availableDisplayLabels,
    displayLabels,
    displayLabelList: displayLabels.slice(),
    displayTitleLabel: displayLabels[0] || '',
    displayHonorLabels: displayLabels.slice(1),
    totalPlayCount,
    level: levelInfo.name,
    badgeCount: badgeState.badgeCount,
    growthValue,
    growthBreakdown: growthSummary.breakdownList,
    growthRecentEvents: growthTimeline.slice(0, 3),
    levelBenefits: Array.isArray(levelInfo.benefits) ? levelInfo.benefits.slice() : [],
    nextLevelRemainingGrowth,
    nextLevelTargetGrowth,
    growthProgressPercent,
    nextLevelName: nextLevelRule ? nextLevelRule.name : '',
    badges,
    badgeCatalog,
    challengeTasks: buildChallengeTasks(stats, badges),
    nextLevelHint: buildNextLevelHint(growthValue),
    recentThemes: Array.isArray(baseProfile.recentThemes) ? baseProfile.recentThemes : [],
    wishThemes,
    playRecords,
    cancelCount: stats.cancelCount,
    reputationScore,
    reputationMeta: normalizeReputationMeta(baseProfile.reputationMeta || stats.reputationMeta || {}),
    reputationTierKey,
    reputationTierLabel,
    reputationRestrictionText,
  };
}

function getLocalProfile() {
  const stored = storage.safeGetStorage(storage.PROFILE_STORAGE_KEY);
  if (stored) {
    return normalizeProfile(stored);
  }
  return normalizeProfile(cloneDefaultProfile());
}

function saveLocalProfile(profile) {
  const normalized = normalizeProfile(profile);
  storage.safeSetStorage(storage.PROFILE_STORAGE_KEY, normalized);
  wishlistService.saveThemeWishlist(normalized.wishThemes || []);
  return normalized;
}

function getPendingProfilePatch() {
  const stored = storage.safeGetStorage(storage.PROFILE_SYNC_STORAGE_KEY);
  if (!stored || !stored.pendingPatch) {
    return null;
  }
  return {
    pendingPatch: buildProfileSyncPatch(stored.pendingPatch),
    updatedAt: Number(stored.updatedAt || 0),
  };
}

function savePendingProfilePatch(patch = {}) {
  const pendingPatch = buildProfileSyncPatch(patch);
  storage.safeSetStorage(storage.PROFILE_SYNC_STORAGE_KEY, {
    pendingPatch,
    updatedAt: Date.now(),
  });
  return getPendingProfilePatch();
}

function clearPendingProfilePatch() {
  storage.safeRemoveStorage(storage.PROFILE_SYNC_STORAGE_KEY);
}

function applyEditablePatch(profile = {}, patch = {}) {
  return applyProfileSyncPatch(profile, patch);
}

function applyProfileSyncPatch(profile = {}, patch = {}) {
  const editablePatch = buildEditableProfilePatch(patch);
  const metaPatch = buildProfileMetaPatch(patch);
  return {
    ...profile,
    ...editablePatch,
    ...(Object.prototype.hasOwnProperty.call(metaPatch, 'displayLabels')
      ? { displayLabels: metaPatch.displayLabels }
      : {}),
    ...(metaPatch.wishThemes ? { wishThemes: metaPatch.wishThemes } : {}),
    ...(metaPatch.shareStats
      ? {
          shareStats: {
            ...(profile.shareStats || {}),
            ...metaPatch.shareStats,
          },
        }
      : {}),
    ...(metaPatch.challengeStats
      ? {
          challengeStats: {
            ...(profile.challengeStats || {}),
            ...metaPatch.challengeStats,
          },
        }
      : {}),
    ...(metaPatch.badgeSignals
      ? {
          badgeSignals: {
            ...(profile.badgeSignals || {}),
            ...metaPatch.badgeSignals,
          },
        }
      : {}),
  };
}

function isEditablePatchApplied(profile = {}, patch = {}) {
  const normalizedPatch = buildProfileSyncPatch(patch);
  return Object.keys(normalizedPatch).every((key) => {
    if (key === 'shareStats' || key === 'challengeStats' || key === 'badgeSignals') {
      return JSON.stringify(profile[key] || {}) === JSON.stringify(normalizedPatch[key] || {});
    }
    if (key === 'displayLabels') {
      return JSON.stringify(profile.displayLabels || []) === JSON.stringify(normalizedPatch.displayLabels || []);
    }
    if (key === 'wishThemes') {
      return JSON.stringify(profile.wishThemes || []) === JSON.stringify(normalizedPatch.wishThemes || []);
    }
    return String(profile[key] || '') === String(normalizedPatch[key] || '');
  });
}

function updateLocalProfile(patch = {}) {
  const current = getLocalProfile();
  return saveLocalProfile(applyProfileSyncPatch(current, patch));
}

function buildPlayerCard(player = {}) {
  const normalized = normalizeProfile({
    ...cloneDefaultProfile(),
    ...player,
  });

  return {
    nickname: normalized.nickname,
    avatarUrl: normalized.avatarUrl || '',
    avatarFileId: normalized.avatarFileId || '',
    avatarText: normalized.avatarText,
    signature: normalized.signature,
    gender: normalized.gender,
    genderText: normalized.genderText,
    titleLabel: normalized.titleLabel,
    honorLabels: normalized.honorLabels,
    totalPlayCount: normalized.totalPlayCount,
    badgeCount: normalized.badgeCount,
    growthValue: normalized.growthValue,
    summaryText: `已通关 ${normalized.totalPlayCount} 次 · 点亮 ${normalized.badgeCount} 枚徽章`,
  };
}

function getPlayerCardByNickname(nickname, currentProfile = null) {
  const normalizedNickname = String(nickname || '').trim();
  if (!normalizedNickname) {
    return null;
  }

  const selfProfile = currentProfile || getLocalProfile();
  if (selfProfile && selfProfile.nickname === normalizedNickname) {
    return buildPlayerCard(selfProfile);
  }

  return buildPlayerCard({
    nickname: normalizedNickname,
    honorLabels: ['本场队友'],
    signature: '这位玩家还没有公开更多档案信息。',
  });
}

function buildPlayerCardByIdentity(identity = {}, options = {}) {
  const currentProfile = options.currentProfile || getLocalProfile();
  const profileMap = options.profileMap || {};
  const openId = String(identity.openId || '').trim();
  const nickname = String(identity.nickname || '').trim();
  const currentOpenId = String((currentProfile && currentProfile._id) || '').trim();
  const currentNickname = String((currentProfile && currentProfile.nickname) || '').trim();

  if ((openId && currentOpenId && openId === currentOpenId) || (!openId && nickname && nickname === currentNickname)) {
    return buildPlayerCard({
      ...currentProfile,
      nickname: currentNickname || nickname || '玩家',
    });
  }

  if (openId && profileMap[openId]) {
    return buildPlayerCard({
      ...profileMap[openId],
      _id: openId,
      nickname: profileMap[openId].nickname || nickname || `玩家${openId.slice(-4)}`,
    });
  }

  if (openId) {
    return buildPlayerCard({
      _id: openId,
      nickname: nickname || `玩家${openId.slice(-4)}`,
      honorLabels: ['本场队友'],
      signature: '这位玩家还没有公开更多档案信息。',
    });
  }

  if (nickname) {
    return getPlayerCardByNickname(nickname, currentProfile);
  }

  return buildPlayerCard({
    nickname: openId ? `玩家${openId.slice(-4)}` : '玩家',
    honorLabels: ['本场队友'],
    signature: '这位玩家还没有公开更多档案信息。',
  });
}

module.exports = {
  normalizeProfile,
  getLocalProfile,
  saveLocalProfile,
  getPendingProfilePatch,
  savePendingProfilePatch,
  clearPendingProfilePatch,
  applyEditablePatch,
  isEditablePatchApplied,
  updateLocalProfile,
  cloneDefaultProfile,
  getLevelInfo,
  buildNextLevelHint,
  buildProfileStats,
  getUnlockedBadgesByStats,
  buildBadgeCatalog,
  buildEditableProfilePatch,
  buildProfileMetaPatch,
  buildProfileSyncPatch,
  buildDerivedChallengeStats,
  applyProfileSyncPatch,
  buildPlayerCard,
  buildPlayerCardByIdentity,
  getPlayerCardByNickname,
};
