'use strict';

const cloud = require('wx-server-sdk');
const profileDomain = require('./profile-domain');
const { normalizeDataEnvTag, getCollectionName } = require('./utils');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const FULL_SCAN_REBUILD_THRESHOLD = 500;

function isCloudFileId(value) {
  return String(value || '').trim().startsWith('cloud://');
}

async function buildTempAvatarUrlMap(list = []) {
  const fileList = Array.from(
    new Set(
      (list || [])
        .map((item) => String((item && item.avatarUrl) || '').trim())
        .filter((item) => isCloudFileId(item))
    )
  );
  if (!fileList.length || typeof cloud.getTempFileURL !== 'function') {
    return new Map();
  }

  try {
    const result = await cloud.getTempFileURL({
      fileList,
    });
    return new Map(
      ((result && result.fileList) || []).map((item) => [
        String(item.fileID || '').trim(),
        String(item.tempFileURL || '').trim(),
      ])
    );
  } catch (error) {
    console.warn('getLeaderboard: buildTempAvatarUrlMap failed', {
      count: fileList.length,
      message: error && error.message,
    });
    return new Map();
  }
}

async function listProfiles(profileCollectionName) {
  const collection = db.collection(profileCollectionName);
  const countResult = await collection.count();
  const total = Number((countResult && countResult.total) || 0);
  // Current leaderboard is a small-data implementation: full-scan, in-memory sort, then paginate.
  // If player count grows beyond this threshold, switch to database-side ordering or snapshot tables.
  if (total > FULL_SCAN_REBUILD_THRESHOLD) {
    console.warn('getLeaderboard using full-scan mode beyond threshold:', {
      profileCollectionName,
      total,
      threshold: FULL_SCAN_REBUILD_THRESHOLD,
    });
  }
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

function fail(errorCode, message, retryable = false) {
  return {
    ok: false,
    errorCode,
    message,
    retryable,
  };
}

function normalizePageSize(value) {
  const pageSize = Number(value || 20);
  if (!Number.isFinite(pageSize)) {
    return 20;
  }
  return Math.min(50, Math.max(1, Math.floor(pageSize)));
}

function normalizePageToken(value) {
  const offset = Number(value || 0);
  if (!Number.isFinite(offset)) {
    return 0;
  }
  return Math.max(0, Math.floor(offset));
}

exports.main = async (event = {}) => {
  try {
    const pageSize = normalizePageSize(event.pageSize);
    const offset = normalizePageToken(event.pageToken);
    const profileCollectionName = getCollectionName(
      'profiles',
      normalizeDataEnvTag(event.__dataEnvTag)
    );
    const period = String(event.period || 'total').trim();
    const profiles = await listProfiles(profileCollectionName);
    const normalizedProfiles = profiles.map(profileDomain.normalizeProfile);

    let ranked;
    if (period === 'month') {
      const now = Date.now();
      const month30Ms = 30 * 24 * 60 * 60 * 1000;
      const cutoff = now - month30Ms;
      ranked = normalizedProfiles
        .map((p) => {
          const recentPunches = (p.punchRecords || []).filter(
            (r) => new Date(r.punchedAt || r.playedAt || 0).getTime() >= cutoff
          );
          return {
            ...p,
            growthValue: recentPunches.reduce((sum, r) => sum + Number(r.growthValue || 18), 0),
            totalPlayCount: recentPunches.length,
          };
        })
        .filter((p) => p.totalPlayCount > 0)
        .sort((left, right) => {
          const growthGap = Number(right.growthValue || 0) - Number(left.growthValue || 0);
          if (growthGap !== 0) return growthGap;
          return Number(right.totalPlayCount || 0) - Number(left.totalPlayCount || 0);
        });
    } else {
      ranked = normalizedProfiles
        .slice()
        .sort((left, right) => {
          const growthGap = Number(right.growthValue || 0) - Number(left.growthValue || 0);
          if (growthGap !== 0) return growthGap;
          return Number(right.totalPlayCount || 0) - Number(left.totalPlayCount || 0);
        });
    }

    const rawLeaderboard = ranked.slice(offset, offset + pageSize).map((item, index) =>
      normalizeItem(item, offset + index)
    );
    const avatarUrlMap = await buildTempAvatarUrlMap(rawLeaderboard);
    const leaderboard = rawLeaderboard.map((item) => {
      const rawAvatarUrl = String(item.avatarUrl || '').trim();
      if (!isCloudFileId(rawAvatarUrl)) {
        return item;
      }
      return {
        ...item,
        avatarUrl: avatarUrlMap.get(rawAvatarUrl) || '',
        avatarFileId: rawAvatarUrl,
      };
    });
    const summary = {
      totalPlayers: ranked.length,
      totalGrowth: ranked.reduce((sum, item) => sum + Number(item.growthValue || 0), 0),
      totalBadges: ranked.reduce((sum, item) => sum + Number(item.badgeCount || 0), 0),
      totalPlayed: ranked.reduce((sum, item) => sum + Number(item.totalPlayCount || 0), 0),
      period,
    };
    const nextOffset = offset + leaderboard.length;

    return {
      ok: true,
      leaderboard,
      summary,
      pageToken: String(offset),
      pageSize,
      nextPageToken: nextOffset < ranked.length ? String(nextOffset) : '',
      hasMore: nextOffset < ranked.length,
    };
  } catch (error) {
    console.error('getLeaderboard failed:', {
      message: error.message,
      stack: error.stack,
    });
    return fail('LEADERBOARD_READ_FAILED', '排行榜加载失败，请稍后重试', true);
  }
};
