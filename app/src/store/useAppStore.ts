import { create } from 'zustand';
import { persist, type PersistStorage, type StateStorage } from 'zustand/middleware';
import { LANGS, type Lang, type Place } from '../types';
import {
  MAX_EVENTS,
  REPORT_KINDS,
  appendEvent,
  isValidId,
  toAppEvent,
  type AppEvent,
  type AppEventInput,
  type ReportKind,
} from '../domain/events';
import { createSafeStorage } from './safeStorage';

/** 수량 범위 (PRD F-05·F-06: 1~9, 0이면 항목 삭제) */
export const MAX_QTY = 9;

export const STORAGE_KEY = 'detour-app';
export const STORAGE_VERSION = 1;

/** `{ placeId: { menuId: 수량 } }` */
export type Cart = Record<string, Record<string, number>>;

/** 장소 전환·포장 판단에 필요한 장소 정보 */
export type PlaceRef = Pick<Place, 'id' | 'takeout'>;

export type Saved = { places: string[]; phrases: string[] };

/** 제보 (F-14). 자유 입력은 받지 않습니다. */
export type Report = { kind: ReportKind; placeId?: string; t: number };

/** lang 슬라이스 (공유 계약, T0.2) */
export type LangSlice = {
  /** 첫 실행 전에는 null → 언어 선택 화면 (F-01) */
  lang: Lang | null;
  setLang: (lang: Lang) => void;
};

export type OrderSlice = {
  cart: Cart;
  /** 지금 주문 중인 장소 */
  currentPlaceId: string | null;
  /** 포장 선택. `takeout:false` 장소에서는 항상 false (F-05) */
  takeout: boolean;
  /** 확인을 기다리는 장소 전환 (저장하지 않음) */
  pendingPlace: PlaceRef | null;
  /**
   * 장소 전환. 다른 장소의 주문이 남아 있으면 바꾸지 않고 `needsConfirm:true`를 돌려주며
   * `pendingPlace`에 대상을 둡니다 → `confirmSwitchPlace()` / `cancelSwitchPlace()`.
   */
  switchPlace: (place: PlaceRef) => { needsConfirm: boolean };
  /** 기존 주문을 비우고 대기 중인 장소로 전환 */
  confirmSwitchPlace: () => void;
  cancelSwitchPlace: () => void;
  /** 현재 장소의 수량 설정 (0 이하 → 삭제, 9 초과 → 9). 현재 장소가 아니면 무시하고 false */
  setQty: (placeId: string, menuId: string, qty: number) => boolean;
  increment: (placeId: string, menuId: string) => boolean;
  /** 1에서 −를 누르면 항목 삭제 */
  decrement: (placeId: string, menuId: string) => boolean;
  clearCart: () => void;
  /**
   * 포장 선택. 현재 장소가 아니면(확인 대기 중 포함) 무시하고 false.
   * `takeout:false` 장소면 true를 넣어도 false로 고정
   */
  setTakeout: (place: PlaceRef, value: boolean) => boolean;
};

export type SavedSlice = {
  saved: Saved;
  toggleSavedPlace: (placeId: string) => boolean;
  toggleSavedPhrase: (phraseId: string) => boolean;
};

export type RecordSlice = {
  reports: Report[];
  events: AppEvent[];
  /**
   * 기록. 허용 필드만 남기고(인식 원문 등 제거), 형식이 틀리면 버립니다(throw 없음).
   * 기록하면 true, 버리면 false (R2-L01)
   */
  logEvent: (event: AppEventInput) => boolean;
  /** 제보 저장 + `report_sent` 이벤트 기록. placeId 형식이 틀리면 생략 */
  addReport: (kind: ReportKind, placeId?: string) => void;
  /** 이용 기록만 비우기 */
  clearEvents: () => void;
  /** 데모 데이터 초기화: 주문·저장·제보·기록·고른 행선지를 비웁니다. 언어는 유지 */
  resetData: () => void;
  /**
   * 코스 화면에서 고른 행선지 (코스 id → 정류장 id, T6.13). 저장하지 않음(새로 열면 다음 정류장부터).
   * 장소 상세를 보고 돌아와도 유지되고(R1 M-01), 데모 초기화로 비워집니다(R2 M-01).
   */
  walkPicks: Record<string, string>;
  setWalkPick: (courseId: string, placeId: string) => void;
};

export type AppState = LangSlice & OrderSlice & SavedSlice & RecordSlice;

/** 저장소에 남기는 값 */
export type PersistedState = Pick<
  AppState,
  'lang' | 'cart' | 'currentPlaceId' | 'takeout' | 'saved' | 'reports' | 'events'
>;

