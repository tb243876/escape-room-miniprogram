'use strict';

const mockData = require('../mock/data');
const runtime = require('./platform/runtime');
const storage = require('./platform/storage');
const themeService = require('./domain/theme');
const profileService = require('./domain/profile');
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
  const groupList = Array.isArray(payload.groups) ? payload.groups : [];
  const hasMatchedActiveSnapshot =
    currentActiveGroup && currentActiveGroup.groupId
      ? groupList.some((item) => {
          const sameGroup = String(item.id || '') === String(currentActiveGroup.groupId || '');
          if (!sameGroup || item.rawStatus === 'cancelled' || item.rawStatus === 'settled') {
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

async function getHomeData() {
  console.info('[service] getHomeData.start', {
    useMock: runtime.useMock(),
  });
  if (runtime.useMock()) {
    console.info('[service] getHomeData.mock');
    return runtime.delay({
      hero: mockData.homeData.hero,
      banners: mockData.homeData.banners,
      themeGroups: themeService.groupThemesByHorror(mockData.themes.map(themeService.enrichTheme)),
      activities: (mockData.homeData.activities || []).map(themeService.normalizeActivityItem),
      quickActions: mockData.homeData.quickActions,
    });
  }

  const db = runtime.getDb();
  const [allThemesRes, activitiesRes] = await Promise.all([
    db.collection('themes').where({ status: 'online' }).orderBy('sort', 'asc').get(),
    db.collection('activities').orderBy('sort', 'asc').limit(2).get(),
  ]);

  console.info('[service] getHomeData.cloud.success', {
    themeCount: (allThemesRes.data || []).length,
    activityCount: (activitiesRes.data || []).length,
  });

  return {
    hero: {
      title: '今晚想玩什么，先从主题和组局大厅开始',
      subtitle: '先看主题、再去大厅找人，玩完后的成长和集锦由系统自动沉淀。',
      actionText: '查看热门主题',
    },
    banners: [
      {
        id: 'banner-tonglingren',
        type: 'theme',
        targetId: 'theme-tonglingren',
        eyebrow: '重恐招牌',
        title: '瞳灵人',
        subtitle: '适合明确追求高刺激的老玩家，建议组满人再进场。',
        buttonText: '查看主题',
        image: '/assets/themes/tonglingren.jpeg',
      },
      {
        id: 'banner-shixiong',
        type: 'theme',
        targetId: 'theme-shixiong',
        eyebrow: '新手入门',
        title: '尸兄',
        subtitle: '微恐入门主题，适合第一次带朋友来体验。',
        buttonText: '先看这个',
        image: '/assets/themes/shixiong.jpeg',
      },
      {
        id: 'banner-activity-spring',
        type: 'activity',
        targetId: 'activity-spring',
        eyebrow: '近期活动',
        title: '春季双人组局周',
        subtitle: '工作日夜场组局成功可获饮品券和主题徽章。',
        buttonText: '查看活动',
        image: '/assets/themes/jishengchong.jpeg',
      },
    ],
    themeGroups: themeService.groupThemesByHorror(
      (allThemesRes.data || []).map(themeService.enrichTheme)
    ),
    activities: (activitiesRes.data || []).map(themeService.normalizeActivityItem),
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
    const db = runtime.getDb();
    const result = await db
      .collection('themes')
      .where({ status: 'online' })
      .orderBy('sort', 'asc')
      .get();
    console.info('[service] getThemes.cloud.success', {
      count: (result.data || []).length,
    });
    return themeService.filterThemes((result.data || []).map(themeService.enrichTheme), filters);
  }

  return runtime.delay(
    themeService.filterThemes(mockData.themes.map(themeService.enrichTheme), filters)
  );
}

async function getThemeDetail(themeId) {
  if (!runtime.useMock()) {
    const db = runtime.getDb();
    const result = await db.collection('themes').doc(themeId).get();
    return themeService.enrichTheme(result.data);
  }

  const item = mockData.themes.find((theme) => theme.id === themeId) || null;
  return runtime.delay(item ? themeService.enrichTheme(item) : null);
}

async function getActivities() {
  console.info('[service] getActivities.start', {
    useMock: runtime.useMock(),
  });
  if (!runtime.useMock()) {
    const db = runtime.getDb();
    const result = await db.collection('activities').orderBy('sort', 'asc').get();
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
      throw new Error(result.message || 'group-list-load-failed');
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

  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'getTeamRoom',
      groupId,
    });
    if (!result.ok) {
      throw new Error(result.message || 'team-room-load-failed');
    }
    const room = teamRoomService.normalizeRoomItem(result.room || null);
    const memberOpenIds = teamRoomService.extractRoomMemberOpenIds(room);
    let profileMap = {};

    if (memberOpenIds.length) {
      try {
        const profileResult = await runtime.callCloudFunction('getProfile', {
          action: 'listProfiles',
          openIds: memberOpenIds,
        });
        if (profileResult.ok) {
          profileMap = teamRoomService.buildProfileMap(profileResult.profiles || []);
        }
      } catch (error) {
        console.warn('[service] getTeamRoom.listProfiles.failed', {
          groupId,
          message: error && error.message,
        });
      }
    }

    return teamRoomService.ensureActiveMemberInRoom(
      teamRoomService.normalizeRoomItem(room, { profileMap }),
      activeGroup
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
    console.info('getProfile cloud result:', result);
    if (!result.ok) {
      throw new Error(result.message || 'profile-load-failed');
    }
    const pendingPatchState = profileService.getPendingProfilePatch();
    const cloudProfile = result.profile || {};
    const mergedProfile =
      pendingPatchState && pendingPatchState.pendingPatch
        ? profileService.applyEditablePatch(cloudProfile, pendingPatchState.pendingPatch)
        : cloudProfile;
    const savedProfile = profileService.saveLocalProfile(mergedProfile);
    if (
      pendingPatchState &&
      pendingPatchState.pendingPatch &&
      profileService.isEditablePatchApplied(cloudProfile, pendingPatchState.pendingPatch)
    ) {
      profileService.clearPendingProfilePatch();
    }
    return savedProfile;
  }

  return runtime.delay(profileService.getLocalProfile());
}

async function updateProfile(payload = {}) {
  if (!runtime.useMock()) {
    const patch = profileService.buildEditableProfilePatch(payload);
    try {
      const result = await runtime.callCloudFunction('updateProfile', patch);
      if (!result.ok) {
        throw new Error(result.message || 'profile-update-failed');
      }

      const nextProfile = profileService.saveLocalProfile({
        ...(result.profile || {}),
        ...patch,
      });
      profileService.clearPendingProfilePatch();
      return runtime.delay({
        ok: true,
        message: '个人资料已更新',
        profile: nextProfile,
        syncMode: 'cloud',
      });
    } catch (error) {
      console.error('updateProfile cloud failed, fallback to local profile:', error);
      const nextProfile = profileService.updateLocalProfile(payload);
      profileService.savePendingProfilePatch(payload);
      return runtime.delay({
        ok: true,
        message: '已保存到当前设备，云端同步待补齐',
        profile: nextProfile,
        syncMode: 'local_fallback',
      });
    }
  }

  const nextProfile = profileService.updateLocalProfile(payload);
  profileService.clearPendingProfilePatch();
  return runtime.delay({
    ok: true,
    message: '个人资料已更新',
    profile: nextProfile,
    syncMode: 'mock',
  });
}

async function redeemStaffAuthCode(code) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'redeemAuthCode',
      code,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message || '授权码无效或已失效，请联系店长重新获取',
      };
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
    return {
      ok: false,
      message: '请输入授权码',
    };
  }

  const config = mockData.staffAuthCodes[normalizedCode];
  if (!config) {
    return runtime.delay({
      ok: false,
      message: '授权码无效或已失效，请联系店长重新获取',
    });
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
      return {
        ok: false,
        message: result.message || '当前身份还没有门店工作台权限，请先完成授权绑定',
      };
    }
    return {
      ok: true,
      dashboard: result.dashboard,
    };
  }

  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay({
      ok: false,
      message: '当前身份还没有门店工作台权限，请先完成授权绑定',
    });
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
      return {
        ok: false,
        message: result.message || '授权码生成失败，请稍后重试',
      };
    }
    return {
      ok: true,
      authCode: result.authCode,
      dashboard: result.dashboard || null,
      message: result.message || '授权码已生成',
    };
  }

  return runtime.delay({
    ok: false,
    message: '当前仅支持云端生成授权码',
  });
}

