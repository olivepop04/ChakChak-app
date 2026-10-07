/**
 * 착착(CHAK CHAK) — 시연·테스트용 시드 데이터 101개
 *
 *   npm run seed          채우기 (여러 번 돌려도 안전 — 지우고 다시 넣습니다)
 *   npm run seed:clean    시드 데이터만 지우기
 *
 * 2026-09-11에 41개 판을 이 파일로 교체했습니다 (성은님).
 * 앞 41개는 제목과 목록 순서를 그대로 두었으므로 **기존 액션 주소가 살아 있습니다.**
 * 목록 순서를 바꾸면 그 뒤 액션들의 주소가 전부 바뀌니, 추가할 때는 끝에 붙이세요.
 *
 * ── 특징 ────────────────────────────────────────────────
 * - 실제 서비스 수준의 자연스러운 제목 및 사람 문장의 고유 소개글·안내문
 * - 발표 및 전 기능 검증을 위한 101개 풀 시나리오 포함
 *   (DRAFT 4단계, 실시간 진행중, 게으른 동기화, 조기종료, 마감임박, 연일활동,
 *    결과보고서, 인원미달극복, 취소사유, DEMO 호스트/크루 시나리오 등)
 * - @good.seed 도메인 계정만 안전하게 지우고 새로 생성 (실제 계정 절대 보존)
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

const PRECOMPUTED_META = {};
try {
  const metaPath = path.resolve('scripts/data/action_ai_metadata_all.json');
  if (fs.existsSync(metaPath)) {
    const raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    for (const item of raw) {
      if (item.actions?.title) {
        PRECOMPUTED_META[item.actions.title] = item;
      }
    }
  }
} catch (e) {
  console.warn('사전 색인 메타데이터 로드 실패:', e.message);
}

const USERS = [
  { nick: '올리브', gender: 'FEMALE', bio: '동네에서 할 수 있는 좋은 일을 찾고 있어요.', categories: ['지역사회', '환경'], skills: ['청소·정리'] },
  { nick: '민준', gender: 'MALE', bio: '주말마다 몸 쓰는 봉사를 좋아합니다.', categories: ['지역사회', '환경'], skills: ['운전'] },
  { nick: '서연', gender: 'FEMALE', bio: '아이들과 함께하는 활동에 관심이 많아요.', categories: ['아동·청소년', '교육'], skills: ['교육·멘토링', '미술·공예'] },
  { nick: '도현', gender: 'MALE', bio: '환경 문제에 관심이 있습니다.', categories: ['환경'], skills: ['원예·식물관리'] },
  { nick: '지우', gender: 'MALE', bio: '유기동물 보호소에 자주 갑니다.', categories: ['동물'], skills: ['청소·정리'] },
  { nick: '하윤', gender: 'FEMALE', bio: '어르신들과 이야기 나누는 걸 좋아해요.', categories: ['노인', '지역사회'], skills: ['요리'] },
  { nick: '준서', gender: 'MALE', bio: '재능기부로 사진을 찍어드립니다.', categories: ['지역사회', '기타'], skills: ['사진 촬영', '영상 촬영·편집'] },
  { nick: '수아', gender: 'FEMALE', bio: '작은 일이라도 꾸준히 하려고 해요.', categories: ['동물', '환경'], skills: ['청소·정리'] },
  { nick: '예준', gender: 'MALE', bio: '주말에 뜻깊은 시간을 보내고 싶어요.', categories: ['장애', '지역사회'], skills: ['운전'] },
  { nick: '다은', gender: 'FEMALE', bio: '따뜻한 온기를 나누는 활동에 함께해요.', categories: ['노인', '지역사회'], skills: ['요리', '교육·멘토링'] },
  { nick: '시우', gender: 'MALE', bio: '이웃과 함께하는 봉사에 적극 참여합니다.', categories: ['지역사회', '장애'], skills: ['수리·시공'] },
  { nick: '채원', gender: 'FEMALE', bio: '동물과 자연을 사랑하는 사람입니다.', categories: ['동물', '환경'], skills: ['원예·식물관리'] },
  { nick: '유준', gender: 'MALE', bio: '작은 나눔이 큰 변화를 만든다고 믿어요.', categories: ['교육', '아동·청소년'], skills: ['컴퓨터·IT', '교육·멘토링'] },
  { nick: '서아', gender: 'FEMALE', bio: '다양한 사람들과 소통하며 배우고 싶습니다.', categories: ['교육', '장애'], skills: ['통역·번역', '교육·멘토링'] },
  { nick: '은우', gender: 'MALE', bio: '발로 뛰는 현장 봉사를 선호합니다.', categories: ['환경', '지역사회'], skills: ['운전'] },
  { nick: '윤서', gender: 'FEMALE', bio: '깨끗한 환경을 만드는 일에 동참합니다.', categories: ['환경'], skills: ['청소·정리', '디자인'] },
  { nick: '도윤', gender: 'MALE', bio: '지역사회 발전에 기여하고 싶습니다.', categories: ['지역사회'], skills: ['글쓰기', 'SNS 홍보'] },
  { nick: '소율', gender: 'FEMALE', bio: '아이들의 밝은 미소를 지켜주고 싶어요.', categories: ['아동·청소년', '교육'], skills: ['음악·공연', '미술·공예'] },
  { nick: '재윤', gender: 'MALE', bio: '어르신들을 공경하고 돕는 일에 앞장섭니다.', categories: ['노인'], skills: ['컴퓨터·IT', '교육·멘토링'] },
  { nick: '지아', gender: 'FEMALE', bio: '함께 만들어가는 따뜻한 세상을 꿈꿔요.', categories: ['장애', '노인'], skills: ['요리'] },
  { nick: '선우', gender: 'MALE', bio: '주변의 작은 도움부터 실천합니다.', categories: ['지역사회', '환경'], skills: ['청소·정리'] },
  { nick: '하은', gender: 'FEMALE', bio: '의미 있는 나눔을 찾아 참여하고 있어요.', categories: ['동물', '아동·청소년'], skills: ['사진 촬영'] },
  { nick: '정우', gender: 'MALE', bio: '에너지 넘치는 활동적인 봉사를 좋아해요.', categories: ['환경', '지역사회'], skills: ['수리·시공'] },
  { nick: '유나', gender: 'FEMALE', bio: '더 나은 내일을 위해 행동하는 크루입니다.', categories: ['교육', '환경'], skills: ['디자인', 'SNS 홍보'] },
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
  // 동물
  animal: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1200',
  dog: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200',
  dog_walk: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1200',
  cat: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1200',
  cat_warm: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=1200',

  // 환경
  env: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=1200',
  tree: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1200',
  recycle: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=1200',
  beach: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=1200',
  // 강둑에서 쓰레기를 줍는 봉사자들 — 전에는 색색의 분리수거 통 사진이라 하천 정화와 안 맞았다
  river: 'https://images.unsplash.com/photo-1758599668932-484f54cdf48f?w=1200',
  garden: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200',

  // 아동·청소년
  kids: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=1200',
  book: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200',
  study: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200',

  // 노인 (신규 맞춤 이미지로 교체)
  senior: '/images/actions/senior_tea.jpg',
  senior_tea: '/images/actions/senior_tea.jpg',
  senior_kiosk: '/images/actions/kiosk.jpg',
  senior_smartphone: '/images/actions/smartphone.jpg',
  senior_lunchbox: '/images/actions/lunchbox.jpg',
  senior_wallpaper: '/images/actions/wallpaper.jpg',
  senior_boardgame: '/images/actions/boardgame.jpg',
  senior_nail_art: '/images/actions/nail_art.jpg',
  // 돌봄 장면(요양 시설에서 어르신을 부축하며 웃는 돌보미) — 전에는 부엌에서 칼로 생선을 손질하는 사진이라 목욕 봉사와 안 맞았다
  senior_care: 'https://images.unsplash.com/photo-1773227055624-07b515ba87c5?w=1200',

  // 장애 (신규 맞춤 이미지로 교체)
  wheelchair: '/images/actions/wheelchair.jpg',
  bowling: '/images/actions/bowling.jpg',
  guide_runner: '/images/actions/guide_runner.jpg',
  art_therapy: '/images/actions/art_therapy.jpg',
  sign_language: '/images/actions/sign_language.jpg',
  care: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200',

  // 지역사회 / 나눔 / 식사
  community: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200',
  sharing: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200',
  briquette: '/images/actions/briquette.jpg',
  food: 'https://images.unsplash.com/photo-1593113630400-ea4288922497?w=1200',
  cooking: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200',
  // 사다리에 올라 벽에 그림을 그리는 모습 — 전에는 꽃 정물화(그림 작품) 사진이라 벽화 봉사와 안 맞았다
  mural: 'https://images.unsplash.com/photo-1684783593166-2828c7531eee?w=1200',
  snow: 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?w=1200',

  // 교육
  edu: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200',
};

const THEME_EXTRAS = {
  '동물': [IMG.dog_walk, IMG.animal, IMG.dog, IMG.cat, IMG.cat_warm, IMG.community],
  '환경': [IMG.tree, IMG.recycle, IMG.env, IMG.beach, IMG.river, IMG.garden, IMG.community],
  '지역사회': [IMG.community, IMG.sharing, IMG.briquette, IMG.senior_wallpaper, IMG.senior_lunchbox, IMG.food, IMG.cooking, IMG.mural, IMG.snow],
  '아동·청소년': [IMG.kids, IMG.book, IMG.study, IMG.art_therapy, IMG.senior_boardgame, IMG.community, IMG.edu],
  '노인': [IMG.senior_tea, IMG.senior_kiosk, IMG.senior_smartphone, IMG.senior_lunchbox, IMG.senior_boardgame, IMG.senior_nail_art, IMG.senior_wallpaper, IMG.senior_care],
  '장애': [IMG.wheelchair, IMG.bowling, IMG.guide_runner, IMG.art_therapy, IMG.sign_language, IMG.care, IMG.book],
  '교육': [IMG.edu, IMG.study, IMG.senior_smartphone, IMG.senior_kiosk, IMG.book, IMG.community],
  '기타': [IMG.community, IMG.sharing, IMG.briquette, IMG.food, IMG.kids, IMG.care],
};

function getActionImages(primary, category, idx) {
  if (!primary) return { imageUrls: [], thumbnailIndex: 0 };

  const mod = idx % 5;
  // idx % 5 === 0 -> 1장 (~20%)
  // idx % 5 === 1, 3 -> 2장 (~40%)
  // idx % 5 === 2, 4 -> 3장 (~40%)
  const count = (mod === 0) ? 1 : (mod === 1 || mod === 3) ? 2 : 3;

  if (count === 1) {
    return { imageUrls: [primary], thumbnailIndex: 0 };
  }

  const pool = THEME_EXTRAS[category] || THEME_EXTRAS['기타'];
  const filtered = pool.filter((url) => url !== primary);

  const extra1 = filtered[idx % filtered.length];
  const remaining = filtered.filter((url) => url !== extra1);
  const extra2 = remaining[(idx + 1) % remaining.length];

  if (count === 2) {
    // 2장일 때 thumbnailIndex 0과 1을 섞음
    const thumbIdx = (idx % 4 === 1) ? 1 : 0;
    const urls = thumbIdx === 1 ? [extra1, primary] : [primary, extra1];
    return { imageUrls: urls, thumbnailIndex: thumbIdx };
  }

  // count === 3: thumbnailIndex 0, 1, 2를 골고루 섞음
  let thumbIdx = 0;
  if (idx % 6 === 2) thumbIdx = 1;
  else if (idx % 6 === 4) thumbIdx = 2;

  let urls;
  if (thumbIdx === 0) {
    urls = [primary, extra1, extra2];
  } else if (thumbIdx === 1) {
    urls = [extra1, primary, extra2];
  } else {
    urls = [extra1, extra2, primary];
  }

  return { imageUrls: urls, thumbnailIndex: thumbIdx };
}

const EXTRA_CATEGORY = {
  '유기묘 임시보호 설명회': '교육',
  '폐현수막으로 장바구니 만들기': '지역사회',
  '경로당 대청소': '지역사회',
  '골목길 벽화 그리기': '환경',
};

/**
 * 101개 액션 정의
 * [제목, 카테고리, 이미지, 주소, 상태, daysAgo, whenDay, items, recruitDaysBefore, meta]
 */
