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

function buildDefaultProfile(profileId) {
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
    redeemedCodes: [],
    punchRecords: [],
    perks: ['生日月专属福利', '新主题优先报名', '老客夜场券'],
    contactPhone: '',
    avatarUrl: '',
    signature: '还没有留下签名，等你写下第一句档案备注。',
    gender: 'not_set',
    badges: [],
    badgeCatalog: [],
    lastPlayedAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
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

function buildStats(profile = {}) {
  const punchRecords = Array.isArray(profile.punchRecords) ? profile.punchRecords : [];
  const now = Date.now();
  const day30 = 30 * 24 * 60 * 60 * 1000;
  const day365 = 365 * 24 * 60 * 60 * 1000;
  return {
    totalPlayCount: punchRecords.length || Number(profile.totalPlayCount || 0),
    themeSet: new Set(punchRecords.map((item) => item.themeName)),
    uniqueThemeCount: new Set(punchRecords.map((item) => item.themeName)).size,
    horrorLevelSet: new Set(punchRecords.map((item) => item.horror).filter(Boolean)),
    lateNightCount: punchRecords.filter((item) => item.lateNight).length,
    teamPlayCount: punchRecords.filter((item) => Number(item.teamSize || 0) >= 4).length,
    duoPlayCount: punchRecords.filter((item) => Number(item.teamSize || 0) === 2).length,
    last30DaysCount: punchRecords.filter(
      (item) => now - new Date(item.punchedAt || item.playedAt).getTime() <= day30
    ).length,
    last365DaysCount: punchRecords.filter(
      (item) => now - new Date(item.punchedAt || item.playedAt).getTime() <= day365
    ).length,
  };
}

function buildBadgeCount(profile = {}) {
  const stats = buildStats(profile);
  return BADGE_RULES.filter((rule) => rule.check(stats)).length;
}

function buildNextStreakDays(profile = {}, playedAt) {
  const previous = String(profile.lastPlayedAt || '');
  if (!previous) {
    return 1;
  }

  const previousDate = new Date(previous);
  const currentDate = new Date(playedAt);
  previousDate.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);
  const diff = Math.round((currentDate.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000));

  if (diff <= 0) {
    return Math.max(1, Number(profile.streakDays || 0));
  }
  if (diff === 1) {
    return Math.max(1, Number(profile.streakDays || 0)) + 1;
  }
  return 1;
}

function buildSessionRecord(session = {}) {
  const stageEndedAt = session.endedAt || new Date().toISOString();
  return {
    recordId: `session-${session.id || session._id || ''}`,
    themeId: session.themeId || '',
    themeName: session.themeName || '',
    horror: session.horror || '',
    teamSize: Number(session.teamSize || 0),
    lateNight: Boolean(session.lateNight),
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
    return {
      ...baseProfile,
      totalPlayCount,
      badgeCount: buildBadgeCount(baseProfile),
      level: getLevelInfo(totalPlayCount).name,
      updatedAt: new Date().toISOString(),
    };
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
  nextProfile.level = getLevelInfo(nextProfile.totalPlayCount).name;
  return nextProfile;
}

function buildHonorLabels(profile = {}, totalPlayCount = 0) {
  if (Array.isArray(profile.honorLabels) && profile.honorLabels.length) {
    return profile.honorLabels.slice(0, 3);
  }

  const honors = [];
  if (totalPlayCount >= 10) {
    honors.push('馆藏玩家');
  } else if (totalPlayCount >= 3) {
    honors.push('沉浸玩家');
  } else if (totalPlayCount >= 1) {
    honors.push('入档玩家');
  }

  if (Array.isArray(profile.recentThemes) && profile.recentThemes[0]) {
    honors.push(`最近体验 ${profile.recentThemes[0]}`);
  }

  if (!honors.length) {
    honors.push('新档案建立');
  }

  return honors.slice(0, 3);
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
  const badgeCount = buildBadgeCount(baseProfile);
  const nickname = String(baseProfile.nickname || '').trim() || '档案室常客';

  return {
    openId: String(baseProfile._id || ''),
    nickname,
    avatarUrl: String(baseProfile.avatarUrl || '').trim(),
    avatarText: nickname.slice(0, 1),
    signature:
      String(baseProfile.signature || '').trim() ||
      '还没有留下签名，等你写下第一句档案备注。',
    gender: ['male', 'female', 'not_set'].includes(String(baseProfile.gender || ''))
      ? baseProfile.gender
      : 'not_set',
    genderText: GENDER_LABELS[String(baseProfile.gender || '')] || GENDER_LABELS.not_set,
    titleLabel: String(baseProfile.level || '').trim() || getLevelInfo(totalPlayCount).name,
    honorLabels: buildHonorLabels(baseProfile, totalPlayCount),
    totalPlayCount,
    badgeCount,
    growthValue: Number(baseProfile.growthValue || 0),
    summaryText: `已通关 ${totalPlayCount} 次 · 点亮 ${badgeCount} 枚徽章`,
  };
}

module.exports = {
  buildDefaultProfile,
  applySessionSettlement,
  buildBadgeCount,
  buildProfileCard,
};
