import { expect, test } from 'bun:test';
import { parse } from '@astrojs/compiler-rs';
import { analyze, analyzeModule, merge } from '../src';
import { fits, render } from '../src/message';
import { createT } from '../src/runtime';

const texts = (src: string) => analyze(src, 'a.astro').messages.map((m) => m.text);
const parses = (code: string) => !parse(code).diagnostics.some((d) => d.severity === 'error');

test('a paragraph split by inline elements is one message', () => {
  const src = `<p>Start with <span class="x">the road</span>. Then <Link href="/a">pick</Link> {count} <br/> now</p>`;
  const [m] = analyze(src, 'a.astro').messages;
  expect(m.text).toBe('Start with <0>the road</0>. Then <1>pick</1> {2} {3} now');
  expect(m.slots).toEqual(['span', 'Link', 'count', 'br']);
});

test('layouts split into their blocks; one lone inline element is its own message', () => {
  expect(texts(`<div><h2>Title</h2><p>Body</p></div>`)).toEqual(['Title', 'Body']);
  expect(texts(`<li><a href="/">Home</a></li>`)).toEqual(['Home']);
  expect(texts(`<h1><span>Hello</span> <em>world</em></h1>`)).toEqual(['<0>Hello</0> <1>world</1>']);
  expect(texts(`<section><Card>One</Card><Card>Two</Card></section>`)).toEqual(['One', 'Two']);
});

test('copy attributes are messages; scripts, styles, code and punctuation are not', () => {
  expect(texts(`<img alt="A photo" class="x" />`)).toEqual(['A photo']);
  expect(texts(`<script>const a = "x"</script><style>.a{}</style><code>npm i</code><span>·</span>`)).toEqual([]);
});

test('entities are decoded, whitespace collapsed, string literals kept', () => {
  expect(texts(`<p>Tom &amp; Jerry\n   go{" "}far</p>`)).toEqual(['Tom & Jerry go far']);
});

test('the rewritten template parses and keeps the whitespace around each message', () => {
  const src = `---\nconst count = 1\n---\n<section>\n  <p class="a">\n    Read <b>more</b> {count}\n  </p>\n  <img alt="Photo" />\n</section>\n`;
  const { code } = analyze(src, 'a.astro');
  expect(parses(code)).toBe(true);
  expect(code).toContain('<p class="a">\n    {$t(');
  expect(code).toContain('[(c) => <b>{c}</b>, $t.v(count)])}\n  </p>');
  expect(code).toContain('alt={$t(');
});

test('a translation must keep every placeholder, properly nested', () => {
  const source = 'Start <0>here</0> {1}';
  expect(fits('{1} commencez <0>ici</0>', source)).toBe(true);
  expect(fits('Commencez ici {1}', source)).toBe(false);
  expect(fits('<0>ici {1}', source)).toBe(false);
  expect(fits('</0>ici<0> {1}', source)).toBe(false);
});

test('render rebuilds elements around translated words; a broken translation falls back to the source', () => {
  const slots = [(c: unknown[]) => `<b>${c.join('')}</b>`, 'X'];
  expect(render('{1} va <0>ici</0>!', slots)).toEqual(['X', ' va ', '<b>ici</b>', '!']);
  const t = createT({ k: { value: 'Cassé' } });
  expect(t('k', 'Start <0>here</0> {1}', slots)).toEqual(['Start ', '<b>here</b>', ' ', 'X']);
  expect(createT({ k: { value: 'Bonjour' } })('k', 'Hello')).toBe('Bonjour');
  expect(createT(undefined)('k', 'Hello')).toBe('Hello');
});

test('merge keeps translations; a translated message that left the source is lost, an untranslated one dropped', () => {
  const next = merge(
    { k1: { text: 'Hi', value: 'Salut' }, k2: { text: 'Gone', value: 'Parti' }, k3: { text: 'Old', value: '' } },
    [{ key: 'k1', text: 'Hi', slots: [] }, { key: 'k4', text: 'New <0>x</0>', slots: ['span'] }],
  );
  expect(next).toEqual({
    k1: { text: 'Hi', value: 'Salut' },
    k4: { text: 'New <0>x</0>', value: '', slots: ['span'] },
    k2: { text: 'Gone', value: 'Parti', lost: true },
  });
});

test('comments are dropped; icons beside one labelled element leave that element as the message', () => {
  expect(texts(`<p><!-- note --> Hi <b>there</b></p>`)).toEqual(['Hi <0>there</0>']);
  expect(texts(`<summary><!-- c --><Icon name="x" /> <span>Show all</span></summary>`)).toEqual(['Show all']);
  expect(parses(analyze(`<p><!-- note --> Hi <b>there</b></p>`, 'a.astro').code)).toBe(true);
});

test('labels CSS switches between are separate texts; a hidden word inside a sentence is not', () => {
  expect(texts(`<summary><span class="group-open:hidden">Show all projects</span> <span class="hidden group-open:inline">Hide projects</span></summary>`)).toEqual(['Show all projects', 'Hide projects']);
  expect(texts(`<p>Show <span class="hidden md:inline">all</span> projects</p>`)).toEqual(['Show <0>all</0> projects']);
});

