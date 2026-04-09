'use strict';

const mockData = require('../mock/data');
const runtime = require('./platform/runtime');
const storage = require('./platform/storage');
const avatarService = require('./platform/avatar');
const themeService = require('./domain/theme');
const profileService = require('./domain/profile');
const wishlistService = require('./domain/wishlist');
const groupService = require('./domain/group');
const teamRoomService = require('./domain/team-room');
const staffService = require('./domain/staff');
const leaderboardService = require('./domain/leaderboard');

function clearLocalUserData() {
  storage.clearBusinessStorage();
  return {
    profile: profileService.normalizeProfile(profileService.cloneDefaultProfile()),
    groups: groupService.cloneDefaultGroups(),
    staffBinding: null,
  };
}

function syncGroupParticipationState(payload = {}) {
  const currentActiveGroup = groupService.getLocalActiveGroup();
  const currentRecentGroup = groupService.getLocalRecentGroup();
  const groupList = Array.isArray(payload.groups)
    ? payload.groups.map(groupService.normalizeGroupItem)
    : [];
  const hasMatchedActiveSnapshot =
    currentActiveGroup && currentActiveGroup.groupId
      ? groupList.some((item) => {
          const sameGroup = String(item.id || '') === String(currentActiveGroup.groupId || '');
          if (!sameGroup || !groupService.isGroupStillActive(item)) {
            return false;
          }

          if (currentActiveGroup.role === 'creator') {
            return (
              String(item.contactPhone || '') === String(currentActiveGroup.contactPhone || '') ||
              String(item.contactName || '') === String(currentActiveGroup.contactName || '')
            );
          }

          const participantNames = Array.isArray(item.participantNames)
            ? item.participantNames
            : [];
          const joinedPhones = Array.isArray(item.joinedPhones) ? item.joinedPhones : [];
          return (
            (currentActiveGroup.contactPhone &&
              joinedPhones.includes(currentActiveGroup.contactPhone)) ||
            (currentActiveGroup.contactName &&
              participantNames.includes(currentActiveGroup.contactName))
          );
        })
      : false;

  if (payload.activeGroup && payload.activeGroup.groupId) {
    groupService.saveLocalActiveGroup(payload.activeGroup);
  } else if (currentActiveGroup && currentActiveGroup.groupId && hasMatchedActiveSnapshot) {
    groupService.saveLocalActiveGroup(currentActiveGroup);
  } else {
    groupService.clearLocalActiveGroup();
  }

  if (payload.recentGroup && payload.recentGroup.groupId) {
    groupService.saveLocalRecentGroup(payload.recentGroup);
  } else if (
    currentRecentGroup &&
    currentRecentGroup.groupId &&
    groupList.some((item) => String(item.id || '') === String(currentRecentGroup.groupId || ''))
  ) {
    groupService.saveLocalRecentGroup(currentRecentGroup);
  } else {
    groupService.clearLocalRecentGroup();
  }
}

function syncStaffBindingState(binding) {
  if (binding && binding.role) {
    staffService.saveLocalStaffBinding(binding);
  }
}

function clearStaffBindingState() {
  staffService.clearLocalStaffBinding();
}

function parseTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildFailureResult(result = {}, fallbackMessage, fallbackErrorCode, fallbackRetryable) {
  return {
    ok: false,
    errorCode: result.errorCode || fallbackErrorCode || 'INTERNAL_SERVICE_ERROR',
    message: result.message || fallbackMessage || '服务处理失败，请稍后重试',
    retryable:
      typeof result.retryable === 'boolean' ? result.retryable : Boolean(fallbackRetryable),
  };
}

function buildCloudError(result = {}, fallbackMessage, fallbackErrorCode, fallbackRetryable) {
  const failure = buildFailureResult(result, fallbackMessage, fallbackErrorCode, fallbackRetryable);
  const error = new Error(failure.message);
  error.code = failure.errorCode;
  error.retryable = failure.retryable;
  return error;
}

function failResult(message, errorCode, retryable = false, extra = {}) {
  return buildFailureResult(extra, message, errorCode, retryable);
}

function getCollection(baseCollectionName) {
  const db = runtime.getDb();
  return db.collection(runtime.resolveCollectionName(baseCollectionName, runtime.getDataEnvTag()));
}

function getHighlightMediaType(file = {}) {
  return String(file.fileType || file.type || '')
    .trim()
    .toLowerCase() === 'video'
    ? 'video'
    : 'image';
}

function buildHighlightMediaTitle(type, index) {
  return type === 'video' ? `视频 ${index + 1}` : `图片 ${index + 1}`;
}

function buildHomeThemeBanner(theme = {}, fallbackId = '') {
  const normalizedTheme = themeService.enrichTheme(theme || {});
  if (!normalizedTheme.id) {
    return null;
  }
  return {
    id: `banner-${normalizedTheme.id || fallbackId}`,
    type: 'theme',
    targetId: normalizedTheme.id,
    eyebrow: normalizedTheme.horror || '热门主题',
    title: normalizedTheme.name || '主题推荐',
    subtitle:
      normalizedTheme.slogan ||
      normalizedTheme.story ||
      '查看主题详情、人数配置和当前推荐玩法。',
    buttonText: '查看主题',
    image: normalizedTheme.coverImage || '',
  };
}

function buildHomeActivityBanner(activity = {}) {
  const normalizedActivity = themeService.normalizeActivityItem(activity || {});
  if (!normalizedActivity.id) {
    return null;
  }
  return {
    id: `banner-${normalizedActivity.id}`,
    type: 'activity',
    targetId: normalizedActivity.id,
    eyebrow: normalizedActivity.status || '近期活动',
    title: normalizedActivity.title || '近期活动',
    subtitle:
      normalizedActivity.summary ||
      normalizedActivity.highlight ||
      '查看当前门店活动安排。',
    buttonText: '查看活动',
    image: normalizedActivity.image || normalizedActivity.coverImage || '',
  };
}

function buildHighlightCloudPath(highlightId, file = {}, index = 0) {
  const type = getHighlightMediaType(file);
  const appConfig = runtime.getAppConfig();
  const envVersion = String(appConfig.envVersion || 'develop').trim() || 'develop';
  const dataEnvTag = runtime.getDataEnvTag();
  const sourcePath = String(file.tempFilePath || file.path || '').trim();
  const matchedExt = sourcePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const extension = matchedExt ? matchedExt[1].toLowerCase() : type === 'video' ? 'mp4' : 'jpg';
  return [
    'staff-highlights',
    dataEnvTag,
    envVersion,
    String(highlightId || 'unknown'),
    `${Date.now()}-${index}.${extension}`,
  ].join('/');
}

function isCloudFileId(value = '') {
  return /^cloud:\/\//i.test(String(value || '').trim());
}

function isRemoteHttpUrl(value = '') {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function isLocalAvatarPath(value = '') {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return false;
  }
  if (isCloudFileId(normalizedValue) || isRemoteHttpUrl(normalizedValue)) {
    return false;
  }
  return (
    normalizedValue.startsWith('wxfile://') ||
    normalizedValue.startsWith('/') ||
    normalizedValue.startsWith('file://') ||
    normalizedValue.startsWith('weixin://')
  );
}

