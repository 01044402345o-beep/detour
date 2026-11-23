import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import { IconButton } from './IconButton';
import { lockBackground, overlayRoot, trapTab } from './overlay';

type SheetBase = {
  open: boolean;
  /** 어두운 바탕 탭·Esc·닫기 버튼 */
  onClose: () => void;
  children?: ReactNode;
};

/** dialog 이름: 보이는 제목(title) 또는 제목 없이 번역된 label(aria-label) 중 하나 필수 */
export type SheetProps = SheetBase &
  (
    | { title: Exclude<ReactNode, undefined | null | boolean>; label?: undefined }
    | { title?: undefined; label: string }
  );

/**
 * 열린 시트 순서. 시트 겹침은 미지원(R2-L02) — 실수로 겹쳤을 때 배경 잠금·Esc가 꼬이지 않게 하는 안전장치.
 * 맨 위(마지막에 열린) 시트만 Esc·Tab을 처리합니다.
 */
const stack: HTMLElement[] = [];

/**
 * 바텀시트 (목업 .dim + .sheet). 앱 틀 안(#app-overlay)에 그려져 데스크톱에서도 폰 폭 안에 뜹니다.
 * 열려 있는 동안: 배경 inert, Tab/Shift+Tab 시트 안 순환, Esc로 닫기.
 * 닫히면 inert를 푼 뒤 열기 전 포커스 자리로 돌려줍니다.
 */
export function Sheet({ open, onClose, title, label, children }: SheetProps) {
  const t = useT();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const prev = document.activeElement as HTMLElement | null;
    if (stack.length > 0 && import.meta.env.DEV) {
      console.warn('[Sheet] overlapping sheets are not supported; open one sheet at a time');
    }
    const release = lockBackground();
    stack.push(el);
    el.focus();
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== el) return;
      if (e.key === 'Escape') closeRef.current();
      else trapTab(e, el);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = stack.indexOf(el);
      if (i >= 0) stack.splice(i, 1);
      release(); // inert 요소에는 포커스가 가지 않으므로 먼저 해제
      if (prev && prev.isConnected) prev.focus();
    };
  }, [open]);

  if (!open) return null;
  const hasTitle = title !== undefined;
  return createPortal(
    <div
      className="ui-sheet-dim"
      data-testid="sheet-dim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="ui-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? titleId : undefined}
        aria-label={hasTitle ? undefined : label}
        tabIndex={-1}
      >
        <div className="ui-sheet__grab" />
        <div className="ui-sheet__head">
          {hasTitle ? (
            <h2 id={titleId} className="ui-sheet__title">
              {title}
            </h2>
          ) : (
            <span className="ui-sheet__title" />
          )}
          <IconButton icon="close" label={t('common.close')} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>,
    overlayRoot(),
  );
}
