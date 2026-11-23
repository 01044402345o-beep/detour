import { useT } from '../../i18n';
import { IconButton } from '../../ui';

type Props = { index: number; total: number; onClose: () => void };

/** 연습·결과 상단 (목업 S06·S07 .topbar): 닫기 · 진행률 · n/전체 */
export function PracticeHeader({ index, total, onClose }: Props) {
  const t = useT();
  const pct = ((index + 1) / total) * 100;
  return (
    <header className="ui-topbar pr-top">
      <IconButton icon="close" label={t('common.close')} onClick={onClose} />
      <div
        className="pr-prog"
        role="progressbar"
        aria-label={t('practice.title')}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <b className="pr-count" aria-hidden="true">
        {index + 1}/{total}
      </b>
    </header>
  );
}
