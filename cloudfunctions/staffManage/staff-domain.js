'use strict';

const ROLE_PERMISSION_MAP = {
  staff: ['session_confirm', 'session_start', 'session_end', 'upload_highlights'],
  assistant_manager: [
    'session_confirm',
    'session_start',
    'session_end',
    'upload_highlights',
    'view_statistics',
    'manage_auth_codes',
  ],
  store_manager: [
    'session_confirm',
    'session_start',
    'session_end',
    'upload_highlights',
    'view_statistics',
    'manage_auth_codes',
    'transfer_manager',
  ],
};

function normalizeBinding(binding = {}) {
  if (!binding || !binding.role) {
    return null;
  }
  const role = String(binding.role || '').trim();
  return {
    _id: String(binding._id || binding.openId || ''),
    role,
    roleLabel: binding.roleLabel || '店员',
    storeName: binding.storeName || '迷场档案馆',
    authCode: binding.authCode || '',
    boundAt: binding.boundAt || new Date().toISOString(),
    permissions: ROLE_PERMISSION_MAP[role] || ROLE_PERMISSION_MAP.staff,
  };
}

function normalizeAction(action = {}) {
  const isPrimary = action.tone === 'primary';
  const enabled = Boolean(action.enabled);
  return {
    key: action.key || '',
    text: action.text || '执行操作',
    hint: action.hint || '',
    enabled,
    tone: isPrimary ? 'primary' : 'secondary',
    buttonClass: enabled
      ? isPrimary
        ? 'button-primary'
        : 'button-secondary'
      : `${isPrimary ? 'button-primary' : 'button-secondary'} button-disabled`,
  };
}

function isMemberCheckedIn(member = {}) {
  return ['已到店', '已确认', '游戏中', '已结算'].includes(String(member.status || ''));
}

function countCheckedInMembers(members = []) {
  return (members || []).filter(isMemberCheckedIn).length;
}

function allMembersCheckedIn(members = []) {
  const total = Array.isArray(members) ? members.length : 0;
  return total > 0 && countCheckedInMembers(members) === total;
}

function buildPendingConfirmSummary(members = []) {
  const total = Array.isArray(members) ? members.length : 0;
  const checked = countCheckedInMembers(members);
  return `当前已确认 ${checked}/${total} 人`;
}

function getStageText(stageKey) {
  const stageTextMap = {
    pending_confirm: '待确认成员',
    ready: '待开始',
    playing: '游戏中',
    settled: '待上传集锦',
  };
  return stageTextMap[stageKey] || '场次处理中';
}

function buildActions(stageKey, canConfirmMembers) {
  if (stageKey === 'pending_confirm') {
    return [
      {
        key: 'confirm',
        text: '确认成员',
        tone: 'primary',
        enabled: Boolean(canConfirmMembers),
        hint: canConfirmMembers
          ? '所有成员已确认到店，可以进入待开始。'
          : '请先逐个确认到店成员，再进入待开始。',
      },
      {
        key: 'start',
        text: '开始场次',
        tone: 'secondary',
        enabled: false,
        hint: '必须先完成成员确认。',
      },
      {
        key: 'end',
        text: '结束场次',
        tone: 'secondary',
        enabled: false,
        hint: '开始后才能结束并自动结算。',
      },
      {
        key: 'highlight',
        text: '上传集锦',
        tone: 'secondary',
        enabled: false,
        hint: '结算成功后才能上传本场集锦。',
      },
    ];
  }

  if (stageKey === 'ready') {
    return [
      {
        key: 'confirm',
        text: '确认成员',
        tone: 'secondary',
        enabled: false,
        hint: '这场成员已确认完成。',
      },
      {
        key: 'start',
        text: '开始场次',
        tone: 'primary',
        enabled: true,
        hint: '点击后进入进行中状态。',
      },
      {
        key: 'end',
        text: '结束场次',
        tone: 'secondary',
        enabled: false,
        hint: '开始后才能执行结束。',
      },
      {
        key: 'highlight',
        text: '上传集锦',
        tone: 'secondary',
        enabled: false,
        hint: '结算成功后开放上传。',
      },
    ];
  }

  if (stageKey === 'playing') {
    return [
      {
        key: 'confirm',
        text: '确认成员',
        tone: 'secondary',
        enabled: false,
        hint: '这场已经开始，无需再次确认。',
      },
      {
        key: 'start',
        text: '开始场次',
        tone: 'secondary',
        enabled: false,
        hint: '当前已经在进行中。',
      },
      {
        key: 'end',
        text: '结束场次',
        tone: 'primary',
        enabled: true,
        hint: '点击后触发自动结算链路。',
      },
      {
        key: 'highlight',
        text: '上传集锦',
        tone: 'secondary',
        enabled: false,
        hint: '结束并结算后即可上传。',
      },
    ];
  }

  return [
    {
      key: 'confirm',
      text: '确认成员',
      tone: 'secondary',
      enabled: false,
      hint: '这场已经结算完成。',
    },
    { key: 'start', text: '开始场次', tone: 'secondary', enabled: false, hint: '这场已经结束。' },
    { key: 'end', text: '结束场次', tone: 'secondary', enabled: false, hint: '这场已经完成结算。' },
    {
      key: 'highlight',
      text: '上传集锦',
      tone: 'primary',
      enabled: true,
      hint: '现在可以去集锦库上传本场内容。',
    },
  ];
}

