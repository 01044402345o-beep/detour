import { parsePhraseInput, phraseInput, type PhraseInputState } from './navState';

describe('연습·직원 입력 상태 계약 { src, phraseId? }', () => {
  it('만들기: src·ID를 바꾸지 않음', () => {
    expect(phraseInput('order')).toEqual({ src: 'order' });
    expect(phraseInput('phrase', 'ssd-p1')).toEqual({ src: 'phrase', phraseId: 'ssd-p1' });
    // L02: 빈 ID여도 order로 바뀌지 않음 (검증은 받는 쪽)
    expect(phraseInput('phrase', '')).toEqual({ src: 'phrase', phraseId: '' });
  });

  it('읽기: 올바른 형식', () => {
    const order: PhraseInputState = { src: 'order' };
    expect(parsePhraseInput(order)).toEqual(order);
    expect(parsePhraseInput({ src: 'phrase', phraseId: 'ssd-1' })).toEqual({
      src: 'phrase',
      phraseId: 'ssd-1',
    });
    // order에 딸려 온 phraseId는 버림
    expect(parsePhraseInput({ src: 'order', phraseId: 'p1' })).toEqual({ src: 'order' });
  });

  it('읽기: state 없음·형식 틀림·잘못된 ID → null', () => {
    expect(parsePhraseInput(null)).toBeNull();
    expect(parsePhraseInput(undefined)).toBeNull();
    expect(parsePhraseInput('order')).toBeNull();
    expect(parsePhraseInput({ src: 'phrase' })).toBeNull();
    expect(parsePhraseInput(phraseInput('phrase', ''))).toBeNull();
    expect(parsePhraseInput({ src: 'phrase', phraseId: 'SSD-1' })).toBeNull();
    expect(parsePhraseInput({ src: 'phrase', phraseId: '튀김소보로 주세요' })).toBeNull();
    expect(parsePhraseInput({ src: 'phrase', phraseId: 42 })).toBeNull();
    expect(parsePhraseInput({ src: 'menu' })).toBeNull();
  });
});
