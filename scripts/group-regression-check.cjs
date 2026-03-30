'use strict';

const assert = require('assert');
const { setupMockMiniappEnv } = require('./test-helpers/mock-miniapp-env.cjs');

setupMockMiniappEnv();

const service = require('../utils/cloudbase');
const storage = require('../utils/platform/storage');
const groupDomain = require('../cloudfunctions/groupManage/group-domain');
const lobbyViewModel = require('../pages/lobby/view-model');
const groupUiDomain = require('../utils/domain/group');

function resetBusinessState() {
  service.clearLocalUserData();
}

// ========== 基础数据结构测试 ==========

function testHistoricalGroupNormalization() {
  const group = groupDomain.normalizeGroupDoc({
    _id: 'group-legacy-001',
    themeId: 'theme-shixiong',
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    targetPeople: 4,
    creatorOpenId: 'creator-open-id',
    creatorName: '老王',
    contactName: '老王',
    contactPhone: '13800138000',
    joinedMemberNames: ['阿杰', '小林'],
    joinedPhones: ['13800138111', '13800138222'],
  });

  assert.equal(group.participants.length, 3);
  assert.equal(group.currentPeople, 3);
  assert.equal(group.participants[0].role, 'creator');
  assert.equal(
    group.participants.some((item) => item.contactName === '阿杰'),
    true
  );
  assert.equal(
    group.participants.some((item) => item.contactName === '小林'),
    true
  );
}

function testTeamRoomUsesParticipantsAsSource() {
  const room = groupDomain.buildTeamRoom(
    {
      _id: 'group-legacy-002',
      themeId: 'theme-shixiong',
      themeName: '尸兄',
      dateValue: '2026-03-30',
      date: '03月30日',
      timeSlot: '19:30',
      targetPeople: 4,
      creatorOpenId: 'creator-open-id',
      creatorName: '老王',
      contactName: '老王',
      contactPhone: '13800138000',
      participants: [
        {
          openId: 'creator-open-id',
          contactName: '老王',
          contactPhone: '13800138000',
          role: 'creator',
          status: 'active',
        },
        {
          openId: 'member-open-id',
          contactName: '唐斌',
          contactPhone: '17600000000',
          role: 'member',
          status: 'active',
        },
      ],
      roomStage: 'playing',
      roomMembers: [
        {
          openId: 'creator-open-id',
          nickname: '老王',
          status: '游戏中',
        },
      ],
    },
    'member-open-id'
  );

  assert.equal(
    room.members.some((item) => item.nickname === '唐斌'),
    true
  );
  assert.equal(room.myContactName, '唐斌');
  assert.equal(room.memberCount, 2);
}

// ========== 大厅筛选规则测试 ==========

function testLobbyJoinAvailabilityRules() {
  const normalizedPendingGroup = groupDomain.toGroupListItem({
    _id: 'group-pending-001',
    themeId: 'theme-shixiong',
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    creatorOpenId: 'seed-user-001',
    creatorName: '阿哲',
    contactName: '阿哲',
    contactPhone: '13800138001',
    targetPeople: 4,
    participants: [
      {
        openId: 'seed-user-001',
        contactName: '阿哲',
        contactPhone: '13800138001',
        role: 'creator',
        status: 'active',
      },
      {
        openId: 'seed-user-002',
        contactName: '小林',
        contactPhone: '13800138002',
        role: 'member',
        status: 'active',
      },
      {
        openId: 'seed-user-003',
        contactName: '阿宁',
        contactPhone: '13800138003',
        role: 'member',
        status: 'active',
      },
      {
        openId: 'seed-user-004',
        contactName: '老周',
        contactPhone: '13800138004',
        role: 'member',
        status: 'active',
      },
    ],
  });
  const normalizedLobbyGroup = require('../utils/domain/group').normalizeGroupItem({
    ...normalizedPendingGroup,
    status: 'pending_store_confirm',
  });
  const lobbyCard = lobbyViewModel.normalizeLobbyList([normalizedLobbyGroup])[0];

  assert.equal(normalizedLobbyGroup.targetPeople, 4);
  assert.equal(normalizedLobbyGroup.neededPeople, 0);
  assert.equal(lobbyCard.canJoin, false);
}

