/** 시트·토스트를 붙일 자리: 앱 틀 안의 #app-overlay (없으면 body — 단독 테스트 등) */
export const OVERLAY_ID = 'app-overlay';

export function overlayRoot(): HTMLElement {
  return document.getElementById(OVERLAY_ID) ?? document.body;
}

let lock: { count: number; restore: () => void } | null = null;

/**
 * 시트가 열린 동안 배경(#app-overlay의 형제: main.app-view·탭바)에 inert를 겁니다.
 * 알림 영역(role=status, 토스트)은 계속 읽히도록 제외합니다.
 * 여러 시트가 겹쳐도 마지막 시트가 닫힐 때만 해제합니다. 반환 함수로 해제(중복 호출 무시).
 * #app-overlay가 없으면(단독 테스트 등) 아무것도 하지 않습니다.
 */
export function lockBackground(): () => void {
  const overlay = document.getElementById(OVERLAY_ID);
  const parent = overlay?.parentElement;
  if (!overlay || !parent) return () => {};
  if (!lock) {
    const els = [...parent.children].filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el !== overlay && el.getAttribute('role') !== 'status',
    );
    const had = els.map((el) => el.hasAttribute('inert'));
    els.forEach((el) => el.setAttribute('inert', ''));
    lock = {
      count: 0,
      restore: () =>
        els.forEach((el, i) => {
          if (!had[i]) el.removeAttribute('inert');
        }),
    };
  }
  lock.count += 1;
  let released = false;
  return () => {
    if (released || !lock) return;
    released = true;
    lock.count -= 1;
    if (lock.count === 0) {
      lock.restore();
      lock = null;
    }
  };
}

/** 포커스 후보 선택자. 실제 가능 여부는 isTabbable이 요소 상태로 판단합니다(R2-L01). */
const CANDIDATES = 'a[href], button, input, select, textarea, [tabindex]';

/**
 * Tab으로 갈 수 있는 요소인지: tabIndex >= 0, :disabled 아님(disabled fieldset 포함),
 * hidden·inert 조상 없음, 자신·조상의 계산 스타일이 display:none·visibility:hidden 아님.
 * (getClientRects는 jsdom에서 항상 비어 쓰지 않음. 클래스로 숨긴 실제 브라우저 경우는 Phase 2 E2E에서 확인)
 */
export function isTabbable(el: HTMLElement, root: HTMLElement): boolean {
  if (el.tabIndex < 0) return false;
  if (el.matches(':disabled')) return false;
  if (el.closest('[hidden], [inert]')) return false;
  const stop = root.parentElement;
  for (let n: HTMLElement | null = el; n && n !== stop; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
  }
  return true;
}

/** 컨테이너 안의 Tab 가능한 요소 (문서 순서) */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(CANDIDATES)].filter((el) => isTabbable(el, root));
}

/** 후보를 차례로 focus해 보고, 하나도 안 되면 컨테이너에 붙잡음 */
function focusFirstOf(candidates: HTMLElement[], root: HTMLElement): void {
  for (const el of candidates) {
    el.focus();
    if (document.activeElement === el) return;
  }
  root.focus();
}

/** Tab/Shift+Tab을 컨테이너 안에서 순환시킵니다. 처리했으면 true */
export function trapTab(e: KeyboardEvent, root: HTMLElement): boolean {
  if (e.key !== 'Tab') return false;
  const items = focusableIn(root);
  const active = document.activeElement as HTMLElement | null;
  const inside = !!active && root.contains(active);
  if (items.length === 0) {
    e.preventDefault();
    root.focus();
    return true;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey) {
    if (!inside || active === first || active === root) {
      e.preventDefault();
      focusFirstOf([...items].reverse(), root);
      return true;
    }
  } else if (!inside || active === last) {
    e.preventDefault();
    focusFirstOf(items, root);
    return true;
  }
  return false;
}
