import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { LANGS } from '../types';
import en from './en.json';
import ja from './ja.json';
import zh from './zh.json';
import { DEFAULT_LANG, DICTS, placeholders, t, useLang, useT, type MessageKey } from './index';
import { STAFF_KO, STAFF_REPLY_KEYS } from './staffKo';

/** 중첩 객체 → { 'a.b': value } */
function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const flat = { en: flatten(en), ja: flatten(ja), zh: flatten(zh) };
const enKeys = Object.keys(flat.en).sort();

describe('사전 키 집합', () => {
  it('en·ja·zh 세 파일의 키 집합이 같다', () => {
    expect(Object.keys(flat.ja).sort()).toEqual(enKeys);
    expect(Object.keys(flat.zh).sort()).toEqual(enKeys);
  });

  it('모든 값이 비어 있지 않은 문자열이다', () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(flat[lang])) {
        expect(typeof value, `${lang}:${key}`).toBe('string');
        expect((value as string).trim(), `${lang}:${key}`).not.toBe('');
      }
    }
  });

  it('ja·zh에 영어 fallback이 없다 (en과 같은 값 없음)', () => {
    for (const lang of ['ja', 'zh'] as const) {
      const same = enKeys.filter((k) => flat[lang][k] === flat.en[k]);
      expect(same, lang).toEqual([]);
    }
  });

  it('ja·zh 값에 각 언어 문자가 들어 있다', () => {
    const kanaOrKanji = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
    const han = /\p{Script=Han}/u;
    for (const k of enKeys) {
      expect(flat.ja[k] as string, `ja:${k}`).toMatch(kanaOrKanji);
      expect(flat.zh[k] as string, `zh:${k}`).toMatch(han);
    }
  });

  it('자리표시자 집합이 세 언어에서 같다', () => {
    for (const k of enKeys) {
      const base = placeholders(flat.en[k] as string).sort();
      expect(placeholders(flat.ja[k] as string).sort(), `ja:${k}`).toEqual(base);
      expect(placeholders(flat.zh[k] as string).sort(), `zh:${k}`).toEqual(base);
    }
  });

  it('PRD 고지 문구가 사전에 있다 (비제휴·음성 처리·가격/총액 확인·인식 실패·인식 일치도)', () => {
    const required: MessageKey[] = [
      'place.disclaimer',
      'practice.voiceNotice',
      'menu.priceTbd',
      'menu.totalTbd',
      'stt.failTitle',
      'stt.noSpeech',
      'stt.denied',
      'stt.unsupported',
      'stt.empty',
      'result.match',
      'result.matchNote',
      'place.allergyUnknown',
      'settings.privacy',
    ];
    for (const k of required) expect(enKeys).toContain(k);
    expect(t('en', 'result.match')).toBe('Recognition match');
    expect(t('en', 'place.disclaimer')).toMatch(/not affiliated/);
    expect(t('en', 'practice.voiceNotice')).toMatch(/does not save your voice/);
  });

  it('privacy 문구는 "음성 저장 안 함 + 이용 기록은 이 기기에만" 취지다 (PRD F-08·7장)', () => {
    expect(t('en', 'settings.privacy')).toMatch(/voice is never saved/i);
    expect(t('en', 'settings.privacy')).toMatch(/only on this device/i);
    expect(t('ja', 'settings.privacy')).toMatch(/音声は保存しません.*この端末にのみ/);
    expect(t('zh', 'settings.privacy')).toMatch(/不会保存语音.*只保存在本机/);
  });

  it('직원 응답 키가 모두 사전에 있다', () => {
    for (const { title, body } of Object.values(STAFF_REPLY_KEYS)) {
      expect(enKeys).toContain(title);
      expect(enKeys).toContain(body);
    }
    expect(Object.keys(STAFF_REPLY_KEYS).sort()).toEqual(Object.keys(STAFF_KO.replies).sort());
  });
});

describe('t()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('언어별 값을 돌려준다', () => {
    expect(t('en', 'nav.course')).toBe('Course');
    expect(t('ja', 'nav.course')).toBe('コース');
    expect(t('zh', 'nav.course')).toBe('路线');
  });

  it('자리표시자를 채운다', () => {
    expect(t('en', 'course.stopOf', { n: 2, total: 4 })).toBe('STOP 2 OF 4');
    expect(t('ja', 'course.stopOf', { n: 2, total: 4 })).toBe('4か所中 2か所目');
    expect(t('zh', 'result.tip', { word: '주세요' })).toBe(
      '“주세요”不太一致,请一个音一个音慢慢说。',
    );
  });

  it('없는 키는 키를 돌려주고 개발 모드에서 경고한다 (영어로 대신 채우지 않음)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('ja', 'no.such' as MessageKey)).toBe('no.such');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing key "no.such"'));
  });

  it('객체 경로(잎이 아닌 키)도 없는 키로 처리한다', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('en', 'home' as MessageKey)).toBe('home');
  });

  it('빠진 params는 자리표시자를 남기고 경고한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('en', 'course.stopOf', { n: 1 })).toBe('STOP 1 OF {total}');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing param "total"'));
  });

  it('params를 통째로 빠뜨려도 자리표시자를 남기고 경고한다 (R1 L-1)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('ja', 'menu.items')).toBe('{count}点');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing param "count"'));
  });

  it('자리표시자가 없는 키는 params 없이 불러도 경고하지 않는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('en', 'nav.saved')).toBe('Saved');
    expect(warn).not.toHaveBeenCalled();
  });

  it('세 사전에 operator 키가 없다 (S13은 operatorKo.ts 한국어 고정, R1 M-1)', () => {
    for (const lang of LANGS) {
      expect(Object.keys(DICTS[lang])).not.toContain('operator');
    }
  });

  it('확인 전 표시 키 place.unverified가 세 언어에 있다 (T1.1b 연결)', () => {
    expect(t('en', 'place.unverified')).toBe('Not yet verified on site · sample info');
    expect(t('ja', 'place.unverified')).toBe('現地確認前・参考情報');
    expect(t('zh', 'place.unverified')).toBe('尚未实地确认·示例信息');
  });

  it('직원 "네" 응답 본문은 주문·일반 요청 공용 문구다 (R1 L-2)', () => {
    expect(t('en', 'reply.yesBody')).toBe('The staff understood you.');
    expect(t('ja', 'reply.yesBody')).toBe('スタッフに伝わりました。');
    for (const lang of LANGS) {
      expect(t(lang, 'reply.yesBody')).not.toMatch(/order|注文|点单/i);
    }
  });

  it('DICTS가 세 언어를 모두 갖는다', () => {
    expect(Object.keys(DICTS).sort()).toEqual([...LANGS].sort());
  });
});

describe('useT() / useLang()', () => {
  afterEach(() => act(() => useAppStore.setState({ lang: null })));

  it('lang 미선택이면 DEFAULT_LANG(en)을 쓴다', () => {
    useAppStore.setState({ lang: null });
    const { result } = renderHook(() => ({ tr: useT(), lang: useLang() }));
    expect(result.current.lang).toBe(DEFAULT_LANG);
    expect(result.current.tr('settings.title')).toBe('Settings');
  });

  it('store lang이 바뀌면 문구가 바뀐다', () => {
    const { result } = renderHook(() => useT());
    act(() => useAppStore.getState().setLang('ja'));
    expect(result.current('settings.title')).toBe('設定');
    act(() => useAppStore.getState().setLang('zh'));
    expect(result.current('menu.items', { count: 3 })).toBe('3件');
  });
});