async function removeStaffBinding(targetOpenId) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'removeStaffBinding',
      targetOpenId,
    });
    return {
      ok: Boolean(result && result.ok),
      message: (result && result.message) || '员工移除失败',
      dashboard: result && result.dashboard ? result.dashboard : null,
    };
  }

  return runtime.delay({
    ok: false,
    message: '当前仅支持云端管理员工',
  });
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
    return {
      ok: Boolean(result && result.ok),
      message: (result && result.message) || '店长转移失败',
      dashboard: result && result.dashboard ? result.dashboard : null,
    };
  }

  return runtime.delay({
    ok: false,
    message: '当前仅支持云端转移店长',
  });
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
      return {
        ok: false,
        message: result.message || '没有找到这个场次，请返回工作台重试',
      };
    }
    return {
      ok: true,
      session: result.session,
    };
  }

  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay({
      ok: false,
      message: '当前身份还没有门店工作台权限，请先完成授权绑定',
    });
  }

  const session = staffService.getSessionById(
    staffService.getLocalStaffSessions(),
    sessionId,
    binding
  );
  if (!session) {
    return runtime.delay({
      ok: false,
      message: '没有找到这个场次，请返回工作台重试',
    });
  }

  return runtime.delay({
    ok: true,
    session,
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
      return {
        ok: false,
        message: result.message || '操作失败，请稍后重试',
      };
    }
    return {
      ok: true,
      session: result.session,
    };
  }

  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay({
      ok: false,
      message: '当前身份还没有门店工作台权限，请先完成授权绑定',
    });
  }

  const sessions = staffService.getLocalStaffSessions();
  const index = sessions.findIndex((item) => item.id === sessionId);
  if (index === -1) {
    return runtime.delay({
      ok: false,
      message: '没有找到这个场次，请返回工作台重试',
    });
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
    session: staffService.getSessionById(sessions, sessionId, binding),
  });
}