function buildAvatarCloudPath(avatarUrl = '') {
  const appConfig = runtime.getAppConfig();
  const envVersion = String(appConfig.envVersion || 'develop').trim() || 'develop';
  const dataEnvTag = runtime.getDataEnvTag();
  const matchedExt = String(avatarUrl || '').match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const extension = matchedExt ? matchedExt[1].toLowerCase() : 'jpg';
  return [
    'profile-avatars',
    dataEnvTag,
    envVersion,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`,
  ].join('/');
}

async function uploadProfileAvatarIfNeeded(avatarUrl = '') {
  const normalizedAvatarUrl = String(avatarUrl || '').trim();
  if (!normalizedAvatarUrl || !isLocalAvatarPath(normalizedAvatarUrl)) {
    return normalizedAvatarUrl;
  }
  if (!wx.cloud || typeof wx.cloud.uploadFile !== 'function') {
    throw new Error('cloud-upload-unavailable');
  }

  const uploadResult = await wx.cloud.uploadFile({
    cloudPath: buildAvatarCloudPath(normalizedAvatarUrl),
    filePath: normalizedAvatarUrl,
  });
  return String(uploadResult.fileID || uploadResult.fileId || '').trim();
}

function normalizeUploadedHighlightMedia(
  file = {},
  uploadResult = {},
  index = 0,
  titleIndex = 0
) {
  const type = getHighlightMediaType(file);
  return {
    id: `media-${Date.now()}-${index}`,
    type,
    title: String(file.title || buildHighlightMediaTitle(type, titleIndex)).trim(),
    fileId: String(uploadResult.fileID || uploadResult.fileId || '').trim(),
    size: Number(file.size || 0),
    duration: Number(file.duration || 0),
    uploadedAt: new Date().toISOString(),
  };
}

async function uploadHighlightMediaFiles(highlightId, files = [], existingMedia = []) {
  if (!wx.cloud || typeof wx.cloud.uploadFile !== 'function') {
    throw new Error('cloud-upload-unavailable');
  }

  const uploadedMedia = [];
  const nextTitleIndexMap = {
    image: (existingMedia || []).filter((item) => getHighlightMediaType(item) === 'image').length,
    video: (existingMedia || []).filter((item) => getHighlightMediaType(item) === 'video').length,
  };
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index] || {};
    const type = getHighlightMediaType(file);
    const tempFilePath = String(file.tempFilePath || file.path || '').trim();
    if (!tempFilePath) {
      continue;
    }
    const uploadResult = await wx.cloud.uploadFile({
      cloudPath: buildHighlightCloudPath(highlightId, file, index),
      filePath: tempFilePath,
    });
    uploadedMedia.push(
      normalizeUploadedHighlightMedia(file, uploadResult, index, nextTitleIndexMap[type])
    );
    nextTitleIndexMap[type] += 1;
  }

  return uploadedMedia;
}

function updateMockHighlightPackage(highlightId, media = []) {
  const highlightList = Array.isArray(mockData.staffHighlights) ? mockData.staffHighlights : [];
  const targetIndex = highlightList.findIndex(
    (item) => String(item.id || item._id || '') === String(highlightId || '')
  );
  if (targetIndex === -1) {
    return null;
  }

  const current = highlightList[targetIndex];
  const nextHighlight = {
    ...current,
    id: current.id || current._id || highlightId,
    status: media.length ? '已上传' : '待上传',
    media: media.map((item, index) => ({
      ...item,
      id: item.id || `media-${index + 1}`,
    })),
  };
  highlightList[targetIndex] = nextHighlight;

  const roomList = Array.isArray(mockData.teamRooms) ? mockData.teamRooms : [];
  const roomIndex = roomList.findIndex(
    (item) => String(item.groupId || '') === String(current.groupId || '')
  );
  if (roomIndex !== -1) {
    roomList[roomIndex] = {
      ...roomList[roomIndex],
      highlights: nextHighlight.media.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        fileId: item.fileId || '',
      })),
    };
  }

  return nextHighlight;
}

function normalizeProfileIdentityList(list = []) {
  const identityMap = new Map();
  (Array.isArray(list) ? list : []).forEach((item) => {
    if (typeof item === 'string') {
      const openId = String(item || '').trim();
      if (openId && !identityMap.has(openId)) {
        identityMap.set(openId, {
          openId,
          nickname: '',
          contactPhone: '',
        });
      }
      return;
    }

    const openId = String((item && item.openId) || '').trim();
    if (!openId) {
      return;
    }

    const current = identityMap.get(openId) || {
      openId,
      nickname: '',
      contactPhone: '',
    };
    identityMap.set(openId, {
      openId,
      nickname: String((item && item.nickname) || current.nickname || '').trim(),
      contactPhone: String((item && item.contactPhone) || current.contactPhone || '').trim(),
    });
  });
  return Array.from(identityMap.values());
}

async function fetchProfileMapByOpenIds(openIds = []) {
  const identities = normalizeProfileIdentityList(openIds);
  const normalizedOpenIds = identities.map((item) => item.openId).filter(Boolean);
  if (!normalizedOpenIds.length || runtime.useMock()) {
    return {};
  }

  try {
    const profileResult = await runtime.callCloudFunction('getProfile', {
      action: 'listProfiles',
      openIds: normalizedOpenIds,
      identities,
    });
    if (!profileResult.ok) {
      return {};
    }
    return teamRoomService.buildProfileMap((profileResult.profiles || []).filter(Boolean));
  } catch (error) {
    console.warn('[service] fetchProfileMapByOpenIds.failed', {
      count: normalizedOpenIds.length,
      message: error && error.message,
    });
    return {};
  }
}

async function attachSessionMemberProfiles(session = {}) {
  const members = Array.isArray(session.members) ? session.members : [];
  if (!members.length) {
    return {
      ...session,
      members: [],
    };
  }

  const currentProfile = profileService.getLocalProfile();
  const profileMap = await fetchProfileMapByOpenIds(members);

  return {
    ...session,
    members: members.map((item) => ({
      ...item,
      playerCard: profileService.buildPlayerCardByIdentity(
        {
          openId: item.openId || '',
          nickname: item.nickname || '',
        },
        {
          currentProfile,
          profileMap,
        }
      ),
    })),
  };
}

async function getHomeData() {
  const isMock = runtime.useMock();
  console.info('[service] getHomeData.start', {
    useMock: isMock,
    envId: getApp().globalData.envId,
    useMockData: getApp().globalData.useMockData,
  });
  if (isMock) {
    console.info('[service] getHomeData.mock');
    return runtime.delay({
      hero: mockData.homeData.hero,
      banners: mockData.homeData.banners,
      themeGroups: themeService.groupThemesByHorror(mockData.themes.map(themeService.enrichTheme)),
      activities: (mockData.homeData.activities || []).map(themeService.normalizeActivityItem),
      quickActions: mockData.homeData.quickActions,
    });
  }

  const [allThemesRes, activitiesRes] = await Promise.all([
    getCollection('themes').where({ status: 'online' }).orderBy('sort', 'asc').get(),
    getCollection('activities').orderBy('sort', 'asc').limit(2).get(),
  ]);
  const allThemes = (allThemesRes.data || []).map(themeService.enrichTheme);
  const activities = (activitiesRes.data || []).map(themeService.normalizeActivityItem);
  const banners = [
    buildHomeThemeBanner(allThemes[0], 'theme-0'),
    buildHomeThemeBanner(allThemes[1], 'theme-1'),
    buildHomeActivityBanner(activities[0]),
  ].filter(Boolean);

  console.info('[service] getHomeData.cloud.success', {
    themeCount: (allThemesRes.data || []).length,
    activityCount: (activitiesRes.data || []).length,
  });

  return {
    hero: {
      title: '今晚想玩什么，先从主题和队伍大厅开始',
      subtitle: '先看主题、再去大厅找人，玩完后的成长和集锦由系统自动沉淀。',
      actionText: '查看热门主题',
    },
    banners,
    themeGroups: themeService.groupThemesByHorror(allThemes),
    activities,
    quickActions: [
      { key: 'member', title: '会员档案', desc: '把玩过的主题沉淀成自己的记录' },
      { key: 'activity', title: '近期活动', desc: '查看老客福利和新主题动态' },
    ],
  };
}

async function getThemes(filters = {}) {
  console.info('[service] getThemes.start', {
    useMock: runtime.useMock(),
    filters,
  });
  if (!runtime.useMock()) {
    const result = await getCollection('themes')
      .where({ status: 'online' })
      .orderBy('sort', 'asc')
      .get();
    const cloudThemes = (result.data || []).map(themeService.enrichTheme);
    console.info('[service] getThemes.cloud.success', {
      count: cloudThemes.length,
    });
    return themeService.filterThemes(cloudThemes, filters);
  }

  return runtime.delay(
    themeService.filterThemes(mockData.themes.map(themeService.enrichTheme), filters)
  );
}

async function getThemeDetail(themeId) {
  if (!runtime.useMock()) {
    try {
      const result = await getCollection('themes').doc(themeId).get();
      if (result && result.data) {
        return themeService.enrichTheme(result.data);
      }
    } catch (error) {
      console.warn('[service] getThemeDetail.cloud.failed', {
        themeId,
        message: error && error.message,
      });
      return null;
    }
    return null;
  }

  const item = mockData.themes.find((theme) => theme.id === themeId) || null;
  return runtime.delay(item ? themeService.enrichTheme(item) : null);
}

async function getThemeReviews(themeId, options = {}) {
  const {
    sortBy = 'latest',
    filterKey = 'all',
    cursor = '',
    pageSize = 10,
  } = options;
  if (!themeId) {
    throw buildCloudError(
      failResult('主题信息不完整，请返回重试', 'THEME_ID_REQUIRED'),
      '评价加载失败，请稍后再试',
      'THEME_ID_REQUIRED',
      false
    );
  }

  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('themeReviewManage', {
      action: 'listReviews',
      themeId,
      sortBy,
      filterKey,
      cursor,
      pageSize,
    });
    if (!result.ok) {
      throw buildCloudError(
        result,
        '评价加载失败，请稍后再试',
        'THEME_REVIEW_LIST_FAILED',
        true
      );
    }
    return {
      reviews: Array.isArray(result.reviews) ? result.reviews : [],
      nextCursor: String(result.nextCursor || '').trim(),
      hasMore: Boolean(result.hasMore),
      viewerReviewMeta:
        result.viewerReviewMeta && typeof result.viewerReviewMeta === 'object'
          ? result.viewerReviewMeta
          : { canReview: false, reason: '', eligibleSessions: [] },
      reviewStats: themeService.normalizeReviewStats(result.reviewStats || {}),
    };
  }

  return runtime.delay({
    reviews: [],
    nextCursor: '',
    hasMore: false,
    viewerReviewMeta: {
      canReview: false,
      reason: '评价暂时不可用',
      eligibleSessions: [],
    },
    reviewStats: themeService.normalizeReviewStats({}),
  });
}

async function getPendingThemeReviews() {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('themeReviewManage', {
      action: 'listPendingReviews',
    });
    if (!result.ok) {
      throw buildCloudError(
        result,
        '待评价加载失败，请稍后再试',
        'THEME_PENDING_REVIEW_LIST_FAILED',
        true
      );
    }
    return {
      totalCount: Math.max(0, Number(result.totalCount || 0)),
      items: Array.isArray(result.items) ? result.items : [],
    };
  }

  return runtime.delay({
    totalCount: 0,
    items: [],
  });
}

async function getMyThemeReviews() {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('themeReviewManage', {
      action: 'listMyReviews',
    });
    if (!result.ok) {
      throw buildCloudError(
        result,
        '我的评价加载失败，请稍后再试',
        'THEME_MY_REVIEW_LIST_FAILED',
        true
      );
    }
    return {
      totalCount: Math.max(0, Number(result.totalCount || 0)),
      items: Array.isArray(result.items) ? result.items : [],
    };
  }

  return runtime.delay({
    totalCount: 0,
    items: [],
  });
}

async function listThemeReviewReplies(rootReviewId, options = {}) {
  const { cursor = '', pageSize = 10 } = options;
  if (!rootReviewId) {
    throw buildCloudError(
      failResult('这条回复暂时无法查看', 'ROOT_REVIEW_ID_REQUIRED'),
      '回复加载失败，请稍后再试',
      'ROOT_REVIEW_ID_REQUIRED',
      false
    );
  }

  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('themeReviewManage', {
      action: 'listReplies',
      rootReviewId,
      cursor,
      pageSize,
    });
    if (!result.ok) {
      throw buildCloudError(
        result,
        '回复加载失败，请稍后再试',
        'THEME_REVIEW_REPLY_LIST_FAILED',
        true
      );
    }
    return {
      replies: Array.isArray(result.replies) ? result.replies : [],
      nextCursor: String(result.nextCursor || '').trim(),
      hasMore: Boolean(result.hasMore),
    };
  }

  return runtime.delay({
    replies: [],
    nextCursor: '',
    hasMore: false,
  });
}

async function createThemeReview(payload = {}) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('themeReviewManage', {
      action: 'createReview',
      themeId: payload.themeId,
      sessionId: payload.sessionId,
      content: payload.content,
      rating: payload.rating,
      tags: payload.tags,
    });
    if (!result.ok) {
      return failResult(
        result.message || '评价提交失败，请稍后再试',
        result.errorCode || 'THEME_REVIEW_CREATE_FAILED',
        Boolean(result.retryable),
        result
      );
    }
    return {
      ok: true,
      message: result.message || '评价已提交',
      reviewId: String(result.reviewId || '').trim(),
    };
  }

  return runtime.delay(failResult('评价服务暂时不可用', 'THEME_REVIEW_MOCK_DISABLED'));
}

async function createThemeReviewReply(payload = {}) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('themeReviewManage', {
      action: 'createReply',
      reviewId: payload.reviewId,
      content: payload.content,
    });
    if (!result.ok) {
      return failResult(
        result.message || '回复提交失败，请稍后再试',
        result.errorCode || 'THEME_REVIEW_REPLY_CREATE_FAILED',
        Boolean(result.retryable),
        result
      );
    }
    return {
      ok: true,
      message: result.message || '回复已发送',
      replyId: String(result.replyId || '').trim(),
    };
  }

  return runtime.delay(failResult('回复服务暂时不可用', 'THEME_REVIEW_REPLY_MOCK_DISABLED'));
}

async function toggleThemeReviewLike(reviewId) {
  if (!reviewId) {
    return failResult('这条内容暂时不能点赞', 'REVIEW_ID_REQUIRED');
  }

  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('themeReviewManage', {
      action: 'toggleLike',
      reviewId,
    });
    if (!result.ok) {
      return failResult(
        result.message || '点赞处理失败，请稍后再试',
        result.errorCode || 'THEME_REVIEW_TOGGLE_LIKE_FAILED',
        Boolean(result.retryable),
        result
      );
    }
    return {
      ok: true,
      liked: Boolean(result.liked),
      likeCount: Math.max(0, Number(result.likeCount || 0)),
    };
  }

  return runtime.delay(failResult('点赞功能暂时不可用，请稍后再试', 'THEME_REVIEW_LIKE_MOCK_DISABLED'));
}

async function deleteThemeReview(reviewId) {
  if (!reviewId) {
    return failResult('这条内容暂时不能删除', 'REVIEW_ID_REQUIRED');
  }

  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('themeReviewManage', {
      action: 'deleteReview',
      reviewId,
    });
    if (!result.ok) {
      return failResult(
        result.message || '删除失败，请稍后再试',
        result.errorCode || 'THEME_REVIEW_DELETE_FAILED',
        Boolean(result.retryable),
        result
      );
    }
    return {
      ok: true,
      message: result.message || '已删除',
      deletedType: String(result.deletedType || '').trim(),
      reviewId: String(result.reviewId || '').trim(),
      deletedReplyCount: Math.max(0, Number(result.deletedReplyCount || 0)),
    };
  }

  return runtime.delay(failResult('删除功能暂时不可用，请稍后再试', 'THEME_REVIEW_DELETE_MOCK_DISABLED'));
}

async function getActivities() {
  console.info('[service] getActivities.start', {
    useMock: runtime.useMock(),
  });
  if (!runtime.useMock()) {
    const result = await getCollection('activities').orderBy('sort', 'asc').get();
    console.info('[service] getActivities.cloud.success', {
      count: (result.data || []).length,
    });
    return (result.data || []).map(themeService.normalizeActivityItem);
  }

  return runtime.delay((mockData.activities || []).map(themeService.normalizeActivityItem));
}

async function getGroupList() {
  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'listGroups',
    });
    if (!result.ok) {
      throw buildCloudError(result, '组局列表加载失败，请稍后重试', 'INTERNAL_SERVICE_ERROR', true);
    }
    syncGroupParticipationState(result);
    return groupService.attachParticipationState(
      (result.groups || []).map(groupService.normalizeGroupItem),
      groupService.getLocalActiveGroup(),
      groupService.getLocalRecentGroup()
    );
  }

  const activeGroup = groupService.getLocalActiveGroup();
  const recentGroup = groupService.getLocalRecentGroup();
  return runtime.delay(
    groupService.attachParticipationState(groupService.getLocalGroups(), activeGroup, recentGroup)
  );
}

async function getLobbyList() {
  const groups = await getGroupList();
  return groups;
}

async function getTeamRoom(groupId) {
  if (!groupId) {
    return null;
  }

  const activeGroup = groupService.getLocalActiveGroup();
  const currentProfile = profileService.getLocalProfile();

  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'getTeamRoom',
      groupId,
    });
    if (!result.ok) {
      throw buildCloudError(result, '队伍房间加载失败，请稍后重试', 'GROUP_ROOM_LOAD_FAILED', true);
    }
    const room = teamRoomService.normalizeRoomItem(result.room || null, { currentProfile });
    const profileMap = await fetchProfileMapByOpenIds(room.members || []);

    return avatarService.refreshAvatarUrlsDeep(
      teamRoomService.ensureActiveMemberInRoom(
        teamRoomService.normalizeRoomItem(room, { profileMap, currentProfile }),
        activeGroup
      )
    );
  }

  const groups = groupService.getLocalGroups();
  const group = groups.find((item) => item.id === groupId) || null;
  const localRoom = teamRoomService.getRoomByGroupId(groupId);
  if (localRoom) {
    return runtime.delay(teamRoomService.mergeRoomWithGroup(localRoom, group, activeGroup));
  }

  if (!group) {
    return runtime.delay(null);
  }
  return runtime.delay(teamRoomService.buildPreviewRoomFromGroup(group, activeGroup));
}

async function getProfile() {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('getProfile', {});
    if (!result.ok) {
      throw buildCloudError(result, '档案读取失败，请稍后重试', 'PROFILE_READ_FAILED', true);
    }
    const pendingPatchState = profileService.getPendingProfilePatch();
    const cloudProfile = result.profile || {};
    const cloudUpdatedAt = parseTimestamp(cloudProfile.updatedAt);
    const pendingUpdatedAt = Number(
      pendingPatchState && pendingPatchState.updatedAt ? pendingPatchState.updatedAt : 0
    );
    const shouldApplyPendingPatch = Boolean(
      pendingPatchState &&
      pendingPatchState.pendingPatch &&
      (!cloudUpdatedAt || pendingUpdatedAt >= cloudUpdatedAt)
    );
    const mergedProfile = shouldApplyPendingPatch
      ? profileService.applyEditablePatch(cloudProfile, pendingPatchState.pendingPatch)
      : cloudProfile;
    const savedProfile = profileService.saveLocalProfile(mergedProfile);
    if (
      pendingPatchState &&
      pendingPatchState.pendingPatch &&
      (profileService.isEditablePatchApplied(cloudProfile, pendingPatchState.pendingPatch) ||
        !shouldApplyPendingPatch)
    ) {
      profileService.clearPendingProfilePatch();
    }
    return savedProfile;
  }

  return runtime.delay(profileService.getLocalProfile());
}

async function persistProfilePatch(payload = {}, options = {}) {
  const {
    successMessage = '资料已更新',
    localFallbackMessage = '已保存到当前设备，网络恢复后会自动同步',
  } = options;
  const currentProfile = profileService.getLocalProfile();
  const patch = profileService.buildProfileSyncPatch(payload);
  const currentAvatarUrl = String((currentProfile && currentProfile.avatarUrl) || '').trim();
  const currentAvatarFileId = String((currentProfile && currentProfile.avatarFileId) || '').trim();
  if (
    Object.prototype.hasOwnProperty.call(patch, 'avatarUrl') &&
    currentAvatarFileId &&
    String(patch.avatarUrl || '').trim() === currentAvatarUrl
  ) {
    patch.avatarUrl = currentAvatarFileId;
  }
  const shouldUploadAvatar =
    Object.prototype.hasOwnProperty.call(patch, 'avatarUrl') && String(patch.avatarUrl || '').trim();

  if (!runtime.useMock()) {
    try {
      const persistedPatch = {
        ...patch,
        ...(shouldUploadAvatar
          ? { avatarUrl: await uploadProfileAvatarIfNeeded(patch.avatarUrl) }
          : {}),
      };
      const challengeStatsSource = profileService.applyProfileSyncPatch(
        currentProfile,
        persistedPatch
      );
      if (
        Object.prototype.hasOwnProperty.call(persistedPatch, 'wishThemes') ||
        Object.prototype.hasOwnProperty.call(persistedPatch, 'shareStats') ||
        Object.prototype.hasOwnProperty.call(persistedPatch, 'badgeSignals')
      ) {
        persistedPatch.challengeStats = profileService.buildDerivedChallengeStats(challengeStatsSource);
      }
      const result = await runtime.callCloudFunction('updateProfile', persistedPatch);
      if (!result.ok) {
        throw new Error(result.message || 'profile-update-failed');
      }

      const nextProfile = profileService.saveLocalProfile({
        ...(result.profile || {}),
        ...persistedPatch,
      });
      profileService.clearPendingProfilePatch();
      return runtime.delay({
        ok: true,
        message: result.message || successMessage,
        profile: nextProfile,
        syncMode: 'cloud',
      });
    } catch (error) {
      console.error('updateProfile cloud failed, fallback to local profile:', error);
      const nextProfile = profileService.updateLocalProfile(patch);
      profileService.savePendingProfilePatch(patch);
      return runtime.delay({
        ok: true,
        message: localFallbackMessage,
        profile: nextProfile,
        syncMode: 'local_fallback',
      });
    }
  }

  const nextProfile = profileService.updateLocalProfile(patch);
  profileService.clearPendingProfilePatch();
  return runtime.delay({
    ok: true,
    message: successMessage,
    profile: nextProfile,
    syncMode: 'mock',
  });
}

async function updateProfile(payload = {}) {
  return persistProfilePatch(payload, {
    successMessage: '个人资料已更新',
    localFallbackMessage: '已保存到当前设备，网络恢复后会自动同步',
  });
}

async function syncThemeWishlist(themes = []) {
  return persistProfilePatch(
    {
      wishThemes: themes,
    },
    {
      successMessage: '想玩清单已同步',
      localFallbackMessage: '想玩清单已暂存到本机，网络恢复后会自动同步',
    }
  );
}

async function addThemeToWishlist(theme = {}) {
  const nextList = wishlistService.addThemeToWishlist(theme);
  return syncThemeWishlist(nextList);
}

async function removeThemeFromWishlist(themeId = '') {
  const nextList = wishlistService.removeThemeFromWishlist(themeId);
  return syncThemeWishlist(nextList);
}

async function toggleThemeWishlist(theme = {}) {
  const result = wishlistService.toggleThemeWishlist(theme);
  const syncResult = await syncThemeWishlist(result.list);
  return {
    ...syncResult,
    wished: result.wished,
    list: result.list,
  };
}

async function recordProfileShare(source = '') {
  const currentProfile = profileService.getLocalProfile();
  const nextShareCount = Math.max(
    0,
    Number((currentProfile.shareStats && currentProfile.shareStats.shareCount) || 0) + 1
  );
  return persistProfilePatch(
    {
      shareStats: {
        shareCount: nextShareCount,
        source,
      },
    },
    {
      successMessage: '分享记录已同步',
      localFallbackMessage: '分享记录已暂存到本机，网络恢复后会自动同步',
    }
  );
}

async function redeemStaffAuthCode(code) {
  if (!runtime.useMock()) {
      const result = await runtime.callCloudFunction('staffManage', {
      action: 'redeemAuthCode',
      code,
    });
    if (!result.ok) {
      return buildFailureResult(result, '授权码无效或已失效，请联系店长重新获取', 'AUTH_CODE_INVALID');
    }
    const binding = staffService.normalizeStaffBinding(result.binding);
    syncStaffBindingState(binding);
    return {
      ok: true,
      binding,
      message: result.message || '授权成功',
    };
  }

  const normalizedCode = String(code || '')
    .trim()
    .toUpperCase();

  if (!normalizedCode) {
    return failResult('请输入授权码', 'AUTH_CODE_EMPTY');
  }

  const config = mockData.staffAuthCodes[normalizedCode];
  if (!config) {
    return runtime.delay(
      failResult('授权码无效或已失效，请联系店长重新获取', 'AUTH_CODE_INVALID')
    );
  }

  const binding = staffService.saveLocalStaffBinding({
    role: config.role,
    roleLabel: config.roleLabel,
    storeName: runtime.getAppConfig().storeName || '迷场档案馆',
    authCode: normalizedCode,
  });

  return runtime.delay({
    ok: true,
    binding,
  });
}

async function getStaffDashboard() {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'getDashboard',
    });
    if (!result.ok) {
      if (String(result.message || '').includes('请先完成授权绑定')) {
        clearStaffBindingState();
      }
      return buildFailureResult(
        result,
        '当前身份还没有门店工作台权限，请先完成授权绑定',
        'STAFF_BINDING_REQUIRED'
      );
    }
    return {
      ok: true,
      dashboard: await avatarService.refreshAvatarUrlsDeep(result.dashboard || {}),
    };
  }

  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay(
      failResult('当前身份还没有门店工作台权限，请先完成授权绑定', 'STAFF_BINDING_REQUIRED')
    );
  }

  const dashboard = mockData.staffDashboard[binding.role] || mockData.staffDashboard.staff;
  const sessions = staffService.getLocalStaffSessions();
  return runtime.delay({
    ok: true,
    dashboard: staffService.normalizeDashboard(
      {
        ...dashboard,
        stats: staffService.buildDashboardStats(sessions),
        sessions: staffService.buildDashboardSessions(sessions),
      },
      binding
    ),
  });
}

async function generateStaffAuthCode(role) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'generateAuthCode',
      role,
    });
    if (!result.ok) {
      return buildFailureResult(result, '授权码生成失败，请稍后重试', 'AUTH_CODE_GENERATE_FAILED', true);
    }
    return {
      ok: true,
      authCode: result.authCode,
      dashboard: result.dashboard || null,
      message: result.message || '授权码已生成',
    };
  }

  return runtime.delay(failResult('授权码生成服务暂时不可用', 'AUTH_CODE_GENERATE_FAILED', true));
}

async function removeStaffBinding(targetOpenId) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'removeStaffBinding',
      targetOpenId,
    });
    if (!result.ok) {
      return {
        ...buildFailureResult(result, '员工移除失败', 'INTERNAL_SERVICE_ERROR', true),
        dashboard: result && result.dashboard ? result.dashboard : null,
      };
    }
    return {
      ok: true,
      message: result.message || '员工已移除',
      dashboard: result && result.dashboard ? result.dashboard : null,
    };
  }

  return runtime.delay(failResult('员工管理服务暂时不可用', 'INTERNAL_SERVICE_ERROR', true));
}

async function transferManager(targetOpenId) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'transferManager',
      targetOpenId,
    });
    if (result && result.ok && result.dashboard) {
      const currentBinding = result.dashboard.role
        ? {
            role: result.dashboard.role,
            roleLabel: result.dashboard.roleLabel,
            storeName: result.dashboard.storeName,
          }
        : null;
      if (currentBinding) {
        syncStaffBindingState(currentBinding);
      }
    }
    if (!result.ok) {
      return {
        ...buildFailureResult(result, '店长转移失败', 'INTERNAL_SERVICE_ERROR', true),
        dashboard: result && result.dashboard ? result.dashboard : null,
      };
    }
    return {
      ok: true,
      message: result.message || '店长已转移',
      dashboard: result && result.dashboard ? result.dashboard : null,
    };
  }

  return runtime.delay(failResult('店长转移服务暂时不可用', 'INTERNAL_SERVICE_ERROR', true));
}

async function getStaffSession(sessionId) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'getSession',
      sessionId,
    });
    if (!result.ok) {
      if (String(result.message || '').includes('请先完成授权绑定')) {
        clearStaffBindingState();
      }
      return buildFailureResult(result, '没有找到这个场次，请返回工作台重试', 'SESSION_NOT_FOUND');
    }
    return {
      ok: true,
      session: await avatarService.refreshAvatarUrlsDeep(
        await attachSessionMemberProfiles(result.session || {})
      ),
    };
  }

  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay(
      failResult('当前身份还没有门店工作台权限，请先完成授权绑定', 'STAFF_BINDING_REQUIRED')
    );
  }

  const session = staffService.getSessionById(
    staffService.getLocalStaffSessions(),
    sessionId,
    binding
  );
  if (!session) {
    return runtime.delay(failResult('没有找到这个场次，请返回工作台重试', 'SESSION_NOT_FOUND'));
  }

  return runtime.delay({
    ok: true,
    session: await avatarService.refreshAvatarUrlsDeep(await attachSessionMemberProfiles(session)),
  });
}

async function runStaffSessionAction(sessionId, actionKey) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'runSessionAction',
      sessionId,
      actionKey,
    });
    if (!result.ok) {
      return buildFailureResult(result, '操作失败，请稍后重试', 'INTERNAL_SERVICE_ERROR', true);
    }
    return {
      ok: true,
      session: await avatarService.refreshAvatarUrlsDeep(
        await attachSessionMemberProfiles(result.session || {})
      ),
    };
  }

  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay(
      failResult('当前身份还没有门店工作台权限，请先完成授权绑定', 'STAFF_BINDING_REQUIRED')
    );
  }

  const sessions = staffService.getLocalStaffSessions();
  const index = sessions.findIndex((item) => item.id === sessionId);
  if (index === -1) {
    return runtime.delay(failResult('没有找到这个场次，请返回工作台重试', 'SESSION_NOT_FOUND'));
  }

  const actionValidation = staffService.validateSessionAction(sessions[index], actionKey);
  if (!actionValidation.ok) {
    return runtime.delay(actionValidation);
  }

  sessions[index] = staffService.buildNextSessionState(sessions[index], actionKey);
  staffService.saveLocalStaffSessions(sessions);
  teamRoomService.updateRoomMembersByGroupId(
    sessions[index].groupId,
    sessions[index].members,
    sessions[index].stageKey
  );

  return runtime.delay({
    ok: true,
    session: await avatarService.refreshAvatarUrlsDeep(
      await attachSessionMemberProfiles(staffService.getSessionById(sessions, sessionId, binding))
    ),
  });
}

async function updateStaffSessionMember(sessionId, memberOpenId) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'toggleSessionMember',
      sessionId,
      openId: memberOpenId,
    });
    if (!result.ok) {
      return buildFailureResult(result, '更新失败，请稍后重试', 'INTERNAL_SERVICE_ERROR', true);
    }
    return {
      ok: true,
      session: await avatarService.refreshAvatarUrlsDeep(
        await attachSessionMemberProfiles(result.session || {})
      ),
    };
  }

  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay(
      failResult('当前身份还没有门店工作台权限，请先完成授权绑定', 'STAFF_BINDING_REQUIRED')
    );
  }

  const sessions = staffService.getLocalStaffSessions();
  const index = sessions.findIndex((item) => item.id === sessionId);
  if (index === -1) {
    return runtime.delay(failResult('没有找到这个场次，请返回工作台重试', 'SESSION_NOT_FOUND'));
  }

  const toggleValidation = staffService.validateSessionMemberToggle(sessions[index], memberOpenId);
  if (!toggleValidation.ok) {
    return runtime.delay(toggleValidation);
  }

  sessions[index] = staffService.toggleSessionMemberCheckIn(sessions[index], memberOpenId);
  staffService.saveLocalStaffSessions(sessions);
  teamRoomService.updateRoomMembersByGroupId(
    sessions[index].groupId,
    sessions[index].members,
    sessions[index].stageKey
  );

  return runtime.delay({
    ok: true,
    session: await avatarService.refreshAvatarUrlsDeep(
      await attachSessionMemberProfiles(staffService.getSessionById(sessions, sessionId, binding))
    ),
  });
}

async function getStaffHighlights() {
  const binding = staffService.getLocalStaffBinding();
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'getHighlights',
    });
    if (!result.ok) {
      return buildFailureResult(result, '集锦库加载失败，请稍后重试', 'INTERNAL_SERVICE_ERROR', true);
    }
    return {
      ok: true,
      highlights: staffService.normalizeHighlightPackages(result.highlights || [], binding || {}),
    };
  }

  if (!binding || !binding.role) {
    return runtime.delay(
      failResult('当前身份还没有门店工作台权限，请先完成授权绑定', 'STAFF_BINDING_REQUIRED')
    );
  }

  return runtime.delay({
    ok: true,
    highlights: staffService.normalizeHighlightPackages(mockData.staffHighlights, binding),
  });
}

async function saveStaffHighlights(highlightId, media = []) {
  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay(
      failResult('当前身份还没有门店工作台权限，请先完成授权绑定', 'STAFF_BINDING_REQUIRED')
    );
  }

  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'saveHighlights',
      highlightId,
      media,
    });
    if (!result.ok) {
      return buildFailureResult(result, '集锦保存失败，请稍后重试', 'INTERNAL_SERVICE_ERROR', true);
    }

    return {
      ok: true,
      highlight:
        staffService.normalizeHighlightPackages([result.highlight || {}], binding)[0] || null,
      message: result.message || '集锦已保存',
    };
  }

  const nextHighlight = updateMockHighlightPackage(highlightId, media);
  if (!nextHighlight) {
    return runtime.delay(failResult('没有找到对应的集锦包，请返回重试', 'HIGHLIGHT_NOT_FOUND'));
  }

  return runtime.delay({
    ok: true,
    highlight: staffService.normalizeHighlightPackages([nextHighlight], binding)[0] || null,
    message: media.length ? '集锦已保存' : '集锦内容已清空',
  });
}

async function appendStaffHighlightMedia(highlightId, files = [], currentMedia = []) {
  const existingMedia = Array.isArray(currentMedia) ? currentMedia : [];
  if (existingMedia.length + files.length > 9) {
    return failResult('单场最多保留 9 个集锦内容', 'HIGHLIGHT_LIMIT_EXCEEDED');
  }

  if (!runtime.useMock()) {
    const uploadedMedia = await uploadHighlightMediaFiles(highlightId, files, existingMedia);
    return saveStaffHighlights(highlightId, existingMedia.concat(uploadedMedia));
  }

  const nextTitleIndexMap = {
    image: existingMedia.filter((item) => getHighlightMediaType(item) === 'image').length,
    video: existingMedia.filter((item) => getHighlightMediaType(item) === 'video').length,
  };
  const mockMedia = (files || []).map((file, index) => {
    const type = getHighlightMediaType(file);
    const media = normalizeUploadedHighlightMedia(
      file,
      {
        fileID: `mock://staff-highlights/${highlightId}/${Date.now()}-${index}`,
      },
      index,
      nextTitleIndexMap[type]
    );
    nextTitleIndexMap[type] += 1;
    return media;
  });
  return saveStaffHighlights(highlightId, existingMedia.concat(mockMedia));
}