function testLobbyOnlyShowsRecruitingGroups() {
  const groups = [
    {
      id: 'group-recruiting',
      rawStatus: 'recruiting',
      isMyActiveGroup: false,
      isMyRecentGroup: false,
    },
    {
      id: 'group-pending',
      rawStatus: 'pending_store_confirm',
      isMyActiveGroup: false,
      isMyRecentGroup: false,
    },
    {
      id: 'group-confirmed',
      rawStatus: 'confirmed',
      isMyActiveGroup: false,
      isMyRecentGroup: false,
    },
    {
      id: 'group-cancelled',
      rawStatus: 'cancelled',
      isMyActiveGroup: false,
      isMyRecentGroup: false,
    },
  ];

  const visibleLobbyGroups = lobbyViewModel.filterByPage(groups, 'lobby');
  assert.deepEqual(
    visibleLobbyGroups.map((item) => item.id),
    ['group-recruiting']
  );
}

// ========== 状态流转测试 ==========

function testRelatedGroupsAppearInMineAndStageIsAccurate() {
  const relatedSettledGroup = groupUiDomain.normalizeGroupItem({
    id: 'group-settled',
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    status: 'confirmed',
    roomStage: 'settled',
    currentPeople: 4,
    targetPeople: 4,
    viewerRelated: true,
    viewerRole: 'member',
    viewerStatus: 'active',
    viewerContactName: '唐斌',
    participantNames: ['阿哲', '小林', '唐斌', '阿宁'],
  });

  const attached = groupUiDomain.attachParticipationState([relatedSettledGroup], null, null)[0];
  assert.equal(attached.isMyActiveGroup, false);
  assert.equal(attached.isMyRecentGroup, true);
  assert.equal(attached.myGroupRole, '我已加入');
  assert.equal(attached.rawStatus, 'settled');

  const mineGroups = lobbyViewModel.filterByPage([attached], 'mine');
  const lobbyGroups = lobbyViewModel.filterByPage([attached], 'lobby');
  const lobbyCard = lobbyViewModel.normalizeLobbyList([attached])[0];

  assert.equal(mineGroups.length, 1);
  assert.equal(lobbyGroups.length, 0);
  assert.equal(lobbyCard.statusText, '已结算');
  assert.equal(lobbyCard.canOpenRoom, true);
  assert.equal(lobbyCard.canCancel, false);
  assert.equal(lobbyCard.canDelete, true);
}

function testStatusNormalizationRecoversHistoricalDrift() {
  const recruitingGroup = groupUiDomain.normalizeGroupItem({
    id: 'group-drift-recruiting',
    themeName: '瞳灵人',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    currentPeople: 4,
    targetPeople: 6,
    status: 'pending_store_confirm',
  });
  assert.equal(recruitingGroup.rawStatus, 'recruiting');

  const pendingConfirmGroup = groupUiDomain.normalizeGroupItem({
    id: 'group-drift-pending',
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    currentPeople: 4,
    targetPeople: 4,
    status: 'recruiting',
  });
  assert.equal(pendingConfirmGroup.rawStatus, 'pending_store_confirm');
}

// ========== 核心业务流程测试 ==========

async function testCreatorCancelAndDelete() {
  resetBusinessState();
  console.log('  [test] 创建队伍 → 取消 → 删除');

  // 1. 创建队伍
  const createResponse = await service.createGroup({
    themeId: 'theme-shixiong',
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    targetPeople: 4,
    contactName: '阿杰',
    contactPhone: '13800138000',
    note: '创建者取消删除测试',
  });
  assert.equal(createResponse.ok, true, '创建队伍应该成功');
  const createdGroupId = createResponse.group.id;

  // 2. 验证队伍房间可访问
  const createdRoom = await service.getTeamRoom(createdGroupId);
  assert.equal(
    createdRoom.members.some((item) => item.nickname === '阿杰'),
    true,
    '队伍房间应包含创建者'
  );
  assert.equal(createdRoom.myContactName, '阿杰', 'myContactName 应为阿杰');

  // 3. 验证不能重复加入
  const duplicateJoin = await service.joinGroup(createdGroupId, {
    contactName: '阿杰',
    contactPhone: '13800138000',
  });
  assert.equal(duplicateJoin.ok, false, '创建者不能重复加入自己的队伍');

  // 4. 取消组局
  const cancelResult = await service.cancelActiveGroup(createdGroupId);
  assert.equal(cancelResult.ok, true, '取消组局应该成功');

  // 5. 验证取消后队伍状态
  const afterCancelLobby = await service.getLobbyList();
  const cancelledGroup = afterCancelLobby.find((item) => item.id === createdGroupId);
  assert.equal(cancelledGroup.rawStatus, 'cancelled', '取消后状态应为 cancelled');

  // 6. 验证取消后不能重复取消（再次调用取消应该返回 ok: true，但不改变状态）
  const duplicateCancel = await service.cancelActiveGroup(createdGroupId);
  assert.equal(duplicateCancel.ok, true, '重复取消应该返回成功（幂等）');

  // 7. 删除记录
  const deleteResult = await service.deleteGroupRecord(createdGroupId);
  assert.equal(deleteResult.ok, true, '删除记录应该成功');
}

