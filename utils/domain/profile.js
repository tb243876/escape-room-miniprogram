'use strict';

const mockData = require('../../mock/data');
const storage = require('../platform/storage');

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
    description: '完成第 1 次真实场次',
    check: (stats) => stats.totalPlayCount >= 1,
  },
  {
    key: 'badge-three',
    name: '连闯三场',
    description: '累计完成 3 次真实场次',
    check: (stats) => stats.totalPlayCount >= 3,
  },
  {
    key: 'badge-five',
    name: '进阶玩家',
    description: '累计完成 5 次真实场次',
    check: (stats) => stats.totalPlayCount >= 5,
  },
  {
    key: 'badge-ten',
    name: '馆藏玩家',
    description: '累计完成 10 次真实场次',
    check: (stats) => stats.totalPlayCount >= 10,
  },
  {
    key: 'badge-theme-tonglingren',
    name: '直面瞳灵',
    description: '完成瞳灵人主题',
    check: (stats) => stats.themeSet.has('瞳灵人'),
  },
  {
    key: 'badge-theme-wenchuan',
    name: '返校档案',
    description: '完成文川中学主题',
    check: (stats) => stats.themeSet.has('文川中学'),
  },
  {
    key: 'badge-micro',
    name: '微恐起步',
    description: '完成 1 次微恐主题',
    check: (stats) => stats.horrorLevelSet.has('微恐'),
  },
  {
    key: 'badge-middle',
    name: '中恐进场',
    description: '完成 1 次中恐主题',
    check: (stats) => stats.horrorLevelSet.has('中恐'),
  },
  {
    key: 'badge-heavy',
    name: '重恐认证',
    description: '完成 1 次重恐主题',
    check: (stats) => stats.horrorLevelSet.has('重恐'),
  },
  {
    key: 'badge-all-levels',
    name: '全级别通关',
    description: '完成微恐、中恐、重恐三档主题',
    check: (stats) => ['微恐', '中恐', '重恐'].every((level) => stats.horrorLevelSet.has(level)),
  },
  {
    key: 'badge-late-night',
    name: '深夜留档',
    description: '完成 1 次深夜场主题',
    check: (stats) => stats.lateNightCount >= 1,
  },
  {
    key: 'badge-night-owl',
    name: '夜行常客',
    description: '累计完成 3 次深夜场主题',
    check: (stats) => stats.lateNightCount >= 3,
  },
  {
    key: 'badge-team-play',
    name: '组队入局',
    description: '完成 1 次 4 人及以上组队场',
    check: (stats) => stats.teamPlayCount >= 1,
  },
  {
    key: 'badge-full-squad',
    name: '满编开场',
    description: '累计完成 3 次 4 人及以上组队场',
    check: (stats) => stats.teamPlayCount >= 3,
  },
  {
    key: 'badge-duo-play',
    name: '双人胆量',
    description: '完成 1 次双人场主题',
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
    description: '30 天内完成 3 次真实场次',
    check: (stats) => stats.last30DaysCount >= 3,
  },
  {
    key: 'badge-year-archive',
    name: '年度常客',
    description: '365 天内完成 6 次真实场次',
    check: (stats) => stats.last365DaysCount >= 6,
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

function cloneDefaultProfile() {
  return {
    _id: '',
    nickname: '档案室常客',
    avatarUrl: '',
    signature: '先把第一场真实体验写进自己的档案里。',
    gender: 'not_set',
    genderText: '未设置',
    titleLabel: '新客玩家',
    honorLabels: ['新档案建立'],
    level: '新客玩家',
    totalPlayCount: 0,
    badgeCount: 0,
    growthValue: 0,
    streakDays: 0,
    nextLevelHint: '再完成 3 次真实场次即可解锁下一等级',
    recentThemes: [],
    perks: ['生日月专属福利', '新主题优先报名', '老客夜场券'],
    contactPhone: '',
    avatarText: '档',
    badges: [],
    redeemedCodes: [],
    punchRecords: [],
    lastPlayedAt: '',
    createdAt: '',
    updatedAt: '',
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
    return '你已经达到当前第一版最高等级，继续体验会累计更多主题档案。';
  }
  const remain = current.nextMin - totalPlayCount;
  return `再完成 ${remain} 次真实场次即可解锁下一等级`;
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

function buildEditableProfilePatch(payload = {}) {
  const nickname = String(payload.nickname || '').trim();
  const signature = String(payload.signature || '').trim();
  const gender = String(payload.gender || '').trim();
  const avatarUrl = String(payload.avatarUrl || '').trim();

  return {
    nickname: nickname.slice(0, 12) || '新入档玩家',
    signature: signature.slice(0, 40) || '还没有留下签名，等你写下第一句档案备注。',
    gender: GENDER_LABELS[gender] ? gender : 'not_set',
    avatarUrl,
  };
}

function buildProfileStats(profile) {
  const playRecords = getPlayRecords(profile);
  const now = Date.now();
  const day30 = 30 * 24 * 60 * 60 * 1000;
  const day365 = 365 * 24 * 60 * 60 * 1000;
  const totalPlayCount = playRecords.length || Number(profile.totalPlayCount || 0);

  return {
    totalPlayCount,
    playRecords,
    themeSet: new Set(playRecords.map((item) => item.themeName)),
    uniqueThemeCount: new Set(playRecords.map((item) => item.themeName)).size,
    horrorLevelSet: new Set(playRecords.map((item) => item.horror).filter(Boolean)),
    lateNightCount: playRecords.filter((item) => item.lateNight).length,
    teamPlayCount: playRecords.filter((item) => Number(item.teamSize || 0) >= 4).length,
    duoPlayCount: playRecords.filter((item) => Number(item.teamSize || 0) === 2).length,
    last30DaysCount: playRecords.filter(
      (item) => now - new Date(item.playedAt || item.punchedAt).getTime() <= day30
    ).length,
    last365DaysCount: playRecords.filter(
      (item) => now - new Date(item.playedAt || item.punchedAt).getTime() <= day365
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

function normalizeProfile(profile) {
  const baseProfile = {
    ...cloneDefaultProfile(),
    ...profile,
  };
  const playRecords = getPlayRecords(baseProfile);
  const totalPlayCount = playRecords.length || Number(baseProfile.totalPlayCount || 0);
  const levelInfo = getLevelInfo(totalPlayCount);
  const stats = buildProfileStats({
    ...baseProfile,
    totalPlayCount,
    playRecords,
  });
  const badges = getUnlockedBadgesByStats(stats);
  const badgeCatalog = buildBadgeCatalog(stats);
  const nickname = getSafeNickname(baseProfile);
  const gender = GENDER_LABELS[baseProfile.gender] ? baseProfile.gender : 'not_set';
  const growthValue = Number(baseProfile.growthValue || totalPlayCount * 12);
  const titleLabel = buildTitleLabel(baseProfile, stats, badges);
  const honorLabels = buildHonorLabels(baseProfile, stats, badges);
  const signature =
    String(baseProfile.signature || '').trim() ||
    '还没有留下签名，等你写下第一句档案备注。';

  return {
    ...baseProfile,
    nickname,
    avatarText: buildAvatarText({ nickname }),
    gender,
    genderText: buildGenderText(gender),
    signature,
    titleLabel,
    honorLabels,
    totalPlayCount,
    level: levelInfo.name,
    badgeCount: badges.length,
    growthValue,
    badges,
    badgeCatalog,
    nextLevelHint: buildNextLevelHint(totalPlayCount),
    recentThemes: Array.isArray(baseProfile.recentThemes) ? baseProfile.recentThemes : [],
    playRecords,
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
  return normalized;
}

function getPendingProfilePatch() {
  const stored = storage.safeGetStorage(storage.PROFILE_SYNC_STORAGE_KEY);
  if (!stored || !stored.pendingPatch) {
    return null;
  }
  return {
    pendingPatch: buildEditableProfilePatch(stored.pendingPatch),
    updatedAt: Number(stored.updatedAt || 0),
  };
}

function savePendingProfilePatch(patch = {}) {
  const pendingPatch = buildEditableProfilePatch(patch);
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
  return {
    ...profile,
    ...buildEditableProfilePatch(patch),
  };
}

function isEditablePatchApplied(profile = {}, patch = {}) {
  const normalizedPatch = buildEditableProfilePatch(patch);
  return (
    String(profile.nickname || '') === normalizedPatch.nickname &&
    String(profile.signature || '') === normalizedPatch.signature &&
    String(profile.gender || 'not_set') === normalizedPatch.gender &&
    String(profile.avatarUrl || '') === normalizedPatch.avatarUrl
  );
}

function updateLocalProfile(patch = {}) {
  const current = getLocalProfile();
  return saveLocalProfile(applyEditablePatch(current, patch));
}

function buildPlayerCard(player = {}) {
  const normalized = normalizeProfile({
    ...cloneDefaultProfile(),
    ...player,
  });

  return {
    nickname: normalized.nickname,
    avatarUrl: normalized.avatarUrl || '',
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

  const player = (mockData.playerProfiles || []).find((item) => item.nickname === normalizedNickname);
  if (player) {
    return buildPlayerCard(player);
  }

  const leaderboardPlayer = (mockData.leaderboard || []).find(
    (item) => item.nickname === normalizedNickname
  );
  if (leaderboardPlayer) {
    return buildPlayerCard({
      nickname: leaderboardPlayer.nickname,
      totalPlayCount: leaderboardPlayer.playedCount,
      badgeCount: leaderboardPlayer.badgeCount,
      growthValue: leaderboardPlayer.growthValue,
      honorLabels: ['榜单玩家'],
      signature: '这位玩家还没有写下自己的签名。',
    });
  }

  return buildPlayerCard({
    nickname: normalizedNickname,
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
  buildPlayerCard,
  getPlayerCardByNickname,
};