async function getLeaderboard(period = 'total') {
  const result = await runtime.callCloudFunction('getLeaderboard', { period });
  if (!result.ok) {
    return buildFailureResult(result, '排行榜加载失败，请稍后重试', 'LEADERBOARD_READ_FAILED', true);
  }
  return {
    ok: true,
    leaderboard: await avatarService.refreshAvatarUrlsDeep(result.leaderboard || []),
    summary: result.summary || leaderboardService.buildLeaderboardSummary([]),
  };
}

async function getStaffAnalytics() {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', { action: 'getAnalytics' });
    if (!result.ok) {
      return buildFailureResult(result, '运营数据加载失败，请稍后重试', 'ANALYTICS_LOAD_FAILED', true);
    }
    return {
      ok: true,
      analytics: result.analytics || {},
    };
  }
  return runtime.delay({
    ok: true,
    analytics: {
      summary: { totalSessions: 0, sessionsThisWeek: 0, sessionsThisMonth: 0, avgTeamSize: '0' },
      themeBreakdown: [],
      monthlyTrend: [],
    },
  });
}

async function createGroup(payload = {}) {
  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'createGroup',
      payload,
    });
    if (!result.ok) {
      return buildFailureResult(result, '队伍发布失败，请稍后重试', 'INTERNAL_SERVICE_ERROR', true);
    }

    syncGroupParticipationState(result);
    if ((!result.activeGroup || !result.activeGroup.groupId) && result.group) {
      groupService.saveLocalActiveGroup({
        groupId: result.group.id || '',
        role: 'creator',
        themeName: result.group.themeName || '',
        contactName: payload.contactName || '',
        contactPhone: payload.contactPhone || '',
      });
    }
    return {
      ok: true,
      message: result.message || '队伍已发布，列表已更新',
      group: groupService.normalizeGroupItem(result.group || {}),
      groups: (result.groups || []).map(groupService.normalizeGroupItem),
    };
  }

  const validateResult = groupService.validateCreateGroupPayload(payload);
  if (!validateResult.ok) {
    return validateResult;
  }

  const activeGroup = groupService.getLocalActiveGroup();
  if (groupService.hasConflictingActiveGroup(activeGroup, 'creating-new-group')) {
    return failResult(
      `你已经在参与「${activeGroup.themeName || '当前队伍'}」，请先结束这场后再发起新的队伍`,
      'GROUP_ALREADY_ACTIVE'
    );
  }

  const currentGroups = groupService.getLocalGroups();
  const nextGroup = groupService.normalizeGroupItem({
    id: `group-${Date.now()}`,
    ...validateResult.payload,
    creatorOpenId: 'local-user',
    joinedPhones: [],
    joinedMemberNames: [],
    participantNames: [validateResult.payload.contactName],
    createdAt: new Date().toISOString(),
  });
  const nextGroups = groupService.saveLocalGroups([nextGroup].concat(currentGroups));
  groupService.saveLocalActiveGroup({
    groupId: nextGroup.id,
    role: 'creator',
    themeName: nextGroup.themeName,
    contactName: validateResult.payload.contactName,
    contactPhone: validateResult.payload.contactPhone,
  });

  return runtime.delay({
    ok: true,
    message: '队伍已发布，列表已更新',
    group: nextGroup,
    groups: nextGroups,
  });
}

