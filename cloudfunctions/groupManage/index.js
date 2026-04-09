'use strict';

const cloud = require('wx-server-sdk');
const groupDomain = require('./group-domain');
const {
  normalizeDataEnvTag,
  getCollectionName,
  stripInternalId,
} = require('./utils');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const DEFAULT_PROFILE_NICKNAME = '档案室常客';
const DEFAULT_PROFILE_SIGNATURE = '还没有留下签名，等你写下第一句档案备注。';
const DAY_MS = 24 * 60 * 60 * 1000;

function buildDefaultReputationMeta() {
  return {
    penaltyTotal: 0,
    creatorCancelCount: 0,
    creatorLateCancelCount: 0,
    recentCreatorCancelTimestamps: [],
    lastPenaltyAt: '',
    lastPenaltyReason: '',
    lastCancelWindowHours: 0,
  };
}

function normalizeReputationMeta(meta = {}) {
  const base = buildDefaultReputationMeta();
  return {
    penaltyTotal: Math.max(0, Number(meta.penaltyTotal || base.penaltyTotal)),
    creatorCancelCount: Math.max(0, Number(meta.creatorCancelCount || base.creatorCancelCount)),
    creatorLateCancelCount: Math.max(
      0,
      Number(meta.creatorLateCancelCount || base.creatorLateCancelCount)
    ),
    recentCreatorCancelTimestamps: Array.isArray(meta.recentCreatorCancelTimestamps)
      ? meta.recentCreatorCancelTimestamps
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      : [],
    lastPenaltyAt: String(meta.lastPenaltyAt || '').trim(),
    lastPenaltyReason: String(meta.lastPenaltyReason || '').trim(),
    lastCancelWindowHours: Math.max(0, Number(meta.lastCancelWindowHours || 0)),
  };
}

function getBeijingDaySerial(value) {
  const timestamp = new Date(value || '').getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 0;
  }
  return Math.floor((timestamp + 8 * 60 * 60 * 1000) / DAY_MS);
}

function computeReputationRecovery(meta = {}, now = Date.now()) {
  const reputationMeta = normalizeReputationMeta(meta);
  const lastPenaltyAt = String(reputationMeta.lastPenaltyAt || '').trim();
  if (!lastPenaltyAt) {
    return 0;
  }

  const todaySerial = getBeijingDaySerial(now);
  const penaltyDaySerial = getBeijingDaySerial(lastPenaltyAt);
  if (!todaySerial || !penaltyDaySerial || todaySerial <= penaltyDaySerial) {
    return 0;
  }

  const elapsedDays = todaySerial - penaltyDaySerial;
  const firstStage = Math.min(elapsedDays, 5);
  const secondStage = Math.min(Math.max(elapsedDays - 5, 0), 5) * 2;
  const thirdStage = Math.max(elapsedDays - 10, 0) * 5;
  return firstStage + secondStage + thirdStage;
}

function getProfilePlayCount(profile = {}) {
  const punchRecords = Array.isArray(profile.punchRecords) ? profile.punchRecords : [];
  if (punchRecords.length) {
    return punchRecords.length;
  }
  const playRecords = Array.isArray(profile.playRecords) ? profile.playRecords : [];
  if (playRecords.length) {
    return playRecords.length;
  }
  return Math.max(0, Number(profile.totalPlayCount || 0));
}

function computeReputationScore(profile = {}) {
  const cancelPenalty = Math.max(0, Number(profile.cancelCount || 0)) * 6;
  const reputationMeta = normalizeReputationMeta(profile.reputationMeta || {});
  const recovery = computeReputationRecovery(reputationMeta);
  return Math.max(
    0,
    Math.min(100, 100 - cancelPenalty - reputationMeta.penaltyTotal + recovery)
  );
}

function getReputationTier(score = 100) {
  const value = Math.max(0, Math.min(100, Number(score || 0)));
  if (value >= 80) {
    return { key: 'normal', label: '正常', allowCreate: true, allowJoin: true, needsApproval: false };
  }
  if (value >= 60) {
    return { key: 'warning', label: '警示', allowCreate: true, allowJoin: true, needsApproval: false };
  }
  if (value >= 40) {
    return { key: 'no_create', label: '限制创建', allowCreate: false, allowJoin: true, needsApproval: false };
  }
  if (value >= 20) {
    return { key: 'manual_review', label: '待审批', allowCreate: false, allowJoin: false, needsApproval: true };
  }
  return { key: 'blocked', label: '已封禁', allowCreate: false, allowJoin: false, needsApproval: false };
}

function getRecentCreatorCancelCount(reputationMeta = {}, now = Date.now()) {
  return normalizeReputationMeta(reputationMeta).recentCreatorCancelTimestamps.filter((item) => {
    const timestamp = new Date(item).getTime();
    return Number.isFinite(timestamp) && now - timestamp <= 30 * DAY_MS;
  }).length;
}

