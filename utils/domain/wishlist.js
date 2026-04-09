'use strict';

const storage = require('../platform/storage');

function normalizeWishTheme(theme = {}) {
  const id = String(theme.id || theme.themeId || '').trim();
  if (!id) {
    return null;
  }

  return {
    id,
    name: String(theme.name || theme.themeName || '').trim() || '未命名主题',
    horror: String(theme.horror || '').trim(),
    people: String(theme.people || '').trim(),
    duration: String(theme.duration || '').trim(),
    coverImage: String(theme.coverImage || '').trim(),
    slogan: String(theme.slogan || '').trim(),
    addedAt: String(theme.addedAt || new Date().toISOString()).trim(),
  };
}

function getThemeWishlist() {
  const stored = storage.safeGetStorage(storage.THEME_WISHLIST_STORAGE_KEY);
  if (!Array.isArray(stored)) {
    return [];
  }

  return stored
    .map(normalizeWishTheme)
    .filter(Boolean)
    .sort(
      (left, right) =>
        new Date(right.addedAt || 0).getTime() - new Date(left.addedAt || 0).getTime()
    );
}

function saveThemeWishlist(list = []) {
  const normalizedList = (Array.isArray(list) ? list : [])
    .map(normalizeWishTheme)
    .filter(Boolean);
  storage.safeSetStorage(storage.THEME_WISHLIST_STORAGE_KEY, normalizedList);
  return normalizedList;
}

function hasThemeInWishlist(themeId = '') {
  const normalizedThemeId = String(themeId || '').trim();
  if (!normalizedThemeId) {
    return false;
  }
  return getThemeWishlist().some((item) => item.id === normalizedThemeId);
}

function addThemeToWishlist(theme = {}) {
  const wishTheme = normalizeWishTheme(theme);
  if (!wishTheme) {
    return getThemeWishlist();
  }
  const currentList = getThemeWishlist().filter((item) => item.id !== wishTheme.id);
  return saveThemeWishlist([wishTheme].concat(currentList));
}

function removeThemeFromWishlist(themeId = '') {
  const normalizedThemeId = String(themeId || '').trim();
  return saveThemeWishlist(getThemeWishlist().filter((item) => item.id !== normalizedThemeId));
}

function toggleThemeWishlist(theme = {}) {
  const normalizedTheme = normalizeWishTheme(theme);
  if (!normalizedTheme) {
    return {
      wished: false,
      list: getThemeWishlist(),
    };
  }

  if (hasThemeInWishlist(normalizedTheme.id)) {
    return {
      wished: false,
      list: removeThemeFromWishlist(normalizedTheme.id),
    };
  }

  return {
    wished: true,
    list: addThemeToWishlist(normalizedTheme),
  };
}

module.exports = {
  normalizeWishTheme,
  getThemeWishlist,
  saveThemeWishlist,
  hasThemeInWishlist,
  addThemeToWishlist,
  removeThemeFromWishlist,
  toggleThemeWishlist,
};
