'use strict';

const cloud = require('wx-server-sdk');
const {
  normalizeDataEnvTag,
  getCollectionName,
  stripInternalId,
} = require('./utils');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
function buildDefaultReputationMeta() {
  return {
    penaltyTotal: 0,
    creatorCancelCount: 0,
    creatorLateCancelCount: 0,
    recentCreatorCancelTimestamps: [],
    lastPenaltyAt: '',
    lastPenaltyReason: '',
    lastCancelWindowHours: 0,
  };
}

const DEFAULT_PROFILE_FIELDS = {
  nickname: '档案室常客',
  signature: '还没有留下签名，等你写下第一句档案备注。',
  gender: 'not_set',
  avatarUrl: '',
  displayLabels: [],
  wishThemes: [],
  shareStats: {
    shareCount: 0,
  },
  challengeStats: {
    completedCount: 0,
    allCompleted: false,
  },
  badgeSignals: {
    joinedDuringOpeningWindow: false,
    fastestRunCount: 0,
    failedEscapeCount: 0,
  },
  reputationMeta: buildDefaultReputationMeta(),
};

function sanitizeText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function buildEditableProfilePatch(event = {}) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(event, 'nickname')) {
    const nickname = sanitizeText(event.nickname, 12);
    patch.nickname = nickname || '新入档玩家';
  }
  if (Object.prototype.hasOwnProperty.call(event, 'signature')) {
    const signature = sanitizeText(event.signature, 40);
    patch.signature = signature || '还没有留下签名，等你写下第一句档案备注。';
  }
  if (Object.prototype.hasOwnProperty.call(event, 'gender')) {
    const gender = String(event.gender || '').trim();
    patch.gender = ['male', 'female', 'not_set'].includes(gender) ? gender : 'not_set';
  }
  if (Object.prototype.hasOwnProperty.call(event, 'avatarUrl')) {
    const rawAvatarUrl = String(event.avatarUrl || '').trim();
    patch.avatarUrl = sanitizeAvatarUrl(rawAvatarUrl);
  }
  return patch;
}

function normalizeWishTheme(theme = {}) {
  const id = String(theme.id || theme.themeId || '').trim();
  if (!id) {
    return null;
  }
  return {
    id,
    name: sanitizeText(theme.name || theme.themeName || '未命名主题', 24) || '未命名主题',
    horror: sanitizeText(theme.horror, 12),
    people: sanitizeText(theme.people, 12),
    duration: sanitizeText(theme.duration, 12),
    coverImage: sanitizeAvatarUrl(theme.coverImage || ''),
    slogan: sanitizeText(theme.slogan, 40),
    addedAt: String(theme.addedAt || new Date().toISOString()).trim(),
  };
}

function buildProfileMetaPatch(event = {}) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(event, 'displayLabels')) {
    patch.displayLabels = (Array.isArray(event.displayLabels) ? event.displayLabels : [])
      .map((item) => sanitizeText(item, 20))
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index)
      .slice(0, 3);
  }
  if (Object.prototype.hasOwnProperty.call(event, 'wishThemes')) {
    patch.wishThemes = (Array.isArray(event.wishThemes) ? event.wishThemes : [])
      .map(normalizeWishTheme)
      .filter(Boolean)
      .slice(0, 20);
  }
  if (Object.prototype.hasOwnProperty.call(event, 'shareStats')) {
    const shareStats = event.shareStats || {};
    patch.shareStats = {
      shareCount: Math.max(0, Number(shareStats.shareCount || 0)),
    };
  }
  if (Object.prototype.hasOwnProperty.call(event, 'challengeStats')) {
    const challengeStats = event.challengeStats || {};
    patch.challengeStats = {
      completedCount: Math.max(0, Number(challengeStats.completedCount || 0)),
      allCompleted: Boolean(challengeStats.allCompleted),
    };
  }
  if (Object.prototype.hasOwnProperty.call(event, 'badgeSignals')) {
    const badgeSignals = event.badgeSignals || {};
    patch.badgeSignals = {
      joinedDuringOpeningWindow: Boolean(badgeSignals.joinedDuringOpeningWindow),
      fastestRunCount: Math.max(0, Number(badgeSignals.fastestRunCount || 0)),
      failedEscapeCount: Math.max(0, Number(badgeSignals.failedEscapeCount || 0)),
    };
  }
  return patch;
}

function buildProfilePatch(event = {}, currentProfile = {}) {
  const editablePatch = buildEditableProfilePatch(event);
  const metaPatch = buildProfileMetaPatch(event);
  return {
    ...editablePatch,
    ...(Object.prototype.hasOwnProperty.call(metaPatch, 'displayLabels')
      ? { displayLabels: metaPatch.displayLabels }
      : {}),
    ...(metaPatch.wishThemes ? { wishThemes: metaPatch.wishThemes } : {}),
    ...(metaPatch.shareStats
      ? {
          shareStats: {
            ...((currentProfile && currentProfile.shareStats) || {}),
            ...metaPatch.shareStats,
          },
        }
      : {}),
    ...(metaPatch.challengeStats
      ? {
          challengeStats: {
            ...((currentProfile && currentProfile.challengeStats) || {}),
            ...metaPatch.challengeStats,
          },
        }
      : {}),
    ...(metaPatch.badgeSignals
      ? {
          badgeSignals: {
            ...((currentProfile && currentProfile.badgeSignals) || {}),
            ...metaPatch.badgeSignals,
          },
        }
      : {}),
  };
}

function sanitizeAvatarUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  const lower = url.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('wxfile:') ||
    lower.startsWith('file:') ||
    lower.startsWith('weixin:') ||
    lower.startsWith('/private/') ||
    lower.startsWith('/var/')
  ) {
    return '';
  }
  return url.slice(0, 512);
}

function fail(errorCode, message, retryable = false) {
  return {
    ok: false,
    errorCode,
    message,
    retryable,
  };
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const profileId = wxContext.OPENID;
  const profileCollectionName = getCollectionName(
    'profiles',
    normalizeDataEnvTag(event.__dataEnvTag)
  );

  if (!profileId) {
    return fail('AUTH_OPENID_MISSING', '当前身份校验失败，请重新进入小程序后再试');
  }

  const now = new Date().toISOString();

  try {
    const profileRef = db.collection(profileCollectionName).doc(profileId);
    let currentProfile = null;

    try {
      const result = await profileRef.get();
      currentProfile = result && result.data ? result.data : null;
    } catch (error) {
      currentProfile = null;
    }

    const patch = buildProfilePatch(event, currentProfile || DEFAULT_PROFILE_FIELDS);

    if (!currentProfile) {
      const nextProfile = {
        _id: profileId,
        ...DEFAULT_PROFILE_FIELDS,
        ...patch,
        createdAt: now,
        updatedAt: now,
      };
      await profileRef.set({
        data: stripInternalId(nextProfile),
      });
      return {
        ok: true,
        profile: nextProfile,
      };
    }

    const nextProfile = {
      ...currentProfile,
      ...patch,
      _id: profileId,
      updatedAt: now,
    };

    await profileRef.update({
      data: {
        ...patch,
        updatedAt: now,
      },
    });

    return {
      ok: true,
      profile: nextProfile,
    };
  } catch (error) {
    console.error('updateProfile failed:', {
      message: error.message,
      stack: error.stack,
      profileId,
    });
    return fail('PROFILE_SAVE_FAILED', '个人资料保存失败，请稍后重试', true);
  }
};