async function joinGroup(groupId, payload = {}) {
  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'joinGroup',
      groupId,
      payload,
    });
    if (!result.ok) {
      return buildFailureResult(result, '报名失败，请稍后重试', 'INTERNAL_SERVICE_ERROR', true);
    }

    syncGroupParticipationState(result);
    if ((!result.activeGroup || !result.activeGroup.groupId) && result.group) {
      groupService.saveLocalActiveGroup({
        groupId: result.group.id || groupId || '',
        role: 'member',
        themeName: result.group.themeName || '',
        contactName: payload.contactName || '',
        contactPhone: payload.contactPhone || '',
      });
    }
    return {
      ok: true,
      message: result.message || '报名成功',
      group: groupService.normalizeGroupItem(result.group || {}),
    };
  }

  const validateResult = groupService.validateJoinGroupPayload(payload);
  if (!validateResult.ok) {
    return validateResult;
  }

  const activeGroup = groupService.getLocalActiveGroup();
  if (groupService.hasConflictingActiveGroup(activeGroup, groupId)) {
    return failResult(
      `你已经在参与「${activeGroup.themeName || '当前队伍'}」，不能再加入其他队伍`,
      'GROUP_ALREADY_ACTIVE'
    );
  }
  if (activeGroup && String(activeGroup.groupId || '') === String(groupId || '')) {
    return failResult('你已经在参与当前队伍了', 'GROUP_ALREADY_ACTIVE');
  }

  const currentGroups = groupService.getLocalGroups();
  const groupIndex = currentGroups.findIndex((item) => item.id === groupId);
  if (groupIndex === -1) {
    return failResult('队伍不存在或已下架，请刷新后重试', 'GROUP_NOT_FOUND');
  }

  const targetGroup = currentGroups[groupIndex];
  if ((targetGroup.joinedPhones || []).includes(validateResult.payload.contactPhone)) {
    return failResult('这个手机号已经报过这场队伍了', 'GROUP_PHONE_DUPLICATED');
  }

  if (Number(targetGroup.neededPeople || 0) <= 0) {
    return failResult('这个队伍已经满员了', 'GROUP_FULL');
  }

  const nextGroups = currentGroups.slice();
  const nextParticipantNames =
    Array.isArray(targetGroup.participantNames) && targetGroup.participantNames.length
      ? targetGroup.participantNames.slice()
      : [targetGroup.creatorName || targetGroup.contactName].filter(Boolean);
  nextGroups[groupIndex] = groupService.normalizeGroupItem({
    ...targetGroup,
    joinedPhones: (targetGroup.joinedPhones || []).concat(validateResult.payload.contactPhone),
    joinedMemberNames: (targetGroup.joinedMemberNames || []).concat(
      validateResult.payload.contactName
    ),
    participantNames: nextParticipantNames.concat(validateResult.payload.contactName),
  });

  groupService.saveLocalGroups(nextGroups);
  groupService.saveLocalActiveGroup({
    groupId,
    role: 'member',
    themeName: nextGroups[groupIndex].themeName,
    contactName: validateResult.payload.contactName,
    contactPhone: validateResult.payload.contactPhone,
  });

  return runtime.delay({
    ok: true,
    message:
      nextGroups[groupIndex].neededPeople > 0
        ? '报名成功，店员可继续跟进拼场'
        : '报名成功，这场已经凑满了',
    group: nextGroups[groupIndex],
  });
}

