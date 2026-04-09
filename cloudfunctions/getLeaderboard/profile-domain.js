'use strict';

const GENDER_LABELS = {
  male: '男',
  female: '女',
  not_set: '未设置',
};

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
const BADGE_RULES = [
  { key: 'badge-first-step', name: '踏入者', check: (stats) => stats.totalPlayCount >= 1 },
  { key: 'badge-rookie', name: '见习探员', check: (stats) => stats.totalPlayCount >= 3 },
  { key: 'badge-explorer', name: '迷宫猎手', check: (stats) => stats.totalPlayCount >= 5 },
  { key: 'badge-veteran', name: '老炮儿', check: (stats) => stats.totalPlayCount >= 10 },
  { key: 'badge-master', name: '殿堂级玩家', check: (stats) => stats.totalPlayCount >= 20 },
  { key: 'badge-archivist', name: '档案编年者', check: (stats) => stats.totalPlayCount >= 30 },
  { key: 'badge-everlasting', name: '不眠馆藏', check: (stats) => stats.totalPlayCount >= 80 },
  { key: 'badge-theme-tonglingren', name: '瞳界先行者', check: (stats) => hasTheme(stats, 'theme-tonglingren') },
  { key: 'badge-theme-wenchuan', name: '文川记忆者', check: (stats) => hasTheme(stats, 'theme-wenchuanzhongxue') },
  { key: 'badge-theme-shixiong', name: '尸兄不散', check: (stats) => hasTheme(stats, 'theme-shixiong') },
  { key: 'badge-theme-yixueyuan', name: '白色迷途', check: (stats) => hasTheme(stats, 'theme-yixueyuan') },
  { key: 'badge-theme-jishengchong', name: '共生体验者', check: (stats) => hasTheme(stats, 'theme-jishengchong') },
  { key: 'badge-theme-all', name: '全图鉴', check: (stats) => stats.allStoreThemesCompleted },
  { key: 'badge-theme-triple', name: '世界漫游者', check: (stats) => stats.uniqueThemeCount >= 3 },
  { key: 'badge-theme-quintet', name: '图鉴拓荒者', check: (stats) => stats.uniqueThemeCount >= 5 },
  { key: 'badge-first-captain', name: '初代队长', check: (stats) => stats.creatorFullGroupCount >= 1 },
  { key: 'badge-captain-x5', name: '老队长', check: (stats) => stats.creatorFullGroupCount >= 5 },
  { key: 'badge-captain-x10', name: '集结核心', check: (stats) => stats.creatorFullGroupCount >= 10 },
  { key: 'badge-social-butterfly', name: '交际花', check: (stats) => stats.distinctTeammateCount >= 10 },
  { key: 'badge-social-circle', name: '人脉星图', check: (stats) => stats.distinctTeammateCount >= 20 },
  { key: 'badge-bring-newbie', name: '带飞导师', check: (stats) => stats.newbieCarryCount >= 1 },
  { key: 'badge-bring-newbie-x3', name: '引路前辈', check: (stats) => stats.newbieCarryCount >= 3 },
  { key: 'badge-squad-locked', name: '铁三角', check: (stats) => stats.maxTeamRepeatCount >= 3 },
  { key: 'badge-squad-core', name: '默契核心', check: (stats) => stats.maxTeamRepeatCount >= 5 },
  { key: 'badge-solo-warrior', name: '孤胆英雄', check: (stats) => stats.duoFullHouseCount >= 1 },
  { key: 'badge-full-house', name: '满堂彩', check: (stats) => stats.fullHouseCount >= 1 },
  { key: 'badge-full-house-x5', name: '满堂常客', check: (stats) => stats.fullHouseCount >= 5 },
  { key: 'badge-night-owl', name: '深夜特工', check: (stats) => stats.lateNight21Count >= 1 },
  { key: 'badge-night-owl-x3', name: '夜巡者', check: (stats) => stats.lateNight21Count >= 3 },
  { key: 'badge-weekend-warrior', name: '周末战士', check: (stats) => stats.consecutiveWeekendWeeks >= 2 },
  { key: 'badge-weekend-warrior-x4', name: '周末驻场', check: (stats) => stats.consecutiveWeekendWeeks >= 4 },
  { key: 'badge-streak-3', name: '三连闯关', check: (stats) => stats.consecutivePlayWeeks >= 3 },
  { key: 'badge-streak-6', name: '半季常驻', check: (stats) => stats.consecutivePlayWeeks >= 6 },
  { key: 'badge-anniversary', name: '周年老友', check: (stats) => stats.anniversaryCount >= 1 },
  { key: 'badge-holiday-raider', name: '节日突击队', check: (stats) => stats.holidayCount >= 1 },
  { key: 'badge-holiday-raider-x3', name: '假日惯犯', check: (stats) => stats.holidayCount >= 3 },
  { key: 'badge-reliable', name: '靠谱的人', check: (stats) => stats.reputationScore >= 90 && stats.totalPlayCount >= 5 },
  { key: 'badge-reliable-elite', name: '稳定核心', check: (stats) => stats.reputationScore >= 95 && stats.totalPlayCount >= 15 },
  { key: 'badge-comeback', name: '归来者', check: (stats) => stats.comebackCount >= 1 },
  { key: 'badge-comeback-x2', name: '再归档者', check: (stats) => stats.comebackCount >= 2 },
  { key: 'badge-wishlist-3', name: '有备而来', check: (stats) => stats.wishlistCount >= 3 },
  { key: 'badge-wishlist-done', name: '愿望达成', check: (stats) => stats.wishlistDoneCount >= 1 },
  { key: 'badge-challenge-finisher', name: '任务完成者', check: (stats) => stats.challengeFinishedCount >= 1 },
  { key: 'badge-challenge-double', name: '持续达成者', check: (stats) => stats.challengeFinishedCount >= 2 },
  { key: 'badge-all-challenges', name: '全勤挑战者', check: (stats) => stats.allChallengesComplete },
  { key: 'badge-month-sprint', name: '本月高频档案', check: (stats) => stats.last30DaysCount >= 5 },
  { key: 'badge-year-round', name: '四季玩家', check: (stats) => stats.last365DaysCount >= 12 },
  { key: 'badge-secret-first-day', name: '元老', check: (stats) => stats.joinedDuringOpeningWindow },
  { key: 'badge-unlucky', name: '运气不太好', check: (stats) => stats.failedEscapeCount >= 1 },
  { key: 'badge-unlucky-x2', name: '百折不回', check: (stats) => stats.failedEscapeCount >= 2 },
  { key: 'badge-speed-runner', name: '极速闯关', check: (stats) => stats.fastestRunCount >= 1 },
  { key: 'badge-midnight', name: '子夜行者', check: (stats) => stats.deepNight23Count >= 1 },
  { key: 'badge-repeat-theme', name: '执念', check: (stats) => stats.maxRepeatThemeCount >= 3 },
  { key: 'badge-repeat-theme-x5', name: '回廊执念', check: (stats) => stats.maxRepeatThemeCount >= 5 },
  { key: 'badge-sharer', name: '传道者', check: (stats) => stats.shareCount >= 3 },
  { key: 'badge-loudspeaker', name: '扩音器', check: (stats) => stats.shareCount >= 5 },
  { key: 'badge-legend', name: '传说', check: (stats) => stats.totalPlayCount >= 50 },
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

function getPunchRecords(profile = {}) {
  return Array.isArray(profile.punchRecords) ? profile.punchRecords : [];
}

function buildStats(profile = {}) {
  const punchRecords = getPunchRecords(profile);
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
    if (sortedTimestamps[index] - sortedTimestamps[index - 1] >= 60 * DAY_MS) comebackCount += 1;
  }

  const badgeSignals = profile.badgeSignals || {};
  const shareStats = profile.shareStats || {};
  const challengeStats = profile.challengeStats || {};
  const coreChallengeFinishedCount = [
    totalPlayCount >= 3,
    new Set(themeKeys).size >= 3,
    punchRecords.filter((item) => Number(item.teamSize || 0) >= 4).length >= 1,
  ].filter(Boolean).length;
  const reputationMeta = normalizeReputationMeta(profile.reputationMeta || {});
  const reputationScore = computeReputationScore(profile, totalPlayCount);

  return {
    totalPlayCount,
    themeTokenSet,
    uniqueThemeCount: new Set(themeKeys).size,
    lateNight21Count,
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
    last30DaysCount: punchRecords.filter((item) => {
      const timestamp = getRecordTimestamp(item);
      return timestamp > 0 && Date.now() - timestamp <= 30 * DAY_MS;
    }).length,
    last365DaysCount: punchRecords.filter((item) => {
      const timestamp = getRecordTimestamp(item);
      return timestamp > 0 && Date.now() - timestamp <= 365 * DAY_MS;
    }).length,
    shareCount: Number(shareStats.shareCount || profile.shareCount || 0),
    allStoreThemesCompleted: STORE_THEME_MATCHERS.every((item) =>
      item[1].some((matcher) => themeTokenSet.has(normalizeThemeToken(matcher)))
    ),
  };
}