function findSessionAction(session = {}, actionKey) {
  const normalizedActionKey = String(actionKey || '').trim();
  if (!normalizedActionKey) {
    return null;
  }
  const canConfirmMembers =
    session.stageKey === 'pending_confirm' && allMembersCheckedIn(session.members || []);
  const actionList =
    Array.isArray(session.actions) && session.actions.length
      ? session.actions
      : buildActions(session.stageKey, canConfirmMembers);
  return actionList.find((item) => item.key === normalizedActionKey) || null;
}

function validateSessionAction(session = {}, actionKey) {
  const targetAction = findSessionAction(session, actionKey);
  if (!targetAction) {
    return {
      ok: false,
      message: '当前操作不存在或已失效，请刷新后重试',
    };
  }
  if (!targetAction.enabled) {
    return {
      ok: false,
      message: targetAction.hint || '当前阶段不能执行这个操作',
    };
  }
  return {
    ok: true,
  };
}

function validateSessionMemberToggle(session = {}, openId) {
  const normalizedOpenId = String(openId || '').trim();
  if (!normalizedOpenId) {
    return {
      ok: false,
      message: '没有找到要确认的成员，请刷新后重试',
    };
  }
  if (session.stageKey !== 'pending_confirm') {
    return {
      ok: false,
      message: '当前阶段不能再调整成员到店状态',
    };
  }
  const matchedMember = (session.members || []).find(
    (item) => String(item.openId || '').trim() === normalizedOpenId
  );
  if (!matchedMember) {
    return {
      ok: false,
      message: '没有找到要确认的成员，请刷新后重试',
    };
  }
  return {
    ok: true,
  };
}

function buildSessionMembersFromGroup(
  group = {},
  existingMembers = [],
  stageKey = 'pending_confirm'
) {
  const activeParticipants = Array.isArray(group.participants)
    ? group.participants.filter((item) => item.status !== 'left')
    : [];
  const existingMap = new Map(
    (existingMembers || []).map((item) => [String(item.openId || item.nickname || ''), item])
  );

  return activeParticipants.map((item) => {
    const existing = existingMap.get(String(item.openId || item.contactName || '')) || {};
    let status = '待确认';
    if (stageKey === 'ready') {
      status = '已确认';
    } else if (stageKey === 'playing') {
      status = '游戏中';
    } else if (stageKey === 'settled') {
      status = '已结算';
    } else if (existing.status) {
      status = existing.status;
    }

    return {
      openId: String(item.openId || ''),
      nickname: item.contactName || '玩家',
      contactPhone: item.contactPhone || '',
      status,
    };
  });
}

