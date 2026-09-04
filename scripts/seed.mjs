/**
 * 착착(CHAK CHAK) — 시연용 데이터 만들기
 *
 *   npm run seed          데이터 생성 (여러 번 돌려도 안전 — 지우고 새로 넣습니다)
 *   npm run seed:clean    시드 데이터만 제거
 *
 * ── 데이터를 바꾸고 싶다면 ────────────────────────────────
 * 아래 USERS 와 ACTIONS 배열만 고치면 됩니다. 나머지는 건드릴 필요 없습니다.
 * 액션을 추가하려면 ACTIONS 에 항목을 하나 더 넣으면 됩니다.
 *
 * ── 주의 ────────────────────────────────────────────────
 * - 로컬에서만 돌리세요. .env.local 의 SERVICE_ROLE_KEY 를 씁니다.
 * - 시드 계정은 이메일이 @good.seed 로 끝납니다. 이걸로 구분해서 지웁니다.
 *   실제 사용자 데이터는 절대 건드리지 않습니다.
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

// ═══════════════════════════════════════════════════════════
// 시드 데이터의 id 를 매번 같게 만듭니다 (2026-09-04)
//
// 전에는 id 를 DB 가 만들었습니다(gen_random_uuid). 그래서 seed 를
// 다시 돌리면 같은 액션인데 번호가 달라졌고, 화면을 열어둔 채
// seed 를 돌리면 그 링크가 죽었습니다.
//
// 이름에서 번호를 계산하면 언제 돌려도 같은 값이 나옵니다.
// 표준 UUID v5 방식이라 형식도 그대로고, DB 는 손댈 필요가 없습니다
// (actions.id 가 DEFAULT 라 값을 주면 그걸 씁니다).
//
// ★ 시드 전용 네임스페이스입니다. 실제 사용자가 만든 액션의 번호와
//   겹칠 확률은 사실상 0 입니다.
// ═══════════════════════════════════════════════════════════
const SEED_NAMESPACE = '9f1c0f5e-3a6d-4c8b-9e2a-7d4f1b6c8a03';

function seedUuid(name) {
  const ns = Buffer.from(SEED_NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([ns, Buffer.from(name, 'utf8')]))
    .digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // 버전 5
  b[8] = (b[8] & 0x3f) | 0x80; // 변형
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.error('.env.local 에 SUPABASE 값이 없습니다.');
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const CLEAN_ONLY = process.argv.includes('--clean');

/** 시드 계정을 구분하는 표식. 이걸로만 지웁니다. */
const SEED_DOMAIN = '@good.seed';
const PASSWORD = 'good1234!';

// ═══════════════════════════════════════════════════════════
// 여기부터 데이터 — 자유롭게 고치세요
// ═══════════════════════════════════════════════════════════

const USERS = [
  { nick: '올리브', gender: 'FEMALE', bio: '동네에서 할 수 있는 좋은 일을 찾고 있어요.' },
  { nick: '민준', gender: 'MALE', bio: '주말마다 몸 쓰는 봉사를 좋아합니다.' },
  { nick: '서연', gender: 'FEMALE', bio: '아이들과 함께하는 활동에 관심이 많아요.' },
  { nick: '도현', gender: 'MALE', bio: '환경 문제에 관심이 있습니다.' },
  { nick: '지우', gender: 'FEMALE', bio: '유기동물 보호소에 자주 갑니다.' },
  { nick: '하윤', gender: 'FEMALE', bio: '어르신들과 이야기 나누는 걸 좋아해요.' },
  { nick: '준서', gender: 'MALE', bio: '재능기부로 사진을 찍어드립니다.' },
  { nick: '수아', gender: 'FEMALE', bio: '작은 일이라도 꾸준히 하려고 해요.' },
];

/** 카테고리별 장소 이름 접미사. 시드를 그럴듯하게 만들기 위한 것뿐입니다 */
const PLACE_SUFFIX = {
  '동물': '동물보호센터',
  '환경': '환경센터',
  '지역사회': '구민회관',
  '아동·청소년': '아동센터',
  '노인': '경로당',
  '장애': '복지관',
  '교육': '평생학습관',
  '기타': '문화센터',
};

