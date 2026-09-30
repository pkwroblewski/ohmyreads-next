// Real spines rarely truncate. For each title, in order: shrink to a
// comfortable size, narrow the letters (Archivo's width axis, sans families
// only), shrink to the minimum, then retry on two vertical lines (spines
// >= 24px wide), then without a leading "The"/"A", then without the author
// surname at the foot (it stays in the aria-label), and only then truncate.
//
// Works in rounds over all titles at once (read every overflow, then write
// every change), so a 300-book wall costs a few dozen layouts, not thousands.

const COMFORT = 8;
const MIN = 6.5;
const MIN_STRETCH = 62;
const TWO_LINE_WIDTH = 24;

interface Attempt {
  text: string;
  lines: 1 | 2;
  noAuthor?: boolean;
}

interface State {
  el: HTMLElement;
  attempts: Attempt[];
  index: number;
  size: number;
  stretch: number;
  initSize: number;
  initStretch: number;
  narrow: boolean;
}

function apply(st: State) {
  const a = st.attempts[st.index];
  if (st.el.textContent !== a.text) st.el.textContent = a.text;
  if (a.lines === 2) st.el.dataset.lines = "2";
  else delete st.el.dataset.lines;
  const spine = st.el.parentElement;
  if (spine) {
    if (a.noAuthor) spine.dataset.noAuthor = "";
    else delete spine.dataset.noAuthor;
  }
  st.el.style.fontSize = `${st.size.toFixed(2)}px`;
  st.el.style.fontStretch = `${Math.round(st.stretch)}%`;
}

function overflow(el: HTMLElement): number {
  // Vertical text runs top to bottom, so a long line overflows the height;
  // a third line in two-line mode overflows the width.
  // Italic and heavy glyphs overhang their line box by a pixel or two, so
  // width only counts when it is off by a real fraction of a line.
  const h = el.scrollHeight / Math.max(1, el.clientHeight);
  const extra = el.scrollWidth - el.clientWidth;
  const w = extra > parseFloat(el.style.fontSize) * 0.4 ? el.scrollWidth / Math.max(1, el.clientWidth) : 1;
  return Math.max(h, w);
}

/** Next step for a title that still overflows; false when out of options. */
function advance(st: State, ratio: number): boolean {
  const lines = st.attempts[st.index].lines;
  // Single-line length scales with size and stretch, so jump straight to the
  // target; two-line layout reflows, so step down gradually.
  const factor = lines === 1 ? Math.min(0.97, 0.98 / ratio) : 0.92;
  if (st.size > COMFORT + 0.01) {
    st.size = Math.max(COMFORT, st.size * factor);
  } else if (st.narrow && st.stretch > MIN_STRETCH) {
    st.stretch = Math.max(MIN_STRETCH, st.stretch * factor);
  } else if (st.size > MIN + 0.01) {
    st.size = Math.max(MIN, st.size * factor);
  } else if (st.index < st.attempts.length - 1) {
    st.index++;
    st.size = st.initSize;
    st.stretch = st.initStretch;
  } else {
    return false;
  }
  return true;
}

export function fitSpineTitles(roots: HTMLElement[]): { total: number; truncated: number } {
  const states: State[] = [];
  const titles = roots.flatMap((root) => [...root.querySelectorAll<HTMLElement>("[data-spine-title]")]);
  // Read every width before writing any style, so this is one layout.
  const widths = titles.map((el) => el.parentElement?.offsetWidth ?? 0);
  titles.forEach((el, i) => {
    const full = el.dataset.full ?? el.textContent ?? "";
    const alt = el.dataset.alt;
    const wide = widths[i] >= TWO_LINE_WIDTH;
    const attempts: Attempt[] = [{ text: full, lines: 1 }];
    if (wide) attempts.push({ text: full, lines: 2 });
    if (alt) attempts.push({ text: alt, lines: 1 });
    if (alt && wide) attempts.push({ text: alt, lines: 2 });
    if (el.parentElement?.querySelector("[data-spine-author]")) {
      for (const a of [...attempts]) attempts.push({ ...a, noAuthor: true });
    }
    const initSize = Number(el.dataset.size) || 12;
    const initStretch = Number(el.dataset.stretch) || 100;
    const st: State = {
      el,
      attempts,
      index: 0,
      size: initSize,
      stretch: initStretch,
      initSize,
      initStretch,
      narrow: el.dataset.narrow === "1",
    };
    delete el.parentElement?.dataset.truncated;
    apply(st);
    states.push(st);
  });

  let active = states;
  let truncated = 0;
  for (let round = 0; active.length && round < 60; round++) {
    const ratios = active.map((st) => overflow(st.el));
    const next: State[] = [];
    active.forEach((st, i) => {
      if (ratios[i] <= 1.01) return;
      if (advance(st, ratios[i])) {
        apply(st);
        next.push(st);
        return;
      }
      // Out of options: one line, shortest text, smallest size, ellipsis.
      st.index = st.attempts.findLastIndex((a) => a.lines === 1);
      st.size = MIN;
      st.stretch = st.narrow ? MIN_STRETCH : st.initStretch;
      apply(st);
      if (st.el.parentElement) st.el.parentElement.dataset.truncated = "";
      truncated++;
    });
    active = next;
  }
  return { total: states.length, truncated };
}

/** Hide month labels that would collide with the previous one on the same plank. */
export function tidyMonthLabels(roots: HTMLElement | HTMLElement[]) {
  // Unhide all, read all, then hide: labels are absolutely positioned, so
  // hiding one never moves another, and one layout serves every label.
  const labels = [roots].flat().flatMap((r) => [...r.querySelectorAll<HTMLElement>("[data-month]")]);
  for (const m of labels) m.hidden = false;
  const rects = labels.map((m) => m.getBoundingClientRect());
  let prev: DOMRect | null = null;
  labels.forEach((m, i) => {
    const r = rects[i];
    if (prev && Math.abs(r.top - prev.top) < 4 && r.left < prev.right + 8) {
      m.hidden = true;
      return;
    }
    prev = r;
  });
}

// Every shelf on a page shares one fitting pass: each round forces a layout
// of the whole page, so 14 year shelves fitting separately cost 14 times the
// layouts (seconds on a phone for a 500-book import).
const pending = new Set<HTMLElement>();
let scheduled = false;

/** Fit (or re-fit) a shelf's titles, batched with every other shelf on the page. */
export function scheduleFit(root: HTMLElement) {
  pending.add(root);
  if (scheduled) return;
  scheduled = true;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() =>
    // A macrotask, so every shelf rendered in the same commit has registered.
    setTimeout(() => {
      scheduled = false;
      const roots = [...pending].filter((r) => r.isConnected && r.offsetParent);
      pending.clear();
      if (!roots.length) return;
      fitSpineTitles(roots);
      tidyMonthLabels(roots);
      for (const root of roots) root.dataset.truncated = String(root.querySelectorAll("[data-truncated]").length);
    }, 0)
  );
}