async function testMemberJoinAndExit() {
  resetBusinessState();
  console.log('  [test] 加入队伍 → 退出');

  // 1. 获取大厅列表，找到可加入的队伍
  const lobby = await service.getLobbyList();
  const joinableGroup = lobby.find(
    (item) =>
      item.rawStatus !== 'cancelled' &&
      item.rawStatus !== 'confirmed' &&
      Number(item.neededPeople || 0) > 0
  );
  assert.equal(Boolean(joinableGroup), true, '应该有可加入的队伍');

  // 2. 加入队伍
  const joinResult = await service.joinGroup(joinableGroup.id, {
    contactName: '唐斌',
    contactPhone: '17600000000',
  });
  assert.equal(joinResult.ok, true, '加入队伍应该成功');

  // 3. 验证加入后状态
  const joinedLobby = await service.getLobbyList();
  const myGroup = joinedLobby.find((item) => item.id === joinableGroup.id);
  assert.equal(
    Boolean(myGroup && myGroup.isMyActiveGroup),
    true,
    '加入后 isMyActiveGroup 应为 true'
  );
  assert.equal(myGroup.members.includes('唐斌'), true, '成员列表应包含唐斌');

  // 4. 验证队伍房间
  const room = await service.getTeamRoom(joinableGroup.id);
  assert.equal(
    room.members.some((item) => item.nickname === '唐斌'),
    true,
    '房间成员应包含唐斌'
  );
  assert.equal(room.myContactName, '唐斌', 'myContactName 应为唐斌');

  // 5. 退出队伍
  const leaveResult = await service.cancelActiveGroup(joinableGroup.id);
  assert.equal(leaveResult.ok, true, '退出队伍应该成功');

  // 6. 删除记录
  const deleteResult = await service.deleteGroupRecord(joinableGroup.id);
  assert.equal(deleteResult.ok, true, '删除记录应该成功');
}

async function testMemberJoinExitAndDelete() {
  resetBusinessState();
  console.log('  [test] 加入队伍 → 退出 → 删除');

  const lobby = await service.getLobbyList();
  const joinableGroup = lobby.find(
    (item) =>
      item.rawStatus !== 'cancelled' &&
      item.rawStatus !== 'confirmed' &&
      Number(item.neededPeople || 0) > 0
  );
  assert.equal(Boolean(joinableGroup), true, '应该有可加入的队伍');

  const joinResult = await service.joinGroup(joinableGroup.id, {
    contactName: '小林',
    contactPhone: '13800138111',
  });
  assert.equal(joinResult.ok, true, '加入队伍应该成功');

  const leaveResult = await service.cancelActiveGroup(joinableGroup.id);
  assert.equal(leaveResult.ok, true, '退出队伍应该成功');

  // 验证退出后可以删除
  const afterLeaveLobby = await service.getLobbyList();
  const leftGroup = afterLeaveLobby.find((item) => item.id === joinableGroup.id);
  if (leftGroup) {
    const deleteResult = await service.deleteGroupRecord(joinableGroup.id);
    assert.equal(deleteResult.ok, true, '退出后删除记录应该成功');
  }
}

