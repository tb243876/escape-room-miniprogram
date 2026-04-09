'use strict';

const cloud = require('wx-server-sdk');
const {
  normalizeDataEnvTag,
  getCollectionName,
  stripInternalId,
  getStoreManagerBinding,
} = require('./utils');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

const DEFAULT_PROFILE_NICKNAME = '档案室常客';
const REVIEW_STATUS_APPROVED = 'approved';
const REVIEW_STATUS_DELETED = 'deleted';
const REVIEW_TYPE_REVIEW = 'review';
const REVIEW_TYPE_REPLY = 'reply';
const REVIEW_PAGE_SIZE = 10;
const REVIEW_PAGE_SIZE_MAX = 20;
const REPLY_PREVIEW_SIZE = 2;
const REPLY_PAGE_SIZE = 10;
const HIGHLIGHT_LIMIT = 5;
const REVIEW_SESSION_LOCK_STATUSES = [REVIEW_STATUS_APPROVED, REVIEW_STATUS_DELETED];
const MAX_REVIEW_LENGTH = 280;
const MAX_REPLY_LENGTH = 180;
const MAX_REVIEW_DOC_ID_LENGTH = 160;
const REVIEW_COLLECTION_NAMES = ['theme_reviews', 'theme_review_likes', 'theme_review_stats'];
const ensuredCollectionNames = new Set();

function fail(errorCode, message, retryable = false, extra = {}) {
  return {
    ok: false,
    errorCode,
    message,
    retryable,
    ...extra,
  };
}

function succeed(extra = {}) {
  return {
    ok: true,
    ...extra,
  };
}

function createStore(dataEnvTag) {
  return {
    dataEnvTag,
    collectionName(baseCollectionName) {
      return getCollectionName(baseCollectionName, dataEnvTag);
    },
    collection(baseCollectionName) {
      return db.collection(getCollectionName(baseCollectionName, dataEnvTag));
    },
  };
}

function getErrorMessage(error) {
  return String((error && (error.errMsg || error.message || error.error)) || '').trim();
}

function isCollectionMissingError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('collection not exists') ||
    message.includes('db or table not exist') ||
    message.includes('resource not found')
  );
}

function isCollectionAlreadyExistsError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('already exists') || message.includes('duplicate') || message.includes('conflict');
}

async function ensureCollectionExists(collectionName) {
  if (!collectionName || ensuredCollectionNames.has(collectionName)) {
    return;
  }

  try {
    await db.createCollection(collectionName);
    console.info('[themeReviewManage] collection created', {
      collectionName,
    });
  } catch (error) {
    if (!isCollectionAlreadyExistsError(error)) {
      try {
        await db.collection(collectionName).limit(1).get();
      } catch (checkError) {
        throw isCollectionMissingError(checkError) ? error : checkError;
      }
    }
  }

  ensuredCollectionNames.add(collectionName);
}

async function ensureReviewCollectionsReady(store) {
  for (const baseCollectionName of REVIEW_COLLECTION_NAMES) {
    const collectionName = store.collectionName(baseCollectionName);
    await ensureCollectionExists(collectionName);
  }
}

function parseTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sanitizeText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => sanitizeText(item, 8))
        .filter(Boolean)
    )
  ).slice(0, 4);
}

function normalizePageSize(value, fallback = REVIEW_PAGE_SIZE, max = REVIEW_PAGE_SIZE_MAX) {
  const pageSize = Number(value || fallback);
  if (!Number.isFinite(pageSize)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(pageSize)));
}

function normalizeLatestCursor(value) {
  return sanitizeText(value, 32);
}

function normalizeHotCursor(value) {
  return sanitizeText(value, 40);
}

function normalizeReviewDocId(value = '') {
  return sanitizeText(value, MAX_REVIEW_DOC_ID_LENGTH);
}

function buildSortValue() {
  const now = Date.now();
  const salt = Math.floor(Math.random() * 1000);
  return now * 1000 + salt;
}

function buildLatestOrderKey(sortValue) {
  return String(Math.max(0, Number(sortValue || 0))).padStart(16, '0');
}

function buildHotOrderKey(likeCount, sortValue) {
  return `${String(Math.max(0, Number(likeCount || 0))).padStart(8, '0')}:${buildLatestOrderKey(
    sortValue
  )}`;
}

function normalizeReviewStats(value) {
  const stats = value && typeof value === 'object' ? value : {};
  const totalCount = Math.max(0, Number(stats.totalCount || 0));
  const goodCount = Math.max(0, Number(stats.goodCount || 0));
  const neutralCount = Math.max(0, Number(stats.neutralCount || 0));
  const badCount = Math.max(0, Number(stats.badCount || 0));
  const avgScoreRaw = Number(stats.avgScore || 0);
  const avgScore = Number.isFinite(avgScoreRaw) ? Math.max(0, Math.min(5, avgScoreRaw)) : 0;
  const positiveRate =
    totalCount > 0
      ? Math.max(0, Math.min(100, Number(stats.positiveRate || Math.round((goodCount / totalCount) * 100))))
      : 0;
  return {
    totalCount,
    avgScore: Number(avgScore.toFixed(1)),
    positiveRate,
    highlightCount: Math.max(0, Number(stats.highlightCount || 0)),
    goodCount,
    neutralCount,
    badCount,
    repliedCount: Math.max(0, Number(stats.repliedCount || 0)),
    totalScore: Math.max(0, Number(stats.totalScore || 0)),
  };
}

function buildDefaultReviewStats() {
  return normalizeReviewStats({});
}

function buildReviewStatsFromDoc(doc = {}) {
  return normalizeReviewStats({
    totalCount: doc.totalCount,
    avgScore: doc.avgScore,
    positiveRate: doc.positiveRate,
    highlightCount: doc.highlightCount,
    goodCount: doc.goodCount,
    neutralCount: doc.neutralCount,
    badCount: doc.badCount,
    repliedCount: doc.repliedCount,
    totalScore: doc.totalScore,
  });
}

function buildStatsDoc(themeId, stats = {}, now = '') {
  return {
    _id: themeId,
    themeId,
    totalCount: stats.totalCount,
    totalScore: stats.totalScore,
    avgScore: stats.avgScore,
    positiveRate: stats.positiveRate,
    highlightCount: stats.highlightCount,
    goodCount: stats.goodCount,
    neutralCount: stats.neutralCount,
    badCount: stats.badCount,
    repliedCount: stats.repliedCount,
    updatedAt: now || new Date().toISOString(),
  };
}

function getRatingBucketKey(rating) {
  const value = Math.max(1, Math.min(5, Number(rating || 0)));
  if (value >= 4) {
    return 'goodCount';
  }
  if (value === 3) {
    return 'neutralCount';
  }
  return 'badCount';
}

function applyReviewStatsDelta(currentStats = {}, rating = 0) {
  const stats = normalizeReviewStats(currentStats);
  const bucketKey = getRatingBucketKey(rating);
  const totalCount = stats.totalCount + 1;
  const totalScore = stats.totalScore + Math.max(1, Math.min(5, Number(rating || 0)));
  const nextStats = {
    ...stats,
    totalCount,
    totalScore,
    avgScore: Number((totalScore / totalCount).toFixed(1)),
    [bucketKey]: stats[bucketKey] + 1,
  };
  nextStats.positiveRate =
    totalCount > 0 ? Math.round((nextStats.goodCount / totalCount) * 100) : 0;
  return nextStats;
}

