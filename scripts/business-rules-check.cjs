'use strict';

const assert = require('assert');
const { setupMockMiniappEnv } = require('./test-helpers/mock-miniapp-env.cjs');

setupMockMiniappEnv();

const profileDomain = require('../utils/domain/profile');
const groupDomain = require('../utils/domain/group');
const staffDomain = require('../utils/domain/staff');
const staffDashboardViewModel = require('../pages/staff-dashboard/view-model');
const cloudStaffDomain = require('../cloudfunctions/staffManage/staff-domain');

function testProfileNormalization() {
  const profile = profileDomain.normalizeProfile({
    nickname: '测试用户',
    totalPlayCount: 0,
    recentThemes: ['尸兄'],
    playRecords: [
      {
        themeName: '尸兄',
        horror: '微恐',
        teamSize: 4,
        lateNight: false,
        playedAt: new Date().toISOString(),
      },
      {
        themeName: '瞳灵人',
        horror: '重恐',
        teamSize: 5,
        lateNight: true,
        playedAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(profile.totalPlayCount, 2);
  assert.equal(profile.badgeCount > 0, true);
  assert.equal(Array.isArray(profile.badgeCatalog), true);
}

function testGroupValidationAndConflict() {
  const invalidPhone = groupDomain.validateCreateGroupPayload({
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    currentPeople: 2,
    targetPeople: 4,
    contactName: '阿杰',
    contactPhone: '12345',
  });
  assert.equal(invalidPhone.ok, false);

  const validPayload = groupDomain.validateCreateGroupPayload({
    themeId: 'theme-shixiong',
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    currentPeople: 2,
    targetPeople: 4,
    contactName: '阿杰',
    contactPhone: '13800138000',
  });
  assert.equal(validPayload.ok, true);

  assert.equal(
    groupDomain.hasConflictingActiveGroup({ groupId: 'group-001' }, 'group-002'),
    true
  );
  assert.equal(
    groupDomain.hasConflictingActiveGroup({ groupId: 'group-001' }, 'group-001'),
    false
  );

  const normalizedPendingGroup = groupDomain.normalizeGroupItem({
    id: 'group-stale-status',
    themeName: '瞳灵人',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    currentPeople: 4,
    targetPeople: 6,
    status: 'pending_store_confirm',
  });
  assert.equal(normalizedPendingGroup.rawStatus, 'recruiting');

  const normalizedFullGroup = groupDomain.normalizeGroupItem({
    id: 'group-filled',
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    currentPeople: 4,
    targetPeople: 4,
    status: 'recruiting',
  });
  assert.equal(normalizedFullGroup.rawStatus, 'pending_store_confirm');
}

function testStaffBindingAndSessionFlow() {
  const binding = staffDomain.saveLocalStaffBinding({
    role: 'store_manager',
    roleLabel: '店长',
    storeName: '迷场档案馆',
    authCode: 'OWNER2026',
  });
  assert.equal(binding.role, 'store_manager');
  assert.equal(staffDomain.getLocalStaffBinding().authCode, 'OWNER2026');

  const sessions = staffDomain.getLocalStaffSessions();
  const firstSession = sessions[0];
  const checkInReadySession = (firstSession.members || [])
    .filter((member) => member.status === '待确认')
    .reduce((session, member) => staffDomain.toggleSessionMemberCheckIn(session, member.nickname), firstSession);
  const confirmedSession = staffDomain.buildNextSessionState(checkInReadySession, 'confirm');
  assert.equal(confirmedSession.stageKey, 'ready');

  const startedSession = staffDomain.buildNextSessionState(confirmedSession, 'start');
  assert.equal(startedSession.stageKey, 'playing');

  const settledSession = staffDomain.buildNextSessionState(startedSession, 'end');
  assert.equal(settledSession.stageKey, 'settled');

  const invalidStart = staffDomain.validateSessionAction(firstSession, 'start');
  assert.equal(invalidStart.ok, false);

  const invalidToggle = staffDomain.validateSessionMemberToggle(confirmedSession, '阿杰');
  assert.equal(invalidToggle.ok, false);
}

function testStaffDashboardNormalization() {
  const dashboard = staffDashboardViewModel.normalizeDashboard({
    permissions: ['manage_auth_codes', 'transfer_manager'],
    authCodeList: [
      { code: '1234', status: 'active', roleLabel: '店员' },
      { code: '2345', status: 'used', roleLabel: '副店长' },
      { code: '3456', status: 'disabled', roleLabel: '店员' },
    ],
  });

  assert.equal(dashboard.authCodeList[0].statusText, '可使用');
  assert.equal(dashboard.authCodeList[1].statusText, '已使用');
  assert.equal(dashboard.authCodeList[2].statusClass, 'status-disabled');
}

function testProfilePendingPatchMatch() {
  const profile = {
    nickname: '资料测试员',
    signature: '这是自动化写入的签名。',
    gender: 'female',
    avatarUrl: 'https://example.com/avatar.png',
  };
  const patch = {
    nickname: '资料测试员',
    signature: '这是自动化写入的签名。',
    gender: 'female',
    avatarUrl: 'https://example.com/avatar.png',
  };
  assert.equal(profileDomain.isEditablePatchApplied(profile, patch), true);
}

function testCloudStaffSessionRespectsRoomStage() {
  const settledSession = cloudStaffDomain.buildSessionFromGroup({
    _id: 'group-001',
    themeName: '尸兄',
    date: '03月30日',
    timeSlot: '19:30',
    currentPeople: 4,
    status: 'confirmed',
    roomStage: 'settled',
    participants: [
      { openId: '1', contactName: '阿哲', contactPhone: '13800138001', role: 'creator', status: 'active' },
      { openId: '2', contactName: '小林', contactPhone: '13800138002', role: 'member', status: 'active' },
    ],
  });

  assert.equal(settledSession.stageKey, 'settled');
  assert.equal(settledSession.members.every((item) => item.status === '已结算'), true);

  const invalidCloudAction = cloudStaffDomain.validateSessionAction(settledSession, 'end');
  assert.equal(invalidCloudAction.ok, false);
}

function main() {
  testProfileNormalization();
  testGroupValidationAndConflict();
  testStaffBindingAndSessionFlow();
  testStaffDashboardNormalization();
  testProfilePendingPatchMatch();
  testCloudStaffSessionRespectsRoomStage();
  console.log('业务规则校验通过');
}

main();
