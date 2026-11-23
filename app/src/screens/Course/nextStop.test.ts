import type { AppEvent } from '../../domain/events';
import { nextStopIndex } from './nextStop';

const STOPS = ['ssd', 'eun', 'mus', 'gwc'];
const view = (placeId: string, t = 1): AppEvent => ({ type: 'place_view', placeId, t });

describe('nextStopIndex (Start walking 대상)', () => {
  it('기록 없음 → 첫 정류장', () => {
    expect(nextStopIndex(STOPS, [])).toBe(0);
    expect(nextStopIndex(STOPS, [{ type: 'screen_view', screen: 'course', t: 1 }])).toBe(0);
  });

  it('마지막으로 본 코스 정류장이 k번 → k+1번 (가장 최근 기록 기준)', () => {
    expect(nextStopIndex(STOPS, [view('ssd')])).toBe(1);
    expect(nextStopIndex(STOPS, [view('mus'), view('eun')])).toBe(2);
    expect(nextStopIndex(STOPS, [view('ssd'), view('mus')])).toBe(3);
  });

  it('마지막 정류장을 봤으면 마지막 정류장 유지', () => {
    expect(nextStopIndex(STOPS, [view('gwc')])).toBe(3);
  });

  it('코스 밖 장소·다른 이벤트는 건너뜀', () => {
    expect(nextStopIndex(STOPS, [view('eun'), view('zzz'), { type: 'screen_view', screen: 'place', t: 2 }])).toBe(2);
    expect(nextStopIndex(STOPS, [view('zzz')])).toBe(0);
  });

  it('정류장이 없으면 -1', () => {
    expect(nextStopIndex([], [view('ssd')])).toBe(-1);
  });
});
