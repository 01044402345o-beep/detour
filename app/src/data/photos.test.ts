// @vitest-environment node
/** 사진 기록 검사 (DESIGN.md 5장, T6.0) */
import fs from 'node:fs';
import path from 'node:path';
import { getPlace } from './index';
import { creditsText } from './photoCredits';
import {
  isDishExample,
  isOwnPhoto,
  OWN_AUTHOR,
  OWN_PHOTO_LICENSE,
  photoCreditKey,
  LICENSE_URLS,
  PHOTOS,
  photoCreditParams,
  photoForArea,
  photoForPlace,
  photoUrl,
} from './photos';

const PUBLIC = path.join(process.cwd(), 'public');
const MAX_BYTES = 200 * 1024;

/** WebP 크기 읽기 (VP8 / VP8L / VP8X) */
function webpSize(buf: Buffer): [number, number] {
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buf.toString('ascii', 8, 12)).toBe('WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  const v = buf.readUInt32LE(21);
  return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1];
}

describe('photos.ts', () => {
  it('모든 항목에 필수 필드가 있고 id가 겹치지 않음', () => {
    expect(new Set(PHOTOS.map((p) => p.id)).size).toBe(PHOTOS.length);
    for (const p of PHOTOS) {
      for (const k of [
        'id',
        'file',
        'title',
        'author',
        'licenseId',
        'changes',
        'review',
      ] as const) {
        expect(String(p[k]).trim(), `${p.id}.${k}`).not.toBe('');
      }
      expect(p.placeId ?? p.areaId, `${p.id}: placeId 또는 areaId`).toBeTruthy();
      for (const lang of ['en', 'ja', 'zh'] as const) expect(p.alt[lang].trim()).not.toBe('');
      if (isOwnPhoto(p)) {
        // 운영자 직접 촬영(T6.10): 외부 원본·라이선스 링크 없음
        expect(p.sourceUrl).toBeUndefined();
        expect(p.licenseUrl).toBeUndefined();
      } else {
        expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      }
      if (p.year !== undefined) expect(p.year).toBeGreaterThan(1990);
    }
  });

  it('라이선스 URL이 licenseId와 맞음 (BY와 BY-SA, 국가판 KR 구분)', () => {
    for (const p of PHOTOS) {
      if (p.licenseUrl === undefined) continue; // 운영자 직접 촬영은 아래 별도 검사
      expect(p.licenseUrl).toBe(LICENSE_URLS[p.licenseId]);
      const [, kind, ver, kr] = /^CC (BY|BY-SA) (\d\.\d)( KR)?$/.exec(p.licenseId)!;
      expect(p.licenseUrl).toBe(
        `https://creativecommons.org/licenses/${kind.toLowerCase()}/${ver}/${kr ? 'kr/' : ''}`,
      );
    }
    // 음식 예시 사진 3장: 원본 페이지(2026-11-26 API 확인)의 라이선스 그대로
    const lic = Object.fromEntries(PHOTOS.map((p) => [p.id, p.licenseUrl]));
    expect(lic['dish-manduguk']).toBe('https://creativecommons.org/licenses/by-sa/2.0/');
    expect(lic['dish-sundae-gukbap']).toBe('https://creativecommons.org/licenses/by/2.0/');
    expect(lic['dish-gukhwappang']).toBe('https://creativecommons.org/licenses/by-sa/2.0/kr/');
  });

  it('운영자 직접 촬영 2장(T6.10): 광천식당·수연분식 실제 가게 사진, CC 아님, 개인 이름 없음', () => {
    const own = PHOTOS.filter((p) => isOwnPhoto(p));
    expect(own.map((p) => [p.id, p.placeId, p.file, p.kind])).toEqual([
      ['own-gwangcheon-sikdang', 'gwc', 'photos/gwangcheon-sikdang.webp', 'place'],
      ['own-suyeon-bunsik', 'sy', 'photos/suyeon-bunsik.webp', 'place'],
    ]);
    for (const p of own) {
      expect(p.author).toBe(OWN_AUTHOR);
      expect(p.author).toBe('Edulleo 운영자 (직접 촬영)');
      expect(p.licenseId).toBe(OWN_PHOTO_LICENSE);
      expect(p.licenseId).toMatch(/not a Creative Commons license/);
      expect(p.licenseId).not.toMatch(/^CC /);
      expect(p.year).toBeUndefined(); // 근거 없는 연도는 적지 않음 (T6.10 R1 L-01)
      expect(p.notice).toBeUndefined();
      expect(p.review).toMatch(/user confirmed on 2026-11-26 that they took this photo themselves/);
      expect(p.review).toMatch(/non-affiliation notice/);
      expect(p.changes).toMatch(/converted to WebP/);
      expect(photoCreditKey(p)).toBe('photo.creditOwn');
    }
    const gwc = own[0];
    expect(gwc.review).toMatch(/own photo that they posted on the blog they run/);
    expect(gwc.review).toMatch(/One passer-by \(far right edge\) blurred/);
    expect(gwc.changes).toMatch(/passer-by .* blurred/);
    expect(own[1].changes).toMatch(/No blur/);
    // 다른 사진은 CC
    for (const p of PHOTOS.filter((x) => !isOwnPhoto(x))) expect(p.licenseId).toMatch(/^CC /);
  });

  it('출처 문구 키: 직접 촬영 / 음식 예시 / 그 밖', () => {
    expect(photoCreditKey(photoForPlace('gwc')!)).toBe('photo.creditOwn');
    expect(photoCreditKey(photoForPlace('gc')!)).toBe('photo.creditDish');
    expect(photoCreditKey(photoForPlace('ssd')!)).toBe('photo.credit');
  });

  it('kind: 장소 사진 8장(CC 6 + 직접 촬영 2)은 place, 음식 예시 3장은 dish-example(음식 이름 3개 언어·가게 사진 아님 기록)', () => {
    const places = PHOTOS.filter((p) => p.kind === 'place').map((p) => p.id);
    expect(places).toEqual([
      'sungsimdang',
      'euneungjeongi',
      'chungnam-office',
      'daejeon-station',
      'jungang-market',
      'yuseong-footbath',
      'own-gwangcheon-sikdang',
      'own-suyeon-bunsik',
    ]);
    const dishes = PHOTOS.filter((p) => p.kind === 'dish-example');
    expect(dishes.map((p) => [p.placeId, p.file])).toEqual([
      ['gc', 'photos/dish-manduguk.webp'],
      ['sj', 'photos/dish-sundae-gukbap.webp'],
      ['hg', 'photos/dish-gukhwappang.webp'],
    ]);
    for (const p of dishes) {
      if (p.kind !== 'dish-example') throw new Error('kind');
      expect(isDishExample(p)).toBe(true);
      expect(p.areaId).toBeUndefined();
      // 대표 음식 이름 = 그 가게 메뉴의 대표(signature) 이름
      const sig = getPlace(p.placeId!)!.menu!.find((m) => m.signature)!;
      expect(p.dish).toEqual(sig.name);
      expect(p.review).toMatch(/No people; no shop signs or logos/);
      expect(p.review).toMatch(/not taken at .+ and unrelated to it/);
      expect(p.review).toMatch(/SNS photos/);
      expect(p.review).toMatch(/no EXIF copyright or credit notice/);
      expect(p.notice).toBeUndefined();
      expect(p.changes).toMatch(/WebP/);
      expect(p.changes).toMatch(/no crop, no color correction/i);
      expect(p.changes).not.toMatch(/blur/);
      for (const lang of ['en', 'ja', 'zh'] as const) expect(p.dish[lang].trim()).not.toBe('');
      expect(p.alt.en).toMatch(/^Example photo of .+, not taken at /);
    }
    // 리사이즈한 것(원본 > 1280px)과 크기 그대로 변환한 것 구분
    const byId = (id: string) => PHOTOS.find((p) => p.id === id)!;
    for (const id of ['dish-manduguk', 'dish-gukhwappang'])
      expect(byId(id).changes).toMatch(/resized to 1200px/);
    expect(byId('dish-sundae-gukbap').changes).toMatch(/at the same size\. No resize/);
    // 만둣국 라이선스 이력 (R1 L-01): Commons 2007-12-14 검토가 BY-SA 2.0 확인, 최초 기재 BY 2.0은 당시 유효성 불명
    expect(byId('dish-manduguk').review).toMatch(/Esrever \(2007-12-14\) confirmed CC BY-SA 2\.0/);
    expect(byId('dish-manduguk').review).not.toMatch(/later changed/);
    for (const p of PHOTOS.filter((x) => x.kind === 'place')) expect(isDishExample(p)).toBe(false);
  });

  it('허락 근거 미확인으로 뺀 블로그 출처 음식 사진 2장(T6.9 R1 H-01)은 기록·public·CREDITS에 없음', () => {
    for (const f of ['dish-dubu-duruchigi.webp', 'dish-gochu-twigim.webp']) {
      expect(fs.existsSync(path.join(PUBLIC, 'photos', f)), f).toBe(false);
      expect(PHOTOS.some((p) => p.file.endsWith(f))).toBe(false);
    }
    // 광천식당·수연분식은 그 2장과 별개인 운영자 직접 촬영 사진(T6.10)
    expect(photoForPlace('gwc')?.id).toBe('own-gwangcheon-sikdang');
    expect(photoForPlace('sy')?.id).toBe('own-suyeon-bunsik');
    expect(PHOTOS).toHaveLength(11);
    const txt = fs.readFileSync(path.join(PUBLIC, 'photos/CREDITS.txt'), 'utf8');
    expect(txt).not.toMatch(/dubu|gochu|이랑이랑|굿바이/);
  });

  it('파일이 public/photos에 있고 WebP·긴 변 ≤1200px·≤200KB', () => {
    for (const p of PHOTOS) {
      expect(p.file).toMatch(/^photos\/[a-z0-9-]+\.webp$/);
      const f = path.join(PUBLIC, p.file);
      expect(fs.existsSync(f), f).toBe(true);
      const buf = fs.readFileSync(f);
      expect(buf.length, p.file).toBeLessThanOrEqual(MAX_BYTES);
      expect(Math.max(...webpSize(buf)), p.file).toBeLessThanOrEqual(1200);
    }
  });

  it('public/photos의 사진은 모두 기록돼 있고, 기록된 사진은 모두 파일이 있음', () => {
    const shipped = fs.readdirSync(path.join(PUBLIC, 'photos')).filter((f) => f.endsWith('.webp'));
    expect(shipped.sort()).toEqual(PHOTOS.map((p) => p.file.replace('photos/', '')).sort());
  });

  it('얼굴 흐림 사진: changes에 흐림·리사이즈·WebP·간판 그대로, review에 사용자 결정', () => {
    for (const id of ['sungsimdang', 'euneungjeongi', 'yuseong-footbath']) {
      const p = PHOTOS.find((x) => x.id === id)!;
      expect(p.changes).toMatch(/faces of identifiable people blurred/);
      expect(p.changes).toMatch(/1200px/);
      expect(p.changes).toMatch(/WebP/);
      expect(p.changes).toMatch(/signage unchanged/);
      expect(p.review).toMatch(/User decision 2026-11-26/);
    }
    for (const id of ['chungnam-office', 'daejeon-station', 'jungang-market']) {
      expect(PHOTOS.find((x) => x.id === id)!.changes).not.toMatch(/blur/);
    }
  });

  it('CREDITS.txt = photos.ts에서 만든 내용 (review·alt 3개 언어·같은 라이선스 공유 포함)', () => {
    const file = path.join(PUBLIC, 'photos/CREDITS.txt');
    const want = creditsText();
    if (process.env.UPDATE_PHOTO_CREDITS === '1')
      fs.writeFileSync(file, want.replace(/\n/g, '\r\n'));
    const txt = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    expect(
      txt,
      'UPDATE_PHOTO_CREDITS=1 npx vitest run src/data/photos.test.ts 로 다시 만드세요',
    ).toBe(want);
    expect(txt).toMatch(/apply ONLY to the photo files/);
    expect(txt).toMatch(/shared under the same license/);
    for (const p of PHOTOS) {
      for (const v of [
        p.title,
        p.author,
        ...(p.sourceUrl ? [p.sourceUrl, p.licenseUrl] : []),
        p.licenseId,
        p.changes,
        p.review,
        p.alt.en,
        p.alt.ja,
        p.alt.zh,
      ]) {
        expect(txt, `${p.id}: ${v}`).toContain(v);
      }
      if (p.notice) expect(txt).toContain(p.notice);
      if (p.kind === 'dish-example') expect(txt).toContain(`Dish:     ${p.dish.en}`);
    }
    expect(txt.match(/Kind: {5}dish example \(NOT taken at this shop\)/g)).toHaveLength(3);
    expect(txt.match(/Kind: {5}place$/gm)).toHaveLength(8);
    // 운영자 직접 촬영(T6.10): CC가 아님·외부 원본 없음을 적고 링크 줄 없음
    expect(txt).toMatch(/own photos taken by the Edulleo team/);
    expect(
      txt.match(
        /License: {2}Owner photo — used with permission \(not a Creative Commons license\)$/gm,
      ),
    ).toHaveLength(2);
    expect(txt.match(/Source: {3}none \(own photo, no external source page\)$/gm)).toHaveLength(2);
    expect(txt).toMatch(/CC BY \(Attribution\) and CC BY-SA \(Attribution-ShareAlike\)/);
    expect(txt).toMatch(/NOT taken at that shop/);
  });

  it('장소·권역 조회, 장소 id는 실제 데이터에 있음', () => {
    expect(photoForPlace('mus')?.id).toBe('chungnam-office');
    expect(photoForPlace('djs')?.id).toBe('daejeon-station');
    expect(photoForArea('station')?.id).toBe('jungang-market');
    expect(photoForPlace('ssd')?.id).toBe('sungsimdang');
    expect(photoForPlace('eun')?.id).toBe('euneungjeongi');
    expect(photoForArea('downtown')?.id).toBe('euneungjeongi');
    expect(photoForArea('yuseong')?.id).toBe('yuseong-footbath');
    // 음식 예시 사진 (T6.9)
    expect(photoForPlace('gc')?.id).toBe('dish-manduguk');
    expect(photoForPlace('sj')?.id).toBe('dish-sundae-gukbap');
    expect(photoForPlace('hg')?.id).toBe('dish-gukhwappang');
    // 운영자 직접 촬영 (T6.10)
    expect(photoForPlace('gwc')?.id).toBe('own-gwangcheon-sikdang');
    expect(photoForPlace('sy')?.id).toBe('own-suyeon-bunsik');
    // 사진 없는 장소 → 글자 타일
    expect(photoForPlace('nope')).toBeUndefined();
    for (const p of PHOTOS)
      if (p.placeId && p.placeId !== 'djs') expect(getPlace(p.placeId)).toBeDefined();
  });

  it('URL은 BASE_URL을 붙이고, 짧은 출처 값은 저작자·라이선스', () => {
    const p = PHOTOS[0];
    expect(photoUrl(p)).toBe(`${import.meta.env.BASE_URL}${p.file}`);
    expect(photoCreditParams(p)).toEqual({ author: p.author, license: p.licenseId });
  });
});
