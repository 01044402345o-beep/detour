import { act, fireEvent, render, screen } from '@testing-library/react';
import L2 from 'leaflet';
import type L from 'leaflet';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATTRIBUTION_H, LeafletMap, TILE_TIMEOUT_MS } from './LeafletMap';
import type { MapStop } from './types';

const STOPS: MapStop[] = [
  { id: 'ssd', no: 1, name: 'Sungsimdang', category: 'food', geo: { lat: 36.3277, lng: 127.4273 } },
  {
    id: 'eun',
    no: 2,
    name: 'Euneungjeongi',
    category: 'sight',
    geo: { lat: 36.3289, lng: 127.4262 },
  },
];

// jsdom은 레이아웃이 없어 Leaflet이 크기 0으로 보고 타일을 요청하지 않으므로 폰 지도 크기를 줍니다.
const sizeSpies: { mockRestore: () => void }[] = [];
beforeAll(() => {
  sizeSpies.push(
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(358),
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(288),
  );
});
afterAll(() => sizeSpies.forEach((s) => s.mockRestore()));
afterEach(() => vi.useRealTimers());

function tiles(): HTMLImageElement[] {
  return Array.from(document.querySelectorAll<HTMLImageElement>('img.leaflet-tile'));
}

describe('LeafletMap (OSM 타일)', () => {
  it('OSM 출처 표시가 늘 보이고 copyright 링크를 가짐', () => {
    render(<LeafletMap stops={STOPS} onSelect={() => {}} onFail={() => {}} label="Course" />);
    const attr = document.querySelector('.leaflet-control-attribution');
    expect(attr).not.toBeNull();
    expect(attr?.textContent).toContain('OpenStreetMap');
    expect(attr?.querySelector('a')?.getAttribute('href')).toBe(
      'https://www.openstreetmap.org/copyright',
    );
  });

  it('타일은 OSM 서버에서 요청', () => {
    render(<LeafletMap stops={STOPS} onSelect={() => {}} onFail={() => {}} label="Course" />);
    expect(tiles().length).toBeGreaterThan(0);
    expect(tiles()[0].src).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  });

  it('번호 핀: 이름·키보드(role=button) 가능, 클릭 → onSelect', () => {
    const onSelect = vi.fn();
    render(<LeafletMap stops={STOPS} onSelect={onSelect} onFail={() => {}} label="Course" />);
    const pin = screen.getByTestId('map-pin-eun');
    expect(pin).toHaveAttribute('aria-label', '2. Euneungjeongi');
    expect(pin).toHaveAttribute('role', 'button');
    expect(pin).toHaveAttribute('tabindex', '0');
    expect(pin.textContent).toBe('2');
    fireEvent.click(pin);
    expect(onSelect).toHaveBeenCalledWith('eun');
  });

  it('정류장 연결선(점선)을 그림', () => {
    render(<LeafletMap stops={STOPS} onSelect={() => {}} onFail={() => {}} label="Course" />);
    const line = document.querySelector('path.cmap-line');
    expect(line).not.toBeNull();
    expect(line?.getAttribute('stroke-dasharray')).toBe('7 6');
  });

  it('첫 타일이 오기 전 실패 → onFail 한 번', () => {
    const onFail = vi.fn();
    render(<LeafletMap stops={STOPS} onSelect={() => {}} onFail={onFail} label="Course" />);
    const [a, b] = tiles();
    act(() => {
      fireEvent.error(a);
      fireEvent.error(b);
    });
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('확대·축소 버튼 없음 (터치 44px 미달·영어 이름 문제 제거, R1 M-02·L-01)', () => {
    render(<LeafletMap stops={STOPS} onSelect={() => {}} onFail={() => {}} label="Course" />);
    expect(document.querySelector('.leaflet-control-zoom')).toBeNull();
    expect(screen.queryByRole('button', { name: /zoom/i })).toBeNull();
  });

  it('성공 n장 + 오류 1장으로 묶음이 끝나면(load) 약도로 전환 (R1 M-01)', () => {
    const onFail = vi.fn();
    render(<LeafletMap stops={STOPS} onSelect={() => {}} onFail={onFail} label="Course" />);
    const ts = tiles();
    expect(ts.length).toBeGreaterThan(2);
    act(() => fireEvent.load(ts[0]));
    act(() => fireEvent.error(ts[1]));
    expect(onFail).not.toHaveBeenCalled(); // 묶음이 끝나기 전에는 판정하지 않음
    act(() => ts.slice(2).forEach((el) => fireEvent.load(el)));
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it(`성공 n장 + 나머지 대기 → ${TILE_TIMEOUT_MS}ms 뒤 약도로 전환`, () => {
    vi.useFakeTimers();
    const onFail = vi.fn();
    render(<LeafletMap stops={STOPS} onSelect={() => {}} onFail={onFail} label="Course" />);
    const ts = tiles();
    act(() => ts.slice(0, 2).forEach((el) => fireEvent.load(el)));
    act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS - 1));
    expect(onFail).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it(`타일이 한 장도 안 오면(응답 없음) ${TILE_TIMEOUT_MS}ms 뒤 전환`, () => {
    vi.useFakeTimers();
    const onFail = vi.fn();
    render(<LeafletMap stops={STOPS} onSelect={() => {}} onFail={onFail} label="Course" />);
    act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS));
    expect(onFail).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS * 2));
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('첫 묶음이 정상으로 끝나면 타이머 해제 → 오래 지나도 전환 없음', () => {
    vi.useFakeTimers();
    const onFail = vi.fn();
    render(<LeafletMap stops={STOPS} onSelect={() => {}} onFail={onFail} label="Course" />);
    act(() => tiles().forEach((el) => fireEvent.load(el)));
    act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS * 2));
    expect(onFail).not.toHaveBeenCalled();
  });

  it(`두 번째 묶음(이동·확대)이 ${TILE_TIMEOUT_MS}ms 정체되면 전환`, () => {
    vi.useFakeTimers();
    const onFail = vi.fn();
    let map: L.Map | undefined;
    render(
      <LeafletMap
        stops={STOPS}
        onSelect={() => {}}
        onFail={onFail}
        label="Course"
        onMapReady={(m) => (map = m)}
      />,
    );
    act(() => tiles().forEach((el) => fireEvent.load(el)));
    const before = new Set(tiles());
    act(() => {
      map!.setZoom(map!.getZoom() - 2, { animate: false });
    });
    const fresh = tiles().filter((el) => !before.has(el));
    expect(fresh.length).toBeGreaterThan(0);
    act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS - 1));
    expect(onFail).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('두 번째 묶음에서 오류가 나면 그 묶음 끝에 전환, 앞 묶음 오류 수는 이어지지 않음', () => {
    const onFail = vi.fn();
    let map: L.Map | undefined;
    render(
      <LeafletMap
        stops={STOPS}
        onSelect={() => {}}
        onFail={onFail}
        label="Course"
        onMapReady={(m) => (map = m)}
      />,
    );
    act(() => tiles().forEach((el) => fireEvent.load(el)));
    const before = new Set(tiles());
    act(() => {
      map!.setZoom(map!.getZoom() - 2, { animate: false });
    });
    const fresh = tiles().filter((el) => !before.has(el));
    act(() => fresh.slice(1).forEach((el) => fireEvent.load(el)));
    expect(onFail).not.toHaveBeenCalled();
    act(() => fireEvent.error(fresh[0]));
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  describe('로딩 중 뷰 변경 (R2 M-03)', () => {
    function renderWithMap(onFail: () => void) {
      const ref: { map?: L.Map } = {};
      render(
        <LeafletMap
          stops={STOPS}
          onSelect={() => {}}
          onFail={onFail}
          label="Course"
          onMapReady={(m) => (ref.map = m)}
        />,
      );
      return ref;
    }
    const tileLayerOf = (map: L.Map) => {
      let layer: L.TileLayer | undefined;
      map.eachLayer((l) => {
        if ((l as L.TileLayer).getTileUrl) layer = l as L.TileLayer;
      });
      return layer!;
    };
    const tileZ = (el: HTMLImageElement) => Number(/\/(\d+)\/\d+\/\d+\.png$/.exec(el.src)?.[1]);

    it('(a) 첫 뷰 성공 1·오류 1·나머지 대기 → 로딩 중 확대 → 새 줌 타일 모두 성공 → 전환 없음', () => {
      const onFail = vi.fn();
      const ref = renderWithMap(onFail);
      const first = tiles();
      const z0 = tileZ(first[0]);
      act(() => fireEvent.load(first[0]));
      act(() => fireEvent.error(first[1]));
      expect(onFail).not.toHaveBeenCalled();
      act(() => {
        ref.map!.setZoom(ref.map!.getZoom() - 2, { animate: false });
      });
      const fresh = tiles().filter((el) => tileZ(el) !== z0);
      expect(fresh.length).toBeGreaterThan(0);
      act(() => fresh.forEach((el) => fireEvent.load(el)));
      // 이전 줌에서 아직 대기 중인 타일이 남아 있으면 마저 끝냄(성공)
      act(() =>
        tiles()
          .filter((el) => tileZ(el) === z0 && el !== first[1] && el !== first[0])
          .forEach((el) => fireEvent.load(el)),
      );
      // 묶음이 실제로 끝났는데(load) 전환이 없어야 함 — 판정을 건너뛴 게 아님을 확인
      expect(tileLayerOf(ref.map!).isLoading()).toBe(false);
      expect(onFail).not.toHaveBeenCalled();
    });

    it('(a-2) load 시점에 이전 줌 오류 타일이 아직 남아 있어도 현재 줌 오류만 판정', () => {
      // 애니메이션 줌(두 손가락)에서는 이전 줌 타일 정리가 load 뒤에 일어나므로, 그 상태를 직접 만듭니다.
      const onFail = vi.fn();
      const ref = renderWithMap(onFail);
      const layer = tileLayerOf(ref.map!);
      act(() => tiles().forEach((el) => fireEvent.load(el)));
      const z0 = tileZ(tiles()[0]);
      act(() => {
        ref.map!.setZoom(ref.map!.getZoom() - 2, { animate: false });
      });
      const stale = L2.point(0, 0) as L.Coords;
      stale.z = z0;
      act(() => {
        layer.fire('tileerror', {
          tile: document.createElement('img'),
          coords: stale,
          error: new Error('x'),
        });
      });
      act(() =>
        tiles()
          .filter((el) => tileZ(el) !== z0)
          .forEach((el) => fireEvent.load(el)),
      );
      expect(layer.isLoading()).toBe(false);
      expect(onFail).not.toHaveBeenCalled();
    });

    it('(b) 같은 상황에서 새 줌 타일 1장이 오류 → 전환 1회', () => {
      const onFail = vi.fn();
      const ref = renderWithMap(onFail);
      const first = tiles();
      const z0 = tileZ(first[0]);
      act(() => fireEvent.load(first[0]));
      act(() => fireEvent.error(first[1]));
      act(() => {
        ref.map!.setZoom(ref.map!.getZoom() - 2, { animate: false });
      });
      const fresh = tiles().filter((el) => tileZ(el) !== z0);
      act(() => fireEvent.error(fresh[0]));
      act(() => fresh.slice(1).forEach((el) => fireEvent.load(el)));
      act(() =>
        tiles()
          .filter((el) => tileZ(el) === z0 && el !== first[1] && el !== first[0])
          .forEach((el) => fireEvent.load(el)),
      );
      expect(onFail).toHaveBeenCalledTimes(1);
    });

    it(`(c) 로딩 중 줌 변경 → 기한을 새로 걸어 ${TILE_TIMEOUT_MS}ms 미만엔 유지, 계속 대기면 전환`, () => {
      vi.useFakeTimers();
      const onFail = vi.fn();
      const ref = renderWithMap(onFail);
      act(() => fireEvent.load(tiles()[0]));
      act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS - 100));
      act(() => {
        ref.map!.setZoom(ref.map!.getZoom() - 2, { animate: false });
      });
      act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS - 1));
      expect(onFail).not.toHaveBeenCalled(); // 처음 기한(8초)은 이미 지났지만 새 기한 기준
      act(() => vi.advanceTimersByTime(1));
      expect(onFail).toHaveBeenCalledTimes(1);
    });

    it('(c-2) 로딩 중 이동(moveend)도 기한을 새로 걸고, 로딩이 끝난 뒤 이동은 타이머를 걸지 않음', () => {
      vi.useFakeTimers();
      const onFail = vi.fn();
      const ref = renderWithMap(onFail);
      act(() => fireEvent.load(tiles()[0]));
      act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS - 100));
      act(() => {
        ref.map!.panBy([20, 0], { animate: false });
      });
      act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS - 1));
      expect(onFail).not.toHaveBeenCalled();
      // 남은 타일을 모두 받으면 로딩 끝 → 이후 이동은 (새 타일이 없으면) 기한 없음
      act(() => tiles().forEach((el) => fireEvent.load(el)));
      act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS * 2));
      expect(onFail).not.toHaveBeenCalled();
    });

    it('(d) 같은 줌에서 오류 1장이 남은 채 작게 이동 → 남은 오류 때문에 전환', () => {
      const onFail = vi.fn();
      const ref = renderWithMap(onFail);
      const first = tiles();
      act(() => fireEvent.load(first[0]));
      act(() => fireEvent.error(first[1]));
      act(() => {
        ref.map!.panBy([20, 0], { animate: false });
      });
      expect(onFail).not.toHaveBeenCalled();
      act(() =>
        tiles()
          .filter((el) => el !== first[0] && el !== first[1])
          .forEach((el) => fireEvent.load(el)),
      );
      expect(onFail).toHaveBeenCalledTimes(1);
    });

    it('tileunload로 제거된 오류 타일은 판정에서 빠짐', () => {
      const onFail = vi.fn();
      const ref = renderWithMap(onFail);
      const layer = tileLayerOf(ref.map!);
      const first = tiles();
      act(() => fireEvent.load(first[0]));
      act(() => fireEvent.error(first[1]));
      // 오류 타일의 좌표로 tileunload를 직접 발생 (jsdom에서는 정리 시점을 맞추기 어려움)
      const m = /\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(first[1].src)!;
      const coords = L2.point(Number(m[2]), Number(m[3])) as L.Coords;
      coords.z = Number(m[1]);
      act(() => {
        layer.fire('tileunload', { tile: first[1], coords });
      });
      act(() => first.slice(2).forEach((el) => fireEvent.load(el)));
      expect(layer.isLoading()).toBe(false);
      expect(onFail).not.toHaveBeenCalled();
    });
  });

  it('언마운트하면 지도·타이머 정리 (이후 onFail 없음)', () => {
    vi.useFakeTimers();
    const onFail = vi.fn();
    const { unmount } = render(
      <LeafletMap stops={STOPS} onSelect={() => {}} onFail={onFail} label="Course" />,
    );
    unmount();
    act(() => vi.advanceTimersByTime(TILE_TIMEOUT_MS * 2));
    expect(onFail).not.toHaveBeenCalled();
    expect(document.querySelector('.leaflet-container')).toBeNull();
  });
});

