'use strict';

const PROFILE_STORAGE_KEY = 'escape-room-profile-state-v3';
const PROFILE_SYNC_STORAGE_KEY = 'escape-room-profile-sync-state-v1';
const THEME_WISHLIST_STORAGE_KEY = 'escape-room-theme-wishlist-v1';
const GROUP_STORAGE_KEY = 'escape-room-group-state-v1';
const TEAM_ROOM_STORAGE_KEY = 'escape-room-team-room-state-v1';
const STAFF_BINDING_STORAGE_KEY = 'escape-room-staff-binding-v1';
const STAFF_SESSION_STORAGE_KEY = 'escape-room-staff-session-v1';
const ACTIVE_GROUP_STORAGE_KEY = 'escape-room-active-group-v1';
const RECENT_GROUP_STORAGE_KEY = 'escape-room-recent-group-v1';
const LOCAL_STORAGE_PREFIX = 'escape-room-';
const LEGACY_STORAGE_KEYS = [
  'escape-room-profile-state-v1',
  'escape-room-profile-state-v2',
  'escape-room-group-state-v1',
  'escape-room-used-codes-v1',
];

function safeGetStorage(key) {
  try {
    return wx.getStorageSync(key);
  } catch (error) {
    return null;
  }
}

function safeSetStorage(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    return null;
  }
}

function safeRemoveStorage(key) {
  try {
    wx.removeStorageSync(key);
  } catch (error) {
    return null;
  }
}

function safeGetStorageKeys() {
  try {
    const info = wx.getStorageInfoSync();
    return Array.isArray(info.keys) ? info.keys : [];
  } catch (error) {
    return [];
  }
}

function clearBusinessStorage() {
  const keys = safeGetStorageKeys();
  const keySet = new Set(keys.concat(LEGACY_STORAGE_KEYS));
  keySet.forEach((key) => {
    if (String(key || '').startsWith(LOCAL_STORAGE_PREFIX)) {
      safeRemoveStorage(key);
    }
  });
}

module.exports = {
  PROFILE_STORAGE_KEY,
  PROFILE_SYNC_STORAGE_KEY,
  THEME_WISHLIST_STORAGE_KEY,
  GROUP_STORAGE_KEY,
  TEAM_ROOM_STORAGE_KEY,
  STAFF_BINDING_STORAGE_KEY,
  STAFF_SESSION_STORAGE_KEY,
  ACTIVE_GROUP_STORAGE_KEY,
  RECENT_GROUP_STORAGE_KEY,
  safeGetStorage,
  safeSetStorage,
  safeRemoveStorage,
  clearBusinessStorage,
};
