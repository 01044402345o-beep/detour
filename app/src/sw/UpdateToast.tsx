/**
 * 새 버전 업데이트 토스트 (T3.1). ToastProvider 안에 1개 둡니다.
 * 앱 시작 시 서비스 워커를 등록하고(startPwa), 새 버전이 대기 중이면 '업데이트'·'나중에' 버튼이 있는
 * 토스트를 띄웁니다. 일반 토스트(2.4초 후 사라짐)와 달리 사용자가 고를 때까지 남습니다.
 * 알림 영역(role=status)은 ToastProvider의 것을 함께 씁니다(화면에 알림 영역 1개).
 */
import { useEffect } from 'react';
import { useT } from '../i18n';
import { applyUpdate, dismissUpdate, startPwa, usePwaStore } from './pwa';
import './updateToast.css';

export function UpdateToast() {
  const t = useT();
  const needRefresh = usePwaStore((s) => s.needRefresh);

  useEffect(() => {
    startPwa();
  }, []);

  return (
    needRefresh && (
      <div className="ui-toast ui-toast--update" data-testid="update-toast">
        <span className="ui-toast__msg">{t('pwa.updateAvailable')}</span>
        <span className="ui-toast__actions">
          <button
            type="button"
            className="ui-toast__btn"
            onClick={dismissUpdate}
            data-testid="update-later"
          >
            {t('pwa.later')}
          </button>
          <button
            type="button"
            className="ui-toast__btn ui-toast__btn--primary"
            onClick={() => void applyUpdate()}
            data-testid="update-apply"
          >
            {t('pwa.update')}
          </button>
        </span>
      </div>
    )
  );
}
