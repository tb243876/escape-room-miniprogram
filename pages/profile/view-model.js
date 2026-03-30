'use strict';

function normalizeBadgeCatalog(profile) {
  return ((profile && profile.badgeCatalog) || []).map((item) => ({
    ...item,
    overlayItemClass: item.unlocked ? 'overlay-badge-item-on' : 'overlay-badge-item-off',
    overlayIconText: item.unlocked ? '徽' : '待',
    detailKicker: item.unlocked ? '已获得' : '未解锁',
    detailMedalClass: item.unlocked ? 'badge-detail-medal-on' : 'badge-detail-medal-off',
    detailMedalText: item.unlocked ? '徽' : '待',
  }));
}

function normalizeProfile(profile) {
  if (!profile) {
    return null;
  }
  return {
    ...profile,
    badgeCatalog: normalizeBadgeCatalog(profile),
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