async function previewGroupCancelPenalty(groupId) {
  const normalizedGroupId = String(groupId || '').trim();
  if (!normalizedGroupId) {
    return failResult('没有找到要取消的队伍', 'GROUP_NOT_FOUND');
  }

  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'previewCancelPenalty',
      groupId: normalizedGroupId,
    });
    if (!result.ok) {
      return buildFailureResult(result, '无法获取取消惩罚预览，请稍后重试', 'INTERNAL_SERVICE_ERROR', true);
    }
    return {
      ok: true,
      preview: result.preview || null,
    };
  }

  const currentGroups = groupService.getLocalGroups();
  const targetGroup = currentGroups.find((item) => String(item.id || '') === normalizedGroupId);
  if (!targetGroup) {
    return runtime.delay(failResult('没有找到要取消的队伍', 'GROUP_NOT_FOUND'));
  }

  const joinedMemberCount = Array.isArray(targetGroup.joinedMemberNames)
    ? targetGroup.joinedMemberNames.length
    : 0;
  return runtime.delay({
    ok: true,
    preview: {
      shouldWarn: joinedMemberCount > 0,
      totalPenalty: 0,
      affectedMemberCount: joinedMemberCount,
      currentScore: 100,
      nextScore: 100,
      basePenalty: 0,
      timePenalty: 0,
      repeatPenalty: 0,
      reasonText:
        joinedMemberCount > 0
          ? '本地预览模式不计算真实信誉分扣减，请以上线环境结果为准。'
          : '当前还没有其他玩家加入，取消不会触发信誉分惩罚。',
    },
  });
}

