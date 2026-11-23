import { useT } from '../../i18n';
import { Icon } from '../../ui';
import './qty.css';

export type QtyStepperProps = {
  qty: number;
  /** 화면 낭독기용 메뉴 이름 (사용자 언어) */
  name: string;
  onIncrement: () => void;
  onDecrement: () => void;
};

/** 수량 −/+ (목업 .qty). 누름 영역은 44px, 보이는 동그라미는 목업 크기(30px) */
export function QtyStepper({ qty, name, onIncrement, onDecrement }: QtyStepperProps) {
  const t = useT();
  return (
    <div className="qty" role="group" aria-label={name}>
      <button
        type="button"
        className="qty__btn"
        aria-label={`${t('menu.decrease')} · ${name}`}
        onClick={onDecrement}
      >
        <Icon name="minus" size={16} strokeWidth={2.6} />
      </button>
      <span className="qty__n" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="qty__btn qty__btn--plus"
        aria-label={`${t('menu.increase')} · ${name}`}
        onClick={onIncrement}
      >
        <Icon name="plus" size={16} strokeWidth={2.6} />
      </button>
    </div>
  );
}

/** 처음 담기 버튼 (목업 .addb 36px → 누름 영역 44px) */
export function AddButton({ name, onClick }: { name: string; onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      className="addb"
      aria-label={`${t('menu.increase')} · ${name}`}
      onClick={onClick}
    >
      <Icon name="plus" size={18} strokeWidth={2.6} />
    </button>
  );
}
