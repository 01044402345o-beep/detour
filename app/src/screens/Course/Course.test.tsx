import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { getBundle, places } from '../../data';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { photoForPlace, photoUrl } from '../../data/photos';
import { googlePlaceUrl, naverWalkUrl } from '../../ui/map/externalMap';
import CourseScreen from '.';

// 확인 상태 두 갈래를 모두 보려고 성심당(ssd)만 verified:true로 바꿉니다(실제 데이터는 4곳 모두 false).
vi.mock('../../data', async (importOriginal) => {
  const m = await importOriginal<typeof import('../../data')>();
  const mark = <T extends { id: string }>(p: T) => (p.id === 'ssd' ? { ...p, verified: true } : p);
  const list = m.places.map(mark);
  const bundles = m.bundles.map((b) => ({ ...b, places: b.places.map(mark) }));
  return {
    ...m,
    places: list,
    bundles,
    getPlace: (id: string) => list.find((p) => p.id === id),
    getBundle: (id: string) => bundles.find((b) => b.course.id === id),
  };
});

// 사진 없는 정류장(글자 타일) 경우를 만들려고, 여기에 넣은 장소 id는 사진이 없는 것으로 봅니다(T6.9 이후 실제 데이터는 모든 정류장에 사진).
const noPhoto = vi.hoisted(() => new Set<string>());
afterEach(() => noPhoto.clear());
vi.mock('../../data/photos', async (orig) => {
  const mod = await orig<typeof import('../../data/photos')>();
  return {
    ...mod,
    photoForPlace: (id: string) => (noPhoto.has(id) ? undefined : mod.photoForPlace(id)),
  };
});

// 타일 지도 대신 약도로 고정 (Leaflet 동작은 ui/map 테스트)
let onLine = false;
beforeAll(() => {
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => onLine);
});

function Probe() {
  const loc = useLocation();
  return <div data-testid="probe">{loc.pathname}</div>;
}

function renderCourse(url = '/course') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/course" element={<CourseScreen />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const byId = (id: string) => places.find((p) => p.id === id)!;

beforeEach(() => {
  onLine = false;
  useAppStore.setState({ lang: 'en', events: [] });
});
afterEach(() => useAppStore.setState({ lang: null, events: [] }));

