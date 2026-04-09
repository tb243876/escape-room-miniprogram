'use strict';

function isCloudFileId(value) {
  return String(value || '').trim().startsWith('cloud://');
}

function resolveAvatarFileId(value = {}) {
  const explicitFileId = String((value && value.avatarFileId) || '').trim();
  if (explicitFileId) {
    return explicitFileId;
  }
  const avatarUrl = String((value && value.avatarUrl) || '').trim();
  return isCloudFileId(avatarUrl) ? avatarUrl : '';
}

function collectAvatarFileIds(value, fileIdSet) {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAvatarFileIds(item, fileIdSet));
    return;
  }
  if (typeof value !== 'object') {
    return;
  }

  const avatarFileId = resolveAvatarFileId(value);
  if (avatarFileId) {
    fileIdSet.add(avatarFileId);
  }

  Object.keys(value).forEach((key) => {
    collectAvatarFileIds(value[key], fileIdSet);
  });
}

function patchAvatarUrls(value, avatarUrlMap) {
  if (Array.isArray(value)) {
    let changed = false;
    const nextList = value.map((item) => {
      const nextItem = patchAvatarUrls(item, avatarUrlMap);
      if (nextItem !== item) {
        changed = true;
      }
      return nextItem;
    });
    return changed ? nextList : value;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  let changed = false;
  const nextValue = {};
  const avatarFileId = resolveAvatarFileId(value);
  const nextAvatarUrl = avatarFileId ? String(avatarUrlMap.get(avatarFileId) || '').trim() : '';

  Object.keys(value).forEach((key) => {
    const nextChild = patchAvatarUrls(value[key], avatarUrlMap);
    nextValue[key] = nextChild;
    if (nextChild !== value[key]) {
      changed = true;
    }
  });

  if (avatarFileId) {
    if (String(value.avatarFileId || '').trim() !== avatarFileId) {
      nextValue.avatarFileId = avatarFileId;
      changed = true;
    }
    if (nextAvatarUrl && String(value.avatarUrl || '').trim() !== nextAvatarUrl) {
      nextValue.avatarUrl = nextAvatarUrl;
      changed = true;
    }
  }

  return changed ? nextValue : value;
}

async function buildTempAvatarUrlMap(fileIds = []) {
  const normalizedFileIds = Array.from(
    new Set((fileIds || []).map((item) => String(item || '').trim()).filter(Boolean))
  );
  if (
    !normalizedFileIds.length ||
    !wx.cloud ||
    typeof wx.cloud.getTempFileURL !== 'function'
  ) {
    return new Map();
  }

  try {
    const result = await wx.cloud.getTempFileURL({
      fileList: normalizedFileIds,
    });
    return new Map(
      ((result && result.fileList) || []).map((item) => [
        String(item.fileID || '').trim(),
        String(item.tempFileURL || '').trim(),
      ])
    );
  } catch (error) {
    console.warn('[avatar] buildTempAvatarUrlMap.failed', {
      count: normalizedFileIds.length,
      message: error && error.message,
    });
    return new Map();
  }
}

async function refreshAvatarUrlsDeep(value) {
  const fileIdSet = new Set();
  collectAvatarFileIds(value, fileIdSet);
  if (!fileIdSet.size) {
    return value;
  }
  const avatarUrlMap = await buildTempAvatarUrlMap(Array.from(fileIdSet));
  if (!avatarUrlMap.size) {
    return value;
  }
  return patchAvatarUrls(value, avatarUrlMap);
}

module.exports = {
  isCloudFileId,
  refreshAvatarUrlsDeep,
};
