'use strict';

const GENDER_LABELS = {
  male: '男',
  female: '女',
  not_set: '未设置',
};

const DEFAULT_NICKNAME = '档案室常客';
const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const LEVEL_RULES = [
  { min: 0, name: '新客玩家', nextMin: 3 },
  { min: 3, name: '沉浸玩家', nextMin: 6 },
  { min: 6, name: '进阶会员', nextMin: 10 },
  { min: 10, name: '馆藏玩家', nextMin: null },
];
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
  { key: 'badge-first-step', name: '踏入者', description: '完成你的第一场冒险即可解锁', unlockedDescription: '你迈出了第一步，世界的门已经为你打开。', check: (stats) => stats.totalPlayCount >= 1 },
  { key: 'badge-rookie', name: '见习探员', description: '累计完成 3 场密室即可解锁', unlockedDescription: '三场历练，你已不再是新人。', check: (stats) => stats.totalPlayCount >= 3 },
  { key: 'badge-explorer', name: '迷宫猎手', description: '累计完成 5 场密室即可解锁', unlockedDescription: '五场冒险，你的名字开始在密室圈子里流传。', check: (stats) => stats.totalPlayCount >= 5 },
  { key: 'badge-veteran', name: '老炮儿', description: '累计完成 10 场密室即可解锁', unlockedDescription: '十场磨砺，你用经验换来了这枚勋章。', check: (stats) => stats.totalPlayCount >= 10 },
  { key: 'badge-master', name: '殿堂级玩家', description: '累计完成 20 场密室即可解锁', unlockedDescription: '二十场沉浮，你已是这个圈子里真正的老手。', check: (stats) => stats.totalPlayCount >= 20 },
  { key: 'badge-archivist', name: '档案编年者', description: '累计完成 40 场密室即可解锁', unlockedDescription: '四十场之后，你的经历已经可以写成一整本档案。', check: (stats) => stats.totalPlayCount >= 40 },
  { key: 'badge-everlasting', name: '不眠馆藏', description: '累计完成 90 场密室即可解锁', unlockedDescription: '能走到这里的人很少，你已经成了门店记忆的一部分。', check: (stats) => stats.totalPlayCount >= 90 },
  { key: 'badge-theme-tonglingren', name: '瞳界先行者', description: '完成【瞳灵人】主题即可解锁', unlockedDescription: '你是第一批凝视那双瞳孔的人，它也凝视了你。', check: (stats) => hasTheme(stats, 'theme-tonglingren') },
  { key: 'badge-theme-wenchuan', name: '文川记忆者', description: '完成【文川】主题即可解锁', unlockedDescription: '那段历史被你亲历，无论结局如何，你都不会忘记。', check: (stats) => hasTheme(stats, 'theme-wenchuanzhongxue') },
  { key: 'badge-theme-shixiong', name: '尸兄不散', description: '完成【尸兄】主题即可解锁', unlockedDescription: '你们找到了彼此，也找到了答案。', check: (stats) => hasTheme(stats, 'theme-shixiong') },
  { key: 'badge-theme-yixueyuan', name: '白色迷途', description: '完成【医学院】主题即可解锁', unlockedDescription: '走出那条走廊之后，你才知道自己有多勇敢。', check: (stats) => hasTheme(stats, 'theme-yixueyuan') },
  { key: 'badge-theme-jishengchong', name: '共生体验者', description: '完成【寄生虫】主题即可解锁', unlockedDescription: '与它共存，然后逃脱，你做到了。', check: (stats) => hasTheme(stats, 'theme-jishengchong') },
  { key: 'badge-theme-all', name: '全图鉴', description: '门店全部主题各至少完成一次即可解锁', unlockedDescription: '这家门店的每一个世界，都曾留下你的足迹。', check: (stats) => stats.allStoreThemesCompleted },
  { key: 'badge-theme-triple', name: '世界漫游者', description: '累计完成 5 场，且体验 3 个不同主题即可解锁', unlockedDescription: '你已经开始主动离开熟悉区域，去看更多世界。', check: (stats) => stats.uniqueThemeCount >= 3 && stats.totalPlayCount >= 5 },
  { key: 'badge-theme-fourfold', name: '四界行者', description: '累计完成 9 场，且体验 4 个不同主题即可解锁', unlockedDescription: '四个世界都被你踩过点之后，探索已经变成一种稳定偏好。', check: (stats) => stats.uniqueThemeCount >= 4 && stats.totalPlayCount >= 9 },
  { key: 'badge-theme-quintet', name: '图鉴拓荒者', description: '累计完成 14 场，且体验 5 个不同主题即可解锁', unlockedDescription: '五个世界都留下过你的身影，这不是偶然，是习惯。', check: (stats) => stats.uniqueThemeCount >= 5 && stats.totalPlayCount >= 14 },
  { key: 'badge-first-captain', name: '初代队长', description: '第一次作为发起人成功成团即可解锁', unlockedDescription: '你召集了这支队伍，你是他们信任的那个人。', check: (stats) => stats.creatorFullGroupCount >= 1 },
  { key: 'badge-captain-x3', name: '召集熟手', description: '累计完成 14 场，且作为发起人成功成团 3 次即可解锁', unlockedDescription: '第三次把人稳稳凑齐之后，大家已经默认你会把局攒成。', check: (stats) => stats.creatorFullGroupCount >= 3 && stats.totalPlayCount >= 14 },
  { key: 'badge-captain-x5', name: '老队长', description: '作为发起人成功成团 5 次即可解锁', unlockedDescription: '五次集结，每次都不让队友失望。', check: (stats) => stats.creatorFullGroupCount >= 5 },
  { key: 'badge-captain-x10', name: '集结核心', description: '累计完成 45 场，且作为发起人成功成团 10 次即可解锁', unlockedDescription: '十次成团之后，大家已经习惯等你发起那条消息。', check: (stats) => stats.creatorFullGroupCount >= 10 && stats.totalPlayCount >= 45 },
  { key: 'badge-social-butterfly', name: '交际花', description: '和 10 个不同的玩家并肩完成冒险即可解锁', unlockedDescription: '每一个并肩的人，都是独一份的缘分。', check: (stats) => stats.distinctTeammateCount >= 10 },
  { key: 'badge-social-circle', name: '人脉星图', description: '累计完成 30 场，且和 20 个不同的玩家并肩完成冒险即可解锁', unlockedDescription: '你不只是认识很多人，你已经在圈子里织出一张地图。', check: (stats) => stats.distinctTeammateCount >= 20 && stats.totalPlayCount >= 30 },
  { key: 'badge-social-constellation', name: '熟面孔宇宙', description: '累计完成 55 场，且和 30 个不同的玩家并肩完成冒险即可解锁', unlockedDescription: '三十张不同的面孔汇进同一份档案时，你已经成了圈子里绕不开的那个名字。', check: (stats) => stats.distinctTeammateCount >= 30 && stats.totalPlayCount >= 55 },
  { key: 'badge-bring-newbie', name: '带飞导师', description: '带至少 1 名首次参与的玩家完成组局即可解锁', unlockedDescription: '你把这个世界介绍给了别人，也许改变了他们的一部分。', check: (stats) => stats.newbieCarryCount >= 1 },
  { key: 'badge-bring-newbie-x3', name: '引路前辈', description: '累计完成 28 场，且带至少 3 名首次参与的玩家完成组局即可解锁', unlockedDescription: '你不只带过一次新人，你已经是很多人入坑的第一扇门。', check: (stats) => stats.newbieCarryCount >= 3 && stats.totalPlayCount >= 28 },
  { key: 'badge-bring-newbie-x5', name: '入坑推手', description: '累计完成 45 场，且带至少 5 名首次参与的玩家完成组局即可解锁', unlockedDescription: '你已经不只是带过新人，而是在稳定把更多人推进这个世界。', check: (stats) => stats.newbieCarryCount >= 5 && stats.totalPlayCount >= 45 },
  { key: 'badge-repeat-theme-x2', name: '重返现场', description: '累计完成 9 场，且重复体验同一主题 2 次即可解锁', unlockedDescription: '第二次回到同一个故事里时，你已经开始带着自己的执念重走那条路。', check: (stats) => stats.maxRepeatThemeCount >= 2 && stats.totalPlayCount >= 9 },
  { key: 'badge-squad-locked', name: '铁三角', description: '和固定队友组合完成 3 场冒险即可解锁', unlockedDescription: '默契不是天生的，是一场一场磨出来的。', check: (stats) => stats.maxTeamRepeatCount >= 3 },
  { key: 'badge-squad-core', name: '默契核心', description: '累计完成 36 场，且和固定队友组合完成 5 场冒险即可解锁', unlockedDescription: '你们已经不用解释太多，一个眼神就知道下一步该做什么。', check: (stats) => stats.maxTeamRepeatCount >= 5 && stats.totalPlayCount >= 36 },
  { key: 'badge-solo-warrior', name: '孤胆英雄', description: '完成一场仅 2 人的满员组局即可解锁', unlockedDescription: '人少不是理由，你证明了这一点。', check: (stats) => stats.duoFullHouseCount >= 1 },
  { key: 'badge-duo-play-x3', name: '双人默契', description: '累计完成 16 场，且完成 3 场双人组局即可解锁', unlockedDescription: '两个人打到第三场之后，连紧张和沉默都开始像一种默契。', check: (stats) => stats.duoPlayCount >= 3 && stats.totalPlayCount >= 16 },
  { key: 'badge-full-house', name: '满堂彩', description: '参与一场满员组局即可解锁', unlockedDescription: '那一晚整个房间都是人声，所有人都在为同一件事努力。', check: (stats) => stats.fullHouseCount >= 1 },
  { key: 'badge-full-house-x5', name: '满堂常客', description: '累计完成 34 场，且累计参与 5 场满员组局即可解锁', unlockedDescription: '满员对你来说已经不是偶然，而是常态。', check: (stats) => stats.fullHouseCount >= 5 && stats.totalPlayCount >= 34 },
  { key: 'badge-full-house-x10', name: '满席主场', description: '累计完成 58 场，且累计参与 10 场满员组局即可解锁', unlockedDescription: '十次满员之后，你几乎只会在最热闹的房间里留下记录。', check: (stats) => stats.fullHouseCount >= 10 && stats.totalPlayCount >= 58 },
  { key: 'badge-night-owl', name: '深夜特工', description: '完成一场夜间 21 点后开始的组局即可解锁', unlockedDescription: '夜越深，游戏越真实。', check: (stats) => stats.lateNight21Count >= 1 },
  { key: 'badge-night-owl-x3', name: '夜巡者', description: '累计完成 35 场，且完成 3 场夜间 21 点后开始的组局即可解锁', unlockedDescription: '深夜不是偶发的情绪，而是你固定出现的时间段。', check: (stats) => stats.lateNight21Count >= 3 && stats.totalPlayCount >= 35 },
  { key: 'badge-night-owl-x5', name: '闭馆常客', description: '累计完成 60 场，且完成 5 场夜间 21 点后开始的组局即可解锁', unlockedDescription: '五次深夜入场之后，你已经成为门店闭馆前最常见的那类人。', check: (stats) => stats.lateNight21Count >= 5 && stats.totalPlayCount >= 60 },
  { key: 'badge-weekend-warrior', name: '周末战士', description: '连续两周在周末各完成一场冒险即可解锁', unlockedDescription: '你把周末留给了最值得的事。', check: (stats) => stats.consecutiveWeekendWeeks >= 2 },
  { key: 'badge-weekend-warrior-x4', name: '周末驻场', description: '累计完成 44 场，且连续四周在周末各完成一场冒险即可解锁', unlockedDescription: '别人把周末过成休息，你把周末过成了固定节律。', check: (stats) => stats.consecutiveWeekendWeeks >= 4 && stats.totalPlayCount >= 44 },
  { key: 'badge-weekend-six', name: '周末惯性', description: '累计完成 24 场，且完成 6 场周末冒险即可解锁', unlockedDescription: '周末对你来说已经自带默认安排，像一种长期保留的习惯。', check: (stats) => stats.weekendCount >= 6 && stats.totalPlayCount >= 24 },
  { key: 'badge-streak-3', name: '三连闯关', description: '连续三周各完成至少一场冒险即可解锁', unlockedDescription: '三周不断，这需要真正的热情。', check: (stats) => stats.consecutivePlayWeeks >= 3 },
  { key: 'badge-streak-6', name: '半季常驻', description: '累计完成 50 场，且连续六周各完成至少一场冒险即可解锁', unlockedDescription: '连续六周保持频率，这已经不是临时热情，是生活的一部分。', check: (stats) => stats.consecutivePlayWeeks >= 6 && stats.totalPlayCount >= 50 },
  { key: 'badge-anniversary', name: '周年老友', description: '距首次参与满 365 天后再次参与即可解锁', unlockedDescription: '一年之后，你又回来了。有些东西从未改变。', check: (stats) => stats.anniversaryCount >= 1 },
  { key: 'badge-holiday-raider', name: '节日突击队', description: '在节假日完成一场组局即可解锁', unlockedDescription: '别人在放假，你在冒险。', check: (stats) => stats.holidayCount >= 1 },
  { key: 'badge-holiday-raider-x3', name: '假日惯犯', description: '在节假日完成 3 场组局即可解锁', unlockedDescription: '节日对你来说不是休息，而是另一个更适合开局的时段。', check: (stats) => stats.holidayCount >= 3 },
  { key: 'badge-reliable', name: '靠谱的人', description: '信誉分保持 90 分以上且完成 5 场冒险即可解锁', unlockedDescription: '每次说到做到，队友都记得你的名字。', check: (stats) => stats.reputationScore >= 90 && stats.totalPlayCount >= 5 },
  { key: 'badge-reliable-elite', name: '稳定核心', description: '信誉分保持 95 分以上且累计完成 32 场冒险即可解锁', unlockedDescription: '能长期保持稳定，比一时热情更难得，你已经做到了。', check: (stats) => stats.reputationScore >= 95 && stats.totalPlayCount >= 32 },
  { key: 'badge-comeback', name: '归来者', description: '沉寂两个月后重返密室即可解锁', unlockedDescription: '消失了一段时间，但你终究还是回来了。', check: (stats) => stats.comebackCount >= 1 },
  { key: 'badge-comeback-x2', name: '再归档者', description: '累计完成 52 场，且沉寂两个月后重返密室 2 次即可解锁', unlockedDescription: '你不是偶尔回来看看，而是总会在某个时刻重新回到这里。', check: (stats) => stats.comebackCount >= 2 && stats.totalPlayCount >= 52 },
  { key: 'badge-wishlist-3', name: '组局合流', description: '累计完成 10 场，且完成 3 场 4 人及以上组队场即可解锁', unlockedDescription: '人一多，气氛、分工和失误都会被放大，而你已经开始享受这种复杂度。', check: (stats) => stats.teamPlayCount >= 3 && stats.totalPlayCount >= 10 },
  { key: 'badge-wishlist-done', name: '多人局常客', description: '累计完成 26 场，且完成 6 场 4 人及以上组队场即可解锁', unlockedDescription: '多人局对你来说已经不是偶尔尝试，而是稳定选择。', check: (stats) => stats.teamPlayCount >= 6 && stats.totalPlayCount >= 26 },
  { key: 'badge-challenge-finisher', name: '任务完成者', description: '完成一项挑战任务即可解锁', unlockedDescription: '目标定下，就一定要做到。', check: (stats) => stats.challengeFinishedCount >= 1 },
  { key: 'badge-challenge-double', name: '持续达成者', description: '累计完成 54 场，且完成两项挑战任务即可解锁', unlockedDescription: '不是碰巧完成了一次，而是把目标真的一个个落地。', check: (stats) => stats.challengeFinishedCount >= 2 && stats.totalPlayCount >= 54 },
  { key: 'badge-all-challenges', name: '全勤挑战者', description: '完成当期全部挑战任务即可解锁', unlockedDescription: '这期没有一项任务难住你，你拿满了。', check: (stats) => stats.allChallengesComplete },
  { key: 'badge-month-sprint', name: '本月高频档案', description: '累计完成 18 场，且 30 天内完成 5 场真实体验即可解锁', unlockedDescription: '你最近的出勤频率，已经让档案更新速度明显快过别人。', check: (stats) => stats.last30DaysCount >= 5 && stats.totalPlayCount >= 18 },
  { key: 'badge-month-sprint-x8', name: '本月满档', description: '累计完成 38 场，且 30 天内完成 8 场真实体验即可解锁', unlockedDescription: '这个月的档案更新已经不是频繁，而是几乎没有停过。', check: (stats) => stats.last30DaysCount >= 8 && stats.totalPlayCount >= 38 },
  { key: 'badge-year-round', name: '四季玩家', description: '累计完成 36 场，且 365 天内累计完成 12 场真实体验即可解锁', unlockedDescription: '不是某个阶段的一时上头，而是跨季节的稳定热爱。', check: (stats) => stats.last365DaysCount >= 12 && stats.totalPlayCount >= 36 },
  { key: 'badge-year-round-x24', name: '年度常驻', description: '累计完成 70 场，且 365 天内累计完成 24 场真实体验即可解锁', unlockedDescription: '把一年切成二十四次到店记录之后，这已经不只是爱好，而是生活编排的一部分。', check: (stats) => stats.last365DaysCount >= 24 && stats.totalPlayCount >= 70 },
  { key: 'badge-horror-spectrum', name: '惊吓光谱', description: '累计完成 12 场，且分别完成微恐、中恐、重恐主题各至少一场即可解锁', unlockedDescription: '你已经把不同强度的惊吓都亲自走过一遍，胆量开始有了完整坐标。', check: (stats) => ['微恐', '中恐', '重恐'].every((item) => stats.horrorLevelSet.has(item)) && stats.totalPlayCount >= 12 },
  { key: 'badge-secret-first-day', name: '元老', description: '隐藏徽章，条件未知', unlockedDescription: '你在最开始就在这里了，是这里的第一批见证者。', hidden: true, check: (stats) => stats.joinedDuringOpeningWindow },
  { key: 'badge-unlucky', name: '运气不太好', description: '隐藏徽章，条件未知', unlockedDescription: '输了也要记录，这也是冒险的一部分。', hidden: true, check: (stats) => stats.failedEscapeCount >= 1 },
  { key: 'badge-unlucky-x2', name: '百折不回', description: '隐藏徽章，条件未知', unlockedDescription: '连续吃过亏的人，才更懂得下一次胜利为什么值得记住。', hidden: true, check: (stats) => stats.failedEscapeCount >= 2 && stats.totalPlayCount >= 27 },
  { key: 'badge-speed-runner', name: '极速闯关', description: '隐藏徽章，条件未知', unlockedDescription: '比任何人都快，今天是你的最快纪录。', hidden: true, check: (stats) => stats.fastestRunCount >= 1 },
  { key: 'badge-midnight', name: '子夜行者', description: '隐藏徽章，条件未知', unlockedDescription: '快零点了，你们还没打算回家。', hidden: true, check: (stats) => stats.deepNight23Count >= 1 },
  { key: 'badge-repeat-theme', name: '执念', description: '隐藏徽章，条件未知', unlockedDescription: '三次回到同一个地方，你在这里寻找什么？', hidden: true, check: (stats) => stats.maxRepeatThemeCount >= 3 },
  { key: 'badge-repeat-theme-x5', name: '回廊执念', description: '隐藏徽章，条件未知', unlockedDescription: '五次回到同一主题，已经不是重温，而是一种执着。', hidden: true, check: (stats) => stats.maxRepeatThemeCount >= 5 && stats.totalPlayCount >= 48 },
  { key: 'badge-sharer', name: '传道者', description: '隐藏徽章，条件未知', unlockedDescription: '你愿意把这件事告诉别人，说明它对你真的有意义。', hidden: true, check: (stats) => stats.shareCount >= 3 },
  { key: 'badge-loudspeaker', name: '扩音器', description: '隐藏徽章，条件未知', unlockedDescription: '你不只是偶尔分享，而是在反复把自己的热爱向外扩散。', hidden: true, check: (stats) => stats.shareCount >= 5 },
  { key: 'badge-legend', name: '传说', description: '累计完成 50 场密室即可解锁', unlockedDescription: '五十场，这是一段很少有人能走完的旅程。', check: (stats) => stats.totalPlayCount >= 50 },
];

function normalizeThemeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function getRecordTimestamp(record = {}) {
  const rawValue =
    record.startedAt || record.endedAt || record.punchedAt || record.playedAt || record.updatedAt || 0;
  const timestamp = new Date(rawValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
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
  const matchedItem = STORE_THEME_MATCHERS.find((item) => item[0] === matcherKey);
  const candidates = matchedItem && Array.isArray(matchedItem[1]) ? matchedItem[1] : [];
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

function getLevelInfo(totalPlayCount) {
  let current = LEVEL_RULES[0];
  LEVEL_RULES.forEach((rule) => {
    if (totalPlayCount >= rule.min) {
      current = rule;
    }
  });
  return current;
}

function buildNextLevelHint(totalPlayCount) {
  const current = getLevelInfo(totalPlayCount);
  if (!current.nextMin) {
    return '你已经达到当前最高等级，继续打卡会累计更多主题档案';
  }
  return `再完成 ${current.nextMin - totalPlayCount} 次真实场次打卡即可解锁下一等级`;
}

function buildProfileStats(profile = {}) {
  const punchRecords = Array.isArray(profile.punchRecords) ? profile.punchRecords : [];
  const now = Date.now();
  const day30 = 30 * DAY_MS;
  const day365 = 365 * DAY_MS;
  const totalPlayCount = punchRecords.length || Number(profile.totalPlayCount || 0);
  const themeKeys = punchRecords.map((item) => item.themeId || item.themeName).filter(Boolean);
  const themeTokenSet = buildThemeTokenSet(punchRecords);
  const wishThemes = Array.isArray(profile.wishThemes) ? profile.wishThemes : [];
  const wishThemeIdSet = new Set(
    wishThemes
      .map((item) => normalizeThemeToken(item.id || item.themeId))
      .filter(Boolean)
  );
  const themeCountMap = {};
  const teamKeyCountMap = {};
  const teammateSet = new Set();
  const weekendWeeks = [];
  const allWeeks = [];
  let lateNight21Count = 0;
  let deepNight23Count = 0;
  let creatorFullGroupCount = 0;
  let fullHouseCount = 0;
  let duoFullHouseCount = 0;
  let newbieCarryCount = 0;
  let holidayCount = 0;
  let failedEscapeCount = 0;
  let fastestRunCount = 0;

  themeKeys.forEach((key) => {
    themeCountMap[key] = (themeCountMap[key] || 0) + 1;
  });

  punchRecords.forEach((item) => {
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
    const teamKey = String(item.teamKey || '').trim();
    if (teamKey) {
      teamKeyCountMap[teamKey] = (teamKeyCountMap[teamKey] || 0) + 1;
    }
    const teammateOpenIds = Array.isArray(item.teammateOpenIds) ? item.teammateOpenIds : [];
    const teammateNames = Array.isArray(item.teammateNames) ? item.teammateNames : [];
    teammateOpenIds.forEach((value) => {
      const normalizedValue = String(value || '').trim();
      if (normalizedValue) {
        teammateSet.add(normalizedValue);
      }
    });
    if (!teammateOpenIds.length) {
      teammateNames.forEach((value) => {
        const normalizedValue = String(value || '').trim();
        if (normalizedValue) {
          teammateSet.add(normalizedValue);
        }
      });
    }
  });

  const sortedTimestamps = punchRecords
    .map((item) => getRecordTimestamp(item))
    .filter((item) => item > 0)
    .sort((left, right) => left - right);
  let comebackCount = 0;
  for (let index = 1; index < sortedTimestamps.length; index += 1) {
    if (sortedTimestamps[index] - sortedTimestamps[index - 1] >= 60 * DAY_MS) {
      comebackCount += 1;
    }
  }
  const anniversaryCount =
    sortedTimestamps.length >= 2 &&
    sortedTimestamps.some((item) => item - sortedTimestamps[0] >= 365 * DAY_MS)
      ? 1
      : 0;
  const coreChallengeFinishedCount = [
    totalPlayCount >= 3,
    new Set(themeKeys).size >= 3,
    punchRecords.filter((item) => Number(item.teamSize || 0) >= 4).length >= 1,
  ].filter(Boolean).length;
  const badgeSignals = profile.badgeSignals || {};
  const shareStats = profile.shareStats || {};
  const challengeStats = profile.challengeStats || {};
  const reputationMeta = normalizeReputationMeta(profile.reputationMeta || {});
  const reputationScore = computeReputationScore(profile, totalPlayCount);
  const reputationTier = getReputationTier(reputationScore);

  return {
    totalPlayCount,
    themeIdSet: new Set(punchRecords.map((item) => item.themeId).filter(Boolean)),
    themeNameSet: new Set(punchRecords.map((item) => item.themeName).filter(Boolean)),
    themeTokenSet,
    uniqueThemeCount: new Set(themeKeys).size,
    horrorLevelSet: new Set(punchRecords.map((item) => item.horror).filter(Boolean)),
    lateNightCount: punchRecords.filter((item) => item.lateNight).length,
    lateNight21Count,
    teamPlayCount: punchRecords.filter((item) => Number(item.teamSize || 0) >= 4).length,
    duoPlayCount: punchRecords.filter((item) => Number(item.teamSize || 0) === 2).length,
    creatorPlayCount: punchRecords.filter((item) => item.wasCreator).length,
    creatorFullGroupCount,
    fullHouseCount,
    duoFullHouseCount,
    distinctTeammateCount: teammateSet.size,
    newbieCarryCount,
    maxTeamRepeatCount: Object.values(teamKeyCountMap).reduce((max, value) => Math.max(max, value), 0),
    maxRepeatThemeCount: Object.values(themeCountMap).reduce((max, value) => Math.max(max, value), 0),
    deepNightCount: deepNight23Count,
    deepNight23Count,
    weekendCount: punchRecords.filter((item) => {
      const timestamp = getRecordTimestamp(item);
      if (!timestamp) return false;
      const day = new Date(timestamp).getDay();
      return day === 0 || day === 6;
    }).length,
    consecutiveWeekendWeeks: getMaxConsecutiveCount(weekendWeeks),
    consecutivePlayWeeks: getMaxConsecutiveCount(allWeeks),
    anniversaryCount,
    holidayCount,
    comebackCount,
    last30DaysCount: punchRecords.filter((item) => now - getRecordTimestamp(item) <= day30).length,
    last365DaysCount: punchRecords.filter((item) => now - getRecordTimestamp(item) <= day365).length,
    cancelCount: Number(profile.cancelCount || 0),
    reputationMeta,
    reputationScore,
    reputationTierKey: reputationTier.key,
    reputationTierLabel: reputationTier.label,
    reputationRestrictionText: reputationTier.restrictionText,
    wishlistCount: wishThemes.length,
    wishlistDoneCount: Array.from(wishThemeIdSet).filter((item) => themeTokenSet.has(item)).length,
    challengeFinishedCount: Number(challengeStats.completedCount || coreChallengeFinishedCount),
    allChallengesComplete:
      Boolean(challengeStats.allCompleted) || coreChallengeFinishedCount >= 3,
    joinedDuringOpeningWindow: Boolean(badgeSignals.joinedDuringOpeningWindow),
    failedEscapeCount: Math.max(failedEscapeCount, Number(badgeSignals.failedEscapeCount || 0)),
    fastestRunCount: Math.max(fastestRunCount, Number(badgeSignals.fastestRunCount || 0)),
    shareCount: Number(shareStats.shareCount || profile.shareCount || 0),
    allStoreThemesCompleted: STORE_THEME_MATCHERS.every((item) =>
      item[1].some((matcher) => themeTokenSet.has(normalizeThemeToken(matcher)))
    ),
  };
}

function getUnlockedBadgesByStats(stats = {}) {
  return BADGE_RULES.filter((rule) => rule.check(stats)).map((rule) => ({
    key: rule.key,
    name: rule.name,
    description: rule.description,
    unlockedDescription: rule.unlockedDescription || rule.description,
  }));
}

function buildBadgeCatalog(stats = {}) {
  const unlockedKeySet = new Set(getUnlockedBadgesByStats(stats).map((item) => item.key));
  return BADGE_RULES.map((rule) => ({
    key: rule.key,
    name: rule.name,
    description: rule.description,
    unlockedDescription: rule.unlockedDescription || rule.description,
    unlocked: unlockedKeySet.has(rule.key),
  }));
}

function buildDefaultProfile(profileId) {
  const stats = buildProfileStats({ totalPlayCount: 0, punchRecords: [], cancelCount: 0 });
  return {
    _id: profileId,
    nickname: DEFAULT_NICKNAME,
    level: '新客玩家',
    totalPlayCount: 0,
    badgeCount: 0,
    growthValue: 0,
    streakDays: 0,
    nextLevelHint: '再完成 3 次真实场次即可解锁下一等级',
    recentThemes: [],
    perks: ['生日月专属福利', '新主题优先报名', '老客夜场券'],
    wishThemes: [],
    shareStats: { shareCount: 0 },
    challengeStats: { completedCount: 0, allCompleted: false },
    badgeSignals: { joinedDuringOpeningWindow: false, fastestRunCount: 0, failedEscapeCount: 0 },
    contactPhone: '',
    avatarUrl: '',
    signature: '还没有留下签名，等你写下第一句档案备注。',
    gender: 'not_set',
    badges: [],
    badgeCatalog: buildBadgeCatalog(stats),
    redeemedCodes: [],
    punchRecords: [],
    cancelCount: 0,
    reputationScore: 100,
    reputationMeta: buildDefaultReputationMeta(),
    lastPlayedAt: '',
    createdAt: '',
    updatedAt: '',
  };
}

function sanitizeText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function shouldUseSeedNickname(currentNickname = '') {
  const normalizedNickname = String(currentNickname || '').trim();
  return !normalizedNickname || normalizedNickname === DEFAULT_NICKNAME;
}

function applyIdentitySeed(profile = {}, seed = {}) {
  const seededNickname = sanitizeText(seed.nickname || seed.contactName, 12);
  const seededPhone = normalizePhone(seed.contactPhone);
  const currentNickname = sanitizeText(profile.nickname, 12);
  const currentPhone = normalizePhone(profile.contactPhone);

  return {
    ...profile,
    nickname:
      shouldUseSeedNickname(currentNickname) && seededNickname
        ? seededNickname
        : currentNickname || seededNickname || DEFAULT_NICKNAME,
    contactPhone: currentPhone || seededPhone || '',
  };
}

function buildProvisionedProfile(profileId, seed = {}) {
  const now = new Date().toISOString();
  return applyIdentitySeed(
    {
      ...buildDefaultProfile(profileId),
      _id: profileId,
      createdAt: now,
      updatedAt: now,
    },
    seed
  );
}

function normalizeProfile(profile) {
  const baseProfile = {
    ...buildDefaultProfile(profile && profile._id ? profile._id : 'unknown-user'),
    ...(profile || {}),
  };
  const punchRecords = Array.isArray(baseProfile.punchRecords) ? baseProfile.punchRecords : [];
  const totalPlayCount = punchRecords.length || Number(baseProfile.totalPlayCount || 0);
  const stats = buildProfileStats({
    ...baseProfile,
    punchRecords,
    totalPlayCount,
  });
  const badges = getUnlockedBadgesByStats(stats);
  const levelInfo = getLevelInfo(totalPlayCount);

  return {
    ...baseProfile,
    avatarUrl: String(baseProfile.avatarUrl || '').trim(),
    signature:
      String(baseProfile.signature || '').trim() || '还没有留下签名，等你写下第一句档案备注。',
    gender: GENDER_LABELS[baseProfile.gender] ? baseProfile.gender : 'not_set',
    totalPlayCount,
    badgeCount: badges.length,
    level: levelInfo.name,
    badges,
    badgeCatalog: buildBadgeCatalog(stats),
    nextLevelHint: buildNextLevelHint(totalPlayCount),
    recentThemes: Array.isArray(baseProfile.recentThemes) ? baseProfile.recentThemes : [],
    redeemedCodes: Array.isArray(baseProfile.redeemedCodes) ? baseProfile.redeemedCodes : [],
    punchRecords,
    cancelCount: stats.cancelCount,
    reputationScore: Number(stats.reputationScore || 0),
    reputationMeta: normalizeReputationMeta(baseProfile.reputationMeta || stats.reputationMeta || {}),
    reputationTierKey: String(stats.reputationTierKey || '').trim(),
    reputationTierLabel: String(stats.reputationTierLabel || '').trim(),
    reputationRestrictionText: String(stats.reputationRestrictionText || '').trim(),
  };
}

function shouldFallbackToDefaultProfile(error) {
  const message = String((error && (error.errMsg || error.message || error.error)) || '').toLowerCase();

  return (
    message.includes('collection not exists') ||
    message.includes('db or table not exist') ||
    message.includes('document.get:fail') ||
    message.includes('doc.get:fail') ||
    message.includes('resource not found') ||
    message.includes('not found')
  );
}

module.exports = {
  buildDefaultProfile,
  buildProvisionedProfile,
  applyIdentitySeed,
  normalizeProfile,
  shouldFallbackToDefaultProfile,
};
