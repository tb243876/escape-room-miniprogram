'use strict';

const mockData = require('../../mock/data');
const storage = require('../platform/storage');

function cloneDefaultGroups() {
  return JSON.parse(JSON.stringify(mockData.groups || []));
}

function formatGroupDateLabel(dateValue) {
  const value = String(dateValue || '').trim();
  if (!value) {
    return '';
  }
  const parts = value.split('-');
  if (parts.length !== 3) {
    return value;
  }
  return `${parts[1]}月${parts[2]}日`;
}

function buildTimestamp(dateValue, timeSlot) {
  const value = String(dateValue || '').trim();
  const time = String(timeSlot || '').trim() || '00:00';
  const timestamp = new Date(`${value}T${time}:00`).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sanitizeText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeRawStatus(item = {}, neededPeople = 0) {
  const roomStage = String(item.roomStage || '').trim();
  if (roomStage === 'settled' || roomStage === 'archived') {
    return 'settled';
  }
  if (roomStage === 'playing') {
    return 'playing';
  }
  if (roomStage === 'ready') {
    return 'confirmed';
  }
  if (roomStage === 'pending_confirm') {
    return 'pending_store_confirm';
  }

  const reverseStatusMap = {
    招募中: 'recruiting',
    人数已满: 'full',
    已满员: 'full',
    待门店确认: 'pending_store_confirm',
    确认成功: 'confirmed',
    游戏中: 'playing',
    已结算: 'settled',
    已取消: 'cancelled',
    异常取消: 'cancelled',
    已退出: 'cancelled',
  };

  const preferredStatus =
    reverseStatusMap[String(item.status || item.rawStatus || '').trim()] ||
    String(item.status || item.rawStatus || '').trim();
  if (['cancelled', 'settled', 'playing', 'confirmed'].includes(preferredStatus)) {
    return preferredStatus;
  }

  return neededPeople > 0 ? 'recruiting' : 'pending_store_confirm';
}

function buildGroupMembers(item = {}, currentPeople = 1) {
  const creatorName =
    sanitizeText(item.creatorName || item.contactName || '发起人', 12) || '发起人';
  const participantNames = Array.isArray(item.participantNames)
    ? item.participantNames.map((name) => sanitizeText(name, 12)).filter(Boolean)
    : [];
  const joinedMemberNames = Array.isArray(item.joinedMemberNames)
    ? item.joinedMemberNames.map((name) => sanitizeText(name, 12)).filter(Boolean)
    : [];
  const members = participantNames.length
    ? participantNames
    : [creatorName].concat(joinedMemberNames).filter(Boolean).slice(0, currentPeople);

  return {
    creatorName,
    joinedMemberNames,
    members,
  };
}

function normalizeGroupItem(item) {
  const participantNames = Array.isArray(item.participantNames)
    ? item.participantNames.map((name) => sanitizeText(name, 12)).filter(Boolean)
    : [];
  const currentPeople = participantNames.length
    ? participantNames.length
    : Math.max(1, Number(item.currentPeople || 0));
  const targetPeople = Math.max(
    currentPeople,
    Number(item.targetPeople || item.currentPeople || currentPeople)
  );
  const neededPeople = Math.max(0, targetPeople - currentPeople);
  const dateValue = item.dateValue || '';
  const date = item.date || formatGroupDateLabel(dateValue);
  const rawStatus = normalizeRawStatus(item, neededPeople);
  const statusMap = {
    recruiting: '招募中',
    full: '人数已满',
    pending_store_confirm: '待门店确认',
    confirmed: '确认成功',
    playing: '游戏中',
    settled: '已结算',
    cancelled: '已取消',
  };
  const status = statusMap[rawStatus] || rawStatus || (neededPeople > 0 ? '招募中' : '人数已满');
  const memberInfo = buildGroupMembers(item, currentPeople);

  return {
    id: item.id,
    creatorOpenId: item.creatorOpenId || '',
    themeId: item.themeId || '',
    themeName: item.themeName || '',
    date,
    dateValue,
    timeSlot: item.timeSlot || '',
    currentPeople,
    targetPeople,
    neededPeople,
    note: item.note || '',
    rawStatus,
    status,
    roomStage: item.roomStage || '',
    contactName: item.contactName || '',
    contactPhone: item.contactPhone || '',
    creatorName: memberInfo.creatorName,
    joinedPhones: Array.isArray(item.joinedPhones) ? item.joinedPhones : [],
    joinedMemberNames: memberInfo.joinedMemberNames,
    participantNames: participantNames.length ? participantNames : memberInfo.members,
    members: memberInfo.members,
    createdAt: item.createdAt || '',
    sortTime: buildTimestamp(dateValue, item.timeSlot),
    hiddenForViewer: Boolean(item.hiddenForViewer),
    viewerRelated: Boolean(item.viewerRelated),
    viewerRole: item.viewerRole || '',
    viewerStatus: item.viewerStatus || '',
    viewerContactName: item.viewerContactName || '',
  };
}

function getLocalGroups() {
  const stored = storage.safeGetStorage(storage.GROUP_STORAGE_KEY);
  const source = Array.isArray(stored) && stored.length ? stored : cloneDefaultGroups();
  return source.map(normalizeGroupItem).sort((left, right) => {
    const leftTime = Number(left.sortTime || 0);
    const rightTime = Number(right.sortTime || 0);
    if (!leftTime || !rightTime) {
      return 0;
    }
    return leftTime - rightTime;
  });
}

function saveLocalGroups(groups) {
  const normalized = Array.isArray(groups) ? groups.map(normalizeGroupItem) : [];
  storage.safeSetStorage(storage.GROUP_STORAGE_KEY, normalized);
  return normalized;
}

function getLocalActiveGroup() {
  const activeGroup = storage.safeGetStorage(storage.ACTIVE_GROUP_STORAGE_KEY);
  if (!activeGroup || !activeGroup.groupId) {
    return null;
  }
  return {
    groupId: String(activeGroup.groupId || ''),
    role: String(activeGroup.role || 'member'),
    themeName: String(activeGroup.themeName || ''),
    contactName: String(activeGroup.contactName || ''),
    contactPhone: String(activeGroup.contactPhone || ''),
  };
}

function saveLocalActiveGroup(activeGroup) {
  if (!activeGroup || !activeGroup.groupId) {
    storage.safeRemoveStorage(storage.ACTIVE_GROUP_STORAGE_KEY);
    return null;
  }
  storage.safeSetStorage(storage.ACTIVE_GROUP_STORAGE_KEY, {
    groupId: String(activeGroup.groupId || ''),
    role: String(activeGroup.role || 'member'),
    themeName: String(activeGroup.themeName || ''),
    contactName: String(activeGroup.contactName || ''),
    contactPhone: String(activeGroup.contactPhone || ''),
  });
  return getLocalActiveGroup();
}

function clearLocalActiveGroup() {
  storage.safeRemoveStorage(storage.ACTIVE_GROUP_STORAGE_KEY);
}

function getLocalRecentGroup() {
  const recentGroup = storage.safeGetStorage(storage.RECENT_GROUP_STORAGE_KEY);
  if (!recentGroup || !recentGroup.groupId) {
    return null;
  }
  return {
    groupId: String(recentGroup.groupId || ''),
    role: String(recentGroup.role || 'member'),
    themeName: String(recentGroup.themeName || ''),
    status: String(recentGroup.status || ''),
    contactName: String(recentGroup.contactName || ''),
  };
}

function saveLocalRecentGroup(recentGroup) {
  if (!recentGroup || !recentGroup.groupId) {
    storage.safeRemoveStorage(storage.RECENT_GROUP_STORAGE_KEY);
    return null;
  }
  storage.safeSetStorage(storage.RECENT_GROUP_STORAGE_KEY, {
    groupId: String(recentGroup.groupId || ''),
    role: String(recentGroup.role || 'member'),
    themeName: String(recentGroup.themeName || ''),
    status: String(recentGroup.status || ''),
    contactName: String(recentGroup.contactName || ''),
  });
  return getLocalRecentGroup();
}

function clearLocalRecentGroup() {
  storage.safeRemoveStorage(storage.RECENT_GROUP_STORAGE_KEY);
}

function hasConflictingActiveGroup(activeGroup, targetGroupId) {
  return Boolean(
    activeGroup &&
    activeGroup.groupId &&
    targetGroupId &&
    String(activeGroup.groupId) !== String(targetGroupId)
  );
}

function isExpiredRecruitingGroup(item = {}) {
  const rawStatus = String(item.rawStatus || '').trim();
  const sortTime = Number(item.sortTime || 0);
  return (
    Boolean(sortTime) &&
    sortTime < Date.now() &&
    rawStatus !== 'confirmed' &&
    rawStatus !== 'playing'
  );
}

function isGroupStillActive(item = {}) {
  return (
    item.rawStatus !== 'cancelled' &&
    item.rawStatus !== 'settled' &&
    !isExpiredRecruitingGroup(item)
  );
}

function isActiveParticipationItem(item = {}) {
  const viewerRelated = Boolean(
    item.viewerRelated || item.viewerRole || item.viewerStatus || item.viewerContactName
  );
  return viewerRelated && item.viewerStatus === 'active' && isGroupStillActive(item);
}

function attachParticipationState(groups, activeGroup, recentGroup) {
  return (groups || []).map((item) => {
    const viewerRelated = Boolean(
      item.viewerRelated || item.viewerRole || item.viewerStatus || item.viewerContactName
    );
    // 组局已取消、已结算，或已过期可清理时，不再视为当前活跃参与。
    const isActive = isGroupStillActive(item);
    const isMyActive =
      isActive &&
      Boolean(
        (activeGroup && activeGroup.groupId === item.id) ||
        (!activeGroup && isActiveParticipationItem(item))
      );

    // 我参与过的组局（已取消/已结算/非活跃）应该显示在"我的"页签
    const isMyRecent = Boolean(
      !isMyActive &&
      (
        (recentGroup && recentGroup.groupId === item.id) ||
        (viewerRelated &&
          ((item.viewerStatus && item.viewerStatus !== 'active') ||
            item.rawStatus === 'cancelled' ||
            item.rawStatus === 'settled'))
      )
    );

    return {
      ...item,
      isMyActiveGroup: isMyActive,
      isMyRecentGroup: isMyRecent,
      myContactName:
        activeGroup && activeGroup.groupId === item.id
          ? activeGroup.contactName || ''
          : recentGroup && recentGroup.groupId === item.id
            ? recentGroup.contactName || ''
            : item.viewerContactName || '',
      myGroupRole:
        activeGroup && activeGroup.groupId === item.id
          ? activeGroup.role === 'creator'
            ? '我发起的'
            : '我已加入'
          : recentGroup && recentGroup.groupId === item.id
            ? recentGroup.role === 'creator'
              ? '我发起的'
              : '我已加入'
            : viewerRelated
              ? item.viewerRole === 'creator'
                ? '我发起的'
                : '我已加入'
              : '',
      participationClass:
        activeGroup && activeGroup.groupId === item.id
          ? activeGroup.role === 'creator'
            ? 'group-card-owner'
            : 'group-card-member'
          : recentGroup && recentGroup.groupId === item.id
            ? recentGroup.role === 'creator'
              ? 'group-card-owner'
              : 'group-card-member'
            : viewerRelated
              ? item.viewerRole === 'creator'
                ? 'group-card-owner'
                : 'group-card-member'
              : 'group-card-public',
      viewerRelated,
      hasOtherActiveGroup: hasConflictingActiveGroup(activeGroup, item.id),
    };
  });
}

function normalizePhone(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 11);
}