describe('S02 코스 지도', () => {
  it('E2E용 화면 루트 testid 유지, 제목·요약은 사용자 언어', () => {
    renderCourse();
    const root = screen.getByTestId('screen-course');
    expect(root.tagName).toBe('SECTION');
    expect(screen.getAllByText('Old Downtown Half-day').length).toBeGreaterThan(0);
    // 요약: 정류장·km·시간 · 출발 (숫자는 고정폭 .num)
    const meta = screen.getByTestId('course-meta');
    expect(meta).toHaveTextContent(
      `${t('en', 'course.meta', { stops: 4, km: '2.2', hours: '3' })} · ${t('en', 'course.metaFrom', { start: 'Daejeon Stn' })}`,
    );
    expect([...meta.querySelectorAll('.num')].map((el) => el.textContent)).toEqual([
      '4',
      '2.2',
      '3',
    ]);
    // 화면 머리 제목은 탭 이름과 같은 "Course"
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('en', 'nav.course'));
  });

  it('정류장 4곳이 방문 순서대로, 각각 이동 시간 표시', () => {
    renderCourse();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    // 분은 오른쪽 고정폭 (보이는 "11 min"), 영업시간도 고정폭. 하루 종일 여는 거리는 시간 생략
    expect(items[0].querySelector('.course-stop__time')?.textContent).toBe(
      `${t('en', 'course.minShort', { min: 11 })}${t('en', 'place.hours')} 08:00–22:0008:00–22:00`,
    );
    expect(items[0].querySelectorAll('.course-stop__time .num')).toHaveLength(2);
    expect(items[1].querySelector('.course-stop__time')?.textContent).toBe(
      t('en', 'course.minShort', { min: 2 }),
    );
    ['ssd', 'eun', 'mus', 'gwc'].forEach((id, i) => {
      const p = byId(id);
      expect(items[i]).toHaveTextContent(p.name.en);
      expect(items[i]).toHaveTextContent(p.nameKo);
      // 1번은 출발지(대전역)에서의 도보 시간 + 지하철 대안(데이터 start.hint)
      const walk =
        i === 0
          ? `${t('en', 'course.walkFromStart', { min: p.walkMinFromPrev, start: t('en', 'course.mapStation') })} · or Line 1, 1 stop to Jungang-ro`
          : t('en', 'course.walkMin', { min: p.walkMinFromPrev });
      expect(items[i]).toHaveTextContent(walk);
    });
    // 원도심 코스에는 시즌 카드 없음
    expect(document.querySelector('.season')).toBeNull();
  });

  it('전통시장 코스(?c=jungang-market): 4곳 순서·대전역 출발 도보 시간·야시장 시즌 카드 (T5.1)', () => {
    renderCourse('/course?c=jungang-market');
    expect(screen.getAllByText('Jungang Market Food Walk').length).toBeGreaterThan(0);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(
      items.map((li) => li.querySelector('.course-stop')?.getAttribute('data-testid')),
    ).toEqual(['stop-sy', 'stop-gc', 'stop-sj', 'stop-hg']);
    // 시장 코스 출발지에는 지하철 대안이 없음
    expect(items[0].querySelector('.course-walk')?.textContent).toBe(
      t('en', 'course.walkFromStart', { min: byId('sy').walkMinFromPrev, start: 'Daejeon Stn' }),
    );
    expect(screen.getByTestId('season-totojeul-2026')).toHaveTextContent('Totojeul Food Festa');
    expect(screen.getByTestId('start-walking')).toHaveAttribute('href', naverWalkUrl(byId('sy')));
  });

  it('모르는 코스 id면 기본 코스(원도심)', () => {
    renderCourse('/course?c=nope');
    expect(screen.getAllByText('Old Downtown Half-day').length).toBeGreaterThan(0);
  });

  it('확인 상태(혼합 = 정류장마다): verified면 "확인일 YYYY-MM-DD", 아니면 날짜 없이 "현장 확인 전 · 예시 정보"', () => {
    renderCourse();
    expect(screen.getByTestId('check-ssd')).toHaveTextContent(
      t('en', 'course.checked', { date: byId('ssd').checkedAt }),
    );
    for (const id of ['eun', 'mus', 'gwc']) {
      const el = screen.getByTestId(`check-${id}`);
      expect(el).toHaveTextContent(t('en', 'place.unverified'));
      expect(el.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
    // 확인/미확인이 섞이면 정류장마다만 표시하고 코스 요약 줄은 없음 (DESIGN.md 6장)
    expect(screen.queryByTestId('course-unverified')).toBeNull();
    expect(screen.queryByTestId('course-checked')).toBeNull();
  });

  it('확인 상태(모두 확인, 확인일이 서로 다름): 정류장마다 각자 확인일, 코스 요약으로 합치지 않음 (R1 M-1)', () => {
    const b = getBundle('downtown-halfday')!;
    const saved = b.places.map((p) => ({ verified: p.verified, checkedAt: p.checkedAt }));
    const dates = ['2026-11-01', '2026-11-10', '2026-11-18', '2026-11-25'];
    b.places.forEach((p, i) => Object.assign(p, { verified: true, checkedAt: dates[i] }));
    try {
      renderCourse();
      b.places.forEach((p, i) => {
        const el = screen.getByTestId(`check-${p.id}`);
        expect(el).toHaveTextContent(t('en', 'course.checked', { date: dates[i] }));
        expect(el).toHaveClass('is-verified');
      });
      expect(screen.queryByTestId('course-unverified')).toBeNull();
      expect(screen.queryByText(t('en', 'place.unverified'))).toBeNull();
    } finally {
      b.places.forEach((p, i) => Object.assign(p, saved[i]));
    }
  });

  it('영업시간은 정류장 버튼의 접근 가능한 이름에 포함, 이동 시간은 한 번만 (R1 M-2)', () => {
    renderCourse();
    // testing-library가 계산한 접근 가능한 이름 (dom-accessibility-api)
    let name = '';
    screen.getByRole('button', {
      name: (n, el) => {
        if (el === screen.getByTestId('stop-ssd')) name = n;
        return el === screen.getByTestId('stop-ssd');
      },
    });
    expect(name).toContain(`${t('en', 'place.hours')} 08:00–22:00`);
    expect(name).toContain(
      t('en', 'course.walkFromStart', { min: 11, start: t('en', 'course.mapStation') }),
    );
    // 보이는 "11 min"은 낭독기에서 숨겨 도보 문구와 중복되지 않음
    expect(name.split('11 min').length - 1).toBe(1);
    expect(screen.getByTestId('hours-ssd')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('hours-ssd').closest('[aria-hidden="true"]')).toBeNull();
    // 하루 종일 여는 거리는 영업시간 없음
    expect(screen.queryByTestId('hours-eun')).toBeNull();
    // 이름으로 버튼을 찾을 수 있음
    expect(screen.getByRole('button', { name: /Sungsimdang.*08:00–22:00/ })).toBe(
      screen.getByTestId('stop-ssd'),
    );
  });

  it('확인 상태(모두 미확인 = 요약 한 줄): 시장 코스는 4곳 모두 확인 전 → 코스에 한 줄, 정류장별 표시 없음', () => {
    renderCourse('/course?c=jungang-market');
    expect(screen.getByTestId('course-unverified')).toHaveTextContent(t('en', 'place.unverified'));
    expect(screen.getAllByText(t('en', 'place.unverified'))).toHaveLength(1);
    for (const id of ['sy', 'gc', 'sj', 'hg']) {
      expect(screen.queryByTestId(`check-${id}`)).toBeNull();
    }
    expect(screen.queryByTestId('course-checked')).toBeNull();
  });

  it('썸네일: 사진이 있으면 사진(빈 alt, lazy), 없으면 파란 글자 타일(한글 2~3자)', () => {
    // 사진 없는 경우는 mock으로 만듦 (T6.10 이후 광천식당에도 직접 촬영 사진이 있음)
    noPhoto.add('gwc');
    renderCourse();
    const thumb = (id: string) => screen.getByTestId(`stop-${id}`).querySelector('.course-thumb')!;
    for (const id of ['ssd', 'eun', 'mus']) {
      const img = thumb(id).querySelector('img')!;
      expect(img).toHaveAttribute('src', photoUrl(photoForPlace(id)!));
      expect(img).toHaveAttribute('alt', '');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(thumb(id)).toHaveAttribute('data-kind', 'photo');
      expect(thumb(id)).toHaveAttribute('data-photo-kind', 'place');
    }
    expect(thumb('gwc')).toHaveAttribute('data-kind', 'tile');
    expect(thumb('gwc')).not.toHaveAttribute('data-photo-kind');
    expect(thumb('gwc').querySelector('img')).toBeNull();
    expect(thumb('gwc')).toHaveTextContent('광천4');
    // 번호 동그라미
    expect(thumb('ssd').querySelector('.course-thumb__no')).toHaveTextContent('1');
    // 출발지(대전역)는 대전역 사진 + "Start"
    const origin = screen.getByTestId('course-origin');
    expect(origin.querySelector('img')).toHaveAttribute('src', photoUrl(photoForPlace('djs')!));
    expect(origin).toHaveTextContent(t('en', 'course.startTag'));
    expect(origin).toHaveTextContent('대전역');
    expect(origin).toHaveTextContent('or Line 1, 1 stop to Jungang-ro');
  });

  it('원도심 코스(T6.10): 광천식당은 직접 촬영 가게 사진 썸네일(kind place)', () => {
    renderCourse();
    const el = screen.getByTestId('stop-gwc').querySelector('.course-thumb')!;
    expect(el).toHaveAttribute('data-kind', 'photo');
    expect(el).toHaveAttribute('data-photo-kind', 'place');
    expect(el.querySelector('img')).toHaveAttribute('src', photoUrl(photoForPlace('gwc')!));
    expect(el.querySelector('img')!.getAttribute('src')).toMatch(/gwangcheon-sikdang.webp$/);
  });

  it('시장 코스: 수연분식은 직접 촬영 가게 사진(T6.10), 나머지 세 가게는 음식 예시 사진, 출발지는 대전역 사진', () => {
    renderCourse('/course?c=jungang-market');
    const thumb = (id: string) => screen.getByTestId(`stop-${id}`).querySelector('.course-thumb')!;
    expect(thumb('sy')).toHaveAttribute('data-kind', 'photo');
    expect(thumb('sy')).toHaveAttribute('data-photo-kind', 'place');
    expect(thumb('sy').querySelector('img')!.getAttribute('src')).toMatch(/suyeon-bunsik.webp$/);
    expect(thumb('sy').querySelector('.course-thumb__tile')).toBeNull();
    for (const id of ['gc', 'sj', 'hg']) {
      expect(thumb(id)).toHaveAttribute('data-kind', 'photo');
      expect(thumb(id)).toHaveAttribute('data-photo-kind', 'dish-example');
      expect(thumb(id).querySelector('img')).toHaveAttribute('src', photoUrl(photoForPlace(id)!));
      expect(thumb(id).querySelector('.course-thumb__tile')).toBeNull();
    }
    expect(screen.getByTestId('course-origin').querySelector('img')).not.toBeNull();
  });

  it('음식 예시 정류장(R1 M-01): 이름 아래 "음식 예시 사진 · 이 가게 사진 아님", 장소 사진·글자 타일 정류장에는 없음', () => {
    renderCourse('/course?c=jungang-market');
    for (const id of ['gc', 'sj', 'hg']) {
      const note = screen.getByTestId(`dish-note-${id}`);
      expect(note).toHaveTextContent(t('en', 'photo.dishExample'));
      // aria-hidden 썸네일 밖(정류장 글자 영역)에 있어 낭독기에도 읽힘
      expect(note.closest('[aria-hidden="true"]')).toBeNull();
      expect(note.closest('.course-stop__body')).not.toBeNull();
      expect(screen.getByTestId(`stop-${id}`)).toHaveAccessibleName(
        expect.stringContaining(t('en', 'photo.dishExample')),
      );
    }
    // 수연분식: 직접 촬영 가게 사진이라 안내 없음 (T6.10)
    expect(screen.queryByTestId('dish-note-sy')).toBeNull();
    // 원도심: 실제 장소 사진(ssd·eun·mus, 직접 촬영 gwc)에는 안내 없음
    cleanup();
    renderCourse();
    for (const id of ['ssd', 'eun', 'mus', 'gwc']) {
      expect(screen.queryByTestId(`dish-note-${id}`)).toBeNull();
    }
  });

  it.each([
    ['ja', '料理のイメージ写真 · この店の写真ではありません'],
    ['zh', '菜品示例照片 · 非本店照片'],
  ] as const)('음식 예시 정류장 안내 (%s)', (lang, text) => {
    useAppStore.setState({ lang });
    renderCourse('/course?c=jungang-market');
    expect(screen.getByTestId('dish-note-gc')).toHaveTextContent(text);
  });

  it('시장 코스: 사진이 없으면 글자 타일(로직 유지)', () => {
    for (const id of ['sy', 'gc', 'sj', 'hg']) noPhoto.add(id);
    renderCourse('/course?c=jungang-market');
    expect(
      ['sy', 'gc', 'sj', 'hg'].map(
        (id) => screen.getByTestId(`stop-${id}`).querySelector('.course-thumb__tile')?.textContent,
      ),
    ).toEqual(['수연', '개천', '생일집', '홍가']);
    expect(screen.queryByTestId('course-dish-credit')).toBeNull();
    expect(screen.queryByTestId('dish-note-gc')).toBeNull();
  });

  it('사진 출처(원도심): 위키미디어 장소 사진 줄 + 직접 촬영 줄(CC 아님), 음식 예시 줄 없음', () => {
    renderCourse();
    expect(screen.getByTestId('course-photo-credit')).toHaveTextContent(
      t('en', 'course.photoCredits', {
        list: 'Minseong Kim, Trainholic (CC BY-SA 4.0), Yoo Chung (CC BY-SA 2.5)',
      }),
    );
    expect(screen.getByTestId('course-photo-credit')).not.toHaveTextContent(/Edulleo|운영자/);
    expect(screen.getByTestId('course-own-credit')).toHaveTextContent(
      'Photo: Edulleo team (own photo)',
    );
    expect(screen.queryByTestId('course-dish-credit')).toBeNull();
  });

  it('직접 촬영 출처 줄 (ja)', () => {
    useAppStore.setState({ lang: 'ja' });
    renderCourse();
    expect(screen.getByTestId('course-own-credit')).toHaveTextContent(
      '写真: Edulleo運営チーム撮影',
    );
  });

  it('사진이 모두 위키미디어 사진이면 직접 촬영 줄 없음', () => {
    noPhoto.add('gwc');
    renderCourse();
    expect(screen.queryByTestId('course-own-credit')).toBeNull();
  });

  it('사진 출처(시장 코스): 대전역 사진 줄 + 직접 촬영 줄 + 음식 예시 3장 줄(BY·BY-SA 구분, 이 가게들에서 찍지 않음)', () => {
    renderCourse('/course?c=jungang-market');
    expect(screen.getByTestId('course-own-credit')).toHaveTextContent(
      'Photo: Edulleo team (own photo)',
    );
    expect(screen.getByTestId('course-photo-credit')).toHaveTextContent(
      t('en', 'course.photoCredits', { list: 'Minseong Kim (CC BY-SA 4.0)' }),
    );
    const dish = screen.getByTestId('course-dish-credit');
    expect(dish).toHaveTextContent(
      t('en', 'photo.dishCredits', {
        list: 'avlxyz (CC BY-SA 2.0), pcamp (CC BY 2.0), 국립국어원 (CC BY-SA 2.0 KR)',
      }),
    );
    expect(dish).toHaveTextContent('not taken at these shops');
  });

  it('정류장 줄: 사용자 언어 이름 + 한국어 이름·동네 (T6.3: 메뉴 수·문장 수 알약은 시안대로 뺌)', () => {
    renderCourse();
    const ssd = screen.getByTestId('stop-ssd');
    expect(ssd.querySelector('.course-stop__name')).toHaveTextContent(byId('ssd').name.en);
    expect(ssd.querySelector('.course-stop__sub')).toHaveTextContent(
      `${byId('ssd').nameKo} · ${byId('ssd').areaLocal.en}`,
    );
    expect(ssd.querySelector('.ui-pill')).toBeNull();
  });

  it('목록 클릭 → 장소 상세, 화면은 place_view를 직접 기록하지 않음', () => {
    renderCourse();
    fireEvent.click(screen.getByTestId('stop-mus'));
    expect(screen.getByTestId('probe')).toHaveTextContent('/place/mus');
    expect(useAppStore.getState().events).toEqual([]);
  });

  it('지도 핀 클릭 → 장소 상세', () => {
    renderCourse();
    fireEvent.click(screen.getByTestId('map-pin-gwc'));
    expect(screen.getByTestId('probe')).toHaveTextContent('/place/gwc');
  });

  it('오프라인이면 약도, 핀 이름은 "번호. 사용자 언어 장소명"', () => {
    renderCourse();
    expect(screen.getByTestId('map-sketch')).toBeInTheDocument();
    expect(screen.getByTestId('map-pin-ssd')).toHaveAttribute(
      'aria-label',
      `1. ${byId('ssd').name.en}`,
    );
  });

  it('Start walking: 기록이 없으면 1번 정류장 네이버 도보 길찾기 + Google 장소 보기', () => {
    renderCourse();
    const walk = screen.getByTestId('start-walking');
    expect(walk).toHaveTextContent(t('en', 'course.startWalk'));
    expect(walk).toHaveAttribute('href', naverWalkUrl(byId('ssd')));
    expect(walk).toHaveAttribute('target', '_blank');
    expect(walk.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText(t('en', 'course.dirNext', { n: 1 }))).toBeInTheDocument();
    const g = screen.getByTestId('google-maps');
    expect(g).toHaveAttribute('href', googlePlaceUrl(byId('ssd')));
    expect(g).toHaveTextContent(t('en', 'course.googleMaps', { n: 1 }));
    expect(screen.getByTestId('course-noapp')).toHaveTextContent(t('en', 'course.noApp'));
  });

  it('Start walking: 2번을 본 뒤면 3번 정류장으로', () => {
    useAppStore.setState({ events: [{ type: 'place_view', placeId: 'eun', t: 1 }] });
    renderCourse();
    const walk = screen.getByTestId('start-walking');
    expect(walk).toHaveTextContent(t('en', 'course.walkToStop', { n: 3 }));
    expect(walk).toHaveAttribute('href', naverWalkUrl(byId('mus')));
    expect(screen.getByTestId('google-maps')).toHaveAttribute('href', googlePlaceUrl(byId('mus')));
  });

  describe.each([
    ['downtown-halfday', '/course', ['ssd', 'eun', 'mus', 'gwc']],
    ['jungang-market', '/course?c=jungang-market', ['sy', 'gc', 'sj', 'hg']],
  ] as const)('아래 고정 길찾기 버튼 (%s)', (_id, url, ids) => {
    const view = (placeId: string) => ({ type: 'place_view' as const, placeId, t: 1 });

    it('첫 진입(기록 없음): "Start with stop 1" → 1번 네이버 도보 길찾기', () => {
      renderCourse(url);
      const walk = screen.getByTestId('start-walking');
      expect(walk).toHaveTextContent(t('en', 'course.startWalk'));
      expect(walk).toHaveAttribute('href', naverWalkUrl(byId(ids[0])));
      expect(walk.closest('.course-dock')).not.toBeNull();
      expect(screen.getByText(t('en', 'course.dirNext', { n: 1 }))).toBeInTheDocument();
      expect(screen.getByTestId('google-maps')).toHaveAttribute(
        'href',
        googlePlaceUrl(byId(ids[0])),
      );
    });

    it('중간 방문(1번을 봄): 기존 다음 정류장 문구 "Walk to stop 2"·2번 주소', () => {
      useAppStore.setState({ events: [view(ids[0])] });
      renderCourse(url);
      const walk = screen.getByTestId('start-walking');
      expect(walk).toHaveTextContent(t('en', 'course.walkToStop', { n: 2 }));
      expect(walk).not.toHaveTextContent(t('en', 'course.startWalk'));
      expect(walk).toHaveAttribute('href', naverWalkUrl(byId(ids[1])));
      expect(screen.getByText(t('en', 'course.dirNext', { n: 2 }))).toBeInTheDocument();
      expect(screen.getByTestId('google-maps')).toHaveTextContent(
        t('en', 'course.googleMaps', { n: 2 }),
      );
    });

    it('마지막 정류장을 봄: 마지막 정류장 그대로 (코스 끝)', () => {
      useAppStore.setState({ events: [view(ids[0]), view(ids[3])] });
      renderCourse(url);
      const walk = screen.getByTestId('start-walking');
      expect(walk).toHaveTextContent(t('en', 'course.walkToStop', { n: 4 }));
      expect(walk).toHaveAttribute('href', naverWalkUrl(byId(ids[3])));
      expect(screen.getByTestId('google-maps')).toHaveAttribute(
        'href',
        googlePlaceUrl(byId(ids[3])),
      );
      expect(screen.getByTestId('course-noapp')).toHaveTextContent(t('en', 'course.noApp'));
    });
  });

  it('오프라인 약도: 같은 색 체계(흰 핀·파란 경로) + 구간 분 칩 + 약도 안내', () => {
    renderCourse();
    const sketch = screen.getByTestId('map-sketch');
    expect(sketch.querySelector('[data-testid="map-line"]')).toHaveAttribute('data-route', 'walk');
    expect(
      screen.getByTestId('map-pin-ssd').querySelector('.cmap-sketch__dot')?.getAttribute('fill'),
    ).toBe('#ffffff');
    const chips = sketch.querySelectorAll('[data-testid^="map-chip-"]');
    expect(chips.length).toBeGreaterThan(0);
    chips.forEach((c) => expect(c.textContent).toMatch(/^\d+ min$/));
    expect(screen.getByText(t('en', 'course.mapOffline'))).toBeInTheDocument();
  });

  it('언어 즉시 전환 (ja·zh)', () => {
    renderCourse();
    act(() => useAppStore.setState({ lang: 'ja' }));
    expect(screen.getByTestId('stop-ssd')).toHaveTextContent(byId('ssd').name.ja);
    expect(screen.getByTestId('start-walking')).toHaveTextContent(t('ja', 'course.startWalk'));
    act(() => useAppStore.setState({ lang: 'zh' }));
    expect(screen.getByTestId('check-eun')).toHaveTextContent(t('zh', 'place.unverified'));
    expect(screen.getByTestId('map-pin-ssd')).toHaveAttribute(
      'aria-label',
      `1. ${byId('ssd').name.zh}`,
    );
  });

  it('상단 문장 모음 버튼 → /phrases', () => {
    renderCourse();
    fireEvent.click(screen.getByRole('button', { name: t('en', 'nav.phrases') }));
    expect(screen.getByTestId('probe')).toHaveTextContent('/phrases');
  });

  it('누르는 요소는 공용 44px 클래스 또는 화면 CSS의 44px 규칙을 가짐', () => {
    renderCourse();
    expect(screen.getByTestId('start-walking')).toHaveClass('ui-btn');
    expect(screen.getByTestId('stop-ssd')).toHaveClass('course-stop');
    expect(screen.getByTestId('google-maps')).toHaveClass('course-google');
  });
});
