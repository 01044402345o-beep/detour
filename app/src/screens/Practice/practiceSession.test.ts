import { phraseInput } from '../../router/navState';
import {
  eventRef,
  navForItem,
  nextNav,
  parsePracticeNav,
  resolveSession,
  sentenceFontSize,
  staffInput,
} from './practiceSession';

const ctx = { cart: { ssd: { tw: 2, bu: 1 } }, currentPlaceId: 'ssd', takeout: true };

describe('parsePracticeNav', () => {
  it('공용 계약(parsePhraseInput) + phrase의 withOrder만', () => {
    expect(parsePracticeNav({ src: 'order' })).toEqual({ src: 'order' });
    expect(parsePracticeNav({ src: 'phrase', phraseId: 'ssd-1', withOrder: true })).toEqual({
      src: 'phrase',
      phraseId: 'ssd-1',
      withOrder: true,
    });
    expect(parsePracticeNav({ src: 'phrase', phraseId: 'ssd-1', withOrder: 'yes' })).toEqual({
      src: 'phrase',
      phraseId: 'ssd-1',
    });
    expect(parsePracticeNav({ src: 'phrase' })).toBeNull();
    expect(parsePracticeNav(null)).toBeNull();
  });
});

describe('resolveSession', () => {
  it('order: [주문 문장, 장소 문장…], 포장은 effectiveTakeout', () => {
    const s = resolveSession(phraseInput('order'), ctx)!;
    expect(s.list.map((i) => i.key)).toEqual(['order', 'ssd-1', 'ssd-2', 'ssd-3', 'ssd-4']);
    expect(s.item.ko).toBe('튀김소보로 두 개, 판타롱부추빵 한 개 주세요. 포장해 주세요.');
    expect(s.item.words.map((w) => w.ko).join(' ')).toContain('포장해');
    expect(s.hasOrder).toBe(true);
  });

  it('takeout:false 장소(광천식당)는 포장 문장 없음', () => {
    const s = resolveSession(phraseInput('order'), {
      cart: { gwc: { dt: 1 } },
      currentPlaceId: 'gwc',
      takeout: true,
    })!;
    expect(s.item.ko).not.toContain('포장');
  });

  it('빈 주문·현재 장소 없음·깨진 수량 → null', () => {
    expect(resolveSession(phraseInput('order'), { ...ctx, cart: {} })).toBeNull();
    expect(resolveSession(phraseInput('order'), { ...ctx, currentPlaceId: null })).toBeNull();
    expect(resolveSession(phraseInput('order'), { ...ctx, cart: { ssd: { tw: 42 } } })).toBeNull();
  });

  it('phrase: 문장이 속한 장소 목록과 위치, 없는 ID → null', () => {
    const s = resolveSession(phraseInput('phrase', 'mus-3'), ctx)!;
    expect(s.place.id).toBe('mus');
    expect(s.index).toBe(2);
    expect(s.hasOrder).toBe(false);
    expect(resolveSession(phraseInput('phrase', 'mus-9'), ctx)).toBeNull();
  });

  it('withOrder: 같은 장소 주문이 있으면 목록 앞에 주문, 없으면 문장만', () => {
    const nav = { ...phraseInput('phrase', 'ssd-1'), withOrder: true as const };
    expect(resolveSession(nav, ctx)!.index).toBe(1);
    const noOrder = resolveSession(nav, { ...ctx, cart: {} })!;
    expect(noOrder.index).toBe(0);
    expect(noOrder.hasOrder).toBe(false);
  });
});

describe('이동·기록 헬퍼', () => {
  const s = resolveSession(phraseInput('order'), ctx)!;

  it('nextNav: 다음, 마지막이면 처음', () => {
    expect(nextNav(s)).toEqual({ src: 'phrase', phraseId: 'ssd-1', withOrder: true });
    const last = resolveSession({ src: 'phrase', phraseId: 'ssd-4', withOrder: true }, ctx)!;
    expect(nextNav(last)).toEqual({ src: 'order' });
    const plain = resolveSession(phraseInput('phrase', 'eun-3'), ctx)!;
    expect(nextNav(plain)).toEqual({ src: 'phrase', phraseId: 'eun-1' });
  });

  it('navForItem·staffInput·eventRef', () => {
    expect(navForItem(s.item, true)).toEqual({ src: 'order' });
    expect(staffInput(s.list[2])).toEqual({ src: 'phrase', phraseId: 'ssd-2' });
    expect(eventRef(s.item)).toEqual({ src: 'order', placeId: 'ssd' });
    expect(eventRef(s.list[1])).toEqual({ src: 'phrase', placeId: 'ssd', phraseId: 'ssd-1' });
  });

  it('긴 문장은 글자 크기를 줄임 (목업 18자 기준)', () => {
    expect(sentenceFontSize('계산할게요')).toBe(27);
    expect(sentenceFontSize('튀김소보로 두 개, 판타롱부추빵 한 개 주세요.')).toBe(22);
  });
});