function fail(errorCode, message) {
  return {
    ok: false,
    errorCode,
    message,
    retryable: false,
  };
}

function validateCreateGroupPayload(payload = {}) {
  const themeId = sanitizeText(payload.themeId, 64);
  const themeName = sanitizeText(payload.themeName, 24);
  const dateValue = sanitizeText(payload.dateValue, 16);
  const timeSlot = sanitizeText(payload.timeSlot, 8);
  const contactName = sanitizeText(payload.contactName, 12);
  const contactPhone = normalizePhone(payload.contactPhone);
  const note = sanitizeText(payload.note, 80);
  const currentPeople = 1;
  const targetPeople = Math.min(8, Math.max(2, Number(payload.targetPeople || 0)));

  if (!themeName) {
    return fail('REQUEST_PARAM_INVALID', '请选择组局主题');
  }
  if (!dateValue) {
    return fail('REQUEST_PARAM_INVALID', '请选择组局日期');
  }
  if (!timeSlot) {
    return fail('REQUEST_PARAM_INVALID', '请选择开场时间');
  }
  if (!contactName) {
    return fail('REQUEST_PARAM_INVALID', '请输入联系人称呼');
  }
  if (!/^1\d{10}$/.test(contactPhone)) {
    return fail('REQUEST_PARAM_INVALID', '请输入正确的手机号');
  }
  if (targetPeople <= currentPeople) {
    return fail('REQUEST_PARAM_INVALID', '目标人数必须大于当前人数');
  }

  return {
    ok: true,
    payload: {
      themeId,
      themeName,
      dateValue,
      date: formatGroupDateLabel(dateValue),
      timeSlot,
      currentPeople,
      targetPeople,
      contactName,
      contactPhone,
      note: note || '想补人开场，欢迎直接加入。',
    },
  };
}

function validateJoinGroupPayload(payload = {}) {
  const contactName = sanitizeText(payload.contactName, 12);
  const contactPhone = normalizePhone(payload.contactPhone);

  if (!contactName) {
    return fail('REQUEST_PARAM_INVALID', '请输入联系人称呼');
  }
  if (!/^1\d{10}$/.test(contactPhone)) {
    return fail('REQUEST_PARAM_INVALID', '请输入正确的手机号');
  }

  return {
    ok: true,
    payload: {
      contactName,
      contactPhone,
    },
  };
}

module.exports = {
  cloneDefaultGroups,
  normalizeGroupItem,
  getLocalGroups,
  saveLocalGroups,
  getLocalActiveGroup,
  saveLocalActiveGroup,
  clearLocalActiveGroup,
  getLocalRecentGroup,
  saveLocalRecentGroup,
  clearLocalRecentGroup,
  hasConflictingActiveGroup,
  isGroupStillActive,
  attachParticipationState,
  validateCreateGroupPayload,
  validateJoinGroupPayload,
};
