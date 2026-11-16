// The messages of an .astro template, found with no markup in the source. A message is one block of copy (a
// paragraph, a heading, a button label, an alt text): its text with each inline element written as <n>…</n> and each
// component or expression as {n}, so a translation can move them. `analyze` also returns the template with every
// message replaced by a call to the translator, which rebuilds the inline elements around the translated words.
// Text that comes from code (frontmatter, data modules, collections, a ternary's branches) is translated by its value
// where the template shows it: every `{expression}` and copy attribute goes through `$t.v`, and an island's props
// through `$t.deep`. `analyze` and `analyzeModule` list those strings too, so they are in the catalog.
import { createHash } from 'node:crypto';
import { parse } from '@astrojs/compiler-rs';
import { decodeHTML } from 'entities';
import { isContent, isCopy, isEitherKey, isWiringKey } from './rules';

export type Message = {
  key: string;
  text: string;
  /** What each placeholder stands for (`span`, `Link`, `project.title`), by its number. */
  slots: string[];
};

type Node = { type: string; start: number; end: number; [k: string]: any };

/** Elements whose content isn't copy: left as they are (inside a message, they are a placeholder). */
const OPAQUE = new Set(['script', 'style', 'pre', 'code', 'kbd', 'samp', 'var', 'textarea', 'svg', 'math', 'template']);
/** HTML elements that sit inside a sentence: their words are part of the message around them. */
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'button', 'cite', 'data', 'del', 'dfn', 'em', 'i', 'ins', 'label', 'mark', 'output', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u']);
/** HTML elements without copy that can sit inside a sentence, as a placeholder (scripts and styles never do). */
const ATOMS = new Set(['br', 'wbr', 'img', 'picture', 'input', 'select', 'meter', 'progress', 'slot', ...[...OPAQUE].filter((t) => t !== 'script' && t !== 'style')]);
/** Attributes whose value is copy. */
const ATTRS = new Set(['alt', 'title', 'placeholder', 'label', 'description', 'aria-label', 'aria-description', 'aria-placeholder', 'aria-roledescription']);

const LETTER = /\p{L}/u;
const collapse = (s: string) => s.replace(/\s+/g, ' ');

/** The key of a message: its file and a short hash of its text. */
export function keyOf(file: string, text: string): string {
  return `${file}#${createHash('sha256').update(text).digest('hex').slice(0, 10)}`;
}

const isNode = (v: unknown): v is Node => !!v && typeof v === 'object' && typeof (v as Node).type === 'string' && typeof (v as Node).start === 'number';
const isElement = (n: Node) => n.type === 'JSXElement' || n.type === 'JSXFragment';

/** The nodes directly under `node` with the field each is in, in source order. */
function fieldsOf(node: Node): [string, Node][] {
  const out: [string, Node][] = [];
  for (const [k, v] of Object.entries(node)) {
    if (k === 'start' || k === 'end') continue;
    for (const c of Array.isArray(v) ? v : [v]) if (isNode(c) && c.start >= node.start && c.end <= node.end) out.push([k, c]);
  }
  return out.sort((a, b) => a[1].start - b[1].start);
}
const childNodes = (node: Node) => fieldsOf(node).map(([, c]) => c);

/**
 * How a string under a node is read: `content` (an object field, a branch that is shown: copy unless it looks like
 * code), `loose` (anywhere else in code: only prose or a capitalised word), `none` (imports, comparisons, call
 * arguments, ids and links).
 */
type Mode = 'content' | 'loose' | 'none';
const CODE = new Set(['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression', 'ImportAttribute', 'BinaryExpression', 'SwitchCase', 'CallExpression', 'NewExpression', 'TaggedTemplateExpression', 'MemberExpression', 'ExpressionStatement']);
const nameOf = (key: Node) => (key.type === 'Identifier' ? key.name : String(key.value ?? ''));

