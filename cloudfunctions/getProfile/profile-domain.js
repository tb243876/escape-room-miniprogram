'use strict';

const GENDER_LABELS = {
  male: '男',
  female: '女',
  not_set: '未设置',
};

const LEVEL_RULES = [
  { min: 0, name: '新客玩家', nextMin: 3 },
  { min: 3, name: '沉浸玩家', nextMin: 6 },
  { min: 6, name: '进阶会员', nextMin: 10 },
  { min: 10, name: '馆藏玩家', nextMin: null },
];

const BADGE_RULES = [
  {
    key: 'badge-first',
    name: '初次入档',
    description: '完成第 1 次真实场次打卡',
    check: (stats) => stats.totalPlayCount >= 1,
  },
  {
    key: 'badge-three',
    name: '连闯三场',
    description: '累计完成 3 次真实场次打卡',
    check: (stats) => stats.totalPlayCount >= 3,
  },
  {
    key: 'badge-five',
    name: '进阶玩家',
    description: '累计完成 5 次真实场次打卡',
    check: (stats) => stats.totalPlayCount >= 5,
  },
  {
    key: 'badge-ten',
    name: '馆藏玩家',
    description: '累计完成 10 次真实场次打卡',
    check: (stats) => stats.totalPlayCount >= 10,
  },
  {
    key: 'badge-theme-tonglingren',
    name: '直面瞳灵',
    description: '成功打卡瞳灵人主题',
    check: (stats) => stats.themeSet.has('瞳灵人'),
  },
  {
    key: 'badge-theme-wenchuan',
    name: '返校档案',
    description: '成功打卡文川中学主题',
    check: (stats) => stats.themeSet.has('文川中学'),
  },
  {
    key: 'badge-micro',
    name: '微恐起步',
    description: '完成 1 次微恐主题打卡',
    check: (stats) => stats.horrorLevelSet.has('微恐'),
  },
  {
    key: 'badge-middle',
    name: '中恐进场',
    description: '完成 1 次中恐主题打卡',
    check: (stats) => stats.horrorLevelSet.has('中恐'),
  },
  {
    key: 'badge-heavy',
    name: '重恐认证',
    description: '完成 1 次重恐主题打卡',
    check: (stats) => stats.horrorLevelSet.has('重恐'),
  },
  {
    key: 'badge-all-levels',
    name: '全级别通关',
    description: '完成微恐、中恐、重恐三档主题打卡',
    check: (stats) => ['微恐', '中恐', '重恐'].every((level) => stats.horrorLevelSet.has(level)),
  },
  {
    key: 'badge-late-night',
    name: '深夜留档',
    description: '完成 1 次深夜场主题打卡',
    check: (stats) => stats.lateNightCount >= 1,
  },
  {
    key: 'badge-night-owl',
    name: '夜行常客',
    description: '累计完成 3 次深夜场主题打卡',
    check: (stats) => stats.lateNightCount >= 3,
  },
  {
    key: 'badge-team-play',
    name: '组队入局',
    description: '完成 1 次 4 人及以上组队场打卡',
    check: (stats) => stats.teamPlayCount >= 1,
  },
  {
    key: 'badge-full-squad',
    name: '满编开场',
    description: '累计完成 3 次 4 人及以上组队场打卡',
    check: (stats) => stats.teamPlayCount >= 3,
  },
  {
    key: 'badge-duo-play',
    name: '双人胆量',
    description: '完成 1 次双人场主题打卡',
    check: (stats) => stats.duoPlayCount >= 1,
  },
  {
    key: 'badge-theme-explorer',
    name: '主题探索者',
    description: '累计体验 3 个不同主题',
    check: (stats) => stats.uniqueThemeCount >= 3,
  },
  {
    key: 'badge-theme-collector',
    name: '主题收藏家',
    description: '累计体验 6 个不同主题',
    check: (stats) => stats.uniqueThemeCount >= 6,
  },
  {
    key: 'badge-month-sprint',
    name: '月度高频',
    description: '30 天内完成 3 次真实场次打卡',
    check: (stats) => stats.last30DaysCount >= 3,
  },
  {
    key: 'badge-year-archive',
    name: '年度常客',
    description: '365 天内完成 6 次真实场次打卡',
    check: (stats) => stats.last365DaysCount >= 6,
  },
];

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

function buildProfileStats(profile) {
  const punchRecords = Array.isArray(profile.punchRecords) ? profile.punchRecords : [];
  const now = Date.now();
  const day30 = 30 * 24 * 60 * 60 * 1000;
  const day365 = 365 * 24 * 60 * 60 * 1000;
  const totalPlayCount = punchRecords.length || Number(profile.totalPlayCount || 0);

  return {
    totalPlayCount,
    themeSet: new Set(punchRecords.map((item) => item.themeName).filter(Boolean)),
    uniqueThemeCount: new Set(punchRecords.map((item) => item.themeName).filter(Boolean)).size,
    horrorLevelSet: new Set(punchRecords.map((item) => item.horror).filter(Boolean)),
    lateNightCount: punchRecords.filter((item) => item.lateNight).length,
    teamPlayCount: punchRecords.filter((item) => Number(item.teamSize || 0) >= 4).length,
    duoPlayCount: punchRecords.filter((item) => Number(item.teamSize || 0) === 2).length,
    last30DaysCount: punchRecords.filter(
      (item) => now - new Date(item.punchedAt || item.playedAt || 0).getTime() <= day30
    ).length,
    last365DaysCount: punchRecords.filter(
      (item) => now - new Date(item.punchedAt || item.playedAt || 0).getTime() <= day365
    ).length,
  };
}

function getUnlockedBadgesByStats(stats) {
  return BADGE_RULES.filter((rule) => rule.check(stats)).map((rule) => ({
    key: rule.key,
    name: rule.name,
    description: rule.description,
  }));
}

function buildBadgeCatalog(stats) {
  const unlockedKeySet = new Set(getUnlockedBadgesByStats(stats).map((item) => item.key));
  return BADGE_RULES.map((rule) => ({
    key: rule.key,
    name: rule.name,
    description: rule.description,
    unlocked: unlockedKeySet.has(rule.key),
  }));
}

function buildDefaultProfile(profileId) {
  const stats = buildProfileStats({ totalPlayCount: 0, punchRecords: [] });
  return {
    _id: profileId,
    nickname: '档案室常客',
    level: '新客玩家',
    totalPlayCount: 0,
    badgeCount: 0,
    growthValue: 0,
    streakDays: 0,
    nextLevelHint: '再完成 3 次真实场次打卡即可解锁下一等级',
    recentThemes: [],
    perks: ['生日月专属福利', '新主题优先报名', '老客夜场券'],
    contactPhone: '',
    avatarUrl: '',
    signature: '还没有留下签名，等你写下第一句档案备注。',
    gender: 'not_set',
    badges: [],
    badgeCatalog: buildBadgeCatalog(stats),
    redeemedCodes: [],
    punchRecords: [],
    lastPlayedAt: '',
    createdAt: '',
    updatedAt: '',
  };
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
  };
}

function shouldFallbackToDefaultProfile(error) {
  const message = String(
    (error && (error.errMsg || error.message || error.error)) || ''
  ).toLowerCase();

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
  normalizeProfile,
  shouldFallbackToDefaultProfile,
};