function chunkArray(list = [], size = 20) {
  const items = Array.isArray(list) ? list : [];
  const chunkSize = Math.max(1, Number(size || 20));
  const result = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize));
  }
  return result;
}

function buildReviewHighlight(review = {}) {
  return {
    reviewId: String(review._id || review.reviewId || '').trim(),
    content: sanitizeText(review.content, 120),
    rating: Math.max(1, Math.min(5, Number(review.rating || 0))),
    authorNicknameSnapshot:
      sanitizeText(review.authorNicknameSnapshot, 24) ||
      sanitizeText(review.authorName, 24) ||
      DEFAULT_PROFILE_NICKNAME,
    authorRoleLabel: sanitizeText(review.authorRoleLabel, 12) || '玩家',
    likeCount: Math.max(0, Number(review.likeCount || 0)),
    createdAt: String(review.createdAt || '').trim(),
    isPinned: Boolean(review.isPinned),
    tags: sanitizeTags(review.tags),
  };
}

function normalizeSortBy(value) {
  return String(value || '').trim() === 'top' ? 'top' : 'latest';
}

function normalizeFilterKey(value) {
  const normalized = String(value || '').trim();
  if (['good', 'neutral', 'bad', 'replied'].includes(normalized)) {
    return normalized;
  }
  return 'all';
}

function buildBaseReviewWhere(themeId, filterKey = 'all') {
  const where = {
    themeId,
    type: REVIEW_TYPE_REVIEW,
    status: REVIEW_STATUS_APPROVED,
  };
  if (filterKey === 'good') {
    where.rating = _.gte(4);
  } else if (filterKey === 'neutral') {
    where.rating = 3;
  } else if (filterKey === 'bad') {
    where.rating = _.lte(2);
  } else if (filterKey === 'replied') {
    where.replyCount = _.gt(0);
  }
  return where;
}

function buildReviewListQuery(store, themeId, options = {}) {
  const sortBy = normalizeSortBy(options.sortBy);
  const filterKey = normalizeFilterKey(options.filterKey);
  const pageSize = normalizePageSize(options.pageSize);
  const collection = store.collection('theme_reviews');
  const where = buildBaseReviewWhere(themeId, filterKey);

  if (sortBy === 'top') {
    const cursor = normalizeHotCursor(options.cursor);
    if (cursor) {
      where.hotOrderKey = _.lt(cursor);
    }
    return collection
      .where(where)
      .orderBy('hotOrderKey', 'desc')
      .limit(pageSize + 1);
  }

  const cursor = normalizeLatestCursor(options.cursor);
  if (cursor) {
    where.latestOrderKey = _.lt(cursor);
  }
  return collection
    .where(where)
    .orderBy('latestOrderKey', 'desc')
    .limit(pageSize + 1);
}

function matchesFilterKey(item = {}, filterKey = 'all') {
  const normalizedFilterKey = normalizeFilterKey(filterKey);
  const rating = Math.max(0, Number(item.rating || 0));
  const replyCount = Math.max(0, Number(item.replyCount || 0));
  if (normalizedFilterKey === 'good') {
    return rating >= 4;
  }
  if (normalizedFilterKey === 'neutral') {
    return rating === 3;
  }
  if (normalizedFilterKey === 'bad') {
    return rating > 0 && rating <= 2;
  }
  if (normalizedFilterKey === 'replied') {
    return replyCount > 0;
  }
  return true;
}

function sortReviewDocs(list = [], sortBy = 'latest') {
  const normalizedSortBy = normalizeSortBy(sortBy);
  return (Array.isArray(list) ? list : []).slice().sort((left, right) => {
    if (normalizedSortBy === 'top') {
      return String(right.hotOrderKey || '').localeCompare(String(left.hotOrderKey || ''));
    }
    return String(right.latestOrderKey || '').localeCompare(String(left.latestOrderKey || ''));
  });
}

function paginateSortedDocs(list = [], options = {}) {
  const sortBy = normalizeSortBy(options.sortBy);
  const pageSize = normalizePageSize(options.pageSize);
  const cursor =
    sortBy === 'top' ? normalizeHotCursor(options.cursor) : normalizeLatestCursor(options.cursor);
  const sortedList = sortReviewDocs(list, sortBy);
  const filteredByCursor = cursor
    ? sortedList.filter((item) =>
        String(sortBy === 'top' ? item.hotOrderKey || '' : item.latestOrderKey || '').trim() < cursor
      )
    : sortedList;
  const docs = filteredByCursor.slice(0, pageSize);
  const lastDoc = docs.length ? docs[docs.length - 1] : null;
  return {
    docs,
    hasMore: filteredByCursor.length > pageSize,
    nextCursor: lastDoc
      ? String(sortBy === 'top' ? lastDoc.hotOrderKey || '' : lastDoc.latestOrderKey || '').trim()
      : '',
  };
}

async function listReviewsWithFallback(store, themeId, options = {}) {
  try {
    const result = await buildReviewListQuery(store, themeId, options).get();
    const pageSize = normalizePageSize(options.pageSize);
    const rawReviewDocs = result.data || [];
    const reviewDocs = rawReviewDocs.slice(0, pageSize);
    const sortBy = normalizeSortBy(options.sortBy);
    return {
      docs: reviewDocs,
      hasMore: rawReviewDocs.length > pageSize,
      nextCursor:
        reviewDocs.length && reviewDocs[reviewDocs.length - 1]
          ? String(
              sortBy === 'top'
                ? reviewDocs[reviewDocs.length - 1].hotOrderKey || ''
                : reviewDocs[reviewDocs.length - 1].latestOrderKey || ''
            ).trim()
          : '',
    };
  } catch (error) {
    console.warn('[themeReviewManage] listReviews.indexFallback', {
      themeId,
      sortBy: normalizeSortBy(options.sortBy),
      filterKey: normalizeFilterKey(options.filterKey),
      message: error && error.message,
    });
    const fallbackResult = await store
      .collection('theme_reviews')
      .where({
        themeId,
        type: REVIEW_TYPE_REVIEW,
        status: REVIEW_STATUS_APPROVED,
      })
      .limit(200)
      .get();
    const filteredList = (fallbackResult.data || []).filter((item) =>
      matchesFilterKey(item, options.filterKey)
    );
    return paginateSortedDocs(filteredList, options);
  }
}

async function listRepliesWithFallback(store, rootReviewId, options = {}) {
  const pageSize = normalizePageSize(options.pageSize, REPLY_PAGE_SIZE, REPLY_PAGE_SIZE);
  const where = {
    rootReviewId,
    type: REVIEW_TYPE_REPLY,
    status: REVIEW_STATUS_APPROVED,
  };
  const cursor = normalizeLatestCursor(options.cursor);
  if (cursor) {
    where.latestOrderKey = _.lt(cursor);
  }
  try {
    const result = await store
      .collection('theme_reviews')
      .where(where)
      .orderBy('latestOrderKey', 'desc')
      .limit(pageSize + 1)
      .get();
    const rawReplyDocs = result.data || [];
    const replyDocs = rawReplyDocs.slice(0, pageSize);
    return {
      docs: replyDocs,
      hasMore: rawReplyDocs.length > pageSize,
      nextCursor:
        replyDocs.length && replyDocs[replyDocs.length - 1]
          ? String(replyDocs[replyDocs.length - 1].latestOrderKey || '').trim()
          : '',
    };
  } catch (error) {
    console.warn('[themeReviewManage] listReplies.indexFallback', {
      rootReviewId,
      message: error && error.message,
    });
    const result = await store
      .collection('theme_reviews')
      .where({
        rootReviewId,
        type: REVIEW_TYPE_REPLY,
        status: REVIEW_STATUS_APPROVED,
      })
      .limit(200)
      .get();
    const pagination = paginateSortedDocs(result.data || [], {
      sortBy: 'latest',
      cursor: options.cursor,
      pageSize,
    });
    return pagination;
  }
}