function getUnlockedBadges(stats = {}) {
  return BADGE_RULES.filter((rule) => rule.check(stats)).map((rule) => ({
    key: rule.key,
    name: rule.name,
  }));
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

function normalizeProfile(profile = {}) {
  const stats = buildStats(profile);
  const badges = getUnlockedBadges(stats);
  const nickname = String(profile.nickname || '').trim() || '档案室常客';

  return {
    ...profile,
    _id: String(profile._id || ''),
    nickname,
    avatarUrl: String(profile.avatarUrl || '').trim(),
    avatarText: nickname.slice(0, 1),
    signature: String(profile.signature || '').trim() || '这位玩家还没有公开更多档案信息。',
    gender: ['male', 'female', 'not_set'].includes(String(profile.gender || ''))
      ? String(profile.gender || '')
      : 'not_set',
    genderText: GENDER_LABELS[String(profile.gender || '')] || GENDER_LABELS.not_set,
    totalPlayCount: stats.totalPlayCount,
    badgeCount: badges.length,
    growthValue: Number(profile.growthValue || 0),
    streakDays: Number(profile.streakDays || 0),
    reputationScore: Number(stats.reputationScore || 0),
    reputationMeta: normalizeReputationMeta(profile.reputationMeta || stats.reputationMeta || {}),
    titleLabel: buildTitleLabel(profile, stats, badges),
    honorLabels: buildHonorLabels(profile, stats, badges),
  };
}

module.exports = {
  normalizeProfile,
};
