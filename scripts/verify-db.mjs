/**
 * GOOD MVP — DB 동작 검증
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