async function cancelActiveGroup(groupId, reason) {
  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const activeGroup = groupService.getLocalActiveGroup();
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'cancelActiveGroup',
      groupId,
      reason: String(reason || '').trim(),
      payload: {
        contactName: (activeGroup && activeGroup.contactName) || '',
        contactPhone: (activeGroup && activeGroup.contactPhone) || '',
      },
    });
    if (!result.ok) {
      return buildFailureResult(result, '当前没有可取消的队伍', 'GROUP_NOT_FOUND');
    }

    syncGroupParticipationState(result);
    return {
      ok: true,
      message: result.message || '队伍状态已更新',
    };
  }

  const activeGroup = groupService.getLocalActiveGroup();
  const targetGroupId = String(groupId || (activeGroup && activeGroup.groupId) || '');
  if (!targetGroupId) {
    return runtime.delay(failResult('当前没有可取消的队伍', 'GROUP_NOT_FOUND'));
  }

  const currentGroups = groupService.getLocalGroups();
  const groupIndex = currentGroups.findIndex((item) => item.id === targetGroupId);
  if (groupIndex === -1) {
    return runtime.delay(failResult('没有找到要取消的队伍', 'GROUP_NOT_FOUND'));
  }

  // 如果 activeGroup 为空，说明组局已经取消或不存在
  if (!activeGroup) {
    return runtime.delay({
      ok: true,
      message: '这场队伍已经取消了',
    });
  }

  const nextGroups = currentGroups.slice();
  const targetGroup = nextGroups[groupIndex];
  const isCreator = activeGroup.role === 'creator';

  if (isCreator) {
    nextGroups[groupIndex] = groupService.normalizeGroupItem({
      ...targetGroup,
      status: 'cancelled',
      note: `发起人已取消该队伍。${targetGroup.note ? ` ${targetGroup.note}` : ''}`.trim(),
    });
    groupService.saveLocalRecentGroup({
      groupId: targetGroup.id,
      role: 'creator',
      themeName: targetGroup.themeName,
      status: 'cancelled',
    });
  } else {
    nextGroups[groupIndex] = groupService.normalizeGroupItem({
      ...targetGroup,
      joinedPhones: (targetGroup.joinedPhones || []).filter(
        (item) => String(item || '') !== activeGroup.contactPhone
      ),
      joinedMemberNames: (targetGroup.joinedMemberNames || []).filter(
        (item) => String(item || '') !== activeGroup.contactName
      ),
      participantNames: (targetGroup.participantNames || []).filter(
        (item) => String(item || '') !== activeGroup.contactName
      ),
    });
    groupService.clearLocalRecentGroup();
  }

  groupService.saveLocalGroups(nextGroups);
  if (activeGroup && activeGroup.groupId === targetGroupId) {
    groupService.clearLocalActiveGroup();
  }

  return runtime.delay({
    ok: true,
    message: isCreator ? '队伍已取消' : '你已退出该队伍',
  });
}

