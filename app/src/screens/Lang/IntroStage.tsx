/**
 * 인트로 안내판의 그림 칸 (T6.16, 사용자 요청: 칸 232px, 영상, 탭 동기화, 오프라인).
 * - 영상이 재생 중이면 **영상 시간이 장면을 정합니다**(0–4.4 ① / 4.4–8.8 ② / 8.8–13.2 ③): onScene으로 알림,
 *   장면 안 진행률은 onProgress(0–1)로 알려 탭 진행 막대가 영상과 같이 움직입니다(R1 L-03).
 * - mode
 *   auto    : 반복 재생, 장면 경계를 지나면 onScene(i)
 *   segment : 사용자가 탭을 고름 → seekToken이 바뀔 때 그 장면 시작점으로 이동해 그 장면만 재생,
 *             끝에 닿으면(늦게 확인해 넘어갔더라도) 그 장면 끝 시점으로 되돌려 멈춤(R1 M-03)
 *   paused  : 그 자리에서 멈춤
 * - 영상이 처음 쓸 수 있게 되면 지금 장면(정지 그림 + 타이머로 넘어온 장면, 일시정지 상태 포함)의 시작점으로 맞춤(R1 M-04).
 * - 영상을 못 쓰면(불러오기 실패·미디어 오류·재생 거부) 장면별 정지 그림을 보여 주고 onVideo(false).
 *   일시정지·새 재생 요청 때문에 이전 play()가 취소되는 것(AbortError)은 실패로 보지 않음(R1 M-02).
 * - 움직임 줄이기 설정이 바뀌면 부모가 key로 이 부품을 새로 만듭니다(불러오기 세대가 섞이지 않게, R1 M-01).
 * - 그림 칸은 장식(aria-hidden): 내용은 아래 설명 문장(3개 언어)이 전달합니다.
 */
import { useEffect, useRef, useState } from 'react';
import {
  INTRO_POLL_MS,
  INTRO_SEG_S,
  INTRO_STILLS,
  introUrl,
  loadIntroVideo,
  releaseIntroVideo,
  sceneAt,
} from './introMedia';

export type IntroMode = 'auto' | 'segment' | 'paused';

type Props = {
  scene: number;
  mode: IntroMode;
  /** 움직임 줄이기: 영상 없이 정지 그림만 */
  reduce: boolean;
  /** 사용자가 탭을 고를 때마다 바뀌는 값(그때 그 장면 시작점으로 이동) */
  seekToken: number;
  onScene: (i: number) => void;
  onVideo: (ok: boolean) => void;
  /** 지금 장면 안 진행률(0–1), 영상 재생 중에만 */
  onProgress?: (p: number) => void;
};

/** 장면 끝에서 멈출 때 쓰는 시점(다음 장면 첫 모습이 보이지 않게 살짝 앞) */
const segEnd = (i: number) => (i + 1) * INTRO_SEG_S - 0.12;
const segStart = (i: number) => i * INTRO_SEG_S + 0.01;
/** 진짜 재생 실패로 보는 오류(사용자 정지·새 요청으로 인한 취소는 제외) */
const isRealFailure = (e: unknown) =>
  !(typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError');

export function IntroStage({ scene, mode, reduce, seekToken, onScene, onVideo, onProgress }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const sceneRef = useRef(scene);
  const cb = useRef({ onScene, onVideo, onProgress });
  useEffect(() => {
    sceneRef.current = scene;
    cb.current = { onScene, onVideo, onProgress };
  });

  // 영상 불러오기(움직임 줄이기면 불러오지 않음). 이 부품이 사라지면 blob URL 정리, 늦게 온 결과는 버림
  useEffect(() => {
    if (reduce) return;
    let alive = true;
    let url: string | null = null;
    loadIntroVideo().then((u) => {
      if (!alive) return releaseIntroVideo(u);
      url = u;
      if (u) setSrc(u);
      else setFailed(true);
    });
    return () => {
      alive = false;
      releaseIntroVideo(url);
    };
  }, [reduce]);

  const usable = !reduce && !failed && ready && !!src;
  useEffect(() => {
    cb.current.onVideo(usable);
  }, [usable]);

  // 영상이 처음 쓸 수 있게 될 때(지금 장면으로 인계) + 사용자가 탭을 고를 때: 그 장면 시작점으로
  useEffect(() => {
    const v = ref.current;
    if (!usable || !v) return;
    v.currentTime = segStart(sceneRef.current);
    cb.current.onProgress?.(0);
  }, [seekToken, usable]);

  // 재생·멈춤과 장면 경계 확인
  useEffect(() => {
    const v = ref.current;
    if (!usable || !v) return;
    if (mode === 'paused') {
      v.pause();
      return;
    }
    let live = true; // 이 효과의 재생 요청만 유효(정리되면 늦게 온 거부는 무시)
    const i0 = sceneRef.current;
    const end = segEnd(i0);
    if (mode === 'segment' && v.currentTime >= end) v.currentTime = segStart(i0);
    v.loop = mode === 'auto';
    const report = () => {
      const t = v.currentTime;
      if (mode === 'segment') {
        if (t >= end) {
          v.pause();
          v.currentTime = end; // 늦게 확인해 다음 장면으로 넘어갔어도 고른 장면 끝 모습으로
        }
        return;
      }
      const i = sceneAt(t);
      if (i !== sceneRef.current) cb.current.onScene(i);
      cb.current.onProgress?.(Math.min(1, Math.max(0, (t - i * INTRO_SEG_S) / INTRO_SEG_S)));
    };
    const p = v.play();
    if (p && typeof p.catch === 'function')
      p.catch((e: unknown) => {
        if (live && isRealFailure(e)) setFailed(true);
      });
    const tick = window.setInterval(report, INTRO_POLL_MS);
    return () => {
      live = false;
      window.clearInterval(tick);
    };
  }, [mode, usable, seekToken]);

  return (
    <div
      className="lang-stage"
      aria-hidden="true"
      data-testid="lang-stage"
      data-video={usable ? 'on' : 'off'}
    >
      {/* 정지 그림: 영상이 준비되기 전·실패·움직임 줄이기 */}
      {!usable && (
        <img
          className="lang-still"
          src={introUrl(INTRO_STILLS[scene])}
          alt=""
          decoding="async"
          data-testid="lang-still"
        />
      )}
      {!reduce && !failed && src && (
        <video
          ref={ref}
          className={usable ? 'lang-video is-on' : 'lang-video'}
          src={src}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          data-testid="lang-video"
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
