// Site behaviour: intro splash, Welcome dialog tabs and filters, help popover,
// feature tree (table of contents), photo/video viewers and the image lightbox.
// The 3D viewports are handled separately by js/viewer.js.
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function store(key, value) {
    try {
      if (value === undefined) return window.sessionStorage.getItem(key);
      window.sessionStorage.setItem(key, value);
    } catch (e) { return null; }
    return null;
  }

  /* ---------------------------------------------------------------
     Intro splash (home page, once per visit)
     --------------------------------------------------------------- */
  function runSplash() {
    var tpl = doc.getElementById('splash-tpl');
    var dialog = $('.welcome');
    if (!tpl || !dialog) { root.classList.remove('intro-pending'); return; }
    var skipIntro = /[?&]nointro\b/.test(location.search) || store('dd-intro-seen') === '1';
    if (skipIntro || !('content' in tpl)) { root.classList.remove('intro-pending'); return; }
    store('dd-intro-seen', '1');

    var splash = tpl.content.firstElementChild.cloneNode(true);
    doc.body.appendChild(splash);
    dialog.classList.add('is-waiting');
    root.classList.remove('intro-pending');
    var status = $('.sheet-status', splash);
    var bar = $('.sheet-bar span', splash);
    var steps = [
      [100, 'Loading Formula SAE EV…', 28],
      [450, 'Loading FTC Robotics…', 58],
      [800, 'Loading other projects…', 86],
      [1120, 'Ready.', 100]
    ];
    var timers = [];
    var done = false;
    if (reduceMotion) steps = [[0, 'Ready.', 100]];
    steps.forEach(function (s) {
      timers.push(setTimeout(function () { status.textContent = s[1]; bar.style.width = s[2] + '%'; }, s[0]));
    });
    function finish() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      doc.removeEventListener('keydown', onKey);
      splash.classList.add('is-leaving');
      // A short beat with just the 3D workspace showing, then the Welcome window pops up
      var beat = reduceMotion ? 0 : 420;
      setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 380);
      setTimeout(function () {
        dialog.classList.remove('is-waiting');
        dialog.classList.add('is-entering');
      }, beat);
      setTimeout(function () { dialog.classList.remove('is-entering'); }, beat + 400);
    }
    function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } }
    doc.addEventListener('keydown', onKey);
    splash.addEventListener('click', finish);
    timers.push(setTimeout(finish, reduceMotion ? 700 : 1450));
  }

  /* ---------------------------------------------------------------
     Welcome dialog tabs
     --------------------------------------------------------------- */
  function initTabs() {
    var list = $('[role="tablist"]');
    if (!list) return;
    var tabs = $$('[role="tab"]', list);
    function select(tab, focus, updateHash) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = doc.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      if (updateHash && window.history && history.replaceState) {
        history.replaceState(null, '', '#' + tab.dataset.tab);
      }
      var body = $('.welcome-body');
      if (body) body.scrollTop = 0;
    }
    function fromHash() {
      var h = (location.hash || '').replace('#', '');
      var tab = tabs.filter(function (t) { return t.dataset.tab === h; })[0];
      select(tab || tabs.filter(function (t) { return t.dataset.tab === 'projects'; })[0] || tabs[0], false, false);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false, true); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true, true); }
      });
    });
    $$('[data-open-tab]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = tabs.filter(function (x) { return x.dataset.tab === a.dataset.openTab; })[0];
        if (!t) return;
        e.preventDefault();
        select(t, true, true);
      });
    });
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  /* ---------------------------------------------------------------
     Project filters, search and the details bar
     --------------------------------------------------------------- */
  function initProjects() {
    var grid = $('.docgrid');
    if (!grid) return;
    var cards = $$('li', grid);
    var buttons = $$('.qf button');
    var input = $('#project-search');
    var empty = $('.pj-empty');
    var emptyQ = $('.pj-empty-q');
    var filter = store('dd-filter') || 'all';
    if (!buttons.some(function (b) { return b.dataset.filter === filter; })) filter = 'all';
    function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function apply() {
      var q = norm(input ? input.value.trim() : '');
      var shown = 0;
      cards.forEach(function (li) {
        var ok = (filter === 'all' || li.dataset.team === filter) && (!q || norm(li.textContent + ' ' + (li.dataset.keywords || '')).indexOf(q) !== -1);
        li.hidden = !ok;
        if (ok) shown++;
      });
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.filter === filter ? 'true' : 'false'); });
      if (empty) {
        empty.hidden = shown > 0;
        if (emptyQ) emptyQ.textContent = q ? 'No projects match “' + input.value.trim() + '”.' : 'No projects in this group.';
      }
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { filter = b.dataset.filter; store('dd-filter', filter); apply(); });
    });
    if (input) input.addEventListener('input', apply);
    var clear = $('.pj-empty button');
    if (clear) clear.addEventListener('click', function () {
      filter = 'all'; store('dd-filter', 'all');
      if (input) input.value = '';
      apply();
      if (input) input.focus();
    });
    apply();

    var details = $('.details');
    if (!details) return;
    var dTitle = $('.details-title', details), dText = $('.details-text', details), dRole = $('.details-role', details);
    var defaults = [dTitle.textContent, dText.textContent, dRole.textContent];
    function show(a) {
      dTitle.textContent = a.dataset.title;
      dText.textContent = a.dataset.summary;
      dRole.textContent = a.dataset.role || '';
    }
    function reset() { dTitle.textContent = defaults[0]; dText.textContent = defaults[1]; dRole.textContent = defaults[2]; }
    $$('.doc', grid).forEach(function (a) {
      a.addEventListener('mouseenter', function () { show(a); });
      a.addEventListener('focus', function () { show(a); });
      a.addEventListener('mouseleave', reset);
      a.addEventListener('blur', reset);
    });
  }

  /* ---------------------------------------------------------------
     Help popover
     --------------------------------------------------------------- */
  function initHelp() {
    var pop = doc.getElementById('help-pop');
    var btns = $$('[data-help]');
    if (!pop || !btns.length) return;
    var opener = null;
    function place(btn) {
      var r = btn.getBoundingClientRect();
      var w = pop.offsetWidth;
      var left = Math.min(Math.max(12, r.right - w), window.innerWidth - w - 12);
      pop.style.left = left + 'px';
      pop.style.top = Math.min(r.bottom + 8, window.innerHeight - pop.offsetHeight - 12) + 'px';
    }
    function open(btn) {
      opener = btn;
      pop.hidden = false;
      place(btn);
      btns.forEach(function (b) { b.setAttribute('aria-expanded', b === btn ? 'true' : 'false'); });
      var first = $('h2', pop);
      if (first) { first.tabIndex = -1; first.focus(); }
    }
    function close(returnFocus) {
      if (pop.hidden) return;
      pop.hidden = true;
      btns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (returnFocus && opener) opener.focus();
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!pop.hidden && opener === b) close(false); else open(b);
      });
    });
    $$('[data-help-close]', pop).forEach(function (b) { b.addEventListener('click', function () { close(true); }); });
    doc.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target)) close(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(true); });
    window.addEventListener('resize', function () { if (!pop.hidden && opener) place(opener); });
  }

  /* ---------------------------------------------------------------
     Feature tree: table of contents with scroll tracking
     --------------------------------------------------------------- */
  function initTree() {
    var tree = $('.tree');
    if (!tree) return;
    var toggle = $('.sections-toggle');
    var currentLabel = toggle ? $('.current', toggle) : null;
    var mobile = window.matchMedia('(max-width: 1023px)');

    $$('.tree-caret', tree).forEach(function (c) {
      c.addEventListener('click', function () {
        var open = c.getAttribute('aria-expanded') !== 'true';
        c.setAttribute('aria-expanded', open ? 'true' : 'false');
        var sub = doc.getElementById(c.getAttribute('aria-controls'));
        if (sub) sub.hidden = !open;
      });
    });

    function setOpen(open) {
      if (!toggle) return;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      tree.classList.toggle('is-open', open);
    }
    if (toggle) {
      toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tree.classList.contains('is-open')) { setOpen(false); toggle.focus(); } });
      doc.addEventListener('click', function (e) {
        if (mobile.matches && tree.classList.contains('is-open') && !tree.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
      });
    }
    tree.addEventListener('click', function (e) {
      var item = e.target.closest('.tree-item');
      if (item && mobile.matches) setOpen(false);
    });

    var links = $$('a.tree-item[href^="#"]:not(.tree-root)', tree);
    var sections = [];
    links.forEach(function (a) {
      var el = doc.getElementById(a.getAttribute('href').slice(1));
      if (el && sections.indexOf(el) === -1) sections.push(el);
    });
    if (!sections.length) return;
    var lastId = null;
    function mark() {
      var line = (parseInt(getComputedStyle(root).getPropertyValue('--titlebar-h'), 10) || 44) + 140;
      var best = sections[0];
      sections.forEach(function (s) { if (s.getBoundingClientRect().top <= line) best = s; });
      if (window.innerHeight + window.pageYOffset >= root.scrollHeight - 4) best = sections[sections.length - 1];
      if (best.id === lastId) return;
      lastId = best.id;
      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + best.id;
        a.classList.toggle('is-current', on);
        if (on) {
          a.setAttribute('aria-current', 'location');
          if (currentLabel) currentLabel.textContent = a.dataset.label || a.textContent.trim();
          if (!mobile.matches && a.scrollIntoView) {
            var tr = tree.getBoundingClientRect(), ar = a.getBoundingClientRect();
            if (ar.top < tr.top || ar.bottom > tr.bottom) tree.scrollTop += ar.top - tr.top - tr.height / 3;
          }
        } else a.removeAttribute('aria-current');
      });
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; mark(); });
    }, { passive: true });
    window.addEventListener('resize', mark);
    mark();
  }

  /* ---------------------------------------------------------------
     Photo / video graphics area (projects without a 3D model)
     --------------------------------------------------------------- */
  function initMedia() {
    $$('.viewport--media').forEach(function (vp) {
      var btns = $$('[data-media]', vp);
      var panes = $$('.media-pane', vp);
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          panes.forEach(function (p) {
            var on = p.id === b.dataset.media;
            p.hidden = !on;
            var v = $('video', p);
            if (v && !on) v.pause();
            if (v && on && v.hasAttribute('data-autoplay')) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
          });
        });
      });
    });
  }

  /* ---------------------------------------------------------------
     Lightbox for every gallery image
     --------------------------------------------------------------- */
  function initLightbox() {
    var shots = $$('.gallery .shot');
    if (!shots.length) return;
    var lb = doc.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Image viewer');
    var ico = function (n) { return '<svg class="ico" aria-hidden="true"><use href="#i-' + n + '"></use></svg>'; };
    lb.innerHTML = '<button type="button" class="lb-close" aria-label="Close">' + ico('close') + '</button>' +
      '<button type="button" class="lb-prev" aria-label="Previous image">' + ico('chev-left') + '</button>' +
      '<img alt="">' +
      '<button type="button" class="lb-next" aria-label="Next image">' + ico('chev-right') + '</button>' +
      '<p class="lb-cap"></p>';
    doc.body.appendChild(lb);
    var img = $('img', lb), cap = $('.lb-cap', lb);
    var idx = 0, last = null;
    function show(i) {
      idx = (i + shots.length) % shots.length;
      var s = $('img', shots[idx]);
      img.src = s.currentSrc || s.src;
      img.alt = s.alt;
      var fc = shots[idx].parentElement.querySelector('figcaption');
      cap.textContent = fc ? fc.textContent : s.alt;
    }
    function open(i) { last = doc.activeElement; show(i); lb.classList.add('open'); doc.body.style.overflow = 'hidden'; $('.lb-close', lb).focus(); }
    function close() { lb.classList.remove('open'); doc.body.style.overflow = ''; if (last) last.focus(); }
    shots.forEach(function (s, i) {
      s.setAttribute('aria-label', 'Enlarge image: ' + ($('img', s).alt || ''));
      s.addEventListener('click', function () { open(i); });
    });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    $('.lb-next', lb).addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    doc.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') {
        var f = $$('button', lb);
        var i = f.indexOf(doc.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
  }

  /* ---------------------------------------------------------------
     Opening the files straight from disk: 3D needs a web server
     --------------------------------------------------------------- */
  function fileProtocolNote() {
    if (location.protocol !== 'file:') return;
    $$('[data-viewer]').forEach(function (vp) {
      if (vp.dataset.mode === 'ambient') return;
      var stage = $('.vp-stage', vp) || vp;
      var p = doc.createElement('p');
      p.className = 'vp-note';
      p.textContent = 'The 3D model needs the site to be served from a web server (see README.md). A still image is shown instead.';
      stage.appendChild(p);
    });
  }

  function init() {
    runSplash();
    initTabs();
    initProjects();
    initHelp();
    initTree();
    initMedia();
    initLightbox();
    fileProtocolNote();
    var y = doc.getElementById('year');
    if (y) y.textContent = String(new Date().getFullYear());
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
