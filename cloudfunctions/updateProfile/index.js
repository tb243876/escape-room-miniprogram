'use strict';

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

function _stripInternalId(doc = {}) {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  const nextDoc = {
    ...doc,
  };
  delete nextDoc._id;
  return nextDoc;
}

function sanitizeText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function buildEditableProfilePatch(event = {}) {
  const nickname = sanitizeText(event.nickname, 12);
  const signature = sanitizeText(event.signature, 40);
  const gender = String(event.gender || '').trim();
  const rawAvatarUrl = String(event.avatarUrl || '').trim();
  const avatarUrl = sanitizeAvatarUrl(rawAvatarUrl);

  return {
    nickname: nickname || '新入档玩家',
    signature: signature || '还没有留下签名，等你写下第一句档案备注。',
    gender: ['male', 'female', 'not_set'].includes(gender) ? gender : 'not_set',
    avatarUrl,
  };
}

function sanitizeAvatarUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  const lower = url.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return '';
  }
  return url.slice(0, 512);
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const profileId = wxContext.OPENID;

  if (!profileId) {
    return {
      ok: false,
      message: '当前身份校验失败，请重新进入小程序后再试',
    };
  }

  const patch = buildEditableProfilePatch(event);

  try {
    const profileRef = db.collection('profiles').doc(profileId);

    try {
      await profileRef.get();
    } catch (error) {
      await profileRef.set({
        data: {
          _id: profileId,
          ...patch,
          createdAt: new Date().toISOString(),
        },
      });
      return {
        ok: true,
        profile: { _id: profileId, ...patch },
      };
    }

    await profileRef.update({
      data: patch,
    });

    return {
      ok: true,
      profile: { _id: profileId, ...patch },
    };
  } catch (error) {
    console.error('updateProfile failed:', {
      message: error.message,
      stack: error.stack,
      profileId,
    });
    return {
      ok: false,
      message: '个人资料保存失败，请稍后重试',
    };
  }
};