async function updateStaffSessionMember(sessionId, nickname) {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'toggleSessionMember',
      sessionId,
      nickname,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message || '更新失败，请稍后重试',
      };
    }
    return {
      ok: true,
      session: result.session,
    };
  }

  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay({
      ok: false,
      message: '当前身份还没有门店工作台权限，请先完成授权绑定',
    });
  }

  const sessions = staffService.getLocalStaffSessions();
  const index = sessions.findIndex((item) => item.id === sessionId);
  if (index === -1) {
    return runtime.delay({
      ok: false,
      message: '没有找到这个场次，请返回工作台重试',
    });
  }

  const toggleValidation = staffService.validateSessionMemberToggle(sessions[index], nickname);
  if (!toggleValidation.ok) {
    return runtime.delay(toggleValidation);
  }

  sessions[index] = staffService.toggleSessionMemberCheckIn(sessions[index], nickname);
  staffService.saveLocalStaffSessions(sessions);
  teamRoomService.updateRoomMembersByGroupId(
    sessions[index].groupId,
    sessions[index].members,
    sessions[index].stageKey
  );

  return runtime.delay({
    ok: true,
    session: staffService.getSessionById(sessions, sessionId, binding),
  });
}

async function getStaffHighlights() {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('staffManage', {
      action: 'getHighlights',
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message || '集锦库加载失败，请稍后重试',
      };
    }
    return {
      ok: true,
      highlights: result.highlights || [],
    };
  }

  const binding = staffService.getLocalStaffBinding();
  if (!binding || !binding.role) {
    return runtime.delay({
      ok: false,
      message: '当前身份还没有门店工作台权限，请先完成授权绑定',
    });
  }

  return runtime.delay({
    ok: true,
    highlights: staffService.normalizeHighlightPackages(mockData.staffHighlights, binding),
  });
}

async function getLeaderboard() {
  if (!runtime.useMock()) {
    const result = await runtime.callCloudFunction('getLeaderboard', {});
    if (!result.ok) {
      return {
        ok: false,
        message: result.message || '排行榜加载失败，请稍后重试',
      };
    }
    return {
      ok: true,
      leaderboard: result.leaderboard || [],
      summary: result.summary || leaderboardService.buildLeaderboardSummary([]),
    };
  }

  return runtime.delay({
    ok: true,
    leaderboard: leaderboardService.normalizeLeaderboardList(mockData.leaderboard),
    summary: leaderboardService.buildLeaderboardSummary(mockData.leaderboard),
  });
}

