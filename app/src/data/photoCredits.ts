/**
 * public/photos/CREDITS.txt 내용 만들기 (T6.0 R1-L-01). 원본은 data/photos.ts 하나입니다.
 * 다시 만들기: `UPDATE_PHOTO_CREDITS=1 npx vitest run src/data/photos.test.ts`
 * (평소에는 같은 테스트가 파일과 이 결과가 같은지 검사합니다.) 앱 번들에는 들어가지 않습니다(테스트 전용).
 */
import { PHOTOS, type Photo } from './photos';

const HEADER = [
  'Edulleo - photo credits',
  '=======================',
  '',
  'Generated from app/src/data/photos.ts (do not edit by hand).',
  '',
  'The licenses below apply ONLY to the photo files in this folder (public/photos/*.webp).',
  'They do not apply to the Edulleo app code or to any other file.',
  'Two different license families are used: CC BY (Attribution) and CC BY-SA (Attribution-ShareAlike).',
  'Photos changed by us (resized, converted, faces blurred) are shared under the same license',
  'as their original (for CC BY-SA photos this is required by ShareAlike).',
  '',
  'Kind "place": a photo of that place or area.',
  'Kind "dish example": a general photo of the shop\'s signature dish from Wikimedia Commons.',
  'It was NOT taken at that shop and has nothing to do with it. The app labels it on screen as',
  '"Example photo of the dish - not this shop". It replaces the SNS photos the user asked for,',
  'because SNS photos cannot be republished here.',
  '',
  'Checked against each original file page (Wikimedia Commons API: imageinfo extmetadata + page wikitext) on 2026-11-26.',
];

function usedFor(p: Photo): string {
  const parts: string[] = [];
  if (p.placeId) parts.push(`place "${p.placeId}"`);
  if (p.areaId) parts.push(`area "${p.areaId}"`);
  return parts.join(', ');
}

export function creditsText(photos: readonly Photo[] = PHOTOS): string {
  const lines = [...HEADER];
  photos.forEach((p, i) => {
    lines.push(
      '',
      `${i + 1}) ${p.file.replace('photos/', '')}`,
      `   Kind:     ${p.kind === 'dish-example' ? 'dish example (NOT taken at this shop)' : 'place'}`,
      ...(p.kind === 'dish-example' ? [`   Dish:     ${p.dish.en}`] : []),
      `   Title:    ${p.title}`,
      `   Author:   ${p.author}`,
      ...(p.year !== undefined ? [`   Year:     ${p.year}`] : []),
      `   Source:   ${p.sourceUrl}`,
      `   License:  ${p.licenseId} - ${p.licenseUrl}`,
      ...(p.notice ? [`   Notice:   ${p.notice}`] : []),
      `   Changes:  ${p.changes}`,
      `   Review:   ${p.review}`,
      `   Alt (en): ${p.alt.en}`,
      `   Alt (ja): ${p.alt.ja}`,
      `   Alt (zh): ${p.alt.zh}`,
      `   Used for: ${usedFor(p)}`,
    );
  });
  return lines.join('\n') + '\n';
}
