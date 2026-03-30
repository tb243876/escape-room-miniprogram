'use strict';

const storage = require('../platform/storage');
const mockData = require('../../mock/data');

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

function normalizeStaffBinding(binding = {}) {
  if (!binding || !binding.role) {
    return null;
  }

  const role = String(binding.role || '').trim();
  return {
    role,
    roleLabel: binding.roleLabel || '店员',
    storeName: binding.storeName || '迷场档案馆',
    authCode: binding.authCode || '',
    permissions: ROLE_PERMISSION_MAP[role] || ROLE_PERMISSION_MAP.staff,
  };
}

function getLocalStaffBinding() {
  return normalizeStaffBinding(storage.safeGetStorage(storage.STAFF_BINDING_STORAGE_KEY));
}

function saveLocalStaffBinding(binding) {
  const normalized = normalizeStaffBinding(binding);
  if (!normalized) {
    return null;
  }
  storage.safeSetStorage(storage.STAFF_BINDING_STORAGE_KEY, normalized);
  return normalized;
}

function clearLocalStaffBinding() {
  storage.safeRemoveStorage(storage.STAFF_BINDING_STORAGE_KEY);
}

function normalizeSessionAction(action = {}) {
  const isPrimary = action.tone === 'primary';
  const enabled = Boolean(action.enabled);
  return {
    key: action.key || '',
    text: action.text || '执行操作',
    hint: action.hint || '',
    enabled,
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

function buildPendingConfirmSummary(members = []) {
  const total = Array.isArray(members) ? members.length : 0;
  const checked = countCheckedInMembers(members);
  return `当前已确认 ${checked}/${total} 人`;
}

function allMembersCheckedIn(members = []) {
  const total = Array.isArray(members) ? members.length : 0;
  return total > 0 && countCheckedInMembers(members) === total;
}

function cloneDefaultSessions() {
  return JSON.parse(JSON.stringify(mockData.staffSessions || []));
}

function buildActionList(stageKey, canConfirmMembers) {
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
      { key: 'start', text: '开始场次', tone: 'secondary', enabled: false, hint: '必须先完成成员确认。' },
      { key: 'end', text: '结束场次', tone: 'secondary', enabled: false, hint: '开始后才能结束并自动结算。' },
      { key: 'highlight', text: '上传集锦', tone: 'secondary', enabled: false, hint: '结算成功后开放上传。' },
    ];
  }

  if (stageKey === 'ready') {
    return [
      { key: 'confirm', text: '确认成员', tone: 'secondary', enabled: false, hint: '这场成员已确认完成。' },
      { key: 'start', text: '开始场次', tone: 'primary', enabled: true, hint: '点击后进入进行中状态。' },
      { key: 'end', text: '结束场次', tone: 'secondary', enabled: false, hint: '开始后才能执行结束。' },
      { key: 'highlight', text: '上传集锦', tone: 'secondary', enabled: false, hint: '结算成功后开放上传。' },
    ];
  }

  if (stageKey === 'playing') {
    return [
      { key: 'confirm', text: '确认成员', tone: 'secondary', enabled: false, hint: '这场已经开始，无需再次确认。' },
      { key: 'start', text: '开始场次', tone: 'secondary', enabled: false, hint: '当前已经在进行中。' },
      { key: 'end', text: '结束场次', tone: 'primary', enabled: true, hint: '点击后触发自动结算链路。' },
      { key: 'highlight', text: '上传集锦', tone: 'secondary', enabled: false, hint: '结束并结算后即可上传。' },
    ];
  }

  return [
    { key: 'confirm', text: '确认成员', tone: 'secondary', enabled: false, hint: '这场已经结算完成。' },
    { key: 'start', text: '开始场次', tone: 'secondary', enabled: false, hint: '这场已经结束。' },
    { key: 'end', text: '结束场次', tone: 'secondary', enabled: false, hint: '这场已经完成结算。' },
    { key: 'highlight', text: '上传集锦', tone: 'primary', enabled: true, hint: '现在可以去集锦库上传本场内容。' },
  ];
}