async function createGroup(payload = {}) {
  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'createGroup',
      payload,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message || '组局发布失败，请稍后重试',
      };
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
      message: result.message || '组局已发布，列表已更新',
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
    return {
      ok: false,
      message: `你已经在参与「${activeGroup.themeName || '当前组局'}」，请先结束这场后再发起新的组局`,
    };
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
    message: '组局已发布，列表已更新',
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
      return {
        ok: false,
        message: result.message || '报名失败，请稍后重试',
      };
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
    return {
      ok: false,
      message: `你已经在参与「${activeGroup.themeName || '当前组局'}」，不能再加入其他组局`,
    };
  }
  if (activeGroup && String(activeGroup.groupId || '') === String(groupId || '')) {
    return {
      ok: false,
      message: '你已经在参与当前组局了',
    };
  }

  const currentGroups = groupService.getLocalGroups();
  const groupIndex = currentGroups.findIndex((item) => item.id === groupId);
  if (groupIndex === -1) {
    return {
      ok: false,
      message: '组局不存在或已下架，请刷新后重试',
    };
  }

  const targetGroup = currentGroups[groupIndex];
  if (Number(targetGroup.neededPeople || 0) <= 0) {
    return {
      ok: false,
      message: '这个组局已经满员了',
    };
  }

  if ((targetGroup.joinedPhones || []).includes(validateResult.payload.contactPhone)) {
    return {
      ok: false,
      message: '这个手机号已经报过这场组局了',
    };
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

async function cancelActiveGroup(groupId) {
  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const activeGroup = groupService.getLocalActiveGroup();
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'cancelActiveGroup',
      groupId,
      payload: {
        contactName: (activeGroup && activeGroup.contactName) || '',
        contactPhone: (activeGroup && activeGroup.contactPhone) || '',
      },
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message || '当前没有可取消的组局',
      };
    }

    syncGroupParticipationState(result);
    return {
      ok: true,
      message: result.message || '组局状态已更新',
    };
  }

  const activeGroup = groupService.getLocalActiveGroup();
  const targetGroupId = String(groupId || (activeGroup && activeGroup.groupId) || '');
  if (!targetGroupId) {
    return runtime.delay({
      ok: false,
      message: '当前没有可取消的组局',
    });
  }

  const currentGroups = groupService.getLocalGroups();
  const groupIndex = currentGroups.findIndex((item) => item.id === targetGroupId);
  if (groupIndex === -1) {
    return runtime.delay({
      ok: false,
      message: '没有找到要取消的组局',
    });
  }

  // 如果 activeGroup 为空，说明组局已经取消或不存在
  if (!activeGroup) {
    return runtime.delay({
      ok: true,
      message: '这场组局已经取消了',
    });
  }

  const nextGroups = currentGroups.slice();
  const targetGroup = nextGroups[groupIndex];
  const isCreator = activeGroup.role === 'creator';

  if (isCreator) {
    nextGroups[groupIndex] = groupService.normalizeGroupItem({
      ...targetGroup,
      status: 'cancelled',
      note: `发起人已取消该组局。${targetGroup.note ? ` ${targetGroup.note}` : ''}`.trim(),
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
    message: isCreator ? '组局已取消' : '你已退出该组局',
  });
}

async function deleteGroupRecord(groupId) {
  if (!runtime.useMock() && !runtime.useMockGroups()) {
    const result = await runtime.callCloudFunction('groupManage', {
      action: 'deleteGroupRecord',
      groupId,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message || '队伍记录删除失败，请稍后重试',
      };
    }

    syncGroupParticipationState(result);
    return {
      ok: true,
      message: result.message || '队伍记录已删除',
    };
  }

  const normalizedGroupId = String(groupId || '');
  if (!normalizedGroupId) {
    return runtime.delay({
      ok: false,
      message: '没有找到要删除的队伍',
    });
  }

  const activeGroup = groupService.getLocalActiveGroup();
  if (activeGroup && activeGroup.groupId === normalizedGroupId) {
    return runtime.delay({
      ok: false,
      message: '进行中的队伍不能直接删除',
    });
  }

  const currentGroups = groupService.getLocalGroups();
  const nextGroups = currentGroups.filter((item) => item.id !== normalizedGroupId);
  if (nextGroups.length === currentGroups.length) {
    return runtime.delay({
      ok: false,
      message: '这条队伍记录已经不存在了',
    });
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
  getLeaderboard,
  createGroup,
  joinGroup,
  cancelActiveGroup,
  deleteGroupRecord,
  clearLocalUserData,
  updateProfile,
  filterThemes: themeService.filterThemes,
  __test__: {
    syncGroupParticipationState,
  },
};
