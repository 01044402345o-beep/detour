import raw from './downtown.json';
import { validateContent, parseContent, isDowntownContent } from './validate';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const fresh = (): Json => structuredClone(raw) as Json;
const paths = (data: unknown) => validateContent(data).map((e) => e.path);

describe('downtown.json 검증', () => {
  it('실제 데이터는 오류 0건', () => {
    expect(validateContent(raw)).toEqual([]);
    expect(isDowntownContent(raw)).toBe(true);
  });

  it('코스 1, 장소 4, 메뉴 8, 문장 14', () => {
    const c = parseContent(raw);
    expect(c.course.stops).toHaveLength(4);
    expect(c.places).toHaveLength(4);
    expect(c.places.flatMap((p) => p.menu ?? [])).toHaveLength(8);
    expect(c.places.flatMap((p) => p.phrases)).toHaveLength(14);
  });
});

describe('PRD 4장·목업과 내용 일치', () => {
  const c = parseContent(raw);
  const byId = Object.fromEntries(c.places.map((p) => [p.id, p]));

  it('코스 순서·분류·주문 가능·도보 시간', () => {
    expect(c.course.title.en).toBe('Old Downtown Half-day');
    expect(c.course.distanceKm).toBe(2);
    expect(c.course.durationMin).toBe(180);
    expect(
      c.places.map((p) => [p.order, p.nameKo, p.category, p.orderable, p.walkMinFromPrev]),
    ).toEqual([
      [1, '성심당 본점', 'food', true, 5],
      [2, '으능정이 문화의거리', 'sight', false, 2],
      [3, '대전근현대사전시관', 'sight', false, 12],
      [4, '광천식당', 'food', true, 10],
    ]);
    expect(byId.ssd.takeout).toBe(true);
    expect(byId.gwc.takeout).toBe(false);
  });

  it('메뉴명·단위·예시가 (미확인 가격은 priceKrw 생략)', () => {
    const rows = c.places.flatMap((p) =>
      (p.menu ?? []).map((m) => [m.ko, m.name.en, m.counter, m.priceKrw]),
    );
    expect(rows).toEqual([
      ['튀김소보로', 'Fried Soboro', '개', 1700],
      ['판타롱부추빵', 'Pantarong Chive Bread', '개', 2000],
      ['명란바게트', 'Pollock Roe Baguette', '개', 3500],
      ['보문산메아리', 'Bomunsan Meari (layered bread)', '개', undefined],
      ['두부두루치기', 'Spicy Braised Tofu', '인분', 8000],
      ['오징어두루치기', 'Spicy Braised Squid', '인분', undefined],
      ['칼국수 사리', 'Noodle add-on', '개', 1000],
      // PRD 4.1: 공기밥 단위는 '공기' (목업 '개'보다 PRD 우선)
      ['공기밥', 'Bowl of rice', '공기', 1000],
    ]);
    const all = c.places.flatMap((p) => p.menu ?? []);
    expect(all.filter((m) => !('priceKrw' in m)).map((m) => m.id)).toEqual(['bm', 'od']);
    expect(all.filter((m) => m.signature).map((m) => m.ko)).toEqual(['튀김소보로', '두부두루치기']);
    expect(all.filter((m) => m.spicy).map((m) => m.ko)).toEqual(['두부두루치기', '오징어두루치기']);
  });

  it('areaLocal·메뉴 description (목업 area·ds 값)', () => {
    expect(c.places.map((p) => p.areaLocal.en)).toEqual([
      'Eunhaeng-dong',
      'Sky Road LED canopy',
      'Old Chungnam Provincial Office',
      'Seonhwa-dong',
    ]);
    expect(byId.gwc.areaLocal).toEqual({ en: 'Seonhwa-dong', ja: '宣化洞', zh: '宣化洞' });
    const all = c.places.flatMap((p) => p.menu ?? []);
    expect(all.every((m) => m.description !== undefined)).toBe(true);
    expect(byId.ssd.menu?.[0].description).toEqual({
      en: 'Crispy fried crumble bun, red bean filling',
      ja: 'あんこ入りのサクサク揚げパン',
      zh: '红豆馅酥脆炸面包',
    });
    expect(all.find((m) => m.id === 'gb')?.description?.en).toBe('Steamed rice');
  });

  it('현장 확인 전: 메뉴 verified:false, 알레르기 unknown, 장소 allergens 없음', () => {
    for (const m of c.places.flatMap((p) => p.menu ?? [])) {
      expect(m.verified).toBe(false);
      expect(m.allergenStatus).toBe('unknown');
    }
    // R1 M-1: 미확인 알레르기를 확정 목록처럼 두지 않음
    expect('allergens' in byId.ssd).toBe(false);
    expect('allergens' in byId.gwc).toBe(false);
  });

  it('발음 표기·영문 이름 (R1 L-1·L-2)', () => {
    const mr = byId.ssd.menu?.find((m) => m.id === 'mr');
    expect(mr?.roman).toBe('myeongnan bageteu');
    expect(byId.gwc.phrases.find((ph) => ph.id === 'gwc-4')?.kana).toBe('ケサンハルケヨ');
    expect(byId.eun.name.en).toBe('Euneungjeongi Culture Street');
    expect(byId.mus.transitHint.en).toBe('About 12 min walk from Euneungjeongi Culture Street');
  });

  it('PRD 4.2 장소별 문장', () => {
    expect(c.places.map((p) => p.phrases.map((ph) => ph.ko))).toEqual([
      ['이거 하나 주세요', '포장해 주세요', '카드 돼요?', '봉투 주세요'],
      ['사진 좀 찍어 주시겠어요?', '화장실 어디예요?', '공연 몇 시에 해요?'],
      ['입장료 있어요?', '사진 찍어도 돼요?', '외국어 안내 있어요?'],
      ['두 명이에요', '덜 맵게 해 주세요', '물 좀 주세요', '계산할게요'],
    ]);
  });

  it('광천식당 주소·사리 명칭은 note에 "확인 필요"', () => {
    expect(byId.gwc.note).toContain('대종로505번길 29');
    expect(byId.gwc.note).toContain('확인 필요');
    const sari = byId.gwc.menu?.find((m) => m.id === 'sr');
    expect(sari?.note).toMatch(/칼국수\/우동.*확인 필요/);
  });

  it('확인일은 YYYY-MM-DD', () => {
    for (const p of c.places) expect(p.checkedAt).toBe('2026-11-10');
  });

  it('T1.1b: 4곳 모두 장소 verified:false (현장 확인 전)', () => {
    expect(c.places.map((p) => [p.id, p.verified])).toEqual([
      ['ssd', false],
      ['eun', false],
      ['mus', false],
      ['gwc', false],
    ]);
  });
});

