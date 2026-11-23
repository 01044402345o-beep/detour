/**
 * 하드코딩 문구 검사 (T1.2 완료 조건: 예외 목록 밖 하드코딩 문구 없음).
 * hardcodeCheck.test.ts가 src 전체를 이 규칙으로 검사합니다. 앱 번들에는 들어가지 않습니다(테스트 전용).
 *
 * 규칙
 *  1. 검사 대상: src/ 아래 모든 .ts·.tsx (EXEMPT_PATHS 제외).
 *  2. 한글·가나·한자가 든 문자열 리터럴·템플릿·JSX 텍스트 → 어디에 있든 위반.
 *  3. 라틴 문자가 든 JSX 텍스트, 보이는 JSX 속성값(aria-label·title·placeholder·alt 등,
 *     button·option·input[type=submit|button|reset]의 value), JSX 자식 표현식 안의 문자열 → 위반.
 *  4. 문장형 라틴 문자열(대문자로 시작하는 2단어 이상, 또는 공백이 있고 . ! ? 로 끝남)
 *     → 변수 초기값·배열 요소·함수 인자·객체 값 등 어디에 있든 위반.
 *     단 console.*(...)·…Error(...) 인자(개발자용)는 제외.
 *  5. 타입 위치·import 경로, 글자(\p{L})가 없는 문자열(숫자·기호·이모지),
 *     ALLOWED_LITERALS(직원·운영자 한국어 고정 문구, 언어 이름, 상호명, 단위)는 허용.
 *
 * 정적 검사가 못 잡는 경로(변수로 넘긴 한 단어 영어 'Open', 동적으로 조합한 문구)는
 * Phase 2 E2E 5(3개 언어 실제 표시 확인)가 맡습니다.
 */
import ts from 'typescript';
import { LANG_NAMES } from './langNames';
import { OPERATOR_KO } from './operatorKo';
import { STAFF_KO } from './staffKo';

/** 하드코딩 검사 예외 목록 — 파일 단위 (task.md T1.2) */
export const EXEMPT_PATHS: readonly { pattern: RegExp; reason: string }[] = [
  {
    pattern: /^src\/i18n\//,
    reason: '사전(en/ja/zh)·한국어 고정 문구(직원·운영자)·언어 이름 정의',
  },
  { pattern: /^src\/data\//, reason: '한국어 콘텐츠 JSON(학습 문장·메뉴명·상호명)과 그 로더' },
  { pattern: /^src\/domain\//, reason: '한국어 주문 문장 생성·채점(한국어 콘텐츠)' },
  { pattern: /\.test\.tsx?$/, reason: '테스트 파일' },
  { pattern: /^src\/test\//, reason: '테스트 설정' },
];

/** 상호명·서비스명 (PRD 4장). 화면 언어와 관계없이 그대로 씁니다. */
export const BRAND_TERMS: readonly string[] = [
  'Daejeon Detour',
  'Daejeon',
  'Detour',
  'D',
  'NAVER',
  '성심당',
  '성심당 본점',
  '으능정이 문화의거리',
  '스카이로드',
  '대전근현대사전시관',
  '광천식당',
];

/** 한국어 콘텐츠 용어: 수량 단위 (types.ts Counter) */
export const KOREAN_CONTENT_TERMS: readonly string[] = ['개', '인분', '공기'];

function flattenStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenStrings);
  return [];
}

/** 하드코딩 검사 예외 목록 — 문자열 단위 */
export const ALLOWED_LITERALS: ReadonlySet<string> = new Set([
  ...flattenStrings(STAFF_KO),
  ...flattenStrings(OPERATOR_KO),
  ...flattenStrings(LANG_NAMES),
  ...BRAND_TERMS,
  ...KOREAN_CONTENT_TERMS,
]);

/** 사용자에게 보이는 JSX 속성 (value는 isVisibleValue에서 요소별로 판단) */
export const VISIBLE_ATTRS: ReadonlySet<string> = new Set([
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'title',
  'placeholder',
  'alt',
  'label',
]);

const CJK = /[\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const LETTER = /\p{L}/u;
/** 대문자로 시작하고 공백으로 나뉜 단어가 2개 이상 */
const SENTENCE_CAPITAL = /^[A-Z][a-z'’]+(?:\s[A-Za-z'’]+)+[.!?…]?$/;
/** 라틴 문자와 공백을 포함하고 . ! ? 로 끝남 */
const SENTENCE_END = /^(?=.*[A-Za-z])(?=.*\s).*[.!?]$/s;

export type Violation = { file: string; line: number; text: string };

/** 문장형 라틴 문자열인지 (한 단어·소문자 식별자·경로는 아님) */
export function isLatinSentence(text: string): boolean {
  const s = text.trim();
  return SENTENCE_CAPITAL.test(s) || SENTENCE_END.test(s);
}

/** 'src/...' 형태 경로가 검사 대상인지 */
export function isScanned(relPath: string): boolean {
  const p = relPath.replace(/\\/g, '/');
  if (EXEMPT_PATHS.some((e) => e.pattern.test(p))) return false;
  return /^src\/.*\.tsx?$/.test(p);
}

function isAllowed(text: string): boolean {
  const s = text.trim();
  return !LETTER.test(s) || ALLOWED_LITERALS.has(s);
}

function isTypeOrModulePosition(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isLiteralTypeNode(parent)) return true;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isExternalModuleReference(parent)) return true;
  if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword)
    return true;
  return false;
}

