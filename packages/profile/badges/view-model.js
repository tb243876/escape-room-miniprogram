'use strict';

function normalizeBadgeCatalog(profile) {
  return {
    ...(profile || {}),
    badgeCatalog: ((profile && profile.badgeCatalog) || []).map((item) => ({
      ...item,
      badgeStateText: item.unlocked ? '已点亮' : '待解锁',
      badgeItemClass: item.unlocked ? 'profile-badge-unlocked' : 'profile-badge-locked',
      badgeIconClass: item.unlocked ? 'profile-badge-icon-unlocked' : 'profile-badge-icon-locked',
      description: item.unlocked
        ? item.unlockedDescription || item.description
        : item.description,
    })),
  };
}

module.exports = {
  normalizeBadgeCatalog,
};