function modeOf(node: Node, field: string, mode: Mode): Mode {
  if (CODE.has(node.type)) return 'none';
  if (node.type === 'Property') {
    const key = nameOf(node.key);
    return field !== 'value' || isWiringKey(key) ? 'none' : isEitherKey(key) ? 'loose' : 'content';
  }
  if (node.type === 'ConditionalExpression') return field === 'test' ? 'none' : mode;
  if (node.type === 'LogicalExpression' || node.type === 'ArrayExpression' || node.type === 'ParenthesizedExpression') return mode;
  return 'loose';
}

/** The copy strings in a piece of code (types and JSX left out: a template's JSX is read as a template). */
function copyIn(node: Node, mode: Mode, out: string[] = []): string[] {
  if (/^(TS|JSX)/.test(node.type)) return out;
  const text =
    node.type === 'Literal' && typeof node.value === 'string' ? node.value
    : node.type === 'TemplateLiteral' && !node.expressions.length ? node.quasis[0].value.cooked
    : undefined;
  if (text !== undefined) {
    if (mode === 'content' ? isContent(text) : mode === 'loose' && isCopy(text)) out.push(text);
    return out;
  }
  for (const [field, c] of fieldsOf(node)) copyIn(c, modeOf(node, field, mode), out);
  return out;
}

/** A sibling that CSS shows only at times (`hidden`, `group-open:hidden`): one of a toggle's labels, its own text. */
function toggled(n: Node, source: string) {
  const cls = (n.openingElement?.attributes ?? []).find((a: Node) => a.name && source.slice(a.name.start, a.name.end) === 'class');
  return cls?.value?.type === 'Literal' && String(cls.value.value).split(/\s+/).some((t) => /(^|:)hidden$/.test(t));
}

/** The copy strings of a code module (a data file, a collection): each one a message, translated where it's shown. */
export function analyzeModule(source: string, file: string): Message[] {
  // Parsed as an Astro frontmatter: the same TypeScript parser as the templates, with no other dependency.
  const program = (parse(`---\n${source}\n---\n`).ast as unknown as Node).frontmatter?.program;
  return program ? copyIn(program, 'loose').map((s) => valueMessage(file, s)) : [];
}

const valueMessage = (file: string, s: string): Message => {
  const text = collapse(s).trim();
  return { key: keyOf(file, text), text, slots: [] };
};

