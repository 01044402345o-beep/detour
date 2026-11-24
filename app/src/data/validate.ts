/**
 * 코스 콘텐츠 JSON 검증 (T1.1, 코스 여러 개 — T5.1). 원도심(downtown.json)·중앙시장(market.json) 등 같은 형식.
 * 타입(app/src/types.ts)·필수 필드·L10n 3개 언어 누락·좌표 범위·교차 참조를 검사합니다.
 * JSON import는 리터럴 타입(예: counter)이 string으로 넓어지므로, 이 검증을 통과한 값만
 * 계약 타입으로 취급합니다.
 */
import { COURSE_THEMES, HUB_IDS, LANGS } from '../types';
import type { Course, HubId, MenuItem, Place } from '../types';

/** 데이터 전용 메모. 현장 미확인 항목은 '확인 필요'로 적습니다 (task.md T1.1). */
type WithNote = { note?: string };

export type ContentMenuItem = MenuItem & WithNote;
export type ContentPlace = Omit<Place, 'menu'> & WithNote & { menu?: ContentMenuItem[] };
export type ContentCourse = Omit<Course, 'start'> &
  WithNote & { start: Course['start'] & WithNote };
/** 코스 하나의 콘텐츠 묶음 (거점·코스·장소) */
export type ContentPack = {
  hub: HubId;
  note?: string;
  course: ContentCourse;
  places: ContentPlace[];
};
/** 이전 이름 (원도심 하나일 때) */
export type DowntownContent = ContentPack;

export type ValidationError = { path: string; message: string };

/** 대전 시내 대략 범위 (원도심 좌표 오입력 방지) */
export const DAEJEON_BOUNDS = { latMin: 36.2, latMax: 36.5, lngMin: 127.2, lngMax: 127.6 } as const;