async function deleteGroupRecord(groupId) {
  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'deleteGroupRecord',
      groupId,
    });
    if (!result.ok) {
      return buildFailureResult(result, '队伍记录删除失败，请稍后重试', 'INTERNAL_SERVICE_ERROR', true);
    }

    syncGroupParticipationState(result);
    return {
      ok: true,
      message: result.message || '队伍记录已删除',
    };
  }

  const normalizedGroupId = String(groupId || '');
  if (!normalizedGroupId) {
    return runtime.delay(failResult('没有找到要删除的队伍', 'GROUP_NOT_FOUND'));
  }

  const activeGroup = groupService.getLocalActiveGroup();
  if (activeGroup && activeGroup.groupId === normalizedGroupId) {
    return runtime.delay(failResult('进行中的队伍不能直接删除', 'GROUP_DELETE_FORBIDDEN'));
  }

  const currentGroups = groupService.getLocalGroups();
  const nextGroups = currentGroups.filter((item) => item.id !== normalizedGroupId);
  if (nextGroups.length === currentGroups.length) {
    return runtime.delay(failResult('这条队伍记录已经不存在了', 'GROUP_NOT_FOUND'));
  }

  groupService.saveLocalGroups(nextGroups);
  const recentGroup = groupService.getLocalRecentGroup();
  if (recentGroup && recentGroup.groupId === normalizedGroupId) {
    groupService.clearLocalRecentGroup();
  }

  return runtime.delay({
    ok: true,
    message: '队伍记录已删除',
  });
}

module.exports = {
  getHomeData,
  getThemes,
  getThemeDetail,
  getThemeReviews,
  getPendingThemeReviews,
  getMyThemeReviews,
  listThemeReviewReplies,
  createThemeReview,
  createThemeReviewReply,
  toggleThemeReviewLike,
  deleteThemeReview,
  getActivities,
  getGroupList,
  getLobbyList,
  getTeamRoom,
  getProfile,
  redeemStaffAuthCode,
  getStaffDashboard,
  generateStaffAuthCode,
  removeStaffBinding,
  transferManager,
  getStaffSession,
  runStaffSessionAction,
  updateStaffSessionMember,
  getStaffHighlights,
  saveStaffHighlights,
  appendStaffHighlightMedia,
  getLeaderboard,
  getStaffAnalytics,
  createGroup,
  joinGroup,
  previewGroupCancelPenalty,
  cancelActiveGroup,
  deleteGroupRecord,
  clearLocalUserData,
  updateProfile,
  addThemeToWishlist,
  removeThemeFromWishlist,
  toggleThemeWishlist,
  recordProfileShare,
  filterThemes: themeService.filterThemes,
  __test__: {
    syncGroupParticipationState,
  },
};
