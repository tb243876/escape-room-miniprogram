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
  { key: 'badge-first', name: '初次入档', description: '完成第 1 次真实场次打卡', check: (stats) => stats.totalPlayCount >= 1 },
  { key: 'badge-three', name: '连闯三场', description: '累计完成 3 次真实场次打卡', check: (stats) => stats.totalPlayCount >= 3 },
  { key: 'badge-five', name: '进阶玩家', description: '累计完成 5 次真实场次打卡', check: (stats) => stats.totalPlayCount >= 5 },
  { key: 'badge-ten', name: '馆藏玩家', description: '累计完成 10 次真实场次打卡', check: (stats) => stats.totalPlayCount >= 10 },
  { key: 'badge-theme-tonglingren', name: '直面瞳灵', description: '成功打卡瞳灵人主题', check: (stats) => stats.themeSet.has('瞳灵人') },
  { key: 'badge-theme-wenchuan', name: '返校档案', description: '成功打卡文川中学主题', check: (stats) => stats.themeSet.has('文川中学') },
  { key: 'badge-micro', name: '微恐起步', description: '完成 1 次微恐主题打卡', check: (stats) => stats.horrorLevelSet.has('微恐') },
  { key: 'badge-middle', name: '中恐进场', description: '完成 1 次中恐主题打卡', check: (stats) => stats.horrorLevelSet.has('中恐') },
  { key: 'badge-heavy', name: '重恐认证', description: '完成 1 次重恐主题打卡', check: (stats) => stats.horrorLevelSet.has('重恐') },
  {
    key: 'badge-all-levels',
    name: '全级别通关',
    description: '完成微恐、中恐、重恐三档主题打卡',
    check: (stats) => ['微恐', '中恐', '重恐'].every((level) => stats.horrorLevelSet.has(level)),
  },
  { key: 'badge-late-night', name: '深夜留档', description: '完成 1 次深夜场主题打卡', check: (stats) => stats.lateNightCount >= 1 },
  { key: 'badge-night-owl', name: '夜行常客', description: '累计完成 3 次深夜场主题打卡', check: (stats) => stats.lateNightCount >= 3 },
  { key: 'badge-team-play', name: '组队入局', description: '完成 1 次 4 人及以上组队场打卡', check: (stats) => stats.teamPlayCount >= 1 },
  { key: 'badge-full-squad', name: '满编开场', description: '累计完成 3 次 4 人及以上组队场打卡', check: (stats) => stats.teamPlayCount >= 3 },
  { key: 'badge-duo-play', name: '双人胆量', description: '完成 1 次双人场主题打卡', check: (stats) => stats.duoPlayCount >= 1 },
  { key: 'badge-theme-explorer', name: '主题探索者', description: '累计体验 3 个不同主题', check: (stats) => stats.uniqueThemeCount >= 3 },
  { key: 'badge-theme-collector', name: '主题收藏家', description: '累计体验 6 个不同主题', check: (stats) => stats.uniqueThemeCount >= 6 },
  { key: 'badge-month-sprint', name: '月度高频', description: '30 天内完成 3 次真实场次打卡', check: (stats) => stats.last30DaysCount >= 3 },
  { key: 'badge-year-archive', name: '年度常客', description: '365 天内完成 6 次真实场次打卡', check: (stats) => stats.last365DaysCount >= 6 },
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

function getPunchRecords(profile = {}) {
  return Array.isArray(profile.punchRecords) ? profile.punchRecords : [];
}

function buildStats(profile = {}) {
  const punchRecords = getPunchRecords(profile);
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

function getUnlockedBadges(stats = {}) {
  return BADGE_RULES.filter((rule) => rule.check(stats)).map((rule) => ({
    key: rule.key,
    name: rule.name,
  }));
}

function buildHonorLabels(profile = {}, stats = {}, badges = []) {
  if (Array.isArray(profile.honorLabels) && profile.honorLabels.length) {
    return profile.honorLabels.slice(0, 3);
  }

  const honors = badges.slice(0, 3).map((item) => item.name);
  if (stats.teamPlayCount >= 3) {
    honors.unshift('拼场常客');
  }
  if (stats.last30DaysCount >= 3) {
    honors.unshift('本月高频');
  }
  if (!honors.length) {
    honors.push('新档案建立');
  }
  return honors.slice(0, 3);
}

function buildTitleLabel(profile = {}, stats = {}, badges = []) {
  if (String(profile.titleLabel || '').trim()) {
    return String(profile.titleLabel).trim();
  }

  const badgeKeySet = new Set(badges.map((item) => item.key));
  if (badgeKeySet.has('badge-ten')) {
    return '馆藏巡游者';
  }
  if (badgeKeySet.has('badge-heavy')) {
    return '重恐巡游者';
  }
  if (stats.teamPlayCount >= 3) {
    return '组局指挥官';
  }
  if (stats.uniqueThemeCount >= 3) {
    return '主题探索者';
  }

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
    signature:
      String(profile.signature || '').trim() ||
      '这位玩家还没有公开更多档案信息。',
    gender: ['male', 'female', 'not_set'].includes(String(profile.gender || ''))
      ? String(profile.gender || '')
      : 'not_set',
    genderText: GENDER_LABELS[String(profile.gender || '')] || GENDER_LABELS.not_set,
    totalPlayCount: stats.totalPlayCount,
    badgeCount: badges.length,
    growthValue: Number(profile.growthValue || 0),
    streakDays: Number(profile.streakDays || 0),
    titleLabel: buildTitleLabel(profile, stats, badges),
    honorLabels: buildHonorLabels(profile, stats, badges),
  };
}

module.exports = {
  normalizeProfile,
};
