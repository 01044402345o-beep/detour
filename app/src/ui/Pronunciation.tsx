import { useLang } from '../i18n';
import type { Lang } from '../types';
import { cx } from './cx';
import { pronunciationKind } from './pron';

export type PronunciationProps = {
  /** 개정 로마자 기반 발음 안내 (data JSON의 roman) */
  roman: string;
  /** 가타카나 근사 표기 (data JSON의 kana) */
  kana: string;
  /** 생략하면 현재 언어(store) */
  lang?: Lang;
  className?: string;
};

/**
 * 발음 표기 공용 표시 (F-01). 표기 방식 안내 문구는 언어 선택 화면의
 * `lang.pronRoman`·`lang.pronKana`가 맡습니다.
 */
export function Pronunciation({ roman, kana, lang, className }: PronunciationProps) {
  const current = useLang();
  const kind = pronunciationKind(lang ?? current);
  return (
    <span
      className={cx('ui-pron', className)}
      lang={kind === 'kana' ? 'ja' : 'ko-Latn'}
      data-pron={kind}
    >
      {kind === 'kana' ? kana : roman}
    </span>
  );
}