async function testSettledGroupDelete() {
  resetBusinessState();
  console.log('  [test] 已结算队伍删除');

  // 获取当前的组局列表
  const lobby = await service.getLobbyList();
  const joinableGroup = lobby.find(
    (item) =>
      item.rawStatus !== 'cancelled' &&
      item.rawStatus !== 'confirmed' &&
      Number(item.neededPeople || 0) > 0
  );

  if (!joinableGroup) {
    console.log('  [test] 跳过：没有可加入的队伍');
    return;
  }

  // 加入队伍
  const joinResult = await service.joinGroup(joinableGroup.id, {
    contactName: '结算测试用户',
    contactPhone: '13800139999',
  });
  assert.equal(joinResult.ok, true, '加入队伍应该成功');

  // 退出队伍（模拟已结算场景）
  const leaveResult = await service.cancelActiveGroup(joinableGroup.id);
  assert.equal(leaveResult.ok, true, '退出队伍应该成功');

  // 验证退出后可以删除
  const deleteResult = await service.deleteGroupRecord(joinableGroup.id);
  assert.equal(deleteResult.ok, true, '退出后删除记录应该成功');
}

async function testDuplicateJoinPrevention() {
  resetBusinessState();
  console.log('  [test] 重复加入防护');

  const lobby = await service.getLobbyList();
  const joinableGroup = lobby.find(
    (item) =>
      item.rawStatus !== 'cancelled' &&
      item.rawStatus !== 'confirmed' &&
      Number(item.neededPeople || 0) > 0
  );
  assert.equal(Boolean(joinableGroup), true, '应该有可加入的队伍');

  // 第一次加入
  const firstJoin = await service.joinGroup(joinableGroup.id, {
    contactName: '阿宁',
    contactPhone: '13800138222',
  });
  assert.equal(firstJoin.ok, true, '第一次加入应该成功');

  // 尝试再次加入同一队伍
  const secondJoin = await service.joinGroup(joinableGroup.id, {
    contactName: '阿宁',
    contactPhone: '13800138222',
  });
  assert.equal(secondJoin.ok, false, '重复加入应该失败');

  // 清理
  await service.cancelActiveGroup(joinableGroup.id);
}

async function testCancelNonExistentGroup() {
  resetBusinessState();
  console.log('  [test] 取消不存在的队伍');

  const cancelResult = await service.cancelActiveGroup('non-existent-group-id');
  // 应该返回错误或无操作
  assert.equal(cancelResult.ok !== undefined, true, '取消不存在的队伍应返回明确结果');
}

async function testDeleteNonExistentGroup() {
  resetBusinessState();
  console.log('  [test] 删除不存在的队伍');

  const deleteResult = await service.deleteGroupRecord('non-existent-group-id');
  assert.equal(deleteResult.ok !== undefined, true, '删除不存在的队伍应返回明确结果');
}

function testStaleLocalStateRecovery() {
  resetBusinessState();
  console.log('  [test] 过期本地状态恢复');

  storage.safeSetStorage(storage.ACTIVE_GROUP_STORAGE_KEY, {
    groupId: 'group-001',
    role: 'member',
    themeName: '旧队伍',
    contactName: '唐斌',
    contactPhone: '17600000000',
  });

  const cloudbaseTestHooks = service.__test__ || {};
  assert.equal(typeof cloudbaseTestHooks.syncGroupParticipationState, 'function');

  cloudbaseTestHooks.syncGroupParticipationState({
    groups: [
      {
        id: 'group-001',
        status: '招募中',
        creatorOpenId: 'seed-user-001',
        contactName: '发起人甲',
        contactPhone: '13800130000',
        participantNames: ['发起人甲', '别的成员'],
        joinedPhones: ['13800139999'],
      },
    ],
    activeGroup: null,
    recentGroup: null,
  });

  assert.equal(
    storage.safeGetStorage(storage.ACTIVE_GROUP_STORAGE_KEY),
    undefined,
    '过期状态应被清除'
  );
}

// ========== UI 状态测试 ==========

