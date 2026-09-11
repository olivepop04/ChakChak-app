import test from 'node:test';
import assert from 'node:assert/strict';
import { getActionCta } from '../lib/utils/action-cta.ts';
import type { ActionCta, ActionCtaInput } from '../lib/utils/action-cta.ts';

const ID = 'a1';
const 미래 = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
const 과거 = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

/** 기본값 — 아직 활동 전인 모집 중 액션을, 참여한 적 없는 사람이 본다 */
function 입력(덮어쓰기: Partial<ActionCtaInput> = {}): ActionCtaInput {
  return {
    actionId: ID,
    status: 'ACTIVE',
    isOwner: false,
    myParticipation: null,
    activityEndAt: 미래,
    recruitClosed: false,
    allItemsFull: false,
    ...덮어쓰기,
  };
}

/** 버튼이 하나일 때의 문구. 둘짜리·없는 경우는 null */
function 문구(cta: ActionCta): string | null {
  return 'label' in cta ? cta.label : null;
}

// ── 호스트 ────────────────────────────────────────────────

test('호스트 · 활동 종료 전이면 크루챗 하나', () => {
  const cta = getActionCta(입력({ isOwner: true }));
  assert.equal(cta.type, 'link');
  assert.equal(문구(cta), '함께하는 크루와 이야기하기');
});

test('호스트 · 활동이 끝나면 크루챗과 결과 작성 둘 다', () => {
  const cta = getActionCta(입력({ isOwner: true, status: 'ENDED' }));
  assert.equal(cta.type, 'host_ended_write_result');
  assert.equal(cta.writeHref, '/action/' + ID + '/result/write');
  assert.equal(cta.chatHref, '/action/' + ID + '/chat');
});

test('★ 조기 종료된 액션에서도 결과 작성 버튼이 남는다', () => {
  // 조기 종료는 예정 종료와 똑같이 흘러갑니다 (CLAUDE.md 규칙 11).
  // 여기서 크루챗 하나만 남기면 배지는 '결과 작성 필요' 인데
  // 누를 것이 없는 화면이 됩니다. 2026-09-08 에 실제로 그랬습니다.
  const cta = getActionCta(입력({
    isOwner: true,
    status: 'ENDED',
    activityEndAt: 미래, // 예정 종료 시각은 아직 안 왔다 = 일찍 끝냈다
  }));
  assert.equal(cta.type, 'host_ended_write_result');
});

test('호스트 · 상태가 아직 ACTIVE 여도 종료 시각이 지났으면 결과 작성', () => {
  // sync_action_status 가 돌기 전 잠깐 생기는 틈
  const cta = getActionCta(입력({ isOwner: true, activityEndAt: 과거 }));
  assert.equal(cta.type, 'host_ended_write_result');
});

test('호스트 · 결과가 나온 뒤에는 결과 보기', () => {
  const cta = getActionCta(입력({ isOwner: true, status: 'COMPLETED' }));
  assert.deepEqual(cta, { type: 'link', label: '결과 보기', href: '/action/' + ID + '/result' });
});

test('호스트 · 취소한 액션은 누를 것이 없다', () => {
  const cta = getActionCta(입력({ isOwner: true, status: 'CANCELLED' }));
  assert.deepEqual(cta, { type: 'disabled', label: '취소된 액션이에요' });
});

// ── 참여한 크루 ───────────────────────────────────────────

test('참여한 크루는 언제든 크루챗으로 간다', () => {
  const 참여중 = ['BEFORE_ACTION', 'AFTER_ACTION', 'ACTUALLY_PARTICIPATED'] as const;
  for (const 상태 of 참여중) {
    const cta = getActionCta(입력({ myParticipation: 상태, status: 'ENDED' }));
    assert.equal(cta.type, 'link', 상태);
    assert.equal(cta.isCrewChat, true, 상태);
  }
});

test('나간 사람은 크루가 아니다', () => {
  const cta = getActionCta(입력({ myParticipation: 'LEFT' }));
  assert.equal(문구(cta), '참여하기');
});

