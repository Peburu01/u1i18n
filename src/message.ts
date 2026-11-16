// The message format: plain text where `<n>…</n>` is an inline element around words and `{n}` a component or value.
// The build writes these; a person never types them (the CMS shows each one as a chip).

const TOKEN = /<(\d+)>|<\/(\d+)>|\{(\d+)\}/g;

/** The placeholders of a message, in order (`<0>`, `</0>`, `{1}`). */
export const placeholdersOf = (text: string) => [...text.matchAll(TOKEN)].map((m) => m[0]);

/** A translation keeps every placeholder of its source once, with each `<n>` closed by its `</n>` at the same depth. */
export function fits(translation: string, source: string): boolean {
  const mine = placeholdersOf(translation);
  if (mine.slice().sort().join() !== placeholdersOf(source).sort().join()) return false;
  const open: string[] = [];
  for (const p of mine) {
    if (p.startsWith('</')) {
      if (open.pop() !== p.slice(2)) return false;
    } else if (p.startsWith('<')) open.push(p.slice(1));
  }
  return open.length === 0;
}

/** The parts to render: text, each `{n}` as its value, each `<n>…</n>` as its element around what is inside. */
export function render(text: string, slots: unknown[]): unknown[] {
  const stack: { n: number; parts: unknown[] }[] = [{ n: -1, parts: [] }];
  let at = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > at) stack.at(-1)!.parts.push(text.slice(at, m.index));
    at = m.index + m[0].length;
    if (m[1]) stack.push({ n: Number(m[1]), parts: [] });
    else if (m[2]) {
      const done = stack.pop()!;
      stack.at(-1)!.parts.push((slots[done.n] as (inner: unknown[]) => unknown)(done.parts));
    } else stack.at(-1)!.parts.push(slots[Number(m[3])]);
  }
  if (at < text.length) stack[0].parts.push(text.slice(at));
  return stack[0].parts;
}