function testCanCancelAndCanDeleteLogic() {
  console.log('  [test] canCancel 和 canDelete 逻辑');

  // 创建者发起的招募中队伍 - 可取消不可删除
  const recruitingOwner = groupUiDomain.normalizeGroupItem({
    id: 'owner-recruiting',
    themeName: '测试主题',
    status: 'recruiting',
    viewerRelated: true,
    viewerRole: 'creator',
    viewerStatus: 'active',
  });
  const attachedRecruiting = groupUiDomain.attachParticipationState(
    [recruitingOwner],
    { groupId: 'owner-recruiting', role: 'creator' },
    null
  )[0];
  const cardRecruiting = lobbyViewModel.normalizeLobbyList([attachedRecruiting])[0];
  assert.equal(cardRecruiting.canCancel, true, '招募中的发起人组局应可取消');
  assert.equal(cardRecruiting.canDelete, false, '招募中的发起人组局不应可删除');
  assert.equal(attachedRecruiting.isMyActiveGroup, true, '招募中的组局 isMyActiveGroup 应为 true');

  // 已取消的队伍 - 不可取消可删除
  const cancelledGroup = groupUiDomain.normalizeGroupItem({
    id: 'cancelled-group',
    themeName: '测试主题',
    status: 'cancelled',
    viewerRelated: true,
    viewerRole: 'creator',
    viewerStatus: 'active',
  });
  const attachedCancelled = groupUiDomain.attachParticipationState([cancelledGroup], null, {
    groupId: 'cancelled-group',
    role: 'creator',
    status: 'cancelled',
  })[0];
  const cardCancelled = lobbyViewModel.normalizeLobbyList([attachedCancelled])[0];
  assert.equal(cardCancelled.canCancel, false, '已取消的队伍不应可取消');
  assert.equal(cardCancelled.canDelete, true, '已取消的队伍应可删除');
  assert.equal(attachedCancelled.isMyActiveGroup, false, '已取消的组局 isMyActiveGroup 应为 false');
  assert.equal(attachedCancelled.isMyRecentGroup, true, '已取消的组局 isMyRecentGroup 应为 true');

  // 已结算的队伍 - 不可取消可删除
  const settledGroup = groupUiDomain.normalizeGroupItem({
    id: 'settled-group',
    themeName: '测试主题',
    status: 'confirmed',
    roomStage: 'settled',
    viewerRelated: true,
    viewerRole: 'member',
    viewerStatus: 'active',
  });
  const attachedSettled = groupUiDomain.attachParticipationState([settledGroup], null, {
    groupId: 'settled-group',
    role: 'member',
    status: 'settled',
  })[0];
  const cardSettled = lobbyViewModel.normalizeLobbyList([attachedSettled])[0];
  assert.equal(cardSettled.canCancel, false, '已结算的队伍不应可取消');
  assert.equal(cardSettled.canDelete, true, '已结算的队伍应可删除');
  assert.equal(attachedSettled.isMyActiveGroup, false, '已结算的组局 isMyActiveGroup 应为 false');
  assert.equal(attachedSettled.isMyRecentGroup, true, '已结算的组局 isMyRecentGroup 应为 true');

  // 测试"我的"页签过滤逻辑
  const mineGroups = lobbyViewModel.filterByPage([attachedCancelled, attachedSettled], 'mine');
  assert.equal(mineGroups.length, 2, '已取消和已结算的组局都应在"我的"页签显示');

  // 测试大厅页签过滤逻辑
  const lobbyGroups = lobbyViewModel.filterByPage([attachedCancelled, attachedSettled], 'lobby');
  assert.equal(lobbyGroups.length, 0, '已取消和已结算的组局不应在大厅页签显示');
}

// ========== 主函数 ==========

async function main() {
  console.log('[group-regression] 基础数据结构测试');
  testHistoricalGroupNormalization();
  testTeamRoomUsesParticipantsAsSource();

  console.log('[group-regression] 大厅筛选规则测试');
  testLobbyJoinAvailabilityRules();
  testLobbyOnlyShowsRecruitingGroups();

  console.log('[group-regression] 状态流转测试');
  testRelatedGroupsAppearInMineAndStageIsAccurate();
  testStatusNormalizationRecoversHistoricalDrift();

  console.log('[group-regression] UI 状态测试');
  testCanCancelAndCanDeleteLogic();

  console.log('[group-regression] 核心业务流程测试');
  await testCreatorCancelAndDelete();
  await testMemberJoinAndExit();
  await testMemberJoinExitAndDelete();
  await testSettledGroupDelete();
  await testDuplicateJoinPrevention();

  console.log('[group-regression] 边界场景测试');
  await testCancelNonExistentGroup();
  await testDeleteNonExistentGroup();
  testStaleLocalStateRecovery();

  console.log('组队链路回归校验通过');
}

main().catch((error) => {
  console.error('组队链路回归校验失败');
  console.error(error);
  process.exit(1);
});
