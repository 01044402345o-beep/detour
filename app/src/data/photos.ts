/**
 * 사진 기록 (DESIGN.md 5장, T6.0). 사진 정보는 이 파일 한 곳에 둡니다.
 * public/photos/CREDITS.txt는 이 파일에서 만듭니다(data/photoCredits.ts, photos.test.ts가 동기화 검사).
 * 사진 라이선스(CC BY-SA)는 사진 파일에만 적용되고 앱 코드 라이선스와는 별개입니다.
 * 얼굴을 흐리게 바꾼 사진도 원본과 같은 CC BY-SA 조건으로 공유합니다.
 *
 * 확인(2026-11-26): 원본 파일 페이지를 Wikimedia Commons API(imageinfo extmetadata + 위키 원문)로 다시 확인.
 *  - 저작자·라이선스·라이선스 URL은 API 값과 같음. 6장 모두 personality rights·trademark 등 별도 주의 틀 없음,
 *    Restrictions 필드 빈 값. notice는 원본 EXIF Copyright 값을 그대로 옮김(coordinator가 API로 확인).
 *  - 권리 점검(인물·간판/로고): 1차에서 성심당·으능정이·유성 족욕장을 "불확실하면 제외"로 뺐다가,
 *    사용자 결정(2026-11-26)으로 식별 가능한 얼굴을 흐리게 처리한 판으로 사용. 각 항목 review에 기록.
 *
 * 사진이 없는 장소·권역은 글자 타일(파랑 바탕 + 흰 한글 2~3자)로 표시합니다. 다른 곳 사진으로 대신하지 않습니다.
 */
import type { L10n } from '../types';

/** 홈 3권역 (types.ts HubId + 준비 중인 유성) */
export type AreaId = 'downtown' | 'station' | 'yuseong';

export type PhotoLicenseId = 'CC BY-SA 2.5' | 'CC BY-SA 4.0';

export const LICENSE_URLS: Record<PhotoLicenseId, string> = {
  'CC BY-SA 2.5': 'https://creativecommons.org/licenses/by-sa/2.5/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

export type Photo = {
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
  /** 원본 파일 페이지 */
  sourceUrl: string;
  licenseId: PhotoLicenseId;
  licenseUrl: string;
  /** 원본에 있는 고지 (EXIF Copyright 값 그대로) */
  notice?: string;
  /** 실제로 한 변경만 */
  changes: string;
  /** 권리 점검 결과 (별도 제한 표시·인물·간판/로고) */
  review: string;
  /** 대체 글 (장소 이름 + 장면) */
  alt: L10n;
};

const RESIZED =
  'Downloaded the 1280px-wide Wikimedia Commons thumbnail, resized to 1200px on the long side and converted to WebP. No crop, no color correction.';

const blurred = (areas: number) =>
  `Downloaded the 1280px-wide Wikimedia Commons thumbnail; faces of identifiable people blurred (soft elliptical Gaussian blur, ${areas} areas); resized to 1200px on the long side; converted to WebP. No crop, no color correction; signage unchanged.`;

const SOURCE_OK =
  'Source page: no personality-rights or trademark templates; Restrictions field empty.';
const USER_DECISION =
  'User decision 2026-11-26: use after blurring faces; shop signs are shown in context with the app’s non-affiliation notice.';

export const PHOTOS: readonly Photo[] = [
  {
    id: 'sungsimdang',
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
  {
    id: 'chungnam-office',
    file: 'photos/chungnam-office.webp',
    placeId: 'mus',
    title: 'South Chungcheong Provincial Office',
    author: 'Yoo Chung',
    year: 2007,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:South_Chungcheong_Provincial_Office.jpg',
    licenseId: 'CC BY-SA 2.5',
    licenseUrl: LICENSE_URLS['CC BY-SA 2.5'],
    notice: 'Copyright 2007 by Yoo Chul Chung. Licensed under CC-BY-SA-2.5',
    changes: RESIZED,
    review: `${SOURCE_OK} No people. Building front with small banners only; no logo as subject.`,
    alt: {
      en: 'Former South Chungcheong Provincial Office, now the Daejeon Modern History Exhibition Hall, seen across the road',
      ja: '旧忠清南道庁(現・大田近現代史展示館)の建物を道路の向こうから見た様子',
      zh: '从马路对面看到的旧忠清南道厅（现大田近现代史展览馆）建筑',
    },
  },
  {
    id: 'daejeon-station',
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
];

/** 장소 id → 사진 (없으면 undefined = 글자 타일) */
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