const ACTIONS = [
  // ── [01 ~ 41: 기존 41개 — 자연스러운 제목과 맞춤 소개글로 전면 업그레이드] ──

  ['동네 플로깅 모집', '환경', IMG.env, '서울특별시 성동구 왕십리로 100', 'ACTIVE', 2, 6,
    [['플로깅 참가자', 'PERSON', 'M', 10, null, '명', 'ANY']], 7,
    {
      description: '성수동 골목길과 서울숲 주변을 함께 걸으며 무단 투기된 쓰레기를 줍는 동네 플로깅입니다. 상쾌한 아침 공기를 마시며 동네도 깨끗하게 만들고 가벼운 조깅도 함께해요!',
      notice: '개인 텀블러와 편한 운동화를 착용해 주세요. 종량제 봉투와 집게, 장갑은 현장에서 배부합니다.',
      comments: ['성수동 플로깅 매주 기다렸는데 이번에 꼭 신청합니다!', '혼자 참여해도 괜찮나요?', '물론입니다! 처음 오시는 분들도 다 함께 짝지어 걸어요.']
    }],

  ['우리 동네 보호소를 함께 도와요', '동물', IMG.dog, '서울특별시 성동구 왕십리로 100', 'ACTIVE', 0, 5,
    [['산책 도우미', 'PERSON', 'M', 5, null, '명', 'ANY'], ['사료', 'GOODS', 'M', 50, null, '포', 'ANY']], 1,
    {
      description: '성수동 유기동물 보호소의 아이들이 깨끗하고 쾌적한 환경에서 지낼 수 있도록 견사 청소와 가벼운 산책을 함께합니다. 사료와 간식 후원 물품도 소중히 사용됩니다.',
      notice: '동물 털이나 흙이 묻어도 괜찮은 편한 긴 옷을 착용해 주세요. 마스크와 위생 장갑은 센터에 준비되어 있습니다.',
      comments: ['사료 2포 후원 신청했습니다!', '강아지들이랑 산책할 생각에 벌써 설레네요.']
    }],

  ['유기견 산책 친구를 찾습니다', '동물', IMG.dog_walk, '서울특별시 마포구 월드컵로 30', 'ACTIVE', 4, 7,
    [['산책 봉사자', 'PERSON', 'R', 3, 6, '명', 'ANY']], 1,
    {
      description: '마포구 유기견 쉼터에서 사람의 따뜻한 손길과 바깥공기가 그리운 강아지들과 함께 평화의 공원을 산책할 친구를 찾습니다. 대형견과 소형견 산책 경험이 있으신 분들 특히 환영합니다.',
      notice: '리드줄을 안전하게 잡을 수 있는 편한 복장과 운동화를 권장합니다. 배변봉투와 물통은 쉼터에서 제공합니다.'
    }],

  ['길고양이 겨울집 만들기', '동물', IMG.cat, '경기도 고양시 일산동구', 'ACTIVE', 6, 10,
    [['제작 도우미', 'PERSON', 'M', 4, null, '명', 'ANY'], ['스티로폼 박스', 'GOODS', 'M', 20, null, '개', 'ANY']], 1,
    {
      description: '일산 주택가 길고양이들이 혹독한 겨울 추위를 무사히 견딜 수 있도록 단열 스티로폼과 보온재로 튼튼한 겨울집을 제작합니다. 손재주가 없어도 누구나 쉽게 조립할 수 있습니다.',
      notice: '칼과 테이프를 사용하는 작업이 있으니 목장갑을 지참하시면 좋습니다. 스티로폼 박스 여분이 있다면 가져와 주세요!'
    }],

  ['보호소 겨울 준비를 함께해요', '동물', IMG.animal, '서울특별시 성동구 성수일로 10', 'COMPLETED', 30, -22,
    [['현장 봉사', 'PERSON', 'M', 6, null, '명', 'ANY'], ['담요', 'GOODS', 'M', 30, null, '장', 'ANY']], 1,
    {
      description: '성수 보호소 아이들이 따뜻한 겨울을 보낼 수 있도록 견사 방풍 비닐을 설치하고 두꺼운 담요를 깔아주는 월동 준비 봉사였습니다.',
      notice: '작업용 장갑과 마스크를 착용하고 안전하게 진행되었습니다.',
      resultContent: '크루 6명과 함께 보호소 4개 사육동의 방풍 비닐 설치와 담요 30장 배치를 무사히 마쳤습니다. 아이들이 따뜻하게 겨울을 날 수 있게 되었습니다.',
      ownerVoice: '갑작스러운 한파 예보에 걱정이 많았는데 든든한 크루분들 덕분에 하루 만에 모든 보온 작업을 끝냈습니다. 진심으로 감사드립니다.'
    }],

  ['유기묘 임시보호 설명회', '동물', IMG.cat, '서울특별시 종로구 종로 1', 'ENDED', 18, -5,
    [['참가자', 'PERSON', 'R', 5, 15, '명', 'ANY']], 1,
    {
      description: '종로구 입양센터에서 유기묘 임시보호(임보)를 처음 시작하는 분들을 위해 주의사항과 기본 케어법, 입양 연계 절차를 공유하는 온·오프라인 설명회였습니다.',
      notice: '교재와 간단한 다과가 제공되었습니다. 현장 질의응답을 통해 실질적인 팁을 나눴습니다.'
    }],

  ['한강 플로깅 함께해요', '환경', IMG.env, '서울특별시 영등포구 여의동로 330', 'ACTIVE', 1, 6,
    [['참가자', 'PERSON', 'M', 10, null, '명', 'ANY'], ['집게', 'GOODS', 'M', 10, null, '개', 'ANY']], 1,
    {
      description: '여의도 한강공원 물빛광장부터 여의나루역 주변까지 시민들이 버리고 간 쓰레기를 줍고 분리배출하는 한강 정화 플로깅입니다. 아름다운 한강을 함께 지켜요.',
      notice: '자외선 차단 모자와 편한 운동화, 개인 음료를 준비해 주세요. 집게와 친환경 생분해 봉투를 나눠드립니다.'
    }],

  ['바닷가 쓰레기 줍기', '환경', IMG.beach, '부산광역시 해운대구 해운대해변로', 'ACTIVE', 8, 12,
    [['참가자', 'PERSON', 'M', 15, null, '명', 'ANY']], 1,
    {
      description: '부산 해운대 백사장과 동백섬 산책로에 밀려온 해양 쓰레기와 플라스틱을 수거하는 비치코밍 활동입니다. 푸른 바다를 사랑하는 시민 누구나 환영합니다.',
      notice: '모래사장을 오래 걸으므로 편한 신발을 신어주세요. 젖은 해양 부유물이 많아 방수 장갑을 권장합니다.'
    }],

  ['우리 동네 분리배출 캠페인', '환경', IMG.recycle, '서울특별시 관악구 관악로 1', 'COMPLETED', 40, -30,
    [['캠페인 도우미', 'PERSON', 'R', 4, 8, '명', 'ANY']], 1,
    {
      description: '관악구 대학동 원룸촌 주변의 올바른 투명 페트병 라벨 제거 및 재활용품 분리배출 방법을 알리는 가두 캠페인을 진행했습니다.',
      notice: '어깨띠와 홍보 전단지를 배부해 드렸습니다.',
      resultContent: '원룸 단지 30여 곳에 올바른 분리수거 안내문을 부착하고 주민 200여 분께 휴대용 라벨 제거기를 나눠드렸습니다.',
      ownerVoice: '자취촌 분리배출 취약 구역이 눈에 띄게 깨끗해졌습니다. 열정적으로 홍보해 주신 크루 여러분 덕분입니다.'
    }],

  ['텀블러 나눔 부스 운영', '환경', IMG.env, '경기도 수원시 팔달구', 'ACTIVE', 5, 9,
    [['부스 운영', 'PERSON', 'R', 2, 4, '명', 'ANY'], ['텀블러', 'GOODS', 'M', 100, null, '개', 'ANY']], 1,
    {
      description: '수원 팔달문 광장에서 집에서 쓰지 않는 잠자는 텀블러를 기부받아 세척 후 일회용 컵 대신 나눔하는 자원순환 캠페인 부스를 운영합니다.',
      notice: '사용하지 않는 깨끗한 텀블러가 있다면 현장에 직접 기부해 주셔도 좋습니다!'
    }],

  ['도시 텃밭 가꾸기', '환경', IMG.garden, '서울특별시 은평구 통일로', 'ACTIVE', 11, 14,
    [['농사 도우미', 'PERSON', 'M', 6, null, '명', 'ANY']], 1,
    {
      description: '은평구 주민센터 옥상 텃밭에서 친환경 농법으로 배추와 상추 모종을 심고 잡초를 뽑는 옥상 정원 가꾸기 봉사입니다. 수확물은 지역 독거 어르신께 전달됩니다.',
      notice: '흙이 묻어도 되는 옷과 모자, 장화를 권장합니다. 모종삽과 원예 장갑이 준비되어 있습니다.'
    }],

  ['폐현수막으로 장바구니 만들기', '환경', IMG.env, '인천광역시 연수구', 'COMPLETED', 46, -36,
    [['재봉 봉사', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['폐현수막', 'GOODS', 'M', 40, null, '장', 'ANY']], 1,
    {
      description: '선거와 행사 후 버려지는 폐현수막을 깨끗이 세척하여 튼튼하고 실용적인 다회용 장바구니로 재탄생시키는 업사이클링 재봉 봉사였습니다.',
      notice: '재봉틀 사용 경험이 있으신 분들이 재능기부로 참여했습니다.',
      resultContent: '수거된 폐현수막 40장을 재단하여 120개의 튼튼한 장바구니를 완성, 지역 전통시장 상인회에 전달했습니다.',
      ownerVoice: '버려질 쓰레기가 예쁜 가방으로 바뀌는 걸 보며 모두가 큰 보람을 느꼈습니다. 솜씨 좋은 크루분들 최고였어요!'
    }],

  ['동네 공터를 작은 정원으로', '지역사회', IMG.garden, '서울특별시 성북구 보문로', 'ACTIVE', 0, 8,
    [['정원 조성', 'PERSON', 'M', 8, null, '명', 'ANY'], ['모종', 'GOODS', 'M', 60, null, '개', 'ANY']], 1,
    {
      description: '성북구 보문동 골목길 방치된 쓰레기 무단 투기 공터에 예쁜 꽃과 화초를 심어 주민들이 쉬어갈 수 있는 게릴라 가드닝 쉼터를 만듭니다.',
      notice: '물조리개와 모종삽 등 원예 도구는 준비되어 있습니다. 편한 작업복 차림으로 오세요.'
    }],

  ['주말 이틀간의 따뜻한 급식 나눔', '지역사회', IMG.food, '서울특별시 성동구 마장로 20', 'ACTIVE', 2, 5,
    [['1일차 배식팀', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['2일차 정리팀', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      description: '성동구 마장동 나눔의 집에서 주말 이틀 동안 결식 우려 어르신 100분께 영양 가득한 점심 식사를 대접합니다. 1일차 배식팀, 2일차 뒷정리팀으로 나누어 모집합니다.',
      notice: '위생을 위해 단정한 옷차림과 마스크 착용을 부탁드립니다. 앞치마와 위생모는 현장에서 제공됩니다.'
    }],

  ['골목길 벽화 그리기', '지역사회', IMG.mural, '부산광역시 사하구', 'ACTIVE', 9, 13,
    [['그림 봉사', 'PERSON', 'R', 5, 10, '명', 'ANY'], ['페인트', 'GOODS', 'M', 15, null, '통', 'ANY']], 1,
    {
      description: '부산 사하구 감천동 노후 주택가 골목 계단길에 밝고 따뜻한 희망의 테마 벽화를 그립니다. 스케치가 되어 있어 붓질만 하실 수 있으면 초보자도 환영합니다.',
      notice: '옷이나 신발에 페인트가 튈 수 있으니 버려도 괜찮은 옷과 신발을 착용해 주세요. 붓과 앞치마는 지급됩니다.'
    }],

  ['우리 동네 눈 치우기', '지역사회', IMG.snow, '강원특별자치도 춘천시', 'COMPLETED', 52, -44,
    [['제설 봉사', 'PERSON', 'M', 10, null, '명', 'MALE']], 1,
    {
      description: '춘천 시내 폭설 후 결빙 위험이 큰 주택가 비탈길과 버스 정류장 주변 인도에 쌓인 눈을 치우고 염화칼슘을 살포한 안전 제설 봉사였습니다.',
      notice: '미끄럼 방지 방한화와 두꺼운 방한 장갑을 착용하고 진행했습니다.',
      resultContent: '경사로 5개 구간(총 1.2km)의 제설 작업을 완료하여 어르신과 주민들의 낙상 사고를 예방했습니다.',
      ownerVoice: '영하의 날씨 속에서도 묵묵히 눈을 치워주신 크루분들의 땀방울 덕분에 골목길이 안전해졌습니다.'
    }],

  ['이웃과 함께하는 김장 나눔', '지역사회', IMG.food, '서울특별시 도봉구 도봉로', 'COMPLETED', 36, -27,
    [['김장 봉사', 'PERSON', 'M', 12, null, '명', 'ANY'], ['배추', 'GOODS', 'M', 100, null, '포기', 'ANY']], 1,
    {
      description: '도봉구 복지관 앞마당에서 자원봉사자들과 함께 배추김치 100포기를 담가 취약계층 40가구에 가구당 10kg씩 직접 전달해 드린 김장 나눔이었습니다.',
      notice: '앞치마와 고무장갑, 김장 매트가 현장에 준비되었습니다.',
      resultContent: '절임배추 100포기 양념 버무리기부터 포장 및 배달까지 4시간 만에 완벽히 마쳤습니다.',
      ownerVoice: '매운 고춧가루에 눈물이 나면서도 웃음꽃을 피우며 김치통을 채워주신 크루분들 덕분에 어르신들이 따뜻한 겨울을 나시게 되었습니다.'
    }],

  ['재난 대비 물품 정리', '지역사회', IMG.community, '대구광역시 수성구', 'CANCELLED', 20, 3,
    [['정리 봉사', 'PERSON', 'R', 4, 8, '명', 'ANY']], 1,
    {
      description: '대구 수성구 구민회관 물류창고에서 비상 재난 구호 물품의 유통기한을 전수 점검하고 품목별로 재분류하는 창고 정리 봉사입니다.',
      notice: '먼지가 많으므로 마스크를 준비해 주세요.',
      cancelReason: '창고 내 소방 설비 긴급 보수 공사로 인하여 시설 출입이 통제되어 부득이 취소되었습니다.'
    }],

  ['아이들과 만드는 작은 책장', '아동·청소년', IMG.book, '부산광역시 금정구', 'COMPLETED', 44, -34,
    [['목공 봉사', 'PERSON', 'R', 3, 6, '명', 'ANY'], ['책', 'GOODS', 'M', 200, null, '권', 'ANY']], 1,
    {
      description: '부산 금정구 지역아동센터 아이들의 방과후 쉼터에 놓을 친환경 원목 책장을 함께 조립하고 기부받은 아동 도서를 채워 넣은 목공 나눔 활동이었습니다.',
      notice: '조립용 전동 드라이버와 사포는 현장에서 지급되었습니다.',
      resultContent: '2단 원목 책장 3세트 조립을 완료하고, 목표를 초과 달성하여 기증받은 도서 250권을 정성껏 분류하여 정리했습니다.',
      ownerVoice: '아이들이 새 책장을 보고 환호성을 지르던 모습이 눈에 선합니다. 뚝딱뚝딱 책장을 만들어주신 크루님들 멋졌습니다!'
    }],

  ['방과 후 공부방 선생님', '아동·청소년', IMG.kids, '서울특별시 노원구 상계로', 'ACTIVE', 4, 11,
    [['수학 선생님', 'PERSON', 'R', 2, 2, '명', 'ANY'], ['영어 선생님', 'PERSON', 'R', 2, 2, '명', 'ANY']], 1,
    {
      description: '노원구 상계동 드림스타트 공부방에서 기초 학력 보충이 필요한 초·중학생들을 대상으로 수학과 영어를 1:1 눈높이에 맞춰 지도해 줄 선생님을 모십니다.',
      notice: '기본 교재와 학습 지도 가이드라인이 준비되어 있어 교육 봉사 경험이 없으셔도 차근차근 하실 수 있습니다.'
    }],

  ['아동센터 도서 정리', '아동·청소년', IMG.book, '경기도 부천시 원미구', 'ACTIVE', 7, 9,
    [['정리 봉사', 'PERSON', 'M', 5, null, '명', 'ANY']], 1,
    {
      description: '부천 원미구 푸른꿈 아동센터 도서실의 낡고 훼손된 책을 솎아내고, 십진분류표에 맞춰 책등 라벨을 부착하고 책장을 정리하는 도서관 환경 개선 활동입니다.',
      notice: '가벼운 먼지가 날릴 수 있으니 편한 복장으로 오시면 좋습니다. 라벨 테이프와 가위는 센터에서 지급합니다.'
    }],

  ['청소년 진로 이야기 나눔', '아동·청소년', IMG.kids, '서울특별시 강서구 화곡로', 'ENDED', 22, -6,
    [['멘토', 'PERSON', 'R', 4, 8, '명', 'ANY']], 1,
    {
      description: '강서구 화곡 청소년 문화의집에서 다양한 직업을 가진 멘토들이 중·고등학생들과 둥글게 둘러앉아 직업 선택의 고민과 대학 생활 이야기를 나누는 진로 멘토링 콘서트였습니다.',
      notice: '학생들에게 편안한 선배처럼 조언해 주실 분들이 따뜻하게 함께했습니다.'
    }],

  ['어린이 도서 기부 캠페인', '아동·청소년', IMG.book, '광주광역시 서구', 'ACTIVE', 13, 16,
    [['도서', 'GOODS', 'M', 300, null, '권', 'ANY']], 1,
    {
      description: '광주 서구 관내 작은도서관 및 다문화 센터에 전달할 어린이 전래동화, 과학도서, 그림책 300권을 모으는 도서 수거 및 분류 봉사입니다.',
      notice: '출판 연도 5년 이내, 파손이나 낙서가 없는 깨끗한 아동 도서를 직접 기부해 주시거나 분류에 참여해 주세요.'
    }],

  ['어르신 말벗 봉사', '노인', IMG.senior_tea, '서울특별시 중랑구 면목로', 'ACTIVE', 1, 7,
    [['말벗 봉사자', 'PERSON', 'M', 6, null, '명', 'ANY']], 1,
    {
      description: '중랑구 면목동 거주 홀몸 어르신 댁을 2인 1조로 방문하여 따뜻한 차 한잔과 함께 일상 대화를 나누고 혈압 체크와 건강 안부를 묻는 온기 나눔입니다.',
      notice: '어르신의 말씀을 귀담아듣고 공감해 주실 따뜻한 마음만 가지고 오시면 됩니다. 소정의 다과를 함께 전달합니다.'
    }],

  ['경로당 대청소', '노인', IMG.community, '경기도 성남시 수정구', 'ACTIVE', 10, 12,
    [['청소 봉사', 'PERSON', 'R', 6, 12, '명', 'ANY']], 1,
    {
      description: '성남시 수정구 태평동 경로당의 어르신들이 쾌적하게 생활하실 수 있도록 방충망 먼지 청소, 바닥 물걸레질, 화장실 소독 및 주방 묵은 때를 시원하게 씻어냅니다.',
      notice: '물청소에 적합한 반바지나 편한 트레이닝복, 고무장갑을 지참해 주시면 좋습니다. 청소 도구는 완비되어 있습니다.'
    }],

  ['어르신 목욕 봉사 (남성)', '노인', IMG.senior_care, '대전광역시 중구', 'ACTIVE', 6, 10,
    [['목욕 봉사', 'PERSON', 'R', 3, 5, '명', 'MALE']], 1,
    {
      description: '대전 중구 노인복지센터에서 거동이 불편하신 남성 어르신들의 온천수 목욕 및 등 밀어드리기, 머리 감겨드리기를 보조해 드리는 사랑의 목욕 봉사입니다.',
      notice: '남성 봉사자 전용 항목입니다. 미끄럼 방지 실내화와 반바지, 갈아입으실 여벌 속옷을 준비해 주세요.'
    }],

  ['어르신 목욕 봉사 (여성)', '노인', IMG.senior_care, '대전광역시 중구', 'ACTIVE', 6, 10,
    [['목욕 봉사', 'PERSON', 'R', 3, 5, '명', 'FEMALE']], 1,
    {
      description: '대전 중구 노인복지센터에서 홀로 목욕하기 어려우신 여성 어르신들의 목욕을 정성껏 돕고 로션 발라드리기와 머리 말리기를 보조하는 목욕 나눔입니다.',
      notice: '여성 봉사자 전용 항목입니다. 습한 목욕탕 환경이므로 반팔, 반바지와 방수 슬리퍼, 여벌 옷을 챙겨와 주세요.'
    }],

  ['홀몸 어르신 도시락 배달', '노인', IMG.senior_lunchbox, '서울특별시 동대문구', 'COMPLETED', 38, -28,
    [['배달 봉사', 'PERSON', 'M', 8, null, '명', 'ANY'], ['도시락', 'GOODS', 'M', 80, null, '개', 'ANY']], 1,
    {
      description: '동대문구 답십리동 독거 어르신 80가구에 갓 지은 따뜻한 영양 도시락을 집 앞까지 도보 및 차량으로 직접 배달하고 안부를 확인한 봉사였습니다.',
      notice: '보온 도시락 가방과 배달 명단이 제공되었습니다.',
      resultContent: '도시락 80개 전량을 정해진 시간 내에 배달 완료하고, 어르신들의 건강 상태 체크리스트를 복지관에 인계했습니다.',
      ownerVoice: '대문 앞까지 나와 손을 흔들어주시던 할머니의 모습에 가슴이 뭉클했습니다. 한 분도 빠짐없이 신속히 배달해 주신 크루분들 감사해요.'
    }],

  ['어르신 스마트폰 교실', '노인', IMG.senior_smartphone, '울산광역시 남구', 'ENDED', 26, -4,
    [['강사 도우미', 'PERSON', 'R', 3, 6, '명', 'ANY']], 1,
    {
      description: '울산 남구 노인복지관 어르신들께 카카오톡 사진 전송, 지도 앱 길찾기, 보이스피싱 예방 설정을 1:1 밀착 코칭해 드린 스마트폰 활용 강좌였습니다.',
      notice: '스마트폰 기본 조작이 익숙하신 분들이 보조 강사로 활약하셨습니다.'
    }],

  ['휠체어 이동 도우미', '장애', IMG.wheelchair, '서울특별시 서대문구', 'ACTIVE', 5, 8,
    [['이동 봉사', 'PERSON', 'R', 4, 8, '명', 'ANY']], 1,
    {
      description: '서대문구 독립문역 인근에서 휠체어를 이용하시는 중증 장애인분들의 문화센터 나들이 이동 경로 동행 및 지하철 리프트 이용을 안전하게 보조합니다.',
      notice: '휠체어 조작 요령은 활동 전 10분간 안전 교육을 진행합니다. 편한 운동화를 반드시 착용해 주세요.'
    }],

  ['점자 도서 제작 봉사', '장애', IMG.book, '서울특별시 강남구 테헤란로', 'ACTIVE', 12, 15,
    [['제작 봉사', 'PERSON', 'M', 5, null, '명', 'ANY']], 1,
    {
      description: '강남구 점자도서관에서 시각장애인용 e-book 및 점역 도서 제작을 위해 일반 스캔 도서의 오탈자를 교정하고 컴퓨터 워드 입력 타이핑을 지원하는 재능기부입니다.',
      notice: '한글 맞춤법과 키보드 타자 입력에 능숙하신 분 환영합니다. 개인 노트북을 지참해 주시기 바랍니다.'
    }],

  ['수어 통역 재능기부', '장애', IMG.sign_language, '경기도 안양시 동안구', 'COMPLETED', 48, -38,
    [['수어 통역', 'PERSON', 'R', 2, 3, '명', 'ANY']], 1,
    {
      description: '안양시 동안구 장애인 예술제 무대에서 청각장애인 관객들을 위해 연극 대사와 사회자 안내 멘트를 실시간 수어로 통역한 뜻깊은 무대였습니다.',
      notice: '단정한 검정 계열 상의를 착용하고 진행되었습니다.',
      resultContent: '행사 2시간 동안 2인 1조 릴레이 수어 통역을 차질 없이 진행하여 청각장애인 관람객 50여 분의 큰 박수를 받았습니다.',
      ownerVoice: '무대 위에서 손끝으로 마음을 잇는 크루분들의 열정에 큰 감동을 받았습니다. 멋진 수어 통역 감사드립니다.'
    }],

  ['다문화 가정 한글 교실', '교육', IMG.edu, '경기도 화성시', 'ACTIVE', 4, 9,
    [['한글 선생님', 'PERSON', 'R', 3, 6, '명', 'ANY']], 1,
    {
      description: '화성시 다문화가족지원센터에서 이주 여성 및 다문화 자녀들을 위해 기초 한글 자모음 읽기와 생활 한국어 회화를 친절하게 알려줄 자원교사를 모집합니다.',
      notice: '친절하고 또박또박 발음해 주실 분이면 충분합니다. 교재와 플래시 카드는 센터에 준비되어 있습니다.'
    }],

  ['시니어 컴퓨터 교실 보조', '교육', IMG.senior_smartphone, '서울특별시 구로구 디지털로', 'ACTIVE', 8, 11,
    [['보조 강사', 'PERSON', 'M', 4, null, '명', 'ANY']], 1,
    {
      description: '구로 디지털단지 평생학습관에서 어르신 컴퓨터 기초반(한글 문서 작성, 인터넷 검색) 수업 중 마우스 조작과 타자에 서투신 어르신 옆에서 1:1로 실습을 도와드립니다.',
      notice: '컴퓨터에 대한 전문 지식보다는 어르신의 질문을 웃는 얼굴로 반복해서 설명해 주실 인내심이 중요합니다!'
    }],

  ['중학생 코딩 멘토링', '교육', IMG.kids, '서울특별시 송파구 올림픽로', 'ACTIVE', 14, 18,
    [['멘토', 'PERSON', 'R', 4, 8, '명', 'ANY']], 1,
    {
      description: '송파구 청소년 수련관에서 방과후 스크래치 및 엔트리 블록 코딩 기초를 배우는 중학생들의 게임 만들기 프로젝트를 멘토링해 줄 대학생 및 개발자 멘토를 찾습니다.',
      notice: '기초적인 코딩 알고리즘 이해도가 있으신 분이면 누구나 환영합니다. 노트북은 수련관 컴퓨터실을 이용합니다.'
    }],

  ['학습지 정리 및 발송', '교육', IMG.book, '인천광역시 부평구', 'COMPLETED', 42, -32,
    [['정리 봉사', 'PERSON', 'M', 6, null, '명', 'ANY']], 1,
    {
      description: '부평구 교육지원센터에서 도서벽지 및 다문화 아동들에게 보낼 국어·수학 홈스쿨링 학습지 키트를 월별로 포장하고 우체국 택배로 발송한 작업이었습니다.',
      notice: '상자 포장용 테이프와 운송장 출력 장비가 지원되었습니다.',
      resultContent: '목표 인원보다 적은 5명의 크루가 모였지만, 손발을 척척 맞춰 학습 교재 500세트 포장과 발송 접수를 무사히 마쳤습니다.',
      ownerVoice: '아이들의 공부를 도울 교재 키트가 무사히 떠났습니다. 손발 맞춰 척척 작업해 주신 크루 여러분 고생 많으셨습니다.'
    }],

  ['무료 프로필 사진 촬영', '기타', IMG.community, '서울특별시 용산구 이태원로', 'ACTIVE', 6, 13,
    [['사진작가', 'PERSON', 'R', 1, 2, '명', 'ANY'], ['보조', 'PERSON', 'M', 2, null, '명', 'ANY']], 1,
    {
      description: '용산구 이태원 청년 복지관에서 취업 준비생과 취약계층 청년들을 위해 입사지원서용 증명사진 및 프로필 사진을 무료로 촬영하고 기본 보정을 재능기부합니다.',
      notice: '사진 촬영 작가님과 조명 보조, 의상 정돈 및 헤어 메이크업 수정을 도와주실 크루를 함께 모십니다.'
    }],

  ['헌혈 캠페인 도우미', '기타', IMG.community, '서울특별시 종로구 세종대로', 'ACTIVE', 9, 12,
    [['캠페인 도우미', 'PERSON', 'M', 6, null, '명', 'ANY']], 1,
    {
      description: '종로구 광화문 헌혈의 집 인근 거리에서 시민들에게 혈액 수급난 해소를 위한 헌혈 동참 리플릿을 배부하고 헌혈 버스 탑승을 안내하는 가두 캠페인입니다.',
      notice: '밝은 목소리와 적극적인 태도로 동참해 주실 분을 환영합니다. 조끼와 안내 피켓이 제공됩니다.'
    }],

  ['연말 나눔 장터 운영', '기타', IMG.food, '경기도 용인시 수지구', 'COMPLETED', 50, -40,
    [['부스 운영', 'PERSON', 'R', 6, 10, '명', 'ANY'], ['기부 물품', 'GOODS', 'M', 150, null, '점', 'ANY']], 1,
    {
      description: '용인 수지구 체육공원에서 시민들이 기증한 생활용품, 의류, 도서를 판매하고 수익금 전액을 결식아동 돕기에 기부한 사랑의 바자회였습니다.',
      notice: '물품 진열대와 잔돈 교환 부스를 마련하여 안전하게 진행했습니다.',
      resultContent: '기증 물품 180여 점 완판, 총 185만 원의 바자회 수익금을 모금하여 복지재단에 전액 기탁했습니다.',
      ownerVoice: '추운 날씨에 손을 호호 불어가며 물건을 팔아주신 크루분들 덕분에 목표 금액을 초과 달성했습니다. 감사하고 자랑스럽습니다!'
    }],

  ['소아병동 인형 만들기', '기타', IMG.kids, '서울특별시 서초구 반포대로', 'ACTIVE', 11, 17,
    [['바느질 봉사', 'PERSON', 'M', 5, null, '명', 'ANY'], ['인형 솜', 'GOODS', 'M', 40, null, 'kg', 'ANY']], 1,
    {
      description: '서초구 반포동 가톨릭성모병원 소아암 병동 환아들에게 전해줄 유기농 면 촉감 인형을 한 땀 한 땀 바느질하여 만드는 따뜻한 손바느질 봉사입니다.',
      notice: '기본적인 홈질과 공그르기 바느질이 가능하신 분이면 좋습니다. 유기농 솜과 원단 패키지를 드립니다.'
    }],

  ['보육원 생일파티 준비', '기타', IMG.kids, '부산광역시 동래구', 'ENDED', 24, -3,
    [['준비 봉사', 'PERSON', 'R', 4, 8, '명', 'ANY']], 1,
    {
      description: '부산 동래구 보육원 아이들의 9월 생일파티를 위해 풍선 아트 장식, 꼬깔모자 제작, 케이크 촛불 세팅 및 깜짝 축하 무대를 준비한 행사 보조 봉사였습니다.',
      notice: '아이들에게 잊지 못할 생일 추억을 선물해 주실 분들이 함께했습니다.'
    }],

  // ── [42 ~ 101: 신규 60개 — 기능 검증 & 발표 시연을 위한 완벽 시나리오] ──

  // 1. DRAFT 4개 (모두 DEMO Host 소유)
  ['주말 한강 돗자리 정화 캠페인', '환경', null, null, 'DRAFT', 1, 10, [], 1,
    { owner: 'DEMO', draftLevel: 1 }],

  ['유기묘 쉼터 수제 간식 만들기', '동물', null, null, 'DRAFT', 2, 8, [], 1,
    { owner: 'DEMO', draftLevel: 2, description: '보호소 아이들을 위한 건강하고 안전한 수제 닭가슴살 져키와 동결건조 영양 간식을 정성껏 만들어 선물합니다.' }],

  ['종로 어르신 사랑의 배식 봉사', '노인', null, '서울특별시 종로구 창경궁로', 'DRAFT', 3, 7, [], 1,
    { owner: 'DEMO', draftLevel: 3, description: '종로 노인복지관에서 형편이 어려운 어르신들께 따뜻한 점심 한 끼를 정성스럽게 대접하고 주방 배식을 보조합니다.' }],

  ['초등학생 방과후 동화책 읽어주기', '아동·청소년', IMG.book, '서울특별시 마포구 마포대로', 'DRAFT', 4, 6,
    [['동화구연 도우미', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    { owner: 'DEMO', draftLevel: 4, description: '마포 다문화 및 저소득층 아이들에게 꿈과 상상력을 선물해줄 생생한 목소리 동화구연 봉사자를 모십니다.' }],

  // 2. ACTIVE 현재 활동 진행 중 (3개, 모두 DEMO Host 소유)
  ['살곶이 하천 EM 흙공 던지기', '환경', IMG.env, '서울특별시 성동구 살곶이길', 'ACTIVE', 3, 0,
    [['환경 봉사자', 'PERSON', 'M', 8, null, '명', 'ANY'], ['EM 흙공', 'GOODS', 'M', 50, null, '개', 'ANY']], 1,
    {
      owner: 'DEMO', isLive: true,
      description: '중랑천과 살곶이다리 일대의 수질 정화와 악취 제거를 위해 유용 미생물로 빚은 친환경 EM 흙공 50개를 던지는 활동입니다.',
      notice: '하천변 돌길이 미끄러우니 미끄럼 방지 장화나 운동화를 착용해 주세요.',
      comments: ['지금 하천 입구에 도착했습니다! 날씨가 딱 좋네요.', '장화 여분 챙겨왔습니다~', '흙공 던지기 다들 손맛이 좋으시네요 ㅎㅎ']
    }],

  ['보호소 유기견 따뜻한 목욕 봉사', '동물', IMG.dog, '서울특별시 강동구 천호대로', 'ACTIVE', 2, 0,
    [['목욕 봉사자', 'PERSON', 'R', 4, 6, '명', 'ANY']], 1,
    {
      owner: 'DEMO', isLive: true,
      description: '강동구 유기견 임시보호소에서 장기간 목욕을 하지 못한 대형견과 중형견 아이들의 털을 부드럽게 씻기고 말려주는 봉사입니다.',
      notice: '물이 많이 튀므로 방수 앞치마나 갈아입을 옷을 꼭 지참해 주세요. 대형 타월이 준비되어 있습니다.',
      comments: ['아이들이 물을 무서워하지 않고 얌전하네요 다행입니다.', '대형 타월 넉넉히 준비했습니다.', '드라이룸 소독도 함께 도와드릴게요!']
    }],

  ['신촌 골목길 보행 안전 반사경 닦기', '지역사회', IMG.community, '서울특별시 서대문구 신촌로', 'ACTIVE', 1, 0,
    [['청소 도우미', 'PERSON', 'M', 4, null, '명', 'ANY'], ['극세사 타월', 'GOODS', 'M', 20, null, '장', 'ANY']], 1,
    {
      owner: 'DEMO', isLive: true,
      description: '신촌 주택가 사각지대 골목길의 보행자 안전을 위해 뿌옇게 먼지 쌓인 도로 반사경 20곳을 투명하게 닦아냅니다.',
      notice: '사다리를 이용할 수 있으니 편한 바지와 운동화 착용을 부탁드립니다. 극세사 타월과 세정제가 제공됩니다.',
      comments: ['깨끗해진 반사경 보니까 골목길이 훨씬 안전해진 것 같아요!', '다음 골목으로 이동 중입니다~']
    }],

  // 3. ACTIVE Lazy Sync 테스트용 (2개)
  ['동네 빗물받이 낙엽 및 담배꽁초 청소', '환경', IMG.env, '서울특별시 송파구 백제고분로', 'ACTIVE', 1, 0,
    [['청소 도우미', 'PERSON', 'M', 6, null, '명', 'ANY']], 1,
    {
      isLazySync: true,
      description: '송파구 주택가 도로변 침수 예방을 위해 빗물받이에 쌓인 낙엽과 담배꽁초를 갈고리와 집게로 긁어모아 정화하는 활동입니다.',
      notice: '냄새와 오염이 있을 수 있으니 방수 코팅 장갑과 마스크를 착용해 주세요.',
      comments: ['빗물받이마다 담배꽁초가 정말 많았는데 수고 많으셨습니다.', '배수구 뚜껑 들어올리는 요령 덕분에 금방 끝났네요.']
    }],

  ['꿈나무 청소년 파이썬 코딩 멘토링', '교육', IMG.study, '서울특별시 금천구 가산디지털로', 'ACTIVE', 2, 0,
    [['코딩 멘토', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    {
      isLazySync: true,
      description: '가산디지털단지 청소년센터에서 IT 진로를 꿈꾸는 중고등학생들에게 파이썬 기초 문법과 알고리즘을 1:1로 멘토링합니다.',
      notice: '개인 노트북 지참을 권장하며, 실습 예제 코드는 사전에 공유해 드립니다.',
      comments: ['오늘 파이썬 기초 수업 끝까지 잘 따라와 주었습니다.', '질문이 많아서 시간 가는 줄 몰랐네요!']
    }],

  // 4. ACTIVE 미래 활동 예정 (DEMO Host 1개)
  ['어르신을 위한 스마트폰 기초 교실', '교육', IMG.senior_smartphone, '서울특별시 광진구 자양로', 'ACTIVE', 3, 5,
    [['강사 보조', 'PERSON', 'R', 3, 6, '명', 'ANY']], 1,
    {
      owner: 'DEMO',
      description: '광진구 구민회관에서 스마트폰 글씨 크기 키우기, 사진 전송, 버스 도착 앱 보기 등 일상에서 꼭 필요한 기능을 친절히 알려드립니다.',
      notice: '어르신 눈높이에서 천천히 설명해 주실 분 환영합니다!',
      comments: ['어르신들께 스마트폰 알려드리는 봉사 기대됩니다!', '강의 자료 미리 확인했습니다.']
    }],

  // 5. ACTIVE DEMO Crew 참여 시연용 (2개)
  ['우리 동네 가로수 화단 가꾸기', '환경', IMG.garden, '서울특별시 마포구 양화로', 'ACTIVE', 2, 4,
    [['화단 가꾸기', 'PERSON', 'M', 5, null, '명', 'ANY'], ['모종삽', 'GOODS', 'M', 10, null, '개', 'ANY']], 1,
    {
      demoCrew: 'BEFORE_ACTION',
      description: '마포구 양화로 가로수 주변에 방치된 쓰레기를 치우고 알록달록한 계절 꽃모종을 심어 작은 도심 화단을 가꿉니다.',
      notice: '모종삽과 원예 장갑이 준비되어 있습니다. 편한 신발을 신고 오세요.',
      comments: ['데모님 반가워요! 이번 주말에 뵙겠습니다.', '주말에 비 안 온다고 하니 딱 좋겠어요.']
    }],

  ['도심 야생조류 모이통 설치', '동물', IMG.animal, '서울특별시 성북구 성북로', 'ACTIVE', 4, 8,
    [['설치 도우미', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      demoCrew: 'LEFT',
      description: '성북동 숲길 인근에 도시 겨울철 먹이가 부족한 박새와 참새들을 위한 친환경 나무 모이통을 제작하여 설치합니다.',
      notice: '목공 장갑과 방한복을 챙겨주세요.',
      comments: ['산새들 모이 주는 좋은 활동이네요.', '개인 사정으로 아쉽게 취소하지만 응원합니다!']
    }],

  // 6. ACTIVE 모집 마감 + 활동 예정 (5개)
  ['독거 어르신 주거환경 도배 봉사', '노인', IMG.senior_wallpaper, '서울특별시 영등포구 도신로', 'ACTIVE', 5, 4,
    [['도배 도우미', 'PERSON', 'R', 4, 6, '명', 'MALE']], 5,
    {
      description: '영등포구 노후 다세대 주택에 거주하시는 독거 어르신 댁의 곰팡이 핀 벽지를 뜯어내고 친환경 도배지로 교체해 드립니다.',
      notice: '남성 참여자 전용 항목입니다. 도배 풀이 묻을 수 있으니 작업복을 입고 오세요.',
      comments: ['모집 마감되었네요. 주말에 안전하게 도배 마무리해요!']
    }],

  ['시각장애인 마라톤 동반 주자', '장애', IMG.guide_runner, '서울특별시 송파구 올림픽로', 'ACTIVE', 6, 5,
    [['가이드 러너', 'PERSON', 'R', 3, 5, '명', 'ANY']], 6,
    {
      description: '올림픽공원 평화의 광장에서 시각장애인 러너의 눈이 되어 고무 끈을 잡고 함께 페이스를 맞추어 5km를 달리는 가이드 러너 봉사입니다.',
      notice: '러닝화와 운동복 착용 필수입니다. 출발 전 20분간 동반 주행 수칙 교육이 진행됩니다.',
      comments: ['코스 숙지하고 가겠습니다. 호흡 잘 맞춰봐요!']
    }],

  ['발달장애 청소년 숲길 걷기 동행', '장애', IMG.garden, '경기도 과천시 대공원광장로', 'ACTIVE', 4, 3,
    [['동행 봉사자', 'PERSON', 'M', 6, null, '명', 'ANY']], 4,
    {
      description: '과천 서울대공원 둘레길을 발달장애 청소년들과 1:1로 짝을 지어 걸으며 자연을 만끽하고 말벗이 되어주는 나들이 동행 활동입니다.',
      notice: '편한 트레킹화와 겉옷, 개인 식수를 준비해 주세요.',
      comments: ['편한 운동화 신고 가겠습니다! 날씨가 좋으면 좋겠네요.']
    }],

  ['지역 아동센터 방과후 수학 지도', '아동·청소년', IMG.kids, '서울특별시 양천구 목동서로', 'ACTIVE', 7, 5,
    [['수학 선생님', 'PERSON', 'R', 2, 4, '명', 'ANY']], 6,
    {
      description: '양천구 목동 지역아동센터에서 수학에 흥미를 잃은 초등학교 고학년 학생들에게 연산과 기본 원리를 재미있게 가르쳐줄 멘토를 모십니다.',
      notice: '교재와 필기구가 센터에 비치되어 있습니다.',
      comments: ['교재 미리 훑어보고 갈게요!']
    }],

  ['다문화 가정 요리 교실 보조', '교육', IMG.food, '인천광역시 남동구 남동대로', 'ACTIVE', 5, 3,
    [['요리 보조', 'PERSON', 'R', 3, 5, '명', 'FEMALE'], ['앞치마', 'GOODS', 'M', 15, null, '개', 'ANY']], 4,
    {
      description: '인천 남동구 다문화센터에서 한국 전통 가정식(잡채, 불고기) 요리 강습 중 다문화 이주민들의 칼질과 조리 과정을 옆에서 다정하게 돕습니다.',
      notice: '여성 크루 전용 항목입니다. 앞치마와 머리수건을 챙겨와 주세요.',
      comments: ['한국 전통 요리 함께 재미있게 배워봐요~']
    }],

  // 7. ACTIVE 일반 모집 중 (16개)
  ['주말 이틀간의 청소년 연극 캠프', '아동·청소년', IMG.kids, '서울특별시 종로구 대학로', 'ACTIVE', 3, 7,
    [['1일차 연기 지도', 'PERSON', 'R', 2, 4, '명', 'ANY'], ['2일차 무대 진행', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    {
      description: '대학로 소극장에서 청소년들과 주말 이틀 동안 대본 리딩, 발성 연습, 무대 동선 맞추기를 함께하며 소통의 무대를 만듭니다.',
      notice: '편한 트레이닝복 차림으로 오시면 좋습니다.',
      comments: ['이틀 동안 멋진 추억 만들어봐요!']
    }],

  ['이틀간 펼쳐지는 동네 플리마켓 지원', '지역사회', IMG.community, '부산광역시 수영구 광안해변로', 'ACTIVE', 2, 6,
    [['1일차 부스 운영', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['2일차 정리 정돈', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      description: '광안리 해변로에서 지역 소상공인과 청년 창작자들을 지원하는 친환경 플리마켓 부스 설치와 안내를 돕습니다.',
      notice: '행사장 안내 및 질서 유지를 함께 진행합니다.'
    }],

  ['어르신 말벗 및 네일아트 봉사', '노인', IMG.senior_nail_art, '서울특별시 강서구 강서로', 'ACTIVE', 3, 8,
    [['네일아트 봉사', 'PERSON', 'R', 2, 4, '명', 'FEMALE']], 1,
    {
      description: '강서구 경로당 어르신들께 예쁜 매니큐어를 발라드리고 손 마사지를 해드리며 소녀 시절 이야기로 꽃을 피웁니다.',
      notice: '여성 봉사자 전용 항목입니다. 네일 도구와 핸드크림이 준비되어 있습니다.'
    }],

  ['사랑의 가구 제작 및 배달', '지역사회', IMG.community, '경기도 안산시 단원구', 'ACTIVE', 4, 9,
    [['가구 운반 및 제작', 'PERSON', 'R', 4, 8, '명', 'MALE']], 1,
    {
      description: '안산시 저소득 다문화 가정 아이들을 위해 친환경 원목 책상과 서랍장을 조립·도색하여 집까지 안전하게 배달합니다.',
      notice: '무거운 원목 가구를 나르므로 안전화나 튼튼한 운동화를 착용해 주세요.'
    }],

  ['유기견 사료 후원 및 견사 청소', '동물', IMG.dog, '경기도 양평군 양평읍', 'ACTIVE', 2, 6,
    [['견사 청소', 'PERSON', 'M', 5, null, '명', 'ANY'], ['대형견 사료', 'GOODS', 'M', 40, null, '포', 'ANY']], 1,
    {
      description: '양평 유기견 보호소에서 대형견 견사를 고압 물청소하고 사료 40포대를 하차하여 창고에 적재합니다.',
      notice: '장화와 방수복이 구비되어 있습니다. 오염되어도 괜찮은 옷을 입고 오세요.'
    }],

  ['도심 속 미세먼지 저감 쌈지숲 조성', '환경', IMG.tree, '서울특별시 강남구 강남대로', 'ACTIVE', 5, 10,
    [['식재 봉사자', 'PERSON', 'M', 10, null, '명', 'ANY'], ['원예용 흙', 'GOODS', 'M', 30, null, '포', 'ANY']], 1,
    {
      description: '강남대로 빌딩 숲 자투리 공간에 공기 정화 능력이 뛰어난 회양목과 산철쭉을 심어 작은 녹지 쉼터를 조성합니다.',
      notice: '모종삽과 장갑은 현장에서 지급해 드립니다.'
    }],

  ['청소년 금융 기초 상식 멘토링', '교육', IMG.book, '서울특별시 서초구 서초대로', 'ACTIVE', 4, 11,
    [['금융 멘토', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    {
      description: '서초구 청소년 문화센터에서 용돈 관리법, 신용카드와 저축의 원리, 똑똑한 금융 소비 습관을 특강으로 전달합니다.',
      notice: '강의 PPT 템플릿과 워크시트가 제공됩니다.'
    }],

  ['장애인 볼링 동아리 활동 보조', '장애', IMG.bowling, '대전광역시 서구 둔산로', 'ACTIVE', 3, 8,
    [['투구 보조', 'PERSON', 'R', 3, 6, '명', 'ANY']], 1,
    {
      description: '대전 둔산동 볼링장에서 지체장애인 동호회 분들의 볼링공 선택과 투구 레인 이동, 스코어 기록을 즐겁게 보조합니다.',
      notice: '볼링화 대여료는 센터에서 지원합니다.'
    }],

  ['소외계층을 위한 따뜻한 제빵 나눔', '지역사회', IMG.cooking, '대구광역시 중구 달구벌대로', 'ACTIVE', 2, 5,
    [['제빵 봉사', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['밀가루', 'GOODS', 'M', 50, null, 'kg', 'ANY']], 1,
    {
      description: '대구 적십자 나눔터에서 단팥빵과 카스텔라 200개를 직접 반죽하고 오븐에 구워 당일 복지관에 배달합니다.',
      notice: '위생모와 제빵 앞치마를 착용하고 진행합니다.'
    }],

  ['외국인 유학생 한국어 대화 친구', '교육', IMG.edu, '서울특별시 동대문구 이문로', 'ACTIVE', 1, 9,
    [['대화 친구', 'PERSON', 'M', 5, null, '명', 'ANY']], 1,
    {
      description: '동대문구 대학가 인근에서 외국인 교환학생들과 카페에 모여 한국의 대학 문화와 일상 줄임말, 생활 회화를 나눕니다.',
      notice: '음료 1잔이 기본 제공됩니다.'
    }],

  ['도심 길고양이 급식소 순찰 및 관리', '동물', IMG.cat, '서울특별시 관악구 신림로', 'ACTIVE', 6, 12,
    [['급식소 관리', 'PERSON', 'M', 4, null, '명', 'ANY'], ['캔 간식', 'GOODS', 'M', 60, null, '캔', 'ANY']], 1,
    {
      description: '관악구 주택가 골목길의 지정 길고양이 급식소 6곳을 돌며 밥그릇을 세척하고 신선한 사료와 캔 간식을 채웁니다.',
      notice: '소독 스프레이와 청소 타월을 지급합니다.'
    }],

  ['하천 생태계 교란식물 제거 활동', '환경', IMG.env, '경기도 성남시 분당구 탄천로', 'ACTIVE', 3, 7,
    [['제거 봉사자', 'PERSON', 'M', 8, null, '명', 'ANY'], ['작업 장갑', 'GOODS', 'M', 30, null, '켤레', 'ANY']], 1,
    {
      description: '성남 분당구 탄천 습지 일대에서 토종 식물을 위협하는 가시박과 단풍잎돼지풀 군락을 뿌리째 뽑아냅니다.',
      notice: '가시가 억세므로 긴팔, 긴바지와 두꺼운 작업 장갑 착용 필수입니다.'
    }],

  ['보육원 아이들과 함께하는 보드게임', '아동·청소년', IMG.kids, '부산광역시 동구 중앙대로', 'ACTIVE', 4, 8,
    [['놀이 멘토', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      description: '부산 중앙동 보육원 아이들과 주말 오후 루미큐브, 할리갈리, 인생게임을 하며 신나게 웃고 교감하는 멘토링입니다.',
      notice: '아이들과 눈높이를 맞추고 공감해 주실 분이면 충분합니다.'
    }],

  ['시니어 디지털 키오스크 실습 지도', '노인', IMG.senior_kiosk, '광주광역시 북구 첨단과기로', 'ACTIVE', 2, 7,
    [['실습 지도자', 'PERSON', 'M', 4, null, '명', 'ANY']], 1,
    {
      description: '광주 북구 평생교육관에서 패스트푸드점, 병원, 무인 발급기 키오스크 화면을 가상 태블릿으로 연습시켜 드립니다.',
      notice: '친절하게 하나씩 천천히 알려주실 분을 기다립니다.'
    }],

  ['청각장애인을 위한 자막 제작 재능기부', '장애', IMG.book, '서울특별시 구로구 경인로', 'ACTIVE', 5, 13,
    [['자막 제작자', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      description: '구로구 장애인 미디어센터에서 청각장애인용 유튜브 교육 영상에 한글 자막 싱크를 맞추고 텍스트를 입력합니다.',
      notice: '영상 편집 툴이 익숙하지 않아도 텍스트 자막 입력 교육을 제공합니다.'
    }],

  ['어린이 교통안전 옐로카펫 정비', '기타', IMG.kids, '경기도 수원시 영통구 광교중앙로', 'ACTIVE', 6, 14,
    [['정비 도우미', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['반사스티커', 'GOODS', 'M', 100, null, '장', 'ANY']], 1,
    {
      description: '수원 광교초등학교 앞 스쿨존 횡단보도 옐로카펫의 낡은 노란색 반사 스티커를 떼어내고 새 야광 테이프를 부착합니다.',
      notice: '안전 조끼와 스크래퍼 도구가 현장에서 지급됩니다.'
    }],

  // 8. ENDED 6개 (조기 종료 3개 + 정상 종료 3개)
  ['북한산 둘레길 정비 및 숲 가꾸기', '환경', IMG.tree, '서울특별시 강북구 삼양로', 'ENDED', 12, -4,
    [['정리 봉사자', 'PERSON', 'R', 4, 8, '명', 'ANY']], 1,
    {
      owner: 'DEMO',
      earlyEndReason: '갑작스러운 호우주의보 발령으로 안전을 위해 일찍 마무리했습니다.',
      description: '북한산 삼양동 둘레길 구간의 낙석 위험 요소를 치우고 등산로 주변 쓰레기를 정화하는 숲 가꾸기 봉사였습니다.',
      comments: ['안전이 최우선이죠! 비가 너무 많이 와서 고생 많으셨습니다.', '다음 맑은 날에 꼭 다시 모여요!']
    }],

  ['벽화 골목길 보수 및 페인트 칠', '지역사회', IMG.mural, '인천광역시 중구 신포로', 'ENDED', 15, -6,
    [['페인트 도우미', 'PERSON', 'R', 3, 6, '명', 'ANY'], ['방수 페인트', 'GOODS', 'M', 10, null, '통', 'ANY']], 1,
    {
      earlyEndReason: '도료 공급 문제 및 기온 급강하로 작업을 일찍 마쳤습니다.',
      description: '인천 신포동 벽화 골목의 들뜬 페인트를 긁어내고 방수 하도 작업을 진행하는 골목 재생 봉사였습니다.',
      comments: ['바람이 불어 페인트가 잘 안 말랐네요. 조기 종료 잘 결정하셨습니다.']
    }],

  ['해안가 정화 플로깅 캠페인', '환경', IMG.beach, '강원특별자치도 강릉시 창해로', 'ENDED', 14, -5,
    [['플로깅 봉사', 'PERSON', 'M', 10, null, '명', 'ANY']], 1,
    {
      earlyEndReason: '강풍주의보 발령에 따라 현장 안전관리관의 권고로 조기 종료되었습니다.',
      description: '강릉 안목해변 솔밭부터 창해로를 따라 강풍에 날려온 해변 쓰레기를 수거하는 환경 정화 활동이었습니다.',
      comments: ['바람이 거세져서 다칠 뻔했는데 일찍 마무리해서 다행입니다.']
    }],

  ['양재 매헌 숲 어린이 체험 놀이 보조', '아동·청소년', IMG.kids, '서울특별시 서초구 매헌로', 'ENDED', 16, -3,
    [['놀이 보조', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      owner: 'DEMO', earlyEndReason: null,
      description: '서초구 매헌시민의숲에서 유치원생 아이들의 솔방울 보물찾기와 나뭇잎 탁본 놀이 안전을 보살핀 숲 체험이었습니다.',
      comments: ['아이들이 숲에서 너무 신나게 놀았어요. 결과 기대됩니다!', '인솔 선생님들도 정말 감사하다고 전하셨어요.']
    }],

  ['장애인 복지관 나들이 동행 봉사', '장애', IMG.wheelchair, '서울특별시 노원구 한글비석로', 'ENDED', 18, -4,
    [['나들이 보조', 'PERSON', 'M', 5, null, '명', 'ANY']], 1,
    {
      demoCrew: 'AFTER_ACTION', earlyEndReason: null,
      description: '노원구 불암산 나비정원에서 복지관 이용 장애인분들의 휠체어를 밀어드리며 초가을 꽃향기를 즐긴 힐링 나들이였습니다.',
      comments: ['어르신 휠체어 밀어드리며 기분 좋은 산책이었습니다.', '소감 얼른 작성할게요!']
    }],

  ['시니어 기억지킴 치매예방 교실', '노인', IMG.senior_boardgame, '경기도 부천시 소사구', 'ENDED', 20, -5,
    [['교구 도우미', 'PERSON', 'R', 2, 4, '명', 'ANY'], ['인지놀이 퍼즐', 'GOODS', 'M', 20, null, '세트', 'ANY']], 1,
    {
      earlyEndReason: null,
      description: '부천 소사구 경로당에서 치매 고위험군 어르신들과 나무 퍼즐 맞추기와 종이접기를 진행한 인지 자극 교실이었습니다.',
      comments: ['퍼즐 맞추시면서 활짝 웃으시는 모습이 기억에 남네요.']
    }],

  // 9. COMPLETED 16개
  ['종로 독거 어르신 사랑의 도시락 나눔', '노인', IMG.senior_lunchbox, '서울특별시 종로구 율곡로', 'COMPLETED', 28, -18,
    [['조리 및 포장', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['보온 도시락통', 'GOODS', 'M', 50, null, '개', 'ANY']], 1,
    {
      owner: 'DEMO',
      description: '종로구 관내 거동이 불편하신 홀몸 어르신 50가구에 정성 가득한 영양 도시락을 조리하여 직접 전달한 나눔이었습니다.',
      ownerVoice: '추운 날씨에도 묵묵히 도시락을 포장하고 전해주신 크루 여러분께 깊은 감사를 드립니다. 어르신들의 밝은 미소가 최고의 선물이었습니다.',
      resultContent: '정성 가득 담은 영양 도시락 50세트를 관내 독거 어르신들께 직접 전달해 드렸습니다. 혼자 계신 어르신들의 안부를 묻고 따뜻한 온기를 나눈 뜻깊은 시간이었습니다.',
      crewVoices: [
        '어르신께서 손을 꼭 잡아주시며 고맙다고 하실 때 눈물이 핑 돌았습니다.',
        '함께 땀 흘려 도시락을 만들고 배달하니 마음이 너무 훈훈해졌어요.',
        '호스트님의 친절한 인솔 덕분에 첫 봉사였는데도 안전하고 즐겁게 마쳤습니다.'
      ],
      comments: ['도시락 반찬 구성이 정말 알차서 어르신들이 참 좋아하셨어요.', '다음 나눔 때도 꼭 불러주세요!']
    }],

  ['발달장애 아동 미술 치료 보조', '장애', IMG.art_therapy, '서울특별시 마포구 월드컵북로', 'COMPLETED', 32, -20,
    [['미술 보조', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['스케치북과 크레파스', 'GOODS', 'M', 30, null, '세트', 'ANY']], 1,
    {
      demoCrew: 'ACTUALLY_PARTICIPATED',
      description: '마포구 장애아동 복지관에서 발달장애 아동 15명과 함께 물감과 크레파스를 이용한 협동화를 그리며 감정 표현을 도왔습니다.',
      demoCrewVoice: '아이들이 마음껏 색칠하며 웃는 모습을 보며 제가 더 큰 위로를 받았습니다. 뜻깊은 활동에 참여할 수 있어 영광이었습니다.',
      ownerVoice: '아이들의 창의력을 맘껏 펼칠 수 있게 다정하게 도와주신 크루분들 덕분에 전시회까지 성공적으로 열 수 있었습니다.',
      resultContent: '아동 15명과 함께 물감과 크레파스를 이용한 자유 협동화 그리기 활동을 성공적으로 마쳤습니다.',
      comments: ['아이들의 그림 솜씨가 대단해서 깜짝 놀랐습니다!', '준비해주신 다과도 맛있게 잘 먹었습니다.']
    }],

  ['영도 노후 주거지 희망 도색 나눔', '지역사회', IMG.mural, '부산광역시 영도구 절영로', 'COMPLETED', 35, -24,
    [['페인트칠 봉사', 'PERSON', 'R', 5, 8, '명', 'ANY']], 1,
    {
      owner: 'DEMO',
      isShortfall: true,
      description: '부산 영도구 절영로 일대의 비탈진 노후 주택 외벽을 밝은 파스텔톤 방수 페인트로 깨끗하게 단장해 드린 봉사였습니다.',
      ownerVoice: '모집 정원에는 다소 미치지 못했지만, 함께해 주신 크루분들 모두가 2인분 몫을 톡톡히 해내며 서로를 격려해 준 덕분에 훌륭하게 완공할 수 있었습니다.',
      resultContent: '예상 인원보다 적은 인원이었지만 한마음으로 뭉쳐 노후 주택 2채의 외벽 도색을 깔끔하게 완성했습니다.',
      comments: ['다들 열정적으로 임해주셔서 힘든 줄도 모르고 칠했네요 ㅎㅎ', '전후 사진 비교해보니 정말 뿌듯합니다!']
    }],

  ['용인 유기묘 보호소 대청소 및 소독', '동물', IMG.cat, '경기도 용인시 처인구', 'COMPLETED', 40, -28,
    [['청소 도우미', 'PERSON', 'R', 6, 10, '명', 'ANY']], 1,
    {
      isShortfall: true,
      description: '용인 유기묘 보호소 묘사 3개 동의 모래를 전면 교체하고 친환경 피톤치드 소독수로 캣타워와 바닥을 청결하게 소독했습니다.',
      ownerVoice: '모집 인원이 다소 부족했음에도 불구하고 한 분 한 분이 내 일처럼 정성껏 2인분 몫을 톡톡히 해주셔서 보호소 묘사를 완벽히 소독할 수 있었습니다.',
      resultContent: '참가자분들의 놀라운 헌신 덕분에 묘사 3개 동 청소와 모래 갈이를 정해진 시간 내에 깔끔하게 끝냈습니다.',
      comments: ['고양이들이 깨끗해진 방에서 편히 쉬는 걸 보니 너무 좋습니다.', '다들 고생 많으셨어요!']
    }],

  ['남양주 유기견 보호소 방한 비닐막 설치', '동물', IMG.dog, '경기도 남양주시 화도읍', 'COMPLETED', 42, -30,
    [['비닐막 설치', 'PERSON', 'M', 6, null, '명', 'ANY'], ['보온 비닐', 'GOODS', 'M', 20, null, '롤', 'ANY']], 1,
    {
      demoCrew: 'AFTER_ACTION',
      description: '남양주 야외 견사에 칼바람을 차단하기 위해 외곽 철조망을 따라 두꺼운 방풍 비닐막 20롤을 꼼꼼하게 시공했습니다.',
      ownerVoice: '견사에 칼바람이 불지 않도록 튼튼하게 막아주셔서 아이들이 올겨울 따뜻하게 보낼 수 있게 되었습니다.',
      resultContent: '보호소 견사 외곽에 방풍 비닐막 20롤을 모두 설치 완료하였습니다.',
      comments: ['바람 하나 안 들어오게 꼼꼼히 막아서 마음이 놓이네요.']
    }],

  ['안양천 줍깅 및 수질 정화 활동', '환경', IMG.river, '경기도 안양시 만안구', 'COMPLETED', 34, -22,
    [['플로깅 봉사', 'PERSON', 'M', 12, null, '명', 'ANY']], 1,
    {
      description: '안양천 산책로와 둔치 3km 구간을 걸으며 버려진 캔과 비닐 120kg을 수거하고 분리배출을 완료했습니다.',
      ownerVoice: '안양천 일대를 돌며 100kg이 넘는 쓰레기를 수거했습니다. 깨끗해진 하천길을 보니 가슴이 뻥 뚫리네요.',
      resultContent: '산책로 및 둔치 3km 구간에서 총 120kg 분량의 폐기물을 분리수거하여 처리했습니다.',
      comments: ['날씨는 쌀쌀했지만 땀 흘리며 걸으니 상쾌했습니다!']
    }],

  ['폐플라스틱 병뚜껑 업사이클링 키링 제작', '환경', IMG.recycle, '서울특별시 종로구 대학로', 'COMPLETED', 38, -26,
    [['제작 보조', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['플라스틱 병뚜껑', 'GOODS', 'M', 500, null, '개', 'ANY']], 1,
    {
      demoCrew: 'ACTUALLY_PARTICIPATED',
      demoCrewVoice: '재활용의 소중함을 직접 깨닫고 예쁜 키링까지 완성할 수 있어 보람찼습니다.',
      description: '버려지는 플라스틱 병뚜껑 800개를 세척·사출하여 환경 메시지가 담긴 예쁜 업사이클링 키링 150개를 제작했습니다.',
      ownerVoice: '버려지는 플라스틱이 예쁜 키링으로 재탄생하는 과정을 함께해주신 분들께 감사드립니다.',
      resultContent: '수거된 병뚜껑 800여 개를 분류·세척 후 업사이클링 키링 150개를 제작하여 환경 캠페인용으로 기부했습니다.',
      comments: ['색 조합이 너무 예쁘게 나왔어요. 아이들에게 선물하니 인기 폭발이었습니다.']
    }],

  ['전통시장 장바구니 나눔 캠페인', '지역사회', IMG.community, '서울특별시 동대문구 경동시장로', 'COMPLETED', 45, -32,
    [['나눔 부스 운영', 'PERSON', 'R', 3, 5, '명', 'ANY'], ['에코백 장바구니', 'GOODS', 'M', 200, null, '개', 'ANY']], 1,
    {
      description: '경동시장 방문객과 상인들에게 비닐봉지 대신 다회용 에코백 장바구니 200개를 나누어드리고 자원 절약 서명을 받았습니다.',
      ownerVoice: '비닐봉지 대신 다회용 장바구니를 권유하며 시장 상인분들과 따뜻한 교감을 나눈 시간이었습니다.',
      resultContent: '경동시장 방문객 및 상인분들께 에코백 장바구니 200개를 전량 배포하고 일회용품 줄이기 서명을 받았습니다.',
      comments: ['상인 어르신들이 정말 좋은 취지라고 칭찬 많이 해주셨어요!']
    }],

  ['사랑의 연탄 나눔 봉사', '지역사회', IMG.briquette, '서울특별시 성북구 정릉로', 'COMPLETED', 48, -35,
    [['연탄 배달', 'PERSON', 'M', 15, null, '명', 'ANY'], ['연탄', 'GOODS', 'M', 1000, null, '장', 'ANY']], 1,
    {
      owner: 'DEMO',
      description: '정릉 골목길 고지대 난방 취약계층 5가구에 지게와 손수레를 이용해 연탄 1,000장을 창고에 차곡차곡 쌓아드렸습니다.',
      ownerVoice: '언덕길을 오르내리며 옷에 까만 탄가루가 묻어도 웃음을 잃지 않으셨던 모든 크루분들 최고입니다.',
      resultContent: '많은 크루분들이 동참해 주신 덕분에 당초 목표를 넘어 총 1,200장의 연탄을 고지대 취약계층 가구에 릴레이로 안전하게 적재해 드렸습니다.',
      comments: ['연탄 지게 메고 올라갈 땐 힘들었지만 창고 꽉 찬 거 보고 뭉클했습니다.']
    }],

  ['지역 아동센터 크리스마스 선물 포장', '아동·청소년', IMG.kids, '인천광역시 미추홀구 인하로', 'COMPLETED', 52, -40,
    [['포장 도우미', 'PERSON', 'R', 5, 8, '명', 'ANY'], ['학용품 세트', 'GOODS', 'M', 100, null, '개', 'ANY']], 1,
    {
      description: '기부받은 공책, 색연필, 필통 등 학용품을 정성스레 선물 상자에 포장하고 응원 손편지를 동봉하여 아동센터 3곳에 전달했습니다.',
      ownerVoice: '산타클로스가 된 마음으로 리본 하나까지 정성껏 묶어주신 크루님들 덕분에 아이들이 행복한 크리스마스를 보냈습니다.',
      resultContent: '기부받은 학용품과 간식을 100세트의 선물 상자로 예쁘게 포장하여 3개 아동센터에 전달했습니다.',
      comments: ['선물 뜯어보고 환호할 아이들 생각에 손이 절로 빨라졌어요!']
    }],

  ['청소년 진로 멘토링 특강', '아동·청소년', IMG.kids, '경기도 수원시 팔달구 매산로', 'COMPLETED', 36, -25,
    [['직무 멘토', 'PERSON', 'R', 4, 6, '명', 'ANY']], 1,
    {
      description: 'IT, 디자인, 미디어 분야 멘토 4명이 수원 지역 중고생 40명과 함께 직무 소개 및 현실적인 진로 Q&A를 진행했습니다.',
      ownerVoice: '생생한 현업 이야기를 초롱초롱한 눈망울로 경청해준 학생들과 열정적인 멘토님들 모두에게 감사합니다.',
      resultContent: 'IT, 디자인, 마케팅 분야 멘토 4명이 참여하여 중고등학생 40명을 대상으로 진로 Q&A 및 멘토링을 진행했습니다.',
      comments: ['아이들의 날카로운 질문에 오히려 제가 더 많은 자극을 받았습니다.']
    }],

  ['시니어 보드게임 인지발달 교실', '노인', IMG.senior_boardgame, '대전광역시 유성구 온천로', 'COMPLETED', 41, -29,
    [['게임 보조', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      description: '유성구 경로당 어르신 20여 명과 함께 기억력과 소근육 발달에 좋은 루미큐브, 젠가 게임을 즐겁게 진행했습니다.',
      ownerVoice: '루미큐브와 젠가를 하시며 어린아이처럼 환하게 웃으시던 어르신들의 모습이 오래도록 기억에 남습니다.',
      resultContent: '경로당 어르신 20여 명과 함께 인지 기능 향상을 위한 쉬운 보드게임 4종을 진행했습니다.',
      comments: ['어르신들 승부욕이 대단하셔서 정말 흥미진진했습니다 ㅎㅎ']
    }],

  ['시각장애인 오디오북 녹음 봉사', '장애', IMG.book, '서울특별시 종로구 삼청로', 'COMPLETED', 44, -31,
    [['낭독 봉사자', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    {
      description: '점자도서관 녹음 스튜디오에서 시각장애인 분들을 위해 한국 단편문학 소설 3편을 정확한 발음과 감정으로 낭독 녹음했습니다.',
      ownerVoice: '목소리로 세상의 빛을 전하는 녹음 작업에 맑고 고운 목소리로 정성을 다해주셔서 완성도 높은 오디오북이 탄생했습니다.',
      resultContent: '단편 소설 3편의 전체 낭독 녹음 및 1차 음원 편집을 성공적으로 완료하여 점자도서관에 납품했습니다.',
      comments: ['호흡 조절이 생각보다 까다로웠지만 엔지니어님이 잘 지도해주셨어요.']
    }],

  ['다문화 어린이 기초 한국어 동화 구연', '교육', IMG.book, '경기도 안산시 상록구 광덕로', 'COMPLETED', 46, -33,
    [['동화구연', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      demoCrew: 'ACTUALLY_PARTICIPATED',
      demoCrewVoice: '인원은 적었지만 아이들과 1:1로 손을 맞잡고 동화를 읽어줄 수 있어서 더 깊이 교감할 수 있었습니다.',
      description: '안산 다문화센터에서 한국어가 서툰 다문화 어린이 12명과 전래동화를 손인형극으로 들려주고 단어 카드 게임을 진행했습니다.',
      ownerVoice: '한국어 표현이 낯선 다문화 가정 아이들이 눈높이 율동과 동화를 통해 자연스럽게 한글과 친해진 시간이었습니다.',
      resultContent: '예상 인원보다 적은 2명의 크루가 참여했지만, 아이들과 1:1로 더 깊이 교감하며 전래동화 구연과 단어 카드 맞추기 놀이를 따뜻하게 마쳤습니다.',
      comments: ['처음엔 부끄러워하던 아이들이 끝날 땐 품에 안겨 안 놔주더라고요 ㅠㅠ']
    }],

  ['은퇴 시니어를 위한 유튜브 영상 편집 기초', '교육', IMG.senior_smartphone, '서울특별시 양천구 신목로', 'COMPLETED', 50, -38,
    [['실습 멘토', 'PERSON', 'R', 3, 6, '명', 'ANY']], 1,
    {
      description: '양천구 복지관에서 은퇴 시니어 15분을 대상으로 스마트폰 숏폼 영상 자막 넣기와 컷 편집을 1:1로 지도해 드렸습니다.',
      ownerVoice: '새로운 기술에 도전하시는 시니어분들의 배움에 대한 열정에 크루 모두가 큰 감동을 받았습니다.',
      resultContent: '스마트폰 앱을 활용한 1분 숏폼 영상 자막 넣기 및 컷 편집 실습을 완료하여 전원 나만의 브이로그를 제작했습니다.',
      comments: ['어르신들이 완성된 영상을 가족 단톡방에 올리고 자랑스러워하셨어요!']
    }],

  ['신생아 살리기 털모자 뜨기 캠페인', '기타', IMG.kids, '서울특별시 마포구 월드컵북로', 'COMPLETED', 55, -42,
    [['뜨개질 봉사', 'PERSON', 'M', 8, null, '명', 'ANY'], ['뜨개실', 'GOODS', 'M', 50, null, '볼', 'ANY']], 1,
    {
      description: '저체온증으로 생명이 위태로운 개발도상국 신생아들을 위해 친환경 털실로 정성 어린 아기 모자 60개를 손뜨개로 완성했습니다.',
      ownerVoice: '한 땀 한 땀 정성을 엮어 저체온증으로 고통받는 개발도상국 신생아들에게 생명의 온기를 전했습니다.',
      resultContent: '크루들이 직접 뜬 손뜨개 모자 60개와 후원 뜨개실 전량을 세척 후 구호단체에 전달 완료했습니다.',
      comments: ['코 빠뜨려서 몇 번 풀기도 했지만 완성하고 나니 감개무량합니다.']
    }],

  // 10. CANCELLED 5개
  ['노량진 청소년 주말 야외 농구 교실', '아동·청소년', IMG.kids, '서울특별시 동작구 노량진로', 'CANCELLED', 10, 5,
    [['멘토', 'PERSON', 'R', 2, 4, '명', 'ANY']], 1,
    {
      owner: 'DEMO',
      description: '노량진 야외 농구코트에서 주말 청소년들을 대상으로 드리블과 슛 기초 자세를 코칭하는 스포츠 멘토링 활동이었습니다.',
      cancelReason: '행사 당일 우천 예보 및 대체 체육관 대관 취소로 인해 부득이 진행이 어렵게 되었습니다.'
    }],

  ['주말 북한산 생태 보전 쓰레기 줍기', '환경', IMG.env, '서울특별시 은평구 대서문길', 'CANCELLED', 12, 6,
    [['등산 플로깅', 'PERSON', 'M', 10, null, '명', 'ANY']], 1,
    {
      description: '북한산 등산로 주변 버려진 페트병과 비닐을 주우며 생태계를 보호하는 등산 플로깅 활동이었습니다.',
      cancelReason: '건조 특보에 따른 산불 조심 기간 입산 통제 행정명령으로 인하여 행사가 취소되었습니다.'
    }],

  ['유기견 보호소 야외 견사 바닥 방수 작업', '동물', IMG.dog, '경기도 파주시 광탄면', 'CANCELLED', 15, 8,
    [['방수 시공 보조', 'PERSON', 'R', 4, 6, '명', 'ANY'], ['방수 도료', 'GOODS', 'M', 10, null, '통', 'ANY']], 1,
    {
      description: '파주 유기견 보호소 야외 견사의 시멘트 바닥 균열을 보수하고 친환경 방수 도료를 칠하는 시설 개선 봉사였습니다.',
      cancelReason: '시공 자재 수급 지연 및 기상 악화(한파)로 인하여 부득이 취소되었습니다.'
    }],

  ['어르신 야외 봄꽃 나들이 동행', '노인', IMG.wheelchair, '서울특별시 영등포구 여의서로', 'CANCELLED', 8, 4,
    [['휠체어 동행', 'PERSON', 'M', 8, null, '명', 'ANY']], 1,
    {
      description: '여의도 윤중로 봄꽃길을 어르신들과 함께 산책하며 꽃구경과 기념사진을 촬영해 드리는 나들이 행사였습니다.',
      cancelReason: '극심한 미세먼지(황사) 비상저감조치 발령으로 어르신 호흡기 건강 보호를 위해 취소되었습니다.'
    }],

  ['골목길 가로등 조도 개선 실태 조사', '지역사회', IMG.community, '부산광역시 서구 암남공원로', 'CANCELLED', 9, 7,
    [['야간 조사원', 'PERSON', 'R', 3, 5, '명', 'ANY']], 1,
    {
      description: '부산 암남동 주택가 어두운 골목길의 보행 안전을 위해 가로등 위치와 조도를 측정하고 점검하는 실태 조사 활동이었습니다.',
      cancelReason: '관할 구청의 가로등 스마트 보안등 전면 교체 공사 일정이 확정되어 자체 민간 조사를 취소합니다.'
    }],
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

  console.log(`정리 완료 — 기존 시드 액션 ${acts?.length ?? 0}개 · 계정 ${ids.length}개 삭제`);
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
        categories: u.categories,
        skills: u.skills,
        available_times: i % 2 === 0 ? ['주말', '오후'] : ['평일', '저녁'],
        time_prefs:
          i % 2 === 0
            ? [{ day: '주말', slots: ['오후'] }]
            : [{ day: '평일', slots: ['저녁'] }],
        regions: ['서울특별시 성동구', '서울특별시 마포구', '서울특별시 종로구'].slice(
          0,
          (i % 3) + 1,
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
      skills: ['교육·멘토링'],
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

    let owner;
    if (meta?.owner === 'DEMO') {
      owner = demoUser;
    } else {
      const matchingUsers = users.filter((u) => u.categories.includes(category));
      if (matchingUsers.length > 0) {
        owner = matchingUsers[idx % matchingUsers.length];
      } else {
        owner = users[idx % users.length];
      }
    }
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

    const desc = isDraft && meta?.draftLevel === 1
      ? null
      : (meta?.description ?? `${title}. 처음이신 분도 담당자가 함께 안내해드리니 편하게 참여하세요.`);

    const { imageUrls, thumbnailIndex } = getActionImages(image, category, idx);
    const noticeText = isDraft && meta?.draftLevel <= 2
      ? null
      : (meta?.notice ?? '편한 옷차림으로 와주세요. 물과 간식은 준비되어 있습니다.');

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
        thumbnail_index: thumbnailIndex,
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
      const pre = PRECOMPUTED_META[title];
      if (pre) {
        await admin.from('action_ai_metadata').upsert(
          {
            action_id: action.id,
            categories: pre.categories,
            activity_types: pre.activity_types,
            target_groups: pre.target_groups,
            participation_modes: pre.participation_modes,
            skills: pre.skills,
            keywords: pre.keywords,
            difficulty: pre.difficulty,
            ai_model: 'gpt-4o-mini',
            prompt_version: 'classify-v3',
            owner_confirmed: true,
          },
          { onConflict: 'action_id' },
        );
      } else {
        await admin.from('action_ai_metadata').upsert(
          {
            action_id: action.id,
            categories: [category],
            activity_types: ['실내 활동'],
            target_groups:
              category === '교육' || category === '아동·청소년'
                ? ['교류·교육·소통형']
                : ['육체·과업·집중형'],
            participation_modes: ['10명 이내 소그룹'],
            skills: [],
            keywords: title.split(' ').slice(0, 3),
            difficulty: '누구나 참여가능',
            ai_model: 'seed',
            prompt_version: 'classify-v3',
            owner_confirmed: true,
          },
          { onConflict: 'action_id' },
        );
      }
    }

    if (isDraft) continue;

    const joinedCrews = [];
    const isPast = whenDay < 0 || meta?.isLazySync;
    const wroteResult = status === 'COMPLETED';

    // DEMO 계정 크루 참여 시나리오
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

    // 일반 참여자 시드
    if (status === 'COMPLETED') {
      // COMPLETED 액션: 초과 달성, 정상 충족, 미달 완료 상태가 골고루 분포되도록 시드 수량 산출
      const getTargetCount = (it) => {
        if (meta?.itemTargets && meta.itemTargets[it.name] !== undefined) {
          return meta.itemTargets[it.name];
        }
        // 1. 미달 완료 액션 (~3개)
        if (idx === 35) return 5; // 학습지 정리: 5명 (목표 6명 미달)
        if (idx === 82) return 4; // 영도 도색: 4명 (목표 5~8명 미달)
        if (idx === 93) return 2; // 동화 구연: 2명 (목표 3~5명 미달)
        // 용인 유기묘: 5명 (목표 6~10명 미달).
        // 이 액션의 ownerVoice 가 「모집 인원이 다소 부족했음에도」 라서
        // 목표를 채우면 글과 숫자가 어긋납니다 (2026-09-22에 채웠습니다).
        if (idx === 83) return 5;

        // 2. 초과 달성 액션 (~7개)
        if (idx === 15) return 12; // 제설 봉사: 12명 (목표 10명 초과)
        if (idx === 18 && it.type === 'GOODS') return 250; // 도서 기부: 250권 (목표 200권 초과)
        if (idx === 38 && it.type === 'GOODS') return 180; // 바자회 기부물품: 180점 (목표 150점 초과)
        if (idx === 85) return 15; // 플로깅: 15명 (목표 12명 초과)
        if (idx === 86 && it.type === 'GOODS') return 800; // 병뚜껑: 800개 (목표 500개 초과)
        if (idx === 88 && it.type === 'PERSON') return 18; // 연탄 배달: 18명 (목표 15명 초과)
        if (idx === 88 && it.type === 'GOODS') return 1200; // 연탄: 1200장 (목표 1000장 초과)
        if (idx === 95 && it.type === 'PERSON') return 10; // 뜨개질: 10명 (목표 8명 초과)
        if (idx === 95 && it.type === 'GOODS') return 65; // 뜨개실: 65볼 (목표 50볼 초과)

        // 3. 정상 충족 액션 (나머지 16개)
        return it.min_required;
      };

      const itemTotals = new Map();
      const participatedUserIds = new Set(joinedCrews.map((u) => u.id));
      participatedUserIds.add(owner.id);

      // DEMO 유저가 이미 참여한 수량 집계
      if (meta?.demoCrew) {
        const okItems = createdItems.filter(
          (it) => it.gender_requirement === 'ANY' || it.gender_requirement === demoUser.gender,
        );
        if (okItems.length > 0) {
          const target = okItems[0];
          const qty = target.type === 'PERSON' ? 1 : 5;
          itemTotals.set(target.id, qty);
        }
      }

      // 1. PERSON 항목: 1인 1수량이므로 각 항목의 목표치만큼 서로 다른 크루 참여
      for (const it of createdItems.filter((i) => i.type === 'PERSON')) {
        const current = itemTotals.get(it.id) ?? 0;
        const target = getTargetCount(it);
        const needed = target - current;
        if (needed <= 0) continue;

        const availableUsers = users.filter(
          (u) =>
            !participatedUserIds.has(u.id) &&
            (it.gender_requirement === 'ANY' || it.gender_requirement === u.gender),
        );

        const preferred = availableUsers.filter((u) => u.categories.includes(category));
        const general = availableUsers.filter((u) => !u.categories.includes(category));
        const assigned = [...preferred, ...general].slice(0, needed);
        for (let j = 0; j < assigned.length; j++) {
          const joiner = assigned[j];
          participatedUserIds.add(joiner.id);

          const { data: part } = await admin
            .from('participations')
            .insert({ action_id: action.id, user_id: joiner.id, status: 'ACTUALLY_PARTICIPATED' })
            .select('id')
            .single();

          if (!part) continue;
          partCount++;
          joinedCrews.push(joiner);
          itemTotals.set(it.id, (itemTotals.get(it.id) ?? 0) + 1);

          await admin.from('participation_items').insert({
            participation_id: part.id,
            action_item_id: it.id,
            quantity: 1,
          });

          // 소감 작성 (최대 3개)
          if (j < 3) {
            const voiceContent = meta?.crewVoices?.[j] ?? pick(CREW_VOICES, idx + j);
            await admin.from('crew_voices').insert({
              action_id: action.id,
              user_id: joiner.id,
              content: voiceContent,
            });
            voiceCount++;
          }
        }
      }

      // 2. GOODS 항목: 2~5명의 참여자에게 목표 수량을 나누어 배정
      for (const it of createdItems.filter((i) => i.type === 'GOODS')) {
        const current = itemTotals.get(it.id) ?? 0;
        const target = getTargetCount(it);
        const needed = target - current;
        if (needed <= 0) continue;

        // 이미 참여한 크루 우선 배정, 부족하면 추가 유저 영입
        const potentialDonors = [...joinedCrews.filter((u) => u.id !== owner.id)];
        for (const u of users) {
          if (potentialDonors.length >= 4) break;
          if (u.id !== owner.id && !potentialDonors.some((d) => d.id === u.id)) {
            potentialDonors.push(u);
          }
        }

        const donors = potentialDonors.slice(0, Math.min(5, Math.max(2, potentialDonors.length)));
        const base = Math.floor(needed / donors.length);
        const rem = needed % donors.length;

        for (let dIdx = 0; dIdx < donors.length; dIdx++) {
          const donor = donors[dIdx];
          const addQty = base + (dIdx < rem ? 1 : 0);
          if (addQty <= 0) continue;

          let partId;
          const { data: existingPart } = await admin
            .from('participations')
            .select('id')
            .eq('action_id', action.id)
            .eq('user_id', donor.id)
            .maybeSingle();

          if (existingPart) {
            partId = existingPart.id;
          } else {
            const { data: newPart } = await admin
              .from('participations')
              .insert({ action_id: action.id, user_id: donor.id, status: 'ACTUALLY_PARTICIPATED' })
              .select('id')
              .single();
            if (!newPart) continue;
            partId = newPart.id;
            partCount++;
            joinedCrews.push(donor);
            participatedUserIds.add(donor.id);
          }

          await admin.from('participation_items').insert({
            participation_id: partId,
            action_item_id: it.id,
            quantity: addQty,
          });
          itemTotals.set(it.id, (itemTotals.get(it.id) ?? 0) + addQty);
        }
      }
    } else if (status !== 'CANCELLED') {
      const joinerCount = Math.min(2 + (idx % 4), users.length - 1);

      const eligibleUsers = users.filter((u) => u.id !== owner.id && u.id !== demoUser.id);
      const preferred = eligibleUsers.filter((u) => u.categories.includes(category));
      const general = eligibleUsers.filter((u) => !u.categories.includes(category));
      const candidates = [...preferred, ...general];

      for (let j = 1; j <= joinerCount; j++) {
        const joiner = candidates[(idx + j - 1) % candidates.length];
        if (!joiner || joiner.id === owner.id || joiner.id === demoUser.id) continue;

        const okItems = createdItems.filter(
          (it) => it.gender_requirement === 'ANY' || it.gender_requirement === joiner.gender,
        );
        if (okItems.length === 0) continue;

        let pStatus = 'BEFORE_ACTION';
        if (isPast) {
          pStatus = 'AFTER_ACTION';
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

    // 채팅 댓글
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

    // 활동 결과
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

    // 좋아요 & 저장
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
  console.log('                 101개 시드 데이터 생성 결과 요약');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`• 전체 Action 수 : ${actionCount}개 (ACTIONS 정의: ${ACTIONS.length}개)`);
  console.log(`• 상태별 Action 수:`);
  console.log(`   - DRAFT     : ${statusCounts.DRAFT ?? 0}개 (레벨 1~4 단계별 초안)`);
  console.log(`   - ACTIVE    : ${statusCounts.ACTIVE ?? 0}개 (실시간 ${liveCount}개, 동기화 ${lazySyncCount}개 포함)`);
  console.log(`   - ENDED     : ${statusCounts.ENDED ?? 0}개 (정상 ${statusCounts.ENDED - earlyEndCount}개, 조기종료 ${earlyEndCount}개)`);
  console.log(`   - COMPLETED : ${statusCounts.COMPLETED ?? 0}개 (인원미달 극복 2개 포함 전원 결과보고서 보유)`);
  console.log(`   - CANCELLED : ${statusCounts.CANCELLED ?? 0}개 (구체적 취소사유 구비)`);
  console.log(`• DEMO 계정 : ${demoEmail} (비밀번호: ${PASSWORD})`);
  console.log(`• DEMO Host Action (${demoHostActions.length}개):`);
  for (const a of demoHostActions) {
    console.log(`   - [${a.status}] ${a.title}`);
  }
  console.log(`• DEMO Crew Action (${demoCrewActions.length}개):`);
  for (const a of demoCrewActions) {
    console.log(`   - [${a.partStatus}] ${a.title}`);
  }
  console.log(`• 실시간 진행 중 Action : ${liveCount}개`);
  console.log(`• Lazy Sync 테스트 Action : ${lazySyncCount}개`);
  console.log(`• 조기 종료 Action : ${earlyEndCount}개`);
  console.log(`• 총 참여 건수 : ${partCount}건 · 소감(Crew Voice): ${voiceCount}건 · 댓글(채팅): ${chatCount}건`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

await clean();
if (!CLEAN_ONLY) {
  console.log('');
  await seed();
}