/** 템플릿·괄호·조건식·논리식·덧셈을 거쳐 리터럴이 속한 식의 최상위까지 올라감 */
function climb(node: ts.Node): { cur: ts.Node; parent: ts.Node | undefined } {
  let cur: ts.Node = node;
  let parent = cur.parent;
  while (
    parent &&
    (ts.isParenthesizedExpression(parent) ||
      (ts.isConditionalExpression(parent) && parent.condition !== cur) ||
      (ts.isBinaryExpression(parent) &&
        [
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.QuestionQuestionToken,
          ts.SyntaxKind.PlusToken,
        ].includes(parent.operatorToken.kind)) ||
      ts.isTemplateSpan(parent) ||
      ts.isTemplateExpression(parent))
  ) {
    cur = parent;
    parent = cur.parent;
  }
  return { cur, parent };
}

/** value 속성이 화면에 보이는 요소: button·option·input[type=submit|button|reset] */
function isVisibleValue(attr: ts.JsxAttribute): boolean {
  const el = attr.parent.parent;
  const tag = el.tagName.getText();
  if (tag === 'button' || tag === 'option') return true;
  if (tag !== 'input') return false;
  const type = el.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === 'type',
  );
  const init = type?.initializer;
  return !!init && ts.isStringLiteral(init) && ['submit', 'button', 'reset'].includes(init.text);
}

function isVisibleAttr(attr: ts.JsxAttribute): boolean {
  const name = attr.name.getText();
  return name === 'value' ? isVisibleValue(attr) : VISIBLE_ATTRS.has(name);
}

/** 리터럴이 화면에 보이는 JSX 위치(자식 표현식·보이는 속성)에 있는지 */
function isVisibleJsxPosition(node: ts.Node): boolean {
  const { parent } = climb(node);
  if (!parent) return false;
  if (ts.isJsxAttribute(parent)) return isVisibleAttr(parent);
  if (ts.isJsxExpression(parent)) {
    const owner = parent.parent;
    if (ts.isJsxAttribute(owner)) return isVisibleAttr(owner);
    return ts.isJsxElement(owner) || ts.isJsxFragment(owner);
  }
  return false;
}

/** console.*(...)·…Error(...) 인자 등 개발자용 위치인지 */
function isDeveloperPosition(node: ts.Node): boolean {
  const { cur, parent } = climb(node);
  if (!parent || !(ts.isCallExpression(parent) || ts.isNewExpression(parent))) return false;
  if (!parent.arguments?.some((a) => a === cur)) return false;
  const callee = parent.expression;
  if (ts.isPropertyAccessExpression(callee) && callee.expression.getText() === 'console') {
    return true;
  }
  return ts.isIdentifier(callee) && /Error$/.test(callee.text);
}

/** 템플릿 조각(head·middle·tail)이면 그 템플릿 식 전체, 아니면 자기 자신 */
function wholeLiteral(node: ts.Node): ts.Node {
  if (ts.isTemplateHead(node)) return node.parent;
  if (ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) return node.parent.parent;
  return node;
}

/** 소스 한 개를 검사해 위반 목록을 돌려줍니다. */
export function findHardcoded(source: string, file: string): Violation[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: Violation[] = [];
  const report = (node: ts.Node, text: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push({ file, line: line + 1, text: text.trim() });
  };

  const visit = (node: ts.Node) => {
    if (ts.isTemplateExpression(node)) {
      // 문장형 규칙은 템플릿 전체로 판단 (`Saved ${n} items.` → 'Saved x items.')
      const pieces = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      if (
        !isTypeOrModulePosition(node) &&
        !CJK.test(pieces.join('')) &&
        !isVisibleJsxPosition(node) &&
        !ALLOWED_LITERALS.has(pieces.join('x').trim()) &&
        isLatinSentence(pieces.join('x')) &&
        !isDeveloperPosition(node)
      ) {
        report(node, pieces.join('${…}'));
      }
    } else if (ts.isJsxText(node)) {
      const text = node.getText(sf);
      if (!isAllowed(text)) report(node, text);
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const text = node.text;
      if (!isTypeOrModulePosition(node) && !isAllowed(text)) {
        const whole = wholeLiteral(node);
        const isPiece = whole !== node; // 템플릿 조각: 문장형 규칙은 위에서 템플릿 전체로 판단
        if (
          CJK.test(text) ||
          isVisibleJsxPosition(whole) ||
          (!isPiece && isLatinSentence(text) && !isDeveloperPosition(whole))
        ) {
          report(node, text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
