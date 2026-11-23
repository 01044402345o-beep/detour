import { getPlace } from '../data';
import type { ReportKind } from '../domain/events';
import { pickL10n, useLang, useT } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { CardButton } from './Card';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { useToast } from './toastContext';
import './ReportSheet.css';

export type ReportSheetProps = {
  open: boolean;
  /** 닫기(바탕·Esc·닫기 버튼). 제보를 보낸 뒤에도 호출됩니다. */
  onClose: () => void;
  /** 제보 대상 장소 ID (downtown.json 실제 ID). 생략하면 장소 없는 일반 제보 */
  placeId?: string;
  /** 제보를 저장한 뒤 호출 (선택) */
  onSent?: (kind: ReportKind) => void;
};

/** 제보 종류 4개 (F-14, 목업 sheetHTML 순서) */
const OPTIONS: readonly { kind: ReportKind; icon: IconName | null; mark?: string }[] = [
  { kind: 'closed', icon: 'lock' },
  { kind: 'menu', icon: 'text' },
  { kind: 'price', icon: null, mark: '₩' },
  { kind: 'other', icon: 'info' },
];

/**
 * "정보가 달라요" 제보 시트 (F-14, 목업 S03·S11 sheetHTML). T2.6 소유, T2.3은 import만 합니다.
 * 항목을 누르면 store.addReport(kind, placeId)로 저장(→ report_sent 이벤트도 store가 기록),
 * 감사 토스트를 띄우고 닫습니다. 자유 입력은 받지 않습니다.
 */
export function ReportSheet({ open, onClose, placeId, onSent }: ReportSheetProps) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const addReport = useAppStore((s) => s.addReport);
  const place = placeId ? getPlace(placeId) : undefined;

  const send = (kind: ReportKind) => {
    addReport(kind, place?.id);
    onSent?.(kind);
    onClose();
    toast(t('report.thanks'));
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('report.title')}>
      {place && (
        <p className="rs-sub" data-testid="report-sheet-place">
          {pickL10n(lang, place.name)} ·{' '}
          {place.verified ? t('course.checked', { date: place.checkedAt }) : t('place.unverified')}
        </p>
      )}
      <div className="rs-list">
        {OPTIONS.map(({ kind, icon, mark }) => (
          <CardButton key={kind} className="rs-opt" data-kind={kind} onClick={() => send(kind)}>
            <span className="rs-opt__ic" aria-hidden="true">
              {icon ? <Icon name={icon} size={18} /> : mark}
            </span>
            <span className="rs-opt__label">{t(`report.${kind}`)}</span>
            <Icon name="forward" size={18} className="rs-opt__chev" />
          </CardButton>
        ))}
      </div>
    </Sheet>
  );
}