describe('OSM 출처 링크 터치 영역 (T3.2 → R3)', () => {
  const css = readFileSync(join(process.cwd(), 'src/ui/map/map.css'), 'utf8');
  /** 선택자 블록 본문 (선택자 문자열이 정확히 일치하는 첫 규칙) */
  const block = (sel: string) => {
    const at = css.indexOf(`\n${sel} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
  };

  it('링크 상자 자체가 44×44px 이상 (min-width·min-height = --touch, inline-flex)', () => {
    const a = block('.cmap .leaflet-control-attribution a');
    expect(a).toMatch(/display:\s*inline-flex;/);
    expect(a).toMatch(/min-width:\s*var\(--touch\);/);
    expect(a).toMatch(/min-height:\s*var\(--touch\);/);
    const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    expect(tokens).toMatch(/--touch:\s*44px;/);
  });

  it('보이는 글자 크기 10px 유지, 출처 막대도 44px 높이', () => {
    const bar = block('.cmap .leaflet-control-attribution');
    expect(bar).toMatch(/font-size:\s*10px;/);
    expect(bar).toMatch(/min-height:\s*var\(--touch\);/);
  });

  it('출처 막대만큼 fitBounds 아래 여백을 둠 (핀이 막대에 가리지 않게)', () => {
    const bar = block('.cmap .leaflet-bottom.leaflet-right .leaflet-control-attribution');
    const mb = Number(/margin-bottom:\s*(\d+)px;/.exec(bar)?.[1]);
    expect(ATTRIBUTION_H).toBeGreaterThanOrEqual(44 + mb);
  });

  it('렌더된 출처 링크는 위 규칙이 걸리는 자리(.cmap 안 출처 컨트롤)에 있음', () => {
    const { container } = render(
      <div className="cmap">
        <LeafletMap stops={STOPS} onSelect={() => {}} onFail={() => {}} label="Course" />
      </div>,
    );
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].closest('.cmap .leaflet-control-attribution')).not.toBeNull();
    expect(links[0].textContent).toBe('OpenStreetMap');
  });
});
