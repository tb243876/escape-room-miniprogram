'use strict';

const cloud = require('wx-server-sdk');
const profileDomain = require('./profile-domain');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

async function listProfiles() {
  const collection = db.collection('profiles');
  const countResult = await collection.count();
  const total = Number((countResult && countResult.total) || 0);
  const pageSize = 100;
  const jobs = [];

  for (let offset = 0; offset < total; offset += pageSize) {
    jobs.push(collection.skip(offset).limit(pageSize).get());
  }

  if (!jobs.length) {
    return [];
  }

  const results = await Promise.all(jobs);
  return results.reduce((list, item) => list.concat(item.data || []), []);
}

function normalizeItem(item = {}, index = 0) {
  const rank = index + 1;
  const profile = profileDomain.normalizeProfile(item);
  const growthValue = Number(profile.growthValue || 0);
  const playedCount = Number(profile.totalPlayCount || 0);
  const badgeCount = Number(profile.badgeCount || 0);
  const streakDays = Number(profile.streakDays || 0);

  return {
    openId: String(profile._id || ''),
    rank,
    nickname: profile.nickname || `玩家 ${rank}`,
    avatarUrl: profile.avatarUrl || '',
    avatarText: profile.avatarText || String((profile.nickname || `玩家 ${rank}`).slice(0, 1)),
    growthValue,
    playedCount,
    badgeCount,
    streakDays,
    titleLabel: profile.titleLabel || '',
    signature: profile.signature || '',
    genderText: profile.genderText || '未设置',
    honorLabels: Array.isArray(profile.honorLabels) ? profile.honorLabels : [],
    medalText: rank === 1 ? 'TOP1' : rank === 2 ? 'TOP2' : rank === 3 ? 'TOP3' : `NO.${rank}`,
    cardClass: rank <= 3 ? `leaderboard-card-top leaderboard-card-top-${rank}` : 'leaderboard-card-regular',
    summaryText: `已玩 ${playedCount} 场 · 徽章 ${badgeCount} 枚 · 连续活跃 ${streakDays} 天`,
  };
}

exports.main = async () => {
  try {
    const profiles = await listProfiles();
    const normalizedProfiles = profiles.map(profileDomain.normalizeProfile);
    const sorted = normalizedProfiles
      .slice()
      .sort((left, right) => {
        const growthGap = Number(right.growthValue || 0) - Number(left.growthValue || 0);
        if (growthGap !== 0) {
          return growthGap;
        }
        return Number(right.totalPlayCount || 0) - Number(left.totalPlayCount || 0);
      })
      .slice(0, 20);

    const leaderboard = sorted.map(normalizeItem);
    const summary = {
      totalPlayers: normalizedProfiles.length,
      totalGrowth: normalizedProfiles.reduce((sum, item) => sum + Number(item.growthValue || 0), 0),
      totalBadges: normalizedProfiles.reduce((sum, item) => sum + Number(item.badgeCount || 0), 0),
    };

    return {
      ok: true,
      leaderboard,
      summary,
    };
  } catch (error) {
    console.error('getLeaderboard failed:', {
      message: error.message,
      stack: error.stack,
    });
    return {
      ok: false,
      message: '排行榜加载失败，请稍后重试',
    };
  }
};
