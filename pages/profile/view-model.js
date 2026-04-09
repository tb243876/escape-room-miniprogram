'use strict';

const profileService = require('../../utils/domain/profile');

function normalizeBadgeCatalog(normalizedProfile) {
  return ((normalizedProfile && normalizedProfile.badgeCatalog) || []).map((item) => ({
    ...item,
    overlayItemClass: item.unlocked ? 'overlay-badge-item-on' : 'overlay-badge-item-off',
    overlayIconText: item.unlocked ? '徽' : '待',
    detailKicker: item.unlocked ? '已获得' : '解锁条件',
    detailMedalClass: item.unlocked ? 'badge-detail-medal-on' : 'badge-detail-medal-off',
    detailMedalText: item.unlocked ? '徽' : '待',
    displayDescription: item.unlocked
      ? item.unlockedDescription || item.description
      : item.description,
  }));
}

function normalizeProfile(profile) {
  if (!profile) {
    return null;
  }
  const normalizedProfile = profileService.normalizeProfile(profile);
  const unlockedBadges = ((normalizedProfile && normalizedProfile.badgeCatalog) || []).filter(
    (item) => item.unlocked
  );
  const recentPlayRecords = ((normalizedProfile && normalizedProfile.playRecords) || [])
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(
        left.punchedAt || left.playedAt || left.endedAt || left.startedAt || 0
      ).getTime();
      const rightTime = new Date(
        right.punchedAt || right.playedAt || right.endedAt || right.startedAt || 0
      ).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      recordKey: item.recordId || `record-${index}`,
      displayThemeName: item.themeName || '未知主题',
      displayDateText: String(
        item.punchedAt || item.playedAt || item.endedAt || item.startedAt || ''
      )
        .replace('T', ' ')
        .slice(0, 16),
    }));
  return {
    ...normalizedProfile,
    badgeCatalog: normalizeBadgeCatalog(normalizedProfile),
    displayLabelList: Array.isArray(normalizedProfile.displayLabelList)
      ? normalizedProfile.displayLabelList
      : [],
    unlockedBadgeList: unlockedBadges,
    recentPlayPreview: recentPlayRecords,
  };
}

function findSelectedBadge(profile, key) {
  const badgeCatalog = profile && Array.isArray(profile.badgeCatalog) ? profile.badgeCatalog : [];
  return badgeCatalog.find((item) => item.key === key) || null;
}

module.exports = {
  normalizeProfile,
  findSelectedBadge,
};
