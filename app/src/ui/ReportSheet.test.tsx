import { act, fireEvent, render, screen } from '@testing-library/react';
import { getPlace } from '../data';
import { DICTS } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { ReportSheet } from './ReportSheet';
import { TOAST_MS, ToastProvider } from '.';

function renderSheet(props: Partial<Parameters<typeof ReportSheet>[0]> = {}) {
  const onClose = vi.fn();
  const onSent = vi.fn();
  render(
    <ToastProvider>
      <ReportSheet open onClose={onClose} onSent={onSent} {...props} />
    </ToastProvider>,
  );
  return { onClose, onSent };
}

beforeEach(() => {
  useAppStore.getState().resetData();
  useAppStore.setState({ lang: 'en' });
});
afterEach(() => {
  useAppStore.getState().resetData();
  useAppStore.setState({ lang: null });
  vi.useRealTimers();
});

describe('ReportSheet (F-14)', () => {
  it('제목과 4종 버튼을 목업 순서로 보여 줌', () => {
    renderSheet({ placeId: 'ssd' });
    const dialog = screen.getByRole('dialog', { name: 'What is different?' });
    expect(dialog).toBeInTheDocument();
    const kinds = [...dialog.querySelectorAll('[data-kind]')].map((b) =>
      b.getAttribute('data-kind'),
    );
    expect(kinds).toEqual(['closed', 'menu', 'price', 'other']);
    for (const name of ['Closed or moved', 'Menu changed', 'Price changed', 'Something else']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('장소 부제: 사용자 언어 이름 + verified:false면 "현장 확인 전" 문구', () => {
    renderSheet({ placeId: 'ssd' });
    const sub = screen.getByTestId('report-sheet-place');
    expect(sub).toHaveTextContent('Sungsimdang Main Store');
    expect(sub).toHaveTextContent('Not yet verified on site · sample info');
  });

  it('항목 선택 → reports·report_sent 기록, onSent·onClose, 감사 토스트', () => {
    vi.useFakeTimers();
    const { onClose, onSent } = renderSheet({ placeId: 'ssd' });
    fireEvent.click(screen.getByRole('button', { name: /Price changed/ }));
    const s = useAppStore.getState();
    expect(s.reports).toHaveLength(1);
    expect(s.reports[0]).toMatchObject({ kind: 'price', placeId: 'ssd' });
    expect(s.events.filter((e) => e.type === 'report_sent')).toEqual([
      expect.objectContaining({ type: 'report_sent', kind: 'price', placeId: 'ssd' }),
    ]);
    expect(onSent).toHaveBeenCalledWith('price');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('toast-region')).toHaveTextContent("Thanks! We'll re-check it.");
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.getByTestId('toast-region')).toBeEmptyDOMElement();
  });

  it('placeId 없음 → 부제 없이 장소 없는 제보', () => {
    renderSheet();
    expect(screen.queryByTestId('report-sheet-place')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Something else/ }));
    expect(useAppStore.getState().reports[0]).toEqual({ kind: 'other', t: expect.any(Number) });
  });

  it('데이터에 없는 placeId → 부제 없음, placeId 생략하고 저장', () => {
    renderSheet({ placeId: 'nope' });
    expect(screen.queryByTestId('report-sheet-place')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Closed or moved/ }));
    expect(useAppStore.getState().reports[0]).not.toHaveProperty('placeId');
  });

  it('언어 전환: 일본어 문구', () => {
    useAppStore.setState({ lang: 'ja' });
    renderSheet({ placeId: 'gwc' });
    expect(screen.getByTestId('report-sheet-place')).toHaveTextContent(getPlace('gwc')!.name.ja);
    expect(screen.getByRole('dialog')).toHaveAccessibleName(DICTS.ja.report.title);
    expect(screen.getByRole('button', { name: new RegExp(DICTS.ja.report.menu) })).toBeVisible();
  });

  it('닫힌 상태(open=false)는 아무것도 그리지 않음', () => {
    render(
      <ToastProvider>
        <ReportSheet open={false} onClose={() => {}} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