async function getHighlightCandidates(store, where = {}, orderField, limit) {
  try {
    const result = await store
      .collection('theme_reviews')
      .where(where)
      .orderBy(orderField, 'desc')
      .limit(limit)
      .get();
    return result.data || [];
  } catch (error) {
    console.warn('[themeReviewManage] highlightCandidates.indexFallback', {
      orderField,
      message: error && error.message,
    });
    const result = await store.collection('theme_reviews').where(where).limit(200).get();
    return sortReviewDocs(
      result.data || [],
      orderField === 'hotOrderKey' ? 'top' : 'latest'
    ).slice(0, limit);
  }
}

function isCloudFileId(value = '') {
  return String(value || '').trim().startsWith('cloud://');
}

async function buildTempAvatarUrlMap(reviews = []) {
  const fileList = Array.from(
    new Set(
      (Array.isArray(reviews) ? reviews : [])
        .map((item) => String(item.authorAvatarFileId || '').trim())
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
    console.warn('[themeReviewManage] buildTempAvatarUrlMap.failed', {
      count: fileList.length,
      message: error && error.message,
    });
    return new Map();
  }
}

function buildReviewAvatarUrl(review = {}, avatarUrlMap = new Map()) {
  const avatarFileId = String(review.authorAvatarFileId || '').trim();
  if (avatarFileId) {
    return avatarUrlMap.get(avatarFileId) || '';
  }
  const avatarSnapshot = String(review.authorAvatarSnapshot || '').trim();
  return isCloudFileId(avatarSnapshot) ? '' : avatarSnapshot;
}

function buildReviewCard(review = {}, avatarUrlMap = new Map(), options = {}) {
  const likedReviewIdSet = options.likedReviewIdSet instanceof Set ? options.likedReviewIdSet : new Set();
  const replies = Array.isArray(options.replies) ? options.replies : [];
  const oldestLoadedReply = replies.length ? replies[0] : null;
  const viewerOpenId = sanitizeText(options.viewerOpenId, 64);
  return {
    id: String(review._id || '').trim(),
    themeId: String(review.themeId || '').trim(),
    sessionId: String(review.sessionId || '').trim(),
    content: sanitizeText(review.content, MAX_REVIEW_LENGTH),
    rating: Math.max(0, Number(review.rating || 0)),
    tags: sanitizeTags(review.tags),
    likeCount: Math.max(0, Number(review.likeCount || 0)),
    replyCount: Math.max(0, Number(review.replyCount || 0)),
    createdAt: String(review.createdAt || '').trim(),
    status: String(review.status || '').trim(),
    isPinned: Boolean(review.isPinned),
    authorRoleKey: sanitizeText(review.authorRoleKey, 16) || 'player',
    authorRoleLabel: sanitizeText(review.authorRoleLabel, 12) || '玩家',
    authorNickname: sanitizeText(review.authorNicknameSnapshot, 24) || DEFAULT_PROFILE_NICKNAME,
    authorAvatarUrl: buildReviewAvatarUrl(review, avatarUrlMap),
    authorAvatarText: String(
      (sanitizeText(review.authorNicknameSnapshot, 2) || DEFAULT_PROFILE_NICKNAME).slice(0, 1)
    ),
    liked: likedReviewIdSet.has(String(review._id || '').trim()),
    canDelete: viewerOpenId && sanitizeText(review.authorOpenId, 64) === viewerOpenId,
    canReply: true,
    replies,
    hasMoreReplies: Math.max(0, Number(review.replyCount || 0)) > replies.length,
    replyCursor: oldestLoadedReply ? String(oldestLoadedReply.latestOrderKey || '').trim() : '',
  };
}

function buildReplyCard(reply = {}, avatarUrlMap = new Map(), likedReviewIdSet = new Set(), viewerOpenId = '') {
  const normalizedViewerOpenId = sanitizeText(viewerOpenId, 64);
  return {
    id: String(reply._id || '').trim(),
    rootReviewId: String(reply.rootReviewId || '').trim(),
    parentReviewId: String(reply.parentReviewId || '').trim(),
    content: sanitizeText(reply.content, MAX_REPLY_LENGTH),
    likeCount: Math.max(0, Number(reply.likeCount || 0)),
    createdAt: String(reply.createdAt || '').trim(),
    authorRoleKey: sanitizeText(reply.authorRoleKey, 16) || 'player',
    authorRoleLabel: sanitizeText(reply.authorRoleLabel, 12) || '玩家',
    authorNickname: sanitizeText(reply.authorNicknameSnapshot, 24) || DEFAULT_PROFILE_NICKNAME,
    authorAvatarUrl: buildReviewAvatarUrl(reply, avatarUrlMap),
    authorAvatarText: String(
      (sanitizeText(reply.authorNicknameSnapshot, 2) || DEFAULT_PROFILE_NICKNAME).slice(0, 1)
    ),
    replyToNickname: sanitizeText(reply.replyToNicknameSnapshot, 24),
    liked: likedReviewIdSet.has(String(reply._id || '').trim()),
    canDelete: normalizedViewerOpenId && sanitizeText(reply.authorOpenId, 64) === normalizedViewerOpenId,
    latestOrderKey: String(reply.latestOrderKey || '').trim(),
  };
}

async function getThemeDoc(store, themeId) {
  try {
    const result = await store.collection('themes').doc(themeId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function listThemeDocsByIds(store, themeIds = []) {
  const normalizedThemeIds = Array.from(
    new Set(
      (Array.isArray(themeIds) ? themeIds : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
  if (!normalizedThemeIds.length) {
    return new Map();
  }

  const themeDocs = [];
  for (const idChunk of chunkArray(normalizedThemeIds, 20)) {
    const result = await store
      .collection('themes')
      .where({
        _id: _.in(idChunk),
      })
      .get()
      .catch(() => ({ data: [] }));
    themeDocs.push(...(Array.isArray(result.data) ? result.data : []));
  }

  return new Map(
    themeDocs.map((item) => [String((item && item._id) || '').trim(), item]).filter((item) => item[0])
  );
}

async function getProfileDoc(store, openId) {
  try {
    const result = await store.collection('profiles').doc(openId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function getThemeReviewStatsDoc(store, themeId) {
  try {
    const result = await store.collection('theme_review_stats').doc(themeId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function listAuthoredTopLevelReviewDocs(store, openId, options = {}) {
  const normalizedOpenId = sanitizeText(openId, 64);
  if (!normalizedOpenId) {
    return [];
  }

  const normalizedThemeId = sanitizeText(options.themeId, 48);
  const statuses = Array.isArray(options.statuses) ? options.statuses.filter(Boolean) : [];
  const limit = Math.max(1, Math.min(200, Number(options.limit || 100)));
  const where = {
    authorOpenId: normalizedOpenId,
    type: REVIEW_TYPE_REVIEW,
  };

  if (normalizedThemeId) {
    where.themeId = normalizedThemeId;
  }
  if (statuses.length === 1) {
    where.status = statuses[0];
  } else if (statuses.length > 1) {
    where.status = _.in(statuses);
  }

  const result = await store
    .collection('theme_reviews')
    .where(where)
    .orderBy('latestOrderKey', 'desc')
    .limit(limit)
    .get()
    .catch(() => ({ data: [] }));

  return Array.isArray(result.data) ? result.data : [];
}

async function saveThemeReviewStatsDoc(store, themeId, stats = {}, now = '') {
  await store
    .collection('theme_review_stats')
    .doc(themeId)
    .set({
      data: stripInternalId(buildStatsDoc(themeId, stats, now)),
    });
}

async function updateThemeReviewSummary(store, themeId, stats = null, highlights = null) {
  const nextStats = stats ? normalizeReviewStats(stats) : buildDefaultReviewStats();
  let nextHighlights = Array.isArray(highlights) ? highlights.slice(0, HIGHLIGHT_LIMIT) : null;
  if (!nextHighlights) {
    const themeDoc = await getThemeDoc(store, themeId);
    nextHighlights = Array.isArray(themeDoc && themeDoc.reviewHighlights)
      ? themeDoc.reviewHighlights.slice(0, HIGHLIGHT_LIMIT)
      : [];
  }
  await store
    .collection('themes')
    .doc(themeId)
    .update({
      data: {
        reviewStats: {
          totalCount: nextStats.totalCount,
          avgScore: nextStats.avgScore,
          positiveRate: nextStats.positiveRate,
          highlightCount: nextHighlights.length,
          goodCount: nextStats.goodCount,
          neutralCount: nextStats.neutralCount,
          badCount: nextStats.badCount,
          repliedCount: nextStats.repliedCount,
        },
        reviewHighlights: nextHighlights,
        updatedAt: new Date().toISOString(),
      },
    })
    .catch(async () => {
      const themeDoc = await getThemeDoc(store, themeId);
      if (!themeDoc) {
        return;
      }
      await store.collection('themes').doc(themeId).set({
        data: {
          ...stripInternalId(themeDoc),
          reviewStats: {
            totalCount: nextStats.totalCount,
            avgScore: nextStats.avgScore,
            positiveRate: nextStats.positiveRate,
            highlightCount: nextHighlights.length,
            goodCount: nextStats.goodCount,
            neutralCount: nextStats.neutralCount,
            badCount: nextStats.badCount,
            repliedCount: nextStats.repliedCount,
          },
          reviewHighlights: nextHighlights,
          updatedAt: new Date().toISOString(),
        },
      });
    });
}

function pickBestHighlightCandidates(list = []) {
  return list
    .filter((item) => String(item.status || '') === REVIEW_STATUS_APPROVED)
    .sort((left, right) => {
      const pinnedDelta = Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned));
      if (pinnedDelta !== 0) {
        return pinnedDelta;
      }
      const likeDelta = Number(right.likeCount || 0) - Number(left.likeCount || 0);
      if (likeDelta !== 0) {
        return likeDelta;
      }
      return String(right.latestOrderKey || '').localeCompare(String(left.latestOrderKey || ''));
    })
    .slice(0, HIGHLIGHT_LIMIT);
}

async function rebuildThemeHighlights(store, themeId) {
  const pinnedDocs = await getHighlightCandidates(
    store,
    {
      themeId,
      type: REVIEW_TYPE_REVIEW,
      status: REVIEW_STATUS_APPROVED,
      isPinned: true,
    },
    'latestOrderKey',
    HIGHLIGHT_LIMIT
  );

  const topDocs = await getHighlightCandidates(
    store,
    {
      themeId,
      type: REVIEW_TYPE_REVIEW,
      status: REVIEW_STATUS_APPROVED,
    },
    'hotOrderKey',
    HIGHLIGHT_LIMIT * 2
  );

  const highlightMap = new Map();
  pinnedDocs.concat(topDocs).forEach((item) => {
    const reviewId = String(item._id || '').trim();
    if (reviewId && !highlightMap.has(reviewId)) {
      highlightMap.set(reviewId, item);
    }
  });

  return pickBestHighlightCandidates(Array.from(highlightMap.values())).map(buildReviewHighlight);
}

async function syncThemeReviewSummary(store, themeId, stats = null) {
  const nextStats = stats
    ? normalizeReviewStats(stats)
    : buildReviewStatsFromDoc((await getThemeReviewStatsDoc(store, themeId)) || {});
  const highlights = await rebuildThemeHighlights(store, themeId);
  nextStats.highlightCount = highlights.length;
  await saveThemeReviewStatsDoc(store, themeId, nextStats, new Date().toISOString());
  await updateThemeReviewSummary(store, themeId, nextStats, highlights);
  return {
    stats: nextStats,
    highlights,
  };
}

function normalizeSessionId(value = '') {
  const normalized = sanitizeText(value, 48);
  if (!normalized) {
    return '';
  }
  return normalized.startsWith('session-') ? normalized : `session-${normalized}`;
}

function extractEligibleSessions(profile = {}, themeDoc = {}) {
  const themeId = String(themeDoc._id || themeDoc.id || '').trim();
  const themeName = sanitizeText(themeDoc.name, 32);
  const records = getProfilePlayRecords(profile);
  const sessionMap = new Map();

  records.forEach((record) => {
    const recordThemeId = String(record.themeId || '').trim();
    const recordThemeName = sanitizeText(record.themeName, 32);
    const isMatched =
      (themeId && recordThemeId && recordThemeId === themeId) ||
      (themeName && recordThemeName && recordThemeName === themeName);
    if (!isMatched) {
      return;
    }

    const sessionId = normalizeSessionId(record.recordId || record.sessionId || '');
    if (!sessionId || sessionMap.has(sessionId)) {
      return;
    }

    const playedAt = String(
      record.punchedAt || record.endedAt || record.playedAt || record.startedAt || ''
    ).trim();
    sessionMap.set(sessionId, {
      sessionId,
      sessionLabel:
        sanitizeText(record.sessionLabel, 40) ||
        `${sanitizeText(record.themeName, 20)} ${sanitizeText(playedAt, 16)}`.trim(),
      playedAt,
      latestOrderKey: buildLatestOrderKey(parseTimestamp(playedAt) || Date.now()),
    });
  });

  return Array.from(sessionMap.values()).sort((left, right) =>
    String(right.latestOrderKey || '').localeCompare(String(left.latestOrderKey || ''))
  );
}

function getProfilePlayRecords(profile = {}) {
  if (Array.isArray(profile.punchRecords) && profile.punchRecords.length) {
    return profile.punchRecords;
  }
  if (Array.isArray(profile.playRecords) && profile.playRecords.length) {
    return profile.playRecords;
  }
  if (Array.isArray(profile.punchRecords)) {
    return profile.punchRecords;
  }
  if (Array.isArray(profile.playRecords)) {
    return profile.playRecords;
  }
  return [];
}

function extractPendingReviewSessions(profile = {}) {
  const records = getProfilePlayRecords(profile);
  const sessionMap = new Map();

  records.forEach((record) => {
    const sessionId = normalizeSessionId(record.recordId || record.sessionId || '');
    const themeId = sanitizeText(record.themeId, 48);
    const themeName = sanitizeText(record.themeName, 32);
    const playedAt = String(
      record.punchedAt || record.endedAt || record.playedAt || record.startedAt || ''
    ).trim();
    if (!sessionId || (!themeId && !themeName) || !playedAt || sessionMap.has(sessionId)) {
      return;
    }

    sessionMap.set(sessionId, {
      sessionId,
      themeId,
      themeName,
      playedAt,
      latestOrderKey: buildLatestOrderKey(parseTimestamp(playedAt) || Date.now()),
      sessionLabel:
        sanitizeText(record.sessionLabel, 40) ||
        `${themeName || '主题体验'} ${playedAt.replace('T', ' ').slice(0, 16)}`.trim(),
    });
  });

  return Array.from(sessionMap.values()).sort((left, right) =>
    String(right.latestOrderKey || '').localeCompare(String(left.latestOrderKey || ''))
  );
}

async function buildViewerReviewMeta(store, openId, themeDoc) {
  const profile = (await getProfileDoc(store, openId)) || {
    _id: openId,
    nickname: DEFAULT_PROFILE_NICKNAME,
    punchRecords: [],
    playRecords: [],
  };
  const allSessions = extractEligibleSessions(profile, themeDoc);
  if (!allSessions.length) {
    return {
      canReview: false,
      reason: '完成体验后就能写评价',
      eligibleSessions: [],
    };
  }

  const authoredReviewDocs = await listAuthoredTopLevelReviewDocs(store, openId, {
    themeId: String(themeDoc._id || '').trim(),
    statuses: REVIEW_SESSION_LOCK_STATUSES,
    limit: 100,
  });
  const reviewedSessionIdSet = new Set(
    authoredReviewDocs
      .map((item) => normalizeSessionId(item.sessionId || ''))
      .filter(Boolean)
  );

  const eligibleSessions = allSessions.filter((item) => !reviewedSessionIdSet.has(item.sessionId));
  if (!eligibleSessions.length) {
    return {
      canReview: false,
      reason: '这个主题能评价的体验你都已经写过了',
      eligibleSessions: [],
    };
  }

  return {
    canReview: true,
    reason: '',
    eligibleSessions: eligibleSessions.slice(0, 20).map((item) => ({
      sessionId: item.sessionId,
      sessionLabel: item.sessionLabel,
      playedAt: item.playedAt,
    })),
  };
}

async function buildAuthorSnapshot(store, openId, dataEnvTag) {
  const [profile, binding] = await Promise.all([
    getProfileDoc(store, openId),
    getStoreManagerBinding(db, openId, dataEnvTag),
  ]);

  const avatarRaw = String((profile && profile.avatarUrl) || '').trim();
  const avatarFileId = isCloudFileId(avatarRaw) ? avatarRaw : '';
  return {
    openId,
    authorNicknameSnapshot:
      sanitizeText((profile && profile.nickname) || '', 24) ||
      sanitizeText((binding && binding.roleLabel) || '', 12) ||
      DEFAULT_PROFILE_NICKNAME,
    authorAvatarSnapshot: avatarFileId ? '' : avatarRaw,
    authorAvatarFileId: avatarFileId,
    authorRoleKey: binding && binding.role ? 'staff' : 'player',
    authorRoleLabel:
      sanitizeText((binding && binding.roleLabel) || '', 12) || (binding && binding.role ? '店员' : '玩家'),
  };
}

async function getLikedReviewIdSet(store, openId, reviewIds = []) {
  const normalizedReviewIds = Array.from(
    new Set(
      (Array.isArray(reviewIds) ? reviewIds : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
  if (!openId || !normalizedReviewIds.length) {
    return new Set();
  }
  const result = await store
    .collection('theme_review_likes')
    .where({
      openId,
      reviewId: _.in(normalizedReviewIds.slice(0, 20)),
    })
    .get()
    .catch(() => ({ data: [] }));
  return new Set(
    (result.data || [])
      .map((item) => String(item.reviewId || '').trim())
      .filter(Boolean)
  );
}

async function buildReplyPreviewMap(store, openId, rootReviewIds = []) {
  const previewPairs = await Promise.all(
    (Array.isArray(rootReviewIds) ? rootReviewIds : []).map(async (rootReviewId) => {
      const pagination = await listRepliesWithFallback(store, rootReviewId, {
        cursor: '',
        pageSize: REPLY_PREVIEW_SIZE,
      });
      return [rootReviewId, pagination.docs || []];
    })
  );

  const replyList = previewPairs.reduce((list, item) => list.concat(item[1] || []), []);
  const likedReviewIdSet = await getLikedReviewIdSet(
    store,
    openId,
    replyList.map((item) => item._id)
  );
  const avatarUrlMap = await buildTempAvatarUrlMap(replyList);

  return new Map(
    previewPairs.map(([rootReviewId, items]) => [
      rootReviewId,
      (items || [])
        .slice()
        .reverse()
        .map((item) => buildReplyCard(item, avatarUrlMap, likedReviewIdSet, openId)),
    ])
  );
}

async function listAllApprovedReplyDocs(store, rootReviewId) {
  const items = [];
  let cursor = '';
  let hasMore = true;

  while (hasMore) {
    const page = await listRepliesWithFallback(store, rootReviewId, {
      cursor,
      pageSize: REPLY_PAGE_SIZE,
    });
    const docs = Array.isArray(page.docs) ? page.docs : [];
    items.push(...docs);
    cursor = String(page.nextCursor || '').trim();
    hasMore = Boolean(page.hasMore && cursor);
  }

  return items;
}

async function countApprovedReplies(store, rootReviewId) {
  const replyDocs = await listAllApprovedReplyDocs(store, rootReviewId);
  return replyDocs.length;
}

async function markReviewDeleted(store, reviewId, openId) {
  await store
    .collection('theme_reviews')
    .doc(reviewId)
    .update({
      data: {
        status: REVIEW_STATUS_DELETED,
        deletedAt: new Date().toISOString(),
        deletedByOpenId: openId,
        updatedAt: new Date().toISOString(),
      },
    });
}

async function removeLikesByReviewIds(store, reviewIds = []) {
  const normalizedReviewIds = Array.from(
    new Set(
      (Array.isArray(reviewIds) ? reviewIds : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
  if (!normalizedReviewIds.length) {
    return;
  }

  for (const idChunk of chunkArray(normalizedReviewIds, 20)) {
    let hasMore = true;
    while (hasMore) {
      const result = await store
        .collection('theme_review_likes')
        .where({
          reviewId: _.in(idChunk),
        })
        .limit(100)
        .get()
        .catch(() => ({ data: [] }));
      const likeDocs = Array.isArray(result.data) ? result.data : [];
      if (!likeDocs.length) {
        hasMore = false;
        continue;
      }
      await Promise.all(
        likeDocs.map((item) =>
          store
            .collection('theme_review_likes')
            .doc(String(item._id || '').trim())
            .remove()
            .catch(() => null)
        )
      );
    }
  }
}

async function rebuildThemeReviewStats(store, themeId) {
  const stats = buildDefaultReviewStats();
  let cursor = '';
  let hasMore = true;

  while (hasMore) {
    const page = await listReviewsWithFallback(store, themeId, {
      sortBy: 'latest',
      filterKey: 'all',
      cursor,
      pageSize: REVIEW_PAGE_SIZE_MAX,
    });
    const docs = Array.isArray(page.docs) ? page.docs : [];
    docs.forEach((item) => {
      const rating = Math.max(1, Math.min(5, Number(item.rating || 0)));
      const bucketKey = getRatingBucketKey(rating);
      stats.totalCount += 1;
      stats.totalScore += rating;
      stats[bucketKey] += 1;
      if (Math.max(0, Number(item.replyCount || 0)) > 0) {
        stats.repliedCount += 1;
      }
    });
    cursor = String(page.nextCursor || '').trim();
    hasMore = Boolean(page.hasMore && cursor);
  }

  stats.avgScore = stats.totalCount > 0 ? Number((stats.totalScore / stats.totalCount).toFixed(1)) : 0;
  stats.positiveRate = stats.totalCount > 0 ? Math.round((stats.goodCount / stats.totalCount) * 100) : 0;
  return stats;
}

function buildLikeDocId(reviewId, openId) {
  return `like-${normalizeReviewDocId(reviewId)}-${sanitizeText(openId, 64)}`;
}

function buildThemeReviewDoc(themeDoc, author, payload = {}) {
  const sortValue = buildSortValue();
  const likeCount = 0;
  const now = new Date().toISOString();
  const sessionId = normalizeSessionId(payload.sessionId || '');
  return {
    _id: `review-${sanitizeText(sessionId, 40)}-${sanitizeText(author.openId, 64)}`,
    themeId: String(themeDoc._id || themeDoc.id || '').trim(),
    themeName: sanitizeText(themeDoc.name, 32),
    sessionId,
    authorOpenId: author.openId,
    authorNicknameSnapshot: author.authorNicknameSnapshot,
    authorAvatarSnapshot: author.authorAvatarSnapshot,
    authorAvatarFileId: author.authorAvatarFileId,
    authorRoleKey: author.authorRoleKey,
    authorRoleLabel: author.authorRoleLabel,
    content: sanitizeText(payload.content, MAX_REVIEW_LENGTH),
    rating: Math.max(1, Math.min(5, Number(payload.rating || 5))),
    tags: sanitizeTags(payload.tags),
    likeCount,
    replyCount: 0,
    latestOrderKey: buildLatestOrderKey(sortValue),
    hotOrderKey: buildHotOrderKey(likeCount, sortValue),
    createdAt: now,
    updatedAt: now,
    status: REVIEW_STATUS_APPROVED,
    isPinned: false,
    type: REVIEW_TYPE_REVIEW,
    rootReviewId: '',
    parentReviewId: '',
    replyToNicknameSnapshot: '',
  };
}

function buildThemeReplyDoc(themeDoc, author, rootReview, parentReview, content) {
  const sortValue = buildSortValue();
  const likeCount = 0;
  const now = new Date().toISOString();
  return {
    _id: `reply-${sortValue}-${Math.random().toString(36).slice(2, 8)}`,
    themeId: String(themeDoc._id || themeDoc.id || '').trim(),
    themeName: sanitizeText(themeDoc.name, 32),
    sessionId: normalizeSessionId(rootReview.sessionId || ''),
    authorOpenId: author.openId,
    authorNicknameSnapshot: author.authorNicknameSnapshot,
    authorAvatarSnapshot: author.authorAvatarSnapshot,
    authorAvatarFileId: author.authorAvatarFileId,
    authorRoleKey: author.authorRoleKey,
    authorRoleLabel: author.authorRoleLabel,
    content: sanitizeText(content, MAX_REPLY_LENGTH),
    rating: 0,
    tags: [],
    likeCount,
    replyCount: 0,
    latestOrderKey: buildLatestOrderKey(sortValue),
    hotOrderKey: buildHotOrderKey(likeCount, sortValue),
    createdAt: now,
    updatedAt: now,
    status: REVIEW_STATUS_APPROVED,
    isPinned: false,
    type: REVIEW_TYPE_REPLY,
    rootReviewId: String(rootReview._id || '').trim(),
    parentReviewId: String(parentReview._id || '').trim(),
    replyToNicknameSnapshot:
      sanitizeText(parentReview.authorNicknameSnapshot, 24) || DEFAULT_PROFILE_NICKNAME,
  };
}

async function loadReviewDoc(store, reviewId) {
  try {
    const result = await store.collection('theme_reviews').doc(reviewId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function handleListReviews(store, event, openId) {
  const themeId = sanitizeText(event.themeId, 48);
  if (!themeId) {
    return fail('THEME_ID_REQUIRED', '主题信息不完整，请返回重试');
  }
  const themeDoc = await getThemeDoc(store, themeId);
  if (!themeDoc) {
    return fail('THEME_NOT_FOUND', '这个主题暂时无法查看');
  }

  const pagination = await listReviewsWithFallback(store, themeId, event);
  const reviewDocs = Array.isArray(pagination.docs) ? pagination.docs : [];
  const reviewIds = reviewDocs.map((item) => String(item._id || '').trim()).filter(Boolean);
  const [likedReviewIdSet, replyPreviewMap, avatarUrlMap, viewerReviewMeta] = await Promise.all([
    getLikedReviewIdSet(store, openId, reviewIds),
    buildReplyPreviewMap(store, openId, reviewIds),
    buildTempAvatarUrlMap(reviewDocs),
    buildViewerReviewMeta(store, openId, themeDoc),
  ]);

  const reviews = reviewDocs.map((item) =>
    buildReviewCard(item, avatarUrlMap, {
      likedReviewIdSet,
      viewerOpenId: openId,
      replies: replyPreviewMap.get(String(item._id || '').trim()) || [],
    })
  );
  const statsDoc = await getThemeReviewStatsDoc(store, themeId);
  return succeed({
    reviews,
    nextCursor: String(pagination.nextCursor || '').trim(),
    hasMore: Boolean(pagination.hasMore),
    viewerReviewMeta,
    reviewStats: buildReviewStatsFromDoc(statsDoc || themeDoc.reviewStats || {}),
  });
}

async function handleListPendingReviews(store, _event, openId) {
  const profile = await getProfileDoc(store, openId);
  const pendingSessions = extractPendingReviewSessions(profile || {});
  if (!pendingSessions.length) {
    return succeed({
      totalCount: 0,
      items: [],
    });
  }

  const authoredReviewDocs = await listAuthoredTopLevelReviewDocs(store, openId, {
    statuses: REVIEW_SESSION_LOCK_STATUSES,
    limit: 200,
  });
  const reviewedSessionIdSet = new Set(
    authoredReviewDocs
      .map((item) => normalizeSessionId(item.sessionId || ''))
      .filter(Boolean)
  );

  const filteredSessions = pendingSessions.filter(
    (item) => !reviewedSessionIdSet.has(String(item.sessionId || '').trim())
  );
  if (!filteredSessions.length) {
    return succeed({
      totalCount: 0,
      items: [],
    });
  }

  const themeIdList = Array.from(
    new Set(
      filteredSessions
        .map((item) => String(item.themeId || '').trim())
        .filter(Boolean)
    )
  );
  const themeMap = await listThemeDocsByIds(store, themeIdList);

  const items = filteredSessions
      .map((item) => {
        const themeDoc = themeMap.get(String(item.themeId || '').trim()) || null;
        const resolvedThemeId = String(item.themeId || (themeDoc && themeDoc._id) || '').trim();
        if (!resolvedThemeId) {
          return null;
        }
        return {
          sessionId: item.sessionId,
          sessionLabel: item.sessionLabel,
          playedAt: item.playedAt,
          themeId: resolvedThemeId,
          themeName:
            item.themeName ||
            sanitizeText(themeDoc && themeDoc.name, 32) ||
            '主题体验',
          coverImage: String((themeDoc && themeDoc.coverImage) || '').trim(),
          horror: sanitizeText(themeDoc && themeDoc.horror, 12),
          difficulty: sanitizeText(themeDoc && themeDoc.difficulty, 12),
          people: sanitizeText(themeDoc && themeDoc.people, 12),
        };
      })
      .filter(Boolean)
      .slice(0, 20);

  return succeed({
    totalCount: items.length,
    items,
  });
}

async function handleListMyReviews(store, _event, openId) {
  const authoredReviews = await listAuthoredTopLevelReviewDocs(store, openId, {
    statuses: [REVIEW_STATUS_APPROVED],
    limit: 30,
  });

  if (!authoredReviews.length) {
    return succeed({
      totalCount: 0,
      items: [],
    });
  }

  const themeIdList = Array.from(
    new Set(
      authoredReviews
        .map((item) => String(item.themeId || '').trim())
        .filter(Boolean)
    )
  );
  const themeMap = await listThemeDocsByIds(store, themeIdList);

  const items = authoredReviews.map((item) => {
    const themeId = String(item.themeId || '').trim();
    const themeDoc = themeMap.get(themeId) || null;
    return {
      reviewId: String(item._id || '').trim(),
      themeId,
      themeName:
        sanitizeText(item.themeName, 32) ||
        sanitizeText(themeDoc && themeDoc.name, 32) ||
        '主题体验',
      coverImage: String((themeDoc && themeDoc.coverImage) || '').trim(),
      content: sanitizeText(item.content, 120),
      rating: Math.max(0, Number(item.rating || 0)),
      likeCount: Math.max(0, Number(item.likeCount || 0)),
      replyCount: Math.max(0, Number(item.replyCount || 0)),
      createdAt: String(item.createdAt || '').trim(),
      status: String(item.status || '').trim() || REVIEW_STATUS_APPROVED,
      canDelete: true,
    };
  });

  return succeed({
    totalCount: items.length,
    items,
  });
}

async function handleListReplies(store, event, openId) {
  const rootReviewId = normalizeReviewDocId(event.rootReviewId);
  if (!rootReviewId) {
    return fail('ROOT_REVIEW_ID_REQUIRED', '这条回复暂时无法查看');
  }

  const pagination = await listRepliesWithFallback(store, rootReviewId, {
    cursor: event.cursor,
    pageSize: event.pageSize,
  });
  const replyDocs = Array.isArray(pagination.docs) ? pagination.docs : [];
  const [likedReviewIdSet, avatarUrlMap] = await Promise.all([
    getLikedReviewIdSet(
      store,
      openId,
      replyDocs.map((item) => item._id)
    ),
    buildTempAvatarUrlMap(replyDocs),
  ]);
  const replies = replyDocs.map((item) => buildReplyCard(item, avatarUrlMap, likedReviewIdSet, openId));
  return succeed({
    replies,
    nextCursor: String(pagination.nextCursor || '').trim(),
    hasMore: Boolean(pagination.hasMore),
  });
}

async function handleCreateReview(store, event, openId) {
  const themeId = sanitizeText(event.themeId, 48);
  const content = sanitizeText(event.content, MAX_REVIEW_LENGTH);
  const rating = Math.max(1, Math.min(5, Number(event.rating || 0)));
  if (!themeId) {
    return fail('THEME_ID_REQUIRED', '主题信息不完整，请返回重试');
  }
  if (!content) {
    return fail('REVIEW_CONTENT_REQUIRED', '请输入评价内容后再提交');
  }
  if (!rating) {
    return fail('REVIEW_RATING_REQUIRED', '请先选择评分');
  }

  const themeDoc = await getThemeDoc(store, themeId);
  if (!themeDoc) {
    return fail('THEME_NOT_FOUND', '这个主题暂时还不能评价');
  }
  const viewerReviewMeta = await buildViewerReviewMeta(store, openId, themeDoc);
  if (!viewerReviewMeta.canReview) {
    return fail('REVIEW_NOT_ALLOWED', viewerReviewMeta.reason || '暂时还不能写评价');
  }

  const requestedSessionId = normalizeSessionId(event.sessionId || '');
  const matchedSession =
    viewerReviewMeta.eligibleSessions.find((item) => item.sessionId === requestedSessionId) ||
    viewerReviewMeta.eligibleSessions[0];
  if (!matchedSession || !matchedSession.sessionId) {
    return fail('REVIEW_SESSION_MISSING', '暂时找不到可评价的体验记录');
  }

  const author = await buildAuthorSnapshot(store, openId, store.dataEnvTag);
  const reviewDoc = buildThemeReviewDoc(themeDoc, author, {
    sessionId: matchedSession.sessionId,
    content,
    rating,
    tags: event.tags,
  });
  const existingReview = await loadReviewDoc(store, reviewDoc._id);
  if (existingReview) {
    return fail('REVIEW_ALREADY_EXISTS', '这场体验你已经写过评价了');
  }
  await store.collection('theme_reviews').doc(reviewDoc._id).set({
    data: stripInternalId(reviewDoc),
  });

  const currentStats = buildReviewStatsFromDoc((await getThemeReviewStatsDoc(store, themeId)) || {});
  const nextStats = applyReviewStatsDelta(currentStats, rating);
  await saveThemeReviewStatsDoc(store, themeId, nextStats, new Date().toISOString());
  const summary = await syncThemeReviewSummary(store, themeId, nextStats);

  return succeed({
    message: '评价已提交',
    reviewId: reviewDoc._id,
    reviewStats: summary.stats,
    reviewHighlights: summary.highlights,
  });
}

async function handleCreateReply(store, event, openId) {
  const reviewId = normalizeReviewDocId(event.reviewId);
  const content = sanitizeText(event.content, MAX_REPLY_LENGTH);
  if (!reviewId) {
    return fail('REVIEW_ID_REQUIRED', '这条内容暂时不能回复');
  }
  if (!content) {
    return fail('REPLY_CONTENT_REQUIRED', '请输入回复内容后再提交');
  }

  const targetReview = await loadReviewDoc(store, reviewId);
  if (!targetReview || String(targetReview.status || '').trim() !== REVIEW_STATUS_APPROVED) {
    return fail('REVIEW_NOT_FOUND', '这条内容暂时不能回复');
  }

  const rootReview =
    String(targetReview.type || '').trim() === REVIEW_TYPE_REPLY
      ? await loadReviewDoc(store, String(targetReview.rootReviewId || '').trim())
      : targetReview;
  if (!rootReview || String(rootReview.type || '').trim() !== REVIEW_TYPE_REVIEW) {
    return fail('ROOT_REVIEW_NOT_FOUND', '原评价已不存在');
  }

  const themeDoc = await getThemeDoc(store, String(rootReview.themeId || '').trim());
  if (!themeDoc) {
    return fail('THEME_NOT_FOUND', '这个主题暂时还不能回复');
  }

  const author = await buildAuthorSnapshot(store, openId, store.dataEnvTag);
  const replyDoc = buildThemeReplyDoc(themeDoc, author, rootReview, targetReview, content);
  await store.collection('theme_reviews').doc(replyDoc._id).set({
    data: stripInternalId(replyDoc),
  });

  const nextReplyCount = Math.max(0, Number(rootReview.replyCount || 0)) + 1;
  await store
    .collection('theme_reviews')
    .doc(String(rootReview._id || '').trim())
    .update({
      data: {
        replyCount: nextReplyCount,
        updatedAt: new Date().toISOString(),
      },
    });

  if (Number(rootReview.replyCount || 0) <= 0) {
    const currentStats = buildReviewStatsFromDoc(
      (await getThemeReviewStatsDoc(store, String(rootReview.themeId || '').trim())) || {}
    );
    const nextStats = {
      ...currentStats,
      repliedCount: currentStats.repliedCount + 1,
    };
    await saveThemeReviewStatsDoc(
      store,
      String(rootReview.themeId || '').trim(),
      nextStats,
      new Date().toISOString()
    );
    await updateThemeReviewSummary(store, String(rootReview.themeId || '').trim(), nextStats);
  }

  return succeed({
    message: '回复已发送',
    replyId: replyDoc._id,
  });
}

async function handleToggleLike(store, event, openId) {
  const reviewId = normalizeReviewDocId(event.reviewId);
  if (!reviewId) {
    return fail('REVIEW_ID_REQUIRED', '这条内容暂时不能点赞');
  }

  const reviewDoc = await loadReviewDoc(store, reviewId);
  if (!reviewDoc || String(reviewDoc.status || '').trim() !== REVIEW_STATUS_APPROVED) {
    return fail('REVIEW_NOT_FOUND', '这条内容暂时不能点赞');
  }

  const likeDocId = buildLikeDocId(reviewId, openId);
  let liked = false;
  let nextLikeCount = Math.max(0, Number(reviewDoc.likeCount || 0));

  try {
    const existing = await store.collection('theme_review_likes').doc(likeDocId).get();
    if (existing && existing.data) {
      await store.collection('theme_review_likes').doc(likeDocId).remove();
      nextLikeCount = Math.max(0, nextLikeCount - 1);
    }
  } catch (error) {
    await store.collection('theme_review_likes').doc(likeDocId).set({
      data: {
        reviewId,
        themeId: String(reviewDoc.themeId || '').trim(),
        openId,
        createdAt: new Date().toISOString(),
      },
    });
    liked = true;
    nextLikeCount += 1;
  }

  await store
    .collection('theme_reviews')
    .doc(reviewId)
    .update({
      data: {
        likeCount: nextLikeCount,
        hotOrderKey: buildHotOrderKey(nextLikeCount, Number(String(reviewDoc.latestOrderKey || '0'))),
        updatedAt: new Date().toISOString(),
      },
    });

  if (String(reviewDoc.type || '').trim() === REVIEW_TYPE_REVIEW) {
    await syncThemeReviewSummary(store, String(reviewDoc.themeId || '').trim());
  }

  return succeed({
    liked,
    likeCount: nextLikeCount,
  });
}

async function handleDeleteReview(store, event, openId) {
  const reviewId = normalizeReviewDocId(event.reviewId);
  if (!reviewId) {
    return fail('REVIEW_ID_REQUIRED', '这条内容暂时不能删除');
  }

  const reviewDoc = await loadReviewDoc(store, reviewId);
  if (!reviewDoc || String(reviewDoc.status || '').trim() !== REVIEW_STATUS_APPROVED) {
    return fail('REVIEW_NOT_FOUND', '这条内容已被删除');
  }
  if (sanitizeText(reviewDoc.authorOpenId, 64) !== sanitizeText(openId, 64)) {
    return fail('REVIEW_DELETE_FORBIDDEN', '只能删除自己发布的内容');
  }

  const reviewType = String(reviewDoc.type || '').trim();
  const themeId = String(reviewDoc.themeId || '').trim();
  if (!themeId) {
    return fail('THEME_ID_REQUIRED', '主题信息不完整，请稍后再试');
  }

  if (reviewType === REVIEW_TYPE_REPLY) {
    await markReviewDeleted(store, reviewId, openId);
    await removeLikesByReviewIds(store, [reviewId]);

    const rootReviewId = String(reviewDoc.rootReviewId || '').trim();
    if (rootReviewId) {
      const nextReplyCount = await countApprovedReplies(store, rootReviewId);
      await store
        .collection('theme_reviews')
        .doc(rootReviewId)
        .update({
          data: {
            replyCount: nextReplyCount,
            updatedAt: new Date().toISOString(),
          },
        })
        .catch(() => null);
    }

    const nextStats = await rebuildThemeReviewStats(store, themeId);
    const summary = await syncThemeReviewSummary(store, themeId, nextStats);
    return succeed({
      message: '回复已删除',
      deletedType: REVIEW_TYPE_REPLY,
      reviewId,
      reviewStats: summary.stats,
      reviewHighlights: summary.highlights,
    });
  }

  if (reviewType !== REVIEW_TYPE_REVIEW) {
    return fail('REVIEW_DELETE_FORBIDDEN', '这条内容暂时不能删除');
  }

  const replyDocs = await listAllApprovedReplyDocs(store, reviewId);
  const replyIds = replyDocs.map((item) => String(item._id || '').trim()).filter(Boolean);
  await Promise.all([
    markReviewDeleted(store, reviewId, openId),
    ...replyIds.map((item) => markReviewDeleted(store, item, openId).catch(() => null)),
  ]);
  await removeLikesByReviewIds(store, [reviewId].concat(replyIds));

  const nextStats = await rebuildThemeReviewStats(store, themeId);
  const summary = await syncThemeReviewSummary(store, themeId, nextStats);
  return succeed({
    message: replyIds.length ? '这条评价和回复已删除' : '评价已删除',
    deletedType: REVIEW_TYPE_REVIEW,
    reviewId,
    deletedReplyCount: replyIds.length,
    reviewStats: summary.stats,
    reviewHighlights: summary.highlights,
  });
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openId = String(wxContext.OPENID || '').trim();
  const dataEnvTag = normalizeDataEnvTag(event.__dataEnvTag);
  const action = sanitizeText(event.action, 32);
  if (!openId) {
    return fail('AUTH_OPENID_MISSING', '登录状态已失效，请重新进入后再试');
  }

  const store = createStore(dataEnvTag);
  try {
    await ensureReviewCollectionsReady(store);

    if (action === 'listReviews') {
      return await handleListReviews(store, event, openId);
    }
    if (action === 'listPendingReviews') {
      return await handleListPendingReviews(store, event, openId);
    }
    if (action === 'listMyReviews') {
      return await handleListMyReviews(store, event, openId);
    }
    if (action === 'listReplies') {
      return await handleListReplies(store, event, openId);
    }
    if (action === 'createReview') {
      return await handleCreateReview(store, event, openId);
    }
    if (action === 'createReply') {
      return await handleCreateReply(store, event, openId);
    }
    if (action === 'toggleLike') {
      return await handleToggleLike(store, event, openId);
    }
    if (action === 'deleteReview') {
      return await handleDeleteReview(store, event, openId);
    }
    return fail('ACTION_INVALID', '当前操作暂不支持');
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[themeReviewManage] failed', {
      action,
      openId,
      message,
    });
    if (isCollectionMissingError(error)) {
      return fail('REVIEW_COLLECTION_MISSING', '评价服务暂时不可用，请稍后再试', true);
    }
    return fail('INTERNAL_SERVICE_ERROR', '评价服务暂时不可用，请稍后再试', true);
  }
};
