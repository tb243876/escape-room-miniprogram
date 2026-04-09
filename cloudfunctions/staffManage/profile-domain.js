'use strict';

const GENDER_LABELS = {
  male: '男',
  female: '女',
  not_set: '未设置',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DEFAULT_NICKNAME = '档案室常客';
const DEFAULT_SIGNATURE = '还没有留下签名，等你写下第一句档案备注。';
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
const BADGE_RULES = [
  { key: 'badge-first-step', name: '踏入者', description: '完成你的第一场冒险即可解锁', unlockedDescription: '你迈出了第一步，世界的门已经为你打开。', check: (stats) => stats.totalPlayCount >= 1 },
  { key: 'badge-rookie', name: '见习探员', description: '累计完成 3 场密室即可解锁', unlockedDescription: '三场历练，你已不再是新人。', check: (stats) => stats.totalPlayCount >= 4 },
  { key: 'badge-explorer', name: '迷宫猎手', description: '累计完成 5 场密室即可解锁', unlockedDescription: '五场冒险，你的名字开始在密室圈子里流传', check: (stats) => stats.totalPlayCount >= 8 },
  { key: 'badge-veteran', name: '老炮儿', description: '累计完成 10 场密室即可解锁', unlockedDescription: '十场磨砺，你用经验换来了这枚勋章。', check: (stats) => stats.totalPlayCount >= 15 },
  { key: 'badge-master', name: '殿堂级玩家', description: '累计完成 20 场密室即可解锁', unlockedDescription: '二十场沉浮，你已是这个圈子里真正的老手。', check: (stats) => stats.totalPlayCount >= 25 },
  { key: 'badge-archivist', name: '档案编年者', description: '累计完成 30 场密室即可解锁', unlockedDescription: '三十场之后，你的经历已经可以写成一整本档案。', check: (stats) => stats.totalPlayCount >= 40 },
  { key: 'badge-everlasting', name: '不眠馆藏', description: '累计完成 80 场密室即可解锁', unlockedDescription: '能走到这里的人很少，你已经成了门店记忆的一部分。', check: (stats) => stats.totalPlayCount >= 90 },
  { key: 'badge-theme-tonglingren', name: '瞳界先行者', description: '完成【瞳灵人】主题即可解锁', unlockedDescription: '你是第一批凝视那双瞳孔的人，它也凝视了你。', check: (stats) => hasTheme(stats, 'theme-tonglingren') },
  { key: 'badge-theme-wenchuan', name: '文川记忆者', description: '完成【文川】主题即可解锁', unlockedDescription: '那段历史被你亲历，无论结局如何，你都不会忘记。', check: (stats) => hasTheme(stats, 'theme-wenchuanzhongxue') },
  { key: 'badge-theme-shixiong', name: '尸兄不散', description: '完成【尸兄】主题即可解锁', unlockedDescription: '你们找到了彼此，也找到了答案', check: (stats) => hasTheme(stats, 'theme-shixiong') },
  { key: 'badge-theme-yixueyuan', name: '白色迷途', description: '完成【医学院】主题即可解锁', unlockedDescription: '走出那条走廊，你才知道自己有多勇敢', check: (stats) => hasTheme(stats, 'theme-yixueyuan') },
  { key: 'badge-theme-jishengchong', name: '共生体验者', description: '完成【寄生虫】主题即可解锁', unlockedDescription: '与它共存，然后逃脱 你做到了', check: (stats) => hasTheme(stats, 'theme-jishengchong') },
  { key: 'badge-theme-all', name: '全图鉴', description: '门店全部主题首通即可解锁', unlockedDescription: '这家门店的每一个世界，都曾留下你的足迹', check: (stats) => stats.allStoreThemesCompleted && stats.totalPlayCount >= 18 },
  { key: 'badge-theme-triple', name: '世界漫游者', description: '累计体验 3 个不同主题即可解锁', unlockedDescription: '你已经开始主动离开熟悉区域，去看更多世界。', check: (stats) => stats.uniqueThemeCount >= 3 && stats.totalPlayCount >= 5 },
  { key: 'badge-theme-quintet', name: '图鉴拓荒者', description: '累计体验 5 个不同主题即可解锁', unlockedDescription: '五个世界都留下过你的身影，这不是偶然，是习惯。', check: (stats) => stats.uniqueThemeCount >= 5 && stats.totalPlayCount >= 14 },
  { key: 'badge-first-captain', name: '初代队长', description: '发起一场组局并凑满成员即可解锁', unlockedDescription: '你召集了这支队伍，你是他们信任的那个人', check: (stats) => stats.creatorFullGroupCount >= 1 && stats.totalPlayCount >= 7 },
  { key: 'badge-captain-x5', name: '老队长', description: '作为发起人成功成团 5 次即可解锁', unlockedDescription: '五次集结，每次都不让队友失望', check: (stats) => stats.creatorFullGroupCount >= 5 && stats.totalPlayCount >= 20 },
  { key: 'badge-captain-x10', name: '集结核心', description: '作为发起人成功成团 10 次即可解锁', unlockedDescription: '十次成团之后，大家已经习惯等你发起那条消息。', check: (stats) => stats.creatorFullGroupCount >= 10 && stats.totalPlayCount >= 45 },
  { key: 'badge-social-butterfly', name: '交际花', description: '和 10 个不同的玩家并肩完成冒险即可解锁', unlockedDescription: '每一个并肩的人，都是独一份的缘分', check: (stats) => stats.distinctTeammateCount >= 10 && stats.totalPlayCount >= 12 },
  { key: 'badge-social-circle', name: '人脉星图', description: '和 20 个不同的玩家并肩完成冒险即可解锁', unlockedDescription: '你不只是认识很多人，你已经在圈子里织出一张地图。', check: (stats) => stats.distinctTeammateCount >= 20 && stats.totalPlayCount >= 30 },
  { key: 'badge-bring-newbie', name: '带飞导师', description: '带至少 1 名首次参与的玩家完成组局即可解锁', unlockedDescription: '你把这个世界介绍给了别人，也许改变了他们的一部分', check: (stats) => stats.newbieCarryCount >= 1 && stats.totalPlayCount >= 10 },
  { key: 'badge-bring-newbie-x3', name: '引路前辈', description: '带至少 3 名首次参与的玩家完成组局即可解锁', unlockedDescription: '你不只带过一次新人，你已经是很多人入坑的第一扇门。', check: (stats) => stats.newbieCarryCount >= 3 && stats.totalPlayCount >= 28 },
  { key: 'badge-squad-locked', name: '铁三角', description: '和固定队友组合完成 3 场冒险即可解锁', unlockedDescription: '默契不是天生的，是一场一场磨出来的', check: (stats) => stats.maxTeamRepeatCount >= 3 && stats.totalPlayCount >= 18 },
  { key: 'badge-squad-core', name: '默契核心', description: '和固定队友组合完成 5 场冒险即可解锁', unlockedDescription: '你们已经不用解释太多，一个眼神就知道下一步该做什么。', check: (stats) => stats.maxTeamRepeatCount >= 5 && stats.totalPlayCount >= 36 },
  { key: 'badge-solo-warrior', name: '孤胆英雄', description: '完成一场仅 2 人的满员组局即可解锁', unlockedDescription: '人少不是理由，你证明了这一点', check: (stats) => stats.duoFullHouseCount >= 1 && stats.totalPlayCount >= 9 },
  { key: 'badge-full-house', name: '满堂彩', description: '参与一场满员组局即可解锁', unlockedDescription: '那一晚整个房间都是人声，所有人都在为同一件事努力', check: (stats) => stats.fullHouseCount >= 1 && stats.totalPlayCount >= 11 },
  { key: 'badge-full-house-x5', name: '满堂常客', description: '累计参与 5 场满员组局即可解锁', unlockedDescription: '满员对你来说已经不是偶然，而是常态。', check: (stats) => stats.fullHouseCount >= 5 && stats.totalPlayCount >= 34 },
  { key: 'badge-night-owl', name: '深夜特工', description: '完成一场夜间 21 点后开始的组局即可解锁', unlockedDescription: '夜越深，游戏越真实', check: (stats) => stats.lateNight21Count >= 1 && stats.totalPlayCount >= 13 },
  { key: 'badge-night-owl-x3', name: '夜巡者', description: '完成 3 场夜间 21 点后开始的组局即可解锁', unlockedDescription: '深夜不是偶发的情绪，而是你固定出现的时间段。', check: (stats) => stats.lateNight21Count >= 3 && stats.totalPlayCount >= 35 },
  { key: 'badge-weekend-warrior', name: '周末战士', description: '连续两周在周末各完成一场冒险即可解锁', unlockedDescription: '你把周末留给了最值得的事', check: (stats) => stats.consecutiveWeekendWeeks >= 2 && stats.totalPlayCount >= 16 },
  { key: 'badge-weekend-warrior-x4', name: '周末驻场', description: '连续四周在周末各完成一场冒险即可解锁', unlockedDescription: '别人把周末过成休息，你把周末过成了固定节律。', check: (stats) => stats.consecutiveWeekendWeeks >= 4 && stats.totalPlayCount >= 44 },
  { key: 'badge-streak-3', name: '三连闯关', description: '连续三周各完成至少一场冒险即可解锁', unlockedDescription: '三周不断，这需要真正的热情', check: (stats) => stats.consecutivePlayWeeks >= 3 && stats.totalPlayCount >= 19 },
  { key: 'badge-streak-6', name: '半季常驻', description: '连续六周各完成至少一场冒险即可解锁', unlockedDescription: '连续六周保持频率，这已经不是临时热情，是生活的一部分。', check: (stats) => stats.consecutivePlayWeeks >= 6 && stats.totalPlayCount >= 50 },
  { key: 'badge-anniversary', name: '周年老友', description: '距首次参与满 365 天后再次参与即可解锁', unlockedDescription: '一年之后，你又回来了。有些东西从未改变', check: (stats) => stats.anniversaryCount >= 1 },
  { key: 'badge-holiday-raider', name: '节日突击队', description: '在节假日完成一场组局即可解锁', unlockedDescription: '别人在放假，你在冒险', check: (stats) => stats.holidayCount >= 1 && stats.totalPlayCount >= 21 },
  { key: 'badge-holiday-raider-x3', name: '假日惯犯', description: '在节假日完成 3 场组局即可解锁', unlockedDescription: '节日对你来说不是休息，而是另一个更适合开局的时段。', check: (stats) => stats.holidayCount >= 3 && stats.totalPlayCount >= 58 },
  { key: 'badge-reliable', name: '靠谱的人', description: '信誉分保持 90 分以上且完成 5 场冒险即可解锁', unlockedDescription: '每次说到做到，队友都记得你的名字', check: (stats) => stats.reputationScore >= 90 && stats.totalPlayCount >= 12 },
  { key: 'badge-reliable-elite', name: '稳定核心', description: '信誉分保持 95 分以上且完成 15 场冒险即可解锁', unlockedDescription: '能长期保持稳定，比一时热情更难得，你已经做到了。', check: (stats) => stats.reputationScore >= 95 && stats.totalPlayCount >= 32 },
  { key: 'badge-comeback', name: '归来者', description: '沉寂两个月后重返密室即可解锁', unlockedDescription: '消失了一段时间，但你终究还是回来了', check: (stats) => stats.comebackCount >= 1 && stats.totalPlayCount >= 22 },
  { key: 'badge-comeback-x2', name: '再归档者', description: '沉寂两个月后重返密室 2 次即可解锁', unlockedDescription: '你不是偶尔回来看看，而是总会在某个时刻重新回到这里。', check: (stats) => stats.comebackCount >= 2 && stats.totalPlayCount >= 52 },
  { key: 'badge-wishlist-3', name: '有备而来', description: '在心愿单中加入 3 个想挑战的主题即可解锁', unlockedDescription: '有目标的人，走得更远', check: (stats) => stats.wishlistCount >= 3 },
  { key: 'badge-wishlist-done', name: '愿望达成', description: '完成一个你曾标记“想玩”的主题即可解锁', unlockedDescription: '你曾经许下的愿望，自己兑现了', check: (stats) => stats.wishlistDoneCount >= 1 },
  { key: 'badge-challenge-finisher', name: '任务完成者', description: '完成一项挑战任务即可解锁', unlockedDescription: '目标定下，就一定要做到', check: (stats) => stats.challengeFinishedCount >= 1 && stats.totalPlayCount >= 26 },
  { key: 'badge-challenge-double', name: '持续达成者', description: '完成两项挑战任务即可解锁', unlockedDescription: '不是碰巧完成了一次，而是把目标真的一个个落地。', check: (stats) => stats.challengeFinishedCount >= 2 && stats.totalPlayCount >= 54 },
  { key: 'badge-all-challenges', name: '全勤挑战者', description: '完成当期全部挑战任务即可解锁', unlockedDescription: '这期没有一项任务难住你，你拿满了', check: (stats) => stats.allChallengesComplete && stats.totalPlayCount >= 80 },
  { key: 'badge-month-sprint', name: '本月高频档案', description: '30 天内完成 5 场真实体验即可解锁', unlockedDescription: '你最近的出勤频率，已经让档案更新速度明显快过别人。', check: (stats) => stats.last30DaysCount >= 5 && stats.totalPlayCount >= 18 },
  { key: 'badge-year-round', name: '四季玩家', description: '365 天内累计完成 12 场真实体验即可解锁', unlockedDescription: '不是某个阶段的一时上头，而是跨季节的稳定热爱。', check: (stats) => stats.last365DaysCount >= 12 && stats.totalPlayCount >= 36 },
  { key: 'badge-secret-first-day', name: '元老', description: '隐藏徽章，条件未知', unlockedDescription: '你在最开始就在这里了，是这里的第一批见证者', hidden: true, check: (stats) => stats.joinedDuringOpeningWindow },
  { key: 'badge-unlucky', name: '运气不太好', description: '隐藏徽章，条件未知', unlockedDescription: '输了也要记录。这也是冒险的一部分', hidden: true, check: (stats) => stats.failedEscapeCount >= 1 && stats.totalPlayCount >= 7 },
  { key: 'badge-unlucky-x2', name: '百折不回', description: '隐藏徽章，条件未知', unlockedDescription: '连续吃过亏的人才更懂得下一次胜利为什么值得记住。', hidden: true, check: (stats) => stats.failedEscapeCount >= 2 && stats.totalPlayCount >= 27 },
  { key: 'badge-speed-runner', name: '极速闯关', description: '隐藏徽章，条件未知', unlockedDescription: '比任何人都快 今天是你的最快纪录', hidden: true, check: (stats) => stats.fastestRunCount >= 1 && stats.totalPlayCount >= 23 },
  { key: 'badge-midnight', name: '子夜行者', description: '隐藏徽章，条件未知', unlockedDescription: '快零点了，你们还没打算回家', hidden: true, check: (stats) => stats.deepNight23Count >= 1 && stats.totalPlayCount >= 29 },
  { key: 'badge-repeat-theme', name: '执念', description: '隐藏徽章，条件未知', unlockedDescription: '三次回到同一个地方，你在这里寻找什么？', hidden: true, check: (stats) => stats.maxRepeatThemeCount >= 3 && stats.totalPlayCount >= 17 },
  { key: 'badge-repeat-theme-x5', name: '回廊执念', description: '隐藏徽章，条件未知', unlockedDescription: '五次回到同一主题，已经不是重温，而是一种执着。', hidden: true, check: (stats) => stats.maxRepeatThemeCount >= 5 && stats.totalPlayCount >= 48 },
  { key: 'badge-sharer', name: '传道者', description: '隐藏徽章，条件未知', unlockedDescription: '你愿意把这件事告诉别人，说明它对你真的有意义', hidden: true, check: (stats) => stats.shareCount >= 3 && stats.totalPlayCount >= 20 },
  { key: 'badge-loudspeaker', name: '扩音器', description: '隐藏徽章，条件未知', unlockedDescription: '你不只是偶尔分享，而是在反复把自己的热爱向外扩散。', hidden: true, check: (stats) => stats.shareCount >= 5 && stats.totalPlayCount >= 40 },
  { key: 'badge-legend', name: '传说', description: '累计完成 50 场密室即可解锁', unlockedDescription: '五十场，这是一段很少有人能走完的旅程', check: (stats) => stats.totalPlayCount >= 60 },
];

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
  if (!timestamp) return null;
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
      if (token) tokenSet.add(token);
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
  if (record.holidayTag) return true;
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 1 && day === 1) return true;
  return month === 10 && day >= 1 && day <= 7;
}