test('취소된 액션은 참여했던 사람에게도 막힌다', () => {
  const cta = getActionCta(입력({ myParticipation: 'BEFORE_ACTION', status: 'CANCELLED' }));
  assert.deepEqual(cta, { type: 'disabled', label: '취소된 액션이에요' });
});

// ── 참여하지 않은 사람 ────────────────────────────────────

test('모집 중이면 참여하기', () => {
  const cta = getActionCta(입력());
  assert.deepEqual(cta, { type: 'link', label: '참여하기', href: '/action/' + ID + '/join' });
});

test('모집 마감 · 정원 마감 · 활동 종료는 각각 다른 문구를 쓴다', () => {
  assert.equal(문구(getActionCta(입력({ recruitClosed: true }))), '모집이 마감되었어요');
  assert.equal(문구(getActionCta(입력({ allItemsFull: true }))), '모집이 완료되었어요');
  assert.equal(문구(getActionCta(입력({ status: 'ENDED' }))), '활동이 끝났어요');
});

test('활동 종료가 모집 마감보다 먼저 걸린다', () => {
  // 둘 다 해당될 때 '모집이 마감되었어요' 라고 하면 아직 기회가 있는 것처럼 읽힙니다
  const cta = getActionCta(입력({ status: 'ENDED', recruitClosed: true, allItemsFull: true }));
  assert.equal(문구(cta), '활동이 끝났어요');
});

test('결과가 나오면 참여 안 한 사람도 결과를 볼 수 있다', () => {
  const cta = getActionCta(입력({ status: 'COMPLETED' }));
  assert.equal(문구(cta), '결과 보기');
});

test('now 를 넘기면 그 시각 기준으로 판단한다', () => {
  const 끝난뒤 = new Date(Date.now() + 1000 * 60 * 60 * 48);
  const cta = getActionCta(입력({ isOwner: true, now: 끝난뒤 }));
  assert.equal(cta.type, 'host_ended_write_result');
});

// ── DRAFT (2026-09-11 추가) ────────────────────────────────
// 전에는 DRAFT 가 호스트 갈래로 떨어져서 「함께하는 크루와 이야기하기」 가 나왔습니다.
// 누르면 크루가 없는 빈 게시판이 열리고, 그 화면 안내는
// 「완료된 액션이라 새 글을 쓸 수 없어요」 였습니다 — 「작성 중」 인데요.

test('아직 공개 전(DRAFT)이면 호스트를 이어서 쓰는 화면으로 보낸다', () => {
  const cta = getActionCta(입력({ status: 'DRAFT', isOwner: true }));
  assert.equal(cta.type, 'link');
  assert.equal(문구(cta), '이어서 작성하기');
  // Activity 「작성중」 탭의 「계속 작성하기」 와 같은 곳
  assert.equal(cta.type === 'link' ? cta.href : '', `/action/create?id=${ID}`);
});

test('DRAFT 에서는 크루챗으로 보내지 않는다 — 크루가 있을 수 없다', () => {
  const cta = getActionCta(입력({ status: 'DRAFT', isOwner: true }));
  assert.notEqual(문구(cta), '함께하는 크루와 이야기하기');
  assert.equal('isCrewChat' in cta ? cta.isCrewChat : false, false);
});

test('남의 DRAFT 는 막는다 (RLS 가 먼저 가리지만 규칙도 둔다)', () => {
  assert.equal(
    문구(getActionCta(입력({ status: 'DRAFT', isOwner: false }))),
    '아직 공개 전인 액션이에요',
  );
});

test('DRAFT 는 활동 종료 시각이 지나도 결과 작성으로 넘어가지 않는다', () => {
  // 공개한 적이 없으니 결과를 쓸 일이 없습니다
  const 끝난뒤 = new Date(Date.now() + 1000 * 60 * 60 * 48);
  const cta = getActionCta(입력({ status: 'DRAFT', isOwner: true, now: 끝난뒤 }));
  assert.equal(문구(cta), '이어서 작성하기');
});