const COUNTERS = ['개', '인분', '공기'] as const;
const ALLERGEN_STATUSES = ['confirmed', 'unknown'] as const;
const CATEGORIES = ['food', 'sight'] as const;
/** 'HH:MM–HH:MM' (en dash 또는 하이픈). 24:00은 마감 시각으로만 허용 */
const HOURS_RE = /^([01]\d|2[0-3]):[0-5]\d[–-](([01]\d|2[0-3]):[0-5]\d|24:00)$/;
/** 휴무 요일: 'mon' 또는 'sat,sun' 형식 */
const CLOSED_RE = /^(mon|tue|wed|thu|fri|sat|sun)(,(mon|tue|wed|thu|fri|sat|sun))*$/;
const PHRASES_PER_PLACE = { min: 3, max: 5 } as const;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function isValidIsoDate(v: unknown): boolean {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

class Checker {
  readonly errors: ValidationError[] = [];

  fail(path: string, message: string): void {
    this.errors.push({ path, message });
  }

  obj(v: unknown, path: string): v is Obj {
    if (!isObj(v)) {
      this.fail(path, '객체가 아님');
      return false;
    }
    return true;
  }

  str(o: Obj, key: string, path: string): void {
    if (!isNonEmptyStr(o[key])) this.fail(`${path}.${key}`, '빈 문자열 또는 누락');
  }

  optStr(o: Obj, key: string, path: string): void {
    if (key in o && !isNonEmptyStr(o[key])) this.fail(`${path}.${key}`, '빈 문자열');
  }

  bool(o: Obj, key: string, path: string): void {
    if (typeof o[key] !== 'boolean') this.fail(`${path}.${key}`, 'boolean 아님 또는 누락');
  }

  optBool(o: Obj, key: string, path: string): void {
    if (key in o && typeof o[key] !== 'boolean') this.fail(`${path}.${key}`, 'boolean 아님');
  }

  oneOf(o: Obj, key: string, allowed: readonly string[], path: string): void {
    if (typeof o[key] !== 'string' || !allowed.includes(o[key])) {
      this.fail(`${path}.${key}`, `허용값(${allowed.join('|')}) 아님`);
    }
  }

  /** 3개 언어(en·ja·zh) 모두 비어 있지 않은 문자열 */
  l10n(v: unknown, path: string): void {
    if (!this.obj(v, path)) return;
    for (const lang of LANGS) {
      if (!isNonEmptyStr(v[lang])) this.fail(`${path}.${lang}`, `L10n ${lang} 누락`);
    }
  }

  array(v: unknown, path: string, minLen = 1): v is unknown[] {
    if (!Array.isArray(v)) {
      this.fail(path, '배열 아님 또는 누락');
      return false;
    }
    if (v.length < minLen) this.fail(path, `항목이 ${minLen}개 미만`);
    return true;
  }

  nonNegInt(o: Obj, key: string, path: string): void {
    const v = o[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      this.fail(`${path}.${key}`, '0 이상 정수 아님');
    }
  }

  positiveNum(o: Obj, key: string, path: string): void {
    const v = o[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      this.fail(`${path}.${key}`, '양수 아님');
    }
  }
}

function checkMenuItem(c: Checker, m: unknown, path: string): void {
  if (!c.obj(m, path)) return;
  c.str(m, 'id', path);
  c.str(m, 'ko', path);
  c.l10n(m.name, `${path}.name`);
  c.str(m, 'roman', path);
  c.str(m, 'kana', path);
  c.oneOf(m, 'counter', COUNTERS, path);
  if ('priceKrw' in m) {
    const p = m.priceKrw;
    if (typeof p !== 'number' || !Number.isInteger(p) || p <= 0) {
      c.fail(`${path}.priceKrw`, '양의 정수 아님 (가격 미확인이면 필드를 생략)');
    }
  }
  if ('description' in m) c.l10n(m.description, `${path}.description`);
  c.optBool(m, 'signature', path);
  c.optBool(m, 'spicy', path);
  c.bool(m, 'verified', path);
  c.oneOf(m, 'allergenStatus', ALLERGEN_STATUSES, path);
  if ('allergens' in m) c.l10n(m.allergens, `${path}.allergens`);
  if (m.allergenStatus === 'confirmed' && !('allergens' in m)) {
    c.fail(`${path}.allergens`, "allergenStatus가 'confirmed'인데 allergens 없음");
  }
  c.optStr(m, 'note', path);
}

function checkPhrase(c: Checker, ph: unknown, path: string): void {
  if (!c.obj(ph, path)) return;
  c.str(ph, 'id', path);
  c.str(ph, 'ko', path);
  c.str(ph, 'roman', path);
  c.str(ph, 'kana', path);
  c.l10n(ph.meaning, `${path}.meaning`);
  if (!c.array(ph.words, `${path}.words`)) return;
  const kos: string[] = [];
  ph.words.forEach((w, i) => {
    const wp = `${path}.words[${i}]`;
    if (!c.obj(w, wp)) return;
    c.str(w, 'ko', wp);
    c.l10n(w.meaning, `${wp}.meaning`);
    if (typeof w.ko === 'string') kos.push(w.ko);
  });
  // 단어 칩을 이어 붙이면 문장이 되어야 함 (칩 누락·오타 방지)
  if (kos.length === ph.words.length && kos.join(' ') !== ph.ko) {
    c.fail(`${path}.words`, `단어 칩을 이은 "${kos.join(' ')}"가 문장 "${String(ph.ko)}"와 다름`);
  }
}

function checkGeo(c: Checker, g: unknown, path: string): void {
  if (!c.obj(g, path)) return;
  const { lat, lng } = g;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    c.fail(`${path}.lat`, '위도 범위(-90~90) 밖 또는 누락');
  } else if (lat < DAEJEON_BOUNDS.latMin || lat > DAEJEON_BOUNDS.latMax) {
    c.fail(`${path}.lat`, '대전 범위 밖');
  }
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    c.fail(`${path}.lng`, '경도 범위(-180~180) 밖 또는 누락');
  } else if (lng < DAEJEON_BOUNDS.lngMin || lng > DAEJEON_BOUNDS.lngMax) {
    c.fail(`${path}.lng`, '대전 범위 밖');
  }
}

