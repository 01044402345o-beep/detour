/**
 * Leaflet + OSM 타일 지도 (T2.2, PRD 8장 '지도').
 * - OSM 출처는 Leaflet 출처 표시 컨트롤로 상시 노출합니다(접을 수 없음).
 * - 번호 핀(키보드 Tab·Enter 가능) + 선: route가 있으면 미리 계산한 도보 경로(실선, 참고용, T2.2b),
 *   없으면 정류장 연결선(점선, 실제 보행 경로 아님).
 * - 타일이 실패하면 onFail()을 한 번 부릅니다 → CourseMap이 SVG 약도로 바꿉니다.
 *   판정은 Leaflet 타일 묶음 단위입니다(R1 M-01). `loading`(현재 뷰의 새 묶음 시작)마다 묶음 오류 수를 0으로
 *   되돌리고 TILE_TIMEOUT_MS 타이머를 겁니다. `load`(묶음 처리 끝, 오류 타일 포함)에서 타이머를 풀고,
 *   그 묶음에 오류가 한 장이라도 있으면 실패로 봅니다(Leaflet은 실패 타일을 다시 받지 않아 빈 칸이 남음).
 *   타이머가 끝나면 성공 타일이 있어도 실패입니다. 재요청·재시도는 하지 않습니다(OSM 타일 정책).
 *   R2 M-03: 오류는 타일 좌표 Set으로 추적해(tileerror 추가·tileunload 삭제) load 때 현재 줌의 오류만 보고,
 *   로딩 중 줌·이동(zoomend·moveend)이면 기한을 다시 겁니다(Leaflet은 로딩 중에 loading을 다시 내지 않음).
 * - 확대·축소 버튼은 두지 않습니다(R1 M-02·L-01): 26~30px라 터치 44px 미달이고 이름이 영어로 고정됩니다.
 *   fitBounds로 4곳이 처음부터 다 보이며, 두 손가락 확대·더블클릭·키보드 +/−는 그대로 됩니다.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { GeoPoint } from '../../types';
import type { MapStop } from './types';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/** 타일 묶음 하나가 이 시간 안에 다 처리되지 않으면 실패로 봅니다 */
export const TILE_TIMEOUT_MS = 8000;
/** fitBounds 기본 여백 (px) */
const FIT_PAD = 36;
/** 출처 표시 막대 높이(터치 44px) + 아래 여백 4px — map.css와 맞춤 */
export const ATTRIBUTION_H = 48;
const TILE_MIN_ZOOM = 0;
const TILE_MAX_ZOOM = 19;

export type LeafletMapProps = {
  stops: readonly MapStop[];
  onSelect: (id: string) => void;
  onFail: () => void;
  label: string;
  /** 지도 인스턴스가 준비되면 한 번 (테스트에서 이동·확대로 새 타일 묶음을 만들 때 사용) */
  onMapReady?: (map: L.Map) => void;
  /** 도보 경로 좌표 (CourseMap 참고). 바뀔 때마다 지도를 다시 그리므로 고정값을 넘기세요 */
  route?: readonly GeoPoint[];
};

