/**
 * S12 설정 (T2.1, PRD F-01·S12).
 * - 언어 즉시 전환(store setLang → 앱 전체 문구가 바로 바뀜, 저장되어 새로고침 후 유지).
 *   같은 name의 네이티브 radio라 방향키 이동·순환·단일 Tab 진입은 브라우저 기본 동작(R1 M-01)
 * - 운영자 리포트(S13) 진입
 * - 데모 데이터 초기화: 확인 시트 → store resetData(주문·저장·제보·기록 비움, 언어 유지)
 *   → 언어 선택 화면에서 시연을 처음부터
 * - 오프라인 준비 완료 표시(T3.1): 서비스 워커 프리캐시 목록이 전부 캐시됐을 때만 보임 (sw/pwa.ts)
 * - 하단: 가게 정보 정정·삭제 안내와 연락처 자리(PRD 10장, 값은 contact.ts)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_LANG, useT } from '../../i18n';
import { LANG_NAMES } from '../../i18n/langNames';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { ensureOfflineCheck, usePwaStore } from '../../sw/pwa';
import { LANGS } from '../../types';
import { Button, Card, CardButton, Icon, Pill, Sheet, cx, useToast } from '../../ui';
import { TAKEDOWN_CONTACT } from './contact';
import './settings.css';

export default function SettingsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const lang = useAppStore((s) => s.lang) ?? DEFAULT_LANG;
  const setLang = useAppStore((s) => s.setLang);
  const resetData = useAppStore((s) => s.resetData);
  const offlineReady = usePwaStore((s) => s.offlineReady);
  // 설정 화면 진입 시 준비 판정을 다시 확인 (T3.1 R2: 판정 시점 누락 방지)
  useEffect(() => ensureOfflineCheck(), []);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doReset = () => {
    resetData();
    setConfirmOpen(false);
    toast(t('settings.resetDone'));
    navigate(PATHS.lang, { replace: true });
  };

  return (
    <section className="screen set-screen" data-testid="screen-settings">
      <h1 className="set-title">{t('settings.title')}</h1>

      <div className="set-body">
        <h2 className="set-label" id="set-lang">
          {t('settings.language')}
        </h2>
        <Card className="set-langs" role="radiogroup" aria-labelledby="set-lang">
          {LANGS.map((code) => {
            const on = code === lang;
            return (
              <label
                key={code}
                lang={code === 'zh' ? 'zh-Hans' : code}
                className={cx('set-opt', on && 'set-opt--on')}
                data-testid={`set-lang-${code}`}
              >
                <input
                  type="radio"
                  name="set-lang"
                  value={code}
                  checked={on}
                  onChange={() => setLang(code)}
                  className="sr-only"
                />
                <Pill tone={on ? 'ink' : 'line'} aria-hidden="true">
                  {LANG_NAMES[code].badge}
                </Pill>
                <span className="set-opt__name">{LANG_NAMES[code].name}</span>
                {on && <Icon name="check" size={18} className="set-opt__check" />}
              </label>
            );
          })}
        </Card>

        <Card className="set-privacy">
          <Icon name="lock" size={16} />
          <span>{t('settings.privacy')}</span>
        </Card>

        {offlineReady && (
          <Card className="set-offline" data-testid="offline-ready">
            <Icon name="check" size={16} />
            <span>{t('pwa.offlineReady')}</span>
          </Card>
        )}

        <CardButton
          className="set-row"
          onClick={() => navigate(PATHS.report)}
          data-testid="open-report"
        >
          <Icon name="flag" size={18} />
          <span className="set-row__name">{t('settings.operatorReport')}</span>
          <Icon name="forward" size={18} className="set-row__chev" />
        </CardButton>

        <CardButton
          className="set-row set-row--danger"
          onClick={() => setConfirmOpen(true)}
          data-testid="reset-data"
        >
          <Icon name="refresh" size={18} />
          <span className="set-row__name">{t('settings.reset')}</span>
        </CardButton>

        <div className="set-takedown" data-testid="takedown">
          <p>{t('place.takedown')}</p>
          {TAKEDOWN_CONTACT && (
            <p className="set-takedown__contact" data-testid="takedown-contact">
              {TAKEDOWN_CONTACT}
            </p>
          )}
        </div>
      </div>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('settings.reset')}>
        <p className="set-confirm__body">{t('settings.resetConfirm')}</p>
        <div className="set-confirm__actions">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="acc" onClick={doReset} data-testid="reset-confirm">
            {t('settings.reset')}
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
