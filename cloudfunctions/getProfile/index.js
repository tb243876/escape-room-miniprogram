'use strict';

const cloud = require('wx-server-sdk');
const profileDomain = require('./profile-domain');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

function normalizeOpenIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 12)
    )
  );
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const profileId = wxContext.OPENID;
  const action = String(event.action || '').trim();

  if (!profileId) {
    return {
      ok: false,
      message: '当前身份校验失败，请重新进入小程序后再试',
    };
  }

  try {
    if (action === 'listProfiles') {
      const openIds = normalizeOpenIdList(event.openIds);
      if (!openIds.length) {
        return {
          ok: true,
          profiles: [],
        };
      }

      const result = await db
        .collection('profiles')
        .where({
          _id: _.in(openIds),
        })
        .get();

      const foundMap = new Map(
        (result.data || []).map((item) => [String(item._id || '').trim(), item])
      );
      const profiles = openIds.map((id) => {
        const found = foundMap.get(id);
        if (found) {
          return profileDomain.normalizeProfile(found);
        }
        return profileDomain.normalizeProfile(profileDomain.buildDefaultProfile(id));
      });

      return {
        ok: true,
        profiles,
      };
    }

    const result = await db
      .collection('profiles')
      .where({
        _id: profileId,
      })
      .limit(1)
      .get();
    const profile =
      result.data && result.data.length
        ? profileDomain.normalizeProfile(result.data[0])
        : profileDomain.buildDefaultProfile(profileId);
    return {
      ok: true,
      profile,
    };
  } catch (error) {
    if (profileDomain.shouldFallbackToDefaultProfile(error)) {
      return {
        ok: true,
        profile: profileDomain.buildDefaultProfile(profileId),
      };
    }

    console.error('getProfile failed:', {
      message: error.message,
      stack: error.stack,
      profileId,
    });
    return {
      ok: false,
      message: '档案读取失败，请稍后重试',
    };
  }
};
