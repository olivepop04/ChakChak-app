/**
 * 착착(CHAK CHAK) — 101개 시연용 데이터 전용 스크립트
 *
 *   npm run seed:101      101개 시연용 데이터 생성
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

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

const SEED_DOMAIN = '@good.seed';
const PASSWORD = 'good1234!';

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

const DEMO_USER = {
  email: `demo${SEED_DOMAIN}`,
  nick: '데모',
  gender: 'FEMALE',
  bio: '착착 서비스 시연 및 테스트용 데모 계정입니다.',
};

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

const EXTRA_CATEGORY = {
  '유기묘 임시보호 설명회': '교육',
  '폐현수막으로 장바구니 만들기': '지역사회',
  '경로당 대청소': '지역사회',
  '골목길 벽화 그리기': '환경',
};

const ACTIONS = [
  // ── [기존 41개: 인덱스 0 ~ 40, 제목/순서 완전 불변] ──────────────────
  ['[모집미달 테스트] 동네 플로깅 모집', '환경', IMG.env, '서울특별시 성동구 왕십리로 100', 'ACTIVE', 2, 6,
    [['플로깅 참가자', 'PERSON', 'M', 10, null, '명', 'ANY']], 7],
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

  // ── [신규 60개: 인덱스 41 ~ 100] ─────────────────────────────────

  // 1. DRAFT 4개 (모두 DEMO Host 소유)
  ['[초안 1] 주말 한강 돗자리 정화 캠페인', '환경', null, null, 'DRAFT', 1, 10, [], 1,
    { owner: 'DEMO', draftLevel: 1 }],
  ['[초안 2] 유기묘 쉼터 수제 간식 만들기', '동물', null, null, 'DRAFT', 2, 8, [], 1,
    { owner: 'DEMO', draftLevel: 2, description: '보호소 아이들을 위한 영양 간식을 정성껏 만들어 선물합니다.' }],
  ['[초안 3] 어르신 사랑의 배식 봉사', '노인', null, '서울특별시 종로구 창경궁로', 'DRAFT', 3, 7, [], 1,
    { owner: 'DEMO', draftLevel: 3, description: '종로 노인복지관에서 어르신들께 따뜻한 한 끼 식사를 대접합니다.' }],
  ['[초안 4] 초등학생 방과후 동화책 읽어주기', '아동·청소년', IMG.book, '서울특별시 마포구 마포대로', 'DRAFT', 4, 6,
    [['동화구연 도우미', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    { owner: 'DEMO', draftLevel: 4, description: '아이들에게 꿈과 상상력을 선물해줄 동화책 읽어주기 봉사자를 모십니다.' }],

  // 2. ACTIVE 현재 활동 진행 중 (3개, 모두 DEMO Host 소유)
  ['[시연용·진행중] 도심 하천 EM 흙공 던지기', '환경', IMG.env, '서울특별시 성동구 살곶이길', 'ACTIVE', 3, 0,
    [['환경 봉사자', 'PERSON', 'M', 8, null, '명', 'ANY'], ['EM 흙공', 'GOODS', 'M', 50, null, '개', 'ANY']], 1,
    { owner: 'DEMO', isLive: true, comments: ['지금 하천 입구에 도착했습니다! 날씨가 딱 좋네요.', '장화 여분 챙겨왔습니다~'] }],
  ['[시연용·진행중] 보호소 유기견 따뜻한 목욕 봉사', '동물', IMG.dog, '서울특별시 강동구 천호대로', 'ACTIVE', 2, 0,
    [['목욕 봉사자', 'PERSON', 'R', 4, 6, '명', 'ANY']], 1,
    { owner: 'DEMO', isLive: true, comments: ['아이들이 물을 무서워하지 않고 얌전하네요 다행입니다.', '대형 타월 넉넉히 준비했습니다.'] }],
  ['[시연용·진행중] 골목길 보행 안전 반사경 닦기', '지역사회', IMG.community, '서울특별시 서대문구 신촌로', 'ACTIVE', 1, 0,
    [['청소 도우미', 'PERSON', 'M', 4, null, '명', 'ANY'], ['극세사 타월', 'GOODS', 'M', 20, null, '장', 'ANY']], 1,
    { owner: 'DEMO', isLive: true, comments: ['깨끗해진 반사경 보니까 골목길이 훨씬 안전해진 것 같아요!'] }],

  // 3. ACTIVE Lazy Sync 테스트용 (2개)
  ['[동기화 테스트] 동네 빗물받이 쓰레기 청소', '환경', IMG.env, '서울특별시 송파구 백제고분로', 'ACTIVE', 1, 0,
    [['청소 도우미', 'PERSON', 'M', 6, null, '명', 'ANY']], 1,
    { isLazySync: true, comments: ['빗물받이마다 담배꽁초가 정말 많았는데 수고 많으셨습니다.'] }],
  ['[동기화 테스트] 저소득층 학생 코딩 멘토링', '교육', IMG.kids, '서울특별시 금천구 가산디지털로', 'ACTIVE', 2, 0,
    [['코딩 멘토', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    { isLazySync: true, comments: ['오늘 파이썬 기초 수업 끝까지 잘 따라와 주었습니다.'] }],

  // 4. ACTIVE 미래 활동 예정 (DEMO Host 1개)
  ['[시연용·모집중] 시니어 스마트폰 기초 교실', '교육', IMG.senior, '서울특별시 광진구 자양로', 'ACTIVE', 3, 5,
    [['강사 보조', 'PERSON', 'R', 3, 6, '명', 'ANY']], 1,
    { owner: 'DEMO', comments: ['어르신들께 스마트폰 알려드리는 봉사 기대됩니다!'] }],

  // 5. ACTIVE DEMO Crew 참여 시연용 (2개)
  ['우리 동네 가로수 화단 가꾸기', '환경', IMG.garden, '서울특별시 마포구 양화로', 'ACTIVE', 2, 4,
    [['화단 가꾸기', 'PERSON', 'M', 5, null, '명', 'ANY'], ['모종삽', 'GOODS', 'M', 10, null, '개', 'ANY']], 1,
    { demoCrew: 'BEFORE_ACTION', comments: ['데모님 반가워요! 이번 주말에 뵙겠습니다.'] }],
  ['도심 야생조류 모이통 설치', '동물', IMG.animal, '서울특별시 성북구 성북로', 'ACTIVE', 4, 8,
    [['설치 도우미', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    { demoCrew: 'LEFT', comments: ['산새들 모이 주는 좋은 활동이네요.'] }],

  // 6. ACTIVE 모집 마감 + 활동 예정 (5개)
  ['독거 어르신 주거환경 도배 봉사', '노인', IMG.senior, '서울특별시 영등포구 도신로', 'ACTIVE', 5, 4,
    [['도배 도우미', 'PERSON', 'R', 4, 6, '명', 'MALE']], 5,
    { comments: ['모집 마감되었네요. 주말에 안전하게 도배 마무리해요!'] }],
  ['시각장애인 마라톤 동반 주자', '장애', IMG.community, '서울특별시 송파구 올림픽로', 'ACTIVE', 6, 5,
    [['가이드 러너', 'PERSON', 'R', 3, 5, '명', 'ANY']], 6,
    { comments: ['코스 숙지하고 가겠습니다. 호흡 잘 맞춰봐요!'] }],
  ['발달장애 청소년 숲길 걷기 동행', '장애', IMG.garden, '경기도 과천시 대공원광장로', 'ACTIVE', 4, 3,
    [['동행 봉사자', 'PERSON', 'M', 6, null, '명', 'ANY']], 4,
    { comments: ['편한 운동화 신고 가겠습니다!'] }],
  ['지역 아동센터 방과후 수학 지도', '아동·청소년', IMG.kids, '서울특별시 양천구 목동서로', 'ACTIVE', 7, 5,
    [['수학 선생님', 'PERSON', 'R', 2, 4, '명', 'ANY']], 6,
    { comments: ['교재 챙겨갈게요.'] }],
  ['다문화 가정 요리 교실 보조', '교육', IMG.food, '인천광역시 남동구 남동대로', 'ACTIVE', 5, 3,
    [['요리 보조', 'PERSON', 'R', 3, 5, '명', 'FEMALE'], ['앞치마', 'GOODS', 'M', 15, null, '개', 'ANY']], 4,
    { comments: ['한국 전통 요리 함께 배워요~'] }],

  // 7. ACTIVE 일반 모집 중 (16개)
  ['주말 이틀간의 청소년 연극 캠프', '아동·청소년', IMG.kids, '서울특별시 종로구 대학로', 'ACTIVE', 3, 7,
    [['1일차 연기 지도', 'PERSON', 'R', 2, 4, '명', 'ANY'], ['2일차 무대 진행', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    { comments: ['이틀 동안 멋진 추억 만들어봐요!'] }],
  ['이틀간 펼쳐지는 동네 플리마켓 지원', '지역사회', IMG.community, '부산광역시 수영구 광안해변로', 'ACTIVE', 2, 6,
    [['1일차 부스 운영', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['2일차 정리 정돈', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1],
  ['어르신 말벗 및 네일아트 봉사', '노인', IMG.senior, '서울특별시 강서구 강서로', 'ACTIVE', 3, 8,
    [['네일아트 봉사', 'PERSON', 'R', 2, 4, '명', 'FEMALE']], 1],
  ['사랑의 가구 제작 및 배달', '지역사회', IMG.community, '경기도 안산시 단원구', 'ACTIVE', 4, 9,
    [['가구 운반 및 제작', 'PERSON', 'R', 4, 8, '명', 'MALE']], 1],
  ['유기견 사료 후원 및 견사 청소', '동물', IMG.dog, '경기도 양평군 양평읍', 'ACTIVE', 2, 6,
    [['견사 청소', 'PERSON', 'M', 5, null, '명', 'ANY'], ['대형견 사료', 'GOODS', 'M', 40, null, '포', 'ANY']], 1],
  ['도심 속 미세먼지 저감 쌈지숲 조성', '환경', IMG.garden, '서울특별시 강남구 강남대로', 'ACTIVE', 5, 10,
    [['식재 봉사자', 'PERSON', 'M', 10, null, '명', 'ANY'], ['원예용 흙', 'GOODS', 'M', 30, null, '포', 'ANY']], 1],
  ['청소년 금융 기초 상식 멘토링', '교육', IMG.book, '서울특별시 서초구 서초대로', 'ACTIVE', 4, 11,
    [['금융 멘토', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1],
  ['장애인 볼링 동아리 활동 보조', '장애', IMG.community, '대전광역시 서구 둔산로', 'ACTIVE', 3, 8,
    [['투구 보조', 'PERSON', 'R', 3, 6, '명', 'ANY']], 1],
  ['소외계층을 위한 따뜻한 제빵 나눔', '지역사회', IMG.food, '대구광역시 중구 달구벌대로', 'ACTIVE', 2, 5,
    [['제빵 봉사', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['밀가루', 'GOODS', 'M', 50, null, 'kg', 'ANY']], 1],
  ['외국인 유학생 한국어 대화 친구', '교육', IMG.book, '서울특별시 동대문구 이문로', 'ACTIVE', 1, 9,
    [['대화 친구', 'PERSON', 'M', 5, null, '명', 'ANY']], 1],
  ['도심 길고양이 급식소 순찰 및 관리', '동물', IMG.animal, '서울특별시 관악구 신림로', 'ACTIVE', 6, 12,
    [['급식소 관리', 'PERSON', 'M', 4, null, '명', 'ANY'], ['캔 간식', 'GOODS', 'M', 60, null, '캔', 'ANY']], 1],
  ['하천 생태계 교란식물 제거 활동', '환경', IMG.env, '경기도 성남시 분당구 탄천로', 'ACTIVE', 3, 7,
    [['제거 봉사자', 'PERSON', 'M', 8, null, '명', 'ANY'], ['작업 장갑', 'GOODS', 'M', 30, null, '켤레', 'ANY']], 1],
  ['보육원 아이들과 함께하는 보드게임', '아동·청소년', IMG.kids, '부산광역시 동구 중앙대로', 'ACTIVE', 4, 8,
    [['놀이 멘토', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1],
  ['시니어 디지털 키오스크 실습 지도', '노인', IMG.senior, '광주광역시 북구 첨단과기로', 'ACTIVE', 2, 7,
    [['실습 지도자', 'PERSON', 'M', 4, null, '명', 'ANY']], 1],
  ['청각장애인을 위한 자막 제작 재능기부', '장애', IMG.book, '서울특별시 구로구 경인로', 'ACTIVE', 5, 13,
    [['자막 제작자', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1],
  ['어린이 교통안전 옐로카펫 정비', '기타', IMG.kids, '경기도 수원시 영통구 광교중앙로', 'ACTIVE', 6, 14,
    [['정비 도우미', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['반사스티커', 'GOODS', 'M', 100, null, '장', 'ANY']], 1],

  // 8. ENDED 6개 (조기 종료 3개 + 정상 종료 3개)
  ['[시연용·조기종료] 주말 산림 가꾸기 및 둘레길 정리', '환경', IMG.env, '서울특별시 강북구 삼양로', 'ENDED', 12, -4,
    [['정리 봉사자', 'PERSON', 'R', 4, 8, '명', 'ANY']], 1,
    { owner: 'DEMO', earlyEndReason: '갑작스러운 호우주의보 발령으로 안전을 위해 일찍 마무리했습니다.', comments: ['안전이 최우선이죠! 비가 너무 많이 와서 고생 많으셨습니다.'] }],
  ['벽화 골목길 보수 및 페인트 칠', '지역사회', IMG.community, '인천광역시 중구 신포로', 'ENDED', 15, -6,
    [['페인트 도우미', 'PERSON', 'R', 3, 6, '명', 'ANY'], ['방수 페인트', 'GOODS', 'M', 10, null, '통', 'ANY']], 1,
    { earlyEndReason: '도료 공급 문제 및 기온 급강하로 작업을 일찍 마쳤습니다.', comments: ['바람이 불어 페인트가 잘 안 말랐네요. 조기 종료 잘 결정하셨습니다.'] }],
  ['해안가 정화 플로깅 캠페인', '환경', IMG.beach, '강원특별자치도 강릉시 창해로', 'ENDED', 14, -5,
    [['플로깅 봉사', 'PERSON', 'M', 10, null, '명', 'ANY']], 1,
    { earlyEndReason: '강풍주의보 발령에 따라 현장 안전관리관의 권고로 조기 종료되었습니다.', comments: ['바람이 거세져서 다칠 뻔했는데 일찍 마무리해서 다행입니다.'] }],
  ['[시연용·종료] 어린이 숲 체험 놀이 도우미', '아동·청소년', IMG.kids, '서울특별시 서초구 매헌로', 'ENDED', 16, -3,
    [['놀이 보조', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    { owner: 'DEMO', earlyEndReason: null, comments: ['아이들이 숲에서 너무 신나게 놀았어요. 결과 기대됩니다!'] }],
  ['장애인 복지관 나들이 동행 봉사', '장애', IMG.community, '서울특별시 노원구 한글비석로', 'ENDED', 18, -4,
    [['나들이 보조', 'PERSON', 'M', 5, null, '명', 'ANY']], 1,
    { demoCrew: 'AFTER_ACTION', earlyEndReason: null, comments: ['어르신 휠체어 밀어드리며 기분 좋은 산책이었습니다.'] }],
  ['시니어 기억지킴 치매예방 교실', '노인', IMG.senior, '경기도 부천시 소사구', 'ENDED', 20, -5,
    [['교구 도우미', 'PERSON', 'R', 2, 4, '명', 'ANY'], ['인지놀이 퍼즐', 'GOODS', 'M', 20, null, '세트', 'ANY']], 1,
    { earlyEndReason: null, comments: ['퍼즐 맞추시면서 활짝 웃으시는 모습이 기억에 남네요.'] }],

  // 9. COMPLETED 16개
  ['[시연용·완료] 독거 어르신 사랑의 도시락 나눔', '노인', IMG.food, '서울특별시 종로구 율곡로', 'COMPLETED', 28, -18,
    [['조리 및 포장', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['보온 도시락통', 'GOODS', 'M', 50, null, '개', 'ANY']], 1,
    {
      owner: 'DEMO',
      ownerVoice: '추운 날씨에도 묵묵히 도시락을 포장하고 전해주신 크루 여러분께 깊은 감사를 드립니다. 어르신들의 밝은 미소가 최고의 선물이었습니다.',
      resultContent: '정성 가득 담은 영양 도시락 50세트를 관내 독거 어르신들께 직접 전달해 드렸습니다. 혼자 계신 어르신들의 안부를 묻고 따뜻한 온기를 나눈 뜻깊은 시간이었습니다.',
      crewVoices: [
        '어르신께서 손을 꼭 잡아주시며 고맙다고 하실 때 눈물이 핑 돌았습니다.',
        '함께 땀 흘려 도시락을 만들고 배달하니 마음이 너무 훈훈해졌어요.',
        '호스트님의 친절한 인솔 덕분에 첫 봉사였는데도 안전하고 즐겁게 마쳤습니다.'
      ],
      comments: ['도시락 반찬 구성이 정말 알차서 어르신들이 참 좋아하셨어요.', '다음 나눔 때도 꼭 불러주세요!']
    }],
  ['발달장애 아동 미술 치료 보조', '장애', IMG.kids, '서울특별시 마포구 월드컵북로', 'COMPLETED', 32, -20,
    [['미술 보조', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['스케치북과 크레파스', 'GOODS', 'M', 30, null, '세트', 'ANY']], 1,
    {
      demoCrew: 'ACTUALLY_PARTICIPATED',
      demoCrewVoice: '아이들이 마음껏 색칠하며 웃는 모습을 보며 제가 더 큰 위로를 받았습니다. 뜻깊은 활동에 참여할 수 있어 영광이었습니다.',
      ownerVoice: '아이들의 창의력을 맘껏 펼칠 수 있게 다정하게 도와주신 크루분들 덕분에 전시회까지 성공적으로 열 수 있었습니다.',
      resultContent: '아동 15명과 함께 물감과 크레파스를 이용한 자유 협동화 그리기 활동을 성공적으로 마쳤습니다.',
      comments: ['아이들의 그림 솜씨가 대단해서 깜짝 놀랐습니다!', '준비해주신 다과도 맛있게 잘 먹었습니다.']
    }],
  ['[인원미달 극복] 소외계층 주거지 도색 나눔', '지역사회', IMG.community, '부산광역시 영도구 절영로', 'COMPLETED', 35, -24,
    [['페인트칠 봉사', 'PERSON', 'R', 5, 8, '명', 'ANY']], 1,
    {
      isShortfall: true,
      ownerVoice: '계획했던 만큼 많은 분들이 참여하지는 않았지만, 참여해주신 모든 분들이 2인분 몫을 해주셔서 잘 마칠 수 있었습니다.',
      resultContent: '예상 인원보다 적은 인원이었지만 한마음으로 뭉쳐 노후 주택 2채의 외벽 도색을 깔끔하게 완성했습니다.',
      comments: ['다들 열정적으로 임해주셔서 힘든 줄도 모르고 칠했네요 ㅎㅎ', '전후 사진 비교해보니 정말 뿌듯합니다!']
    }],
  ['[인원미달 극복] 유기묘 보호소 대청소 및 소독', '동물', IMG.animal, '경기도 용인시 처인구', 'COMPLETED', 40, -28,
    [['청소 도우미', 'PERSON', 'R', 6, 10, '명', 'ANY']], 1,
    {
      isShortfall: true,
      ownerVoice: '모집 인원이 다소 부족했음에도 불구하고 한 분 한 분이 내 일처럼 정성껏 2인분 몫을 톡톡히 해주셔서 보호소 묘사를 완벽히 소독할 수 있었습니다.',
      resultContent: '참가자분들의 놀라운 헌신 덕분에 묘사 3개 동 청소와 모래 갈이를 정해진 시간 내에 깔끔하게 끝냈습니다.',
      comments: ['고양이들이 깨끗해진 방에서 편히 쉬는 걸 보니 너무 좋습니다.', '다들 고생 많으셨어요!']
    }],
  ['남양주 유기견 보호소 방한 비닐막 설치', '동물', IMG.dog, '경기도 남양주시 화도읍', 'COMPLETED', 42, -30,
    [['비닐막 설치', 'PERSON', 'M', 6, null, '명', 'ANY'], ['보온 비닐', 'GOODS', 'M', 20, null, '롤', 'ANY']], 1,
    {
      ownerVoice: '견사에 칼바람이 불지 않도록 튼튼하게 막아주셔서 아이들이 올겨울 따뜻하게 보낼 수 있게 되었습니다.',
      resultContent: '보호소 견사 외곽에 방풍 비닐막 20롤을 모두 설치 완료하였습니다.',
      comments: ['바람 하나 안 들어오게 꼼꼼히 막아서 마음이 놓이네요.']
    }],
  ['안양천 줍깅 및 수질 정화 활동', '환경', IMG.env, '경기도 안양시 만안구', 'COMPLETED', 34, -22,
    [['플로깅 봉사', 'PERSON', 'M', 12, null, '명', 'ANY']], 1,
    {
      ownerVoice: '안양천 일대를 돌며 100kg이 넘는 쓰레기를 수거했습니다. 깨끗해진 하천길을 보니 가슴이 뻥 뚫리네요.',
      resultContent: '산책로 및 둔치 3km 구간에서 총 120kg 분량의 폐기물을 분리수거하여 처리했습니다.',
      comments: ['날씨는 쌀쌀했지만 땀 흘리며 걸으니 상쾌했습니다!']
    }],
  ['폐플라스틱 병뚜껑 업사이클링 키링 제작', '환경', IMG.env, '서울특별시 종로구 대학로', 'COMPLETED', 38, -26,
    [['제작 보조', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['플라스틱 병뚜껑', 'GOODS', 'M', 500, null, '개', 'ANY']], 1,
    {
      ownerVoice: '버려지는 플라스틱이 예쁜 키링으로 재탄생하는 과정을 함께해주신 분들께 감사드립니다.',
      resultContent: '수거된 병뚜껑 800여 개를 분류·세척 후 업사이클링 키링 150개를 제작하여 환경 캠페인용으로 기부했습니다.',
      comments: ['색 조합이 너무 예쁘게 나왔어요. 아이들에게 선물하니 인기 폭발이었습니다.']
    }],
  ['전통시장 장바구니 나눔 캠페인', '지역사회', IMG.community, '서울특별시 동대문구 경동시장로', 'COMPLETED', 45, -32,
    [['나눔 부스 운영', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['에코백 장바구니', 'GOODS', 'M', 200, null, '개', 'ANY']], 1,
    {
      ownerVoice: '비닐봉지 대신 다회용 장바구니를 권유하며 시장 상인분들과 따뜻한 교감을 나눈 시간이었습니다.',
      resultContent: '경동시장 방문객 및 상인분들께 에코백 장바구니 200개를 전량 배포하고 일회용품 줄이기 서명을 받았습니다.',
      comments: ['상인 어르신들이 정말 좋은 취지라고 칭찬 많이 해주셨어요!']
    }],
  ['사랑의 연탄 나눔 봉사', '지역사회', IMG.food, '서울특별시 성북구 정릉로', 'COMPLETED', 48, -35,
    [['연탄 배달', 'PERSON', 'M', 15, null, '명', 'ANY'], ['연탄', 'GOODS', 'M', 1000, null, '장', 'ANY']], 1,
    {
      ownerVoice: '언덕길을 오르내리며 옷에 까만 탄가루가 묻어도 웃음을 잃지 않으셨던 모든 크루분들 최고입니다.',
      resultContent: '고지대 취약계층 5가구에 총 1,000장의 연탄을 릴레이로 안전하게 적재해 드렸습니다.',
      comments: ['연탄 지게 메고 올라갈 땐 힘들었지만 창고 꽉 찬 거 보고 뭉클했습니다.']
    }],
  ['지역 아동센터 크리스마스 선물 포장', '아동·청소년', IMG.kids, '인천광역시 미추홀구 인하로', 'COMPLETED', 52, -40,
    [['포장 도우미', 'PERSON', 'R', 5, 8, '명', 'ANY'], ['학용품 세트', 'GOODS', 'M', 100, null, '개', 'ANY']], 1,
    {
      ownerVoice: '산타클로스가 된 마음으로 리본 하나까지 정성껏 묶어주신 크루님들 덕분에 아이들이 행복한 크리스마스를 보냈습니다.',
      resultContent: '기부받은 학용품과 간식을 100세트의 선물 상자로 예쁘게 포장하여 3개 아동센터에 전달했습니다.',
      comments: ['선물 뜯어보고 환호할 아이들 생각에 손이 절로 빨라졌어요!']
    }],
  ['청소년 진로 멘토링 특강', '아동·청소년', IMG.kids, '경기도 수원시 팔달구 매산로', 'COMPLETED', 36, -25,
    [['직무 멘토', 'PERSON', 'R', 4, 6, '명', 'ANY']], 1,
    {
      ownerVoice: '생생한 현업 이야기를 초롱초롱한 눈망울로 경청해준 학생들과 열정적인 멘토님들 모두에게 감사합니다.',
      resultContent: 'IT, 디자인, 마케팅 분야 멘토 4명이 참여하여 중고등학생 40명을 대상으로 진로 Q&A 및 멘토링을 진행했습니다.',
      comments: ['아이들의 날카로운 질문에 오히려 제가 더 많은 자극을 받았습니다.']
    }],
  ['시니어 보드게임 인지발달 교실', '노인', IMG.senior, '대전광역시 유성구 온천로', 'COMPLETED', 41, -29,
    [['게임 보조', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      ownerVoice: '루미큐브와 젠가를 하시며 어린아이처럼 환하게 웃으시던 어르신들의 모습이 오래도록 기억에 남습니다.',
      resultContent: '경로당 어르신 20여 명과 함께 인지 기능 향상을 위한 쉬운 보드게임 4종을 진행했습니다.',
      comments: ['어르신들 승부욕이 대단하셔서 정말 흥미진진했습니다 ㅎㅎ']
    }],
  ['시각장애인 오디오북 녹음 봉사', '장애', IMG.book, '서울특별시 종로구 삼청로', 'COMPLETED', 44, -31,
    [['낭독 봉사자', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    {
      ownerVoice: '목소리로 세상의 빛을 전하는 녹음 작업에 맑고 고운 목소리로 정성을 다해주셔서 완성도 높은 오디오북이 탄생했습니다.',
      resultContent: '단편 소설 3편의 전체 낭독 녹음 및 1차 음원 편집을 성공적으로 완료하여 점자도서관에 납품했습니다.',
      comments: ['호흡 조절이 생각보다 까다로웠지만 엔지니어님이 잘 지도해주셨어요.']
    }],
  ['다문화 어린이 기초 한국어 동화 구연', '교육', IMG.book, '경기도 안산시 상록구 광덕로', 'COMPLETED', 46, -33,
    [['동화구연', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      ownerVoice: '한국어 표현이 낯선 다문화 가정 아이들이 눈높이 율동과 동화를 통해 자연스럽게 한글과 친해진 시간이었습니다.',
      resultContent: '다문화 어린이 12명과 전래동화 구연 및 단어 카드 맞추기 놀이를 성공적으로 마쳤습니다.',
      comments: ['처음엔 부끄러워하던 아이들이 끝날 땐 품에 안겨 안 놔주더라고요 ㅠㅠ']
    }],
  ['은퇴 시니어를 위한 유튜브 영상 편집 기초', '교육', IMG.senior, '서울특별시 양천구 신목로', 'COMPLETED', 50, -38,
    [['실습 멘토', 'PERSON', 'R', 3, 6, '명', 'ANY']], 1,
    {
      ownerVoice: '새로운 기술에 도전하시는 시니어분들의 배움에 대한 열정에 크루 모두가 큰 감동을 받았습니다.',
      resultContent: '스마트폰 앱을 활용한 1분 숏폼 영상 자막 넣기 및 컷 편집 실습을 완료하여 전원 나만의 브이로그를 제작했습니다.',
      comments: ['어르신들이 완성된 영상을 가족 단톡방에 올리고 자랑스러워하셨어요!']
    }],
  ['신생아 살리기 털모자 뜨기 캠페인', '기타', IMG.kids, '서울특별시 마포구 월드컵북로', 'COMPLETED', 55, -42,
    [['뜨개질 봉사', 'PERSON', 'M', 8, null, '명', 'ANY'], ['뜨개실', 'GOODS', 'M', 50, null, '볼', 'ANY']], 1,
    {
      ownerVoice: '한 땀 한 땀 정성을 엮어 저체온증으로 고통받는 개발도상국 신생아들에게 생명의 온기를 전했습니다.',
      resultContent: '크루들이 직접 뜬 손뜨개 모자 60개와 후원 뜨개실 전량을 세척 후 구호단체에 전달 완료했습니다.',
      comments: ['코 빠뜨려서 몇 번 풀기도 했지만 완성하고 나니 감개무량합니다.']
    }],

  // 10. CANCELLED 5개
  ['[시연용·취소] 청소년 야외 농구 멘토링', '아동·청소년', IMG.kids, '서울특별시 동작구 노량진로', 'CANCELLED', 10, 5,
    [['멘토', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    { owner: 'DEMO', cancelReason: '우천 및 체육관 대관 취소로 인해 진행이 어렵게 되었습니다.' }],
  ['주말 북한산 생태 보전 쓰레기 줍기', '환경', IMG.env, '서울특별시 은평구 대서문길', 'CANCELLED', 12, 6,
    [['등산 플로깅', 'PERSON', 'M', 10, null, '명', 'ANY']], 1,
    { cancelReason: '산불 조심 기간 입산 통제 조치에 따라 행사가 취소되었습니다.' }],
  ['유기견 보호소 야외 견사 바닥 방수 작업', '동물', IMG.dog, '경기도 파주시 광탄면', 'CANCELLED', 15, 8,
    [['방수 시공 보조', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['방수 도료', 'GOODS', 'M', 10, null, '통', 'ANY']], 1,
    { cancelReason: '시공 자재 수급 지연 및 기상 악화로 인하여 부득이 취소되었습니다.' }],
  ['어르신 야외 봄꽃 나들이 동행', '노인', IMG.senior, '서울특별시 영등포구 여의서로', 'CANCELLED', 8, 4,
    [['휠체어 동행', 'PERSON', 'M', 8, null, '명', 'ANY']], 1,
    { cancelReason: '극심한 미세먼지 경보 발령으로 어르신 호흡기 보호를 위해 취소되었습니다.' }],
  ['골목길 가로등 조도 개선 실태 조사', '지역사회', IMG.community, '부산광역시 서구 암남공원로', 'CANCELLED', 9, 7,
    [['야간 조사원', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    { cancelReason: '관할 구청의 가로등 전면 교체 공사 일정이 확정되어 자체 조사를 취소합니다.' }],
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

  const { data: acts } = await admin
    .from('actions')
    .select('id, image_urls')
    .in('owner_id', ids);

  const actIds = (acts ?? []).map((a) => a.id);

  for (const a of acts ?? []) {
    const paths = (a.image_urls ?? [])
      .map((u) => u.split('/action-images/')[1])
      .filter(Boolean);
    if (paths.length) await admin.storage.from('action-images').remove(paths);
  }

  if (actIds.length > 0) {
    await admin.from('chat_messages').delete().in('action_id', actIds);
    await admin.from('action_ai_metadata').delete().in('action_id', actIds);
    await admin.from('action_results').delete().in('action_id', actIds);
    await admin.from('crew_voices').delete().in('action_id', actIds);
    await admin.from('participation_items').delete().in('action_item_id',
      (await admin.from('action_items').select('id').in('action_id', actIds)).data?.map((i) => i.id) ?? []
    );
    await admin.from('action_items').delete().in('action_id', actIds);
    await admin.from('participations').delete().in('action_id', actIds);
    await admin.from('likes').delete().in('action_id', actIds);
    await admin.from('saves').delete().in('action_id', actIds);
    await admin.from('notifications').delete().in('action_id', actIds);
  }

  await admin.from('chat_messages').delete().in('user_id', ids);
  await admin.from('crew_voices').delete().in('user_id', ids);
  await admin.from('participations').delete().in('user_id', ids);
  await admin.from('likes').delete().in('user_id', ids);
  await admin.from('saves').delete().in('user_id', ids);
  await admin.from('notifications').delete().in('user_id', ids);
  await admin.from('actions').delete().in('owner_id', ids);

  for (const u of seedUsers) {
    await admin.auth.admin.deleteUser(u.id);
  }

  console.log(`정리 완료 — 액션 ${acts?.length ?? 0}개 · 계정 ${ids.length}개 삭제`);
}

async function seed() {
  console.log('시드 계정을 만드는 중…');
  const users = [];

  for (const [i, u] of USERS.entries()) {
    const email = `seed${i + 1}${SEED_DOMAIN}`;
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

  const demoEmail = DEMO_USER.email;
  const fixedDemoId = seedUuid(`user:${demoEmail}`);
  let { data: demoData, error: demoErr } = await admin.auth.admin.createUser({
    id: fixedDemoId,
    email: demoEmail,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: DEMO_USER.nick, nickname: DEMO_USER.nick, gender: DEMO_USER.gender },
  });
  if (demoErr) {
    ({ data: demoData, error: demoErr } = await admin.auth.admin.createUser({
      email: demoEmail,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: DEMO_USER.nick, nickname: DEMO_USER.nick, gender: DEMO_USER.gender },
    }));
  }
  const demoUser = {
    id: demoData?.user?.id ?? fixedDemoId,
    nick: DEMO_USER.nick,
    gender: DEMO_USER.gender,
    bio: DEMO_USER.bio,
    email: demoEmail,
  };

  await admin
    .from('profiles')
    .update({
      bio: demoUser.bio,
      categories: ['동물', '환경', '지역사회', '아동·청소년', '노인', '장애', '교육', '기타'],
      available_times: ['주말', '오후', '평일', '저녁'],
      time_prefs: [
        { day: '주말', slots: ['오후'] },
        { day: '평일', slots: ['저녁'] },
      ],
      regions: ['서울특별시 성동구', '서울특별시 마포구', '서울특별시 종로구'],
    })
    .eq('id', demoUser.id);

  console.log(`  일반 계정 ${users.length}개 + 데모 계정(demo@good.seed) 생성 완료`);

  console.log('액션을 만드는 중 (총 101개)…');
  const now = Date.now();
  let actionCount = 0;
  let partCount = 0;
  let voiceCount = 0;
  let chatCount = 0;

  const statusCounts = { DRAFT: 0, ACTIVE: 0, ENDED: 0, COMPLETED: 0, CANCELLED: 0 };
  const demoHostActions = [];
  const demoCrewActions = [];
  let liveCount = 0;
  let lazySyncCount = 0;
  let earlyEndCount = 0;

  for (const [idx, row] of ACTIONS.entries()) {
    const [title, category, image, address, status, daysAgo, whenDay, items, recruitDaysBefore, meta] =
      row;

    const owner = meta?.owner === 'DEMO' ? demoUser : users[idx % users.length];
    if (!owner) continue;

    if (owner.id === demoUser.id) {
      demoHostActions.push({ title, status });
    }

    const isDraft = status === 'DRAFT';
    const gu = address ? (address.split(' ')[1] ?? '우리동네').replace(/[시군구]$/, '') : '우리동네';
    const placeName = address ? `${gu}${PLACE_SUFFIX[category] ?? '나눔터'}` : null;

    let activityStart = null;
    let activityEnd = null;
    let recruitEnd = null;

    if (!isDraft || meta?.draftLevel >= 3) {
      if (meta?.isLive) {
        activityStart = new Date(now - 1 * 3600000);
        activityEnd = new Date(now + 2 * 3600000);
        recruitEnd = new Date(now - 24 * 3600000);
        liveCount++;
      } else if (meta?.isLazySync) {
        activityStart = new Date(now - 5 * 3600000);
        activityEnd = new Date(now - 1 * 3600000);
        recruitEnd = new Date(now - 48 * 3600000);
        lazySyncCount++;
      } else {
        const dayCount = Math.max(
          1,
          ...items.map(([name]) => Number(String(name).match(/(\d+)\s*일차/)?.[1] ?? 1)),
        );
        activityStart = new Date(now + whenDay * DAY);
        activityStart.setHours(14, 0, 0, 0);

        activityEnd = new Date(activityStart);
        if (dayCount > 1) {
          activityEnd.setDate(activityEnd.getDate() + (dayCount - 1));
          activityEnd.setHours(17, 0, 0, 0);
        } else {
          activityEnd.setTime(activityStart.getTime() + 3 * 3600000);
        }

        recruitEnd = new Date(activityStart.getTime() - (recruitDaysBefore ?? 1) * DAY);
      }
    }

    const cancelReason =
      status === 'CANCELLED'
        ? (meta?.cancelReason ?? '장소 사정으로 부득이하게 취소되었습니다.')
        : null;

    const earlyEndReason = meta?.earlyEndReason ?? null;
    if (earlyEndReason) earlyEndCount++;

    const actionId = seedUuid(`action:${idx}:${title}`);

    const desc = meta?.description ??
      (isDraft && meta?.draftLevel === 1
        ? null
        : `${title}. 처음이신 분도 담당자가 함께 안내해드리니 편하게 참여하세요.`);

    const imageUrls = image ? [image] : [];
    const noticeText = isDraft && meta?.draftLevel <= 2 ? null : '편한 옷차림으로 와주세요. 물과 간식은 준비되어 있습니다.';

    const { data: action, error } = await admin
      .from('actions')
      .insert({
        id: actionId,
        owner_id: owner.id,
        title,
        description: desc,
        category,
        categories: EXTRA_CATEGORY[title] ? [category, EXTRA_CATEGORY[title]] : [category],
        image_urls: imageUrls,
        thumbnail_index: 0,
        address: isDraft && meta?.draftLevel <= 2 ? null : address,
        place_name: isDraft && meta?.draftLevel <= 2 ? null : placeName,
        notice: noticeText,
        status,
        cancel_reason: cancelReason,
        early_end_reason: earlyEndReason,
        recruit_end_at: recruitEnd?.toISOString() ?? null,
        activity_start_at: activityStart?.toISOString() ?? null,
        activity_end_at: activityEnd?.toISOString() ?? null,
        created_at: new Date(now - daysAgo * DAY).toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  실패: ${title} — ${error.message}`);
      continue;
    }
    actionCount++;
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    let createdItems = [];
    if (items.length > 0) {
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

      createdItems = created ?? [];
    }

    if (!isDraft) {
      const hasGoods = createdItems.some((it) => it.type === 'GOODS');
      const hasPerson = createdItems.some((it) => it.type === 'PERSON');
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
    }

    if (isDraft) continue;

    const joinedCrews = [];
    const isPast = whenDay < 0 || meta?.isLazySync;
    const wroteResult = status === 'COMPLETED';

    if (meta?.demoCrew) {
      const pStatus = meta.demoCrew;
      demoCrewActions.push({ title, partStatus: pStatus });

      const okItems = createdItems.filter(
        (it) => it.gender_requirement === 'ANY' || it.gender_requirement === demoUser.gender,
      );

      const { data: demoPart } = await admin
        .from('participations')
        .insert({
          action_id: action.id,
          user_id: demoUser.id,
          status: pStatus,
          left_at: pStatus === 'LEFT' ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (demoPart) {
        partCount++;
        joinedCrews.push(demoUser);

        if (okItems.length > 0) {
          const target = okItems[0];
          await admin.from('participation_items').insert({
            participation_id: demoPart.id,
            action_item_id: target.id,
            quantity: target.type === 'PERSON' ? 1 : 5,
          });
        }

        if (pStatus === 'ACTUALLY_PARTICIPATED' && meta.demoCrewVoice) {
          await admin.from('crew_voices').insert({
            action_id: action.id,
            user_id: demoUser.id,
            content: meta.demoCrewVoice,
          });
          voiceCount++;
        }
      }
    }

    if (status !== 'CANCELLED') {
      const joinerCount = Math.min(2 + (idx % 4), users.length - 1);

      for (let j = 1; j <= joinerCount; j++) {
        const joiner = users[(idx + j) % users.length];
        if (!joiner || joiner.id === owner.id || joiner.id === demoUser.id) continue;

        const okItems = createdItems.filter(
          (it) => it.gender_requirement === 'ANY' || it.gender_requirement === joiner.gender,
        );
        if (okItems.length === 0) continue;

        let pStatus = 'BEFORE_ACTION';
        if (isPast) {
          if (wroteResult) {
            pStatus = j % 3 !== 0 ? 'ACTUALLY_PARTICIPATED' : 'AFTER_ACTION';
          } else {
            pStatus = 'AFTER_ACTION';
          }
        }

        const { data: part } = await admin
          .from('participations')
          .insert({ action_id: action.id, user_id: joiner.id, status: pStatus })
          .select('id')
          .single();

        if (!part) continue;
        partCount++;
        joinedCrews.push(joiner);

        const target = okItems[j % okItems.length];
        await admin.from('participation_items').insert({
          participation_id: part.id,
          action_item_id: target.id,
          quantity: target.type === 'PERSON' ? 1 : 5 + (j % 4) * 5,
        });

        if (pStatus === 'ACTUALLY_PARTICIPATED') {
          const voiceContent = meta?.crewVoices?.[j - 1] ?? pick(CREW_VOICES, idx + j);
          await admin.from('crew_voices').insert({
            action_id: action.id,
            user_id: joiner.id,
            content: voiceContent,
          });
          voiceCount++;
        }
      }
    }

    if (meta?.comments && meta.comments.length > 0 && joinedCrews.length > 0) {
      for (let cIdx = 0; cIdx < meta.comments.length; cIdx++) {
        const commenter = joinedCrews[cIdx % joinedCrews.length];
        await admin.from('chat_messages').insert({
          action_id: action.id,
          user_id: commenter.id,
          content: meta.comments[cIdx],
          kind: 'NORMAL',
          created_at: new Date(now - (daysAgo * DAY) + (cIdx + 1) * 3600000).toISOString(),
        });
        chatCount++;
      }
    } else if (idx < 41 && joinedCrews.length > 0 && idx % 3 === 0) {
      const commenter = joinedCrews[0];
      const commentText = wroteResult
        ? '처음 해보는 활동이었는데 다들 친절히 알려주셔서 감사했습니다!'
        : '활동 장소 위치 확인했습니다. 주말에 뵐게요!';
      await admin.from('chat_messages').insert({
        action_id: action.id,
        user_id: commenter.id,
        content: commentText,
        kind: 'NORMAL',
      });
      chatCount++;
    }

    if (wroteResult) {
      const resultContent = meta?.resultContent ?? pick(RESULT_TEXTS, idx);
      const ownerVoice = meta?.ownerVoice ?? pick(OWNER_VOICES, idx);

      await admin.from('action_results').insert({
        action_id: action.id,
        content: resultContent,
        image_urls: imageUrls.length > 0 ? imageUrls : [IMG.community],
        owner_voice: ownerVoice,
      });
    }

    for (let k = 0; k < (idx % 5) + 1; k++) {
      const liker = users[(idx + k + 2) % users.length];
      if (liker && liker.id !== owner.id) {
        await admin.from('likes').insert({ user_id: liker.id, action_id: action.id });
      }
    }
    for (let k = 0; k < (idx % 3); k++) {
      const saver = users[(idx + k + 1) % users.length];
      if (saver && saver.id !== owner.id) {
        await admin.from('saves').insert({ user_id: saver.id, action_id: action.id });
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                 시드 데이터 생성 결과 요약');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`• 전체 Action 수 : ${actionCount}개 (ACTIONS 정의: ${ACTIONS.length}개)`);
  console.log(`• 상태별 Action 수:`);
  console.log(`   - DRAFT     : ${statusCounts.DRAFT ?? 0}개 (목표: 4개)`);
  console.log(`   - ACTIVE    : ${statusCounts.ACTIVE ?? 0}개 (목표: 55개)`);
  console.log(`   - ENDED     : ${statusCounts.ENDED ?? 0}개 (목표: 10개 — 정상 ${10 - earlyEndCount}개, 조기종료 ${earlyEndCount}개)`);
  console.log(`   - COMPLETED : ${statusCounts.COMPLETED ?? 0}개 (목표: 26개)`);
  console.log(`   - CANCELLED : ${statusCounts.CANCELLED ?? 0}개 (목표: 6개)`);
  console.log(`• DEMO 계정 : ${demoEmail} (비밀번호: ${PASSWORD})`);
  console.log(`• DEMO Host Action (${demoHostActions.length}개):`);
  for (const a of demoHostActions) {
    console.log(`   - [${a.status}] ${a.title}`);
  }
  console.log(`• DEMO Crew Action (${demoCrewActions.length}개):`);
  for (const a of demoCrewActions) {
    console.log(`   - [${a.partStatus}] ${a.title}`);
  }
  console.log(`• 현재 진행 중 Action 수 : ${liveCount}개 (목표: 3개)`);
  console.log(`• Lazy Sync 테스트 Action 수 : ${lazySyncCount}개 (목표: 2개)`);
  console.log(`• 조기 종료 Action 수 : ${earlyEndCount}개 (목표: 3개)`);
  console.log(`• 총 참여 건수 : ${partCount}건 · 소감(Crew Voice): ${voiceCount}건 · 댓글(채팅): ${chatCount}건`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

await clean();
if (!CLEAN_ONLY) {
  console.log('');
  await seed();
}
