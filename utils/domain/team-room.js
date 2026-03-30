'use strict';

const mockData = require('../../mock/data');
const storage = require('../platform/storage');
const profileService = require('./profile');
const groupService = require('./group');

const STAGE_MAP = {
  pending_confirm: {
    label: '待门店确认',
    badgeClass: 'stage-badge-warn',
    statusText: '等待门店确认',
  },
  ready: {
    label: '待开场',
    badgeClass: 'stage-badge-ready',
    statusText: '已确认，等待开场',
  },
  playing: {
    label: '游戏中',
    badgeClass: 'stage-badge-live',
    statusText: '场次进行中',
  },
  settled: {
    label: '已结束并结算',
    badgeClass: 'stage-badge-ok',
    statusText: '结果已更新',
  },
  archived: {
    label: '已归档',
    badgeClass: 'stage-badge-archived',
    statusText: '房间已归档',
  },
};

function cloneDefaultRooms() {
  return JSON.parse(JSON.stringify(mockData.teamRooms || []));
}

function getThemeById(themeId) {
  return (mockData.themes || []).find((item) => item.id === themeId) || null;
}

function normalizeHighlight(item = {}, index) {
  return {
    id: item.id || `highlight-${index}`,
    type: item.type || 'photo',
    title: item.title || '集锦内容',
  };
}

function shouldSyncRoomMembersWithGroup(room = {}) {
  return ['pending_confirm', 'ready'].includes(String(room.stage || ''));
}

function buildDynamicMembers(group = {}) {
  const memberNames =
    Array.isArray(group.participantNames) && group.participantNames.length
      ? group.participantNames
      : Array.isArray(group.members) && group.members.length
        ? group.members
        : [group.creatorName || '发起人'].concat(group.joinedMemberNames || []);

  // 获取当前用户的 openId 和 contactName
  const currentProfile = profileService.getLocalProfile();
  const currentOpenId = String((currentProfile && currentProfile._id) || '').trim();

  return memberNames.filter(Boolean).map((nickname) => {
    const isCreator = nickname === (group.creatorName || '发起人');
    // 发起人或当前用户匹配时设置 openId
    const shouldSetOpenId = isCreator && String(group.creatorOpenId || '').trim() === currentOpenId;
    return {
      openId: shouldSetOpenId ? currentOpenId : '',
      nickname,
      status: '已报名',
    };
  });
}

function buildProfileMap(profileList = []) {
  return (profileList || []).reduce((map, item) => {
    const openId = String((item && item._id) || item.openId || '').trim();
    if (openId) {
      map[openId] = item;
    }
    return map;
  }, {});
}

function extractRoomMemberOpenIds(room = {}) {
  const members = Array.isArray(room && room.members) ? room.members : [];
  return Array.from(
    new Set(
      members
        .map((item) => String((item && item.openId) || '').trim())
        .filter(Boolean)
    )
  );
}

function buildMemberPlayerCard(member = {}, currentProfile = null, profileMap = {}) {
  const openId = String(member.openId || '').trim();
  const nickname = member.nickname || '玩家';
  const selfOpenId = String((currentProfile && currentProfile._id) || '').trim();
  const isSelfByOpenId = Boolean(openId) && openId === selfOpenId;
  const isSelfByNickname =
    !openId && currentProfile && String(currentProfile.nickname || '') === String(nickname || '');

  if (isSelfByOpenId || isSelfByNickname) {
    return profileService.buildPlayerCard({
      ...currentProfile,
      nickname: (currentProfile && currentProfile.nickname) || nickname,
      avatarUrl: (currentProfile && currentProfile.avatarUrl) || '',
    });
  }

  if (openId && profileMap[openId]) {
    return profileService.buildPlayerCard({
      ...profileMap[openId],
      nickname: profileMap[openId].nickname || nickname,
    });
  }

  return profileService.getPlayerCardByNickname(nickname, currentProfile);
}

