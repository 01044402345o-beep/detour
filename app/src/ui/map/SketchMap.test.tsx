import { fireEvent, render, screen } from '@testing-library/react';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { places } from '../../data';
import { SketchMap } from './SketchMap';
import { contrastRatio, parseTokens, resolveColor } from '../a11y';
import {
  MAP_INSET_PX,
  PIN_FILL,
  PIN_HIT_R,
  SKETCH_BG,
  SKETCH_TEXT,
  SKETCH_W,
  START_FILL,
} from './sketchConstants';
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
  { id: 'mus', no: 3, name: 'Museum', category: 'sight', geo: { lat: 36.3273, lng: 127.4206 } },
];

beforeEach(() => useAppStore.setState({ lang: 'en' }));
afterEach(() => useAppStore.setState({ lang: null }));

describe('SketchMap (SVG 약도)', () => {
  it('번호 핀이 순서대로, 이름은 "번호. 장소명"', () => {
    render(<SketchMap stops={STOPS} onSelect={() => {}} label="Course" />);
    const pins = screen.getAllByRole('button');
    expect(pins.map((p) => p.getAttribute('aria-label'))).toEqual([
      '1. Sungsimdang',
      '2. Euneungjeongi',
      '3. Museum',
    ]);
    expect(screen.getByRole('group', { name: 'Course' })).toBeInTheDocument();
  });

  it('핀 클릭·Enter·Space → onSelect(장소 ID)', () => {
    const onSelect = vi.fn();
    render(<SketchMap stops={STOPS} onSelect={onSelect} label="Course" />);
    fireEvent.click(screen.getByTestId('map-pin-eun'));
    fireEvent.keyDown(screen.getByTestId('map-pin-mus'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('map-pin-ssd'), { key: ' ' });
    fireEvent.keyDown(screen.getByTestId('map-pin-ssd'), { key: 'a' });
    expect(onSelect.mock.calls).toEqual([['eun'], ['mus'], ['ssd']]);
  });

  it('핀은 Tab으로 갈 수 있고, 최소 폭 360px에서 실제 표시되는 히트 지름이 44px 이상 (R1 M-02)', () => {
    render(<SketchMap stops={STOPS} onSelect={() => {}} label="Course" />);
    const pin = screen.getByTestId('map-pin-ssd');
    expect(pin).toHaveAttribute('tabindex', '0');
    const r = Number(pin.querySelector('circle')?.getAttribute('r'));
    expect(r).toBe(PIN_HIT_R);
    expect(PIN_HIT_R).toBe(25);
    for (const vw of [360, 390, 430]) {
      const shownW = vw - MAP_INSET_PX;
      expect((r * 2 * shownW) / SKETCH_W).toBeGreaterThanOrEqual(44);
    }
  });

  it('MAP_INSET_PX가 map.css의 실제 여백·테두리와 일치', () => {
    const css = readFileSync(join(process.cwd(), 'src/ui/map/map.css'), 'utf8');
    const block = (sel: string) => {
      const at = css.indexOf(`\n${sel} {`);
      return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
    };
    expect(block('.cmap')).toMatch(/margin:\s*0 16px;/);
    expect(block('.cmap-box')).toMatch(/border:\s*1px solid/);
    expect(MAP_INSET_PX).toBe(16 * 2 + 1 * 2);
  });

  it('실제 코스 4곳의 히트 원이 서로 겹치지 않음', () => {
    const real: MapStop[] = places.map((p, i) => ({
      id: p.id,
      no: i + 1,
      name: p.name.en,
      category: p.category,
      geo: p.geo,
    }));
    render(<SketchMap stops={real} onSelect={() => {}} label="Course" />);
    const centers = real.map((p) => {
      const c = screen.getByTestId(`map-pin-${p.id}`).querySelector('circle')!;
      return { x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')) };
    });
    for (let i = 0; i < centers.length; i += 1) {
      for (let j = i + 1; j < centers.length; j += 1) {
        const d = Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y);
        expect(d).toBeGreaterThan(PIN_HIT_R * 2);
      }
    }
  });

  it('약도 모드에는 OSM 데이터·링크가 없음 → 누를 수 있는 요소는 44px 이상 핀뿐 (T3.2 → R3)', () => {
    const { container } = render(<SketchMap stops={STOPS} onSelect={() => {}} label="Course" />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.textContent).not.toContain('OpenStreetMap');
    const pressables = container.querySelectorAll('[role="button"], [tabindex]');
    expect(pressables).toHaveLength(STOPS.length);
    pressables.forEach((el) => expect(el.getAttribute('data-testid')).toMatch(/^map-pin-/));
  });

  it('정류장 연결선이 정류장 수만큼 꼭짓점을 가짐', () => {
    render(<SketchMap stops={STOPS} onSelect={() => {}} label="Course" />);
    const d = screen.getByTestId('map-line').getAttribute('d') ?? '';
    expect(d.match(/[ML]/g)).toEqual(['M', 'L', 'L']);
    expect(screen.getByTestId('map-line')).toHaveAttribute('data-route', 'straight');
  });

  it('도보 경로가 있으면 경로 점 수만큼 꼭짓점, 실선, 핀은 경로 양 끝과 같은 위치 (T2.2b)', () => {
    const route = [
      STOPS[0].geo,
      { lat: 36.3284, lng: 127.4271 },
      STOPS[1].geo,
      { lat: 36.3281, lng: 127.4231 },
      STOPS[2].geo,
    ];
    const { container } = render(
      <SketchMap stops={STOPS} onSelect={() => {}} label="Course" route={route} />,
    );
    const line = screen.getByTestId('map-line');
    const d = line.getAttribute('d') ?? '';
    expect(d.match(/[ML]/g)).toHaveLength(route.length);
    expect(line).toHaveAttribute('data-route', 'walk');
    expect(line.getAttribute('stroke-dasharray')).toBeNull();
    const pts = [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const dot = (id: string) => {
      const c = container.querySelector(`[data-testid="map-pin-${id}"] .cmap-sketch__dot`)!;
      return [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))];
    };
    expect(dot('ssd')).toEqual(pts[0]);
    expect(dot('eun')).toEqual(pts[2]);
    expect(dot('mus')).toEqual(pts[4]);
  });

  it('약도 문구는 사용자 언어 (하천·대전역 방향)', () => {
    useAppStore.setState({ lang: 'ja' });
    const { container } = render(<SketchMap stops={STOPS} onSelect={() => {}} label="x" />);
    expect(container.textContent).toContain(t('ja', 'course.mapStream'));
    expect(container.textContent).toContain(t('ja', 'course.mapToDaejeonStn'));
    expect(container.textContent).not.toContain(t('en', 'course.mapStream'));
  });
});

