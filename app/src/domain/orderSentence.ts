/**
 * 주문 문장 생성 (PRD F-06, task.md T1.3).
 * 틀: "{메뉴} {수사} {단위}, … 주세요." + 포장 시 " 포장해 주세요."
 * 수량 0 항목은 빼고, 남은 항목이 없으면 null. 수량은 1~9 정수만 허용(그 밖은 RangeError).
 */
import type { L10n, MenuItem, OrderSentence, OrderWord } from '../types';
import { isValidQty, quantityMeaning, quantityPhrase, QTY_MAX, QTY_MIN } from './numerals';

/** 주문 한 줄: 메뉴와 수량 */
export type OrderLine = { item: MenuItem; qty: number };

const JUSEYO: OrderWord = {
  ko: '주세요',
  roman: 'juseyo',
  kana: 'ジュセヨ',
  meaning: { en: 'please', ja: 'ください', zh: '请给我' },
};

const POJANGHAE: OrderWord = {
  ko: '포장해',
  roman: 'pojanghae',
  kana: 'ポジャンヘ',
  meaning: { en: 'to go', ja: '持ち帰り', zh: '打包' },
};

/**
 * 메뉴 순서대로 수량이 1 이상인 항목만 주문 줄로 바꿉니다.
 * `quantities`는 store의 `cart[placeId]` (`{menuId: n}`). 메뉴에 없는 id는 무시합니다.
 */
export function toOrderLines(
  menu: readonly MenuItem[],
  quantities: Readonly<Record<string, number>>,
): OrderLine[] {
  return menu
    .filter((item) => (quantities[item.id] ?? 0) > 0)
    .map((item) => ({ item, qty: quantities[item.id] }));
}

/**
 * 주문 문장을 만듭니다. 빈 주문(수량 0만 있거나 줄이 없음)이면 null.
 * `words`는 문장에 나오는 순서 그대로이며(중복 제거 없음), 칩 ko를 이어 붙이면
 * 문장부호를 뺀 `ko`와 같습니다.
 * @throws RangeError 수량이 1~9 정수가 아니거나(0 제외) 같은 메뉴 id가 두 번 나올 때
 */
export function buildOrderSentence(
  lines: readonly OrderLine[],
  takeout: boolean,
): OrderSentence | null {
  const seen = new Set<string>();
  for (const { item, qty } of lines) {
    if (seen.has(item.id)) throw new RangeError(`같은 메뉴가 두 번 있습니다: ${item.id}`);
    seen.add(item.id);
    if (qty !== 0 && !isValidQty(qty)) {
      throw new RangeError(
        `수량은 0 또는 ${QTY_MIN}~${QTY_MAX} 정수여야 합니다: ${item.id}=${qty}`,
      );
    }
  }

  const items = lines.filter((l) => l.qty > 0);
  if (items.length === 0) return null;

  const parts = items.map(({ item, qty }) => ({ item, qty, q: quantityPhrase(qty, item.counter) }));

  const ko =
    parts.map((p) => `${p.item.ko} ${p.q.ko}`).join(', ') +
    ' 주세요.' +
    (takeout ? ' 포장해 주세요.' : '');
  const roman =
    parts.map((p) => `${p.item.roman} ${p.q.roman}`).join(', ') +
    ' juseyo.' +
    (takeout ? ' pojanghae juseyo.' : '');
  const kana =
    parts.map((p) => `${p.item.kana} ${p.q.kana}`).join('、') +
    ' ジュセヨ。' +
    (takeout ? ' ポジャンヘ ジュセヨ。' : '');

  const meaning: L10n = {
    en:
      parts.map((p) => `${p.item.name.en} ×${p.qty}`).join(', ') +
      ', please.' +
      (takeout ? ' To go, please.' : ''),
    ja:
      parts.map((p) => `${p.item.name.ja} ×${p.qty}`).join('、') +
      ' をください。' +
      (takeout ? '持ち帰りでお願いします。' : ''),
    zh:
      '请给我' +
      parts.map((p) => `${p.item.name.zh} ×${p.qty}`).join('、') +
      '。' +
      (takeout ? '请打包。' : ''),
  };

  const words: OrderWord[] = [];
  for (const p of parts) {
    words.push({
      ko: p.item.ko,
      roman: p.item.roman,
      kana: p.item.kana,
      meaning: { ...p.item.name },
    });
    words.push({ ...p.q, meaning: quantityMeaning(p.qty, p.item.counter) });
  }
  // 상수 객체를 공유하지 않도록 복사해서 넣습니다
  const copy = (w: OrderWord): OrderWord => ({ ...w, meaning: { ...w.meaning } });
  words.push(copy(JUSEYO));
  if (takeout) words.push(copy(POJANGHAE), copy(JUSEYO));

  return { ko, roman, kana, meaning, words };
}