function getLevelInfo(totalPlayCount) {
  let current = LEVEL_RULES[0];
  LEVEL_RULES.forEach((rule) => {
    if (totalPlayCount >= rule.min) current = rule;
  });
  return current;
}

function buildBadgeCatalog(profile = {}) {
  const stats = buildStats(profile);
  const unlockedKeySet = new Set(
    BADGE_RULES.filter((rule) => rule.check(stats)).map((rule) => rule.key)
  );
  return BADGE_RULES.map((rule) => ({
    key: rule.key,
    name: rule.name,
    description: rule.description,
    unlockedDescription: rule.unlockedDescription || rule.description,
    unlocked: unlockedKeySet.has(rule.key),
  }));
}

function buildDefaultProfile(profileId) {
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
    redeemedCodes: [],
    punchRecords: [],
    perks: ['生日月专属福利', '新主题优先报名', '老客夜场券'],
    wishThemes: [],
    shareStats: { shareCount: 0 },
    challengeStats: { completedCount: 0, allCompleted: false },
    badgeSignals: { joinedDuringOpeningWindow: false, fastestRunCount: 0, failedEscapeCount: 0 },
    contactPhone: '',
    avatarUrl: '',
    avatarFileId: '',
    signature: DEFAULT_SIGNATURE,
    gender: 'not_set',
    badges: [],
    badgeCatalog: [],
    lastPlayedAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cancelCount: 0,
    reputationScore: 100,
    reputationMeta: buildDefaultReputationMeta(),
  };
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

