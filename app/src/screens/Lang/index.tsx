/**
 * S00 언어 선택 (T2.1, PRD F-01).
 * - 언어를 누르면 store에 바로 저장되고(새로고침 후 유지) 이 화면 문구가 즉시 바뀝니다.
 * - 첫 실행(lang null)에는 기본 언어(EN)가 선택된 것으로 보이고, "시작하기"를 누를 때 저장합니다.
 * - 언어 목록은 같은 name의 네이티브 radio(R1 M-01): 방향키 이동·순환·선택 항목 하나로 Tab 진입은
 *   브라우저 기본 동작이 맡고, 방향키로 옮기면 change가 일어나 즉시 전환됩니다.
 * - 발음 표기 방식 안내(로마자/가타카나)를 선택한 언어에 맞춰 보여줍니다.
 */
import { useNavigate } from 'react-router-dom';
import { DEFAULT_LANG, useT } from '../../i18n';
import { LANG_NAMES } from '../../i18n/langNames';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { LANGS } from '../../types';
import { Button, cx, pronunciationKind } from '../../ui';
import './lang.css';

export default function LangScreen() {
  const t = useT();
  const navigate = useNavigate();
  const stored = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const selected = stored ?? DEFAULT_LANG;

  const start = () => {
    if (stored === null) setLang(selected);
    navigate(PATHS.home, { replace: true });
  };

  return (
    <section className="screen lang-screen" data-testid="screen-lang">
      <div className="lang-glow" aria-hidden="true" />
      <div className="lang-glow2" aria-hidden="true" />
      <div className="lang-in">
        <div className="lang-logo" aria-hidden="true">
          {'D'}
        </div>
        <h1 className="lang-name">
          {'Daejeon'}
          <br />
          <i>{'Detour'}</i>
        </h1>
        <p className="lang-sub">
          {t('lang.welcomeTitle')}
          <br />
          {t('lang.welcomeSub')}
        </p>

        <div className="lang-list">
          <h2 className="lang-label" id="lang-choose">
            {t('lang.choose')}
          </h2>
          <div role="radiogroup" aria-labelledby="lang-choose" className="lang-options">
            {LANGS.map((code) => {
              const on = code === selected;
              return (
                <label
                  key={code}
                  lang={code === 'zh' ? 'zh-Hans' : code}
                  className={cx('lang-opt', on && 'lang-opt--on')}
                  data-testid={`lang-${code}`}
                >
                  <input
                    type="radio"
                    name="lang-choose"
                    value={code}
                    checked={on}
                    onChange={() => setLang(code)}
                    className="sr-only"
                  />
                  <span className="lang-opt__badge" aria-hidden="true">
                    {LANG_NAMES[code].badge}
                  </span>
                  <span className="lang-opt__name">{LANG_NAMES[code].name}</span>
                  <span className="lang-opt__check" aria-hidden="true" />
                </label>
              );
            })}
          </div>
          <p className="lang-pron" data-testid="lang-pron-note">
            {t(pronunciationKind(selected) === 'kana' ? 'lang.pronKana' : 'lang.pronRoman')}
          </p>
          <Button variant="acc" onClick={start} className="lang-start">
            {t('lang.start')}
            <span aria-hidden="true">{'→'}</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