describe('validateContent 오류 검출', () => {
  it('객체가 아니면 오류', () => {
    expect(paths(null)).toEqual(['$']);
    expect(paths([])).toEqual(['$']);
  });

  it('L10n 언어 누락·빈 문자열', () => {
    const d = fresh();
    delete d.places[0].name.ja;
    d.places[1].phrases[0].meaning.zh = '  ';
    d.places[3].menu[0].name.en = '';
    d.course.title = { en: 'x', ja: 'y' };
    expect(paths(d)).toEqual(
      expect.arrayContaining([
        '$.course.title.zh',
        '$.places[0].name.ja',
        '$.places[1].phrases[0].meaning.zh',
        '$.places[3].menu[0].name.en',
      ]),
    );
  });

  it('areaLocal 누락·언어 누락, description 언어 누락', () => {
    const d = fresh();
    delete d.places[0].areaLocal;
    delete d.places[1].areaLocal.ja;
    d.places[3].menu[2].description.zh = '';
    expect(paths(d)).toEqual(
      expect.arrayContaining([
        '$.places[0].areaLocal',
        '$.places[1].areaLocal.ja',
        '$.places[3].menu[2].description.zh',
      ]),
    );
    const ok = fresh();
    delete ok.places[0].menu[0].description; // description은 선택 필드
    expect(validateContent(ok)).toEqual([]);
  });

  it('단어 칩 뜻의 언어 누락', () => {
    const d = fresh();
    delete d.places[2].phrases[1].words[0].meaning.en;
    expect(paths(d)).toContain('$.places[2].phrases[1].words[0].meaning.en');
  });

  it('필수 필드 누락', () => {
    const d = fresh();
    delete d.places[0].nameKo;
    delete d.places[0].geo;
    delete d.places[0].menu[0].verified;
    delete d.places[0].menu[0].allergenStatus;
    delete d.places[1].phrases[0].kana;
    expect(paths(d)).toEqual(
      expect.arrayContaining([
        '$.places[0].nameKo',
        '$.places[0].geo',
        '$.places[0].menu[0].verified',
        '$.places[0].menu[0].allergenStatus',
        '$.places[1].phrases[0].kana',
      ]),
    );
  });

  it('T1.1b: 장소 verified 누락·boolean 아님은 오류, 메뉴 verified와 별개로 검사', () => {
    const d = fresh();
    delete d.places[1].verified; // 메뉴 없는 장소도 필수
    d.places[2].verified = 'false';
    d.places[3].verified = null;
    expect(paths(d)).toEqual([
      '$.places[1].verified',
      '$.places[2].verified',
      '$.places[3].verified',
    ]);

    const menuOnly = fresh();
    delete menuOnly.places[0].menu[0].verified;
    expect(paths(menuOnly)).toEqual(['$.places[0].menu[0].verified']);

    const ok = fresh();
    ok.places[0].verified = true;
    expect(validateContent(ok)).toEqual([]);
  });

  it('허용값 밖 (counter·category·allergenStatus)', () => {
    const d = fresh();
    d.places[0].menu[0].counter = '그릇';
    d.places[0].category = 'shop';
    d.places[3].menu[1].allergenStatus = 'maybe';
    expect(paths(d)).toEqual(
      expect.arrayContaining([
        '$.places[0].menu[0].counter',
        '$.places[0].category',
        '$.places[3].menu[1].allergenStatus',
      ]),
    );
  });

  it('가격: null·0·소수는 오류 (미확인이면 생략)', () => {
    for (const bad of [null, 0, -100, 1200.5, '1700']) {
      const d = fresh();
      d.places[0].menu[0].priceKrw = bad;
      expect(paths(d)).toContain('$.places[0].menu[0].priceKrw');
    }
  });

  it("allergenStatus 'confirmed'면 allergens 필수", () => {
    const d = fresh();
    d.places[0].menu[0].allergenStatus = 'confirmed';
    expect(paths(d)).toContain('$.places[0].menu[0].allergens');
    d.places[0].menu[0].allergens = { en: 'Wheat', ja: '小麦', zh: '小麦' };
    expect(paths(d)).toEqual([]);
  });

  it('unknown 메뉴가 있는 장소에 allergens 있으면 오류, 메뉴 없는 장소는 예외', () => {
    const L = { en: 'Wheat', ja: '小麦', zh: '小麦' };
    const d = fresh();
    d.places[0].allergens = L;
    d.places[1].allergens = L; // 으능정이: orderable:false, 메뉴 없음
    expect(paths(d)).toEqual(['$.places[0].allergens']);

    // 메뉴가 모두 confirmed면 장소 allergens 허용
    const ok = fresh();
    ok.places[0].allergens = L;
    for (const m of ok.places[0].menu) {
      m.allergenStatus = 'confirmed';
      m.allergens = L;
    }
    expect(validateContent(ok)).toEqual([]);
  });

  it('좌표 범위: 전 지구 범위·대전 범위', () => {
    const d = fresh();
    d.places[0].geo.lat = 91;
    d.places[1].geo.lng = -181;
    d.places[2].geo = { lat: 37.5665, lng: 126.978 }; // 서울
    d.places[3].geo.lat = '36.33';
    const errs = validateContent(d);
    const msg = (p: string) => errs.find((e) => e.path === p)?.message;
    expect(msg('$.places[0].geo.lat')).toMatch(/-90~90/);
    expect(msg('$.places[1].geo.lng')).toMatch(/-180~180/);
    expect(msg('$.places[2].geo.lat')).toBe('대전 범위 밖');
    expect(msg('$.places[2].geo.lng')).toBe('대전 범위 밖');
    expect(msg('$.places[3].geo.lat')).toMatch(/누락/);
  });

  it('확인일·영업시간·휴무일 형식', () => {
    const d = fresh();
    d.places[0].checkedAt = '2026.11.10';
    d.places[1].checkedAt = '2026-02-30';
    d.places[2].hours = '10시~18시';
    d.places[2].closedOn = 'Monday';
    expect(paths(d)).toEqual(
      expect.arrayContaining([
        '$.places[0].checkedAt',
        '$.places[1].checkedAt',
        '$.places[2].hours',
        '$.places[2].closedOn',
      ]),
    );
  });

  it('단어 칩을 이은 결과가 문장과 다르면 오류', () => {
    const d = fresh();
    d.places[0].phrases[0].words.pop();
    expect(paths(d)).toContain('$.places[0].phrases[0].words');
  });

  it('orderable 규칙: 주문 가능 장소는 메뉴 필수, 불가 장소는 메뉴·포장 없음', () => {
    const d = fresh();
    delete d.places[0].menu;
    d.places[1].menu = [];
    d.places[2].takeout = true;
    expect(paths(d)).toEqual(
      expect.arrayContaining(['$.places[0].menu', '$.places[1].menu', '$.places[2].takeout']),
    );
  });

  it('장소별 문장 3~5개', () => {
    const d = fresh();
    d.places[1].phrases = d.places[1].phrases.slice(0, 2);
    d.places[0].phrases.push(...structuredClone(d.places[0].phrases.slice(0, 2)));
    const errs = validateContent(d);
    expect(errs.map((e) => e.path)).toContain('$.places[1].phrases');
    expect(errs.find((e) => e.path === '$.places[0].phrases')?.message).toMatch(/초과/);
  });

  it('id 중복·order 불연속·course.stops 불일치', () => {
    const d = fresh();
    d.places[3].menu[0].id = 'tw';
    d.places[2].phrases[0].id = 'ssd-1';
    d.places[1].order = 5;
    d.course.stops = ['ssd', 'mus', 'eun', 'gwc'];
    const errs = validateContent(d);
    expect(errs.map((e) => e.message)).toEqual(
      expect.arrayContaining(['id 중복: tw', 'id 중복: ssd-1']),
    );
    expect(errs.map((e) => e.path)).toEqual(
      expect.arrayContaining(['$.course.stops', '$.places(eun).order']),
    );
  });

  it('note는 있으면 비어 있지 않아야 함', () => {
    const d = fresh();
    d.places[3].note = '';
    expect(paths(d)).toContain('$.places[3].note');
  });

  it('parseContent는 오류 목록과 함께 throw', () => {
    const d = fresh();
    delete d.places[0].name.zh;
    expect(() => parseContent(d)).toThrow(/\$\.places\[0\]\.name\.zh: L10n zh 누락/);
  });
});
