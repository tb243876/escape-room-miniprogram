'use strict';

const assert = require('assert');

function createWxStub() {
  return {
    __storage: Object.create(null),
    getStorageSync(key) {
      return this.__storage[key];
    },
    setStorageSync(key, value) {
      this.__storage[key] = value;
    },
    removeStorageSync(key) {
      delete this.__storage[key];
    },
    getStorageInfoSync() {
      return { keys: Object.keys(this.__storage) };
    },
  };
}

global.wx = createWxStub();
global.getApp = () => ({
  globalData: {
    envVersion: 'develop',
    envId: 'mini-escape-main-9f3bjb2e7249ec8',
    dataEnvTag: 'prod',
    useMockData: false,
    useMockGroups: false,
    allowMockFallback: false,
    enablePerfTracing: false,
    storeName: '迷场档案馆',
  },
});

const profileDomain = require('../utils/domain/profile');
const groupDomain = require('../utils/domain/group');
const staffDomain = require('../utils/domain/staff');
const staffDashboardViewModel = require('../packages/staff/dashboard/view-model');
const cloudStaffDomain = require('../cloudfunctions/staffManage/staff-domain');
const cloudProfileDomain = require('../cloudfunctions/getProfile/profile-domain');
const envConfig = require('../utils/platform/env-config');
const cloudStaffProfileDomain = require('../cloudfunctions/staffManage/profile-domain');

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

function testCloudProfileProvisioning() {
  const provisioned = cloudProfileDomain.buildProvisionedProfile('seed-open-id-001', {
    nickname: '安妮',
    contactPhone: '13900000009',
  });
  assert.equal(provisioned._id, 'seed-open-id-001');
  assert.equal(provisioned.nickname, '安妮');
  assert.equal(provisioned.contactPhone, '13900000009');
  assert.equal(Array.isArray(provisioned.badgeCatalog), true);

  const seededExisting = cloudProfileDomain.applyIdentitySeed(
    {
      _id: 'seed-open-id-002',
      nickname: '档案室常客',
      contactPhone: '',
    },
    {
      nickname: '小林',
      contactPhone: '13900000002',
    }
  );
  assert.equal(seededExisting.nickname, '小林');
  assert.equal(seededExisting.contactPhone, '13900000002');

  const keepCustomNickname = cloudProfileDomain.applyIdentitySeed(
    {
      _id: 'seed-open-id-003',
      nickname: '真实昵称',
      contactPhone: '',
    },
    {
      nickname: '不该覆盖',
      contactPhone: '13900000003',
    }
  );
  assert.equal(keepCustomNickname.nickname, '真实昵称');
  assert.equal(keepCustomNickname.contactPhone, '13900000003');
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
    contactPhone: '13900000000',
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
    authCode: 'OWN826',
  });
  assert.equal(binding.role, 'store_manager');
  assert.equal(staffDomain.getLocalStaffBinding().authCode, 'OWN826');

  const firstSession = {
    id: 'session-fixture-001',
    stageKey: 'pending_confirm',
    members: [
      { openId: 'member-001', nickname: '成员1', status: '已到店' },
      { openId: 'member-002', nickname: '成员2', status: '待确认' },
      { openId: 'member-003', nickname: '成员3', status: '待确认' },
    ],
  };
  const checkInReadySession = (firstSession.members || [])
    .filter((member) => member.status === '待确认')
    .reduce((session, member) => staffDomain.toggleSessionMemberCheckIn(session, member.openId), firstSession);
  const confirmedSession = staffDomain.buildNextSessionState(checkInReadySession, 'confirm');
  assert.equal(confirmedSession.stageKey, 'ready');

  const startedSession = staffDomain.buildNextSessionState(confirmedSession, 'start');
  assert.equal(startedSession.stageKey, 'playing');

  const settledSession = staffDomain.buildNextSessionState(startedSession, 'end');
  assert.equal(settledSession.stageKey, 'settled');

  const invalidStart = staffDomain.validateSessionAction(firstSession, 'start');
  assert.equal(invalidStart.ok, false);

  const invalidToggle = staffDomain.validateSessionMemberToggle(confirmedSession, 'non-existent-open-id');
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
      { openId: '1', contactName: '阿哲', contactPhone: '13900000001', role: 'creator', status: 'active' },
      { openId: '2', contactName: '小林', contactPhone: '13900000002', role: 'member', status: 'active' },
    ],
  });

  assert.equal(settledSession.stageKey, 'settled');
  assert.equal(settledSession.members.every((item) => item.status === '已结算'), true);

  const invalidCloudAction = cloudStaffDomain.validateSessionAction(settledSession, 'end');
  assert.equal(invalidCloudAction.ok, false);
}