const IMG = {
  animal: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1200',
  dog: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200',
  env: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=1200',
  beach: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=1200',
  kids: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=1200',
  book: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200',
  senior: 'https://images.unsplash.com/photo-1516307365426-bea591f05011?w=1200',
  food: 'https://images.unsplash.com/photo-1593113630400-ea4288922497?w=1200',
  community: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200',
  garden: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200',
};

/**
 * status:  ACTIVE(모집중) · ENDED(결과 작성 필요) · COMPLETED(결과 공개) · CANCELLED
 * daysAgo: 며칠 전에 만들어졌는지 (주간 추이 그래프용)
 * whenDay: 활동일이 오늘로부터 며칠 뒤(+) 또는 며칠 전(-)
 * items:   [이름, 종류, 방식, 최소, 최대, 단위, 성별제한]
 *          방식 R = 정해진 인원(min~max) · M = 최소 인원만(상한 없음)
 */
const ACTIONS = [
  ['[모집미달 테스트] 동네 플로깅 모집', '환경', IMG.env, '서울특별시 성동구 왕십리로 100', 'ACTIVE', 2, 0.5,
    [['플로깅 참가자', 'PERSON', 'M', 10, null, '명', 'ANY']]],
  ['우리 동네 보호소를 함께 도와요', '동물', IMG.dog, '서울특별시 성동구 왕십리로 100', 'ACTIVE', 0, 5,
    [['산책 도우미', 'PERSON', 'M', 5, null, '명', 'ANY'], ['사료', 'GOODS', 'M', 50, null, '포', 'ANY']]],
  ['유기견 산책 친구를 찾습니다', '동물', IMG.animal, '서울특별시 마포구 월드컵로 30', 'ACTIVE', 4, 7,
    [['산책 봉사자', 'PERSON', 'R', 3, 6, '명', 'ANY']]],
  ['길고양이 겨울집 만들기', '동물', IMG.animal, '경기도 고양시 일산동구', 'ACTIVE', 6, 10,
    [['제작 도우미', 'PERSON', 'M', 4, null, '명', 'ANY'], ['스티로폼 박스', 'GOODS', 'M', 20, null, '개', 'ANY']]],
  ['보호소 겨울 준비를 함께해요', '동물', IMG.animal, '서울특별시 성동구 성수일로 10', 'COMPLETED', 30, -22,
    [['현장 봉사', 'PERSON', 'M', 6, null, '명', 'ANY'], ['담요', 'GOODS', 'M', 30, null, '장', 'ANY']]],
  ['유기묘 임시보호 설명회', '동물', IMG.animal, '서울특별시 종로구 종로 1', 'ENDED', 18, -5,
    [['참가자', 'PERSON', 'R', 5, 15, '명', 'ANY']]],

  ['한강 플로깅 함께해요', '환경', IMG.env, '서울특별시 영등포구 여의동로 330', 'ACTIVE', 1, 6,
    [['참가자', 'PERSON', 'M', 10, null, '명', 'ANY'], ['집게', 'GOODS', 'M', 10, null, '개', 'ANY']]],
  ['바닷가 쓰레기 줍기', '환경', IMG.beach, '부산광역시 해운대구 해운대해변로', 'ACTIVE', 8, 12,
    [['참가자', 'PERSON', 'M', 15, null, '명', 'ANY']]],
  ['우리 동네 분리배출 캠페인', '환경', IMG.env, '서울특별시 관악구 관악로 1', 'COMPLETED', 40, -30,
    [['캠페인 도우미', 'PERSON', 'R', 4, 8, '명', 'ANY']]],
  ['텀블러 나눔 부스 운영', '환경', IMG.env, '경기도 수원시 팔달구', 'ACTIVE', 5, 9,
    [['부스 운영', 'PERSON', 'R', 2, 4, '명', 'ANY'], ['텀블러', 'GOODS', 'M', 100, null, '개', 'ANY']]],
  ['도시 텃밭 가꾸기', '환경', IMG.garden, '서울특별시 은평구 통일로', 'ACTIVE', 11, 14,
    [['농사 도우미', 'PERSON', 'M', 6, null, '명', 'ANY']]],
  ['폐현수막으로 장바구니 만들기', '환경', IMG.env, '인천광역시 연수구', 'COMPLETED', 46, -36,
    [['재봉 봉사', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['폐현수막', 'GOODS', 'M', 40, null, '장', 'ANY']]],

  ['동네 공터를 작은 정원으로', '지역사회', IMG.garden, '서울특별시 성북구 보문로', 'ACTIVE', 0, 8,
    [['정원 조성', 'PERSON', 'M', 8, null, '명', 'ANY'], ['모종', 'GOODS', 'M', 60, null, '개', 'ANY']]],
  ['주말 이틀간의 따뜻한 급식 나눔', '지역사회', IMG.food, '서울특별시 성동구 마장로 20', 'ACTIVE', 2, 5,
    [['1일차 배식팀', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['2일차 정리팀', 'PERSON', 'R', 3, 5, '명', 'ANY']]],
  ['골목길 벽화 그리기', '지역사회', IMG.community, '부산광역시 사하구', 'ACTIVE', 9, 13,
    [['그림 봉사', 'PERSON', 'R', 5, 10, '명', 'ANY'], ['페인트', 'GOODS', 'M', 15, null, '통', 'ANY']]],
  ['우리 동네 눈 치우기', '지역사회', IMG.community, '강원특별자치도 춘천시', 'COMPLETED', 52, -44,
    [['제설 봉사', 'PERSON', 'M', 10, null, '명', 'MALE']]],
  ['이웃과 함께하는 김장 나눔', '지역사회', IMG.food, '서울특별시 도봉구 도봉로', 'COMPLETED', 36, -27,
    [['김장 봉사', 'PERSON', 'M', 12, null, '명', 'ANY'], ['배추', 'GOODS', 'M', 100, null, '포기', 'ANY']]],
  ['재난 대비 물품 정리', '지역사회', IMG.community, '대구광역시 수성구', 'CANCELLED', 20, 3,
    [['정리 봉사', 'PERSON', 'R', 4, 8, '명', 'ANY']]],

  ['아이들과 만드는 작은 책장', '아동·청소년', IMG.book, '부산광역시 금정구', 'COMPLETED', 44, -34,
    [['목공 봉사', 'PERSON', 'R', 3, 6, '명', 'ANY'], ['책', 'GOODS', 'M', 200, null, '권', 'ANY']]],
  ['방과 후 공부방 선생님', '아동·청소년', IMG.kids, '서울특별시 노원구 상계로', 'ACTIVE', 4, 11,
    [['수학 선생님', 'PERSON', 'R', 2, 2, '명', 'ANY'], ['영어 선생님', 'PERSON', 'R', 2, 2, '명', 'ANY']]],
  ['아동센터 도서 정리', '아동·청소년', IMG.book, '경기도 부천시 원미구', 'ACTIVE', 7, 9,
    [['정리 봉사', 'PERSON', 'M', 5, null, '명', 'ANY']]],
  ['청소년 진로 이야기 나눔', '아동·청소년', IMG.kids, '서울특별시 강서구 화곡로', 'ENDED', 22, -6,
    [['멘토', 'PERSON', 'R', 4, 8, '명', 'ANY']]],
  ['어린이 도서 기부 캠페인', '아동·청소년', IMG.book, '광주광역시 서구', 'ACTIVE', 13, 16,
    [['도서', 'GOODS', 'M', 300, null, '권', 'ANY']]],

  ['어르신 말벗 봉사', '노인', IMG.senior, '서울특별시 중랑구 면목로', 'ACTIVE', 1, 7,
    [['말벗 봉사자', 'PERSON', 'M', 6, null, '명', 'ANY']]],
  ['경로당 대청소', '노인', IMG.senior, '경기도 성남시 수정구', 'ACTIVE', 10, 12,
    [['청소 봉사', 'PERSON', 'R', 6, 12, '명', 'ANY']]],
  ['어르신 목욕 봉사 (남성)', '노인', IMG.senior, '대전광역시 중구', 'ACTIVE', 6, 10,
    [['목욕 봉사', 'PERSON', 'R', 3, 5, '명', 'MALE']]],
  ['어르신 목욕 봉사 (여성)', '노인', IMG.senior, '대전광역시 중구', 'ACTIVE', 6, 10,
    [['목욕 봉사', 'PERSON', 'R', 3, 5, '명', 'FEMALE']]],
  ['홀몸 어르신 도시락 배달', '노인', IMG.food, '서울특별시 동대문구', 'COMPLETED', 38, -28,
    [['배달 봉사', 'PERSON', 'M', 8, null, '명', 'ANY'], ['도시락', 'GOODS', 'M', 80, null, '개', 'ANY']]],
  ['어르신 스마트폰 교실', '노인', IMG.senior, '울산광역시 남구', 'ENDED', 26, -4,
    [['강사 도우미', 'PERSON', 'R', 3, 6, '명', 'ANY']]],

  ['휠체어 이동 도우미', '장애', IMG.community, '서울특별시 서대문구', 'ACTIVE', 5, 8,
    [['이동 봉사', 'PERSON', 'R', 4, 8, '명', 'ANY']]],
  ['점자 도서 제작 봉사', '장애', IMG.book, '서울특별시 강남구 테헤란로', 'ACTIVE', 12, 15,
    [['제작 봉사', 'PERSON', 'M', 5, null, '명', 'ANY']]],
  ['수어 통역 재능기부', '장애', IMG.community, '경기도 안양시 동안구', 'COMPLETED', 48, -38,
    [['수어 통역', 'PERSON', 'R', 2, 3, '명', 'ANY']]],

  ['다문화 가정 한글 교실', '교육', IMG.book, '경기도 화성시', 'ACTIVE', 4, 9,
    [['한글 선생님', 'PERSON', 'R', 3, 6, '명', 'ANY']]],
  ['시니어 컴퓨터 교실 보조', '교육', IMG.senior, '서울특별시 구로구 디지털로', 'ACTIVE', 8, 11,
    [['보조 강사', 'PERSON', 'M', 4, null, '명', 'ANY']]],
  ['중학생 코딩 멘토링', '교육', IMG.kids, '서울특별시 송파구 올림픽로', 'ACTIVE', 14, 18,
    [['멘토', 'PERSON', 'R', 4, 8, '명', 'ANY']]],
  ['학습지 정리 및 발송', '교육', IMG.book, '인천광역시 부평구', 'COMPLETED', 42, -32,
    [['정리 봉사', 'PERSON', 'M', 6, null, '명', 'ANY']]],

  ['무료 프로필 사진 촬영', '기타', IMG.community, '서울특별시 용산구 이태원로', 'ACTIVE', 6, 13,
    [['사진작가', 'PERSON', 'R', 1, 2, '명', 'ANY'], ['보조', 'PERSON', 'M', 2, null, '명', 'ANY']]],
  ['헌혈 캠페인 도우미', '기타', IMG.community, '서울특별시 종로구 세종대로', 'ACTIVE', 9, 12,
    [['캠페인 도우미', 'PERSON', 'M', 6, null, '명', 'ANY']]],
  ['연말 나눔 장터 운영', '기타', IMG.food, '경기도 용인시 수지구', 'COMPLETED', 50, -40,
    [['부스 운영', 'PERSON', 'R', 6, 10, '명', 'ANY'], ['기부 물품', 'GOODS', 'M', 150, null, '점', 'ANY']]],
  ['소아병동 인형 만들기', '기타', IMG.kids, '서울특별시 서초구 반포대로', 'ACTIVE', 11, 17,
    [['바느질 봉사', 'PERSON', 'M', 5, null, '명', 'ANY'], ['인형 솜', 'GOODS', 'M', 40, null, 'kg', 'ANY']]],
  ['보육원 생일파티 준비', '기타', IMG.kids, '부산광역시 동래구', 'ENDED', 24, -3,
    [['준비 봉사', 'PERSON', 'R', 4, 8, '명', 'ANY']]],
];

const RESULT_TEXTS = [
  '생각보다 많은 분들이 함께해주셔서 예정보다 빨리 마칠 수 있었습니다. 준비한 물품도 모두 잘 전달했어요.',
  '날씨가 좋지 않았지만 끝까지 함께해주신 덕분에 무사히 마무리했습니다. 다음에도 이어가려 합니다.',
  '처음 참여하신 분들이 많았는데 서로 도와가며 잘 진행됐습니다. 현장 반응도 아주 좋았어요.',
  '작은 활동이었지만 함께한 분들과 이야기를 나누며 오히려 저희가 더 많이 배웠습니다.',
];

const OWNER_VOICES = [
  '시간 내어 함께해주신 모든 분들께 진심으로 감사드립니다. 덕분에 잘 마쳤어요.',
  '처음 여는 액션이라 걱정이 많았는데, 함께해주신 분들 덕분에 즐겁게 마무리했습니다.',
  '다음에도 또 뵙고 싶습니다. 오늘 정말 고생 많으셨어요.',
];

const CREW_VOICES = [
  '생각보다 힘들었지만 끝나고 나니 정말 뿌듯했어요. 다음에도 꼭 참여하고 싶습니다.',
  '처음 해보는 활동이라 걱정했는데 담당자분이 친절히 알려주셔서 어렵지 않았어요.',
  '작은 힘이라도 보탤 수 있어서 좋았습니다. 주변에도 추천하고 싶어요.',
  '함께한 분들과 이야기 나누는 시간이 즐거웠습니다. 좋은 사람들을 만나 기뻤어요.',
  '몸은 힘들었지만 마음은 가벼워지는 하루였습니다. 또 오고 싶어요.',
];

// ═══════════════════════════════════════════════════════════
// 아래부터는 고칠 일이 거의 없습니다
// ═══════════════════════════════════════════════════════════

const DAY = 86400000;
const pick = (arr, i) => arr[i % arr.length];

async function clean() {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 500 });
  const seedUsers = (list?.users ?? []).filter((u) =>
    (u.email ?? '').endsWith(SEED_DOMAIN),
  );

  if (seedUsers.length === 0) {
    console.log('지울 시드 데이터가 없습니다.');
    return;
  }

  const ids = seedUsers.map((u) => u.id);

  // 액션이 profiles 를 참조하므로 액션을 먼저 지웁니다
  const { data: acts } = await admin
    .from('actions')
    .select('id, image_urls')
    .in('owner_id', ids);

  for (const a of acts ?? []) {
    const paths = (a.image_urls ?? [])
      .map((u) => u.split('/action-images/')[1])
      .filter(Boolean);
    if (paths.length) await admin.storage.from('action-images').remove(paths);
  }

  await admin.from('actions').delete().in('owner_id', ids);
  // 다른 사람 액션에 남긴 참여·소감도 정리
  await admin.from('participations').delete().in('user_id', ids);
  await admin.from('crew_voices').delete().in('user_id', ids);

  for (const u of seedUsers) await admin.auth.admin.deleteUser(u.id);

  console.log(`정리 완료 — 액션 ${acts?.length ?? 0}개 · 계정 ${ids.length}개 삭제`);
}

