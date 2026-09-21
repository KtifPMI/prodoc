(function () {
  var DATA = window.PDOC || [];
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };
  var allCards = [];
  var activeSection = 'all';
  var query = '';

  // ---- RENDER CHIPS ----
  function renderChips() {
    var nav = $('#chips');
    var total = DATA.reduce(function (n, s) { return n + s.articles.length; }, 0);
    var html = '<button class="chip active" data-s="all">Все<span class="cnt">' + total + '</span></button>';
    DATA.forEach(function (sec) {
      html += '<button class="chip" data-s="' + sec.id + '">' + sec.title + '<span class="cnt">' + sec.articles.length + '</span></button>';
    });
    nav.innerHTML = html;
    nav.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      activeSection = chip.dataset.s;
      $$('.chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
      apply();
    });
  }

  // ---- RENDER CONTENT ----
  function renderContent() {
    var main = $('#content');
    var html = '';
    DATA.forEach(function (sec) {
      html += '<section class="section" data-s="' + sec.id + '">';
      html += '<h2 class="section-title">' + sec.title + '</h2>';
      sec.articles.forEach(function (art) {
        var id = 'c' + sec.id + '_' + art.title.replace(/\s+/g, '_');
        html += '<article class="card" data-id="' + id + '" data-s="' + sec.id + '">';
        html += '<button class="card-head" aria-expanded="false">';
        html += '<span>' + esc(art.title) + '</span>';
        html += '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';
        html += '</button>';
        html += '<div class="card-body"><div class="content">' + art.body + '</div></div>';
        html += '</article>';
        allCards.push({ id: id, el: null, sec: sec.id, art: art });
      });
      html += '</section>';
    });
    main.innerHTML = html;

    // link card refs
    allCards.forEach(function (c) { c.el = main.querySelector('[data-id="' + c.id + '"]'); });

    // toggle cards
    main.addEventListener('click', function (e) {
      var head = e.target.closest('.card-head');
      if (!head) return;
      var card = head.closest('.card');
      var open = card.classList.toggle('open');
      head.setAttribute('aria-expanded', open);
    });
  }

  // ---- SEARCH ----
  var searchInput = $('#search');
  var searchClear = $('#search-clear');
  var debounce = null;

  searchInput.addEventListener('input', function () {
    clearTimeout(debounce);
    var val = searchInput.value.trim();
    searchClear.classList.toggle('hidden', !val);
    debounce = setTimeout(function () {
      query = val.toLowerCase();
      apply();
    }, 150);
  });

  searchClear.addEventListener('click', function () {
    searchInput.value = '';
    searchClear.classList.add('hidden');
    query = '';
    apply();
    searchInput.focus();
  });

  // ---- APPLY FILTERS ----
  function apply() {
    var sections = $$('.section');
    var visibleTotal = 0;

    sections.forEach(function (sec) {
      var sid = sec.dataset.s;
      var secVisible = false;
      if (activeSection !== 'all' && activeSection !== sid) {
        sec.style.display = 'none';
        return;
      }

      var cards = sec.querySelectorAll('.card');
      cards.forEach(function (card) {
        var art = allCards.find(function (c) { return c.id === card.dataset.id; });
        if (!art) return;
        var match = !query ||
          art.art.title.toLowerCase().indexOf(query) !== -1 ||
          art.art.text.indexOf(query) !== -1;

        card.style.display = match ? '' : 'none';
        if (match) {
          secVisible = true;
          visibleTotal++;
          if (query) {
            card.classList.add('open');
            card.querySelector('.card-head').setAttribute('aria-expanded', 'true');
            highlight(card, query);
          } else {
            card.classList.remove('open');
            card.querySelector('.card-head').setAttribute('aria-expanded', 'false');
            unhighlight(card);
          }
        }
      });
      sec.style.display = secVisible ? '' : 'none';
    });

    // footer count
    var countEl = $('#result-count');
    if (query) {
      countEl.textContent = visibleTotal + ' из ' + allCards.length;
    } else if (activeSection !== 'all') {
      var sec = DATA.find(function (s) { return s.id === activeSection; });
      countEl.textContent = sec ? sec.articles.length + ' статей' : '';
    } else {
      countEl.textContent = allCards.length + ' статей';
    }

    // empty state
    var existing = $('#empty');
    if (existing) existing.remove();
    if (visibleTotal === 0) {
      var main = $('#content');
      var div = document.createElement('div');
      div.id = 'empty';
      div.className = 'empty';
      div.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg><p>Ничего не найдено</p>';
      main.appendChild(div);
    }
  }

  // ---- HIGHLIGHT ----
  function highlight(card, q) {
    var body = card.querySelector('.content');
    if (!body) return;
    var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var txt = node.textContent;
      var idx = txt.toLowerCase().indexOf(q);
      if (idx === -1) return;
      var before = txt.slice(0, idx);
      var match = txt.slice(idx, idx + q.length);
      var after = txt.slice(idx + q.length);
      var span = document.createElement('span');
      span.innerHTML = esc(before) + '<mark>' + esc(match) + '</mark>' + esc(after);
      node.parentNode.replaceChild(span, node);
    });
  }

  function unhighlight(card) {
    var marks = card.querySelectorAll('mark');
    marks.forEach(function (m) {
      var parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }

  // ---- UTILS ----
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ---- EXPAND / COLLAPSE ALL ----
  $('#expand-all').addEventListener('click', function () {
    allCards.forEach(function (c) {
      if (c.el && c.el.style.display !== 'none') {
        c.el.classList.add('open');
        c.el.querySelector('.card-head').setAttribute('aria-expanded', 'true');
      }
    });
  });
  $('#collapse-all').addEventListener('click', function () {
    $$('.card').forEach(function (c) {
      c.classList.remove('open');
      c.querySelector('.card-head').setAttribute('aria-expanded', 'false');
    });
  });

  // ---- INIT ----
  renderChips();
  renderContent();
  apply();
})();
