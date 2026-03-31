'use strict';

const cloud = require('wx-server-sdk');
const groupDomain = require('./group-domain');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

function stripInternalId(doc = {}) {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  const nextDoc = {
    ...doc,
  };
  delete nextDoc._id;
  return nextDoc;
}

function buildGroupId() {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function listAllGroups() {
  const collection = db.collection('groups');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const activeResult = await collection
    .where({
      roomStage: db.command.nin(['settled', 'archived']),
    })
    .limit(200)
    .get();

  const recentResult = await collection
    .where({
      roomStage: db.command.in(['settled', 'archived']),
      updatedAt: db.command.gte(thirtyDaysAgo),
    })
    .limit(100)
    .get();

  const allDocs = (activeResult.data || []).concat(recentResult.data || []);
  const seen = new Set();
  const unique = [];
  for (const doc of allDocs) {
    const id = String(doc._id || '');
    if (id && !seen.has(id)) {
      seen.add(id);
      unique.push(doc);
    }
  }

  return groupDomain.sortGroups(unique.map(groupDomain.normalizeGroupDoc));
}

async function getUserActiveGroup(openId) {
  const groups = await listAllGroups();
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

async function buildListResponse(openId, extra = {}) {
  const groups = await listAllGroups();
  const normalizedOpenId = String(openId || '');
  const visibleGroups = groups.filter(
    (group) => !(group.hiddenForOpenIds || []).includes(normalizedOpenId)
  );
  const participation = groupDomain.buildMyParticipation(visibleGroups, openId);
  return {
    ok: true,
    groups: visibleGroups.map((group) => groupDomain.toGroupListItem(group, openId)),
    activeGroup: participation.activeGroup,
    recentGroup: participation.recentGroup,
    ...extra,
  };
}

async function handleCreateGroup(event, openId) {
  const validateResult = groupDomain.validateCreatePayload(event.payload || {});
  if (!validateResult.ok) {
    return validateResult;
  }

  const activeGroup = await getUserActiveGroup(openId);
  if (activeGroup) {
    return {
      ok: false,
      message: `你已经在参与「${activeGroup.themeName || '当前组局'}」，请先结束这场后再发起新的组局`,
    };
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

  await db.runTransaction(async (transaction) => {
    const existingQuery = await transaction
      .collection('groups')
      .where({
        creatorOpenId: openId,
      })
      .get();
    const hasActive = (existingQuery.data || []).some((doc) =>
      groupDomain.isGroupActiveForParticipation(groupDomain.normalizeGroupDoc(doc))
    );
    if (hasActive) {
      throw new Error('你已经在参与其他组局，请先结束后再发起新的组局');
    }

    await transaction.collection('groups').doc(groupId).set({
      data: stripInternalId(nextGroup),
    });
  });

  return buildListResponse(openId, {
    message: '组局已发布，列表已更新',
    group: groupDomain.toGroupListItem(nextGroup),
  });
}

async function handleJoinGroup(event, openId) {
  const validateResult = groupDomain.validateJoinPayload(event.payload || {});
  if (!validateResult.ok) {
    return validateResult;
  }

  const groupId = String(event.groupId || '');
  if (!groupId) {
    return {
      ok: false,
      message: '组局不存在或已下架，请刷新后重试',
    };
  }

  const activeGroup = await getUserActiveGroup(openId);
  if (activeGroup && activeGroup._id !== groupId) {
    return {
      ok: false,
      message: `你已经在参与「${activeGroup.themeName || '当前组局'}」，不能再加入其他组局`,
    };
  }

  const updatedGroup = await db
    .runTransaction(async (transaction) => {
      const groupRef = transaction.collection('groups').doc(groupId);
      const result = await groupRef.get();
      if (!result.data) {
        throw new Error('group-not-found');
      }

      const group = groupDomain.normalizeGroupDoc(result.data);
      if (group.status === 'cancelled') {
        throw new Error('group-cancelled');
      }
      if (group.roomStage === 'settled' || group.roomStage === 'archived' || group.roomStage === 'playing') {
        throw new Error('group-full');
      }
      if (Number(group.currentPeople || 0) >= Number(group.targetPeople || 0)) {
        throw new Error('group-full');
      }

      const duplicatedByUser = (group.participants || []).find(
        (item) => item.openId === openId && item.status === 'active'
      );
      if (duplicatedByUser) {
        return group;
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
        status: groupDomain.computeGroupStatus(currentPeople, group.targetPeople, group.status, group.roomStage),
        updatedAt: new Date().toISOString(),
      });

      await groupRef.set({
        data: stripInternalId(nextGroup),
      });
      return nextGroup;
    })
    .catch((error) => {
      if (error && error.message) {
        throw error;
      }
      throw new Error('join-failed');
    });

  const message =
    updatedGroup.status === 'pending_store_confirm'
      ? '报名成功，这场已经凑满，等待门店确认'
      : '报名成功，店员可继续跟进拼场';

  return buildListResponse(openId, {
    message,
    group: groupDomain.toGroupListItem(updatedGroup),
  });
}

async function handleCancelActiveGroup(openId, groupId = '') {
  const normalizedGroupId = String(groupId || '').trim();
  const activeGroup = await getUserActiveGroup(openId);
  const targetGroupId = normalizedGroupId || (activeGroup && activeGroup._id) || '';
  if (!targetGroupId) {
    return {
      ok: false,
      message: '当前没有可取消的组局',
    };
  }

  const cancelResult = await db.runTransaction(async (transaction) => {
    const groupRef = transaction.collection('groups').doc(targetGroupId);
    const result = await groupRef.get();
    const group = groupDomain.normalizeGroupDoc(result.data || {});
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
    if (isCreator) {
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
            }
          : item
      );
      const currentPeople = Math.max(
        1,
        participants.filter((item) => item.status !== 'left').length
      );
      nextGroup = groupDomain.normalizeGroupDoc({
        ...group,
        currentPeople,
        participants,
        status: groupDomain.computeGroupStatus(currentPeople, group.targetPeople, group.status, group.roomStage),
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
      message: isCreator ? '组局已取消' : '你已退出该组局',
    };
  });

  const listResponse = await buildListResponse(openId);
  return {
    ...listResponse,
    ok: true,
    message: cancelResult.message || (cancelResult.isCreator ? '组局已取消' : '你已退出该组局'),
  };
}

async function handleDeleteGroupRecord(event, openId) {
  const groupId = String(event.groupId || '');
  if (!groupId) {
    return {
      ok: false,
      message: '没有找到要删除的队伍',
    };
  }

  const groupRef = db.collection('groups').doc(groupId);
  let group = null;
  try {
    const result = await groupRef.get();
    group = groupDomain.normalizeGroupDoc(result.data || {});
  } catch (error) {
    group = null;
  }

  if (!group || !group._id) {
    return {
      ok: false,
      message: '这条队伍记录已经不存在了',
    };
  }

  const normalizedOpenId = String(openId || '');
  const viewerParticipation = (group.participants || []).find(
    (item) => item.openId === normalizedOpenId
  );
  const viewerRelated = group.creatorOpenId === normalizedOpenId || Boolean(viewerParticipation);
  if (!viewerRelated) {
    return {
      ok: false,
      message: '只有相关队员才能删除这条记录',
    };
  }

  if (!groupDomain.isGroupRecordDeletable(group)) {
    return {
      ok: false,
      message: '进行中的队伍不能直接删除',
    };
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
    ...(await buildListResponse(openId)),
    message: '队伍记录已删除',
  };
}

async function handleGetTeamRoom(event, openId) {
  const groupId = String(event.groupId || '');
  if (!groupId) {
    return {
      ok: false,
      message: '队伍信息缺失，请返回重试',
    };
  }

  try {
    const result = await db.collection('groups').doc(groupId).get();
    const group = groupDomain.normalizeGroupDoc(result.data || {});
    if (!group._id) {
      return {
        ok: false,
        message: '没有找到这支队伍，请返回大厅重新选择',
      };
    }
    if ((group.hiddenForOpenIds || []).includes(String(openId || ''))) {
      return {
        ok: false,
        message: '这条队伍记录已经被你删除了，请返回大厅重新选择',
      };
    }
    return {
      ok: true,
      room: groupDomain.buildTeamRoom(result.data || group, openId),
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
      message: '队伍房间加载失败，请稍后重试',
    };
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  if (!openId) {
    return {
      ok: false,
      message: '当前身份校验失败，请重新进入小程序后再试',
    };
  }

  try {
    const action = String(event.action || '').trim();
    if (action === 'listGroups') {
      return buildListResponse(openId);
    }
    if (action === 'createGroup') {
      return handleCreateGroup(event, openId);
    }
    if (action === 'joinGroup') {
      return handleJoinGroup(event, openId);
    }
    if (action === 'cancelActiveGroup') {
      return handleCancelActiveGroup(openId, event.groupId);
    }
    if (action === 'deleteGroupRecord') {
      return handleDeleteGroupRecord(event, openId);
    }
    if (action === 'getTeamRoom') {
      return handleGetTeamRoom(event, openId);
    }

    return {
      ok: false,
      message: '未知操作类型',
    };
  } catch (error) {
    const errorCodeMap = {
      'group-not-found': '组局不存在或已下架，请刷新后重试',
      'group-cancelled': '这场组局已经取消了',
      'group-full': '这个组局已经满员了',
      'phone-duplicated': '这个手机号已经报过这场组局了',
      'participant-not-found': '当前参与关系已失效，请刷新后重试',
    };

    console.error('groupManage failed:', {
      message: error.message,
      stack: error.stack,
      action: event.action,
      openId,
    });

    return {
      ok: false,
      message: errorCodeMap[error.message] || '组队服务处理失败，请稍后重试',
    };
  }
};