function findSessionAction(session = {}, actionKey) {
  const normalizedActionKey = String(actionKey || '').trim();
  if (!normalizedActionKey) {
    return null;
  }
  const canConfirmMembers = session.stageKey === 'pending_confirm' && allMembersCheckedIn(session.members || []);
  const actionList = Array.isArray(session.actions) && session.actions.length
    ? session.actions
    : buildActionList(session.stageKey, canConfirmMembers);
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

function validateSessionMemberToggle(session = {}, nickname) {
  const normalizedNickname = String(nickname || '').trim();
  if (!normalizedNickname) {
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
    (item) => String(item.nickname || '').trim() === normalizedNickname
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

function getLocalStaffSessions() {
  const stored = storage.safeGetStorage(storage.STAFF_SESSION_STORAGE_KEY);
  return Array.isArray(stored) && stored.length ? stored : cloneDefaultSessions();
}

function saveLocalStaffSessions(sessionList) {
  const normalized = Array.isArray(sessionList) ? sessionList : [];
  storage.safeSetStorage(storage.STAFF_SESSION_STORAGE_KEY, normalized);
  return normalized;
}

function getSessionStageText(stageKey) {
  const stageTextMap = {
    pending_confirm: '待确认成员',
    ready: '待开始',
    playing: '游戏中',
    settled: '待上传集锦',
  };
  return stageTextMap[stageKey] || '场次处理中';
}

function buildDashboardStats(sessionList = []) {
  return {
    pendingConfirm: sessionList.filter((item) => item.stageKey === 'pending_confirm').length,
    readyToStart: sessionList.filter((item) => item.stageKey === 'ready').length,
    playing: sessionList.filter((item) => item.stageKey === 'playing').length,
    pendingHighlights: sessionList.filter((item) => item.stageKey === 'settled').length,
  };
}

function buildDashboardSessions(sessionList = []) {
  return (sessionList || []).map((item) => ({
    id: item.id || '',
    themeName: item.themeName || '',
    stage: getSessionStageText(item.stageKey),
    stageKey: item.stageKey || '',
    metaText: item.metaText || '',
    actionText: '进入场次管理',
  }));
}

function buildNextSessionState(session = {}, actionKey) {
  const nextSession = JSON.parse(JSON.stringify(session || {}));
  if (actionKey === 'confirm' && nextSession.stageKey === 'pending_confirm') {
    if (!allMembersCheckedIn(nextSession.members || [])) {
      return nextSession;
    }
    nextSession.stageKey = 'ready';
    nextSession.stageLabel = '开始场次';
    nextSession.memberSummary = `当前已确认 ${Array.isArray(nextSession.members) ? nextSession.members.length : 0}/${Array.isArray(nextSession.members) ? nextSession.members.length : 0} 人`;
    nextSession.metaText = '今晚场次 · 所有成员已确认';
    nextSession.note = '这场已经可以开场，开场后玩家端状态会自动切到游戏中。';
    nextSession.members = (nextSession.members || []).map((item) => ({ ...item, status: '已确认' }));
    nextSession.timeline = [
      { title: '门店已确认成员', content: '真实队伍已固定，等待店员点击开始。' },
      { title: '待开始', content: '开始后玩家端会看到“游戏中”，并锁定本场状态流转。' },
    ];
    nextSession.actions = buildActionList('ready', false);
    return nextSession;
  }

  if (actionKey === 'start' && nextSession.stageKey === 'ready') {
    nextSession.stageKey = 'playing';
    nextSession.stageLabel = '结束场次';
    nextSession.memberSummary = `当前 ${Array.isArray(nextSession.members) ? nextSession.members.length : 0}/${Array.isArray(nextSession.members) ? nextSession.members.length : 0} 人 · 游戏中`;
    nextSession.metaText = '正在进行 · 等待店员结束场次';
    nextSession.note = '结束场次后系统会自动结算成长值、徽章、档案和排行榜。';
    nextSession.members = (nextSession.members || []).map((item) => ({ ...item, status: '游戏中' }));
    nextSession.timeline = [
      { title: '场次已开始', content: '玩家正在游玩，等待店员在结束后点击结算。' },
      { title: '待自动结算', content: '结束场次后将自动发放成长值并更新排行榜。' },
    ];
    nextSession.actions = buildActionList('playing', false);
    return nextSession;
  }

  if (actionKey === 'end' && nextSession.stageKey === 'playing') {
    nextSession.stageKey = 'settled';
    nextSession.stageLabel = '上传集锦';
    nextSession.memberSummary = `本场已完成 · ${Array.isArray(nextSession.members) ? nextSession.members.length : 0} 人已结算`;
    nextSession.metaText = '已结束并自动结算 · 等待上传集锦';
    nextSession.note = '本场已完成自动结算，现在可以上传照片和视频集锦。';
    nextSession.members = (nextSession.members || []).map((item) => ({ ...item, status: '已结算' }));
    nextSession.timeline = [
      { title: '场次已结束', content: '玩家已离场，系统已完成成长值、徽章和档案结算。' },
      { title: '待上传集锦', content: '店员现在可以上传本场照片和视频内容。' },
    ];
    nextSession.actions = buildActionList('settled', false);
    return nextSession;
  }

  return nextSession;
}

function toggleSessionMemberCheckIn(session = {}, nickname) {
  const nextSession = JSON.parse(JSON.stringify(session || {}));
  if (nextSession.stageKey !== 'pending_confirm') {
    return nextSession;
  }

  nextSession.members = (nextSession.members || []).map((item) => {
    if (String(item.nickname || '') !== String(nickname || '')) {
      return item;
    }
    const checkedIn = isMemberCheckedIn(item);
    return {
      ...item,
      status: checkedIn ? '待确认' : '已到店',
    };
  });

  nextSession.memberSummary = buildPendingConfirmSummary(nextSession.members);
  const confirmAction = (nextSession.actions || []).find((item) => item.key === 'confirm');
  if (confirmAction) {
    const enabled = allMembersCheckedIn(nextSession.members);
    confirmAction.enabled = enabled;
    confirmAction.hint = enabled
      ? '所有成员已确认到店，可以进入待开始。'
      : '请先逐个确认到店成员，再进入待开始。';
  }
  nextSession.note = allMembersCheckedIn(nextSession.members)
    ? '所有成员已核对完成，可以点击确认成员进入待开始状态。'
    : '请先逐个核对真实到店玩家，未到店成员不要提前确认。';
  return nextSession;
}

function normalizeSession(session = {}, binding) {
  const members = Array.isArray(session.members) ? session.members : [];
  const checkedInCount = countCheckedInMembers(members);
  const totalMemberCount = members.length;
  const canConfirmMembers = session.stageKey === 'pending_confirm' && allMembersCheckedIn(members);
  const normalizedActions = (session.actions || []).map((item) => {
    if (item.key === 'confirm' && session.stageKey === 'pending_confirm') {
      return {
        ...item,
        enabled: canConfirmMembers,
        hint: canConfirmMembers
          ? '所有成员已确认到店，可以进入待开始。'
          : '请先逐个确认到店成员，再进入待开始。',
      };
    }
    return item;
  });

  return {
    id: session.id || '',
    groupId: session.groupId || '',
    themeName: session.themeName || '',
    stageKey: session.stageKey || '',
    stageLabel: session.stageLabel || '',
    memberSummary:
      session.stageKey === 'pending_confirm'
        ? buildPendingConfirmSummary(members)
        : session.memberSummary || '',
    metaText: session.metaText || '',
    note:
      session.stageKey === 'pending_confirm'
        ? canConfirmMembers
          ? '所有成员已核对完成，可以点击确认成员进入待开始状态。'
          : '请先逐个核对真实到店玩家，未到店成员不要提前确认。'
        : session.note || '',
    roleLabel: binding.roleLabel || '店员',
    members,
    checkedInCount,
    totalMemberCount,
    canConfirmMembers,
    timeline: Array.isArray(session.timeline) ? session.timeline : [],
    actions: normalizedActions.map(normalizeSessionAction),
  };
}

function normalizeDashboard(dashboard = {}, binding) {
  return {
    ...dashboard,
    role: binding.role,
    roleLabel: binding.roleLabel,
    storeName: binding.storeName,
    permissions: binding.permissions || [],
    sessions: Array.isArray(dashboard.sessions) ? dashboard.sessions : [],
    memberStats: dashboard.memberStats || {
      totalUsers: 0,
      activeUsers30d: 0,
      completedSessions30d: 0,
      newUsers7d: 0,
    },
    memberInsights: Array.isArray(dashboard.memberInsights) ? dashboard.memberInsights : [],
    authCodeSummary: dashboard.authCodeSummary || {
      availableCodes: 0,
      activeStaff: 0,
      latestCode: '',
    },
    authCodeActions: Array.isArray(dashboard.authCodeActions) ? dashboard.authCodeActions : [],
    authCodeList: Array.isArray(dashboard.authCodeList) ? dashboard.authCodeList : [],
    staffMembers: Array.isArray(dashboard.staffMembers) ? dashboard.staffMembers : [],
    managerTransfer: dashboard.managerTransfer || {
      currentManager: '',
      candidates: [],
      candidateList: [],
    },
  };
}

function getSessionById(sessionList = [], sessionId, binding) {
  const match = (sessionList || []).find((item) => item.id === sessionId);
  if (!match) {
    return null;
  }
  return normalizeSession(match, binding);
}

function normalizeHighlightPackages(packages = [], binding) {
  return (packages || []).map((item) => ({
    ...item,
    roleLabel: binding.roleLabel || '店员',
    media: Array.isArray(item.media)
      ? item.media.map((media) => ({
          ...media,
          tagText: media.type === 'video' ? '视频' : '图片',
        }))
      : [],
    statusClass: item.status === '已上传' ? 'status-ok' : 'status-pending',
  }));
}

module.exports = {
  normalizeStaffBinding,
  getLocalStaffBinding,
  saveLocalStaffBinding,
  clearLocalStaffBinding,
  cloneDefaultSessions,
  getLocalStaffSessions,
  saveLocalStaffSessions,
  buildDashboardStats,
  buildDashboardSessions,
  buildNextSessionState,
  toggleSessionMemberCheckIn,
  validateSessionAction,
  validateSessionMemberToggle,
  normalizeDashboard,
  getSessionById,
  normalizeHighlightPackages,
};