describe('약도 출발지 이름표 (대전역)', () => {
  const start = { label: 'Daejeon Stn', geo: { lat: 36.3315, lng: 127.4325 } };

  it('이름표를 그리고 장식 문구 "대전역 방향 →"은 숨김, 누를 수 있는 요소는 핀뿐', () => {
    const { container } = render(
      <SketchMap stops={STOPS} onSelect={() => {}} label="Course" start={start} />,
    );
    expect(screen.getByTestId('map-start')).toHaveTextContent('Daejeon Stn');
    expect(container.textContent).not.toContain(t('en', 'course.mapToDaejeonStn'));
    // 장식 하천은 고정 위치라 실제 대전역(하천 동쪽)과 어긋나므로 숨김
    expect(container.textContent).not.toContain(t('en', 'course.mapStream'));
    expect(container.querySelectorAll('[role="button"], [tabindex]')).toHaveLength(STOPS.length);
  });

  it('경로 첫 점 = 출발지 위치 (같은 축척 투영)', () => {
    const route = [start.geo, STOPS[0].geo, STOPS[1].geo, STOPS[2].geo];
    render(
      <SketchMap stops={STOPS} onSelect={() => {}} label="Course" start={start} route={route} />,
    );
    const d = screen.getByTestId('map-line').getAttribute('d') ?? '';
    const m = /^M([\d.]+) ([\d.]+)/.exec(d)!;
    const c = screen.getByTestId('map-start').querySelector('circle')!;
    expect([Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]).toEqual([
      Number(m[1]),
      Number(m[2]),
    ]);
  });

  it('이름표 글자는 표에 등록된 색, 이름표 바탕은 START_FILL', () => {
    render(<SketchMap stops={STOPS} onSelect={() => {}} label="Course" start={start} />);
    const g = screen.getByTestId('map-start');
    expect(g.querySelector('text')?.getAttribute('fill')).toBe(SKETCH_TEXT.start.fill);
    expect(g.querySelector('rect')?.getAttribute('fill')).toBe(START_FILL);
    expect([...SKETCH_TEXT.start.on]).toEqual([START_FILL]);
  });
});

describe('약도 글자 대비 4.5:1 (T3.2)', () => {
  const tokens = parseTokens(readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8'));
  const hex = (c: string) => resolveColor(c, tokens);

  it('표의 모든 글자 색 × 놓일 수 있는 바탕이 4.5:1 이상', () => {
    for (const [name, { fill, on }] of Object.entries(SKETCH_TEXT)) {
      for (const bg of on) {
        const ratio = contrastRatio(hex(fill), hex(bg));
        expect({ name, bg, ok: ratio >= 4.5 }).toEqual({ name, bg, ok: true });
      }
    }
  });

  it('하천 이름은 하천·바탕·블록·도로 모두를 바탕으로 검사하고, 옛 색 #4f7385는 쓰지 않음', () => {
    expect([...SKETCH_TEXT.stream.on].sort()).toEqual(Object.values(SKETCH_BG).sort());
    expect(SKETCH_TEXT.stream.fill.toLowerCase()).not.toBe('#4f7385');
    expect(SKETCH_TEXT.stream.fill).toBe(hex('var(--sea-d)'));
  });

  it('핀 채움은 표의 핀 바탕과 같음 (흰 번호 대비)', () => {
    expect([...SKETCH_TEXT.pin.on].sort()).toEqual(Object.values(PIN_FILL).sort());
  });

  it('렌더된 약도의 모든 <text>가 표에 등록된 글자 색을 씀 (표 밖 글자 금지)', () => {
    const { container } = render(<SketchMap stops={STOPS} onSelect={() => {}} label="Course" />);
    const allowed = new Set<string>(Object.values(SKETCH_TEXT).map((x) => x.fill));
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(2 + STOPS.length);
    texts.forEach((el) => expect(allowed.has(el.getAttribute('fill') ?? '')).toBe(true));
    // 하천 이름 글자가 실제로 표의 색을 씀
    const stream = [...texts].find((el) => el.textContent === t('en', 'course.mapStream'));
    expect(stream?.getAttribute('fill')).toBe(SKETCH_TEXT.stream.fill);
  });

  it('핀 원은 카테고리별 PIN_FILL을 씀', () => {
    render(<SketchMap stops={STOPS} onSelect={() => {}} label="Course" />);
    const dot = (id: string) =>
      screen.getByTestId(`map-pin-${id}`).querySelector('.cmap-sketch__dot')?.getAttribute('fill');
    expect(dot('ssd')).toBe(PIN_FILL.food);
    expect(dot('eun')).toBe(PIN_FILL.sight);
  });
});