function checkPlace(c: Checker, p: unknown, path: string): void {
  if (!c.obj(p, path)) return;
  c.str(p, 'id', path);
  c.nonNegInt(p, 'order', path);
  c.oneOf(p, 'category', CATEGORIES, path);
  c.str(p, 'nameKo', path);
  c.l10n(p.name, `${path}.name`);
  c.str(p, 'area', path);
  c.l10n(p.areaLocal, `${path}.areaLocal`);
  if (typeof p.hours !== 'string' || !HOURS_RE.test(p.hours)) {
    c.fail(`${path}.hours`, "'HH:MM–HH:MM' 형식 아님");
  }
  if ('closedOn' in p && (typeof p.closedOn !== 'string' || !CLOSED_RE.test(p.closedOn))) {
    c.fail(`${path}.closedOn`, "'mon' 또는 'sat,sun' 형식 아님");
  }
  if (!isValidIsoDate(p.checkedAt)) c.fail(`${path}.checkedAt`, "'YYYY-MM-DD' 날짜 아님");
  // 장소 현장 확인 여부 (메뉴 verified와 별개, T1.1b). false면 화면은 확인일 대신 '현장 확인 전' 표시
  c.bool(p, 'verified', path);
  c.nonNegInt(p, 'walkMinFromPrev', path);
  c.l10n(p.transitHint, `${path}.transitHint`);
  c.bool(p, 'orderable', path);
  c.bool(p, 'takeout', path);
  if (c.array(p.steps, `${path}.steps`)) {
    p.steps.forEach((s, i) => c.l10n(s, `${path}.steps[${i}]`));
  }
  if ('allergens' in p) c.l10n(p.allergens, `${path}.allergens`);

  if (p.orderable === true) {
    if (c.array(p.menu, `${path}.menu`)) {
      p.menu.forEach((m, i) => checkMenuItem(c, m, `${path}.menu[${i}]`));
      // 미확인 메뉴가 있는데 장소 알레르기 목록이 있으면 확정값처럼 보임 (T1.1 R1 M-1, PRD F-04)
      const hasUnknown = p.menu.some((m) => isObj(m) && m.allergenStatus === 'unknown');
      if (hasUnknown && 'allergens' in p) {
        c.fail(`${path}.allergens`, "allergenStatus 'unknown' 메뉴가 있는 장소에 allergens 있음");
      }
    }
  } else if (p.orderable === false) {
    if ('menu' in p) c.fail(`${path}.menu`, 'orderable:false 장소에 menu 있음');
    if (p.takeout === true) c.fail(`${path}.takeout`, 'orderable:false 장소는 takeout:false');
  }

  if (c.array(p.phrases, `${path}.phrases`, PHRASES_PER_PLACE.min)) {
    if (p.phrases.length > PHRASES_PER_PLACE.max) {
      c.fail(`${path}.phrases`, `문장이 ${PHRASES_PER_PLACE.max}개 초과`);
    }
    p.phrases.forEach((ph, i) => checkPhrase(c, ph, `${path}.phrases[${i}]`));
  }
  checkGeo(c, p.geo, `${path}.geo`);
  c.optStr(p, 'note', path);
}

function checkCourse(c: Checker, co: unknown, path: string): void {
  if (!c.obj(co, path)) return;
  c.str(co, 'id', path);
  if (!HUB_IDS.includes(co.hub as HubId)) c.fail(`${path}.hub`, `거점(${HUB_IDS.join('/')}) 아님`);
  if ('theme' in co && !COURSE_THEMES.includes(co.theme as never))
    c.fail(`${path}.theme`, `코스 종류(${COURSE_THEMES.join('/')}) 아님`);
  if ('events' in co && c.array(co.events, `${path}.events`)) {
    co.events.forEach((e, i) => checkEvent(c, e, `${path}.events[${i}]`));
    checkDuplicates(
      c,
      co.events
        .filter(isObj)
        .map((e) => e.id)
        .filter(isNonEmptyStr),
      `${path}.events`,
    );
  }
  c.l10n(co.title, `${path}.title`);
  if (c.obj(co.start, `${path}.start`)) {
    c.str(co.start, 'id', `${path}.start`);
    c.str(co.start, 'nameKo', `${path}.start`);
    c.l10n(co.start.name, `${path}.start.name`);
    checkGeo(c, co.start.geo, `${path}.start.geo`);
    if ('hint' in co.start) c.l10n(co.start.hint, `${path}.start.hint`);
    c.optStr(co.start, 'note', `${path}.start`);
  }
  if (c.array(co.stops, `${path}.stops`)) {
    co.stops.forEach((s, i) => {
      if (!isNonEmptyStr(s)) c.fail(`${path}.stops[${i}]`, '빈 문자열');
    });
  }
  c.positiveNum(co, 'distanceKm', path);
  c.positiveNum(co, 'durationMin', path);
  c.optStr(co, 'note', path);
}

