'use strict';

const cloud = require('wx-server-sdk');
const profileDomain = require('./profile-domain');
const {
  normalizeDataEnvTag,
  getCollectionName,
  stripInternalId,
} = require('./utils');

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
        // CloudBase where-in single-query limit; business batching follows the same upper bound.
        .slice(0, 12)
    )
  );
}

function countUniqueOpenIds(value) {
  if (!Array.isArray(value)) {
    return 0;
  }
  return new Set(
    value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ).size;
}

function normalizeProfileSeedList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  value.forEach((item) => {
    const openId = String(item && item.openId ? item.openId : '').trim();
    if (!openId || seen.has(openId)) {
      return;
    }
    seen.add(openId);
    result.push({
      openId,
      nickname: String(item && item.nickname ? item.nickname : '').trim(),
      contactPhone: String(item && item.contactPhone ? item.contactPhone : '').trim(),
    });
  });
  return result.slice(0, 12);
}

async function saveProfileDoc(profileCollectionName, profile = {}) {
  await db.collection(profileCollectionName).doc(String(profile._id || '')).set({
    data: stripInternalId(profile),
  });
}

function isCloudFileId(value) {
  return String(value || '').trim().startsWith('cloud://');
}

async function buildTempAvatarUrlMap(profiles = []) {
  const fileList = Array.from(
    new Set(
      (profiles || [])
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
    console.warn('getProfile: buildTempAvatarUrlMap failed', {
      count: fileList.length,
      message: error && error.message,
    });
    return new Map();
  }
}

function attachTempAvatarUrl(profile = {}, avatarUrlMap = new Map()) {
  const rawAvatarUrl = String((profile && profile.avatarUrl) || '').trim();
  if (!isCloudFileId(rawAvatarUrl)) {
    return profile;
  }
  return {
    ...profile,
    avatarUrl: avatarUrlMap.get(rawAvatarUrl) || '',
    avatarFileId: rawAvatarUrl,
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

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const profileId = wxContext.OPENID;
  const action = String(event.action || '').trim();
  const profileCollectionName = getCollectionName(
    'profiles',
    normalizeDataEnvTag(event.__dataEnvTag)
  );

  if (!profileId) {
    return fail('AUTH_OPENID_MISSING', '当前身份校验失败，请重新进入小程序后再试');
  }

  try {
    if (action === 'listProfiles') {
      if (countUniqueOpenIds(event.openIds) > 12) {
        return fail(
          'PROFILE_BATCH_LIMIT_EXCEEDED',
          '单次最多查询 12 个玩家档案，请分批重试',
          false
        );
      }
      const openIds = normalizeOpenIdList(event.openIds);
      const seedMap = normalizeProfileSeedList(event.identities || event.seeds).reduce(
        (map, item) => map.set(item.openId, item),
        new Map()
      );
      if (!openIds.length) {
        return {
          ok: true,
          profiles: [],
        };
      }

      const result = await db
        .collection(profileCollectionName)
        .where({
          _id: _.in(openIds),
        })
        .get();

      const foundMap = new Map(
        (result.data || []).map((item) => [String(item._id || '').trim(), item])
      );
      const profiles = await Promise.all(
        openIds.map(async (id) => {
          const found = foundMap.get(id);
          const seed = seedMap.get(id) || {};

          if (found) {
            const nextProfile = profileDomain.applyIdentitySeed(
              {
                ...found,
                _id: id,
              },
              seed
            );
            const shouldSyncSeed =
              String(nextProfile.nickname || '') !== String(found.nickname || '') ||
              String(nextProfile.contactPhone || '') !== String(found.contactPhone || '');
            if (shouldSyncSeed) {
              nextProfile.updatedAt = new Date().toISOString();
              try {
                await saveProfileDoc(profileCollectionName, nextProfile);
              } catch (error) {
                console.warn('getProfile: saveProfileDoc failed after identity seed sync', {
                  profileId: id,
                  message: error && error.message,
                });
              }
            }
            return {
              ...profileDomain.normalizeProfile(nextProfile),
              profileExists: true,
            };
          }

          const provisionedProfile = profileDomain.buildProvisionedProfile(id, seed);
          console.info('getProfile: auto-provisioning profile', {
            profileId: id,
            action: 'listProfiles',
          });
          try {
            await saveProfileDoc(profileCollectionName, provisionedProfile);
          } catch (error) {
            console.warn('getProfile: saveProfileDoc failed during auto-provision', {
              profileId: id,
              message: error && error.message,
            });
          }
          return {
            ...profileDomain.normalizeProfile(provisionedProfile),
            profileExists: true,
          };
        })
      );

      const avatarUrlMap = await buildTempAvatarUrlMap(profiles);
      return {
        ok: true,
        profiles: profiles.map((item) => attachTempAvatarUrl(item, avatarUrlMap)),
      };
    }

    let existingProfile = null;
    try {
      const result = await db.collection(profileCollectionName).doc(profileId).get();
      existingProfile = result && result.data ? result.data : null;
    } catch (error) {
      existingProfile = null;
    }
    const profile =
      existingProfile
        ? profileDomain.normalizeProfile(existingProfile)
        : profileDomain.buildProvisionedProfile(profileId);
    if (!existingProfile) {
      console.info('getProfile: auto-provisioning profile', {
        profileId,
        action: 'getCurrentProfile',
      });
      try {
        await saveProfileDoc(profileCollectionName, profile);
      } catch (error) {
        console.warn('getProfile: saveProfileDoc failed during current profile provisioning', {
          profileId,
          message: error && error.message,
        });
      }
    }
    const avatarUrlMap = await buildTempAvatarUrlMap([profile]);
    return {
      ok: true,
      profile: attachTempAvatarUrl(profile, avatarUrlMap),
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
    return fail('PROFILE_READ_FAILED', '档案读取失败，请稍后重试', true);
  }
};
