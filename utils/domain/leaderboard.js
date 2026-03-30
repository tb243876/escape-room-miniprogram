'use strict';

const mockData = require('../../mock/data');
const profileService = require('./profile');

function normalizeLeaderboardItem(item = {}, index) {
  const rank = Number(item.rank || index + 1);
  const growthValue = Number(item.growthValue || 0);
  const playedCount = Number(item.playedCount || 0);
  const badgeCount = Number(item.badgeCount || 0);
  const streakDays = Number(item.streakDays || 0);
  const nickname = item.nickname || `玩家 ${rank}`;
  const profileCard = item.titleLabel
    ? {
        nickname,
        avatarUrl: item.avatarUrl || '',
        avatarText: item.avatarText || String(nickname).slice(0, 1),
        signature: item.signature || '这位玩家还没有公开更多档案信息。',
        genderText: item.genderText || '未设置',
        titleLabel: item.titleLabel || '',
        honorLabels: Array.isArray(item.honorLabels) ? item.honorLabels : [],
        totalPlayCount: playedCount,
        badgeCount,
        growthValue,
        summaryText: item.summaryText || `已玩 ${playedCount} 场 · 徽章 ${badgeCount} 枚 · 连续活跃 ${streakDays} 天`,
      }
    : buildMockProfileCard(item, rank);

  return {
    openId: item.openId || '',
    rank,
    nickname,
    avatarUrl: profileCard.avatarUrl || '',
    avatarText: profileCard.avatarText || String(nickname).slice(0, 1),
    growthValue,
    playedCount,
    badgeCount,
    streakDays,
    titleLabel: profileCard.titleLabel || '',
    signature: profileCard.signature || '',
    genderText: profileCard.genderText || '未设置',
    honorLabels: Array.isArray(profileCard.honorLabels) ? profileCard.honorLabels : [],
    playerCard: profileCard,
    medalText: rank === 1 ? 'TOP1' : rank === 2 ? 'TOP2' : rank === 3 ? 'TOP3' : `NO.${rank}`,
    cardClass: rank <= 3 ? `leaderboard-card-top leaderboard-card-top-${rank}` : 'leaderboard-card-regular',
    summaryText: `已玩 ${playedCount} 场 · 徽章 ${badgeCount} 枚 · 连续活跃 ${streakDays} 天`,
  };
}

function buildMockProfileCard(item = {}, rank = 1) {
  const nickname = item.nickname || `玩家 ${rank}`;
  const fromMockProfile = (mockData.playerProfiles || []).find(
    (player) => String(player.nickname || '') === String(nickname || '')
  );
  if (fromMockProfile) {
    return profileService.buildPlayerCard({
      ...fromMockProfile,
      nickname,
      totalPlayCount: Number(item.playedCount || fromMockProfile.totalPlayCount || 0),
      badgeCount: Number(item.badgeCount || fromMockProfile.badgeCount || 0),
      growthValue: Number(item.growthValue || fromMockProfile.growthValue || 0),
    });
  }
  return profileService.getPlayerCardByNickname(nickname);
}

function normalizeLeaderboardList(list = []) {
  return (list || []).map(normalizeLeaderboardItem);
}

function buildLeaderboardSummary(list = []) {
  const normalizedList = normalizeLeaderboardList(list);
  const totalPlayers = normalizedList.length;
  const totalGrowth = normalizedList.reduce((sum, item) => sum + item.growthValue, 0);
  const totalBadges = normalizedList.reduce((sum, item) => sum + item.badgeCount, 0);

  return {
    totalPlayers,
    totalGrowth,
    totalBadges,
  };
}

module.exports = {
  normalizeLeaderboardItem,
  normalizeLeaderboardList,
  buildLeaderboardSummary,
};