function normalizeRoomItem(room = {}, options = {}) {
  const stageInfo = STAGE_MAP[room.stage] || STAGE_MAP.pending_confirm;
  const members = Array.isArray(room.members) ? room.members : [];
  const highlights = Array.isArray(room.highlights) ? room.highlights : [];
  const theme = getThemeById(room.themeId);
  const currentProfile = profileService.getLocalProfile();
  const profileMap = options.profileMap || {};

  return {
    roomId: room.roomId || '',
    groupId: room.groupId || '',
    themeId: room.themeId || '',
    themeName: room.themeName || '',
    playDate: room.playDate || '',
    timeSlot: room.timeSlot || '',
    storeName: room.storeName || '迷场档案馆',
    creatorName: room.creatorName || '',
    myContactName: room.myContactName || '',
    stage: room.stage || 'pending_confirm',
    stageLabel: room.stageLabel || stageInfo.label,
    stageHint: room.stageHint || '',
    stageBadgeClass: stageInfo.badgeClass,
    statusText: stageInfo.statusText,
    teamSize: Number(room.teamSize || members.length || 0),
    memberCount: Number(room.memberCount || members.length || 0),
    expectedPeople: Number(room.expectedPeople || members.length || 0),
    members: members.map((member) => {
      const nickname = member.nickname || '玩家';
      const playerCard = buildMemberPlayerCard(member, currentProfile, profileMap);

      return {
        openId: member.openId || '',
        nickname,
        status: member.status || '待确认',
        playerCard,
      };
    }),
    timeline: (room.timeline || []).map((item) => ({
      title: item.title || '',
      content: item.content || '',
    })),
    result: room.result
      ? {
          growthValue: Number(room.result.growthValue || 0),
          archiveDelta: Number(room.result.archiveDelta || 0),
          badgeText: room.result.badgeText || '',
        }
      : null,
    highlights: highlights.map(normalizeHighlight),
    coverImage: (theme && theme.coverImage) || '',
  };
}

function getLocalRooms() {
  const stored = storage.safeGetStorage(storage.TEAM_ROOM_STORAGE_KEY);
  const source = Array.isArray(stored) && stored.length ? stored : cloneDefaultRooms();
  return source.map(normalizeRoomItem);
}

function saveLocalRooms(rooms) {
  const normalized = Array.isArray(rooms) ? rooms.map(normalizeRoomItem) : [];
  storage.safeSetStorage(storage.TEAM_ROOM_STORAGE_KEY, normalized);
  return normalized;
}

function buildPreviewRoomFromGroup(group = {}, activeGroup = null) {
  const theme = getThemeById(group.themeId);
  const currentPeople =
    Array.isArray(group.participantNames) && group.participantNames.length
      ? group.participantNames.length
      : Math.max(1, Number(group.currentPeople || 0));
  const targetPeople = Math.max(currentPeople, Number(group.targetPeople || currentPeople));
  const members = buildDynamicMembers(group);

  return normalizeRoomItem({
    roomId: `room-preview-${group.id}`,
    groupId: group.id,
    themeId: group.themeId,
    themeName: group.themeName,
    playDate: group.date,
    timeSlot: group.timeSlot,
    creatorName: group.creatorName || group.contactName || '',
    myContactName:
      activeGroup && String(activeGroup.groupId || '') === String(group.id || '')
        ? activeGroup.contactName || ''
        : '',
    stage: group.status === 'confirmed' ? 'ready' : 'pending_confirm',
    stageHint:
      group.status === 'confirmed'
        ? '门店确认已完成，等待店员开始场次。'
        : '大厅报名完成后，还需要门店确认真实到店成员。',
    teamSize: currentPeople,
    memberCount: currentPeople,
    expectedPeople: targetPeople,
    members,
    timeline: [
      {
        title: '意向组局已创建',
        content: `${group.themeName || '该主题'} 已有 ${currentPeople} 人报名。`,
      },
      {
        title: group.status === 'confirmed' ? '门店已确认' : '等待门店确认',
        content:
          group.status === 'confirmed'
            ? '真实队伍已建立，等待店员开始场次。'
            : '到店核验通过后，系统才会进入真实队伍状态。',
      },
    ],
    coverImage: (theme && theme.coverImage) || '',
  });
}

function mergeRoomWithGroup(room = {}, group = {}, activeGroup = null) {
  if (!room || !group || !shouldSyncRoomMembersWithGroup(room)) {
    return normalizeRoomItem({
      ...room,
      myContactName:
        activeGroup && String(activeGroup.groupId || '') === String(room.groupId || '')
          ? activeGroup.contactName || ''
          : room.myContactName || '',
    });
  }

  return normalizeRoomItem({
    ...room,
    creatorName: group.creatorName || group.contactName || room.creatorName || '',
    myContactName:
      activeGroup && String(activeGroup.groupId || '') === String(group.id || '')
        ? activeGroup.contactName || ''
        : room.myContactName || '',
    memberCount:
      Array.isArray(group.participantNames) && group.participantNames.length
        ? group.participantNames.length
        : Number(group.currentPeople || room.memberCount || 0),
    teamSize:
      Array.isArray(group.participantNames) && group.participantNames.length
        ? group.participantNames.length
        : Number(group.currentPeople || room.teamSize || 0),
    expectedPeople: Number(group.targetPeople || room.expectedPeople || 0),
    members: buildDynamicMembers(group),
    stageHint:
      group.rawStatus === 'confirmed'
        ? '门店确认已完成，等待店员开始场次。'
        : '大厅报名完成后，还需要门店确认真实到店成员。',
  });
}