function pinIcon(stop: MapStop): L.DivIcon {
  const el = document.createElement('span');
  el.className = 'cmap-pin__dot';
  el.textContent = String(stop.no);
  el.setAttribute('aria-hidden', 'true');
  return L.divIcon({
    className: `cmap-pin cmap-pin--${stop.category}`,
    html: el,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function LeafletMap({ stops, onSelect, onFail, label, onMapReady, route }: LeafletMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const failRef = useRef(onFail);
  const readyRef = useRef(onMapReady);
  useEffect(() => {
    selectRef.current = onSelect;
    failRef.current = onFail;
    readyRef.current = onMapReady;
  });

  useEffect(() => {
    const box = boxRef.current;
    if (!box || stops.length === 0) return;
    const map = L.map(box, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    map.attributionControl.setPrefix(false);
    // 뷰를 먼저 정해야 핀이 바로 DOM에 붙습니다(접근성 속성 지정)
    const latlngs = stops.map((s) => L.latLng(s.geo.lat, s.geo.lng));
    const routeLatlngs =
      route && route.length >= 2 ? route.map((g) => L.latLng(g.lat, g.lng)) : null;
    map.fitBounds(L.latLngBounds([...latlngs, ...(routeLatlngs ?? [])]), {
      paddingTopLeft: [FIT_PAD, FIT_PAD],
      // 아래쪽은 출처 표시 막대(44px + 여백) 위로 핀이 오게
      paddingBottomRight: [FIT_PAD, FIT_PAD + ATTRIBUTION_H],
      maxZoom: 17,
    });

    let failed = false;
    let everLoaded = false;
    /** 지금 지도에 붙어 있는 오류 타일 (`z/x/y`). 제거된 타일의 오래된 오류는 빠집니다 (R2 M-03) */
    const errorTiles = new Set<string>();
    let timer: number | undefined;
    const stopTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const fail = () => {
      stopTimer();
      if (failed) return;
      failed = true;
      failRef.current();
    };
    const startTimer = () => {
      stopTimer();
      if (!failed) timer = window.setTimeout(fail, TILE_TIMEOUT_MS);
    };
    const key = (c: L.Coords) => `${c.z}/${c.x}/${c.y}`;

    const tiles = L.tileLayer(OSM_TILE_URL, {
      minZoom: TILE_MIN_ZOOM,
      maxZoom: TILE_MAX_ZOOM,
      attribution: OSM_ATTRIBUTION,
    });
    /** 지금 뷰의 타일 줌 (Leaflet과 같은 규칙: 반올림 후 범위 제한) */
    const tileZoom = () =>
      Math.min(TILE_MAX_ZOOM, Math.max(TILE_MIN_ZOOM, Math.round(map.getZoom())));

    tiles
      .on('loading', startTimer)
      .on('tileload', () => {
        everLoaded = true;
      })
      .on('tileerror', (e: L.TileErrorEvent) => {
        errorTiles.add(key(e.coords));
        // 한 장도 받은 적 없이 실패하면(오프라인 등) 묶음 끝을 기다리지 않고 바로 전환
        if (!everLoaded) fail();
      })
      .on('tileunload', (e: L.TileEvent) => {
        errorTiles.delete(key(e.coords));
      })
      .on('load', () => {
        stopTimer();
        // load는 이전 줌 타일 정리보다 먼저 오므로 현재 줌의 오류만 봅니다
        const z = tileZoom();
        for (const k of errorTiles) {
          if (Number(k.split('/')[0]) === z) {
            fail();
            return;
          }
        }
      })
      .addTo(map);

    // 로딩 중에 줌·이동하면 Leaflet은 loading을 다시 내지 않으므로 여기서 기한을 다시 겁니다
    const onViewChange = () => {
      if (tiles.isLoading()) startTimer();
    };
    map.on('zoomend moveend', onViewChange);

    if (routeLatlngs) {
      L.polyline(routeLatlngs, {
        color: '#151a26',
        weight: 4,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
        className: 'cmap-line cmap-line--route',
      }).addTo(map);
    } else {
      L.polyline(latlngs, {
        color: '#151a26',
        weight: 3,
        opacity: 0.75,
        dashArray: '7 6',
        lineCap: 'round',
        interactive: false,
        className: 'cmap-line',
      }).addTo(map);
    }

    for (const s of stops) {
      const marker = L.marker([s.geo.lat, s.geo.lng], {
        icon: pinIcon(s),
        keyboard: true,
        riseOnHover: true,
      })
        .on('click', () => selectRef.current(s.id))
        .addTo(map);
      const el = marker.getElement();
      if (el) {
        el.setAttribute('aria-label', `${s.no}. ${s.name}`);
        el.setAttribute('data-testid', `map-pin-${s.id}`);
      }
    }
    readyRef.current?.(map);

    return () => {
      stopTimer();
      map.remove();
    };
  }, [stops, route]);

  return (
    <div
      ref={boxRef}
      className="cmap-leaflet"
      role="group"
      aria-label={label}
      data-testid="map-tiles"
    />
  );
}
