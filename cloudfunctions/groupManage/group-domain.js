'use strict';

function sanitizeText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizePhone(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 11);
}

function normalizeOpenIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
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

function isGroupActiveForParticipation(group = {}) {
  const status = String(group.status || '').trim();
  const roomStage = String(group.roomStage || '').trim();
  return status !== 'cancelled' && roomStage !== 'settled' && roomStage !== 'archived';
}

function isGroupExpired(group = {}) {
  const sortTime = Number(group.sortTime || 0);
  return Boolean(sortTime) && sortTime < Date.now();
}

function isGroupRecordDeletable(group = {}) {
  return (
    String(group.status || '') === 'cancelled' ||
    String(group.roomStage || '') === 'settled' ||
    String(group.roomStage || '') === 'archived' ||
    isGroupExpired(group)
  );
}

function validateCreatePayload(payload = {}) {
  const themeId = sanitizeText(payload.themeId, 64);
  const themeName = sanitizeText(payload.themeName, 24);
  const horror = sanitizeText(payload.horror, 12);
  const dateValue = sanitizeText(payload.dateValue, 16);
  const timeSlot = sanitizeText(payload.timeSlot, 8);
  const contactName = sanitizeText(payload.contactName, 12);
  const contactPhone = normalizePhone(payload.contactPhone);
  const note = sanitizeText(payload.note, 80);
  const currentPeople = 1;
  const targetPeople = Math.min(8, Math.max(2, Number(payload.targetPeople || 0)));

  if (!themeName) {
    return { ok: false, message: '请选择组局主题' };
  }
  if (!dateValue) {
    return { ok: false, message: '请选择组局日期' };
  }
  if (!timeSlot) {
    return { ok: false, message: '请选择开场时间' };
  }
  if (!contactName) {
    return { ok: false, message: '请输入联系人称呼' };
  }
  if (!/^1\d{10}$/.test(contactPhone)) {
    return { ok: false, message: '请输入正确的手机号' };
  }
  if (targetPeople <= currentPeople) {
    return { ok: false, message: '目标人数必须大于当前人数' };
  }

  return {
    ok: true,
    payload: {
      themeId,
      themeName,
      horror,
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

function validateJoinPayload(payload = {}) {
  const contactName = sanitizeText(payload.contactName, 12);
  const contactPhone = normalizePhone(payload.contactPhone);

  if (!contactName) {
    return { ok: false, message: '请输入联系人称呼' };
  }
  if (!/^1\d{10}$/.test(contactPhone)) {
    return { ok: false, message: '请输入正确的手机号' };
  }

  return {
    ok: true,
    payload: {
      contactName,
      contactPhone,
    },
  };
}

function computeGroupStatus(currentPeople, targetPeople, explicitStatus, roomStage) {
  if (explicitStatus === 'cancelled') {
    return 'cancelled';
  }
  const stage = String(roomStage || '').trim();
  if (stage === 'settled' || stage === 'archived') {
    return 'settled';
  }
  if (stage === 'playing') {
    return 'playing';
  }
  if (stage === 'ready') {
    return 'confirmed';
  }
  if (explicitStatus === 'settled') {
    return 'settled';
  }
  if (explicitStatus === 'confirmed') {
    return 'confirmed';
  }
  if (Number(currentPeople || 0) >= Number(targetPeople || 0)) {
    return 'pending_store_confirm';
  }
  return 'recruiting';
}

function normalizeParticipant(item = {}) {
  return {
    openId: String(item.openId || '').trim(),
    contactName: sanitizeText(item.contactName, 12),
    contactPhone: normalizePhone(item.contactPhone),
    role: item.role === 'creator' ? 'creator' : 'member',
    status: item.status === 'left' ? 'left' : 'active',
    joinedAt: item.joinedAt || new Date().toISOString(),
    leftAt: item.leftAt || '',
  };
}

function isSameParticipant(left = {}, right = {}) {
  const leftOpenId = String(left.openId || '').trim();
  const rightOpenId = String(right.openId || '').trim();
  if (leftOpenId && rightOpenId) {
    return leftOpenId === rightOpenId;
  }

  const leftPhone = normalizePhone(left.contactPhone);
  const rightPhone = normalizePhone(right.contactPhone);
  if (leftPhone && rightPhone) {
    return leftPhone === rightPhone;
  }

  const leftName = sanitizeText(left.contactName, 12);
  const rightName = sanitizeText(right.contactName, 12);
  return Boolean(leftName) && leftName === rightName;
}

function mergeParticipant(targetList = [], candidate = {}) {
  const normalizedCandidate = normalizeParticipant(candidate);
  const matchedIndex = targetList.findIndex((item) => isSameParticipant(item, normalizedCandidate));

  if (matchedIndex === -1) {
    targetList.push(normalizedCandidate);
    return;
  }

  const current = targetList[matchedIndex];
  targetList[matchedIndex] = normalizeParticipant({
    ...current,
    ...normalizedCandidate,
    openId: normalizedCandidate.openId || current.openId,
    contactName: normalizedCandidate.contactName || current.contactName,
    contactPhone: normalizedCandidate.contactPhone || current.contactPhone,
    role:
      current.role === 'creator' || normalizedCandidate.role === 'creator' ? 'creator' : 'member',
    status:
      current.status === 'active' || normalizedCandidate.status === 'active' ? 'active' : 'left',
    joinedAt: current.joinedAt || normalizedCandidate.joinedAt,
    leftAt:
      current.status === 'active' || normalizedCandidate.status === 'active'
        ? ''
        : normalizedCandidate.leftAt || current.leftAt,
  });
}

function buildNormalizedParticipants(doc = {}) {
  const participants = Array.isArray(doc.participants)
    ? doc.participants.map(normalizeParticipant)
    : [];
  const nextParticipants = [];
  participants.forEach((item) => {
    mergeParticipant(nextParticipants, item);
  });

  const creatorOpenId = String(doc.creatorOpenId || '').trim();
  const creatorName = sanitizeText(doc.creatorName || doc.contactName || '', 12);
  const creatorPhone = normalizePhone(doc.contactPhone);
  if (creatorOpenId || creatorName) {
    mergeParticipant(nextParticipants, {
      openId: creatorOpenId,
      contactName: creatorName || '发起人',
      contactPhone: creatorPhone,
      role: 'creator',
      status: doc.status === 'cancelled' ? 'active' : 'active',
      joinedAt: doc.createdAt || new Date().toISOString(),
    });
  }

  const joinedMemberNames = Array.isArray(doc.joinedMemberNames)
    ? doc.joinedMemberNames.map((item) => sanitizeText(item, 12)).filter(Boolean)
    : [];
  const joinedPhones = Array.isArray(doc.joinedPhones)
    ? doc.joinedPhones.map((item) => normalizePhone(item)).filter(Boolean)
    : [];

  joinedMemberNames.forEach((name, index) => {
    const phone = joinedPhones[index] || '';
    const exists = nextParticipants.some(
      (item) =>
        item.role !== 'creator' &&
        ((phone && item.contactPhone === phone) || item.contactName === name)
    );
    if (exists) {
      return;
    }
    mergeParticipant(nextParticipants, {
      openId: '',
      contactName: name,
      contactPhone: phone,
      role: 'member',
      status: 'active',
      joinedAt: doc.updatedAt || doc.createdAt || new Date().toISOString(),
    });
  });

  return nextParticipants;
}

function buildRoomMembersFromParticipants(
  activeParticipants = [],
  roomMembers = [],
  roomStage = '',
  groupStatus = ''
) {
  const roomMemberList = Array.isArray(roomMembers) ? roomMembers : [];
  const nextMembers = [];
  const usedRoomIndexes = new Set();

  const fallbackStatus =
    roomStage === 'settled'
      ? '已结算'
      : roomStage === 'playing'
        ? '游戏中'
        : roomStage === 'ready' || groupStatus === 'confirmed'
          ? '已确认'
          : '已报名';

  activeParticipants.forEach((participant) => {
    const matchedIndex = roomMemberList.findIndex((roomMember, index) => {
      if (usedRoomIndexes.has(index)) {
        return false;
      }
      const roomNickname = sanitizeText(roomMember.nickname, 12);
      return isSameParticipant(participant, {
        openId: roomMember.openId,
        contactName: roomNickname,
      });
    });

    const matchedRoomMember = matchedIndex >= 0 ? roomMemberList[matchedIndex] : null;
    if (matchedIndex >= 0) {
      usedRoomIndexes.add(matchedIndex);
    }

    nextMembers.push({
      openId: participant.openId || (matchedRoomMember && matchedRoomMember.openId) || '',
      nickname:
        participant.contactName ||
        (matchedRoomMember && sanitizeText(matchedRoomMember.nickname, 12)) ||
        '玩家',
      status: (matchedRoomMember && sanitizeText(matchedRoomMember.status, 12)) || fallbackStatus,
    });
  });

  roomMemberList.forEach((roomMember, index) => {
    if (usedRoomIndexes.has(index)) {
      return;
    }
    const nickname = sanitizeText(roomMember.nickname, 12);
    if (!nickname) {
      return;
    }
    nextMembers.push({
      openId: String(roomMember.openId || ''),
      nickname,
      status: sanitizeText(roomMember.status, 12) || fallbackStatus,
    });
  });

  return nextMembers;
}

function normalizeGroupDoc(doc = {}) {
  const participants = buildNormalizedParticipants(doc);
  const activeParticipants = participants.filter((item) => item.status !== 'left');
  const creator =
    activeParticipants.find((item) => item.role === 'creator') ||
    participants.find((item) => item.role === 'creator') ||
    null;
  const currentPeople = activeParticipants.length
    ? activeParticipants.length
    : Math.max(1, Number(doc.currentPeople || 1));
  const targetPeople = Math.max(currentPeople, Number(doc.targetPeople || currentPeople));
  const roomStage = String(doc.roomStage || '').trim();
  const status = computeGroupStatus(currentPeople, targetPeople, doc.status, roomStage);

  return {
    _id: String(doc._id || ''),
    themeId: sanitizeText(doc.themeId, 64),
    themeName: sanitizeText(doc.themeName, 24),
    dateValue: sanitizeText(doc.dateValue, 16),
    date: sanitizeText(doc.date, 16) || formatGroupDateLabel(doc.dateValue),
    timeSlot: sanitizeText(doc.timeSlot, 8),
    currentPeople,
    targetPeople,
    contactName: sanitizeText(doc.contactName, 12) || (creator && creator.contactName) || '',
    contactPhone: normalizePhone(doc.contactPhone) || (creator && creator.contactPhone) || '',
    creatorName:
      sanitizeText(doc.creatorName, 12) ||
      (creator && creator.contactName) ||
      sanitizeText(doc.contactName, 12) ||
      '发起人',
    note: sanitizeText(doc.note, 80) || '想补人开场，欢迎直接加入。',
    status,
    createdAt: doc.createdAt || new Date(0).toISOString(),
    updatedAt: doc.updatedAt || doc.createdAt || new Date(0).toISOString(),
    creatorOpenId: String(doc.creatorOpenId || (creator && creator.openId) || ''),
    participants,
    joinedPhones: activeParticipants
      .filter((item) => item.role !== 'creator')
      .map((item) => item.contactPhone)
      .filter(Boolean),
    joinedMemberNames: activeParticipants
      .filter((item) => item.role !== 'creator')
      .map((item) => item.contactName)
      .filter(Boolean),
    sortTime: buildTimestamp(doc.dateValue, doc.timeSlot),
    horror: sanitizeText(doc.horror, 12),
    roomStage: doc.roomStage || '',
    roomMembers: Array.isArray(doc.roomMembers) ? doc.roomMembers : [],
    roomTimeline: Array.isArray(doc.roomTimeline) ? doc.roomTimeline : [],
    roomResult: doc.roomResult || null,
    sessionId: doc.sessionId || '',
    hiddenForOpenIds: normalizeOpenIdList(doc.hiddenForOpenIds),
  };
}

function toGroupListItem(doc = {}, openId = '') {
  const group = normalizeGroupDoc(doc);
  const activeParticipants = (group.participants || []).filter((item) => item.status !== 'left');
  const normalizedOpenId = String(openId || '').trim();
  const viewer = activeParticipants.find((item) => item.openId === normalizedOpenId) || null;
  return {
    id: group._id,
    themeId: group.themeId,
    themeName: group.themeName,
    creatorOpenId: group.creatorOpenId,
    dateValue: group.dateValue,
    date: group.date,
    timeSlot: group.timeSlot,
    currentPeople: group.currentPeople,
    targetPeople: group.targetPeople,
    note: group.note,
    status: group.status,
    roomStage: group.roomStage || '',
    creatorName: group.creatorName,
    contactName: group.contactName,
    contactPhone: group.contactPhone,
    joinedPhones: group.joinedPhones,
    joinedMemberNames: group.joinedMemberNames,
    participantNames: activeParticipants.map((item) => item.contactName).filter(Boolean),
    createdAt: group.createdAt,
    viewerRelated: Boolean(viewer),
    viewerRole: viewer ? viewer.role : '',
    viewerStatus: viewer ? viewer.status : '',
    viewerContactName: viewer ? viewer.contactName : '',
  };
}

function buildMyParticipation(groups = [], openId) {
  const normalizedOpenId = String(openId || '').trim();
  const result = {
    activeGroup: null,
    recentGroup: null,
  };

  groups.forEach((group) => {
    if ((group.hiddenForOpenIds || []).includes(normalizedOpenId)) {
      return;
    }
    const matched = (group.participants || []).find((item) => item.openId === normalizedOpenId);
    if (!matched) {
      return;
    }

    if (
      matched.status === 'active' &&
      isGroupActiveForParticipation(group) &&
      !result.activeGroup
    ) {
      result.activeGroup = {
        groupId: group._id,
        role: matched.role,
        themeName: group.themeName,
        contactName: matched.contactName,
        contactPhone: matched.contactPhone,
      };
      return;
    }

    if (
      !result.recentGroup &&
      (!isGroupActiveForParticipation(group) || group.status === 'cancelled')
    ) {
      result.recentGroup = {
        groupId: group._id,
        role: matched.role,
        themeName: group.themeName,
        status: group.roomStage === 'settled' ? 'settled' : group.status,
        contactName: matched.contactName,
      };
    }
  });

  return result;
}

function sortGroups(groups = []) {
  return groups.slice().sort((left, right) => {
    const leftSort = Number(left.sortTime || 0);
    const rightSort = Number(right.sortTime || 0);
    if (leftSort && rightSort && leftSort !== rightSort) {
      return leftSort - rightSort;
    }
    const leftCreated = new Date(left.createdAt || 0).getTime();
    const rightCreated = new Date(right.createdAt || 0).getTime();
    return rightCreated - leftCreated;
  });
}

function buildTeamRoom(groupDoc = {}, openId) {
  const group = normalizeGroupDoc(groupDoc);
  const activeParticipants = group.participants.filter((item) => item.status !== 'left');
  const myParticipant = activeParticipants.find((item) => item.openId === String(openId || ''));
  const roomStage = String(
    groupDoc.roomStage ||
      (group.status === 'settled'
        ? 'settled'
        : group.status === 'playing'
          ? 'playing'
          : group.status === 'confirmed'
            ? 'ready'
            : 'pending_confirm')
  );
  const roomMembers = buildRoomMembersFromParticipants(
    activeParticipants,
    group.roomMembers,
    roomStage,
    group.status
  );
  const roomTimeline =
    Array.isArray(groupDoc.roomTimeline) && groupDoc.roomTimeline.length
      ? groupDoc.roomTimeline
      : [
          {
            title: '意向组局已创建',
            content: `${group.themeName || '该主题'} 已有 ${group.currentPeople} 人报名。`,
          },
          {
            title: group.status === 'confirmed' ? '门店已确认' : '等待门店确认',
            content:
              group.status === 'confirmed'
                ? '队伍已确认，等待店员开始场次'
                : '到店核验通过后，系统会更新队伍状态',
          },
        ];

  return {
    roomId: `room-${group._id}`,
    groupId: group._id,
    themeId: group.themeId,
    themeName: group.themeName,
    playDate: group.date,
    timeSlot: group.timeSlot,
    storeName: '迷场档案馆',
    creatorName: group.creatorName,
    creatorOpenId: group.creatorOpenId,
    myContactName: myParticipant ? myParticipant.contactName : '',
    myOpenId: myParticipant ? myParticipant.openId : '',
    stage: roomStage,
    stageHint:
      roomStage === 'settled'
        ? '本场结果已更新，等待门店上传集锦'
        : roomStage === 'playing'
          ? '场次正在进行中'
          : roomStage === 'ready' || group.status === 'confirmed'
            ? '门店确认已完成，等待店员开始场次'
            : '大厅报名完成后，还需要门店确认到店成员',
    teamSize: activeParticipants.length || group.currentPeople,
    memberCount: activeParticipants.length || group.currentPeople,
    expectedPeople: group.targetPeople,
    members: roomMembers.map((item) => ({
      openId: item.openId || '',
      nickname: item.nickname || '玩家',
      status: item.status || '待确认',
    })),
    timeline: roomTimeline,
    result: groupDoc.roomResult || null,
    highlights: [],
  };
}

module.exports = {
  normalizeGroupDoc,
  toGroupListItem,
  buildMyParticipation,
  buildTeamRoom,
  computeGroupStatus,
  normalizeParticipant,
  sortGroups,
  isGroupActiveForParticipation,
  isGroupExpired,
  isGroupRecordDeletable,
  validateCreatePayload,
  validateJoinPayload,
};