// ───────── 순수 헬퍼 ─────────

/** 장소의 담은 수량 합계 */
export function cartCount(cart: Cart, placeId: string | null): number {
  if (!placeId) return 0;
  return Object.values(cart[placeId] ?? {}).reduce((a, n) => a + n, 0);
}

/** 문장 생성에 넘길 포장 여부. `takeout:false` 장소는 항상 false (F-05) */
export function effectiveTakeout(takeout: boolean, place: PlaceRef | null | undefined): boolean {
  return !!place?.takeout && takeout;
}

function clampQty(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_QTY, Math.trunc(n)));
}

function emptyData(): Omit<PersistedState, 'lang'> {
  return {
    cart: {},
    currentPlaceId: null,
    takeout: false,
    saved: { places: [], phrases: [] },
    reports: [],
    events: [],
  };
}

function toggle(list: string[], id: string): [string[], boolean] {
  return list.includes(id) ? [list.filter((x) => x !== id), false] : [[...list, id], true];
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** 저장소 값이 손상돼도 앱이 깨지지 않도록 모양을 검사해 걸러냅니다. */
export function sanitizePersisted(raw: unknown): Partial<PersistedState> {
  if (!isObj(raw)) return {};
  const out: Partial<PersistedState> = {};
  if (LANGS.includes(raw.lang as Lang)) out.lang = raw.lang as Lang;
  if (isObj(raw.cart)) {
    const cart: Cart = {};
    for (const [pid, items] of Object.entries(raw.cart)) {
      if (!isValidId(pid) || !isObj(items)) continue;
      const clean: Record<string, number> = {};
      for (const [mid, n] of Object.entries(items)) {
        if (!isValidId(mid)) continue;
        const q = typeof n === 'number' ? clampQty(n) : 0;
        if (q > 0) clean[mid] = q;
      }
      if (Object.keys(clean).length) cart[pid] = clean;
    }
    out.cart = cart;
  }
  if (raw.currentPlaceId === null || isValidId(raw.currentPlaceId)) {
    out.currentPlaceId = raw.currentPlaceId;
  }
  if (typeof raw.takeout === 'boolean') out.takeout = raw.takeout;
  if (isObj(raw.saved)) {
    out.saved = {
      places: Array.isArray(raw.saved.places) ? raw.saved.places.filter(isStr) : [],
      phrases: Array.isArray(raw.saved.phrases) ? raw.saved.phrases.filter(isStr) : [],
    };
  }
  if (Array.isArray(raw.reports)) {
    // 허용 필드만으로 새 객체를 만듭니다 (추가 필드 제거, R1 M-01)
    out.reports = raw.reports.flatMap((r): Report[] => {
      if (!isObj(r) || !REPORT_KINDS.includes(r.kind as ReportKind)) return [];
      if (typeof r.t !== 'number' || !Number.isFinite(r.t)) return [];
      if (r.placeId === undefined) return [{ kind: r.kind as ReportKind, t: r.t }];
      return isValidId(r.placeId)
        ? [{ kind: r.kind as ReportKind, placeId: r.placeId, t: r.t }]
        : [];
    });
  }
  if (Array.isArray(raw.events)) {
    out.events = raw.events
      .map(toAppEvent)
      .filter((e): e is AppEvent => e !== null)
      .slice(-MAX_EVENTS);
  }
  return restoreSingleOrder(out);
}

/**
 * 단일 활성 주문 불변식 복구 (R1 M-06). 정상 persist로는 깨지지 않고 손상 저장값에서만 필요합니다.
 * - currentPlaceId가 있으면 그 장소의 주문만 남깁니다.
 * - 없고 주문이 남은 장소가 정확히 하나면 그 장소를 현재 장소로 복구합니다.
 * - 없고 둘 이상이면 어느 주문이 맞는지 알 수 없으므로 모두 비웁니다.
 * 복원된 takeout은 장소 정보가 없어 그대로 두며, 문장 생성 시 effectiveTakeout이 막습니다.
 */
function restoreSingleOrder(out: Partial<PersistedState>): Partial<PersistedState> {
  if (!out.cart) return out;
  const cur = out.currentPlaceId;
  if (typeof cur === 'string') {
    out.cart = out.cart[cur] ? { [cur]: out.cart[cur] } : {};
    return out;
  }
  const filled = Object.keys(out.cart);
  if (filled.length === 1) out.currentPlaceId = filled[0];
  else if (filled.length > 1) out.cart = {};
  return out;
}

/** JSON 직렬화 + 파싱 실패 시 빈 값으로 처리하는 persist 저장소 */
function jsonStorage(base: StateStorage<unknown>): PersistStorage<PersistedState> {
  return {
    getItem(name) {
      const s = base.getItem(name);
      if (typeof s !== 'string') return null;
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => base.setItem(name, JSON.stringify(value)),
    removeItem: (name) => base.removeItem(name),
  };
}

export type AppStoreDeps = {
  /** 기본: localStorage (실패 시 메모리로 대체) */
  storage?: StateStorage<unknown>;
  /** 기본: Date.now */
  now?: () => number;
};

export function createAppStore({
  storage = createSafeStorage(),
  now = Date.now,
}: AppStoreDeps = {}) {
  return create<AppState>()(
    persist(
      (set, get) => {
        const canEdit = (placeId: string) => get().currentPlaceId === placeId;
        const writeQty = (placeId: string, menuId: string, qty: number) => {
          if (!canEdit(placeId)) return false;
          const q = clampQty(qty);
          const items = { ...(get().cart[placeId] ?? {}) };
          if (q > 0) items[menuId] = q;
          else delete items[menuId];
          set({ cart: { ...get().cart, [placeId]: items } });
          return true;
        };
        const enterPlace = (place: PlaceRef, cart: Cart) =>
          set(() => ({
            cart,
            currentPlaceId: place.id,
            // 장소가 바뀌면 포장 선택을 매장으로 초기화 (R1 A-1)
            takeout: false,
            pendingPlace: null,
          }));

        return {
          lang: null,
          setLang: (lang) => set({ lang }),

          ...emptyData(),
          pendingPlace: null,
          walkPicks: {},
          setWalkPick: (courseId, placeId) =>
            set((s) => ({ walkPicks: { ...s.walkPicks, [courseId]: placeId } })),
          switchPlace: (place) => {
            const s = get();
            if (s.currentPlaceId === place.id) {
              // 같은 장소라도 포장 강제 규칙은 적용
              if (!place.takeout && s.takeout) set({ takeout: false });
              set({ pendingPlace: null });
              return { needsConfirm: false };
            }
            // 어느 장소든 주문이 남아 있으면 확인 (R1 M-06 보조 방어)
            if (Object.keys(s.cart).some((pid) => cartCount(s.cart, pid) > 0)) {
              set({ pendingPlace: place });
              return { needsConfirm: true };
            }
            enterPlace(place, {});
            return { needsConfirm: false };
          },
          confirmSwitchPlace: () => {
            const p = get().pendingPlace;
            if (p) enterPlace(p, {});
          },
          cancelSwitchPlace: () => set({ pendingPlace: null }),
          setQty: writeQty,
          increment: (pid, mid) => writeQty(pid, mid, (get().cart[pid]?.[mid] ?? 0) + 1),
          decrement: (pid, mid) => writeQty(pid, mid, (get().cart[pid]?.[mid] ?? 0) - 1),
          clearCart: () => set({ cart: {} }),
          setTakeout: (place, value) => {
            if (get().currentPlaceId !== place.id) return false;
            set({ takeout: place.takeout ? value : false });
            return true;
          },

          toggleSavedPlace: (id) => {
            const [places, on] = toggle(get().saved.places, id);
            set({ saved: { ...get().saved, places } });
            return on;
          },
          toggleSavedPhrase: (id) => {
            const [phrases, on] = toggle(get().saved.phrases, id);
            set({ saved: { ...get().saved, phrases } });
            return on;
          },

          logEvent: (event) => {
            const e = toAppEvent({ ...event, t: now() });
            if (!e) return false;
            set((s) => ({ events: appendEvent(s.events, e) }));
            return true;
          },
          addReport: (kind, placeId) => {
            if (!REPORT_KINDS.includes(kind)) return;
            const t = now();
            const pid = isValidId(placeId) ? { placeId } : {};
            const report: Report = { kind, ...pid, t };
            const ev = toAppEvent({ type: 'report_sent', kind, ...pid, t });
            set((s) => ({
              reports: [...s.reports, report],
              events: ev ? appendEvent(s.events, ev) : s.events,
            }));
          },
          clearEvents: () => set({ events: [] }),
          resetData: () => set({ ...emptyData(), pendingPlace: null, walkPicks: {} }),
        };
      },
      {
        name: STORAGE_KEY,
        version: STORAGE_VERSION,
        storage: jsonStorage(storage),
        partialize: (s): PersistedState => ({
          lang: s.lang,
          cart: s.cart,
          currentPlaceId: s.currentPlaceId,
          takeout: s.takeout,
          saved: s.saved,
          reports: s.reports,
          events: s.events,
        }),
        merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
      },
    ),
  );
}

export type AppStore = ReturnType<typeof createAppStore>;

export const useAppStore: AppStore = createAppStore();