export function analyze(source: string, file: string): { messages: Message[]; code: string } {
  const ast = parse(source).ast as unknown as Node;
  const messages: Message[] = [];
  const slice = (n: Node) => source.slice(n.start, n.end);
  const tag = (n: Node) => (n.openingElement ? source.slice(n.openingElement.name.start, n.openingElement.name.end) : '');
  const isComponent = (n: Node) => n.type === 'JSXElement' && /^[A-Z]|\./.test(tag(n));
  const opaque = (n: Node) =>
    OPAQUE.has(tag(n)) || (n.openingElement?.attributes ?? []).some((a: Node) => a.name && /^(set:|is:raw)/.test(source.slice(a.name.start, a.name.end)));
  const words = (kids: Node[]): boolean =>
    kids.some((k) => (k.type === 'JSXText' && LETTER.test(k.value)) || (k.type === 'JSXElement' && (INLINE.has(tag(k)) || isComponent(k)) && !opaque(k) && words(k.children)));
  /** Words directly in it, or a sentence of inline elements (not one lone element with words: that one is the message). */
  const isMessage = (kids: Node[]) => {
    if (kids.some((k) => k.type === 'JSXText' && LETTER.test(k.value))) return true;
    const worded = kids.filter((k) => words([k]));
    // Blocks, or components and fragments with content: a layout, each part its own message. So are labels CSS
    // switches between (no words join them): "Show all projects" and "Hide projects" are two texts.
    const layout =
      kids.some((k) => (k.type === 'JSXFragment' || isComponent(k) ? k.children.length > 0 : k.type === 'JSXElement' && !INLINE.has(tag(k)) && !ATOMS.has(tag(k)))) ||
      worded.some((k) => toggled(k, source));
    return !layout && worded.length > 1;
  };
  const label = (n: Node) => (isElement(n) ? tag(n) || 'fragment' : collapse(slice(n)).slice(0, 32));
  const call = (key: string, text: string, slots: string[] = []) =>
    `{$t(${JSON.stringify(key)}, ${JSON.stringify(text)}${slots.length ? `, [${slots.join(', ')}]` : ''})}`;
  const add = (text: string, slots: string[]) => {
    const key = keyOf(file, text);
    messages.push({ key, text, slots });
    return key;
  };
  /**
   * A value the page shows: its strings listed, and translated by value at render. A template literal with words
   * (`${title} | Accord Housing`, not a code like `${locale}-IN`) is a message, each interpolation a value placeholder.
   */
  const shown = (e: Node, wrap: 'v' | 'deep' = 'v'): string => {
    const quasis: string[] = e.type === 'TemplateLiteral' ? e.quasis.map((q: Node) => q.value.cooked ?? '') : [];
    if (e.expressions?.length && quasis.some((q) => LETTER.test(q)) && /\s/.test(quasis.join('')) && !quasis.some((q) => /[{}<>]/.test(q))) {
      const code: string[] = [];
      const labels: string[] = [];
      const text = collapse(quasis.map((q, i) => (i < e.expressions.length ? `${q}{${code.push(shown(e.expressions[i])) - 1}}` : q)).join(''));
      for (const x of e.expressions) labels.push(label(x));
      return `$t(${JSON.stringify(add(text, labels))}, ${JSON.stringify(text)}, [${code.join(', ')}])`;
    }
    for (const s of copyIn(e, 'content')) messages.push(valueMessage(file, s));
    return `$t.${wrap}(${emit(e)})`;
  };
  /** An island (a `client:` component): its props are serialised for the browser, so they're translated whole. */
  const islandProps = new Set<Node>();

  /** The source of `node`, with every message in it replaced. */
  const emit = (node: Node): string => {
    if (node.type === 'JSXAttribute') return islandProps.has(node) ? islandProp(node) : attribute(node);
    if (node.type === 'JSXSpreadAttribute' && islandProps.has(node)) return `{...${shown(node.argument, 'deep')}}`;
    if (node.type === 'JSXElement' && opaque(node)) return slice(node);
    // Only a child's expressions reach here (attributes are emitted above): what they evaluate to is shown.
    if (node.type === 'JSXExpressionContainer' && node.expression.type !== 'JSXEmptyExpression') return `{${shown(node.expression)}}`;
    if (node.type === 'JSXElement' && isComponent(node)) {
      const attrs: Node[] = node.openingElement.attributes;
      if (attrs.some((a) => a.name && /^client:/.test(source.slice(a.name.start, a.name.end)))) for (const a of attrs) islandProps.add(a);
    }
    // The page's <head> gets what its locale's script needs (rendered at the end, so it wins over the site's styles).
    if (node.type === 'JSXElement' && tag(node) === 'head' && node.closingElement) {
      const close = node.closingElement;
      return emit({ ...node, end: close.start, closingElement: null, children: node.children }) + '<Fragment set:html={$t.head} />' + slice(close);
    }
    if (isElement(node) && isMessage(node.children)) {
      const open = node.openingElement ?? node.openingFragment;
      const close = node.closingElement ?? node.closingFragment;
      return emit(open) + message(node.children, open.end, close.start) + slice(close);
    }
    let out = '';
    let at = node.start;
    for (const c of childNodes(node)) {
      if (c.start < at) continue;
      out += source.slice(at, c.start) + emit(c);
      at = c.end;
    }
    return out + source.slice(at, node.end);
  };

  /** An attribute whose value is copy, as a translated expression. */
  const attribute = (a: Node) => {
    const name = source.slice(a.name.start, a.name.end);
    const v = a.value;
    // A link follows the page's locale.
    if (name === 'href' && v?.type === 'Literal' && String(v.value).startsWith('/')) return `href={$t.href(${JSON.stringify(v.value)})}`;
    if (name === 'href' && v?.type === 'JSXExpressionContainer' && v.expression.type !== 'JSXEmptyExpression') return `href={$t.href(${emit(v.expression)})}`;
    if (!ATTRS.has(name)) return slice(a);
    if (v?.type === 'JSXExpressionContainer' && v.expression.type !== 'JSXEmptyExpression') return `${name}={${shown(v.expression)}}`;
    if (v?.type !== 'Literal' || typeof v.value !== 'string' || !LETTER.test(v.value)) return slice(a);
    const text = collapse(decodeHTML(v.value)).trim();
    return `${name}=${call(add(text, []), text)}`;
  };

  /** An island's prop: copy as a message, an expression translated whole; directives and wiring as they are. */
  const islandProp = (a: Node) => {
    const name = source.slice(a.name.start, a.name.end);
    const v = a.value;
    if (isWiringKey(name)) return slice(a);
    if (v?.type === 'JSXExpressionContainer' && v.expression.type !== 'JSXEmptyExpression') return `${name}={${shown(v.expression, 'deep')}}`;
    if (v?.type !== 'Literal' || typeof v.value !== 'string' || !isCopy(v.value)) return slice(a);
    const text = collapse(decodeHTML(v.value)).trim();
    return `${name}=${call(add(text, []), text)}`;
  };

  /** The text of `kids` with placeholders; the code of each placeholder is pushed onto `code`, its label onto `labels`. */
  const textOf = (kids: Node[], code: string[], labels: string[]): string => {
    let text = '';
    for (const k of kids) {
      // A comment isn't part of the page's copy: dropped from the message.
      if (k.type === 'AstroComment') continue;
      if (k.type === 'JSXText') {
        text += decodeHTML(k.value);
        continue;
      }
      if (k.type === 'JSXExpressionContainer') {
        const e = k.expression;
        if (e.type === 'JSXEmptyExpression') continue;
        if (e.type === 'Literal' && typeof e.value === 'string') {
          text += e.value;
          continue;
        }
        labels.push(label(e));
        text += `{${code.push(shown(e)) - 1}}`;
        continue;
      }
      if (k.type === 'JSXElement' && (INLINE.has(tag(k)) || isComponent(k)) && !opaque(k) && words(k.children)) {
        // An inline element: its words stay in the message; it wraps the translated words.
        const n = code.push('') - 1;
        labels.push(tag(k));
        const inner = textOf(k.children, code, labels);
        code[n] = `(c) => ${emit(k.openingElement)}{c}${slice(k.closingElement)}`;
        text += `<${n}>${inner}</${n}>`;
        continue;
      }
      labels.push(label(k));
      text += `{${code.push(emit(k)) - 1}}`;
    }
    return text;
  };

  /** The children between `from` and `to` as one translated message (the whitespace around it stays). */
  const message = (kids: Node[], from: number, to: number) => {
    const inner = source.slice(from, to);
    const code: string[] = [];
    const labels: string[] = [];
    const text = collapse(textOf(kids, code, labels)).trim();
    return inner.match(/^\s*/)![0] + call(add(text, labels), text, code) + inner.match(/\s*$/)![0];
  };

  if (ast.frontmatter?.program) for (const s of copyIn(ast.frontmatter.program, 'loose')) messages.push(valueMessage(file, s));
  const body: Node[] = ast.body ?? [];
  if (!body.length) return { messages, code: source };
  const start = body[0].start;
  const end = body[body.length - 1].end;
  const template = isMessage(body) ? message(body, start, end) : body.map((n, i) => (i ? source.slice(body[i - 1].end, n.start) : '') + emit(n)).join('');
  return { messages, code: source.slice(0, start) + template + source.slice(end) };
}
