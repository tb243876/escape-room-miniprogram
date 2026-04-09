'use strict';

const cloud = require('wx-server-sdk');
const staffDomain = require('./staff-domain');
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
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

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

function parseTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function upsertParticipantIdentity(identityMap, identity = {}, observedAt = '') {
  const openId = String(identity.openId || '').trim();
  if (!openId) {
    return;
  }

  const nextObservedAt = String(observedAt || '').trim();
  const current = identityMap.get(openId) || {
    openId,
    nickname: '',
    contactPhone: '',
    observedAt: '',
  };
  const currentObservedAtTs = parseTimestamp(current.observedAt);
  const nextObservedAtTs = parseTimestamp(nextObservedAt);

  identityMap.set(openId, {
    openId,
    nickname: String(identity.nickname || identity.contactName || current.nickname || '').trim(),
    contactPhone: String(identity.contactPhone || current.contactPhone || '').trim(),
    observedAt:
      nextObservedAtTs >= currentObservedAtTs
        ? nextObservedAt || current.observedAt || ''
        : current.observedAt || nextObservedAt || '',
  });
}

function collectParticipantIdentities(groups = [], sessions = []) {
  const identityMap = new Map();

  (Array.isArray(groups) ? groups : []).forEach((group) => {
    const observedAt = group.updatedAt || group.createdAt || '';
    (Array.isArray(group.participants) ? group.participants : []).forEach((participant) => {
      if (String(participant.status || '') === 'left') {
        return;
      }
      upsertParticipantIdentity(identityMap, participant, observedAt);
    });
  });

  (Array.isArray(sessions) ? sessions : []).forEach((session) => {
    const observedAt = session.endedAt || session.updatedAt || session.createdAt || '';
    (Array.isArray(session.members) ? session.members : []).forEach((member) => {
      upsertParticipantIdentity(
        identityMap,
        {
          openId: member.openId || '',
          nickname: member.nickname || '',
          contactPhone: member.contactPhone || '',
        },
        observedAt
      );
    });
  });

  return Array.from(identityMap.values());
}

function buildSeededProfileDoc(currentProfile = null, identity = {}) {
  const openId = String(identity.openId || '').trim();
  const observedAt = String(identity.observedAt || '').trim() || new Date().toISOString();
  if (!openId) {
    return null;
  }

  if (!currentProfile) {
    return profileDomain.buildProvisionedProfile(openId, identity, observedAt);
  }

  const nextProfile = profileDomain.applyIdentitySeed(
    {
      ...currentProfile,
      _id: openId,
    },
    identity
  );
  return {
    ...nextProfile,
    createdAt: currentProfile.createdAt || observedAt,
    updatedAt: observedAt || currentProfile.updatedAt || new Date().toISOString(),
  };
}

async function ensureParticipantProfiles(store, profiles = [], identities = []) {
  const profileMap = new Map(
    (Array.isArray(profiles) ? profiles : []).map((item) => [String(item._id || ''), item])
  );
  const upserts = [];

  (Array.isArray(identities) ? identities : []).forEach((identity) => {
    const openId = String(identity.openId || '').trim();
    if (!openId) {
      return;
    }

    const currentProfile = profileMap.get(openId) || null;
    const nextProfile = buildSeededProfileDoc(currentProfile, identity);
    if (!nextProfile) {
      return;
    }

    const shouldSync =
      !currentProfile ||
      String(nextProfile.nickname || '') !== String(currentProfile.nickname || '') ||
      String(nextProfile.contactPhone || '') !== String(currentProfile.contactPhone || '') ||
      !currentProfile.createdAt;

    profileMap.set(openId, nextProfile);

    if (!shouldSync) {
      return;
    }

    upserts.push(
      store
        .collection('profiles')
        .doc(openId)
        .set({
          data: stripInternalId(nextProfile),
        })
    );
  });

  if (upserts.length) {
    await Promise.all(upserts);
  }

  return Array.from(profileMap.values());
}

async function listAll(store, collectionName) {
  const collection = store.collection(collectionName);
  const countResult = await collection.count();
  const total = Number((countResult && countResult.total) || 0);
  const pageSize = 100;
  const jobs = [];
  for (let offset = 0; offset < total; offset += pageSize) {
    jobs.push(collection.skip(offset).limit(pageSize).get());
  }
  if (!jobs.length) {
    return [];
  }
  const results = await Promise.all(jobs);
  return results.reduce((list, item) => list.concat(item.data || []), []);
}