async function seed() {
  console.log('시드 계정을 만드는 중…');
  const users = [];
  for (const [i, u] of USERS.entries()) {
    const email = `seed${i + 1}${SEED_DOMAIN}`;

    // 계정 번호도 고정합니다. 그래야 /user/[id] 프로필 링크도 안 죽습니다.
    // Supabase 가 id 지정을 안 받아주는 버전이면 그냥 맡깁니다 — 액션 링크는
    // 어차피 고정되니, 여기서 멈출 만한 일은 아닙니다.
    const fixedId = seedUuid(`user:${email}`);
    let { data, error } = await admin.auth.admin.createUser({
      id: fixedId,
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: u.nick, nickname: u.nick, gender: u.gender },
    });
    if (error) {
      ({ data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.nick, nickname: u.nick, gender: u.gender },
      }));
    }
    if (error) {
      console.error(`  계정 생성 실패 (${email}): ${error.message}`);
      continue;
    }
    await admin
      .from('profiles')
      .update({
        bio: u.bio,
        categories: ['동물', '환경', '지역사회'].slice(0, (i % 3) + 1),
        // 참여 가능 시간은 2단계 구조(time_prefs)로 옮기는 중입니다.
        // 추천 점수(scoring.ts)가 아직 옛 컬럼을 봐서 둘 다 채웁니다.
        available_times: i % 2 === 0 ? ['주말', '오후'] : ['평일', '저녁'],
        time_prefs:
          i % 2 === 0
            ? [{ day: '주말', slots: ['오후'] }]
            : [{ day: '평일', slots: ['저녁'] }],
        regions: ['서울특별시 성동구', '서울특별시 마포구', '부산광역시 해운대구'].slice(
          0,
          (i % 2) + 1,
        ),
      })
      .eq('id', data.user.id);
    users.push({ id: data.user.id, ...u });
  }
  console.log(`  계정 ${users.length}개 생성`);

  console.log('액션을 만드는 중…');
  const now = Date.now();
  let actionCount = 0;
  let partCount = 0;
  let voiceCount = 0;

  for (const [idx, row] of ACTIONS.entries()) {
    const [title, category, image, address, status, daysAgo, whenDay, items] = row;
    const owner = users[idx % users.length];
    if (!owner) continue;

    // 주소의 시·군·구를 따서 그럴듯한 장소 이름을 만듭니다.
    // 조장님이 실제 상호로 바꾸셔도 됩니다.
    const gu = (address.split(' ')[1] ?? '우리동네').replace(/[시군구]$/, '');
    const placeName = `${gu}${PLACE_SUFFIX[category] ?? '나눔터'}`;

    // 항목 이름에 "N일차" 가 있으면 그만큼 여러 날에 걸친 활동입니다 (2026-09-04).
    //
    // 전에는 모든 액션이 3시간짜리였습니다. 그래서 "주말 이틀간의 급식 나눔" 이
    // 항목은 1일차·2일차인데 날짜는 하루뿐이었고, The Crew 의 항목별 참여 현황이
    // 안 나왔습니다 — 그 칸은 연일 액션에서만 보이거든요(PDF p.6).
    // 코드가 아니라 데이터가 틀렸던 것이라 여기서 맞춥니다.
    //
    // 제목이 아니라 항목에서 읽습니다. 제목의 "이틀" 같은 말은 표현이 제각각이지만
    // "1일차 배식팀" 같은 항목 이름은 실제로 며칠짜리인지 정확히 알려줍니다.
    const dayCount = Math.max(
      1,
      ...items.map(([name]) => Number(String(name).match(/(\d+)\s*일차/)?.[1] ?? 1)),
    );

    const activityStart = new Date(now + whenDay * DAY);
    activityStart.setHours(14, 0, 0, 0);

    const activityEnd = new Date(activityStart);
    if (dayCount > 1) {
      activityEnd.setDate(activityEnd.getDate() + (dayCount - 1));
      activityEnd.setHours(17, 0, 0, 0);
    } else {
      activityEnd.setTime(activityStart.getTime() + 3 * 3600000);
    }

    const recruitEnd = new Date(activityStart.getTime() - DAY);

    const { data: action, error } = await admin
      .from('actions')
      .insert({
        // 순번+제목에서 계산합니다. 제목이 겹쳐도 순번이 달라 안 부딪힙니다.
        // 목록 순서를 바꾸면 그 뒤 액션의 번호가 바뀌니 참고하세요.
        id: seedUuid(`action:${idx}:${title}`),
        owner_id: owner.id,
        title,
        description: `${title}. 처음이신 분도 담당자가 함께 안내해드리니 편하게 참여하세요.`,
        category,
        image_urls: [image],
        thumbnail_index: 0,
        address,
        // 장소 이름은 호스트가 직접 적는 칸입니다 (F32).
        // 주소만으로는 "어디로 가면 되는지" 를 알 수 없어서 따로 둡니다.
        place_name: placeName,
        notice: '편한 옷차림으로 와주세요. 물과 간식은 준비되어 있습니다.',
        status,
        cancel_reason:
          status === 'CANCELLED' ? '장소 사정으로 부득이하게 취소되었습니다.' : null,
        recruit_end_at: recruitEnd.toISOString(),
        activity_start_at: activityStart.toISOString(),
        activity_end_at: activityEnd.toISOString(),
        created_at: new Date(now - daysAgo * DAY).toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  실패: ${title} — ${error.message}`);
      continue;
    }
    actionCount++;

    // 모집 항목
    const itemRows = items.map(([name, type, mode, min, max, unit, gender], i) => ({
      action_id: action.id,
      type,
      name,
      target_type: mode === 'R' ? 'RANGE' : 'MINIMUM',
      min_required: min,
      max_allowed: mode === 'R' ? max : null,
      unit: type === 'PERSON' ? '명' : unit,
      gender_requirement: type === 'GOODS' ? 'ANY' : gender,
      condition_name: null,
      condition_desc: null,
      sort_order: i,
    }));

    const { data: created } = await admin
      .from('action_items')
      .insert(itemRows)
      .select('id, type, min_required, max_allowed, gender_requirement');

    // AI 색인 — 실제로는 공개할 때 /api/ai/classify 가 만듭니다.
    // 시드는 그 흐름을 안 거치므로 여기서 직접 넣습니다.
    // 이게 없으면 Discover 추천에서 "참여 방식" 15점이 항상 0점이 됩니다.
    const hasGoods = (created ?? []).some((it) => it.type === 'GOODS');
    const hasPerson = (created ?? []).some((it) => it.type === 'PERSON');
    const modes = [];
    if (hasPerson) modes.push('시간을 내서', '직접 행동으로');
    if (hasGoods) modes.push('물건으로');
    if (category === '교육' || category === '아동·청소년') modes.push('내 재능으로');

    await admin.from('action_ai_metadata').upsert(
      {
        action_id: action.id,
        categories: [category],
        activity_types: [category],
        target_groups: [category],
        participation_modes: modes,
        skills: [],
        keywords: title.split(' ').slice(0, 3),
        difficulty: '쉬움',
        ai_model: 'seed',
        prompt_version: 'seed-v1',
        owner_confirmed: true,
      },
      { onConflict: 'action_id' },
    );

    // 참여자 — 액션마다 다른 인원이 참여하도록
    const joinerCount = Math.min(2 + (idx % 4), users.length - 1);
    const isPast = whenDay < 0;
    const wroteResult = status === 'COMPLETED';

    for (let j = 1; j <= joinerCount; j++) {
      const joiner = users[(idx + j) % users.length];
      if (!joiner || joiner.id === owner.id) continue;

      // 성별 제한이 있는 항목은 조건에 맞는 사람만
      const okItems = (created ?? []).filter(
        (it) =>
          it.gender_requirement === 'ANY' || it.gender_requirement === joiner.gender,
      );
      if (okItems.length === 0) continue;

      const pStatus = !isPast
        ? 'BEFORE_ACTION'
        : wroteResult && j % 3 !== 0
          ? 'ACTUALLY_PARTICIPATED'
          : 'AFTER_ACTION';

      const { data: part } = await admin
        .from('participations')
        .insert({ action_id: action.id, user_id: joiner.id, status: pStatus })
        .select('id')
        .single();
      if (!part) continue;
      partCount++;

      const target = okItems[j % okItems.length];
      await admin.from('participation_items').insert({
        participation_id: part.id,
        action_item_id: target.id,
        quantity: target.type === 'PERSON' ? 1 : 5 + (j % 4) * 5,
      });

      if (pStatus === 'ACTUALLY_PARTICIPATED') {
        await admin.from('crew_voices').insert({
          action_id: action.id,
          user_id: joiner.id,
          content: pick(CREW_VOICES, idx + j),
        });
        voiceCount++;
      }
    }

    // 결과
    if (wroteResult) {
      await admin.from('action_results').insert({
        action_id: action.id,
        content: pick(RESULT_TEXTS, idx),
        image_urls: [image],
        owner_voice: pick(OWNER_VOICES, idx),
      });
    }

    // 좋아요 · 저장 — 카드 숫자가 0만 있으면 밋밋해서 조금 뿌립니다
    for (let k = 0; k < (idx % 5) + 1; k++) {
      const liker = users[(idx + k + 2) % users.length];
      if (liker) {
        await admin.from('likes').insert({ user_id: liker.id, action_id: action.id });
      }
    }
    for (let k = 0; k < (idx % 3); k++) {
      const saver = users[(idx + k + 1) % users.length];
      if (saver) {
        await admin.from('saves').insert({ user_id: saver.id, action_id: action.id });
      }
    }
  }

  console.log(`  액션 ${actionCount}개 · 참여 ${partCount}건 · 소감 ${voiceCount}건`);
  console.log('\n시드 계정으로 로그인해볼 수 있습니다:');
  console.log(`  이메일: seed1${SEED_DOMAIN}  (seed2, seed3 … 도 있습니다)`);
  console.log(`  비밀번호: ${PASSWORD}`);
}

// ── 실행 ──
await clean();
if (!CLEAN_ONLY) {
  console.log('');
  await seed();
}
