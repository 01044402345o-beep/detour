/**
 * 인트로 영상·정지 그림 (T6.16). 파일은 app/public/intro/ (원본·만든 과정: 저장소 밖 intro-film/, Lemo-Opuscar Tabletop App Flythrough).
 * - 영상 13.2초 = 장면 3개 × 4.4초(① 코스 0–4.4 ② 주문 4.4–8.8 ③ 직원 8.8–13.2), 무음, 글자 없음.
 * - 오프라인: 서비스 워커 사전 캐시에 들어 있습니다(vite.config.ts globPatterns에 mp4).
 *   iOS Safari는 서비스 워커가 돌려준 영상(Range 요청 미지원 응답)을 직접 재생하지 못하는 경우가 있어,
 *   영상을 통째로 받아 blob URL로 재생합니다(캐시된 응답을 그대로 읽으므로 오프라인에서도 동작).
 */
export const INTRO_SEG_S = 4.4;
export const INTRO_SCENES = 3;
export const INTRO_VIDEO = 'intro/intro.mp4';
export const INTRO_STILLS = ['intro/scene-1.webp', 'intro/scene-2.webp', 'intro/scene-3.webp'] as const;

/** 영상 시간 → 장면 번호 */
const INTRO_TOTAL_S = Math.round(INTRO_SEG_S * INTRO_SCENES * 1000) / 1000; // 13.2 (부동소수 오차 없이)
export const sceneAt = (s: number) =>
  Math.min(INTRO_SCENES - 1, Math.floor((s % INTRO_TOTAL_S) / INTRO_SEG_S + 1e-6));

/** 재생 위치 확인 간격(ms): timeupdate보다 촘촘하게 장면 경계를 맞춤 */
export const INTRO_POLL_MS = 100;

export const introUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** 영상을 받아 blob URL로. 실패하면 null(정지 그림으로 대체) */
export async function loadIntroVideo(): Promise<string | null> {
  try {
    if (typeof fetch !== 'function' || typeof URL.createObjectURL !== 'function') return null;
    const res = await fetch(introUrl(INTRO_VIDEO));
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    return URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'video/mp4' }));
  } catch {
    return null;
  }
}

export function releaseIntroVideo(url: string | null): void {
  if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
}