function buildCancelPenaltyPreview(group = {}, profile = {}) {
  const now = Date.now();
  const activeParticipants = Array.isArray(group.participants)
    ? group.participants.filter((item) => item.status === 'active')
    : [];
  const affectedMemberCount = activeParticipants.filter((item) => item.role !== 'creator').length;
  const currentScore = computeReputationScore(profile);
  const currentTier = getReputationTier(currentScore);
  if (affectedMemberCount <= 0) {
    return {
      shouldWarn: false,
      totalPenalty: 0,
      affectedMemberCount: 0,
      currentScore,
      nextScore: currentScore,
      currentTier,
      nextTier: currentTier,
      basePenalty: 0,
      timePenalty: 0,
      repeatPenalty: 0,
      hoursUntilStart: null,
      reasonText: '当前还没有其他玩家加入，取消不会触发信誉分惩罚。',
    };
  }

  const basePenalty =
    affectedMemberCount >= 5 ? 20 : affectedMemberCount >= 3 ? 15 : affectedMemberCount === 2 ? 10 : 6;
  const sortTime = Number(group.sortTime || 0);
  const hoursUntilStart =
    sortTime && sortTime > now ? (sortTime - now) / (60 * 60 * 1000) : 0;
  const timePenalty =
    hoursUntilStart <= 2 ? 12 : hoursUntilStart <= 6 ? 8 : hoursUntilStart <= 24 ? 4 : 0;
  const recentCancelCount = getRecentCreatorCancelCount(profile.reputationMeta || {}, now);
  const repeatPenalty = recentCancelCount >= 3 ? 5 : 0;
  const totalPenalty = basePenalty + timePenalty + repeatPenalty;
  const nextScore = Math.max(0, currentScore - totalPenalty);

  return {
    shouldWarn: true,
    totalPenalty,
    affectedMemberCount,
    currentScore,
    nextScore,
    currentTier,
    nextTier: getReputationTier(nextScore),
    basePenalty,
    timePenalty,
    repeatPenalty,
    hoursUntilStart: Number.isFinite(hoursUntilStart) ? Math.max(0, Math.round(hoursUntilStart * 10) / 10) : null,
    reasonText:
      timePenalty > 0
        ? '当前队伍已有其他玩家加入，且距离开场较近，取消会扣减信誉分。'
        : '当前队伍已有其他玩家加入，取消会扣减信誉分。',
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

function sanitizeProfileText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeProfilePhone(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 11);
}

function buildParticipantProfileDoc(openId, participant = {}, currentProfile = null) {
  const now = new Date().toISOString();
  const existing = currentProfile && typeof currentProfile === 'object' ? currentProfile : {};
  const seededNickname = sanitizeProfileText(participant.contactName, 12);
  const currentNickname = sanitizeProfileText(existing.nickname, 12);
  const currentPhone = normalizeProfilePhone(existing.contactPhone);
  const seededPhone = normalizeProfilePhone(participant.contactPhone);

  return {
    ...existing,
    _id: String(openId || ''),
    nickname:
      (!currentNickname || currentNickname === DEFAULT_PROFILE_NICKNAME) && seededNickname
        ? seededNickname
        : currentNickname || seededNickname || DEFAULT_PROFILE_NICKNAME,
    contactPhone: currentPhone || seededPhone || '',
    avatarUrl: String(existing.avatarUrl || '').trim(),
    signature:
      sanitizeProfileText(existing.signature, 40) || DEFAULT_PROFILE_SIGNATURE,
    gender: ['male', 'female', 'not_set'].includes(String(existing.gender || ''))
      ? existing.gender
      : 'not_set',
    recentThemes: Array.isArray(existing.recentThemes) ? existing.recentThemes : [],
    redeemedCodes: Array.isArray(existing.redeemedCodes) ? existing.redeemedCodes : [],
    punchRecords: Array.isArray(existing.punchRecords) ? existing.punchRecords : [],
    perks: Array.isArray(existing.perks) ? existing.perks : [],
    createdAt: existing.createdAt || now,
    updatedAt: now,
    cancelCount: Math.max(0, Number(existing.cancelCount || 0)),
    reputationMeta: normalizeReputationMeta(existing.reputationMeta || {}),
    reputationScore: computeReputationScore(existing),
  };
}

async function ensureParticipantProfile(profileCollectionName, participant = {}) {
  const openId = String(participant.openId || '').trim();
  if (!openId) {
    return;
  }

  const profileRef = db.collection(profileCollectionName).doc(openId);
  let currentProfile = null;
  try {
    const result = await profileRef.get();
    currentProfile = result && result.data ? result.data : null;
  } catch (error) {
    currentProfile = null;
  }

  const nextProfile = buildParticipantProfileDoc(openId, participant, currentProfile);
  const shouldSync =
    !currentProfile ||
    String(nextProfile.nickname || '') !== String(currentProfile.nickname || '') ||
    String(nextProfile.contactPhone || '') !== String(currentProfile.contactPhone || '') ||
    String(nextProfile.signature || '') !== String(currentProfile.signature || '') ||
    String(nextProfile.gender || '') !== String(currentProfile.gender || '') ||
    !currentProfile.createdAt;

  if (!shouldSync) {
    return;
  }

  await profileRef.set({
    data: stripInternalId(nextProfile),
  });
}

async function getProfileForAction(profileCollectionName, openId, participant = {}) {
  const normalizedOpenId = String(openId || '').trim();
  if (!normalizedOpenId) {
    return buildParticipantProfileDoc('', participant, null);
  }
  const profileRef = db.collection(profileCollectionName).doc(normalizedOpenId);
  try {
    const result = await profileRef.get();
    return buildParticipantProfileDoc(normalizedOpenId, participant, result && result.data ? result.data : null);
  } catch (error) {
    return buildParticipantProfileDoc(normalizedOpenId, participant, null);
  }
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
    console.warn('buildTempFileUrlMap failed:', {
      count: normalizedFileIds.length,
      message: error && error.message,
    });
    return new Map();
  }
}