function ensureActiveMemberInRoom(room = {}, activeGroup = null) {
  if (!room || !activeGroup || String(activeGroup.groupId || '') !== String(room.groupId || '')) {
    return normalizeRoomItem(room);
  }

  const contactName = String(activeGroup.contactName || '').trim();
  if (!contactName) {
    return normalizeRoomItem(room);
  }

  const currentProfile = profileService.getLocalProfile();
  const currentOpenId = String((currentProfile && currentProfile._id) || '').trim();

  const members = Array.isArray(room.members) ? room.members.slice() : [];

  // 优先通过 openId 检查是否已存在
  const existsByOpenId = currentOpenId
    ? members.some((item) => String(item.openId || '').trim() === currentOpenId)
    : false;

  // 通过 nickname 检查是否已存在
  const existsByNickname = members.some(
    (item) => String(item.nickname || '').trim() === contactName
  );

  if (existsByOpenId || existsByNickname) {
    return normalizeRoomItem({
      ...room,
      myContactName: contactName,
    });
  }

  const nextMembers = members.concat({
    openId: currentOpenId,
    nickname: contactName,
    status: room.stage === 'ready' || room.stage === 'playing' ? '已确认' : '已报名',
  });

  return normalizeRoomItem({
    ...room,
    myContactName: contactName,
    members: nextMembers,
    memberCount: nextMembers.length,
    teamSize: nextMembers.length,
    expectedPeople: Math.max(Number(room.expectedPeople || 0), nextMembers.length),
  });
}

function getRoomByGroupId(groupId) {
  if (!groupId) {
    return null;
  }
  const rooms = getLocalRooms();
  const matchedRoom = rooms.find((item) => item.groupId === groupId) || null;
  if (!matchedRoom) {
    return null;
  }

  const activeGroup = groupService.getLocalActiveGroup();
  if (!activeGroup || String(activeGroup.groupId || '') !== String(groupId)) {
    return matchedRoom;
  }

  return normalizeRoomItem({
    ...matchedRoom,
    myContactName: activeGroup.contactName || '',
  });
}

function updateRoomMembersByGroupId(groupId, members = [], nextStage = '') {
  if (!groupId) {
    return null;
  }

  const rooms = getLocalRooms();
  const index = rooms.findIndex((item) => String(item.groupId || '') === String(groupId));
  if (index === -1) {
    return null;
  }

  const stage = String(nextStage || rooms[index].stage || '');
  const stageHintMap = {
    pending_confirm: '大厅报名完成后，还需要门店确认真实到店成员。',
    ready: '门店确认已完成，等待店员开始场次。',
    playing: '场次正在进行中，玩家端会持续显示游戏状态。',
    settled: '本场已结算完成，可查看结果并等待上传集锦。',
  };

  const nextRooms = rooms.slice();
  nextRooms[index] = normalizeRoomItem({
    ...nextRooms[index],
    stage,
    stageHint: stageHintMap[stage] || nextRooms[index].stageHint || '',
    members: Array.isArray(members)
      ? members.map((item) => ({
          openId: item.openId || '',
          nickname: item.nickname || '玩家',
          status: item.status || '待确认',
        }))
      : nextRooms[index].members,
    memberCount: Array.isArray(members) ? members.length : nextRooms[index].memberCount,
    teamSize: Array.isArray(members) ? members.length : nextRooms[index].teamSize,
    expectedPeople: Array.isArray(members)
      ? Math.max(members.length, nextRooms[index].expectedPeople || 0)
      : nextRooms[index].expectedPeople,
  });

  saveLocalRooms(nextRooms);
  return nextRooms[index];
}

module.exports = {
  buildProfileMap,
  extractRoomMemberOpenIds,
  normalizeRoomItem,
  getLocalRooms,
  saveLocalRooms,
  buildPreviewRoomFromGroup,
  mergeRoomWithGroup,
  ensureActiveMemberInRoom,
  getRoomByGroupId,
  updateRoomMembersByGroupId,
};
