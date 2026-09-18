/** Minimal ANSI (SGR) → SVG renderer for documentation screenshots. */

interface Style {
  fg: string | null;
  bg: string | null;
  bold: boolean;
  dim: boolean;
  underline: boolean;
  inverse: boolean;
}

const ESC = String.fromCharCode(27);
const SGR = new RegExp(`${ESC}\\[([0-9;]*)m`, 'g');
const CURSOR = new RegExp(`${ESC}\\[\\?25[lh]`, 'g');

const PALETTE: Record<number, string> = {
  30: '#45475a', 31: '#f38ba8', 32: '#a6e3a1', 33: '#f9e2af', 34: '#89b4fa', 35: '#f5c2e7', 36: '#94e2d5', 37: '#bac2de',
  90: '#585b70', 91: '#f38ba8', 92: '#a6e3a1', 93: '#f9e2af', 94: '#89b4fa', 95: '#f5c2e7', 96: '#94e2d5', 97: '#a6adc8',
};
const DEFAULT_FG = '#cdd6f4';
const DEFAULT_BG = '#1e1e2e';

const fresh = (): Style => ({ fg: null, bg: null, bold: false, dim: false, underline: false, inverse: false });

function apply(style: Style, codes: number[]): Style {
  const s = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) Object.assign(s, fresh());
    else if (c === 1) s.bold = true;
    else if (c === 2) s.dim = true;
    else if (c === 4) s.underline = true;
    else if (c === 7) s.inverse = true;
    else if (c === 22) {
      s.bold = false;
      s.dim = false;
    } else if (c === 24) s.underline = false;
    else if (c === 27) s.inverse = false;
    else if (c === 39) s.fg = null;
    else if (c === 49) s.bg = null;
    else if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) s.fg = PALETTE[c];
    else if ((c >= 40 && c <= 47) || (c >= 100 && c <= 107)) s.bg = PALETTE[c - 10];
    else if ((c === 38 || c === 48) && codes[i + 1] === 2) {
      const rgb = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`;
      if (c === 38) s.fg = rgb;
      else s.bg = rgb;
      i += 4;
    } else if ((c === 38 || c === 48) && codes[i + 1] === 5) {
      i += 2;
    }
  }
  return s;
}

interface Run {
  text: string;
  style: Style;
}

function parseLine(line: string): Run[] {
  const runs: Run[] = [];
  let style = fresh();
  let last = 0;
  let m: RegExpExecArray | null;
  SGR.lastIndex = 0;
  while ((m = SGR.exec(line))) {
    if (m.index > last) runs.push({ text: line.slice(last, m.index), style });
    style = apply(style, m[1] === '' ? [0] : m[1].split(';').map(Number));
    last = SGR.lastIndex;
  }
  if (last < line.length) runs.push({ text: line.slice(last), style });
  return runs;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function stripAnsi(s: string): string {
  return s.replace(SGR, '').replace(CURSOR, '');
}

export function ansiToSvg(frame: string, opts: { title?: string; cols?: number } = {}): string {
  const lines = frame.replace(CURSOR, '').split('\n');
  const cw = 8.4;
  const lh = 20;
  const fontSize = 13;
  const pad = 16;
  const cols = opts.cols ?? Math.max(...lines.map((l) => stripAnsi(l).length));
  const width = cols * cw + pad * 2 + 12;
  const height = lines.length * lh + pad * 2 + 24;
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="'JetBrains Mono','Fira Code',Menlo,Consolas,'DejaVu Sans Mono',monospace" font-size="${fontSize}">`,
  );
  out.push(`<rect width="100%" height="100%" rx="10" fill="${DEFAULT_BG}"/>`);
  out.push(
    `<circle cx="22" cy="18" r="6" fill="#f38ba8"/><circle cx="42" cy="18" r="6" fill="#f9e2af"/><circle cx="62" cy="18" r="6" fill="#a6e3a1"/>`,
  );
  if (opts.title) {
    out.push(`<text x="${width / 2}" y="23" text-anchor="middle" fill="#6c7086" font-size="12">${esc(opts.title)}</text>`);
  }
  const top = pad + 24;
  lines.forEach((line, row) => {
    const y = top + row * lh;
    let col = 0;
    const spans: string[] = [];
    for (const run of parseLine(line)) {
      const len = [...run.text].length;
      if (len === 0) continue;
      let fg = run.style.fg ?? DEFAULT_FG;
      let bg = run.style.bg;
      if (run.style.inverse) [fg, bg] = [bg ?? DEFAULT_BG, fg];
      if (run.style.dim) fg = '#7f849c';
      const x = (pad + col * cw).toFixed(1);
      const w = (len * cw).toFixed(1);
      if (bg) out.push(`<rect x="${x}" y="${y - lh + 5}" width="${w}" height="${lh}" fill="${bg}"/>`);
      // One x per glyph: every SVG renderer honours explicit positions, unlike textLength.
      const xs = Array.from({ length: len }, (_, i) => (pad + (col + i) * cw).toFixed(1)).join(' ');
      const attrs = [`x="${xs}"`, `fill="${fg}"`];
      if (run.style.bold) attrs.push('font-weight="bold"');
      if (run.style.underline) attrs.push('text-decoration="underline"');
      spans.push(`<tspan ${attrs.join(' ')}>${esc(run.text)}</tspan>`);
      col += len;
    }
    if (spans.length) out.push(`<text y="${y}" xml:space="preserve">${spans.join('')}</text>`);
  });
  out.push('</svg>');
  return out.join('\n');
}