function buildSessionFromGroup(group = {}, existingSession = null) {
  const roomStage = String(group.roomStage || '').trim();
  const stageKey =
    existingSession && existingSession.stageKey
      ? existingSession.stageKey
      : roomStage === 'settled'
        ? 'settled'
        : roomStage === 'playing'
          ? 'playing'
          : roomStage === 'ready'
            ? 'ready'
            : group.status === 'confirmed'
              ? 'ready'
              : 'pending_confirm';
  const members = buildSessionMembersFromGroup(
    group,
    existingSession && existingSession.members,
    stageKey
  );
  const canConfirmMembers = stageKey === 'pending_confirm' && allMembersCheckedIn(members);
  const dateText = `${group.date || ''} ${group.timeSlot || ''}`.trim();

  const session = {
    _id: existingSession && existingSession._id ? existingSession._id : `session-${group._id}`,
    groupId: group._id,
    themeId: group.themeId || '',
    themeName: group.themeName || '',
    horror: group.horror || '',
    playDate: group.date || '',
    timeSlot: group.timeSlot || '',
    teamSize: Number(group.currentPeople || members.length || 0),
    lateNight: Boolean(group.lateNight),
    storeName: group.storeName || '迷场档案馆',
    stageKey,
    stageLabel:
      stageKey === 'pending_confirm'
        ? '确认成员'
        : stageKey === 'ready'
          ? '开始场次'
          : stageKey === 'playing'
            ? '结束场次'
            : '上传集锦',
    memberSummary:
      stageKey === 'pending_confirm'
        ? buildPendingConfirmSummary(members)
        : stageKey === 'ready'
          ? `当前已确认 ${members.length}/${members.length} 人`
          : stageKey === 'playing'
            ? `当前 ${members.length}/${members.length} 人 · 游戏中`
            : `本场已完成 · ${members.length} 人已结算`,
    metaText:
      stageKey === 'pending_confirm'
        ? `${dateText} · 组局大厅已确认`
        : stageKey === 'ready'
          ? `${dateText} · 所有成员已确认`
          : stageKey === 'playing'
            ? '正在进行 · 等待店员结束场次'
            : '已结束并自动结算 · 等待上传集锦',
    note:
      stageKey === 'pending_confirm'
        ? canConfirmMembers
          ? '所有成员已核对完成，可以点击确认成员进入待开始状态。'
          : '请先逐个核对真实到店玩家，未到店成员不要提前确认。'
        : stageKey === 'ready'
          ? '这场已经可以开场，开场后玩家端状态会自动切到游戏中。'
          : stageKey === 'playing'
            ? '结束场次后系统会自动结算成长值、徽章、档案和排行榜。'
            : '本场已完成自动结算，现在可以上传照片和视频集锦。',
    members,
    timeline:
      stageKey === 'pending_confirm'
        ? [
            { title: '大厅组局已转真实房间', content: '该场已由门店接管，等待最终成员确认。' },
            { title: '待确认成员', content: '确认通过后，玩家端会看到“待开场”状态。' },
          ]
        : stageKey === 'ready'
          ? [
              { title: '门店已确认成员', content: '队伍人员已固定，等待店员点击开始' },
              { title: '待开始', content: '开始后玩家端会看到“游戏中”，并锁定本场状态流转。' },
            ]
          : stageKey === 'playing'
            ? [
                { title: '场次已开始', content: '玩家正在游玩，等待店员在结束后点击结算。' },
                { title: '待自动结算', content: '结束场次后将自动发放成长值并更新排行榜。' },
              ]
            : [
                { title: '场次已结束', content: '玩家已离场，系统已完成成长值、徽章和档案结算。' },
                { title: '待上传集锦', content: '店员现在可以上传本场照片和视频内容。' },
              ],
    actions: buildActions(stageKey, canConfirmMembers),
    settlementApplied: Boolean(existingSession && existingSession.settlementApplied),
    result: existingSession && existingSession.result ? existingSession.result : null,
    createdAt:
      existingSession && existingSession.createdAt
        ? existingSession.createdAt
        : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return session;
}

function toggleSessionMemberCheckIn(session = {}, openId) {
  if (session.stageKey !== 'pending_confirm') {
    return session;
  }
  const nextSession = JSON.parse(JSON.stringify(session));
  nextSession.members = (nextSession.members || []).map((item) => {
    if (String(item.openId || '').trim() !== String(openId || '').trim()) {
      return item;
    }
    return {
      ...item,
      status: isMemberCheckedIn(item) ? '待确认' : '已到店',
    };
  });
  const canConfirmMembers = allMembersCheckedIn(nextSession.members);
  nextSession.memberSummary = buildPendingConfirmSummary(nextSession.members);
  nextSession.note = canConfirmMembers
    ? '所有成员已核对完成，可以点击确认成员进入待开始状态。'
    : '请先逐个核对真实到店玩家，未到店成员不要提前确认。';
  nextSession.actions = buildActions('pending_confirm', canConfirmMembers);
  nextSession.updatedAt = new Date().toISOString();
  return nextSession;
}

function buildNextSessionState(session = {}, actionKey) {
  const nextSession = JSON.parse(JSON.stringify(session || {}));
  if (actionKey === 'confirm' && nextSession.stageKey === 'pending_confirm') {
    if (!allMembersCheckedIn(nextSession.members || [])) {
      return nextSession;
    }
    nextSession.stageKey = 'ready';
    nextSession.stageLabel = '开始场次';
    nextSession.memberSummary = `当前已确认 ${nextSession.members.length}/${nextSession.members.length} 人`;
    nextSession.metaText =
      `${nextSession.playDate || ''} ${nextSession.timeSlot || ''}`.trim() + ' · 所有成员已确认';
    nextSession.note = '这场已经可以开场，开场后玩家端状态会自动切到游戏中。';
    nextSession.members = nextSession.members.map((item) => ({ ...item, status: '已确认' }));
    nextSession.timeline = [
      { title: '门店已确认成员', content: '队伍人员已固定，等待店员点击开始' },
      { title: '待开始', content: '开始后玩家端会看到“游戏中”，并锁定本场状态流转。' },
    ];
    nextSession.actions = buildActions('ready', false);
    nextSession.updatedAt = new Date().toISOString();
    return nextSession;
  }

  if (actionKey === 'start' && nextSession.stageKey === 'ready') {
    nextSession.stageKey = 'playing';
    nextSession.stageLabel = '结束场次';
    nextSession.memberSummary = `当前 ${nextSession.members.length}/${nextSession.members.length} 人 · 游戏中`;
    nextSession.metaText = '正在进行 · 等待店员结束场次';
    nextSession.note = '结束场次后系统会自动结算成长值、徽章、档案和排行榜。';
    nextSession.members = nextSession.members.map((item) => ({ ...item, status: '游戏中' }));
    nextSession.timeline = [
      { title: '场次已开始', content: '玩家正在游玩，等待店员在结束后点击结算。' },
      { title: '待自动结算', content: '结束场次后将自动发放成长值并更新排行榜。' },
    ];
    nextSession.actions = buildActions('playing', false);
    nextSession.startedAt = new Date().toISOString();
    nextSession.updatedAt = nextSession.startedAt;
    return nextSession;
  }

  if (actionKey === 'end' && nextSession.stageKey === 'playing') {
    nextSession.stageKey = 'settled';
    nextSession.stageLabel = '上传集锦';
    nextSession.memberSummary = `本场已完成 · ${nextSession.members.length} 人已结算`;
    nextSession.metaText = '已结束并自动结算 · 等待上传集锦';
    nextSession.note = '本场已完成自动结算，现在可以上传照片和视频集锦。';
    nextSession.members = nextSession.members.map((item) => ({ ...item, status: '已结算' }));
    nextSession.timeline = [
      { title: '场次已结束', content: '玩家已离场，系统已完成成长值、徽章和档案结算。' },
      { title: '待上传集锦', content: '店员现在可以上传本场照片和视频内容。' },
    ];
    nextSession.actions = buildActions('settled', false);
    nextSession.result = {
      growthValue: 18,
      archiveDelta: 1,
      badgeText: '本场记录已计入玩家档案',
    };
    nextSession.endedAt = new Date().toISOString();
    nextSession.updatedAt = nextSession.endedAt;
    return nextSession;
  }

  return nextSession;
}

function normalizeSessionForClient(session = {}, binding = {}) {
  const members = Array.isArray(session.members) ? session.members : [];
  const actions = Array.isArray(session.actions) ? session.actions : [];
  const checkedInCount = countCheckedInMembers(members);
  const totalMemberCount = members.length;
  const canConfirmMembers = session.stageKey === 'pending_confirm' && allMembersCheckedIn(members);
  return {
    id: session._id || session.id || '',
    groupId: session.groupId || '',
    themeName: session.themeName || '',
    stageKey: session.stageKey || '',
    stageLabel: session.stageLabel || '',
    memberSummary: session.memberSummary || '',
    metaText: session.metaText || '',
    note: session.note || '',
    roleLabel: binding.roleLabel || '店员',
    members,
    checkedInCount,
    totalMemberCount,
    canConfirmMembers,
    timeline: Array.isArray(session.timeline) ? session.timeline : [],
    actions: actions.map(normalizeAction),
  };
}

function buildDashboardStats(sessions = []) {
  return {
    pendingConfirm: sessions.filter((item) => item.stageKey === 'pending_confirm').length,
    readyToStart: sessions.filter((item) => item.stageKey === 'ready').length,
    playing: sessions.filter((item) => item.stageKey === 'playing').length,
    pendingHighlights: sessions.filter((item) => item.stageKey === 'settled').length,
  };
}

function buildDashboardSessions(sessions = []) {
  return sessions.map((item) => ({
    id: item._id || '',
    themeName: item.themeName || '',
    stage: getStageText(item.stageKey),
    stageKey: item.stageKey || '',
    metaText: item.metaText || '',
    actionText: '进入场次管理',
  }));
}

module.exports = {
  ROLE_PERMISSION_MAP,
  normalizeBinding,
  buildSessionFromGroup,
  toggleSessionMemberCheckIn,
  buildNextSessionState,
  validateSessionAction,
  validateSessionMemberToggle,
  normalizeSessionForClient,
  buildDashboardStats,
  buildDashboardSessions,
};