function buildProvisionedProfile(profileId, seed = {}, observedAt = '') {
  const normalizedObservedAt = String(observedAt || '').trim() || new Date().toISOString();
  return applyIdentitySeed(
    {
      ...buildDefaultProfile(profileId),
      _id: profileId,
      createdAt: normalizedObservedAt,
      updatedAt: normalizedObservedAt,
    },
    seed
  );
}

function buildStats(profile = {}) {
  const punchRecords = Array.isArray(profile.punchRecords) ? profile.punchRecords : [];
  const now = Date.now();
  const day30 = 30 * DAY_MS;
  const day365 = 365 * DAY_MS;
  const totalPlayCount = punchRecords.length || Number(profile.totalPlayCount || 0);
  const themeKeys = punchRecords.map((item) => item.themeId || item.themeName).filter(Boolean);
  const themeTokenSet = buildThemeTokenSet(punchRecords);
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

    if (hour >= 21 || item.lateNight) lateNight21Count += 1;
    if (hour >= 23) deepNight23Count += 1;
    if (Number.isFinite(weekIndex)) {
      allWeeks.push(weekIndex);
      const day = date ? date.getDay() : -1;
      if (day === 0 || day === 6) weekendWeeks.push(weekIndex);
    }
    if (isFullHouse) {
      fullHouseCount += 1;
      if (teamSize === 2) duoFullHouseCount += 1;
      if (item.wasCreator) creatorFullGroupCount += 1;
    }
    if (item.broughtNewbie || Number(item.newbieCount || 0) > 0) newbieCarryCount += 1;
    if (isHolidayRecord(item, timestamp)) holidayCount += 1;
    if (item.escaped === false) failedEscapeCount += 1;
    if (item.fastestRun) fastestRunCount += 1;
    const teamKey = String(item.teamKey || '').trim();
    if (teamKey) teamKeyCountMap[teamKey] = (teamKeyCountMap[teamKey] || 0) + 1;
    const teammateOpenIds = Array.isArray(item.teammateOpenIds) ? item.teammateOpenIds : [];
    const teammateNames = Array.isArray(item.teammateNames) ? item.teammateNames : [];
    teammateOpenIds.forEach((value) => {
      const normalizedValue = String(value || '').trim();
      if (normalizedValue) teammateSet.add(normalizedValue);
    });
    if (!teammateOpenIds.length) {
      teammateNames.forEach((value) => {
        const normalizedValue = String(value || '').trim();
        if (normalizedValue) teammateSet.add(normalizedValue);
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

  return {
    totalPlayCount,
    themeTokenSet,
    uniqueThemeCount: new Set(themeKeys).size,
    lateNight21Count,
    teamPlayCount: punchRecords.filter((item) => Number(item.teamSize || 0) >= 4).length,
    creatorPlayCount: punchRecords.filter((item) => item.wasCreator).length,
    creatorFullGroupCount,
    fullHouseCount,
    duoFullHouseCount,
    distinctTeammateCount: teammateSet.size,
    newbieCarryCount,
    maxTeamRepeatCount: Object.values(teamKeyCountMap).reduce((max, value) => Math.max(max, value), 0),
    maxRepeatThemeCount: Object.values(themeCountMap).reduce((max, value) => Math.max(max, value), 0),
    consecutiveWeekendWeeks: getMaxConsecutiveCount(weekendWeeks),
    consecutivePlayWeeks: getMaxConsecutiveCount(allWeeks),
    anniversaryCount:
      sortedTimestamps.length >= 2 &&
      sortedTimestamps.some((item) => item - sortedTimestamps[0] >= 365 * DAY_MS)
        ? 1
        : 0,
    holidayCount,
    reputationMeta,
    reputationScore,
    comebackCount,
    wishlistCount: Array.isArray(profile.wishThemes) ? profile.wishThemes.length : 0,
    wishlistDoneCount: 0,
    challengeFinishedCount: Number(challengeStats.completedCount || coreChallengeFinishedCount),
    allChallengesComplete:
      Boolean(challengeStats.allCompleted) || coreChallengeFinishedCount >= 3,
    joinedDuringOpeningWindow: Boolean(badgeSignals.joinedDuringOpeningWindow),
    failedEscapeCount: Math.max(failedEscapeCount, Number(badgeSignals.failedEscapeCount || 0)),
    fastestRunCount: Math.max(fastestRunCount, Number(badgeSignals.fastestRunCount || 0)),
    deepNight23Count,
    shareCount: Number(shareStats.shareCount || profile.shareCount || 0),
    allStoreThemesCompleted: STORE_THEME_MATCHERS.every((item) =>
      item[1].some((matcher) => themeTokenSet.has(normalizeThemeToken(matcher)))
    ),
    last30DaysCount: punchRecords.filter((item) => now - getRecordTimestamp(item) <= day30).length,
    last365DaysCount: punchRecords.filter((item) => now - getRecordTimestamp(item) <= day365).length,
  };
}

function buildBadgeCount(profile = {}) {
  const stats = buildStats(profile);
  return BADGE_RULES.filter((rule) => rule.check(stats)).length;
}

function buildNextStreakDays(profile = {}, playedAt) {
  const previous = String(profile.lastPlayedAt || '');
  if (!previous) return 1;
  const previousDate = new Date(previous);
  const currentDate = new Date(playedAt);
  previousDate.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);
  const diff = Math.round((currentDate.getTime() - previousDate.getTime()) / DAY_MS);
  if (diff <= 0) return Math.max(1, Number(profile.streakDays || 0));
  if (diff === 1) return Math.max(1, Number(profile.streakDays || 0)) + 1;
  return 1;
}

function buildSessionRecord(session = {}) {
  const stageEndedAt = session.endedAt || new Date().toISOString();
  const currentOpenId = String(session.currentOpenId || '').trim();
  const memberSnapshot = Array.isArray(session.memberSnapshot) ? session.memberSnapshot : [];
  const memberOpenIds = memberSnapshot
    .map((item) => String(item.openId || '').trim())
    .filter(Boolean)
    .sort();
  const teammateOpenIds = memberOpenIds.filter((item) => item !== currentOpenId);
  const teammateNames = memberSnapshot
    .filter((item) => String(item.openId || '').trim() !== currentOpenId)
    .map((item) => String(item.nickname || '').trim())
    .filter(Boolean);
  const teamSize = Number(session.teamSize || memberOpenIds.length || 0);
  const maxTeamSize = Number(session.maxTeamSize || teamSize || 0);
  const isFullHouse =
    Boolean(session.isFullHouse) || (maxTeamSize > 0 && teamSize > 0 && teamSize >= maxTeamSize);

  return {
    recordId: `session-${session.id || session._id || ''}`,
    themeId: session.themeId || '',
    themeName: session.themeName || '',
    horror: session.horror || '',
    teamSize,
    maxTeamSize,
    isFullHouse,
    lateNight: Boolean(session.lateNight),
    wasCreator: Boolean(session.wasCreator),
    memberOpenIds,
    teammateOpenIds,
    teammateNames,
    teamKey: memberOpenIds.join('|'),
    newbieCount: Number(session.newbieCount || 0),
    broughtNewbie: Boolean(session.broughtNewbie),
    escaped:
      typeof session.escaped === 'boolean'
        ? session.escaped
        : null,
    fastestRun: Boolean(session.fastestRun),
    holidayTag: session.holidayTag || '',
    startedAt: session.startedAt || '',
    endedAt: stageEndedAt,
    teamRole: 'team_member',
    punchedAt: stageEndedAt,
    sessionLabel: `${session.playDate || ''} ${session.timeSlot || ''}`.trim(),
  };
}

function applySessionSettlement(profile = {}, session = {}) {
  const baseProfile = {
    ...buildDefaultProfile(profile._id || 'unknown-user'),
    ...(profile || {}),
  };
  const nextRecord = buildSessionRecord(session);
  const currentRecords = Array.isArray(baseProfile.punchRecords) ? baseProfile.punchRecords : [];
  const duplicated = currentRecords.some((item) => item.recordId === nextRecord.recordId);
  if (duplicated) {
    const totalPlayCount = currentRecords.length;
    const nextProfile = {
      ...baseProfile,
      totalPlayCount,
      updatedAt: new Date().toISOString(),
    };
    nextProfile.badgeCount = buildBadgeCount(nextProfile);
    nextProfile.badgeCatalog = buildBadgeCatalog(nextProfile);
    nextProfile.level = getLevelInfo(totalPlayCount).name;
    return nextProfile;
  }

  const nextRecords = [nextRecord].concat(currentRecords).slice(0, 100);
  const growthDelta = Number(session.growthValue || 18);
  const recentThemes = [session.themeName]
    .concat((baseProfile.recentThemes || []).filter((item) => item !== session.themeName))
    .filter(Boolean)
    .slice(0, 6);
  const lastPlayedAt = nextRecord.punchedAt;
  const nextProfile = {
    ...baseProfile,
    punchRecords: nextRecords,
    totalPlayCount: nextRecords.length,
    growthValue: Number(baseProfile.growthValue || 0) + growthDelta,
    recentThemes,
    lastPlayedAt,
    streakDays: buildNextStreakDays(baseProfile, lastPlayedAt),
    updatedAt: new Date().toISOString(),
  };
  nextProfile.badgeCount = buildBadgeCount(nextProfile);
  nextProfile.badgeCatalog = buildBadgeCatalog(nextProfile);
  nextProfile.level = getLevelInfo(nextProfile.totalPlayCount).name;
  return nextProfile;
}

function buildHonorLabels(profile = {}, stats = {}, badges = []) {
  if (Array.isArray(profile.honorLabels) && profile.honorLabels.length) {
    return profile.honorLabels
      .map((item) => (String(item || '').trim() === '师兄不散' ? '尸兄不散' : String(item || '').trim()))
      .filter(Boolean)
      .slice(0, 3);
  }
  const honors = badges
    .slice(0, 3)
    .map((item) => (String(item.name || '').trim() === '师兄不散' ? '尸兄不散' : item.name));
  if (stats.fullHouseCount >= 1) honors.unshift('拼场常客');
  if (stats.consecutivePlayWeeks >= 3) honors.unshift('本月高频');
  return honors.slice(0, 3);
}

function buildTitleLabel(profile = {}, stats = {}, badges = []) {
  const rawTitleLabel =
    String(profile.titleLabel || '').trim() === '师兄不散'
      ? '尸兄不散'
      : String(profile.titleLabel || '').trim();
  if (rawTitleLabel && !LEVEL_RULES.some((item) => item.name === rawTitleLabel)) {
    return rawTitleLabel;
  }
  const badgeKeySet = new Set(badges.map((item) => item.key));
  if (badgeKeySet.has('badge-legend')) return '传奇玩家';
  if (badgeKeySet.has('badge-master')) return '殿堂玩家';
  if (badgeKeySet.has('badge-theme-all')) return '全图鉴玩家';
  if (badgeKeySet.has('badge-captain-x5')) return '组局指挥官';
  if (badgeKeySet.has('badge-social-butterfly')) return '社交中心';
  if (stats.uniqueThemeCount >= 3) return '主题探索者';
  return getLevelInfo(stats.totalPlayCount).name;
}

function buildProfileCard(profile = {}) {
  const baseProfile = {
    ...buildDefaultProfile(profile._id || 'unknown-user'),
    ...(profile || {}),
  };
  const totalPlayCount =
    Array.isArray(baseProfile.punchRecords) && baseProfile.punchRecords.length
      ? baseProfile.punchRecords.length
      : Number(baseProfile.totalPlayCount || 0);
  const stats = buildStats(baseProfile);
  const badges = BADGE_RULES.filter((rule) => rule.check(stats)).map((rule) => ({
    key: rule.key,
    name: rule.name,
  }));
  const badgeCount = badges.length;
  const nickname = String(baseProfile.nickname || '').trim() || DEFAULT_NICKNAME;

  return {
    openId: String(baseProfile._id || ''),
    nickname,
    avatarUrl: String(baseProfile.avatarUrl || '').trim(),
    avatarFileId:
      String(baseProfile.avatarFileId || '').trim() ||
      (String(baseProfile.avatarUrl || '').trim().startsWith('cloud://')
        ? String(baseProfile.avatarUrl || '').trim()
        : ''),
    avatarText: nickname.slice(0, 1),
    signature: String(baseProfile.signature || '').trim() || DEFAULT_SIGNATURE,
    gender: ['male', 'female', 'not_set'].includes(String(baseProfile.gender || ''))
      ? baseProfile.gender
      : 'not_set',
    genderText: GENDER_LABELS[String(baseProfile.gender || '')] || GENDER_LABELS.not_set,
    titleLabel: buildTitleLabel(baseProfile, stats, badges),
    honorLabels: buildHonorLabels(baseProfile, stats, badges),
    totalPlayCount,
    badgeCount,
    growthValue: Number(baseProfile.growthValue || 0),
    reputationScore: Number(stats.reputationScore || 0),
    reputationMeta: normalizeReputationMeta(baseProfile.reputationMeta || stats.reputationMeta || {}),
    summaryText: `已通关 ${totalPlayCount} 次 · 点亮 ${badgeCount} 枚徽章`,
  };
}

module.exports = {
  buildDefaultProfile,
  buildProvisionedProfile,
  applyIdentitySeed,
  applySessionSettlement,
  buildBadgeCount,
  buildProfileCard,
};
