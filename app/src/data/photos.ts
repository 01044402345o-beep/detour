/**
 * 사진 기록 (DESIGN.md 5장, T6.0 · T6.9). 사진 정보는 이 파일 한 곳에 둡니다.
 * public/photos/CREDITS.txt는 이 파일에서 만듭니다(data/photoCredits.ts, photos.test.ts가 동기화 검사).
 * 사진 라이선스(CC BY·CC BY-SA)는 사진 파일에만 적용되고 앱 코드 라이선스와는 별개입니다.
 * BY-SA 사진은 바꾼 판(리사이즈·변환·얼굴 흐림)도 원본과 같은 BY-SA 조건으로 공유합니다.
 *
 * 확인(2026-11-26): 원본 파일 페이지를 Wikimedia Commons API(imageinfo extmetadata + 위키 원문)로 다시 확인.
 *  - 저작자·라이선스·라이선스 URL은 API 값과 같음. 모든 사진에 personality rights·trademark 등 별도 주의 틀 없음,
 *    Restrictions 필드 빈 값. notice는 원본 EXIF Copyright 값을 그대로 옮김(coordinator가 API로 확인).
 *  - 권리 점검(인물·간판/로고): 1차에서 성심당·으능정이·유성 족욕장을 "불확실하면 제외"로 뺐다가,
 *    사용자 결정(2026-11-26)으로 식별 가능한 얼굴을 흐리게 처리한 판으로 사용. 각 항목 review에 기록.
 *
 * 종류(kind, T6.9):
 *  - 'place': 그 장소·권역을 찍은 사진.
 *  - 'dish-example': 그 가게 대표 음식과 같은 종류의 **일반 음식 사진**(그 가게에서 찍은 사진 아님).
 *    사용자 요청(2026-11-26, 사진 없는 곳은 SNS 사진으로)을 SNS 사진 저작권 문제로 대체한 것.
 *    사진 위·출처 줄·설정 사진 출처 시트·CREDITS에서 "음식 예시 사진(이 가게 사진 아님)"으로 구분합니다.
 *    2026-11-26 확인: 3장 모두 EXIF Copyright/Credit 고지 없음(notice 없음), 사람·간판 없음.
 *    후보 5장 중 블로그 출처 2장(두부두루치기·고추튀김)은 허락 근거 미확인으로 제외(R1 H-01, 아래 PHOTOS 주석).
 *
 * 사진이 없는 장소·권역은 글자 타일(파랑 바탕 + 흰 한글 2~3자)로 표시합니다
 * (현재 광천식당 gwc·수연분식 sy). 다른 장소의 사진으로 대신하지 않습니다.
 */
import type { L10n } from '../types';

/** 홈 3권역 (types.ts HubId + 준비 중인 유성) */
export type AreaId = 'downtown' | 'station' | 'yuseong';

export type PhotoLicenseId =
  | 'CC BY 2.0'
  | 'CC BY 2.0 KR'
  | 'CC BY-SA 2.0'
  | 'CC BY-SA 2.0 KR'
  | 'CC BY-SA 2.5'
  | 'CC BY-SA 4.0';

