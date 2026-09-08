import test from 'node:test';
import assert from 'node:assert/strict';

function getHostActionCapabilities(params: {
  status: string;
  activityStartAt: string | null;
  activityEndAt: string | null;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const isStarted = params.activityStartAt ? now >= new Date(params.activityStartAt) : false;
  const isPastActivityEnd = params.activityEndAt ? now > new Date(params.activityEndAt) : false;

  const canCancel = params.status === 'ACTIVE' && !isStarted;
  const canEarlyEnd = params.status === 'ACTIVE' && isStarted && !isPastActivityEnd;

  return { canCancel, canEarlyEnd, isStarted, isPastActivityEnd };
}

test('활동 시작 전에는 취소만 가능하고 조기 종료는 불가하다', () => {
  const futureStart = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const futureEnd = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString();

  const cap = getHostActionCapabilities({
    status: 'ACTIVE',
    activityStartAt: futureStart,
    activityEndAt: futureEnd,
  });

  assert.equal(cap.canCancel, true);
  assert.equal(cap.canEarlyEnd, false);
});

test('활동 진행 중에는 취소가 숨겨지고 조기 종료만 가능하다', () => {
  const pastStart = new Date(Date.now() - 1000 * 60 * 60).toISOString();
  const futureEnd = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const cap = getHostActionCapabilities({
    status: 'ACTIVE',
    activityStartAt: pastStart,
    activityEndAt: futureEnd,
  });

  assert.equal(cap.canCancel, false);
  assert.equal(cap.canEarlyEnd, true);
});

test('활동 종료일 이후에는 취소 및 조기 종료가 모두 불가하다', () => {
  const pastStart = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
  const pastEnd = new Date(Date.now() - 1000 * 60 * 60).toISOString();

  const cap = getHostActionCapabilities({
    status: 'ACTIVE',
    activityStartAt: pastStart,
    activityEndAt: pastEnd,
  });

  assert.equal(cap.canCancel, false);
  assert.equal(cap.canEarlyEnd, false);
});

test('ENDED 또는 COMPLETED 또는 CANCELLED 상태에서는 취소/조기종료가 불가하다', () => {
  for (const status of ['ENDED', 'COMPLETED', 'CANCELLED']) {
    const cap = getHostActionCapabilities({
      status,
      activityStartAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      activityEndAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    });

    assert.equal(cap.canCancel, false, `${status} 상태에서는 취소 불가`);
    assert.equal(cap.canEarlyEnd, false, `${status} 상태에서는 조기종료 불가`);
  }
});