function checkEvent(c: Checker, e: unknown, path: string): void {
  if (!c.obj(e, path)) return;
  c.str(e, 'id', path);
  c.str(e, 'nameKo', path);
  c.l10n(e.name, `${path}.name`);
  c.l10n(e.where, `${path}.where`);
  c.l10n(e.description, `${path}.description`);
  if (!isValidIsoDate(e.startDate)) c.fail(`${path}.startDate`, "'YYYY-MM-DD' 날짜 아님");
  if (!isValidIsoDate(e.endDate)) c.fail(`${path}.endDate`, "'YYYY-MM-DD' 날짜 아님");
  if (
    isValidIsoDate(e.startDate) &&
    isValidIsoDate(e.endDate) &&
    String(e.startDate) > String(e.endDate)
  )
    c.fail(`${path}.endDate`, '시작일보다 이름');
  if (typeof e.days !== 'string' || !CLOSED_RE.test(e.days))
    c.fail(`${path}.days`, "'fri,sat' 형식 아님");
  if (typeof e.hours !== 'string' || !HOURS_RE.test(e.hours)) {
    c.fail(`${path}.hours`, "'HH:MM–HH:MM' 형식 아님");
  } else {
    // 시즌 상태 계산은 같은 날 안에서 열고 닫는 행사만 지원 (자정 넘김 미지원, R1 L-3)
    const [open, close] = e.hours.split(/[–-]/);
    if (close <= open)
      c.fail(`${path}.hours`, '자정을 넘기는 행사 시간은 지원하지 않음 (끝 > 시작)');
  }
  c.str(e, 'source', path);
  if (!isValidIsoDate(e.checkedAt)) c.fail(`${path}.checkedAt`, "'YYYY-MM-DD' 날짜 아님");
  if (typeof e.verified !== 'boolean') c.fail(`${path}.verified`, 'boolean 아님');
  c.optStr(e, 'note', path);
}

function checkDuplicates(c: Checker, ids: string[], path: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) c.fail(path, `id 중복: ${id}`);
    seen.add(id);
  }
}

/** 오류 목록을 반환합니다. 빈 배열이면 통과. */
export function validateContent(input: unknown): ValidationError[] {
  const c = new Checker();
  if (!c.obj(input, '$')) return c.errors;
  if (!HUB_IDS.includes(input.hub as HubId)) c.fail('$.hub', `거점(${HUB_IDS.join('/')}) 아님`);
  if (isObj(input.course) && input.course.hub !== input.hub)
    c.fail('$.course.hub', '묶음 거점($.hub)과 다름');
  c.optStr(input, 'note', '$');
  checkCourse(c, input.course, '$.course');
  if (!c.array(input.places, '$.places')) return c.errors;
  input.places.forEach((p, i) => checkPlace(c, p, `$.places[${i}]`));

  // 교차 검사 (구조가 객체인 항목만)
  const places = input.places.filter(isObj);
  const placeIds = places.map((p) => p.id).filter(isNonEmptyStr);
  checkDuplicates(c, placeIds, '$.places');
  const menuIds = places.flatMap((p) =>
    Array.isArray(p.menu) ? p.menu.filter(isObj).map((m) => m.id) : [],
  );
  checkDuplicates(c, menuIds.filter(isNonEmptyStr), '$.places[*].menu');
  const phraseIds = places.flatMap((p) =>
    Array.isArray(p.phrases) ? p.phrases.filter(isObj).map((ph) => ph.id) : [],
  );
  checkDuplicates(c, phraseIds.filter(isNonEmptyStr), '$.places[*].phrases');

  // order는 1부터 연속, course.stops는 order 순서의 장소 id와 같아야 함
  const sorted = [...places].sort((a, b) => Number(a.order) - Number(b.order));
  sorted.forEach((p, i) => {
    if (p.order !== i + 1) c.fail(`$.places(${String(p.id)}).order`, `${i + 1}이어야 함`);
  });
  if (isObj(input.course) && Array.isArray(input.course.stops)) {
    const expected = sorted.map((p) => p.id);
    const stops = input.course.stops;
    if (stops.length !== expected.length || stops.some((s, i) => s !== expected[i])) {
      c.fail('$.course.stops', `장소 order 순서(${expected.join(',')})와 다름`);
    }
  }
  return c.errors;
}

export function isDowntownContent(input: unknown): input is DowntownContent {
  return validateContent(input).length === 0;
}

/** 검증을 통과하면 계약 타입으로 반환하고, 아니면 오류 목록과 함께 throw */
export function parseContent(input: unknown): ContentPack {
  const errors = validateContent(input);
  if (errors.length > 0) {
    const lines = errors.map((e) => `- ${e.path}: ${e.message}`).join('\n');
    throw new Error(`콘텐츠 검증 실패 (${errors.length}건)\n${lines}`);
  }
  return input as ContentPack;
}
