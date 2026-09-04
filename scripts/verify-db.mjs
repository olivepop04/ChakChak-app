/**
 * 착착(CHAK CHAK) — DB 동작 검증
 *
 *   npm run verify:db
 *
 * 스키마(supabase/*.sql)를 바꾼 뒤에 돌려보세요.
 * 권한·정원·성별 제한이 실제로 막히는지 31가지를 확인합니다.
 *
 * 주의
 *  - 로컬에서만 돌아갑니다. .env.local 의 SERVICE_ROLE_KEY 를 씁니다.
 *  - 테스트 계정 3개와 액션 1개를 만들었다가 끝나면 전부 지웁니다.
 *  - 실서비스 DB에는 절대 돌리지 마세요.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let pass = 0, fail = 0;
const created = { users: [], action: null };

function ok(name, extra = '') {
  pass++; console.log(`  ✅ ${name}${extra ? '  — ' + extra : ''}`);
}
function no(name, extra = '') {
  fail++; console.log(`  ❌ ${name}${extra ? '  — ' + extra : ''}`);
}

async function makeUser(email, nickname, gender) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: 'test1234!', email_confirm: true,
    user_metadata: { name: nickname, nickname, gender },
  });
  if (error) throw new Error(`계정 생성 실패(${email}): ${error.message}`);
  created.users.push(data.user.id);
  return data.user.id;
}

async function asUser(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: 'test1234!' });
  if (error) throw new Error(`로그인 실패(${email}): ${error.message}`);
  return c;
}

const stamp = Date.now();
const emailA = `test-owner-${stamp}@example.com`;
const emailB = `test-female-${stamp}@example.com`;
const emailC = `test-male-${stamp}@example.com`;

try {
  // ── 1. 구조 확인 ──────────────────────────────────────────
  console.log('\n[1] 테이블 · 뷰 · 함수가 있는가');

  const tables = ['profiles','actions','action_items','participations',
    'participation_items','action_results','crew_voices','chat_messages',
    'notifications','action_ai_metadata','follows','saves','likes','ai_runs'];
  let missing = [];
  for (const t of tables) {
    const { error } = await admin.from(t).select('*', { head: true, count: 'exact' });
    if (error) missing.push(t);
  }
  missing.length === 0
    ? ok(`테이블 ${tables.length}개 전부 존재`)
    : no('테이블 누락', missing.join(', '));

  for (const v of ['action_item_progress','action_social_counts']) {
    const { error } = await admin.from(v).select('*', { head: true, count: 'exact' });
    error ? no(`뷰 ${v}`, error.message) : ok(`뷰 ${v}`);
  }

  const { data: buckets } = await admin.storage.listBuckets();
  const names = (buckets ?? []).map(b => b.id);
  ['action-images','result-images'].forEach(b =>
    names.includes(b) ? ok(`버킷 ${b}`) : no(`버킷 ${b} 없음`));

  // ── 2. 가입 트리거 ────────────────────────────────────────
  console.log('\n[2] 회원가입 시 profiles 행이 자동으로 생기는가  (T1)');

  const uidA = await makeUser(emailA, `owner${stamp}`, 'MALE');
  const uidB = await makeUser(emailB, `female${stamp}`, 'FEMALE');
  const uidC = await makeUser(emailC, `male${stamp}`, 'MALE');

  const { data: profs } = await admin.from('profiles')
    .select('id, nickname, gender').in('id', [uidA, uidB, uidC]);

  profs?.length === 3
    ? ok('계정 3개 → profiles 3행 자동 생성')
    : no('profiles 자동 생성 실패', `${profs?.length ?? 0}행만 생김`);

  const pb = profs?.find(p => p.id === uidB);
  pb?.gender === 'FEMALE'
    ? ok('성별이 올바르게 저장됨')
    : no('성별 저장 실패', String(pb?.gender));

  // ── 3. 액션 · 모집 항목 ───────────────────────────────────
  console.log('\n[3] 액션과 모집 항목 3종을 만들 수 있는가');

  const now = Date.now();
  const { data: act, error: actErr } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 테스트 액션', description: '자동 검증용',
    category: '동물', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    status: 'ACTIVE',
    recruit_end_at:    new Date(now + 3 * 86400000).toISOString(),
    activity_start_at: new Date(now + 4 * 86400000).toISOString(),
    activity_end_at:   new Date(now + 4 * 86400000 + 3 * 3600000).toISOString(),
  }).select('id').single();

  if (actErr) throw new Error('액션 생성 실패: ' + actErr.message);
  created.action = act.id;
  ok('액션 생성 (ACTIVE)');

  const { data: items, error: itemErr } = await admin.from('action_items').insert([
    { action_id: act.id, type: 'PERSON', name: '딱 한 자리', target_type: 'RANGE',
      min_required: 1, max_allowed: 1, unit: '명', gender_requirement: 'ANY', sort_order: 1 },
    { action_id: act.id, type: 'PERSON', name: '남성만', target_type: 'RANGE',
      min_required: 1, max_allowed: 1, unit: '명', gender_requirement: 'MALE', sort_order: 2 },
    { action_id: act.id, type: 'PERSON', name: '무제한', target_type: 'MINIMUM',
      min_required: 10, max_allowed: null, unit: '명', gender_requirement: 'ANY', sort_order: 3 },
    { action_id: act.id, type: 'GOODS', name: '분유', target_type: 'MINIMUM',
      min_required: 100, max_allowed: null, unit: '통', gender_requirement: 'ANY', sort_order: 4 },
  ]).select('id, name');

  if (itemErr) throw new Error('항목 생성 실패: ' + itemErr.message);
  ok('모집 항목 4개 생성 (RANGE 2 · MINIMUM 2)');

  const byName = Object.fromEntries(items.map(i => [i.name, i.id]));

  // CHECK 제약이 잘못된 조합을 막는가
  const { error: badErr } = await admin.from('action_items').insert({
    action_id: act.id, type: 'PERSON', name: '잘못된조합', target_type: 'MINIMUM',
    min_required: 5, max_allowed: 10, unit: '명', gender_requirement: 'ANY', sort_order: 9,
  });
  badErr ? ok('MINIMUM 에 max 를 넣으면 DB가 거절함')
         : no('CHECK 제약이 작동하지 않음 — MINIMUM+max 가 저장됨');

  // ── 3-b. AI 색인 저장 권한 ────────────────────────────────
  // 액션 공개 시 /api/ai/classify 가 여기에 행을 넣습니다.
  // INSERT 정책이 빠지면 "AI 는 성공했는데 색인은 비어 있는" 상태가 됩니다.
  console.log('');
  console.log('[3-b] Owner 가 AI 색인을 저장할 수 있는가');

  const cA = await asUser(emailA);
  const { error: metaErr } = await cA.from('action_ai_metadata').upsert({
    action_id: act.id,
    categories: ['동물'],
    activity_types: [], target_groups: [], participation_modes: [],
    skills: [], keywords: ['검증'],
    difficulty: null, ai_model: 'test', prompt_version: 'verify',
  });
  metaErr ? no('색인 저장 실패 — RLS INSERT 정책을 확인하세요', metaErr.message.slice(0, 50))
          : ok('Owner 가 action_ai_metadata 에 저장 가능');

  // ── 4. 성별 제한 ──────────────────────────────────────────
  console.log('\n[4] 항목별 성별 제한이 서버에서 막히는가  (D4)');

  const cB = await asUser(emailB);   // 여성
  const r1 = await cB.rpc('join_action', {
    p_action_id: act.id,
    p_items: [{ action_item_id: byName['남성만'], quantity: 1 }],
  });
  r1.error
    ? ok('여성이 남성 전용 항목 신청 → 거절', r1.error.message.slice(0, 45))
    : no('성별 제한이 뚫림');

  // ── 5. 정상 참여 · 중복 방지 ──────────────────────────────
  console.log('\n[5] 참여 신청과 중복 방지');

  const r2 = await cB.rpc('join_action', {
    p_action_id: act.id,
    p_items: [{ action_item_id: byName['딱 한 자리'], quantity: 1 }],
  });
  r2.error ? no('정상 참여 실패', r2.error.message) : ok('여성이 무제한 항목 참여 성공');

  const r3 = await cB.rpc('join_action', {
    p_action_id: act.id,
    p_items: [{ action_item_id: byName['무제한'], quantity: 1 }],
  });
  r3.error ? ok('이미 참여 중이면 거절', r3.error.message.slice(0, 30))
           : no('중복 참여가 허용됨');

  // ── 6. 정원 초과 ──────────────────────────────────────────
  console.log('\n[6] 정원이 찬 항목을 막는가  (T5 · 가장 중요)');

  const cC = await asUser(emailC);   // 남성
  const r4 = await cC.rpc('join_action', {
    p_action_id: act.id,
    p_items: [{ action_item_id: byName['딱 한 자리'], quantity: 1 }],
  });
  r4.error ? ok('1/1 찬 항목에 신청 → 거절', r4.error.message.slice(0, 45))
           : no('정원 초과가 뚫림 !!');

  const r5 = await cC.rpc('join_action', {
    p_action_id: act.id,
    p_items: [{ action_item_id: byName['무제한'], quantity: 1 }],
  });
  r5.error ? no('MINIMUM 항목 참여 실패', r5.error.message)
           : ok('MINIMUM 항목은 계속 신청 가능 (상한 없음)');

  // ── 7. 진행률 뷰 ──────────────────────────────────────────
  console.log('\n[7] 진행률 뷰가 올바른 숫자를 주는가  (T6)');

  const { data: prog } = await admin.from('action_item_progress')
    .select('name, current_count, is_full, is_min_met').eq('action_id', act.id);

  const one = prog?.find(p => p.name === '딱 한 자리');
  one?.current_count === 1 && one?.is_full === true
    ? ok('RANGE 1/1 → current_count 1, is_full true')
    : no('진행률 계산 오류', JSON.stringify(one));

  const unl = prog?.find(p => p.name === '무제한');
  unl?.current_count === 1 && unl?.is_full === false
    ? ok('MINIMUM → is_full 은 항상 false (마감 없음)')
    : no('MINIMUM 진행률 오류', JSON.stringify(unl));

  // ── 8. 나가기 ─────────────────────────────────────────────
  console.log('\n[8] 나가면 집계에서 빠지는가  (D6)');

  const r6 = await cB.rpc('leave_action', { p_action_id: act.id });
  r6.error ? no('나가기 실패', r6.error.message) : ok('나가기 성공');

  const { data: prog2 } = await admin.from('action_item_progress')
    .select('name, current_count').eq('action_id', act.id);
  const one2 = prog2?.find(p => p.name === '딱 한 자리');
  one2?.current_count === 0
    ? ok('나간 사람이 집계에서 제외됨 (1 → 0)')
    : no('LEFT 가 집계에 남아 있음', JSON.stringify(one2));

  // 나갔던 B 가 다시 신청 (LEFT -> BEFORE_ACTION 복귀 경로)
  const r7 = await cB.rpc('join_action', {
    p_action_id: act.id,
    p_items: [{ action_item_id: byName['딱 한 자리'], quantity: 1 }],
  });
  r7.error ? no('나갔던 사람이 재신청 실패', r7.error.message)
           : ok('나갔던 사람이 빈 자리에 재신청 가능');

  // 이미 다른 항목에 참여 중인 사람은 항목 추가 불가 (설계상 의도된 동작)
  const r8 = await cC.rpc('join_action', {
    p_action_id: act.id,
    p_items: [{ action_item_id: byName['분유'], quantity: 5 }],
  });
  r8.error ? ok('참여 중인 사람의 항목 추가는 막힘 (한 액션당 1행)', r8.error.message.slice(0, 25))
           : no('한 액션에 참여 행이 두 개 생김');

  // ── 9. RLS ────────────────────────────────────────────────
  console.log('\n[9] 비로그인 사용자가 막히는가  (T3 · T4)');

  const anon = createClient(URL, ANON, { auth: { persistSession: false } });

  const { data: pubActions } = await anon.from('actions').select('id').eq('id', act.id);
  pubActions?.length === 1 ? ok('비회원도 ACTIVE 액션은 열람 가능')
                           : no('비회원이 공개 액션을 못 봄');

  const { data: parts } = await anon.from('participations').select('id').eq('action_id', act.id);
  (parts?.length ?? 0) === 0
    ? ok('비회원은 참여자 명단을 볼 수 없음 (OR true 제거 확인)')
    : no('참여자 명단이 공개됨 !!', `${parts.length}행 노출`);

  const { data: cnt } = await anon.from('action_social_counts')
    .select('crew_count').eq('action_id', act.id).maybeSingle();
  cnt ? ok('비회원도 집계 숫자는 볼 수 있음', `참여 ${cnt.crew_count}명`)
      : no('집계 뷰를 비회원이 못 읽음');

  const { error: writeErr } = await anon.from('actions')
    .update({ title: '해킹' }).eq('id', act.id);
  const { data: after } = await admin.from('actions').select('title').eq('id', act.id).single();
  after.title !== '해킹' ? ok('비회원이 남의 액션을 수정할 수 없음')
                        : no('비회원이 액션을 수정함 !!');

  // ── 10. 게시판 ────────────────────────────────────────────
  console.log('\n[10] 게시판 권한과 대댓글 차단');

  const { data: post, error: postErr } = await cC.from('chat_messages')
    .insert({ action_id: act.id, user_id: uidC, content: '안녕하세요' })
    .select('id').single();
  postErr ? no('참여자가 글을 못 씀', postErr.message) : ok('참여자가 원글 작성 가능');

  if (post) {
    const { data: reply } = await cC.from('chat_messages')
      .insert({ action_id: act.id, user_id: uidC, parent_id: post.id, content: '댓글' })
      .select('id').single();
    reply ? ok('댓글 작성 가능') : no('댓글 작성 실패');

    if (reply) {
      const { error: deepErr } = await cC.from('chat_messages')
        .insert({ action_id: act.id, user_id: uidC, parent_id: reply.id, content: '대댓글' });
      deepErr ? ok('대댓글은 DB가 차단함', deepErr.message.slice(0, 30))
              : no('대댓글이 작성됨 !!');
    }

    const { error: delErr } = await cC.rpc('delete_chat_message', { p_message_id: post.id });
    delErr ? no('삭제 실패', delErr.message) : ok('본인 글 삭제 성공');

    const { data: afterDel } = await admin.from('chat_messages')
      .select('id, deleted_at').eq('action_id', act.id);
    const allDeleted = (afterDel ?? []).every(m => m.deleted_at !== null);
    allDeleted ? ok('원글을 지우면 댓글도 함께 삭제됨 (D7)')
               : no('댓글이 남아 있음');
  }

  const { data: chatAsAnon } = await anon.from('chat_messages').select('id').eq('action_id', act.id);
  (chatAsAnon?.length ?? 0) === 0 ? ok('비회원은 게시판을 볼 수 없음')
                                  : no('게시판이 공개됨 !!');

  // ── 11. 2026-09-01 개편분 ─────────────────────────────────
  console.log('\n[11] 개편분 — 알림 끄기 · 수정 잠금 · 나가기 사유');

  // 알림 켜고 끄기 (F25) — 끈 종류는 아예 안 쌓여야 한다
  await admin.from('profiles').update({ notify_off: ['SCHEDULE'] }).eq('id', uidB);
  const kMuted = `V_MUTED:${stamp}`;
  await admin.from('notifications').insert({
    user_id: uidB, type: 'SCHEDULE', action_id: act.id, event_key: kMuted,
  });
  const { count: mutedCnt } = await admin.from('notifications')
    .select('*', { count: 'exact', head: true }).eq('event_key', kMuted);
  mutedCnt === 0 ? ok('끈 알림은 만들어지지 않음 (F25)')
                 : no('끈 알림이 쌓임 !!', String(mutedCnt));

  const kOn = `V_ON:${stamp}`;
  await admin.from('notifications').insert({
    user_id: uidB, type: 'INVITED', action_id: act.id, event_key: kOn,
  });
  const { count: onCnt } = await admin.from('notifications')
    .select('*', { count: 'exact', head: true }).eq('event_key', kOn);
  onCnt === 1 ? ok('안 끈 알림은 정상 저장')
              : no('안 끈 알림이 막힘 !!');
  await admin.from('profiles').update({ notify_off: [] }).eq('id', uidB);

  // 공개된 액션 수정 잠금 (F41)
  const { error: lockErr } = await cA.from('actions')
    .update({ title: '제목을 몰래 바꿔본다' }).eq('id', act.id);
  lockErr ? ok('공개 후 제목 변경 거절됨 (F41)', lockErr.message.slice(0, 40))
          : no('공개된 액션의 제목이 바뀜 !!');

  const { error: dateErr } = await cA.from('actions')
    .update({ activity_start_at: new Date(now + 99 * 86400000).toISOString() })
    .eq('id', act.id);
  dateErr ? ok('공개 후 날짜 변경 거절됨 (F41)')
          : no('공개된 액션의 날짜가 바뀜 !!');

  const { error: descErr } = await cA.from('actions')
    .update({ description: '소개는 고칠 수 있어야 한다', notice: '안내사항도' })
    .eq('id', act.id);
  descErr ? no('소개·안내사항 수정이 막힘', descErr.message.slice(0, 40))
          : ok('소개·안내사항은 수정 가능 (F41)');

  // 나가기 + 사유 (F40)
  const rShort = await cC.rpc('leave_action_with_reason', {
    p_action_id: act.id, p_reason: '짧음',
  });
  rShort.error ? ok('짧은 사유는 거절됨 (F40)', rShort.error.message.slice(0, 32))
               : no('5자 미만 사유가 통과됨');

  const { count: beforeChat } = await admin.from('chat_messages')
    .select('*', { count: 'exact', head: true }).eq('action_id', act.id);

  const rLeave = await cC.rpc('leave_action_with_reason', {
    p_action_id: act.id,
    p_reason: '갑자기 출장이 잡혀서 참여가 어렵게 됐습니다. 죄송합니다.',
  });
  if (rLeave.error) {
    no('사유 남기고 나가기 실패', rLeave.error.message.slice(0, 60));
  } else {
    ok('사유 남기고 나가기 성공 (F40)');

    const { data: notice } = await admin.from('chat_messages')
      .select('kind, content, user_id').eq('action_id', act.id).eq('kind', 'LEFT_NOTICE');
    (notice?.length ?? 0) === 1
      ? ok('사유가 게시판에 LEFT_NOTICE 로 남음')
      : no('게시판에 사유가 없음', `${notice?.length ?? 0}건 · 이전 ${beforeChat}건`);

    const { data: pRow } = await admin.from('participations')
      .select('status').eq('action_id', act.id).eq('user_id', uidC).maybeSingle();
    pRow?.status === 'LEFT' ? ok('참여 상태가 LEFT 로 바뀜')
                            : no('상태가 안 바뀜', String(pRow?.status));

    const { data: notif } = await admin.from('notifications')
      .select('type, body, user_id').eq('action_id', act.id).eq('type', 'LEFT_CREW');
    const mine = (notif ?? []).find(n => n.user_id === uidA);
    mine ? ok('호스트에게 알림 + 사유 전달됨', String(mine.body).slice(0, 22) + '…')
         : no('호스트 알림이 없음');
  }

  const rTwice = await cC.rpc('leave_action_with_reason', {
    p_action_id: act.id, p_reason: '이미 나갔는데 또 나가본다',
  });
  rTwice.error ? ok('이미 나간 사람은 거절됨')
               : no('중복 나가기가 허용됨');

  // ── 12. 참여 항목 가시성 (F45 · 07_update.sql) ────────────
  console.log('\n[12] 누가 어느 항목에 오는지 — 크루·호스트·외부인');

  // 사람 항목 2종 + 물품 1종 을 새로 만들어 세 명을 각각 참여시킨다
  const { data: f45Items } = await admin.from('action_items').insert([
    { action_id: act.id, type: 'PERSON', name: '1일차 배식팀', target_type: 'RANGE',
      min_required: 1, max_allowed: 4, unit: '명', gender_requirement: 'ANY', sort_order: 11 },
    { action_id: act.id, type: 'GOODS', name: '쌀', target_type: 'MINIMUM',
      min_required: 20, max_allowed: null, unit: 'kg', gender_requirement: 'ANY', sort_order: 12 },
  ]).select('id, name');
  const f45 = Object.fromEntries((f45Items ?? []).map(i => [i.name, i.id]));

  // uidB 는 이미 참여 중이므로 새 계정을 둘 만든다
  const emailD = `test-crew1-${stamp}@example.com`;
  const emailE = `test-out-${stamp}@example.com`;
  await makeUser(emailD, `crew1${stamp}`.slice(0, 20), 'MALE');
  await makeUser(emailE, `out${stamp}`.slice(0, 20), 'MALE');
  const cD = await asUser(emailD);
  const cE = await asUser(emailE);

  const rJoinD = await cD.rpc('join_action', {
    p_action_id: act.id,
    p_items: [
      { action_item_id: f45['1일차 배식팀'], quantity: 1 },
      { action_item_id: f45['쌀'], quantity: 10 },
    ],
  });

  if (rJoinD.error) {
    no('F45 준비: 참여 실패', rJoinD.error.message.slice(0, 50));
  } else {
    ok('사람 항목 + 물품 항목에 동시 참여');

    // 같은 크루(uidB)가 볼 때
    const { data: asCrew } = await cB.from('participation_items')
      .select(`quantity, item:action_items!participation_items_action_item_id_fkey ( name, type )`)
      .in('participation_id',
        (await admin.from('participations').select('id')
          .eq('action_id', act.id)).data.map(r => r.id));

    const crewNames = (asCrew ?? []).map(r => r.item?.name).filter(Boolean);
    const crewSeesPerson = crewNames.includes('1일차 배식팀');
    const crewSeesGoods = crewNames.includes('쌀')
      && (asCrew ?? []).filter(r => r.item?.name === '쌀').length > 0;

    crewSeesPerson ? ok('크루가 남의 사람 항목을 봄 (F45 동작)')
                   : no('크루가 사람 항목을 못 봄 — 07_update.sql 을 실행했는가');

    // 남이 낸 물품은 안 보여야 한다 (본인 것만 보임)
    const { data: goodsRows } = await cB.from('participation_items')
      .select(`quantity, participation:participations!inner ( user_id ),
               item:action_items!participation_items_action_item_id_fkey ( name, type )`)
      .eq('action_item_id', f45['쌀']);
    const othersGoods = (goodsRows ?? []).filter(r => r.participation?.user_id !== uidB);
    othersGoods.length === 0
      ? ok('남이 낸 물품 수량은 안 보임 (의도대로)')
      : no('물품 수량이 노출됨 !!', `${othersGoods.length}건`);

    // 호스트는 전부 본다
    const { data: asOwner } = await cA.from('participation_items')
      .select(`quantity, item:action_items!participation_items_action_item_id_fkey ( name )`)
      .eq('action_item_id', f45['쌀']);
    (asOwner ?? []).length > 0 ? ok('호스트는 물품까지 봄')
                               : no('호스트가 물품을 못 봄 !!');

    // 참여 안 한 사람은 명단 자체를 못 본다
    const { data: asOut } = await cE.from('participations')
      .select('id').eq('action_id', act.id);
    (asOut ?? []).length === 0 ? ok('미참여자는 참여자 명단을 못 봄')
                               : no('명단이 노출됨 !!', `${asOut.length}건`);
  }

  // ── 13. 액션 생애주기 (공개 → 종료 → 결과 → 소감) ────────
  //    이 구간은 그동안 검사가 없었습니다. 상태 전환 함수 5종을 한 번에 봅니다.
  console.log('\n[13] 공개 → 종료 → 결과 → 소감 흐름');

  const { data: lcAct } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 생애주기', description: '자동 검증용',
    category: '환경', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    place_name: '검증센터', status: 'DRAFT',
    recruit_end_at:    new Date(now + 1 * 86400000).toISOString(),
    activity_start_at: new Date(now + 2 * 86400000).toISOString(),
    activity_end_at:   new Date(now + 2 * 86400000 + 3600000).toISOString(),
  }).select('id').single();

  const { data: lcItems } = await admin.from('action_items').insert([{
    action_id: lcAct.id, type: 'PERSON', name: '참가자', target_type: 'RANGE',
    min_required: 1, max_allowed: 3, unit: '명', gender_requirement: 'ANY', sort_order: 1,
  }]).select('id');

  // 1) 공개
  const rPub = await cA.rpc('publish_action', { p_action_id: lcAct.id });
  rPub.error ? no('publish_action 실패', rPub.error.message.slice(0, 50))
             : ok('publish_action → ACTIVE');

  // 남이 남의 액션을 공개할 수 없어야 한다
  const rPubOther = await cB.rpc('publish_action', { p_action_id: lcAct.id });
  rPubOther.error ? ok('남의 액션은 공개할 수 없음')
                  : no('남이 공개할 수 있음 !!');

  // 2) 참여
  const rJoinLc = await cB.rpc('join_action', {
    p_action_id: lcAct.id,
    p_items: [{ action_item_id: lcItems[0].id, quantity: 1 }],
  });
  rJoinLc.error ? no('생애주기 참여 실패', rJoinLc.error.message.slice(0, 50))
                : ok('크루 참여');

  // 3) 활동이 끝나기 전에는 결과를 공개할 수 없어야 한다
  const rEarly = await cA.rpc('complete_action', { p_action_id: lcAct.id });
  rEarly.error ? ok('활동 전에는 결과 공개 불가', rEarly.error.message.slice(0, 32))
               : no('활동 전에 완료됨 !!');

  // 4) 시간을 지나가게 한다 — 트리거가 막으므로 DRAFT 로 잠깐 되돌린다
  //    (lock_published_action 은 공개된 액션의 날짜 변경을 막습니다)
  await admin.from('actions').update({ status: 'DRAFT' }).eq('id', lcAct.id);
  await admin.from('actions').update({
    recruit_end_at:    new Date(now - 3 * 86400000).toISOString(),
    activity_start_at: new Date(now - 2 * 86400000).toISOString(),
    activity_end_at:   new Date(now - 1 * 86400000).toISOString(),
  }).eq('id', lcAct.id);
  await admin.from('actions').update({ status: 'ACTIVE' }).eq('id', lcAct.id);

  const rSync = await admin.rpc('sync_action_status', { p_action_id: lcAct.id });
  const { data: afterSync } = await admin.from('actions')
    .select('status').eq('id', lcAct.id).single();
  afterSync?.status === 'ENDED'
    ? ok('활동 종료 시각이 지나면 ENDED 로 전환')
    : no('ENDED 전환 안 됨', String(afterSync?.status));

  const { count: reqCount } = await admin.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('action_id', lcAct.id).eq('type', 'RESULT_REQUEST');
  reqCount === 1 ? ok('호스트에게 결과 작성 요청 알림')
                 : no('RESULT_REQUEST 없음', String(reqCount));

  // 5) 결과 없이 완료하려 하면 막혀야 한다
  const rNoResult = await cA.rpc('complete_action', { p_action_id: lcAct.id });
  rNoResult.error ? ok('결과 없이는 완료 불가', rNoResult.error.message.slice(0, 32))
                  : no('결과 없이 완료됨 !!');

  // 6) 결과 저장 → 완료
  const { error: resErr } = await cA.from('action_results').upsert({
    action_id: lcAct.id, content: '잘 마쳤습니다.',
    image_urls: ['https://example.com/r.jpg'], owner_voice: '고맙습니다',
  }, { onConflict: 'action_id' });
  resErr ? no('결과 저장 실패', resErr.message.slice(0, 50)) : ok('결과 저장');

  const rDone = await cA.rpc('complete_action', { p_action_id: lcAct.id });
  rDone.error ? no('complete_action 실패', rDone.error.message.slice(0, 50))
              : ok('complete_action → COMPLETED');

  const { count: pubCount } = await admin.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('action_id', lcAct.id).eq('type', 'RESULT_PUBLISHED');
  pubCount >= 1 ? ok('크루에게 결과 공개 알림')
                : no('RESULT_PUBLISHED 없음', String(pubCount));

  // 7) 소감 — 저장과 상태 전환이 한 트랜잭션인가
  const rShortVoice = await cB.rpc('submit_crew_voice', {
    p_action_id: lcAct.id, p_content: '짧음',
  });
  rShortVoice.error ? ok('너무 짧은 소감은 거절')
                    : no('10자 미만 소감이 통과됨');

  const rVoice = await cB.rpc('submit_crew_voice', {
    p_action_id: lcAct.id, p_content: '처음이라 걱정했는데 정말 좋았습니다. 또 참여하고 싶어요.',
  });
  rVoice.error ? no('소감 저장 실패', rVoice.error.message.slice(0, 50))
               : ok('소감 저장');

  const { data: lcPart } = await admin.from('participations')
    .select('status').eq('action_id', lcAct.id).eq('user_id', uidB).maybeSingle();
  lcPart?.status === 'ACTUALLY_PARTICIPATED'
    ? ok('소감을 쓰면 참여 상태가 함께 바뀜 (한 트랜잭션)')
    : no('상태가 안 바뀜', String(lcPart?.status));

  const rTwiceVoice = await cB.rpc('submit_crew_voice', {
    p_action_id: lcAct.id, p_content: '같은 액션에 두 번째 소감을 써봅니다.',
  });
  rTwiceVoice.error ? ok('같은 액션에 소감을 두 번 쓸 수 없음')
                    : no('소감 중복 작성이 허용됨');

  // 8) 좋아요 · 저장 · 팔로우
  const { error: likeErr } = await cB.from('likes')
    .insert({ action_id: lcAct.id, user_id: uidB });
  likeErr ? no('좋아요 실패', likeErr.message.slice(0, 40)) : ok('좋아요');
  const { error: saveErr } = await cB.from('saves')
    .insert({ action_id: lcAct.id, user_id: uidB });
  saveErr ? no('저장 실패', saveErr.message.slice(0, 40)) : ok('저장');

  const { data: socialRow } = await admin.from('action_social_counts')
    .select('like_count, save_count').eq('action_id', lcAct.id).maybeSingle();
  socialRow?.like_count === 1 && socialRow?.save_count === 1
    ? ok('좋아요·저장 수가 뷰에 반영됨')
    : no('집계 이상', JSON.stringify(socialRow));

  await admin.from('actions').delete().eq('id', lcAct.id);

  // ── 14. 활동이 시작된 뒤에는 나갈 수 없다 (09 · lazy 전환의 빈틈) ──
  //    활동이 이미 끝났는데 아무도 액션을 안 열면
  //    상태가 ACTIVE·BEFORE_ACTION 으로 남는다. 그 틈에도 못 나가야 한다.
  console.log('\n[14] 활동이 지났는데 상태 전환 전이면 나갈 수 있는가');

  const { data: gapAct } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 지나간 활동', description: '자동 검증용',
    category: '환경', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    status: 'ACTIVE',
    recruit_end_at:    new Date(now - 3 * 86400000).toISOString(),
    activity_start_at: new Date(now - 2 * 86400000).toISOString(),
    activity_end_at:   new Date(now - 1 * 86400000).toISOString(),
  }).select('id').single();
  const { data: gapItem } = await admin.from('action_items').insert({
    action_id: gapAct.id, type: 'PERSON', name: '참가자', target_type: 'MINIMUM',
    min_required: 1, max_allowed: null, unit: '명', gender_requirement: 'ANY', sort_order: 1,
  }).select('id').single();
  const { data: gapPart } = await admin.from('participations')
    .insert({ action_id: gapAct.id, user_id: uidB, status: 'BEFORE_ACTION' })
    .select('id').single();
  await admin.from('participation_items')
    .insert({ participation_id: gapPart.id, action_item_id: gapItem.id, quantity: 1 });

  const rGap1 = await cB.rpc('leave_action_with_reason', {
    p_action_id: gapAct.id, p_reason: '활동이 끝났는데 나가봅니다. 막혀야 합니다.',
  });
  rGap1.error
    ? ok('사유 나가기: 활동 시작 후 거절', rGap1.error.message.slice(0, 28))
    : no('활동이 끝났는데 사유 나가기 성공 !! — 09_update.sql 을 실행했는가');

  const rGap2 = await cB.rpc('leave_action', { p_action_id: gapAct.id });
  rGap2.error
    ? ok('일반 나가기: 활동 시작 후 거절')
    : no('활동이 끝났는데 나가기 성공 !! — 09_update.sql 을 실행했는가');

  const { count: gapNotice } = await admin.from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('action_id', gapAct.id).eq('kind', 'LEFT_NOTICE');
  gapNotice === 0
    ? ok('끝난 활동 게시판에 사유 글이 안 올라감')
    : no('거절됐는데 게시판에 글이 남음 !!', String(gapNotice));

  await admin.from('actions').delete().eq('id', gapAct.id);


  // ═══════════════════════════════════════════════════════════
  console.log('\n[15] 재능 · 공유 수 · 모집 항목 잠금 (10)');

  // ── 재능: NULL 과 빈 배열이 구분되는가 ──
  // 섞이면 "재능 없다고 답한 사람" 에게 AI 가 계속 재능을 묻습니다.
  const { data: skNew } = await admin
    .from('profiles').select('skills').eq('id', uidA).single();
  skNew.skills === null
    ? ok('새 사용자의 재능은 null (아직 안 물어봄)')
    : no('새 사용자에게 기본값이 들어감 !! — 컬럼에 DEFAULT 가 있는가', JSON.stringify(skNew.skills));

  await cA.from('profiles').update({ skills: [] }).eq('id', uidA);
  const { data: skNone } = await admin
    .from('profiles').select('skills').eq('id', uidA).single();
  Array.isArray(skNone.skills) && skNone.skills.length === 0
    ? ok('"재능 없음" 은 빈 배열로 저장됨 (null 과 구분)')
    : no('빈 배열이 null 로 바뀜 !!', JSON.stringify(skNone.skills));

  await cA.from('profiles').update({ skills: ['사진 촬영'] }).eq('id', uidA);
  const { data: skSome } = await admin
    .from('profiles').select('skills').eq('id', uidA).single();
  skSome.skills?.[0] === '사진 촬영'
    ? ok('재능이 저장되고 다시 읽힘')
    : no('재능 저장 실패 !!', JSON.stringify(skSome.skills));

  // ── 공유 수: 공유하면 1 늘어나는가 ──
  const { data: shBefore } = await admin
    .from('action_social_counts').select('share_count')
    .eq('action_id', created.action).single();
  await cB.rpc('notify_invite', { p_action_id: created.action, p_target: uidA });
  const { data: shAfter } = await admin
    .from('action_social_counts').select('share_count')
    .eq('action_id', created.action).single();
  (shAfter.share_count ?? 0) === (shBefore.share_count ?? 0) + 1
    ? ok('공유하면 share_count 가 1 늘어남')
    : no('공유 수가 안 늘어남 !! — 10_update.sql 을 실행했는가',
         `${shBefore.share_count} → ${shAfter.share_count}`);

  // 남의 공유 기록은 안 보여야 한다 (likes·saves 와 같은 규칙)
  const { data: shMine } = await cA.from('shares').select('id');
  (shMine ?? []).length === 0
    ? ok('남의 공유 기록은 안 보임')
    : no('남의 공유 기록이 보임 !!', String(shMine.length));

  // ── 모집 항목 잠금: 공개된 액션은 추가만 ──
  const { data: pubItem } = await admin.from('action_items')
    .select('id, name').eq('action_id', created.action).limit(1).single();

  const rItemUpd = await cA.from('action_items')
    .update({ name: pubItem.name }).eq('id', pubItem.id);
  rItemUpd.error
    ? ok('공개된 액션의 항목 수정 거절', rItemUpd.error.message.slice(0, 26))
    : no('공개된 액션의 항목이 수정됨 !! — 10_update.sql 을 실행했는가');

  await cA.from('action_items').delete().eq('id', pubItem.id);
  const { count: stillThere } = await admin.from('action_items')
    .select('*', { count: 'exact', head: true }).eq('id', pubItem.id);
  stillThere === 1
    ? ok('공개된 액션의 항목 삭제 거절 — 참여 기록이 지켜짐')
    : no('공개된 액션의 항목이 삭제됨 !! — 크루의 참여 기록이 함께 날아갑니다');

  const rItemAdd = await cA.from('action_items').insert({
    action_id: created.action, type: 'GOODS', name: '[검증] 나중에 추가한 물품',
    target_type: 'MINIMUM', min_required: 1, max_allowed: null, unit: '개',
    gender_requirement: 'ANY', condition_name: null, condition_desc: null,
    sort_order: 99,
  });
  rItemAdd.error
    ? no('공개된 액션에 항목 추가가 막힘 !! — 추가는 되어야 합니다', rItemAdd.error.message.slice(0, 40))
    : ok('공개된 액션에 항목 추가는 허용됨');


  // ═══════════════════════════════════════════════════════════
  console.log('\n[16] 화면 말고 서버가 막는가 (11)');

  // ── ① 참여 취소 사유는 본인도 못 지운다 ──
  // 화면에는 삭제 버튼이 없지만, RPC 를 직접 부르면 통과했었다.
  const { data: lnAct } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 사유 삭제', description: '자동 검증용',
    category: '환경', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    status: 'ACTIVE',
    recruit_end_at:    new Date(now + 3 * 86400000).toISOString(),
    activity_start_at: new Date(now + 5 * 86400000).toISOString(),
    activity_end_at:   new Date(now + 6 * 86400000).toISOString(),
  }).select('id').single();
  const { data: lnItem } = await admin.from('action_items').insert({
    action_id: lnAct.id, type: 'PERSON', name: '참가자', target_type: 'MINIMUM',
    min_required: 1, max_allowed: null, unit: '명', gender_requirement: 'ANY',
    condition_name: null, condition_desc: null, sort_order: 1,
  }).select('id').single();
  await cB.rpc('join_action', {
    p_action_id: lnAct.id,
    p_items: [{ action_item_id: lnItem.id, quantity: 1 }],
  });
  await cB.rpc('leave_action_with_reason', {
    p_action_id: lnAct.id, p_reason: '검증용 사유입니다. 지워지면 안 됩니다.',
  });
  const { data: lnMsg } = await admin.from('chat_messages')
    .select('id').eq('action_id', lnAct.id).eq('kind', 'LEFT_NOTICE')
    .limit(1).maybeSingle();

  if (!lnMsg) {
    no('LEFT_NOTICE 글이 안 만들어짐 !! — 나가기 사유 흐름 확인 필요');
  } else {
    const rLn = await cB.rpc('delete_chat_message', { p_message_id: lnMsg.id });
    rLn.error
      ? ok('참여 취소 사유는 본인도 삭제 거절', rLn.error.message.slice(0, 26))
      : no('참여 취소 사유가 삭제됨 !! — 11_update.sql 을 실행했는가');
  }

  // ── ② 소감은 결과가 올라온 뒤에만 ──
  // 활동만 끝나고(ENDED) 결과가 없으면 거절돼야 한다.
  const { data: vcAct } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 결과 전 소감', description: '자동 검증용',
    category: '환경', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    status: 'ENDED',
    recruit_end_at:    new Date(now - 5 * 86400000).toISOString(),
    activity_start_at: new Date(now - 3 * 86400000).toISOString(),
    activity_end_at:   new Date(now - 2 * 86400000).toISOString(),
  }).select('id').single();
  await admin.from('participations')
    .insert({ action_id: vcAct.id, user_id: uidB, status: 'AFTER_ACTION' });

  const rVc1 = await cB.rpc('submit_crew_voice', {
    p_action_id: vcAct.id, p_content: '결과가 아직 없는데 소감을 남겨봅니다.',
  });
  rVc1.error
    ? ok('결과 공개 전 소감 거절', rVc1.error.message.slice(0, 26))
    : no('결과가 없는데 소감이 저장됨 !! — 11_update.sql 을 실행했는가');

  // COMPLETED 로 바꾸면 허용돼야 한다
  await admin.from('actions').update({ status: 'COMPLETED' }).eq('id', vcAct.id);
  const rVc2 = await cB.rpc('submit_crew_voice', {
    p_action_id: vcAct.id, p_content: '결과가 올라온 뒤라 이제 소감을 남깁니다.',
  });
  rVc2.error
    ? no('결과가 올라왔는데 소감이 거절됨 !!', rVc2.error.message.slice(0, 40))
    : ok('결과 공개 뒤 소감은 허용됨');

  await admin.from('actions').delete().eq('id', vcAct.id);

  // ── ③ 항목 추가는 모집 중일 때만 ──
  const rAdd1 = await cA.from('action_items').insert({
    action_id: lnAct.id, type: 'GOODS', name: '[검증] 모집 중 추가',
    target_type: 'MINIMUM', min_required: 1, max_allowed: null, unit: '개',
    gender_requirement: 'ANY', condition_name: null, condition_desc: null,
    sort_order: 50,
  });
  rAdd1.error
    ? no('모집 중인데 항목 추가가 막힘 !!', rAdd1.error.message.slice(0, 40))
    : ok('모집 중에는 항목 추가 허용');

  // 모집이 이미 끝난 액션에는 거절돼야 한다.
  //
  // ★ 공개된 액션의 날짜는 나중에 못 바꿉니다(07 이 service_role 도 막습니다).
  //   그래서 update 로 마감을 앞당기는 대신, 처음부터 마감이 지난 액션을 만듭니다.
  //   처음엔 update 로 짰다가 이 검사가 통과해버려서 알았습니다.
  const { data: closedAct } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 마감 지난 액션', description: '자동 검증용',
    category: '환경', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    status: 'ACTIVE',
    recruit_end_at:    new Date(now - 2 * 86400000).toISOString(),
    activity_start_at: new Date(now + 2 * 86400000).toISOString(),
    activity_end_at:   new Date(now + 3 * 86400000).toISOString(),
  }).select('id').single();

  const rAdd2 = await cA.from('action_items').insert({
    action_id: closedAct.id, type: 'GOODS', name: '[검증] 마감 뒤 추가',
    target_type: 'MINIMUM', min_required: 1, max_allowed: null, unit: '개',
    gender_requirement: 'ANY', condition_name: null, condition_desc: null,
    sort_order: 51,
  });
  rAdd2.error
    ? ok('모집 마감 뒤 항목 추가 거절', rAdd2.error.message.slice(0, 26))
    : no('마감됐는데 항목이 추가됨 !! — 신청할 수 있는 사람이 없습니다');

  await admin.from('actions').delete().eq('id', closedAct.id);

  // COMPLETED 에도 거절돼야 한다
  await admin.from('actions').update({ status: 'COMPLETED' }).eq('id', lnAct.id);
  const rAdd3 = await cA.from('action_items').insert({
    action_id: lnAct.id, type: 'GOODS', name: '[검증] 완료 뒤 추가',
    target_type: 'MINIMUM', min_required: 1, max_allowed: null, unit: '개',
    gender_requirement: 'ANY', condition_name: null, condition_desc: null,
    sort_order: 52,
  });
  rAdd3.error
    ? ok('완료된 액션에 항목 추가 거절 — 결과에 0명짜리 항목이 안 낌')
    : no('완료된 액션에 항목이 추가됨 !!');

  await admin.from('actions').delete().eq('id', lnAct.id);


  // ═══════════════════════════════════════════════════════════
  console.log('\n[17] 취소는 시작 전까지 · 조기 종료는 활동 중에만 (12)');

  /** 액션 하나 만들고 B 를 참여시킨다. 시각은 호출자가 정한다. */
  async function makeTimedAction(title, startOffsetMs, endOffsetMs) {
    const { data: a } = await admin.from('actions').insert({
      owner_id: uidA, title, description: '자동 검증용',
      category: '환경', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
      status: 'ACTIVE',
      recruit_end_at:    new Date(now - 5 * 86400000).toISOString(),
      activity_start_at: new Date(now + startOffsetMs).toISOString(),
      activity_end_at:   new Date(now + endOffsetMs).toISOString(),
    }).select('id').single();
    await admin.from('participations')
      .insert({ action_id: a.id, user_id: uidB, status: 'BEFORE_ACTION' });
    return a.id;
  }

  // ── ① 시작 전에는 취소가 된다 ──
  const upcoming = await makeTimedAction('[검증] 아직 시작 전', 3 * 86400000, 4 * 86400000);
  const rC1 = await cA.rpc('cancel_action', {
    p_action_id: upcoming, p_reason: '검증용 취소입니다.',
  });
  rC1.error
    ? no('시작 전인데 취소가 막힘 !!', rC1.error.message.slice(0, 40))
    : ok('활동 시작 전에는 취소 허용');
  await admin.from('actions').delete().eq('id', upcoming);

  // ── ② 활동 중에는 취소가 거절된다 ──
  const running = await makeTimedAction('[검증] 활동 중', -2 * 3600000, 5 * 3600000);
  const rC2 = await cA.rpc('cancel_action', {
    p_action_id: running, p_reason: '검증용 취소입니다.',
  });
  rC2.error
    ? ok('활동 시작 뒤 취소 거절', rC2.error.message.slice(0, 26))
    : no('활동이 시작됐는데 취소됨 !! — 12_update.sql 을 실행했는가');

  // ── ③ 활동 중 조기 종료는 된다 ──
  const rE1 = await cA.rpc('end_action_early', {
    p_action_id: running, p_reason: '비가 많이 와서 오늘은 여기까지 합니다.',
  });
  rE1.error
    ? no('활동 중인데 조기 종료가 막힘 !!', rE1.error.message.slice(0, 40))
    : ok('활동 중 조기 종료 허용');

  // ── ④ 조기 종료 뒤 상태 ──
  const { data: eeAct } = await admin.from('actions')
    .select('status').eq('id', running).single();
  eeAct?.status === 'ENDED'
    ? ok('조기 종료하면 ENDED 가 됨 — 취소가 아님')
    : no(`조기 종료했는데 상태가 ${eeAct?.status} !!`);

  const { data: pAfter } = await admin.from('participations')
    .select('status').eq('action_id', running).eq('user_id', uidB).single();
  pAfter?.status === 'AFTER_ACTION'
    ? ok('조기 종료하면 참여자가 AFTER_ACTION — 소감 작성 필요')
    : no(`참여자 상태가 ${pAfter?.status} !!`);

  // ── ⑤ 사유가 크루챗에 남고, 지울 수 없다 ──
  const { data: eeMsg } = await admin.from('chat_messages')
    .select('id, content').eq('action_id', running)
    .eq('kind', 'EARLY_END_NOTICE').limit(1).maybeSingle();
  if (!eeMsg) {
    no('조기 종료 공지가 크루챗에 안 남음 !!');
  } else {
    ok('조기 종료 사유가 크루챗에 남음', eeMsg.content.slice(0, 20));
    const rDel = await cA.rpc('delete_chat_message', { p_message_id: eeMsg.id });
    rDel.error
      ? ok('조기 종료 사유는 호스트도 삭제 거절', rDel.error.message.slice(0, 24))
      : no('조기 종료 사유가 삭제됨 !!');
  }

  // ── ⑥ 조기 종료된 액션도 "내가 만든 액션" 에 센다 ──
  const { count: ledCount } = await admin.from('actions')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', uidA).eq('id', running)
    .in('status', ['ACTIVE', 'ENDED', 'COMPLETED']);
  ledCount === 1
    ? ok('조기 종료된 액션도 만든 액션으로 세어짐 — 취소와 다른 점')
    : no('조기 종료된 액션이 집계에서 빠짐 !!');

  // ── ⑦ 이미 끝난 액션은 조기 종료도, 취소도 안 된다 ──
  const past = await makeTimedAction('[검증] 이미 끝남', -3 * 86400000, -2 * 86400000);
  const rE2 = await cA.rpc('end_action_early', {
    p_action_id: past, p_reason: '이미 끝났는데 종료해봅니다.',
  });
  rE2.error
    ? ok('끝난 활동은 조기 종료 거절', rE2.error.message.slice(0, 26))
    : no('이미 끝난 활동이 조기 종료됨 !!');

  await admin.from('actions').update({ status: 'ENDED' }).eq('id', past);
  const rC3 = await cA.rpc('cancel_action', {
    p_action_id: past, p_reason: '검증용 취소입니다.',
  });
  rC3.error
    ? ok('ENDED 액션 취소 거절 — 결과를 쓰는 길만 남음', rC3.error.message.slice(0, 24))
    : no('ENDED 액션이 취소됨 !!');

  // ── ⑧ 시작 전에는 조기 종료가 거절된다 ──
  const notYet = await makeTimedAction('[검증] 시작 전 조기종료', 2 * 86400000, 3 * 86400000);
  const rE3 = await cA.rpc('end_action_early', {
    p_action_id: notYet, p_reason: '아직 시작도 안 했는데 종료해봅니다.',
  });
  rE3.error
    ? ok('시작 전 조기 종료 거절 — 취소를 쓰라고 안내', rE3.error.message.slice(0, 26))
    : no('시작도 안 했는데 조기 종료됨 !!');

  // ── ⑨ 남의 액션은 조기 종료할 수 없다 ──
  const rE4 = await cB.rpc('end_action_early', {
    p_action_id: notYet, p_reason: '남의 액션을 종료해봅니다.',
  });
  rE4.error
    ? ok('남의 액션은 조기 종료 거절', rE4.error.message.slice(0, 24))
    : no('남의 액션이 조기 종료됨 !!');

  await admin.from('actions').delete().in('id', [running, past, notYet]);


} catch (e) {
  no('예외 발생', e.message);
} finally {
  // ── 정리 ──
  console.log('\n[정리]');
  if (created.action) {
    await admin.from('actions').delete().eq('id', created.action);
    console.log('  🧹 테스트 액션 삭제');
  }
  for (const u of created.users) await admin.auth.admin.deleteUser(u);
  console.log(`  🧹 테스트 계정 ${created.users.length}개 삭제`);

  console.log(`\n${'─'.repeat(46)}`);
  console.log(`통과 ${pass}  ·  실패 ${fail}`);
  console.log('─'.repeat(46));
  process.exit(fail > 0 ? 1 : 0);
}