function buildGroupId() {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dedupeDocsById(docs = []) {
  const seen = new Set();
  const unique = [];
  (Array.isArray(docs) ? docs : []).forEach((doc) => {
    const id = String((doc && doc._id) || '').trim();
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    unique.push(doc);
  });
  return unique;
}

function resolveSessionGroupId(sessionDoc = {}) {
  const directGroupId = String(sessionDoc.groupId || '').trim();
  if (directGroupId) {
    return directGroupId;
  }

  const sessionId = String(sessionDoc._id || '').trim();
  if (sessionId.startsWith('session-')) {
    return sessionId.replace(/^session-/, '');
  }

  return '';
}

async function listRelevantSessionDocs(store, thresholdMs) {
  const recentIso = new Date(thresholdMs).toISOString();
  const [activeResult, recentSettledResult] = await Promise.all([
    store
      .collection('staff_sessions')
      .where({
        stageKey: db.command.in(['pending_confirm', 'ready', 'playing']),
      })
      .limit(200)
      .get(),
    store
      .collection('staff_sessions')
      .where({
        stageKey: 'settled',
        updatedAt: db.command.gte(recentIso),
      })
      .limit(100)
      .get(),
  ]);

  return dedupeDocsById((activeResult.data || []).concat(recentSettledResult.data || []));
}

async function buildSessionMap(store, thresholdMs) {
  const sessions = await listRelevantSessionDocs(store, thresholdMs);
  return sessions.reduce((map, item) => {
    const groupId = resolveSessionGroupId(item);
    if (groupId) {
      map.set(groupId, item);
    }
    return map;
  }, new Map());
}

async function listGroupsByIds(store, groupIds = []) {
  const normalizedGroupIds = Array.from(
    new Set((groupIds || []).map((item) => String(item || '').trim()).filter(Boolean))
  );
  if (!normalizedGroupIds.length) {
    return [];
  }

  const batchSize = 20;
  const jobs = [];
  for (let offset = 0; offset < normalizedGroupIds.length; offset += batchSize) {
    jobs.push(
      store
        .collection('groups')
        .where({
          _id: db.command.in(normalizedGroupIds.slice(offset, offset + batchSize)),
        })
        .get()
    );
  }

  const results = await Promise.all(jobs);
  return results.reduce((list, item) => list.concat(item.data || []), []);
}

async function listProfilesByIds(store, openIds = []) {
  const normalizedOpenIds = Array.from(
    new Set((openIds || []).map((item) => String(item || '').trim()).filter(Boolean))
  );
  if (!normalizedOpenIds.length) {
    return [];
  }

  const batchSize = 20;
  const jobs = [];
  for (let offset = 0; offset < normalizedOpenIds.length; offset += batchSize) {
    jobs.push(
      store
        .collection('profiles')
        .where({
          _id: db.command.in(normalizedOpenIds.slice(offset, offset + batchSize)),
        })
        .get()
    );
  }

  const results = await Promise.all(jobs);
  return results.reduce((list, item) => list.concat(item.data || []), []);
}

function isRecentSettledGroup(groupDoc = {}, thresholdMs) {
  const updatedAt = new Date(groupDoc.updatedAt || groupDoc.createdAt || 0).getTime();
  return Boolean(updatedAt) && updatedAt >= thresholdMs;
}

async function getSessionDocByGroupId(store, groupId = '', groupDoc = {}) {
  return getSessionDocByGroupIdFromAccessor(
    (baseCollectionName) => store.collection(baseCollectionName),
    groupId,
    groupDoc
  );
}

async function getSessionDocByGroupIdFromAccessor(collectionAccessor, groupId = '', groupDoc = {}) {
  const normalizedGroupId = String(groupId || '').trim();
  if (!normalizedGroupId) {
    return null;
  }

  const candidateSessionIds = Array.from(
    new Set(
      [String(groupDoc.sessionId || '').trim(), `session-${normalizedGroupId}`].filter(Boolean)
    )
  );

  for (const sessionId of candidateSessionIds) {
    try {
      const result = await collectionAccessor('staff_sessions').doc(sessionId).get();
      if (result && result.data) {
        return result.data;
      }
    } catch (error) {
      // ignore missing doc and continue fallback lookup
    }
  }

  try {
    const result = await collectionAccessor('staff_sessions')
      .where({
        groupId: normalizedGroupId,
      })
      .limit(1)
      .get();
    return result && result.data && result.data.length ? result.data[0] : null;
  } catch (error) {
    return null;
  }
}

async function getAuthoritativeGroupDocInTransaction(transaction, store, groupId, rawGroupDoc = {}) {
  const sessionDoc = await getSessionDocByGroupIdFromAccessor(
    (baseCollectionName) => transaction.collection(store.collectionName(baseCollectionName)),
    groupId,
    rawGroupDoc
  );
  return groupDomain.mergeGroupDocWithSession(rawGroupDoc || {}, sessionDoc);
}

async function listAllGroups(store) {
  const collection = store.collection('groups');
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const [activeResult, recentResult, sessionMap] = await Promise.all([
    collection
      .where({
        roomStage: db.command.nin(['settled', 'archived']),
      })
      .limit(200)
      .get(),
    collection
      .where({
        roomStage: db.command.in(['settled', 'archived']),
        updatedAt: db.command.gte(new Date(thirtyDaysAgoMs).toISOString()),
      })
      .limit(100)
      .get(),
    buildSessionMap(store, thirtyDaysAgoMs),
  ]);

  const unique = dedupeDocsById((activeResult.data || []).concat(recentResult.data || []));
  const seen = new Set(unique.map((doc) => String((doc && doc._id) || '').trim()).filter(Boolean));

  const missingSessionLinkedGroupIds = Array.from(sessionMap.keys()).filter((groupId) => !seen.has(groupId));
  if (missingSessionLinkedGroupIds.length) {
    const extraDocs = await listGroupsByIds(store, missingSessionLinkedGroupIds);
    extraDocs.forEach((doc) => {
      const id = String(doc._id || '');
      if (id && !seen.has(id)) {
        seen.add(id);
        unique.push(doc);
      }
    });
  }

  const mergedDocs = unique
    .map((doc) =>
      groupDomain.mergeGroupDocWithSession(doc, sessionMap.get(String(doc._id || '')) || null)
    )
    .filter((doc) => {
      const roomStage = String(doc.roomStage || '').trim();
      if (roomStage === 'settled' || roomStage === 'archived') {
        return isRecentSettledGroup(doc, thirtyDaysAgoMs);
      }
      return true;
    });

  return groupDomain.sortGroups(mergedDocs.map(groupDomain.normalizeGroupDoc));
}

async function getUserActiveGroup(store, openId) {
  const groups = await listAllGroups(store);
  const matched = groups.find((group) =>
    (group.participants || []).some(
      (item) =>
        item.openId === openId &&
        item.status === 'active' &&
        groupDomain.isGroupActiveForParticipation(group)
    )
  );
  return matched || null;
}

async function buildListResponse(store, openId, extra = {}) {
  const groups = await listAllGroups(store);
  const normalizedOpenId = String(openId || '');
  const visibleGroups = groups.filter((group) => {
    const hiddenForViewer = (group.hiddenForOpenIds || []).includes(normalizedOpenId);
    if (!hiddenForViewer) {
      return true;
    }
    const viewerParticipation = (group.participants || []).find(
      (item) => String(item.openId || '').trim() === normalizedOpenId
    );
    const isActiveViewer =
      Boolean(viewerParticipation) &&
      viewerParticipation.status === 'active' &&
      groupDomain.isGroupActiveForParticipation(group);
    return group.status === 'recruiting' && !isActiveViewer;
  });
  const participation = groupDomain.buildMyParticipation(visibleGroups, openId);
  return {
    ok: true,
    groups: visibleGroups.map((group) => groupDomain.toGroupListItem(group, openId)),
    activeGroup: participation.activeGroup,
    recentGroup: participation.recentGroup,
    ...extra,
  };
}

async function handleCreateGroup(store, event, openId) {
  const validateResult = groupDomain.validateCreatePayload(event.payload || {});
  if (!validateResult.ok) {
    return validateResult;
  }

  const profile = await getProfileForAction(store.collectionName('profiles'), openId, {
    openId,
    contactName: validateResult.payload.contactName,
    contactPhone: validateResult.payload.contactPhone,
  });
  const reputationScore = computeReputationScore(profile);
  const reputationTier = getReputationTier(reputationScore);
  if (!reputationTier.allowCreate) {
    return fail(
      'REPUTATION_CREATE_FORBIDDEN',
      reputationScore < 20
        ? '当前信誉分过低，已禁止创建队伍，请联系门店人工处理'
        : '当前信誉分低于 60，暂时不能发起新队伍'
    );
  }

  const activeGroup = await getUserActiveGroup(store, openId);
  if (activeGroup) {
    return fail(
      'GROUP_ALREADY_ACTIVE',
      `你已经在参与「${activeGroup.themeName || '当前组局'}」，请先结束这场后再发起新的组局`
    );
  }

  const now = new Date().toISOString();
  const payload = validateResult.payload;
  const groupId = buildGroupId();
  const nextGroup = groupDomain.normalizeGroupDoc({
    _id: groupId,
    ...payload,
    creatorOpenId: openId,
    creatorName: payload.contactName,
    participants: [
      {
        openId,
        contactName: payload.contactName,
        contactPhone: payload.contactPhone,
        role: 'creator',
        status: 'active',
        joinedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  });

  const existingQuery = await db
    .collection(store.collectionName('groups'))
    .where({
      creatorOpenId: openId,
    })
    .get();
  const hasActive = (existingQuery.data || []).some((doc) =>
    groupDomain.isGroupActiveForParticipation(groupDomain.normalizeGroupDoc(doc))
  );
  if (hasActive) {
    return fail(
      'GROUP_ALREADY_ACTIVE',
      `你已经在参与「${activeGroup && activeGroup.themeName ? activeGroup.themeName : '当前组局'}」，请先结束这场后再发起新的组局`
    );
  }

  await db
    .collection(store.collectionName('groups'))
    .doc(groupId)
    .set({
      data: stripInternalId(nextGroup),
    });

  await ensureParticipantProfile(store.collectionName('profiles'), {
    openId,
    contactName: payload.contactName,
    contactPhone: payload.contactPhone,
  });

  return buildListResponse(store, openId, {
    message: '组局已发布，列表已更新',
    group: groupDomain.toGroupListItem(nextGroup),
  });
}

async function handleJoinGroup(store, event, openId) {
  const validateResult = groupDomain.validateJoinPayload(event.payload || {});
  if (!validateResult.ok) {
    return validateResult;
  }

  const profile = await getProfileForAction(store.collectionName('profiles'), openId, {
    openId,
    contactName: validateResult.payload.contactName,
    contactPhone: validateResult.payload.contactPhone,
  });
  const reputationScore = computeReputationScore(profile);
  const reputationTier = getReputationTier(reputationScore);
  if (!reputationTier.allowJoin) {
    return fail(
      reputationScore < 20 ? 'REPUTATION_JOIN_BLOCKED' : 'REPUTATION_JOIN_REVIEW_REQUIRED',
      reputationScore < 20
        ? '当前信誉分过低，已禁止加入队伍，请联系门店人工处理'
        : '当前信誉分低于 40，加入队伍需房主或门店人工审批'
    );
  }

  const groupId = String(event.groupId || '');
  if (!groupId) {
    return fail('GROUP_NOT_FOUND', '组局不存在或已下架，请刷新后重试');
  }

  const activeGroup = await getUserActiveGroup(store, openId);
  if (activeGroup && activeGroup._id !== groupId) {
    return fail(
      'GROUP_ALREADY_ACTIVE',
      `你已经在参与「${activeGroup.themeName || '当前组局'}」，不能再加入其他组局`
    );
  }

  const joinResult = await db
    .runTransaction(async (transaction) => {
      const groupRef = transaction.collection(store.collectionName('groups')).doc(groupId);
      const result = await groupRef.get();
      if (!result.data) {
        throw new Error('group-not-found');
      }

      const authoritativeGroupDoc = await getAuthoritativeGroupDocInTransaction(
        transaction,
        store,
        groupId,
        result.data || {}
      );
      const group = groupDomain.normalizeGroupDoc(authoritativeGroupDoc);
      if (group.status === 'cancelled') {
        throw new Error('group-cancelled');
      }
      if (
        group.roomStage === 'settled' ||
        group.roomStage === 'archived' ||
        group.roomStage === 'playing'
      ) {
        throw new Error('group-full');
      }
      if (Number(group.currentPeople || 0) >= Number(group.targetPeople || 0)) {
        throw new Error('group-full');
      }

      const duplicatedByUser = (group.participants || []).find(
        (item) => item.openId === openId && item.status === 'active'
      );
      if (duplicatedByUser) {
        return {
          group,
          joinState: 'duplicate',
        };
      }

      const duplicatedByPhone = (group.participants || []).find(
        (item) =>
          item.status === 'active' &&
          validateResult.payload.contactPhone &&
          item.contactPhone === validateResult.payload.contactPhone
      );
      if (duplicatedByPhone) {
        throw new Error('phone-duplicated');
      }

      const participants = (group.participants || []).concat({
        openId,
        contactName: validateResult.payload.contactName,
        contactPhone: validateResult.payload.contactPhone,
        role: 'member',
        status: 'active',
        joinedAt: new Date().toISOString(),
      });
      const currentPeople = participants.filter((item) => item.status !== 'left').length;
      const nextGroup = groupDomain.normalizeGroupDoc({
        ...group,
        currentPeople,
        participants,
        status: groupDomain.computeGroupStatus(
          currentPeople,
          group.targetPeople,
          group.status,
          group.roomStage
        ),
        updatedAt: new Date().toISOString(),
      });

      await groupRef.set({
        data: stripInternalId(nextGroup),
      });

      return {
        group: nextGroup,
        joinState: 'joined',
      };
    })
    .catch((error) => {
      if (error && error.message) {
        throw error;
      }
      throw new Error('join-failed');
    });

  if (joinResult.joinState === 'joined') {
    await ensureParticipantProfile(store.collectionName('profiles'), {
      openId,
      contactName: validateResult.payload.contactName,
      contactPhone: validateResult.payload.contactPhone,
    });
  }

  const updatedGroup = joinResult.group;
  const message =
    joinResult.joinState === 'duplicate'
      ? '你已经在这个组局里了'
      : updatedGroup.status === 'pending_store_confirm'
      ? '加入成功！这场刚好凑满，等店家确认'
      : '加入成功，店员会跟进拼场进度';

  return buildListResponse(store, openId, {
    message,
    group: groupDomain.toGroupListItem(updatedGroup),
  });
}

async function handlePreviewCancelPenalty(store, event, openId) {
  const groupId = String(event.groupId || '').trim();
  if (!groupId) {
    return fail('GROUP_NOT_FOUND', '没有找到要取消的队伍');
  }
  let result = null;
  try {
    result = await store.collection('groups').doc(groupId).get();
  } catch (error) {
    return fail('GROUP_NOT_FOUND', '没有找到要取消的队伍');
  }
  const sessionDoc = await getSessionDocByGroupId(store, groupId, result.data || {});
  const mergedGroupDoc = groupDomain.mergeGroupDocWithSession(result.data || {}, sessionDoc);
  const group = groupDomain.normalizeGroupDoc(mergedGroupDoc || {});
  if (!group._id) {
    return fail('GROUP_NOT_FOUND', '没有找到要取消的队伍');
  }
  if (String(group.creatorOpenId || '').trim() !== String(openId || '').trim()) {
    return fail('GROUP_CANCEL_FORBIDDEN', '只有发起人可以预览取消惩罚');
  }
  const profile = await getProfileForAction(store.collectionName('profiles'), openId, {
    openId,
    contactName: group.contactName,
    contactPhone: group.contactPhone,
  });
  return {
    ok: true,
    preview: buildCancelPenaltyPreview(group, profile),
  };
}

async function incrementCancelCount(profileCollectionName, openId) {
  if (!openId) {
    return;
  }
  try {
    await db.collection(profileCollectionName).doc(openId).update({
      data: {
        cancelCount: db.command.inc(1),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    // profile may not exist yet; non-critical, ignore
  }
}

async function handleCancelActiveGroup(store, openId, groupId = '', reason = '') {
  const normalizedGroupId = String(groupId || '').trim();
  const activeGroup = await getUserActiveGroup(store, openId);
  const targetGroupId = normalizedGroupId || (activeGroup && activeGroup._id) || '';
  if (!targetGroupId) {
    return fail('GROUP_NOT_FOUND', '当前没有可取消的组局');
  }

  const creatorProfile = await getProfileForAction(store.collectionName('profiles'), openId, {
    openId,
    contactName: (activeGroup && activeGroup.contactName) || '',
    contactPhone: (activeGroup && activeGroup.contactPhone) || '',
  });

  const cancelResult = await db.runTransaction(async (transaction) => {
    const groupRef = transaction.collection(store.collectionName('groups')).doc(targetGroupId);
    const result = await groupRef.get();
    const authoritativeGroupDoc = await getAuthoritativeGroupDocInTransaction(
      transaction,
      store,
      targetGroupId,
      result.data || {}
    );
    const group = groupDomain.normalizeGroupDoc(authoritativeGroupDoc || {});
    if (!group._id) {
      throw new Error('group-not-found');
    }

    if (group.status === 'cancelled') {
      return {
        ok: true,
        changed: false,
        isCreator: false,
        message: '这场组局已经被取消了',
      };
    }

    if (group.roomStage === 'settled' || group.roomStage === 'archived') {
      return {
        ok: true,
        changed: false,
        isCreator: false,
        message: '这场组局已经结算完成，无法取消',
      };
    }

    if (group.roomStage === 'playing') {
      return {
        ok: true,
        changed: false,
        isCreator: false,
        message: '这场组局正在进行中，无法退出',
      };
    }

    const participant = (group.participants || []).find(
      (item) => item.openId === openId && item.status === 'active'
    );

    const isCreator =
      group.creatorOpenId === openId || (participant && participant.role === 'creator');
    if (!participant && !isCreator) {
      console.warn('cancelActiveGroup participant missing', {
        openId,
        targetGroupId,
        creatorOpenId: group.creatorOpenId,
        participantCount: (group.participants || []).length,
      });
      return {
        ok: true,
        changed: false,
        isCreator: false,
        message: '你不在这个组局中，列表已刷新',
      };
    }

    let nextGroup = null;
    let penaltyPreview = null;
    if (isCreator) {
      penaltyPreview = buildCancelPenaltyPreview(group, creatorProfile);
      nextGroup = groupDomain.normalizeGroupDoc({
        ...group,
        status: 'cancelled',
        note: `发起人已取消该组局。${group.note ? ` ${group.note}` : ''}`.trim(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      const participants = (group.participants || []).map((item) =>
        item.openId === openId && item.status === 'active'
          ? {
              ...item,
              status: 'left',
              leftAt: new Date().toISOString(),
              leftReason: String(reason || '').trim(),
            }
          : item
      );
      const currentPeople = Math.max(
        0,
        participants.filter((item) => item.status !== 'left').length
      );
      nextGroup = groupDomain.normalizeGroupDoc({
        ...group,
        currentPeople,
        participants,
        status: groupDomain.computeGroupStatus(
          currentPeople,
          group.targetPeople,
          group.status,
          group.roomStage
        ),
        updatedAt: new Date().toISOString(),
      });
    }

    await groupRef.set({
      data: stripInternalId(nextGroup),
    });

    return {
      ok: true,
      changed: true,
      isCreator,
      penaltyPreview,
      message: isCreator ? '组局已取消' : '你已退出该组局',
    };
  });

  const listResponse = await buildListResponse(store, openId);

  if (cancelResult.changed && !cancelResult.isCreator) {
    await incrementCancelCount(store.collectionName('profiles'), openId);
  }

  if (
    cancelResult.changed &&
    cancelResult.isCreator &&
    cancelResult.penaltyPreview &&
    Number(cancelResult.penaltyPreview.totalPenalty || 0) > 0
  ) {
    const now = new Date().toISOString();
    const currentMeta = normalizeReputationMeta(creatorProfile.reputationMeta || {});
    const nextRecentTimestamps = currentMeta.recentCreatorCancelTimestamps
      .filter((item) => {
        const timestamp = new Date(item).getTime();
        return Number.isFinite(timestamp) && Date.now() - timestamp <= 30 * DAY_MS;
      })
      .concat(now)
      .slice(-10);
    const nextReputationMeta = {
      ...currentMeta,
      penaltyTotal: currentMeta.penaltyTotal + Number(cancelResult.penaltyPreview.totalPenalty || 0),
      creatorCancelCount: currentMeta.creatorCancelCount + 1,
      creatorLateCancelCount:
        currentMeta.creatorLateCancelCount +
        (Number(cancelResult.penaltyPreview.timePenalty || 0) > 0 ? 1 : 0),
      recentCreatorCancelTimestamps: nextRecentTimestamps,
      lastPenaltyAt: now,
      lastPenaltyReason: 'creator_cancel_group',
      lastCancelWindowHours: Number(cancelResult.penaltyPreview.hoursUntilStart || 0),
    };
    const nextReputationScore = computeReputationScore({
      ...creatorProfile,
      reputationMeta: nextReputationMeta,
    });
    try {
      await db.collection(store.collectionName('profiles')).doc(openId).update({
        data: {
          reputationMeta: nextReputationMeta,
          reputationScore: nextReputationScore,
          updatedAt: now,
        },
      });
    } catch (updateError) {
      try {
        const nextProfile = buildParticipantProfileDoc(
          openId,
          {
            openId,
            contactName: creatorProfile.nickname || creatorProfile.contactName || '',
            contactPhone: creatorProfile.contactPhone || '',
          },
          {
            ...creatorProfile,
            reputationMeta: nextReputationMeta,
            reputationScore: nextReputationScore,
            updatedAt: now,
          }
        );
        await db.collection(store.collectionName('profiles')).doc(openId).set({
          data: stripInternalId(nextProfile),
        });
      } catch (error) {
        console.error('creator cancel penalty profile update failed:', {
          openId,
          targetGroupId,
          message: error.message,
        });
      }
    }
  }

  return {
    ...listResponse,
    ok: true,
    penaltyPreview: cancelResult.penaltyPreview || null,
    message:
      cancelResult.penaltyPreview && Number(cancelResult.penaltyPreview.totalPenalty || 0) > 0
        ? `${cancelResult.message || '组局已取消'}，信誉分 -${cancelResult.penaltyPreview.totalPenalty}`
        : cancelResult.message || (cancelResult.isCreator ? '组局已取消' : '你已退出该组局'),
  };
}

async function handleDeleteGroupRecord(store, event, openId) {
  const groupId = String(event.groupId || '');
  if (!groupId) {
    return fail('REQUEST_PARAM_INVALID', '没有找到要删除的队伍');
  }

  const groupRef = store.collection('groups').doc(groupId);
  let group = null;
  try {
    const result = await groupRef.get();
    const sessionDoc = await getSessionDocByGroupId(store, groupId, result.data || {});
    const mergedGroupDoc = groupDomain.mergeGroupDocWithSession(result.data || {}, sessionDoc);
    group = groupDomain.normalizeGroupDoc(mergedGroupDoc || {});
  } catch (error) {
    group = null;
  }

  if (!group || !group._id) {
    return fail('GROUP_NOT_FOUND', '这条队伍记录已经不存在了');
  }

  const normalizedOpenId = String(openId || '');
  const viewerParticipation = (group.participants || []).find(
    (item) => item.openId === normalizedOpenId
  );
  const viewerRelated = group.creatorOpenId === normalizedOpenId || Boolean(viewerParticipation);
  if (!viewerRelated) {
    return fail('GROUP_DELETE_FORBIDDEN', '只有相关队员才能删除这条记录');
  }

  const viewerCanDeleteByRelation = Boolean(
    viewerParticipation &&
    (
      viewerParticipation.status !== 'active' ||
      group.status === 'cancelled' ||
      group.roomStage === 'settled' ||
      group.roomStage === 'archived'
    )
  );

  const creatorCanDeleteCancelled = Boolean(
    group.creatorOpenId === normalizedOpenId &&
    (
      group.status === 'cancelled' ||
      group.roomStage === 'settled' ||
      group.roomStage === 'archived'
    )
  );

  if (
    !groupDomain.isGroupRecordDeletable(group) &&
    !viewerCanDeleteByRelation &&
    !creatorCanDeleteCancelled
  ) {
    return fail('GROUP_DELETE_FORBIDDEN', '进行中的队伍不能直接删除');
  }

  const hiddenForOpenIds = Array.from(
    new Set([].concat(group.hiddenForOpenIds || [], normalizedOpenId).filter(Boolean))
  );

  await groupRef.update({
    data: {
      hiddenForOpenIds,
      updatedAt: new Date().toISOString(),
    },
  });

  return {
    ...(await buildListResponse(store, openId)),
    message: '队伍记录已删除',
  };
}

async function handleGetTeamRoom(store, event, openId) {
  const groupId = String(event.groupId || '');
  if (!groupId) {
    return fail('REQUEST_PARAM_INVALID', '队伍信息缺失，请返回重试');
  }

  try {
    const result = await store.collection('groups').doc(groupId).get();
    const sessionDoc = await getSessionDocByGroupId(store, groupId, result.data || {});
    const mergedGroupDoc = groupDomain.mergeGroupDocWithSession(result.data || {}, sessionDoc);
    const group = groupDomain.normalizeGroupDoc(mergedGroupDoc || {});
    if (!group._id) {
      return fail('GROUP_NOT_FOUND', '没有找到这支队伍，请返回大厅重新选择');
    }
    if ((group.hiddenForOpenIds || []).includes(String(openId || ''))) {
      return fail('GROUP_DELETE_FORBIDDEN', '这条队伍记录已经被你删除了，请返回大厅重新选择');
    }

    let highlights = [];
    const sessionId = String(
      group.sessionId || groupDocSessionId(mergedGroupDoc || result.data || {}) || ''
    ).trim();
    if (sessionId) {
      const highlightId = `highlight-${sessionId}`;
      try {
        const highlightResult = await store.collection('staff_highlights').doc(highlightId).get();
        const highlightDoc = highlightResult && highlightResult.data ? highlightResult.data : null;
        const mediaList = Array.isArray(highlightDoc && highlightDoc.media) ? highlightDoc.media : [];
        const tempFileUrlMap = await buildTempFileUrlMap(
          mediaList.map((item) => item.fileId || item.fileID || '')
        );
        highlights = mediaList.map((item) => ({
              id: item.id || '',
              type: item.type || 'image',
              title: item.title || '集锦内容',
              fileId: item.fileId || '',
              previewUrl: tempFileUrlMap.get(String(item.fileId || item.fileID || '').trim()) || '',
            }));
      } catch (error) {
        highlights = [];
      }
    }

    const roomData = groupDomain.buildTeamRoom(mergedGroupDoc || group, openId, highlights);
    const memberOpenIds = (roomData.members || [])
      .map((m) => String(m.openId || '').trim())
      .filter(Boolean);
    const reputationMap = new Map();
    const profileMap = new Map();
    if (memberOpenIds.length) {
      const profiles = await listProfilesByIds(store, memberOpenIds);
      profiles.forEach((profile) => {
        const openId = String((profile && profile._id) || '').trim();
        if (!openId) {
          return;
        }
        profileMap.set(openId, profile);
        reputationMap.set(openId, computeReputationScore(profile));
      });
    }
    const avatarUrlMap = await buildTempFileUrlMap(
      Array.from(profileMap.values())
        .map((item) => String((item && item.avatarUrl) || '').trim())
        .filter((item) => item.startsWith('cloud://'))
    );

    return {
      ok: true,
      room: {
        ...roomData,
        members: (roomData.members || []).map((m) => ({
          ...m,
          playerCard: (() => {
            const profile = profileMap.get(String(m.openId || '')) || null;
            const nickname = String(m.nickname || '玩家').trim() || '玩家';
            const rawAvatarUrl = String((profile && profile.avatarUrl) || '').trim();
            return {
              nickname,
              avatarUrl: rawAvatarUrl.startsWith('cloud://')
                ? avatarUrlMap.get(rawAvatarUrl) || ''
                : rawAvatarUrl,
              avatarText: nickname.slice(0, 1),
              signature:
                String((profile && profile.signature) || '').trim() ||
                DEFAULT_PROFILE_SIGNATURE,
              gender: ['male', 'female', 'not_set'].includes(
                String((profile && profile.gender) || '')
              )
                ? String(profile.gender || '')
                : 'not_set',
              genderText:
                String((profile && profile.gender) || '') === 'male'
                  ? '男'
                  : String((profile && profile.gender) || '') === 'female'
                    ? '女'
                    : '未设置',
              titleLabel: String((profile && profile.titleLabel) || '').trim(),
              honorLabels: Array.isArray(profile && profile.displayLabels)
                ? profile.displayLabels.slice(0, 3)
                : [],
              totalPlayCount: profile ? getProfilePlayCount(profile) : 0,
              badgeCount: Number((profile && profile.badgeCount) || 0),
              growthValue: Number((profile && profile.growthValue) || 0),
              summaryText: `已通关 ${profile ? getProfilePlayCount(profile) : 0} 次 · 成长值 ${Number((profile && profile.growthValue) || 0)}`,
            };
          })(),
          reputationScore: reputationMap.has(String(m.openId || ''))
            ? reputationMap.get(String(m.openId || ''))
            : 100,
        })),
      },
    };
  } catch (error) {
    console.error('getTeamRoom failed:', {
      message: error.message,
      stack: error.stack,
      groupId,
      openId,
    });
    return {
      ok: false,
      errorCode: 'GROUP_ROOM_LOAD_FAILED',
      message: '队伍房间加载失败，请稍后重试',
      retryable: true,
    };
  }
}

function groupDocSessionId(groupDoc = {}) {
  return groupDoc && groupDoc.sessionId ? String(groupDoc.sessionId || '') : '';
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

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const store = createStore(normalizeDataEnvTag(event.__dataEnvTag));

  if (!openId) {
    return fail('AUTH_OPENID_MISSING', '当前身份校验失败，请重新进入小程序后再试');
  }

  try {
    const action = String(event.action || '').trim();
    if (action === 'listGroups') {
      return buildListResponse(store, openId);
    }
    if (action === 'createGroup') {
      return handleCreateGroup(store, event, openId);
    }
    if (action === 'joinGroup') {
      return handleJoinGroup(store, event, openId);
    }
    if (action === 'previewCancelPenalty') {
      return handlePreviewCancelPenalty(store, event, openId);
    }
    if (action === 'cancelActiveGroup') {
      return handleCancelActiveGroup(store, openId, event.groupId, event.reason);
    }
    if (action === 'deleteGroupRecord') {
      return handleDeleteGroupRecord(store, event, openId);
    }
    if (action === 'getTeamRoom') {
      return handleGetTeamRoom(store, event, openId);
    }

    return fail('UNKNOWN_ACTION', '未知操作类型');
  } catch (error) {
    const errorCodeMap = {
      'group-not-found': ['GROUP_NOT_FOUND', '组局不存在或已下架，请刷新后重试', false],
      'group-cancelled': ['GROUP_CANCELLED', '这场组局已经取消了', false],
      'group-full': ['GROUP_FULL', '这个组局已经满员了', false],
      'group-already-active': ['GROUP_ALREADY_ACTIVE', '你已经在参与其他组局，请先结束后再发起新的组局', false],
      'phone-duplicated': ['GROUP_PHONE_DUPLICATED', '这个手机号已经报过这场组局了', false],
      'participant-not-found': ['GROUP_STATE_INVALID', '当前参与关系已失效，请刷新后重试', false],
      'create-reputation-forbidden': ['REPUTATION_CREATE_FORBIDDEN', '当前信誉分不允许发起新队伍', false],
    };

    console.error('groupManage failed:', {
      message: error.message,
      stack: error.stack,
      action: event.action,
      openId,
    });

    const mapped = errorCodeMap[error.message];
    if (mapped) {
      return fail(mapped[0], mapped[1], mapped[2]);
    }
    return fail('INTERNAL_SERVICE_ERROR', '组队服务处理失败，请稍后重试', true);
  }
};