function testRuntimeEnvConfig() {
  const releaseConfig = envConfig.getRuntimeConfig('release');
  assert.equal(releaseConfig.dataEnvTag, 'prod');
  assert.equal(releaseConfig.allowInitData, false);
  assert.equal(releaseConfig.allowMockFallback, false);

  const trialConfig = envConfig.getRuntimeConfig('trial');
  assert.equal(trialConfig.dataEnvTag, 'prod');
  assert.equal(trialConfig.allowInitData, false);
  assert.equal(trialConfig.allowMockFallback, false);

  const developConfig = envConfig.getRuntimeConfig('develop');
  assert.equal(developConfig.dataEnvTag, 'prod');
  assert.equal(developConfig.allowInitData, false);
  assert.equal(developConfig.allowMockFallback, false);

  const fallbackConfig = envConfig.getRuntimeConfig('unknown-env');
  assert.equal(fallbackConfig.envVersion, 'develop');
}

function testStaffProfileProvisioning() {
  const provisioned = cloudStaffProfileDomain.buildProvisionedProfile(
    'user-open-id-001',
    {
      nickname: '店员看到的玩家',
      contactPhone: '13900000011',
    },
    '2026-04-02T08:00:00.000Z'
  );
  assert.equal(provisioned._id, 'user-open-id-001');
  assert.equal(provisioned.nickname, '店员看到的玩家');
  assert.equal(provisioned.contactPhone, '13900000011');
  assert.equal(provisioned.createdAt, '2026-04-02T08:00:00.000Z');

  const seededExisting = cloudStaffProfileDomain.applyIdentitySeed(
    {
      _id: 'user-open-id-002',
      nickname: '档案室常客',
      contactPhone: '',
    },
    {
      contactName: '阿木',
      contactPhone: '13900000006',
    }
  );
  assert.equal(seededExisting.nickname, '阿木');
  assert.equal(seededExisting.contactPhone, '13900000006');

  const settledProfile = cloudStaffProfileDomain.applySessionSettlement(
    cloudStaffProfileDomain.buildProvisionedProfile(
      'user-open-id-003',
      {
        nickname: '结算玩家',
        contactPhone: '13900000012',
      },
      '2026-04-02T10:00:00.000Z'
    ),
    {
      id: 'session-001',
      themeId: 'theme-shixiong',
      themeName: '尸兄',
      horror: '微恐',
      teamSize: 4,
      lateNight: false,
      playDate: '03月30日',
      timeSlot: '19:30',
      endedAt: '2026-04-02T12:00:00.000Z',
      growthValue: 18,
    }
  );
  assert.equal(settledProfile.nickname, '结算玩家');
  assert.equal(settledProfile.contactPhone, '13900000012');
  assert.equal(settledProfile.totalPlayCount, 1);
}

function main() {
  testProfileNormalization();
  testCloudProfileProvisioning();
  testGroupValidationAndConflict();
  testStaffBindingAndSessionFlow();
  testStaffDashboardNormalization();
  testProfilePendingPatchMatch();
  testCloudStaffSessionRespectsRoomStage();
  testRuntimeEnvConfig();
  testStaffProfileProvisioning();
  console.log('业务规则校验通过');
}

main();
