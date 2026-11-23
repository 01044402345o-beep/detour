/** R2-L01: 포커스 후보 필터와 Tab 순환 (jsdom: 인라인 스타일·hidden으로 검증) */
import { focusableIn, trapTab } from './overlay';

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.tabIndex = -1;
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

const ids = (els: HTMLElement[]) => els.map((e) => e.id);

function tab(shift = false): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, cancelable: true });
  return e;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusableIn: 비활성·숨김 요소 제외', () => {
  it('display:none·visibility:hidden 조상, disabled tabindex=0, 음수 tabindex, disabled fieldset, hidden·inert 조상', () => {
    const root = mount(`
      <button id="ok1">a</button>
      <div style="display:none"><button id="dn">x</button></div>
      <div style="visibility:hidden"><button id="vh">x</button></div>
      <button id="dis" disabled tabindex="0">x</button>
      <span id="neg" tabindex="-2">x</span>
      <fieldset disabled><input id="fs" /></fieldset>
      <div hidden><button id="hid">x</button></div>
      <div inert><button id="ine">x</button></div>
      <a id="nohref">x</a>
      <span id="ok2" tabindex="0">b</span>
      <input id="ok3" />
    `);
    expect(ids(focusableIn(root))).toEqual(['ok1', 'ok2', 'ok3']);
  });
});

describe('trapTab: 숨김 요소가 끝에 있어도 순환', () => {
  it('숨김 버튼이 맨 끝: 실제 마지막 요소에서 Tab → 첫 요소', () => {
    const root = mount(
      '<button id="first">1</button><button id="last">2</button><button id="h" style="display:none">3</button>',
    );
    document.getElementById('last')!.focus();
    const e = tab();
    expect(trapTab(e, root)).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('first');
  });

  it('숨김 버튼이 맨 앞: 첫 실제 요소에서 Shift+Tab → 마지막 실제 요소', () => {
    const root = mount(
      '<div style="visibility:hidden"><button id="h">0</button></div><button id="first">1</button><button id="last">2</button>',
    );
    document.getElementById('first')!.focus();
    const e = tab(true);
    expect(trapTab(e, root)).toBe(true);
    expect(document.activeElement?.id).toBe('last');
  });

  it('focus가 실패하면 같은 방향 다음 후보, 모두 실패하면 컨테이너', () => {
    const root = mount('<button id="a">a</button><button id="b">b</button>');
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    b.focus();
    const spy = vi.spyOn(a, 'focus').mockImplementation(() => {}); // 첫 후보 focus 실패
    trapTab(tab(), root);
    expect(document.activeElement).toBe(b);
    spy.mockRestore();

    root.focus();
    const sa = vi.spyOn(a, 'focus').mockImplementation(() => {});
    const sb = vi.spyOn(b, 'focus').mockImplementation(() => {});
    trapTab(tab(true), root);
    expect(document.activeElement).toBe(root);
    sa.mockRestore();
    sb.mockRestore();
  });
});