function formatBeijingDateTime(value) {
  const timestamp = new Date(value || '').getTime();
  if (!timestamp || Number.isNaN(timestamp)) {
    return '';
  }
  return new Date(timestamp + BEIJING_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
}

function sortProfilesByActivity(profiles = []) {
  return (Array.isArray(profiles) ? profiles : []).slice().sort((left, right) => {
    const leftTime = new Date(left.lastPlayedAt || left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.lastPlayedAt || right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function buildMemberCardItem(profile = {}, avatarUrlMap = new Map()) {
  const profileCard = attachProfileCardAvatar(
    profileDomain.buildProfileCard({
      ...profile,
      _id: String(profile._id || ''),
    }),
    avatarUrlMap
  );
  return {
    openId: String(profile._id || ''),
    nickname: profileCard.nickname,
    avatarUrl: profileCard.avatarUrl || '',
    avatarFileId: profileCard.avatarFileId || '',
    avatarText: profileCard.avatarText || String(profileCard.nickname || '玩').slice(0, 1),
    titleLabel: profileCard.titleLabel || '',
    summaryText: profileCard.summaryText,
    signature: profileCard.signature,
    lastActiveText: formatBeijingDateTime(profile.lastPlayedAt || profile.updatedAt || profile.createdAt),
    createdAtText: formatBeijingDateTime(profile.createdAt),
    profileCard,
  };
}

function buildSessionPanelItem(session = {}) {
  const memberCount = Array.isArray(session.members) ? session.members.length : 0;
  const resultText = formatSessionResultText(session.result);
  return {
    id: String(session._id || session.id || ''),
    themeName: session.themeName || '未知主题',
    endedAtText: formatBeijingDateTime(session.endedAt || session.updatedAt || session.createdAt),
    playerCount: memberCount,
    metaText: `${memberCount} 人 · ${resultText}`,
  };
}

function formatSessionResultText(result) {
  if (typeof result === 'string' && String(result).trim()) {
    return String(result).trim();
  }
  if (!result || typeof result !== 'object') {
    return '已结算';
  }
  if (result.escaped === true) {
    return result.fastestRun ? '成功逃脱 · 最速纪录' : '成功逃脱';
  }
  if (result.escaped === false) {
    return '未逃脱';
  }
  return '已结算';
}

function fail(errorCode, message, retryable = false, extra = {}) {
  return {
    ok: false,
    errorCode,
    message,
    retryable,
    ...extra,
  };
}

async function buildTempFileUrlMap(fileIds = []) {
  const normalizedFileIds = Array.from(
    new Set((fileIds || []).map((item) => String(item || '').trim()).filter(Boolean))
  );
  if (!normalizedFileIds.length || typeof cloud.getTempFileURL !== 'function') {
    return new Map();
  }

  try {
    const result = await cloud.getTempFileURL({
      fileList: normalizedFileIds,
    });
    return new Map(
      ((result && result.fileList) || []).map((item) => [
        String(item.fileID || '').trim(),
        item.tempFileURL || '',
      ])
    );
  } catch (error) {
    console.warn('[staffManage] buildTempFileUrlMap.failed', {
      count: normalizedFileIds.length,
      message: error && error.message,
    });
    return new Map();
  }
}

function isCloudFileId(value) {
  return String(value || '').trim().startsWith('cloud://');
}

function resolveAvatarFileId(profile = {}) {
  const explicitFileId = String((profile && profile.avatarFileId) || '').trim();
  if (explicitFileId) {
    return explicitFileId;
  }
  const avatarUrl = String((profile && profile.avatarUrl) || '').trim();
  return isCloudFileId(avatarUrl) ? avatarUrl : '';
}

async function buildProfileAvatarUrlMap(profiles = []) {
  return buildTempFileUrlMap(
    (profiles || []).map((item) => resolveAvatarFileId(item)).filter(Boolean)
  );
}

function attachProfileCardAvatar(profileCard = {}, avatarUrlMap = new Map()) {
  const avatarFileId = resolveAvatarFileId(profileCard);
  if (!avatarFileId) {
    return {
      ...profileCard,
      avatarUrl: String((profileCard && profileCard.avatarUrl) || '').trim(),
      avatarFileId: '',
    };
  }
  return {
    ...profileCard,
    avatarFileId,
    avatarUrl: String(avatarUrlMap.get(avatarFileId) || '').trim(),
  };
}

async function generateAuthCode(store) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let index = 0; index < 30; index += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    try {
      const result = await store.collection('staff_auth_codes').doc(code).get();
      if (!result.data || result.data.status === 'disabled') {
        return code;
      }
    } catch (error) {
      return code;
    }
  }

  throw new Error('授权码生成失败，请重试');
}

async function getBinding(store, openId) {
  try {
    const result = await store.collection('staff_bindings').doc(openId).get();
    console.info('[staffManage] getBinding.hit', {
      openId,
      bindingId: result && result.data ? result.data._id : '',
      role: result && result.data ? result.data.role : '',
    });
    return staffDomain.normalizeBinding(result.data || {});
  } catch (error) {
    console.warn('[staffManage] getBinding.miss', {
      openId,
      message: error && error.message,
    });
    return null;
  }
}

async function ensureBinding(store, openId) {
  const binding = await getBinding(store, openId);
  if (!binding) {
    return fail('STAFF_BINDING_REQUIRED', '当前身份还没有门店工作台权限，请先完成授权绑定');
  }
  console.info('[staffManage] ensureBinding.ok', {
    openId,
    role: binding.role,
  });
  return {
    ok: true,
    binding,
  };
}

async function buildGroupMap(store) {
  const groups = await listAll(store, 'groups');
  return new Map(groups.map((item) => [String(item._id || ''), item]));
}

async function syncSessionsFromGroups(store) {
  const groupMap = await buildGroupMap(store);
  const allSessions = await listAll(store, 'staff_sessions');
  const sessionMap = new Map(allSessions.map((item) => [String(item.groupId || ''), item]));
  const upserts = [];

  groupMap.forEach((group, groupId) => {
    if (!['pending_store_confirm', 'confirmed'].includes(String(group.status || ''))) {
      return;
    }

    const existingSession = sessionMap.get(groupId) || null;
    const shouldSyncFromGroup =
      !existingSession || ['pending_confirm', 'ready'].includes(existingSession.stageKey);
    if (!shouldSyncFromGroup) {
      return;
    }

    const nextSession = staffDomain.buildSessionFromGroup(group, existingSession);
    upserts.push(
      db
        .collection(store.collectionName('staff_sessions'))
        .doc(nextSession._id)
        .set({
          data: stripInternalId(nextSession),
        })
    );
  });

  if (upserts.length) {
    await Promise.all(upserts);
  }
}

async function ensureSessionDoc(store, sessionId = '') {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId) {
    return null;
  }

  let existingSession = null;
  try {
    const result = await store.collection('staff_sessions').doc(normalizedSessionId).get();
    existingSession = result && result.data ? result.data : null;
  } catch (error) {
    if (!normalizedSessionId.startsWith('session-')) {
      return null;
    }
  }

  if (!normalizedSessionId.startsWith('session-')) {
    return existingSession;
  }

  const groupId = normalizedSessionId.replace(/^session-/, '');
  if (!groupId) {
    return existingSession;
  }

  try {
    const groupResult = await store.collection('groups').doc(groupId).get();
    if (!groupResult || !groupResult.data) {
      return existingSession;
    }
    const nextSession = staffDomain.buildSessionFromGroup(groupResult.data, {
      ...(existingSession || {}),
      _id: normalizedSessionId,
    });
    await store
      .collection('staff_sessions')
      .doc(normalizedSessionId)
      .set({
        data: stripInternalId(nextSession),
      });
    return nextSession;
  } catch (error) {
    console.warn('[staffManage] ensureSessionDoc.failed', {
      sessionId: normalizedSessionId,
      groupId,
      message: error && error.message,
    });
    return existingSession;
  }
}

async function listSessions(store) {
  await syncSessionsFromGroups(store);
  const sessions = await listAll(store, 'staff_sessions');
  return sessions.sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

async function buildDashboard(store, binding) {
  const sessions = await listSessions(store);
  const permissions = binding.permissions || [];
  const needProfiles =
    permissions.includes('view_statistics') ||
    permissions.includes('manage_auth_codes') ||
    permissions.includes('transfer_manager');
  const profilesPromise = needProfiles ? listAll(store, 'profiles') : Promise.resolve([]);
  const groupsPromise = permissions.includes('view_statistics')
    ? listAll(store, 'groups')
    : Promise.resolve([]);
  const bindingsPromise =
    permissions.includes('manage_auth_codes') || permissions.includes('transfer_manager')
      ? listAll(store, 'staff_bindings')
      : Promise.resolve([]);
  const codesPromise = permissions.includes('manage_auth_codes')
    ? listAll(store, 'staff_auth_codes')
    : Promise.resolve([]);
  const dashboard = {
    role: binding.role,
    roleLabel: binding.roleLabel,
    storeName: binding.storeName,
    permissions,
    stats: staffDomain.buildDashboardStats(sessions),
    sessions: staffDomain.buildDashboardSessions(sessions),
  };
  let sharedProfiles = await profilesPromise;
  let sharedProfileAvatarUrlMap = new Map();

  if (permissions.includes('view_statistics')) {
    const groups = await groupsPromise;
    const mergedProfiles = await ensureParticipantProfiles(
      store,
      sharedProfiles,
      collectParticipantIdentities(groups, sessions)
    );
    sharedProfiles = mergedProfiles;
    sharedProfileAvatarUrlMap = await buildProfileAvatarUrlMap(mergedProfiles);
    const now = Date.now();
    const day7 = 7 * 24 * 60 * 60 * 1000;
    const day30 = 30 * 24 * 60 * 60 * 1000;
    const activeUsers30d = mergedProfiles.filter((profile) =>
      (profile.punchRecords || []).some(
        (item) => now - new Date(item.punchedAt || item.playedAt || 0).getTime() <= day30
      )
    ).length;
    const completedSessions30d = sessions.filter(
      (item) =>
        item.stageKey === 'settled' &&
        now - new Date(item.endedAt || item.updatedAt || 0).getTime() <= day30
    ).length;
    const newUsers7d = mergedProfiles.filter(
      (profile) => now - new Date(profile.createdAt || 0).getTime() <= day7
    ).length;

    dashboard.memberStats = {
      totalUsers: mergedProfiles.length,
      activeUsers30d,
      completedSessions30d,
      newUsers7d,
    };
    dashboard.memberInsights = [
      {
        title: '累计用户数',
        value: String(mergedProfiles.length),
        note: '已在云端建档并可参与排行榜的玩家数',
      },
      {
        title: '近 30 天活跃',
        value: String(activeUsers30d),
        note: '按近 30 天有真实完成记录的玩家统计',
      },
      {
        title: '近 30 天完成场次',
        value: String(completedSessions30d),
        note: '按店员完成结算的真实场次统计',
      },
      {
        title: '本周新增',
        value: String(newUsers7d),
        note: '按档案创建时间统计的新用户',
      },
    ];
    const sortedProfiles = sortProfilesByActivity(mergedProfiles);
    const activeProfiles30d = sortProfilesByActivity(
      mergedProfiles.filter((profile) =>
        (profile.punchRecords || []).some(
          (item) => now - new Date(item.punchedAt || item.playedAt || 0).getTime() <= day30
        )
      )
    );
    const newProfiles7d = sortProfilesByActivity(
      mergedProfiles.filter(
        (profile) => now - new Date(profile.createdAt || 0).getTime() <= day7
      )
    );
    const settledSessions30d = sessions
      .filter(
        (item) =>
          item.stageKey === 'settled' &&
          now - new Date(item.endedAt || item.updatedAt || 0).getTime() <= day30
      )
      .slice()
      .sort(
        (left, right) =>
          new Date(right.endedAt || right.updatedAt || 0).getTime() -
          new Date(left.endedAt || left.updatedAt || 0).getTime()
      );

    dashboard.memberList = sortedProfiles.slice(0, 30).map((item) =>
      buildMemberCardItem(item, sharedProfileAvatarUrlMap)
    );
    dashboard.memberPanels = {
      totalUsers: {
        key: 'totalUsers',
        title: '累计用户',
        subtitle: '按最近档案活跃时间排序，展示最近更新的玩家档案',
        type: 'members',
        items: sortedProfiles.slice(0, 30).map((item) =>
          buildMemberCardItem(item, sharedProfileAvatarUrlMap)
        ),
      },
      activeUsers30d: {
        key: 'activeUsers30d',
        title: '近30天活跃用户',
        subtitle: '最近 30 天内有真实完成记录的玩家',
        type: 'members',
        items: activeProfiles30d.slice(0, 30).map((item) =>
          buildMemberCardItem(item, sharedProfileAvatarUrlMap)
        ),
      },
      completedSessions30d: {
        key: 'completedSessions30d',
        title: '近30天完成场次',
        subtitle: '最近 30 天已结算的真实场次记录',
        type: 'sessions',
        items: settledSessions30d.slice(0, 30).map((item) => buildSessionPanelItem(item)),
      },
      newUsers7d: {
        key: 'newUsers7d',
        title: '本周新增用户',
        subtitle: '按档案创建时间统计，展示最近 7 天新建档的玩家',
        type: 'members',
        items: newProfiles7d.slice(0, 30).map((item) =>
          buildMemberCardItem(item, sharedProfileAvatarUrlMap)
        ),
      },
    };
  } else {
    sharedProfileAvatarUrlMap = await buildProfileAvatarUrlMap(sharedProfiles);
  }

  const sharedBindings =
    permissions.includes('manage_auth_codes') || permissions.includes('transfer_manager')
      ? await bindingsPromise
      : [];

  if (permissions.includes('manage_auth_codes')) {
    const codes = await codesPromise;
    const bindings = sharedBindings;
    const profileMap = new Map(sharedProfiles.map((item) => [String(item._id || ''), item]));
    const sortedCodes = codes
      .slice()
      .sort(
        (left, right) =>
          new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
      );
    dashboard.authCodeSummary = {
      availableCodes: codes.filter((item) => item.status === 'active').length,
      activeStaff: bindings.length,
      latestCode: sortedCodes[0] ? sortedCodes[0]._id : '',
    };
    dashboard.authCodeList = sortedCodes.slice(0, 4).map((item) => ({
      code: item._id,
      role: item.role,
      roleLabel: item.roleLabel,
      status: item.status || 'active',
      createdAt: item.createdAt || '',
      createdDateText: formatBeijingDateTime(item.createdAt),
    }));
    dashboard.authCodeActions = [
      {
        key: 'staff',
        text: '店员码',
      },
      {
        key: 'assistant_manager',
        text: '副店长码',
      },
    ];
    dashboard.staffMembers = bindings
      .slice()
      .sort(
        (left, right) =>
          new Date(right.boundAt || 0).getTime() - new Date(left.boundAt || 0).getTime()
      )
      .map((item) => {
        const profile = profileMap.get(String(item._id || '')) || null;
        const profileCard = attachProfileCardAvatar(
          profileDomain.buildProfileCard(
            profile
              ? {
                  ...profile,
                  _id: String(item._id || ''),
                  nickname: profile.nickname || `员工${String(item._id || '').slice(-4)}`,
                }
              : profileDomain.buildDefaultProfile(String(item._id || ''))
          ),
          sharedProfileAvatarUrlMap
        );
        if (!profile) {
          profileCard.nickname = `员工${String(item._id || '').slice(-4)}`;
          profileCard.avatarText = String((item.roleLabel || '员').slice(0, 1));
        }
        return {
          openId: String(item._id || ''),
          nickname: profileCard.nickname,
          avatarText:
            profileCard.avatarText ||
            String(((profile && profile.nickname) || item.roleLabel || '员').slice(0, 1)),
          avatarUrl: profileCard.avatarUrl || '',
          avatarFileId: profileCard.avatarFileId || '',
          role: item.role || 'staff',
          roleLabel: item.roleLabel || '店员',
          boundAt: item.boundAt || '',
          boundAtText: formatBeijingDateTime(item.boundAt),
          isCurrentUser: String(item._id || '') === String(binding._id || ''),
          canRemove:
            String(item._id || '') !== String(binding._id || '') && item.role !== 'store_manager',
          profileCard,
          summaryText: profileCard.summaryText,
          signature: profileCard.signature,
        };
      });
  }

  if (permissions.includes('transfer_manager')) {
    const profileMap = new Map(sharedProfiles.map((item) => [String(item._id || ''), item]));
    const candidates = sharedBindings
      .filter((item) => item._id !== binding._id && item.role === 'assistant_manager')
      .map((item) => {
        const profile = profileMap.get(String(item._id || '')) || {};
        return {
          openId: String(item._id || ''),
          nickname: profile.nickname || `副店长${String(item._id || '').slice(-4)}`,
          roleLabel: item.roleLabel || '副店长',
        };
      });
    dashboard.managerTransfer = {
      currentManager: `${binding.roleLabel}（当前账号）`,
      candidates: candidates.map((item) => `${item.roleLabel} ${item.nickname}`),
      candidateList: candidates,
    };
  }

  return dashboard;
}

function buildGroupRoomSnapshotPatch(session = {}) {
  // `staff_sessions.stageKey` 是唯一权威状态；`groups.roomStage` 只保留给玩家侧读取的缓存快照。
  const roomStage = session.stageKey;
  const roomMembers = (session.members || []).map((item) => ({
    openId: item.openId || '',
    nickname: item.nickname || '玩家',
    status: item.status || '待确认',
  }));
  const roomTimeline = Array.isArray(session.timeline) ? session.timeline : [];

  const patch = {
    roomStage,
    roomMembers,
    roomTimeline,
    roomUpdatedAt: new Date().toISOString(),
    sessionId: session._id,
  };

  if (session.stageKey === 'settled') {
    patch.status = 'settled';
  } else if (session.stageKey === 'ready' || session.stageKey === 'playing') {
    patch.status = 'confirmed';
  } else if (session.stageKey === 'pending_confirm') {
    patch.status = 'pending_store_confirm';
  }
  if (session.stageKey === 'settled' && session.result) {
    patch.roomResult = session.result;
  }

  return patch;
}

async function syncGroupRoomSnapshot(store, session = {}) {
  const groupId = String(session.groupId || '').trim();
  if (!groupId) {
    return;
  }

  try {
    await store.collection('groups').doc(groupId).update({
      data: buildGroupRoomSnapshotPatch(session),
    });
  } catch (error) {
    console.warn('[staffManage] syncGroupRoomSnapshot.failed', {
      sessionId: session._id || '',
      groupId,
      message: error && error.message,
    });
  }
}

async function applySettlement(store, session) {
  if (session.settlementApplied) {
    return session;
  }

  const memberIds = (session.members || []).map((item) => item.openId).filter(Boolean);
  if (!memberIds.length) {
    return {
      ...session,
      settlementApplied: true,
    };
  }

  const memberIdentityMap = new Map(
    (session.members || [])
      .filter((item) => String(item.openId || '').trim())
      .map((item) => [
        String(item.openId || '').trim(),
        {
          openId: String(item.openId || '').trim(),
          nickname: String(item.nickname || '').trim(),
          contactPhone: String(item.contactPhone || '').trim(),
          observedAt:
            session.endedAt || session.updatedAt || session.createdAt || new Date().toISOString(),
        },
      ])
  );

  const derivedGroupId = String(session.groupId || '').trim() ||
    (String(session._id || '').startsWith('session-') ? session._id.replace(/^session-/, '') : '');
  let groupDoc = null;
  if (derivedGroupId) {
    try {
      const groupResult = await store.collection('groups').doc(derivedGroupId).get();
      groupDoc = groupResult && groupResult.data ? groupResult.data : null;
    } catch (error) {
      groupDoc = null;
    }
  }

  const profileMap = new Map(
    await Promise.all(
      memberIds.map(async (openId) => {
        try {
          const result = await store.collection('profiles').doc(openId).get();
          return [openId, result && result.data ? result.data : null];
        } catch (error) {
          return [openId, null];
        }
      })
    )
  );
  const newbieOpenIdSet = new Set(
    memberIds.filter((openId) => {
      const profile = profileMap.get(openId);
      const punchRecords = Array.isArray(profile && profile.punchRecords) ? profile.punchRecords : [];
      const playRecords = Array.isArray(profile && profile.playRecords) ? profile.playRecords : [];
      const totalPlayCount = Math.max(
        punchRecords.length,
        playRecords.length,
        Number((profile && profile.totalPlayCount) || 0)
      );
      return totalPlayCount <= 0;
    })
  );
  const sessionMemberSnapshot = memberIds
    .map((openId) => memberIdentityMap.get(openId))
    .filter(Boolean);
  const creatorOpenId = String((groupDoc && groupDoc.creatorOpenId) || '').trim();
  const maxTeamSize = Math.max(
    Number(session.teamSize || 0),
    Number((groupDoc && (groupDoc.maxPeople || groupDoc.targetPeople || groupDoc.expectedPeople)) || 0),
    memberIds.length
  );
  const isFullHouse = Boolean(maxTeamSize > 0 && memberIds.length >= maxTeamSize);

  const settlementResults = await Promise.all(
    memberIds.map(async (openId) => {
      try {
        const profile = profileMap.get(openId) || null;

        const seededProfile = buildSeededProfileDoc(
          profile,
          memberIdentityMap.get(openId) || { openId }
        );

        const nextProfile = profileDomain.applySessionSettlement(
          seededProfile || profileDomain.buildDefaultProfile(openId),
          {
            id: session._id,
            themeId: session.themeId,
            themeName: session.themeName,
            horror: session.horror,
            teamSize: session.teamSize,
            maxTeamSize,
            isFullHouse,
            lateNight: session.lateNight,
            playDate: session.playDate,
            timeSlot: session.timeSlot,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            currentOpenId: openId,
            memberSnapshot: sessionMemberSnapshot,
            wasCreator: Boolean(creatorOpenId && creatorOpenId === openId),
            newbieCount: memberIds.filter((id) => id !== openId && newbieOpenIdSet.has(id)).length,
            broughtNewbie: Boolean(
              creatorOpenId &&
                creatorOpenId === openId &&
                memberIds.some((id) => id !== openId && newbieOpenIdSet.has(id))
            ),
            escaped:
              session.result && typeof session.result.escaped === 'boolean'
                ? session.result.escaped
                : null,
            fastestRun:
              session.result && typeof session.result.fastestRun === 'boolean'
                ? session.result.fastestRun
                : false,
            holidayTag: session.holidayTag || '',
            growthValue:
              session.result && session.result.growthValue ? session.result.growthValue : 18,
          }
        );

        await db
          .collection(store.collectionName('profiles'))
          .doc(openId)
          .set({
            data: stripInternalId(nextProfile),
          });

        return {
          ok: true,
          openId,
        };
      } catch (error) {
        console.warn('[staffManage] applySettlement.partialFailure', {
          sessionId: session._id || '',
          openId,
          message: error && error.message,
        });
        return {
          ok: false,
          openId,
          message: error && error.message,
        };
      }
    })
  );
  const failedMemberIds = settlementResults
    .filter((item) => !item.ok)
    .map((item) => item.openId)
    .filter(Boolean);
  if (failedMemberIds.length) {
    console.warn('[staffManage] applySettlement.partialFailureSummary', {
      sessionId: session._id || '',
      failedMemberIds,
    });
  }

  // Detect no-shows: group participants with status 'active' who were not in session.members
  if (derivedGroupId) {
    try {
      if (groupDoc) {
        const checkedInIds = new Set(memberIds.map((id) => String(id).trim()));
        const noShowIds = (groupDoc.participants || [])
          .filter((p) => String(p.status || '') === 'active' && String(p.openId || '').trim())
          .map((p) => String(p.openId || '').trim())
          .filter((id) => !checkedInIds.has(id));

        if (noShowIds.length) {
          await Promise.all(
            noShowIds.map((id) =>
              db
                .collection(store.collectionName('profiles'))
                .doc(id)
                .update({
                  data: {
                    cancelCount: db.command.inc(1),
                    updatedAt: new Date().toISOString(),
                  },
                })
                .catch(() => {})
            )
          );
          console.info('[staffManage] applySettlement.noShowPenalty', {
            sessionId: session._id,
            noShowCount: noShowIds.length,
          });
        }
      }
    } catch (e) {
      console.warn('[staffManage] applySettlement.noShowDetectionFailed', {
        sessionId: session._id,
        message: e && e.message,
      });
    }
  }

  return {
    ...session,
    settlementApplied: true,
  };
}

async function upsertHighlightPackage(store, session, binding) {
  const highlightId = `highlight-${session._id}`;
  let existing = null;
  try {
    const result = await store.collection('staff_highlights').doc(highlightId).get();
    existing = result.data || null;
  } catch (error) {
    existing = null;
  }

  const nextDoc = {
    _id: highlightId,
    sessionId: session._id,
    groupId: session.groupId,
    themeName: session.themeName,
    sessionLabel: `${session.playDate || ''} ${session.timeSlot || ''}`.trim(),
    status: existing && existing.status ? existing.status : '待上传',
    expireHint: '建议在结算后 48 小时内补齐本场照片或视频。',
    uploaderRole: binding.role,
    uploaderName: binding.roleLabel,
    media: existing && Array.isArray(existing.media) ? existing.media : [],
    createdAt: existing && existing.createdAt ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db
    .collection(store.collectionName('staff_highlights'))
    .doc(highlightId)
    .set({
      data: stripInternalId(nextDoc),
    });

  return nextDoc;
}

function normalizeHighlightMediaItem(item = {}, index = 0) {
  const type =
    String(item.type || item.fileType || '')
      .trim()
      .toLowerCase() === 'video'
      ? 'video'
      : 'image';
  const fileId = String(item.fileId || item.fileID || '').trim();
  return {
    id: String(item.id || item.mediaId || `media-${Date.now()}-${index}`),
    type,
    title: String(
      item.title || (type === 'video' ? `视频${index + 1}` : `图片${index + 1}`)
    ).trim(),
    fileId,
    size: Number(item.size || 0),
    duration: Number(item.duration || 0),
    uploadedAt: item.uploadedAt || new Date().toISOString(),
  };
}

function normalizeHighlightMediaList(list = []) {
  return (Array.isArray(list) ? list : [])
    .map((item, index) => normalizeHighlightMediaItem(item, index))
    .filter((item) => item.fileId);
}

async function getHighlightPackage(store, highlightId = '') {
  const normalizedHighlightId = String(highlightId || '').trim();
  if (!normalizedHighlightId) {
    return null;
  }

  try {
    const result = await store.collection('staff_highlights').doc(normalizedHighlightId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function saveHighlightPackage(store, highlightDoc, binding) {
  const media = normalizeHighlightMediaList(highlightDoc && highlightDoc.media);
  const nextDoc = {
    ...(highlightDoc || {}),
    status: media.length ? '已上传' : '待上传',
    uploaderRole: binding.role,
    uploaderName: binding.roleLabel,
    media,
    updatedAt: new Date().toISOString(),
  };

  await db
    .collection(store.collectionName('staff_highlights'))
    .doc(String(nextDoc._id || ''))
    .set({
      data: stripInternalId(nextDoc),
    });

  return nextDoc;
}

async function buildHighlightForClient(highlightDoc, binding) {
  const nextDoc = highlightDoc || {};
  const mediaList = Array.isArray(nextDoc.media) ? nextDoc.media : [];
  const tempFileUrlMap = await buildTempFileUrlMap(mediaList.map((item) => item.fileId || item.fileID || ''));
  return {
    ...nextDoc,
    id: nextDoc._id || '',
    roleLabel: binding.roleLabel || '店员',
    statusClass: nextDoc.status === '已上传' ? 'status-ok' : 'status-pending',
    media: mediaList.map((media) => ({
          ...media,
          previewUrl: tempFileUrlMap.get(String(media.fileId || media.fileID || '').trim()) || '',
          tagText: media.type === 'video' ? '视频' : '图片',
        })),
  };
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const store = createStore(normalizeDataEnvTag(event.__dataEnvTag));

  if (!openId) {
    return fail('AUTH_OPENID_MISSING', '当前身份校验失败，请重新进入小程序后再试');
  }

  const action = String(event.action || '').trim();

  try {
    if (action === 'redeemAuthCode') {
      const code = String(event.code || '')
        .trim()
        .toUpperCase();
      console.info('[staffManage] redeemAuthCode.start', {
        openId,
        code,
      });
      if (!code) {
        return fail('AUTH_CODE_EMPTY', '请输入授权码');
      }

      if (code.length !== 6) {
        return fail('AUTH_CODE_FORMAT_INVALID', '授权码格式不正确，请输入6位授权码');
      }

      const existingBinding = await getBinding(store, openId);
      if (existingBinding) {
        console.info('[staffManage] redeemAuthCode.alreadyBound', {
          openId,
          role: existingBinding.role,
        });
        return {
          ok: true,
          binding: existingBinding,
        };
      }

      let authCode = null;
      try {
        const result = await store.collection('staff_auth_codes').doc(code).get();
        authCode = result.data || null;
      } catch (error) {
        authCode = null;
      }

      if (!authCode || authCode.status !== 'active') {
        console.warn('[staffManage] redeemAuthCode.invalid', {
          openId,
          code,
          authCode: authCode
            ? {
                id: authCode._id,
                status: authCode.status,
              }
            : null,
        });
        return fail('AUTH_CODE_INVALID', '授权码无效或已失效，请联系店长重新获取');
      }

      const binding = staffDomain.normalizeBinding({
        _id: openId,
        role: authCode.role,
        roleLabel: authCode.roleLabel,
        storeName: authCode.storeName || '迷场档案馆',
        authCode: code,
        boundAt: new Date().toISOString(),
      });

      await db
        .collection(store.collectionName('staff_bindings'))
        .doc(openId)
        .set({
          data: stripInternalId(binding),
        });
      await db
        .collection(store.collectionName('staff_auth_codes'))
        .doc(code)
        .update({
          data: {
            status: 'used',
            usedBy: openId,
            usedAt: new Date().toISOString(),
          },
        });
      console.info('[staffManage] redeemAuthCode.saved', {
        openId,
        role: binding.role,
        authCode: binding.authCode,
        storeName: binding.storeName,
      });

      return {
        ok: true,
        binding: {
          role: binding.role,
          roleLabel: binding.roleLabel,
          storeName: binding.storeName,
          authCode: binding.authCode,
          permissions: binding.permissions,
        },
        message: '授权成功',
      };
    }

    const bindingState = await ensureBinding(store, openId);
    if (!bindingState.ok) {
      console.warn('[staffManage] ensureBinding.failed', {
        openId,
        action,
      });
      return bindingState;
    }
    const binding = bindingState.binding;

    if (action === 'generateAuthCode') {
      if (!(binding.permissions || []).includes('manage_auth_codes')) {
        return fail('STAFF_PERMISSION_DENIED', '当前身份没有授权码管理权限');
      }

      const role = String(event.role || '').trim();
      const roleConfigMap = {
        staff: {
          role: 'staff',
          roleLabel: '店员',
        },
        assistant_manager: {
          role: 'assistant_manager',
          roleLabel: '副店长',
        },
      };
      const roleConfig = roleConfigMap[role];
      if (!roleConfig) {
        return fail('REQUEST_PARAM_INVALID', '生成类型无效，请重试');
      }
      const code = await generateAuthCode(store);
      const authCodeDoc = {
        _id: code,
        role: roleConfig.role,
        roleLabel: roleConfig.roleLabel,
        storeName: binding.storeName || '迷场档案馆',
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: openId,
      };

      await db
        .collection(store.collectionName('staff_auth_codes'))
        .doc(code)
        .set({
          data: stripInternalId(authCodeDoc),
        });

      return {
        ok: true,
        message: `${roleConfig.roleLabel}授权码已生成`,
        authCode: {
          code,
          role: roleConfig.role,
          roleLabel: roleConfig.roleLabel,
        },
        dashboard: await buildDashboard(store, binding),
      };
    }

    if (action === 'getDashboard') {
      return {
        ok: true,
        dashboard: await buildDashboard(store, binding),
      };
    }

    if (action === 'removeStaffBinding') {
      if (!(binding.permissions || []).includes('manage_auth_codes')) {
        return fail('STAFF_PERMISSION_DENIED', '当前身份没有员工管理权限');
      }
      const targetOpenId = String(event.targetOpenId || '');
      if (!targetOpenId || targetOpenId === String(binding._id || '')) {
        return fail('STAFF_TARGET_INVALID', '不能移除当前账号');
      }
      const targetResult = await db
        .collection(store.collectionName('staff_bindings'))
        .doc(targetOpenId)
        .get()
        .catch(() => null);
      const targetBinding = targetResult && targetResult.data ? targetResult.data : null;
      if (!targetBinding) {
        return fail('STAFF_TARGET_NOT_FOUND', '没有找到该员工');
      }
      if (targetBinding.role === 'store_manager') {
        return fail('STAFF_TARGET_INVALID', '不能直接移除店长账号');
      }

      await db.runTransaction(async (transaction) => {
        await transaction
          .collection(store.collectionName('staff_bindings'))
          .doc(targetOpenId)
          .remove();
        if (targetBinding.authCode) {
          await transaction
            .collection(store.collectionName('staff_auth_codes'))
            .doc(String(targetBinding.authCode))
            .update({
              data: {
                status: 'disabled',
                usedBy: '',
                usedAt: '',
              },
            });
        }
      });
      return {
        ok: true,
        message: '员工已移除',
        dashboard: await buildDashboard(store, binding),
      };
    }

    if (action === 'transferManager') {
      if (!(binding.permissions || []).includes('transfer_manager')) {
        return fail('STAFF_PERMISSION_DENIED', '当前身份没有店长转移权限');
      }
      const targetOpenId = String(event.targetOpenId || '');
      if (!targetOpenId || targetOpenId === String(binding._id || '')) {
        return fail('STAFF_TARGET_INVALID', '请选择新的店长账号');
      }

      const targetResult = await db
        .collection(store.collectionName('staff_bindings'))
        .doc(targetOpenId)
        .get()
        .catch(() => null);
      const targetBinding = targetResult && targetResult.data ? targetResult.data : null;
      if (!targetBinding || targetBinding.role !== 'assistant_manager') {
        return fail('STAFF_TARGET_INVALID', '只能转移给副店长账号');
      }

      const nextCurrentBinding = staffDomain.normalizeBinding({
        ...binding,
        role: 'assistant_manager',
        roleLabel: '副店长',
      });
      const nextTargetBinding = staffDomain.normalizeBinding({
        ...targetBinding,
        _id: targetOpenId,
        role: 'store_manager',
        roleLabel: '店长',
      });

      await db
        .collection(store.collectionName('staff_bindings'))
        .doc(String(binding._id || ''))
        .set({
          data: stripInternalId(nextCurrentBinding),
        });
      await db
        .collection(store.collectionName('staff_bindings'))
        .doc(targetOpenId)
        .set({
          data: stripInternalId(nextTargetBinding),
        });

      return {
        ok: true,
        message: '店长已转移',
        dashboard: await buildDashboard(store, nextCurrentBinding),
      };
    }

    if (action === 'getSession') {
      const sessionId = String(event.sessionId || '');
      if (!sessionId) {
        return fail('SESSION_NOT_FOUND', '没有找到这个场次，请返回工作台重试');
      }

      await syncSessionsFromGroups(store);
      const sessionDoc = await ensureSessionDoc(store, sessionId);
      if (!sessionDoc) {
        return fail('SESSION_NOT_FOUND', '没有找到这个场次，请返回工作台重试');
      }

      return {
        ok: true,
        session: staffDomain.normalizeSessionForClient(sessionDoc, binding),
      };
    }

    if (action === 'toggleSessionMember') {
      if (!(binding.permissions || []).includes('session_confirm')) {
        return fail('STAFF_PERMISSION_DENIED', '当前身份没有场次确认权限');
      }
      const sessionId = String(event.sessionId || '');
      const targetOpenId = String(event.openId || '');
      if (!sessionId || !targetOpenId) {
        return fail('SESSION_PARAM_INVALID', '操作参数缺失，请返回工作台重试');
      }
      const result = await store.collection('staff_sessions').doc(sessionId).get();
      if (!result.data) {
        return fail('SESSION_NOT_FOUND', '没有找到这个场次，请返回工作台重试');
      }

      const toggleValidation = staffDomain.validateSessionMemberToggle(result.data, targetOpenId);
      if (!toggleValidation.ok) {
        return toggleValidation;
      }

      const nextSession = staffDomain.toggleSessionMemberCheckIn(result.data, targetOpenId);
      await db
        .collection(store.collectionName('staff_sessions'))
        .doc(sessionId)
        .set({
          data: stripInternalId(nextSession),
        });
      await syncGroupRoomSnapshot(store, nextSession);

      return {
        ok: true,
        session: staffDomain.normalizeSessionForClient(nextSession, binding),
      };
    }

    if (action === 'runSessionAction') {
      const sessionId = String(event.sessionId || '');
      const actionKey = String(event.actionKey || '');
      if (!sessionId || !actionKey) {
        return fail('SESSION_PARAM_INVALID', '操作参数缺失，请返回工作台重试');
      }

      const actionPermissionMap = {
        confirm: 'session_confirm',
        start: 'session_start',
        end: 'session_end',
      };
      const requiredPermission = actionPermissionMap[actionKey];
      if (requiredPermission && !(binding.permissions || []).includes(requiredPermission)) {
        return fail('STAFF_PERMISSION_DENIED', '当前身份没有该操作权限');
      }
      const result = await store.collection('staff_sessions').doc(sessionId).get();
      if (!result.data) {
        return fail('SESSION_NOT_FOUND', '没有找到这个场次，请返回工作台重试');
      }

      const actionValidation = staffDomain.validateSessionAction(result.data, actionKey);
      if (!actionValidation.ok) {
        return actionValidation;
      }

      let nextSession = staffDomain.buildNextSessionState(result.data, actionKey);
      if (actionKey === 'end' && nextSession.stageKey === 'settled') {
        nextSession = await applySettlement(store, nextSession);
        await upsertHighlightPackage(store, nextSession, binding);
      }

      await db
        .collection(store.collectionName('staff_sessions'))
        .doc(sessionId)
        .set({
          data: stripInternalId(nextSession),
        });
      await syncGroupRoomSnapshot(store, nextSession);

      return {
        ok: true,
        session: staffDomain.normalizeSessionForClient(nextSession, binding),
      };
    }

    if (action === 'getHighlights') {
      const highlights = await listAll(store, 'staff_highlights');
      return {
        ok: true,
        highlights: await Promise.all(
          highlights
            .sort(
              (left, right) =>
                new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime()
            )
            .map((item) => buildHighlightForClient(item, binding))
        ),
      };
    }

    if (action === 'saveHighlights') {
      if (!(binding.permissions || []).includes('upload_highlights')) {
        return fail('STAFF_PERMISSION_DENIED', '当前身份没有上传集锦权限');
      }

      const highlightId = String(event.highlightId || '').trim();
      const inputMedia = normalizeHighlightMediaList(event.media);
      if (!highlightId) {
        return fail('REQUEST_PARAM_INVALID', '没有找到要保存的集锦包，请返回重试');
      }
      if (inputMedia.length > 9) {
        return fail('HIGHLIGHT_LIMIT_EXCEEDED', '单场最多保留 9 个集锦内容');
      }

      const existingHighlight = await getHighlightPackage(store, highlightId);
      if (!existingHighlight) {
        return fail('HIGHLIGHT_NOT_FOUND', '没有找到对应的集锦包，请先完成场次结算');
      }

      const sessionId = String(existingHighlight.sessionId || '').trim();
      if (sessionId) {
        const sessionDoc = await ensureSessionDoc(store, sessionId);
        if (!sessionDoc) {
          return fail('SESSION_NOT_FOUND', '对应场次不存在，请刷新后重试');
        }
        if (String(sessionDoc.stageKey || '') !== 'settled') {
          return fail('HIGHLIGHT_STAGE_INVALID', '请在场次结算后再上传集锦');
        }
      }

      const savedHighlight = await saveHighlightPackage(
        store,
        {
          ...existingHighlight,
          media: inputMedia,
        },
        binding
      );

      return {
        ok: true,
        highlight: await buildHighlightForClient(savedHighlight, binding),
        message: inputMedia.length ? '集锦已保存' : '集锦内容已清空',
      };
    }

    if (action === 'getAnalytics') {
      if (!(binding.permissions || []).includes('view_statistics')) {
        return fail('STAFF_PERMISSION_DENIED', '当前身份没有统计数据权限');
      }

      const allSessions = await listAll(store, 'staff_sessions');
      const settledSessions = allSessions.filter((s) => s.stageKey === 'settled');

      const now = Date.now();
      const week7Ms = 7 * 24 * 60 * 60 * 1000;
      const month30Ms = 30 * 24 * 60 * 60 * 1000;

      const sessionsThisWeek = settledSessions.filter(
        (s) => now - new Date(s.endedAt || s.updatedAt || 0).getTime() <= week7Ms
      );
      const sessionsThisMonth = settledSessions.filter(
        (s) => now - new Date(s.endedAt || s.updatedAt || 0).getTime() <= month30Ms
      );

      const themeMap = new Map();
      settledSessions.forEach((s) => {
        const theme = String(s.themeName || '未知主题');
        const current = themeMap.get(theme) || { theme, sessionCount: 0, totalPlayers: 0 };
        current.sessionCount += 1;
        current.totalPlayers += Number((s.members || []).length);
        themeMap.set(theme, current);
      });
      const themeBreakdown = Array.from(themeMap.values())
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, 10);

      const monthlyMap = new Map();
      settledSessions.forEach((s) => {
        const ts = new Date(new Date(s.endedAt || s.updatedAt || 0).getTime() + BEIJING_OFFSET_MS);
        const key = `${ts.getUTCFullYear()}-${String(ts.getUTCMonth() + 1).padStart(2, '0')}`;
        const current = monthlyMap.get(key) || { month: key, sessionCount: 0, playerCount: 0 };
        current.sessionCount += 1;
        current.playerCount += Number((s.members || []).length);
        monthlyMap.set(key, current);
      });
      const monthlyTrend = Array.from(monthlyMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6)
        .reverse()
        .map(([, data]) => data);

      const totalPlayers = settledSessions.reduce((sum, s) => sum + Number((s.members || []).length), 0);
      const avgTeamSize = settledSessions.length
        ? (totalPlayers / settledSessions.length).toFixed(1)
        : '0';

      return {
        ok: true,
        analytics: {
          summary: {
            totalSessions: settledSessions.length,
            sessionsThisWeek: sessionsThisWeek.length,
            sessionsThisMonth: sessionsThisMonth.length,
            avgTeamSize,
          },
          themeBreakdown,
          monthlyTrend,
        },
      };
    }

    return fail('UNKNOWN_ACTION', '未知操作类型');
  } catch (error) {
    const errorCodeMap = {
      '授权码生成失败，请重试': ['AUTH_CODE_GENERATE_FAILED', '授权码生成失败，请重试', true],
    };
    console.error('staffManage failed:', {
      message: error.message,
      stack: error.stack,
      action,
      openId,
    });
    const mapped = errorCodeMap[error.message];
    if (mapped) {
      return fail(mapped[0], mapped[1], mapped[2]);
    }
    return fail('INTERNAL_SERVICE_ERROR', '门店工作台处理失败，请稍后重试', true);
  }
};