test('strings from code are listed, and the values a template shows go through the translator', () => {
  const src = `---\nimport x from "./x";\nconst words = { title: "Plots that grow", href: "/a", status: { open: "Open" }, cls: "flex gap-2" };\nconst mode = "dark";\n---\n<p>{n} open {n === 1 ? "layout" : "layouts"}</p>\n<h2>{words.title}</h2>\n<img alt={words.title} />\n<Hero client:load {...hero} words={words} variant="dark" title="Welcome home" />`;
  const { messages, code } = analyze(src, 'a.astro');
  expect(messages.map((m) => m.text)).toEqual(expect.arrayContaining(['Plots that grow', 'Open', 'layout', 'layouts', '{0} open {1}', 'Welcome home']));
  expect(messages.map((m) => m.text)).not.toEqual(expect.arrayContaining(['/a', 'flex gap-2', 'dark', './x']));
  expect(parses(code)).toBe(true);
  expect(code).toContain('<h2>{$t.v(words.title)}</h2>');
  expect(code).toContain('alt={$t.v(words.title)}');
  expect(code).toContain('{...$t.deep(hero)} words={$t.deep(words)} variant="dark" title={$t(');
});

test('data modules: content fields are messages, ids, links, types and code are not', () => {
  const src = `import type { A } from "./a";\nexport const labels = () => ({ eyebrow: "Gallery", phone: "tel:+91", items: ["Gated community"], projectId: "oasis", type: "paragraph" });\nif (a === "open") throw new Error("Spam check failed");`;
  expect(analyzeModule(src, 'd.ts').map((m) => m.text)).toEqual(['Gallery', 'Gated community']);
});

test('values are translated by text, once for everywhere, with their whitespace kept', () => {
  const t = createT({ 'd.ts#1': { text: 'Gallery', value: 'Galerie' }, 'a.astro#2': { text: 'Hi <0>you</0>', value: 'Salut' } });
  expect(t.v(' Gallery\n')).toBe(' Galerie\n');
  expect(t.v(3)).toBe(3);
  expect(t('b.astro#9', 'Gallery')).toBe('Galerie');
  expect(t.deep({ title: 'Gallery', href: 'Gallery', list: ['Gallery'] })).toEqual({ title: 'Galerie', href: 'Gallery', list: ['Galerie'] });
});

test('links follow the page locale, in templates and island props', () => {
  const { code } = analyze(`<a href="/en/about">About</a><a href={p.href}>{p.label}</a><a href="https://x.com">X</a>`, 'a.astro');
  expect(code).toContain('href={$t.href("/en/about")}');
  expect(code).toContain('href={$t.href(p.href)}');
  expect(code).toContain('href="https://x.com"');
  const ta = createT({}, { locale: 'ta', defaultLocale: 'en' });
  expect([ta.href('/en/'), ta.href('/en'), ta.href('/en/a?b#c'), ta.href('/english'), ta.href('tel:1')]).toEqual(['/ta/', '/ta', '/ta/a?b#c', '/english', 'tel:1']);
  expect(ta.deep({ activeHref: '/en/a', nav: [{ href: '/en/b', label: 'B' }] })).toEqual({ activeHref: '/ta/a', nav: [{ href: '/ta/b', label: 'B' }] });
  expect(createT({}, { locale: 'en', defaultLocale: 'en' }).href('/en/a')).toBe('/en/a');
});

test('a template literal the page shows is a message with its values as placeholders', () => {
  const { messages, code } = analyze('<Layout title={`${a.title} | Accord Housing`}><p>{`${n} plots`}</p></Layout>', 'a.astro');
  expect(messages.map((m) => m.text)).toEqual(['{0} | Accord Housing', '{0} plots']);
  expect(code).toContain('[$t.v(a.title)])');
  const t = createT({ x: { text: 'Gallery', value: 'Galerie' }, y: { text: '{0} plots', value: '{0} lots' } });
  expect(t('k', '{0} | Accord Housing', [t.v('Gallery')])).toBe('Galerie | Accord Housing');
  expect(t('k2', '{0} plots', [3])).toBe('3 lots');
});

test("the CMS editor's invisible marker stays on the translated value", () => {
  const t = createT({ x: { text: 'Gallery', value: 'Galerie' } });
  expect(t.v('Gallery​‌﻿')).toBe('Galerie​‌﻿');
});

test("a page in a script that joins letters gets no letter-spacing; Latin ones nothing", () => {
  const { code } = analyze('<html><head><title>Hi there</title></head><body /></html>', 'a.astro');
  expect(parses(code)).toBe(true);
  expect(code).toContain('<Fragment set:html={$t.head} /></head>');
  expect(createT({}, { locale: 'ta', defaultLocale: 'en' }).head).toContain('html:lang(ta) *{letter-spacing:normal!important}');
  expect(createT({}, { locale: 'fr', defaultLocale: 'en' }).head).toBe('');
  expect(createT({}, { locale: 'en', defaultLocale: 'en' }).head).toBe('');
});

test("a data file's copy is found; wiring and either-keys that read like code are not", () => {
  const texts = analyzeModule('export default {"title":"Pick your plot","id":"plot-1","status":"booked","loading":"Loading…","value":"Chat with the office","format":"Format"}', 'm.json').map((m) => m.text);
  expect(texts).toEqual(['Pick your plot', 'Loading…', 'Chat with the office', 'Format']);
});