/** 라이선스 원문 링크. BY(저작자 표시)와 BY-SA(저작자 표시-동일조건 변경허락)는 다른 라이선스입니다. */
export const LICENSE_URLS: Record<PhotoLicenseId, string> = {
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC BY 2.0 KR': 'https://creativecommons.org/licenses/by/2.0/kr/',
  'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
  'CC BY-SA 2.0 KR': 'https://creativecommons.org/licenses/by-sa/2.0/kr/',
  'CC BY-SA 2.5': 'https://creativecommons.org/licenses/by-sa/2.5/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

/** 'place' = 그 장소를 찍은 사진, 'dish-example' = 대표 음식의 일반 예시 사진(그 가게 사진 아님) */
export type PhotoKind = 'place' | 'dish-example';

type PhotoBase = {
  id: string;
  /** BASE_URL 기준 경로 (photoUrl()로 완성) */
  file: string;
  /** 장소 id (downtown.json·market.json places, 또는 코스 출발지 'djs') */
  placeId?: string;
  /** 홈 권역 id */
  areaId?: AreaId;
  /** 원본 작품(파일) 제목 */
  title: string;
  /** 저작자 표기 (원본 페이지 Author) */
  author: string;
  /** 촬영 연도 — 원본 날짜가 확실할 때만 */
  year?: number;
  /** 원본에 있는 고지 (EXIF Copyright 값 그대로) */
  notice?: string;
  /** 실제로 한 변경만 */
  changes: string;
  /** 권리 점검 결과 (별도 제한 표시·인물·간판/로고) */
  review: string;
  /** 대체 글 (장소 이름 + 장면) */
  alt: L10n;
};

/**
 * 운영자 직접 촬영 사진(T6.10)의 이용 조건 표기. CC 라이선스가 아니며(앱 사용 허락), 라이선스 원문 링크·원본 파일 페이지가 없습니다.
 * 화면에는 이 값 대신 번역 키(`photo.creditOwn`·`photo.ownAuthor`·`photo.ownLicense`)로 표시합니다.
 */
export const OWN_PHOTO_LICENSE =
  'Owner photo — used with permission (not a Creative Commons license)';

/** 출처 갈래: 위키미디어 공용 CC 사진(라이선스 링크·원본 페이지 있음) / 운영자 직접 촬영(링크 없음) */
type PhotoSource =
  | {
      /** 원본 파일 페이지 */
      sourceUrl: string;
      licenseId: PhotoLicenseId;
      licenseUrl: string;
    }
  | {
      sourceUrl?: undefined;
      licenseId: typeof OWN_PHOTO_LICENSE;
      licenseUrl?: undefined;
    };

export type Photo = PhotoBase &
  PhotoSource &
  (
    | { kind: 'place' }
    | {
        kind: 'dish-example';
        /** 사진 속 대표 음식 이름 (그 가게 메뉴 이름과 같게) */
        dish: L10n;
      }
  );

const RESIZED =
  'Downloaded the 1280px-wide Wikimedia Commons thumbnail, resized to 1200px on the long side and converted to WebP. No crop, no color correction.';

const blurred = (areas: number) =>
  `Downloaded the 1280px-wide Wikimedia Commons thumbnail; faces of identifiable people blurred (soft elliptical Gaussian blur, ${areas} areas); resized to 1200px on the long side; converted to WebP. No crop, no color correction; signage unchanged.`;

/** 원본 파일을 크기 그대로 WebP로 바꾼 경우 (원본이 1200px보다 작음) */
const converted = (w: number, h: number) =>
  `Downloaded the original file (${w}×${h}px) from Wikimedia Commons and converted it to WebP at the same size. No resize, no crop, no color correction.`;

const SOURCE_OK =
  'Source page: no personality-rights or trademark templates; Restrictions field empty.';
const DISH_SOURCE_OK =
  'Source page: no personality-rights or trademark templates; Restrictions field empty; no EXIF copyright or credit notice.';
const dishNote = (shop: string) =>
  `No people; no shop signs or logos. A general photo of the dish, not taken at ${shop} and unrelated to it. Why: the user asked (2026-11-26) for SNS photos of the shops without a photo; SNS photos cannot be republished in the public repository and app, so a freely licensed Wikimedia Commons photo of the shop’s signature dish is used instead and labeled on screen as an example photo, not this shop.`;
/** 운영자 직접 촬영 사진(T6.10)의 저작자 표기 — 개인 이름 없이 */
export const OWN_AUTHOR = 'Edulleo 운영자 (직접 촬영)';
const OWN_CONFIRMED =
  'Own photo: the user confirmed on 2026-11-26 that they took this photo themselves and allow its use in the app (not a Creative Commons license; no external source page).';
const OWN_SIGNS =
  'The shop’s sign is the subject; shown in context with the app’s non-affiliation notice (place screen).';
const USER_DECISION =
  'User decision 2026-11-26: use after blurring faces; shop signs are shown in context with the app’s non-affiliation notice.';

export const PHOTOS: readonly Photo[] = [
  {
    id: 'sungsimdang',
    kind: 'place',
    file: 'photos/sungsimdang.webp',
    placeId: 'ssd',
    title: 'Sungsimdang 2019',
    author: 'Trainholic',
    year: 2019,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sungsimdang_2019.jpg',
    licenseId: 'CC BY-SA 4.0',
    licenseUrl: LICENSE_URLS['CC BY-SA 4.0'],
    notice: "trainholic's travel",
    changes: blurred(14),
    review: `${SOURCE_OK} Shop front with the bakery’s sign and logo as the subject; customers visible in the doorway and upstairs windows (first check: excluded as uncertain). ${USER_DECISION}`,
    alt: {
      en: 'Sungsimdang main store at night, with its lit sign above the entrance',
      ja: '夜の聖心堂 本店。入口の上に明かりのついた看板',
      zh: '夜晚的圣心堂总店，入口上方是亮着灯的招牌',
    },
  },
  {
    id: 'euneungjeongi',
    kind: 'place',
    file: 'photos/euneungjeongi.webp',
    placeId: 'eun',
    areaId: 'downtown',
    title: 'Eunhaeng-dong Cultural Street',
    author: 'Minseong Kim',
    year: 2014,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Eunhaeng-dong_Cultural_Street.jpg',
    licenseId: 'CC BY-SA 4.0',
    licenseUrl: LICENSE_URLS['CC BY-SA 4.0'],
    notice: 'CC-BY-SA 4.0',
    changes: blurred(18),
    review: `${SOURCE_OK} Street scene under the Skyroad canopy; pedestrians large in the foreground (a student in school uniform), many shop brand signs incidental (first check: excluded as uncertain). ${USER_DECISION}`,
    alt: {
      en: 'Euneungjeongi Culture Street in the evening, people walking under the Skyroad canopy',
      ja: '夕方のウヌンジョンイ文化の街。スカイロードの屋根の下を歩く人々',
      zh: '傍晚的银杏亭文化街，人们在空中走廊顶棚下行走',
    },
  },
  // T6.12 (사용자 요청 2026-11-26): 위키미디어 'South_Chungcheong_Provincial_Office.jpg'(Yoo Chung, CC BY-SA 2.5)를
  // 운영자 직접 촬영 사진으로 교체. 중간에 받은 '대전광역시 중구' 로고 사진은 공공누리 근거를 확인하지 못해 쓰지 않음.
  {
    id: 'own-daejeon-modern-history-hall',
    kind: 'place',
    file: 'photos/daejeon-modern-history-hall.webp',
    placeId: 'mus',
    title: 'Daejeon Modern History Exhibition Hall front (own photo)',
    author: OWN_AUTHOR,
    // 촬영 연도: 근거 기록이 없어 적지 않음 (확실한 값만, T6.10 R1 L-01)
    licenseId: OWN_PHOTO_LICENSE,
    changes:
      'Own photo: visitors’ faces were already blurred by the owner before submission (no further blurring needed); converted to WebP at the original 800×600. No crop, no color correction; signage unchanged.',
    review: `${OWN_CONFIRMED} Front of the former South Chungcheong Provincial Office building with the hall’s own name sign. About six visitors are small in the frame and all faces are blurred. The museum’s own name signs are incidental.`,
    alt: {
      en: 'Front of the Daejeon Modern History Exhibition Hall, a 1930s brick building with an entrance porch and its name sign',
      ja: '大田近現代史展示館の正面。玄関ポーチのある1930年代のれんが造りの建物と館名の看板',
      zh: '大田近现代史展览馆正面，带门廊的1930年代砖砌建筑和馆名标牌',
    },
  },
  {
    id: 'daejeon-station',
    kind: 'place',
    file: 'photos/daejeon-station.webp',
    placeId: 'djs',
    title: 'Daejeon Station',
    author: 'Minseong Kim',
    year: 2014,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Daejeon_Station.jpg',
    licenseId: 'CC BY-SA 4.0',
    licenseUrl: LICENSE_URLS['CC BY-SA 4.0'],
    notice: 'CC-BY-SA 4.0',
    changes: RESIZED,
    review: `${SOURCE_OK} People only small and distant on the plaza. Station name sign is part of the building, not a logo shot.`,
    alt: {
      en: 'Daejeon Station building and plaza with the twin railway towers behind',
      ja: '大田駅の駅舎と駅前広場、後ろに2棟の高層ビル',
      zh: '大田站站房和站前广场，后方是两座高楼',
    },
  },
  {
    id: 'jungang-market',
    kind: 'place',
    file: 'photos/jungang-market.webp',
    areaId: 'station',
    title: 'Daejeon Jungang Market',
    author: 'Minseong Kim',
    year: 2014,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Daejeon_Jungang_Market.jpg',
    licenseId: 'CC BY-SA 4.0',
    licenseUrl: LICENSE_URLS['CC BY-SA 4.0'],
    notice: 'CC-BY-SA 4.0',
    changes: RESIZED,
    review: `${SOURCE_OK} People small, mostly from behind; the nearest vendor’s face is blurred in the original. Market gate name sign (public market) is the landmark, not a brand logo.`,
    alt: {
      en: 'Street leading to the gate of Daejeon Jungang Market with stalls on both sides',
      ja: '両側に露店が並ぶ、大田中央市場の入口へ続く通り',
      zh: '通往大田中央市场入口的街道，两旁摆着摊位',
    },
  },
  {
    id: 'yuseong-footbath',
    kind: 'place',
    file: 'photos/yuseong-footbath.webp',
    areaId: 'yuseong',
    title: 'Yuseong Foot Spa at Night',
    author: 'Pmlydon',
    year: 2021,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Yuseong_Foot_Spa_at_Night.jpg',
    licenseId: 'CC BY-SA 4.0',
    licenseUrl: LICENSE_URLS['CC BY-SA 4.0'],
    notice: 'CC-BY-SA P.M.Lydon',
    changes: blurred(8),
    review: `${SOURCE_OK} People (including children) using the public foot spa are the subject, at medium size; no signage as subject (first check: excluded as uncertain). ${USER_DECISION}`,
    alt: {
      en: 'Yuseong outdoor foot spa at night, people soaking their feet under autumn trees',
      ja: '夜の儒城の屋外足湯。紅葉の下で足を湯に浸す人々',
      zh: '夜晚的儒城户外足浴池，人们在秋树下泡脚',
    },
  },

  // ───── 운영자 직접 촬영 (T6.10) — 그 가게를 실제로 찍은 사진(kind 'place'), CC 라이선스 아님 ─────
  // 광천식당 사진은 아래 '음식 예시 사진' 구역 주석의 '블로그 출처 2장 제외'(T6.9 R1 H-01, 위키미디어
  // 공용에 올라온 제3자 블로그 음식 사진 = 허락 근거 미확인)와 **별개**입니다. 이번 사진은 사용자 본인이 찍은
  // 가게 정면 사진이고(사용자가 운영하는 블로그에 올린 본인 사진임을 사용자가 2026-11-26 확인), 앱에서 쓰도록 허락함.
  // 개인 이름은 기록하지 않습니다(저작자 = Edulleo 운영자).
  {
    id: 'own-gwangcheon-sikdang',
    kind: 'place',
    file: 'photos/gwangcheon-sikdang.webp',
    placeId: 'gwc',
    title: 'Gwangcheon Sikdang storefront (own photo)',
    author: OWN_AUTHOR,
    // 촬영 연도: 근거 기록이 없어 적지 않음 (확실한 값만, T6.10 R1 L-01)
    licenseId: OWN_PHOTO_LICENSE,
    changes:
      'Own photo: one passer-by at the far right edge blurred; resized to 800px on the long side (800×601) and converted to WebP. No crop, no color correction; signage unchanged.',
    review: `${OWN_CONFIRMED} The user also confirmed this is their own photo that they posted on the blog they run. One passer-by (far right edge) blurred; no other identifiable people. ${OWN_SIGNS} Window lettering also shows TV-channel names (KBS, MBC, SBS) and a TV show title as part of the shop’s own signage, incidental.`,
    alt: {
      en: 'Gwangcheon Sikdang storefront from below, with its large red sign and a tall vertical sign',
      ja: '下から見たクァンチョン食堂の店先。大きな赤い看板と縦長の看板',
      zh: '从下方看广川食堂的店面，有大大的红色招牌和竖长招牌',
    },
  },
  {
    id: 'own-suyeon-bunsik',
    kind: 'place',
    file: 'photos/suyeon-bunsik.webp',
    placeId: 'sy',
    title: 'Suyeon Bunsik sign (own photo)',
    author: OWN_AUTHOR,
    // 촬영 연도: 근거 기록이 없어 적지 않음 (확실한 값만, T6.10 R1 L-01)
    licenseId: OWN_PHOTO_LICENSE,
    changes:
      'Own photo: resized to 800px on the long side (800×601) and converted to WebP. No blur, no crop, no color correction.',
    review: `${OWN_CONFIRMED} No people. ${OWN_SIGNS} The sign includes the shop’s public phone number.`,
    alt: {
      en: 'Suyeon Bunsik’s orange and red shop signs under the market roof, with lamps below',
      ja: '市場の屋根の下にあるスヨン粉食のオレンジと赤の看板と、その下の照明',
      zh: '市场顶棚下Suyeon小吃店的橙色和红色招牌，下方亮着灯',
    },
  },

  // ───── 음식 예시 사진 (T6.9) — 그 가게에서 찍은 사진이 아님 ─────
  // 제외(T6.9 R1 H-01, 2026-11-26): 아래 2장은 블로그 출처이고, Commons에 라이선스 검토 기록이 없으며
  // 업로더가 저작자라는 근거도 확인되지 않아(원 게시물 접속 실패) '불확실하면 제외' 기준으로 뺐습니다.
  // public·CREDITS·사전 캐시에도 없음. 해당 장소(광천식당 gwc, 수연분식 sy)는 글자 타일.
  // 원 게시물의 자유 이용 허락이나 권리자의 명시적 허락을 확인·기록한 뒤에만 다시 넣습니다.
  //  - File:두부두루치기.jpg (이랑이랑, CC BY 2.0 KR 표시, 업로더 Gksyy 2023-10-01, 출처 네이버 eueuy/223055227139)
  //    https://commons.wikimedia.org/wiki/File:%EB%91%90%EB%B6%80%EB%91%90%EB%A3%A8%EC%B9%98%EA%B8%B0.jpg
  //  - File:Ojingeo-twigim and gochu-twigim 2.jpg ((Goodbye Seasoning) 굿바이 조미료, CC BY 2.0 KR 표시,
  //    업로더 Gidiyorum 2017-12-28, 출처 다음 white0192/3635941)
  //    https://commons.wikimedia.org/wiki/File:Ojingeo-twigim_and_gochu-twigim_2.jpg
  {
    id: 'dish-manduguk',
    kind: 'dish-example',
    file: 'photos/dish-manduguk.webp',
    placeId: 'gc',
    dish: { en: 'Dumpling Soup', ja: 'マンドゥスープ', zh: '饺子汤' },
    title: 'Korean.cuisine-Manduguk-01',
    author: 'avlxyz',
    year: 2007,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Korean.cuisine-Manduguk-01.jpg',
    licenseId: 'CC BY-SA 2.0',
    licenseUrl: LICENSE_URLS['CC BY-SA 2.0'],
    changes: RESIZED,
    review: `${DISH_SOURCE_OK} Author shown on the page as “by avlxyz” (Flickr user avlxyz). Commons Flickr review by Esrever (2007-12-14) confirmed CC BY-SA 2.0 on Flickr; the CC BY 2.0 first given at upload to Commons could not be confirmed as valid at that time. The Flickr page (checked 2026-11-26) also links to CC BY-SA 2.0. We use CC BY-SA 2.0 (ShareAlike). ${dishNote('Gaecheon Sikdang')}`,
    alt: {
      en: 'Example photo of dumpling soup (manduguk) with side dishes, not taken at Gaecheon Sikdang',
      ja: 'おかずを添えたマンドゥスープのイメージ写真(ケチョン食堂で撮影したものではありません)',
      zh: '配小菜的饺子汤示例照片（并非在Gaecheon食堂拍摄）',
    },
  },
  {
    id: 'dish-sundae-gukbap',
    kind: 'dish-example',
    file: 'photos/dish-sundae-gukbap.webp',
    placeId: 'sj',
    dish: { en: 'Sundae Soup with Rice', ja: 'スンデクッパ', zh: '米肠汤饭' },
    title: 'Korean soup-Sundae gukbap-01',
    author: 'pcamp',
    year: 2008,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Korean_soup-Sundae_gukbap-01.jpg',
    licenseId: 'CC BY 2.0',
    licenseUrl: LICENSE_URLS['CC BY 2.0'],
    changes: converted(1024, 768),
    review: `${DISH_SOURCE_OK} Originally posted to Flickr; Flickr upload bot license review (2008-06-20) confirmed CC BY 2.0. ${dishNote('Saengiljip')}`,
    alt: {
      en: 'Example photo of sundae gukbap in a hot pot with rice and kimchi, not taken at Saengiljip',
      ja: 'ご飯とキムチを添えた土鍋のスンデクッパのイメージ写真(センイルチプで撮影したものではありません)',
      zh: '配米饭和泡菜的砂锅米肠汤饭示例照片（并非在生日家拍摄）',
    },
  },
  {
    id: 'dish-gukhwappang',
    kind: 'dish-example',
    file: 'photos/dish-gukhwappang.webp',
    placeId: 'hg',
    dish: {
      en: 'Pulppang (mini red-bean cakes)',
      ja: 'プルッパン(あん入り小焼き菓子)',
      zh: '红豆小烤饼',
    },
    title: 'Gukhwappang',
    author: '국립국어원',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gukhwappang.jpg',
    licenseId: 'CC BY-SA 2.0 KR',
    licenseUrl: LICENSE_URLS['CC BY-SA 2.0 KR'],
    changes: RESIZED,
    review: `${DISH_SOURCE_OK} From the Basic Korean Dictionary media of the National Institute of Korean Language (국립국어원); license review on the page (2024-01-11) confirmed CC BY-SA 2.0 KR. The date is only “before 2015-12-21”, so no year. Gukhwappang (flower-shaped pulppang) is the same kind of red-bean cake. ${dishNote('Honggane Pulppang')}`,
    alt: {
      en: 'Example photo of flower-shaped red-bean cakes (gukhwappang) on a baking mold, not taken at Honggane Pulppang',
      ja: '焼き型に並ぶ花形のあん入り焼き菓子(菊花パン)のイメージ写真(ホンガネ プルッパンで撮影したものではありません)',
      zh: '烤模上的菊花形红豆小烤饼示例照片（并非在洪家小烤饼拍摄）',
    },
  },
];

/** 장소 id → 사진 (없으면 undefined = 글자 타일). kind 'dish-example'이면 그 가게 사진이 아님 */
export function photoForPlace(placeId: string): Photo | undefined {
  return PHOTOS.find((p) => p.placeId === placeId);
}

/** 권역 id → 사진 (없으면 undefined = 글자 타일) */
export function photoForArea(areaId: AreaId): Photo | undefined {
  return PHOTOS.find((p) => p.areaId === areaId);
}

/** 배포 경로(/edulleo/)를 붙인 사진 URL */
export function photoUrl(photo: Pick<Photo, 'file'>): string {
  return `${import.meta.env.BASE_URL}${photo.file}`;
}

/** 음식 예시 사진(그 가게에서 찍은 사진 아님)인지 */
export function isDishExample(photo: Pick<Photo, 'kind'>): boolean {
  return photo.kind === 'dish-example';
}

/** 운영자 직접 촬영 사진(CC 아님, 라이선스·원본 링크 없음, T6.10)인지 */
export function isOwnPhoto(photo: Pick<Photo, 'licenseId'>): boolean {
  return photo.licenseId === OWN_PHOTO_LICENSE;
}

/**
 * 짧은 출처 문구의 번역 키: 직접 촬영 `photo.creditOwn`("Photo: Edulleo team (own photo)", 자리표시자 없음) /
 * 음식 예시 `photo.creditDish` / 그 밖 `photo.credit`. `t(photoCreditKey(p), photoCreditParams(p))`
 */
export function photoCreditKey(
  photo: Pick<Photo, 'kind' | 'licenseId'>,
): 'photo.creditOwn' | 'photo.creditDish' | 'photo.credit' {
  if (isOwnPhoto(photo)) return 'photo.creditOwn';
  return isDishExample(photo) ? 'photo.creditDish' : 'photo.credit';
}

/**
 * 짧은 출처 자리표시자 값. 문구 틀은 번역 키 `photo.credit`("Photo: {author} · {license}")로:
 * `t('photo.credit', photoCreditParams(photo))`
 */
export function photoCreditParams(photo: Pick<Photo, 'author' | 'licenseId'>): {
  author: string;
  license: string;
} {
  return { author: photo.author, license: photo.licenseId };
}
