'use strict';

const cloud = require('wx-server-sdk');
const staffDomain = require('./staff-domain');
const profileDomain = require('./profile-domain');

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

async function listAll(collectionName) {
  const collection = db.collection(collectionName);
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

async function generateAuthCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let index = 0; index < 30; index += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    try {
      const result = await db.collection('staff_auth_codes').doc(code).get();
      if (!result.data || result.data.status === 'disabled') {
        return code;
      }
    } catch (error) {
      return code;
    }
  }

  throw new Error('授权码生成失败，请重试');
}

async function getBinding(openId) {
  try {
    const result = await db.collection('staff_bindings').doc(openId).get();
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

async function ensureBinding(openId) {
  const binding = await getBinding(openId);
  if (!binding) {
    return {
      ok: false,
      message: '当前身份还没有门店工作台权限，请先完成授权绑定',
    };
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

async function buildGroupMap() {
  const groups = await listAll('groups');
  return new Map(groups.map((item) => [String(item._id || ''), item]));
}

async function syncSessionsFromGroups() {
  const groupMap = await buildGroupMap();
  const allSessions = await listAll('staff_sessions');
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
        .collection('staff_sessions')
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

async function ensureSessionDoc(sessionId = '') {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId) {
    return null;
  }

  let existingSession = null;
  try {
    const result = await db.collection('staff_sessions').doc(normalizedSessionId).get();
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
    const groupResult = await db.collection('groups').doc(groupId).get();
    if (!groupResult || !groupResult.data) {
      return existingSession;
    }
    const nextSession = staffDomain.buildSessionFromGroup(groupResult.data, {
      ...(existingSession || {}),
      _id: normalizedSessionId,
    });
    await db.collection('staff_sessions').doc(normalizedSessionId).set({
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

async function listSessions() {
  await syncSessionsFromGroups();
  const sessions = await listAll('staff_sessions');
  return sessions.sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

async function buildDashboard(binding) {
  const sessions = await listSessions();
  const dashboard = {
    role: binding.role,
    roleLabel: binding.roleLabel,
    storeName: binding.storeName,
    permissions: binding.permissions || [],
    stats: staffDomain.buildDashboardStats(sessions),
    sessions: staffDomain.buildDashboardSessions(sessions),
  };

  if ((binding.permissions || []).includes('view_statistics')) {
    const profiles = await listAll('profiles');
    const now = Date.now();
    const day7 = 7 * 24 * 60 * 60 * 1000;
    const day30 = 30 * 24 * 60 * 60 * 1000;
    const activeUsers30d = profiles.filter((profile) =>
      (profile.punchRecords || []).some(
        (item) => now - new Date(item.punchedAt || item.playedAt || 0).getTime() <= day30
      )
    ).length;
    const completedSessions30d = sessions.filter(
      (item) =>
        item.stageKey === 'settled' &&
        now - new Date(item.endedAt || item.updatedAt || 0).getTime() <= day30
    ).length;
    const newUsers7d = profiles.filter(
      (profile) => now - new Date(profile.createdAt || 0).getTime() <= day7
    ).length;

    dashboard.memberStats = {
      totalUsers: profiles.length,
      activeUsers30d,
      completedSessions30d,
      newUsers7d,
    };
    dashboard.memberInsights = [
      {
        title: '累计用户数',
        value: String(profiles.length),
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
  }

  if ((binding.permissions || []).includes('manage_auth_codes')) {
    const codes = await listAll('staff_auth_codes');
    const bindings = await listAll('staff_bindings');
    const profiles = await listAll('profiles');
    const profileMap = new Map(profiles.map((item) => [String(item._id || ''), item]));
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
      createdDateText: item.createdAt ? String(item.createdAt).slice(0, 16).replace('T', ' ') : '',
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
        const profileCard = profileDomain.buildProfileCard(
          profile
            ? {
                ...profile,
                _id: String(item._id || ''),
                nickname: profile.nickname || `员工${String(item._id || '').slice(-4)}`,
              }
            : profileDomain.buildDefaultProfile(String(item._id || ''))
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
          role: item.role || 'staff',
          roleLabel: item.roleLabel || '店员',
          boundAt: item.boundAt || '',
          boundAtText: item.boundAt ? String(item.boundAt).slice(0, 16).replace('T', ' ') : '',
          isCurrentUser: String(item._id || '') === String(binding._id || ''),
          canRemove:
            String(item._id || '') !== String(binding._id || '') && item.role !== 'store_manager',
          profileCard,
        };
      });
  }

  if ((binding.permissions || []).includes('transfer_manager')) {
    const bindings = await listAll('staff_bindings');
    const profiles = await listAll('profiles');
    const profileMap = new Map(profiles.map((item) => [String(item._id || ''), item]));
    const candidates = bindings
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

async function _updateGroupRoomSnapshot(session) {
  const groupRef = db.collection('groups').doc(session.groupId);
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

  await groupRef.update({
    data: patch,
  });
}

async function applySettlement(session) {
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

  const settlementPromises = memberIds.map(async (openId) => {
    let profile = null;
    try {
      const result = await db.collection('profiles').doc(openId).get();
      profile = result.data || null;
    } catch (error) {
      profile = null;
    }

    const nextProfile = profileDomain.applySessionSettlement(
      profile || profileDomain.buildDefaultProfile(openId),
      {
        id: session._id,
        themeId: session.themeId,
        themeName: session.themeName,
        horror: session.horror,
        teamSize: session.teamSize,
        lateNight: session.lateNight,
        playDate: session.playDate,
        timeSlot: session.timeSlot,
        endedAt: session.endedAt,
        growthValue: session.result && session.result.growthValue ? session.result.growthValue : 18,
      }
    );

    await db
      .collection('profiles')
      .doc(openId)
      .set({
        data: stripInternalId(nextProfile),
      });
  });

  await Promise.all(settlementPromises);

  return {
    ...session,
    settlementApplied: true,
  };
}

async function upsertHighlightPackage(session, binding) {
  const highlightId = `highlight-${session._id}`;
  let existing = null;
  try {
    const result = await db.collection('staff_highlights').doc(highlightId).get();
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
    .collection('staff_highlights')
    .doc(highlightId)
    .set({
      data: stripInternalId(nextDoc),
    });
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
        return {
          ok: false,
          message: '请输入授权码',
        };
      }

      if (code.length !== 6) {
        return {
          ok: false,
          message: '授权码格式不正确，请输入6位授权码',
        };
      }

      const existingBinding = await getBinding(openId);
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
        const result = await db.collection('staff_auth_codes').doc(code).get();
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
        return {
          ok: false,
          message: '授权码无效或已失效，请联系店长重新获取',
        };
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
        .collection('staff_bindings')
        .doc(openId)
        .set({
          data: stripInternalId(binding),
        });
      await db
        .collection('staff_auth_codes')
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

    const bindingState = await ensureBinding(openId);
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
        return {
          ok: false,
          message: '当前身份没有授权码管理权限',
        };
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
        return {
          ok: false,
          message: '生成类型无效，请重试',
        };
      }
      const code = await generateAuthCode();
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
        .collection('staff_auth_codes')
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
        dashboard: await buildDashboard(binding),
      };
    }

    if (action === 'getDashboard') {
      return {
        ok: true,
        dashboard: await buildDashboard(binding),
      };
    }

    if (action === 'removeStaffBinding') {
      if (!(binding.permissions || []).includes('manage_auth_codes')) {
        return {
          ok: false,
          message: '当前身份没有员工管理权限',
        };
      }
      const targetOpenId = String(event.targetOpenId || '');
      if (!targetOpenId || targetOpenId === String(binding._id || '')) {
        return {
          ok: false,
          message: '不能移除当前账号',
        };
      }
      const targetResult = await db
        .collection('staff_bindings')
        .doc(targetOpenId)
        .get()
        .catch(() => null);
      const targetBinding = targetResult && targetResult.data ? targetResult.data : null;
      if (!targetBinding) {
        return {
          ok: false,
          message: '没有找到该员工',
        };
      }
      if (targetBinding.role === 'store_manager') {
        return {
          ok: false,
          message: '不能直接移除店长账号',
        };
      }

      await db.runTransaction(async (transaction) => {
        await transaction.collection('staff_bindings').doc(targetOpenId).remove();
        if (targetBinding.authCode) {
          await transaction
            .collection('staff_auth_codes')
            .doc(String(targetBinding.authCode))
            .update({
              data: {
                status: 'active',
                usedBy: '',
                usedAt: '',
              },
            });
        }
      });
      return {
        ok: true,
        message: '员工已移除',
        dashboard: await buildDashboard(binding),
      };
    }

    if (action === 'transferManager') {
      if (!(binding.permissions || []).includes('transfer_manager')) {
        return {
          ok: false,
          message: '当前身份没有店长转移权限',
        };
      }
      const targetOpenId = String(event.targetOpenId || '');
      if (!targetOpenId || targetOpenId === String(binding._id || '')) {
        return {
          ok: false,
          message: '请选择新的店长账号',
        };
      }

      const targetResult = await db
        .collection('staff_bindings')
        .doc(targetOpenId)
        .get()
        .catch(() => null);
      const targetBinding = targetResult && targetResult.data ? targetResult.data : null;
      if (!targetBinding || targetBinding.role !== 'assistant_manager') {
        return {
          ok: false,
          message: '只能转移给副店长账号',
        };
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
        .collection('staff_bindings')
        .doc(String(binding._id || ''))
        .set({
          data: stripInternalId(nextCurrentBinding),
        });
      await db
        .collection('staff_bindings')
        .doc(targetOpenId)
        .set({
          data: stripInternalId(nextTargetBinding),
        });

      return {
        ok: true,
        message: '店长已转移',
        dashboard: await buildDashboard(nextCurrentBinding),
      };
    }

    if (action === 'getSession') {
      const sessionId = String(event.sessionId || '');
      if (!sessionId) {
        return {
          ok: false,
          message: '没有找到这个场次，请返回工作台重试',
        };
      }

      await syncSessionsFromGroups();
      const sessionDoc = await ensureSessionDoc(sessionId);
      if (!sessionDoc) {
        return {
          ok: false,
          message: '没有找到这个场次，请返回工作台重试',
        };
      }

      return {
        ok: true,
        session: staffDomain.normalizeSessionForClient(sessionDoc, binding),
      };
    }

    if (action === 'toggleSessionMember') {
      if (!(binding.permissions || []).includes('session_confirm')) {
        return {
          ok: false,
          message: '当前身份没有场次确认权限',
        };
      }
      const sessionId = String(event.sessionId || '');
      const targetOpenId = String(event.openId || '');
      if (!sessionId || !targetOpenId) {
        return {
          ok: false,
          message: '操作参数缺失，请返回工作台重试',
        };
      }
      const result = await db.collection('staff_sessions').doc(sessionId).get();
      if (!result.data) {
        return {
          ok: false,
          message: '没有找到这个场次，请返回工作台重试',
        };
      }

      const toggleValidation = staffDomain.validateSessionMemberToggle(result.data, targetOpenId);
      if (!toggleValidation.ok) {
        return toggleValidation;
      }

      const nextSession = staffDomain.toggleSessionMemberCheckIn(result.data, targetOpenId);
      await db.runTransaction(async (transaction) => {
        await transaction
          .collection('staff_sessions')
          .doc(sessionId)
          .set({
            data: stripInternalId(nextSession),
          });

        const groupRef = transaction.collection('groups').doc(nextSession.groupId);
        const roomMembers = (nextSession.members || []).map((item) => ({
          openId: item.openId || '',
          nickname: item.nickname || '玩家',
          status: item.status || '待确认',
        }));
        await groupRef.update({
          data: {
            roomMembers,
            roomUpdatedAt: new Date().toISOString(),
          },
        });
      });

      return {
        ok: true,
        session: staffDomain.normalizeSessionForClient(nextSession, binding),
      };
    }

    if (action === 'runSessionAction') {
      const sessionId = String(event.sessionId || '');
      const actionKey = String(event.actionKey || '');
      if (!sessionId || !actionKey) {
        return {
          ok: false,
          message: '操作参数缺失，请返回工作台重试',
        };
      }

      const actionPermissionMap = {
        confirm: 'session_confirm',
        start: 'session_start',
        end: 'session_end',
      };
      const requiredPermission = actionPermissionMap[actionKey];
      if (requiredPermission && !(binding.permissions || []).includes(requiredPermission)) {
        return {
          ok: false,
          message: '当前身份没有该操作权限',
        };
      }
      const result = await db.collection('staff_sessions').doc(sessionId).get();
      if (!result.data) {
        return {
          ok: false,
          message: '没有找到这个场次，请返回工作台重试',
        };
      }

      const actionValidation = staffDomain.validateSessionAction(result.data, actionKey);
      if (!actionValidation.ok) {
        return actionValidation;
      }

      let nextSession = staffDomain.buildNextSessionState(result.data, actionKey);
      if (actionKey === 'end' && nextSession.stageKey === 'settled') {
        nextSession = await applySettlement(nextSession);
        await upsertHighlightPackage(nextSession, binding);
      }

      await db.runTransaction(async (transaction) => {
        await transaction
          .collection('staff_sessions')
          .doc(sessionId)
          .set({
            data: stripInternalId(nextSession),
          });

        const groupRef = transaction.collection('groups').doc(nextSession.groupId);
        const roomStage = nextSession.stageKey;
        const roomMembers = (nextSession.members || []).map((item) => ({
          openId: item.openId || '',
          nickname: item.nickname || '玩家',
          status: item.status || '待确认',
        }));
        const roomTimeline = Array.isArray(nextSession.timeline) ? nextSession.timeline : [];

        const patch = {
          roomStage,
          roomMembers,
          roomTimeline,
          roomUpdatedAt: new Date().toISOString(),
          sessionId: nextSession._id,
        };

        if (nextSession.stageKey === 'settled') {
          patch.status = 'settled';
        } else if (nextSession.stageKey === 'ready' || nextSession.stageKey === 'playing') {
          patch.status = 'confirmed';
        } else if (nextSession.stageKey === 'pending_confirm') {
          patch.status = 'pending_store_confirm';
        }
        if (nextSession.stageKey === 'settled' && nextSession.result) {
          patch.roomResult = nextSession.result;
        }

        await groupRef.update({ data: patch });
      });

      return {
        ok: true,
        session: staffDomain.normalizeSessionForClient(nextSession, binding),
      };
    }

    if (action === 'getHighlights') {
      const highlights = await listAll('staff_highlights');
      return {
        ok: true,
        highlights: highlights
          .sort(
            (left, right) =>
              new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime()
          )
          .map((item) => ({
            ...item,
            roleLabel: binding.roleLabel || '店员',
            statusClass: item.status === '已上传' ? 'status-ok' : 'status-pending',
            media: Array.isArray(item.media)
              ? item.media.map((media) => ({
                  ...media,
                  tagText: media.type === 'video' ? '视频' : '图片',
                }))
              : [],
          })),
      };
    }

    return {
      ok: false,
      message: '未知操作类型',
    };
  } catch (error) {
    console.error('staffManage failed:', {
      message: error.message,
      stack: error.stack,
      action,
      openId,
    });
    return {
      ok: false,
      message: '门店工作台处理失败，请稍后重试',
    };
  }
};
