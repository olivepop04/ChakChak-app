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
const created = { users: [], action: null, extraActions: [] };

function ok(name, extra = '') {
  pass++; console.log(`  ✅ ${name}${extra ? '  — ' + extra : ''}`);
}
function no(name, extra = '') {
  fail++; console.log(`  ❌ ${name}${extra ? '  — ' + extra : ''}`);
}

async function makeUser(email, nickname, gender, avatar) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: 'test1234!', email_confirm: true,
    user_metadata: { name: nickname, nickname, gender, ...(avatar ? { avatar } : {}) },
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

  const uidA = await makeUser(emailA, `owner${stamp}`, 'MALE', 'avatar_05');
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

  // ── 아바타 (20) — 가입 때 고른 값 저장 · 안 고르면 기본값 · 사용자는 못 바꿈 ──
  const { data: avs } = await admin.from('profiles')
    .select('id, avatar').in('id', [uidA, uidB]);
  const avA = avs?.find(p => p.id === uidA)?.avatar;
  const avB = avs?.find(p => p.id === uidB)?.avatar;
  // 고른 값(avatar_05)이 우연히 그 계정의 기본값과 같으면 「저장됐다」 를 가릴 수 없습니다 (8번 중 1번꼴)
  const { data: defA } = await admin.rpc('default_avatar', { p_user_id: uidA });
  if (avA !== 'avatar_05') {
    no('고른 아바타가 저장 안 됨 !! — 20_update.sql 을 실행했는가', String(avA));
  } else if (defA === 'avatar_05') {
    ok('가입 때 고른 아바타가 저장됨', '이번 계정은 기본값도 avatar_05 라 판정 약함 — 다시 돌리면 가려짐');
  } else {
    ok('가입 때 고른 아바타가 저장됨', `기본값 ${defA} 가 아니라 고른 값`);
  }
  /^avatar_0[1-8]$/.test(avB ?? '')
    ? ok('안 고르면 8종 중 하나가 들어감', avB)
    : no('아바타 기본값이 비었거나 목록 밖 !!', String(avB));

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

  // 지금 값과 다른 값으로 바꿔 봐야 막히는지 알 수 있습니다
  const { data: curA } = await admin.from('profiles').select('avatar').eq('id', uidA).single();
  const otherKey = curA?.avatar === 'avatar_01' ? 'avatar_02' : 'avatar_01';
  const rAv = await cA.from('profiles').update({ avatar: otherKey }).eq('id', uidA);
  rAv.error?.message.includes('아바타는 가입할 때')
    ? ok('한 번 고른 아바타는 본인도 못 바꿈', rAv.error.message.slice(0, 24))
    : no('사용자가 아바타를 바꿀 수 있음 !! — 20_update.sql 을 실행했는가', rAv.error?.message.slice(0, 40) ?? '오류 없음');

  // 관리자(서비스 롤)는 고쳐 줄 수 있어야 합니다 — 잘못 골라 곤란한 경우
  const rAdm = await admin.from('profiles').update({ avatar: otherKey }).eq('id', uidA);
  rAdm.error
    ? no('관리자도 아바타를 못 고침 !!', rAdm.error.message.slice(0, 40))
    : ok('관리자는 아바타를 고칠 수 있음');
  await admin.from('profiles').update({ avatar: curA?.avatar }).eq('id', uidA);

  const rBad = await admin.from('profiles').update({ avatar: 'avatar_09' }).eq('id', uidA);
  rBad.error
    ? ok('8종 밖 아바타는 관리자도 못 넣음', rBad.error.message.slice(0, 24))
    : no('8종 밖 아바타가 들어감 !!');
  if (!rBad.error) await admin.from('profiles').update({ avatar: curA?.avatar }).eq('id', uidA);
  const rBio = await cA.from('profiles').update({ bio: '아바타 잠금 뒤에도 소개는 고쳐진다' }).eq('id', uidA);
  rBio.error
    ? no('아바타 잠금 때문에 다른 칸까지 막힘 !!', rBio.error.message.slice(0, 40))
    : ok('아바타 말고 다른 칸은 그대로 고칠 수 있음');
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

  // ── 10-b. 직접 고치기 막기 (21) ───────────────────────────
  // 규칙은 전부 RPC 가 지킵니다. 표를 직접 UPDATE 해서 그 규칙을 건너뛸 수 없어야 합니다.
  console.log('\n[10-b] 표를 직접 고쳐 규칙을 건너뛸 수 없는가  (21)');

  // 옮겨 갈 곳 — A 의 다른 공개 액션. owner_id 는 CASCADE 가 아니라서(17) 계정을 지워도 안 지워집니다.
  // 중간에 멈춰도 [정리] 에서 지우도록 목록에 넣습니다.
  const { data: act2 } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 옮겨 갈 액션', description: '자동 검증용',
    category: '동물', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    status: 'ACTIVE',
    recruit_end_at:    new Date(now + 3 * 86400000).toISOString(),
    activity_start_at: new Date(now + 4 * 86400000).toISOString(),
    activity_end_at:   new Date(now + 4 * 86400000 + 3 * 3600000).toISOString(),
  }).select('id').single();
  created.extraActions.push(act2.id);

  const { data: partC } = await admin.from('participations')
    .select('id, action_id, status').eq('action_id', act.id).eq('user_id', uidC).single();
  await cC.from('participations').update({ action_id: act2.id }).eq('id', partC.id);
  await cC.from('participations').update({ status: 'ACTUALLY_PARTICIPATED' }).eq('id', partC.id);
  const { data: partC2 } = await admin.from('participations')
    .select('action_id, status').eq('id', partC.id).single();
  partC2.action_id === act.id
    ? ok('참여 기록을 남의 액션으로 옮길 수 없음')
    : no('참여 기록이 다른 액션으로 옮겨짐 !! — 21_update.sql 을 실행했는가');
  partC2.status === partC.status
    ? ok('참여 상태를 직접 「참여 완료」 로 바꿀 수 없음')
    : no('참여 상태가 직접 바뀜 !!', `${partC.status} → ${partC2.status}`);

  const { data: post2 } = await cC.from('chat_messages')
    .insert({ action_id: act.id, user_id: uidC, content: '옮기면 안 되는 글' })
    .select('id').single();
  if (post2) {
    await cC.from('chat_messages').update({ action_id: act2.id, content: '고친 글' }).eq('id', post2.id);
    const { data: post2b } = await admin.from('chat_messages')
      .select('action_id, content').eq('id', post2.id).single();
    post2b.action_id === act.id && post2b.content === '옮기면 안 되는 글'
      ? ok('크루챗 글을 직접 고치거나 옮길 수 없음')
      : no('크루챗 글이 직접 바뀜 !!', JSON.stringify(post2b));
    const { error: del2 } = await cC.rpc('delete_chat_message', { p_message_id: post2.id });
    del2 ? no('직접 고치기를 막은 뒤 글 삭제(RPC)가 안 됨 !!', del2.message) : ok('글 삭제(RPC)는 그대로 됨');
  }

  const cA2 = await asUser(emailA);
  const rSt = await cA2.from('actions').update({ status: 'COMPLETED' }).eq('id', act.id);
  const { data: actSt } = await admin.from('actions').select('status').eq('id', act.id).single();
  actSt.status === 'ACTIVE'
    ? ok('호스트가 액션 상태를 직접 바꿀 수 없음', rSt.error?.message.slice(0, 24) ?? '')
    : no('액션 상태가 직접 바뀜 !!', actSt.status);

  const rIns = await cA2.from('actions').insert({
    owner_id: uidA, title: '[검증] 바로 공개 시도', description: '자동 검증용',
    category: '동물', image_urls: [], thumbnail_index: 0, status: 'ACTIVE',
    recruit_end_at:    new Date(now + 3 * 86400000).toISOString(),
    activity_start_at: new Date(now + 4 * 86400000).toISOString(),
    activity_end_at:   new Date(now + 4 * 86400000 + 3 * 3600000).toISOString(),
  }).select('id').maybeSingle();
  rIns.error
    ? ok('처음부터 ACTIVE 로 넣을 수 없음', rIns.error.message.slice(0, 24))
    : no('검수 없이 바로 공개된 액션이 생김 !!');
  if (rIns.data) await admin.from('actions').delete().eq('id', rIns.data.id);

  const rDraft = await cA2.from('actions').insert({
    owner_id: uidA, title: '[검증] 작성 중', category: '동물', image_urls: [], thumbnail_index: 0,
    status: 'DRAFT',
  }).select('id').single();
  if (rDraft.error) {
    no('작성 중 액션을 만들 수 없게 됨 !!', rDraft.error.message.slice(0, 40));
  } else {
    const rEdit = await cA2.from('actions').update({ title: '[검증] 작성 중 — 고침' }).eq('id', rDraft.data.id);
    rEdit.error
      ? no('작성 중 액션을 고칠 수 없게 됨 !!', rEdit.error.message.slice(0, 40))
      : ok('작성 중 액션 만들기·고치기는 그대로 됨');
    await admin.from('actions').delete().eq('id', rDraft.data.id);
  }
  const rText = await cA2.from('actions').update({ description: '공개 뒤 소개 고치기' }).eq('id', act.id);
  rText.error
    ? no('공개 뒤 소개 고치기가 막힘 !!', rText.error.message.slice(0, 40))
    : ok('공개 뒤 소개 고치기는 그대로 됨');

  const { data: gB } = await admin.from('profiles').select('gender').eq('id', uidB).single();
  const rG = await cB.from('profiles').update({ gender: gB.gender === 'FEMALE' ? 'MALE' : 'FEMALE' }).eq('id', uidB);
  const { data: gB2 } = await admin.from('profiles').select('gender').eq('id', uidB).single();
  gB2.gender === gB.gender
    ? ok('가입 뒤에 성별을 바꿀 수 없음', rG.error?.message.slice(0, 24) ?? '')
    : no('성별이 바뀜 — 성별 제한을 우회할 수 있음 !!');
  if (gB2.gender !== gB.gender) await admin.from('profiles').update({ gender: gB.gender }).eq('id', uidB);

  await admin.from('actions').delete().eq('id', act2.id);

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

  // 6) 사진 없이 임시저장 (18) — 결과 작성을 한 번에 못 끝내는 경우
  const { error: draftErr } = await cA.from('action_results').upsert({
    action_id: lcAct.id, content: '글은 써뒀고 사진은 나중에 올릴게요.',
    image_urls: [], owner_voice: null,
  }, { onConflict: 'action_id' });
  draftErr ? no('사진 0장 임시저장 실패 — supabase/18 을 실행했는가', draftErr.message.slice(0, 50))
           : ok('사진 0장으로도 결과 임시저장됨 (18)');

  // 6-1) 임시저장 상태로 공개하려 하면 막혀야 한다
  const rNoImg = await cA.rpc('complete_action', { p_action_id: lcAct.id });
  rNoImg.error ? ok('사진 0장으로는 공개 불가 (18)', rNoImg.error.message.slice(0, 34))
               : no('사진 없이 결과가 공개됨 !! — 「결과 사진 최소 1장」 결정이 뚫림');

  // 6-2) 임시저장 중인 결과가 남에게 보이면 안 된다 (18)
  //      결과 보기(/result)는 비회원도 들어오는 화면이다.
  const { data: peekAnon } = await anon.from('action_results')
    .select('content').eq('action_id', lcAct.id);
  (peekAnon ?? []).length === 0
    ? ok('임시저장 결과는 비회원에게 안 보임 (18)')
    : no('쓰다 만 결과가 비회원에게 보임 !!', String((peekAnon ?? []).length) + '건');

  const { data: peekOther } = await cB.from('action_results')
    .select('content').eq('action_id', lcAct.id);
  (peekOther ?? []).length === 0
    ? ok('임시저장 결과는 호스트 말고는 안 보임 (18)')
    : no('쓰다 만 결과가 남에게 보임 !!', String((peekOther ?? []).length) + '건');

  const { data: peekOwner } = await cA.from('action_results')
    .select('content').eq('action_id', lcAct.id);
  (peekOwner ?? []).length === 1
    ? ok('호스트는 자기 임시저장을 읽음 — 이어쓰기 가능')
    : no('호스트가 자기 임시저장을 못 읽음', String((peekOwner ?? []).length) + '건');

  // 6-3) 사진을 붙이면 공개된다
  const { error: resErr } = await cA.from('action_results').upsert({
    action_id: lcAct.id, content: '잘 마쳤습니다.',
    image_urls: ['https://example.com/r.jpg'], owner_voice: '고맙습니다',
  }, { onConflict: 'action_id' });
  resErr ? no('결과 저장 실패', resErr.message.slice(0, 50)) : ok('결과 저장 (사진 1장)');

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


  // ═══════════════════════════════════════════════════════════
  console.log('\n[18] 취소된 액션에는 더 이상 반응할 수 없다 (13)');

  const { data: cxAct } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 취소 예정', description: '자동 검증용',
    category: '환경', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    status: 'ACTIVE',
    recruit_end_at:    new Date(now + 2 * 86400000).toISOString(),
    activity_start_at: new Date(now + 4 * 86400000).toISOString(),
    activity_end_at:   new Date(now + 5 * 86400000).toISOString(),
  }).select('id').single();

  // ── ① 취소 전에는 좋아요·저장이 된다 ──
  const rL1 = await cB.from('likes').insert({ action_id: cxAct.id, user_id: uidB });
  const rS1 = await cB.from('saves').insert({ action_id: cxAct.id, user_id: uidB });
  rL1.error || rS1.error
    ? no('취소 전인데 좋아요·저장이 막힘 !!', (rL1.error ?? rS1.error).message.slice(0, 40))
    : ok('취소 전에는 좋아요·저장 허용');

  // ── ② 취소한다 ──
  const rCancel = await cA.rpc('cancel_action', {
    p_action_id: cxAct.id, p_reason: '검증용 취소입니다.',
  });
  if (rCancel.error) no('취소가 안 됨 !!', rCancel.error.message.slice(0, 40));

  // ── ③ 취소 뒤에는 새로 누를 수 없다 ──
  const rL2 = await cC.from('likes').insert({ action_id: cxAct.id, user_id: uidC });
  rL2.error
    ? ok('취소된 액션에 좋아요 거절')
    : no('취소된 액션에 좋아요가 됨 !! — 13_update.sql 을 실행했는가');

  const rS2 = await cC.from('saves').insert({ action_id: cxAct.id, user_id: uidC });
  rS2.error
    ? ok('취소된 액션에 저장 거절')
    : no('취소된 액션에 저장이 됨 !!');

  const rSh = await cB.rpc('notify_invite', { p_action_id: cxAct.id, p_target: uidC });
  rSh.error
    ? ok('취소된 액션 공유 거절', rSh.error.message.slice(0, 24))
    : no('취소된 액션이 공유됨 !!');

  // 호스트 본인도 취소된 액션의 소개·안내는 못 고친다 (19)
  const rTx = await cA.from('actions')
    .update({ description: '취소 뒤에 고치기', notice: '취소 뒤 안내' })
    .eq('id', cxAct.id);
  rTx.error
    ? ok('취소된 액션 소개·안내 수정 거절', rTx.error.message.slice(0, 24))
    : no('취소된 액션인데 소개·안내가 고쳐짐 !! — 19_update.sql 을 실행했는가');

  // ── ④ 취소 전에 눌러둔 것은 남아 있고, 해제도 된다 ──
  const { data: keptLike } = await cB.from('likes')
    .select('action_id').eq('action_id', cxAct.id).eq('user_id', uidB).maybeSingle();
  keptLike
    ? ok('취소 전에 눌러둔 좋아요는 그대로 남음 — 크루 잘못이 아니므로')
    : no('취소하면서 기존 좋아요가 사라짐 !!');

  const rUnlike = await cB.from('likes')
    .delete().eq('action_id', cxAct.id).eq('user_id', uidB);
  rUnlike.error
    ? no('취소된 액션에서 좋아요 해제가 막힘 !!', rUnlike.error.message.slice(0, 40))
    : ok('취소된 액션이어도 좋아요 해제는 됨');

  await admin.from('actions').delete().eq('id', cxAct.id);


  // ═══════════════════════════════════════════════════════════
  console.log('\n[19] 카테고리를 여러 개 가질 수 있다 (14)');

  /** 카테고리만 바꿔가며 액션을 만들어본다 */
  async function mkCat(title, cats) {
    return admin.from('actions').insert({
      owner_id: uidA, title, description: '자동 검증용',
      category: '환경',
      ...(cats ? { categories: cats } : {}),
      image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
      status: 'ACTIVE',
      recruit_end_at:    new Date(now + 2 * 86400000).toISOString(),
      activity_start_at: new Date(now + 4 * 86400000).toISOString(),
      activity_end_at:   new Date(now + 5 * 86400000).toISOString(),
    }).select('id, category, categories').single();
  }

  // ── ① 여러 개 저장 · 대표가 첫 번째로 맞춰짐 ──
  const rMulti = await mkCat('[검증] 카테고리 둘', ['교육', '환경']);
  if (rMulti.error) {
    no('카테고리 두 개를 못 넣음 !!', rMulti.error.message.slice(0, 44));
  } else {
    rMulti.data.category === '교육'
      ? ok('대표 카테고리가 첫 번째로 자동 설정됨', rMulti.data.category)
      : no(`대표가 "${rMulti.data.category}" — 첫 번째("교육")여야 함 !!`);

    // ── ② 두 번째 카테고리로도 찾힌다 ──
    const { data: bySecond } = await anon.from('actions')
      .select('id').eq('id', rMulti.data.id).overlaps('categories', ['환경']);
    bySecond?.length
      ? ok('두 번째 카테고리로도 액션이 찾힘 — 홈 칩 필터가 이걸 씁니다')
      : no('두 번째 카테고리로는 못 찾음 !! — overlaps 를 쓰고 있는가');

    // ── ③ 공개한 뒤에는 못 바꾼다 ──
    const rLock = await cA.from('actions')
      .update({ categories: ['동물'] }).eq('id', rMulti.data.id);
    const { data: after } = await admin.from('actions')
      .select('categories').eq('id', rMulti.data.id).single();
    after.categories.includes('교육')
      ? ok('공개한 뒤에는 카테고리를 못 바꿈')
      : no('공개된 액션의 카테고리가 바뀜 !!');
    void rLock;

    await admin.from('actions').delete().eq('id', rMulti.data.id);
  }

  // ── ④ categories 를 안 줘도 대표 하나로 채워진다 (옛 코드 호환) ──
  const rOnly = await mkCat('[검증] 카테고리 안 줌', null);
  if (rOnly.error) {
    no('categories 없이 액션을 못 만듦 !! — 옛 코드가 깨집니다', rOnly.error.message.slice(0, 40));
  } else {
    JSON.stringify(rOnly.data.categories) === JSON.stringify(['환경'])
      ? ok('categories 를 안 줘도 대표로 채워짐 — 옛 코드가 안 깨짐')
      : no(`categories 가 ${JSON.stringify(rOnly.data.categories)} !!`);
    await admin.from('actions').delete().eq('id', rOnly.data.id);
  }

  // ── ⑤ 규칙 세 가지 ──
  for (const [label, cats] of [
    ['네 개', ['환경', '동물', '교육', '노인']],
    ['중복', ['환경', '환경']],
    ['없는 카테고리', ['환경', '우주']],
  ]) {
    const r = await mkCat(`[검증] ${label}`, cats);
    if (r.error) {
      ok(`${label} 거절`);
    } else {
      no(`${label}가 통과됨 !!`);
      await admin.from('actions').delete().eq('id', r.data.id);
    }
  }


  // ============================================================
  console.log('\n[20] 남이 봐도 참여 통계가 맞게 나오는가 (16)');

  // participations RLS 는 "내 참여 · 내 액션 · 내 크루" 만 열어준다.
  // 그래서 화면이 그 테이블을 직접 세면 남의 참여가 0 으로 나왔다 (2026-09-08).
  // 공개 범위만큼 돌려주는 함수 두 개가 제대로 도는지 본다.
  //
  // 앞 단계에서 만든 참여는 그때그때 지워지므로, 여기서 확인용으로 두 건을 만든다.
  //   ① 끝난 액션 + 소감까지 쓴 참여  → 남에게 보여야 한다
  //   ② 아직 진행 중인 액션 + 참여 예정 → 남에게 보이면 안 된다

  const { data: 완료액션 } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 공개 통계 - 끝난 액션', description: '자동 검증용',
    category: '환경', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    status: 'COMPLETED',
    recruit_end_at:    new Date(now - 5 * 86400000).toISOString(),
    activity_start_at: new Date(now - 4 * 86400000).toISOString(),
    activity_end_at:   new Date(now - 3 * 86400000).toISOString(),
  }).select('id').single();
  await admin.from('participations').insert({
    action_id: 완료액션.id, user_id: uidB, status: 'ACTUALLY_PARTICIPATED',
  });

  const { data: 진행액션 } = await admin.from('actions').insert({
    owner_id: uidA, title: '[검증] 공개 통계 - 진행 중', description: '자동 검증용',
    category: '환경', image_urls: ['https://example.com/x.jpg'], thumbnail_index: 0,
    status: 'ACTIVE',
    recruit_end_at:    new Date(now + 2 * 86400000).toISOString(),
    activity_start_at: new Date(now + 4 * 86400000).toISOString(),
    activity_end_at:   new Date(now + 5 * 86400000).toISOString(),
  }).select('id').single();
  await admin.from('participations').insert({
    action_id: 진행액션.id, user_id: uidB, status: 'BEFORE_ACTION',
  });

  const { count: 진짜완료 } = await admin.from('participations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uidB).eq('status', 'ACTUALLY_PARTICIPATED');
  const { count: 전체참여 } = await admin.from('participations')
    .select('id', { count: 'exact', head: true }).eq('user_id', uidB);

  const anonStats = createClient(URL, ANON, { auth: { persistSession: false } });

  const rCnt = await anonStats.rpc('public_participation_counts', { p_user_ids: [uidB] });
  if (rCnt.error) {
    no('비회원이 참여 통계 함수를 못 부름 — 16_update.sql 을 실행했는가', rCnt.error.message.slice(0, 40));
  } else {
    const got = rCnt.data?.[0]?.participated_count ?? 0;
    got === 진짜완료
      ? ok(`비회원도 참여 완료 수가 맞게 보임 (${got}건)`)
      : no('참여 완료 수가 다름', `함수 ${got} vs 실제 ${진짜완료}`);
  }

  // 확인용으로 만든 두 건이 그대로 있어야 아래 검사가 의미가 있다
  진짜완료 >= 1 && 전체참여 > 진짜완료
    ? ok(`참여 예정·나간 기록은 안 셈 (전체 ${전체참여} 중 ${진짜완료}만)`)
    : no('확인용 데이터가 준비되지 않음', `완료 ${진짜완료} / 전체 ${전체참여}`);

  const rIds = await anonStats.rpc('public_participated_action_ids', { p_user_id: uidB });
  if (rIds.error) {
    no('비회원이 참여 액션 목록 함수를 못 부름', rIds.error.message.slice(0, 40));
  } else {
    const ids = (rIds.data ?? []).map((r) => r.action_id);
    ids.length === 진짜완료
      ? ok(`비회원도 참여한 액션 목록을 받음 (${ids.length}건)`)
      : no('참여 액션 개수가 다름', `${ids.length} vs ${진짜완료}`);

    // 돌려준 액션이 정말 끝난 것들인가
    if (ids.length > 0) {
      const { data: st } = await admin.from('actions').select('status').in('id', ids);
      (st ?? []).every((a) => a.status === 'ENDED' || a.status === 'COMPLETED')
        ? ok('끝난 액션만 돌려줌 — 참여 예정이 새지 않음')
        : no('아직 안 끝난 액션이 섞임', (st ?? []).map((a) => a.status).join(','));
    }
  }

  // 로그인했지만 아무 상관 없는 사람도 같은 숫자를 봐야 한다
  const rMine = await cA.rpc('public_participation_counts', { p_user_ids: [uidB] });
  (rMine.data?.[0]?.participated_count ?? 0) === 진짜완료
    ? ok('로그인 사용자도 같은 숫자를 봄')
    : no('사람마다 숫자가 다름');

  // 확인용 데이터 치우기
  for (const id of [완료액션.id, 진행액션.id]) {
    await admin.from('participations').delete().eq('action_id', id);
    await admin.from('actions').delete().eq('id', id);
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
  for (const id of created.extraActions) await admin.from('actions').delete().eq('id', id);
  // deleteUser 는 조용히 실패할 수 있습니다 (2026-09-11).
  // profiles 를 ON DELETE 절 없이 참조하는 테이블이 하나라도 남아 있으면
  // "Database error deleting user" 로 실패하는데, 전에는 에러를 안 봐서
  // 지워지지 않은 계정을 "삭제 완료" 로 찍고 넘어갔습니다.
  // 그래서 test-owner-… 계정이 DB 에 계속 쌓였습니다. supabase/17 도 함께 보세요.
  let deleted = 0;
  const undeleted = [];
  for (const u of created.users) {
    const { error } = await admin.auth.admin.deleteUser(u);
    if (error) undeleted.push(`${u.slice(0, 8)} (${error.message})`);
    else deleted += 1;
  }
  console.log(`  🧹 테스트 계정 ${deleted}/${created.users.length}개 삭제`);
  if (undeleted.length > 0) {
    no(`테스트 계정 ${undeleted.length}개가 안 지워짐 — 손으로 지워주세요`, undeleted.join(' · '));
  }

  console.log(`\n${'─'.repeat(46)}`);
  console.log(`통과 ${pass}  ·  실패 ${fail}`);
  console.log('─'.repeat(46));
  process.exit(fail > 0 ? 1 : 0);
}
