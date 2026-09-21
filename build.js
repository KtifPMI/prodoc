const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'ПроДокторов-база-знаний-конспект.md');
const OUT = path.join(__dirname, 'js', 'data.js');

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function parseBody(lines) {
  const out = [];
  let list = null; // 'ul' | 'ol' | null
  let liOpen = false;
  let subOpen = false;

  function closeLi() {
    if (subOpen) { out.push('</ul>'); subOpen = false; }
    if (liOpen) { out.push('</li>'); liOpen = false; }
  }
  function closeLists() {
    closeLi();
    if (list) { out.push(`</${list}>`); list = null; }
  }

  for (const raw of lines) {
    if (!raw.trim()) { closeLists(); continue; }

    if (/^(##\s|###\s)/.test(raw)) break;
    if (/^---\s*$/.test(raw)) continue;
    if (/^#\s/.test(raw)) continue;

    const nested = raw.match(/^ {2}- +(.*)$/);
    const bullet = raw.match(/^- +(.*)$/);
    const num = raw.match(/^\d+\. +(.*)$/);

    if (nested) {
      if (list !== 'ul') {
        closeLists();
        list = 'ul';
        out.push('<ul>');
      }
      if (!liOpen) {
        out.push('<li>');
        liOpen = true;
      }
      if (!subOpen) {
        out.push('<ul class="sub">');
        subOpen = true;
      }
      out.push(`<li>${inline(nested[1])}</li>`);
      continue;
    }

    if (bullet) {
      if (list !== 'ul') {
        closeLists();
        list = 'ul';
        out.push('<ul>');
      } else {
        closeLi();
      }
      out.push('<li>');
      liOpen = true;
      out.push(inline(bullet[1]));
      continue;
    }

    if (num) {
      if (list !== 'ol') {
        closeLists();
        list = 'ol';
        out.push('<ol>');
      } else {
        closeLi();
      }
      out.push('<li>');
      liOpen = true;
      out.push(inline(num[1]));
      continue;
    }

    closeLists();
    out.push(`<p>${inline(raw)}</p>`);
  }
  closeLists();
  return out.join('\n');
}

const text = fs.readFileSync(SRC, 'utf8');
const lines = text.split(/\r?\n/);

const sections = [];
let cur = null;
let art = null;
let buf = [];

function flushArticle() {
  if (art) {
    let body = parseBody(buf);
    if (body && body.length) {
      art.body = body;
      art.text = buf.join(' ').toLowerCase();
      cur.articles.push(art);
    } else {
      cur.note = (cur.note ? cur.note + ' ' : '') + art.title;
    }
  }
  art = null;
  buf = [];
}

for (const raw of lines) {
  const s = raw.match(/^##\s+(.*)$/);
  const a = raw.match(/^###\s+(.*)$/);
  if (s) {
    flushArticle();
    const num = (s[1].match(/^(\d+)\./) || [])[1];
    cur = {
      id: 's' + (num || sections.length + 1),
      num: num || '',
      title: s[1].replace(/^\d+\.\s*/, ''),
      articles: []
    };
    sections.push(cur);
  } else if (a && cur) {
    flushArticle();
    art = { title: a[1], body: '', text: '' };
  } else if (raw.trim() && art) {
    buf.push(raw);
  } else {
    buf.push(raw);
  }
}
flushArticle();

const out = '/* Автогенерация: node build.js */\nwindow.PDOC = ' + JSON.stringify(sections) + ';\n';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out, 'utf8');

const total = sections.reduce((n, s) => n + s.articles.length, 0);
console.log(`Секций: ${sections.length}, карточек: ${total}`);