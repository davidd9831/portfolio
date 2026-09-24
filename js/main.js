// Mobile nav, scroll reveal, gallery lightbox, 3D model switcher.
(function () {
  // Mobile nav
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') links.classList.remove('open');
    });
  }

  // Reveal on scroll
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // Lightbox for every .gallery .shot
  var shots = Array.prototype.slice.call(document.querySelectorAll('.gallery .shot'));
  if (shots.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML =
      '<button class="lb-close" aria-label="Close">✕</button>' +
      '<button class="lb-prev" aria-label="Previous">‹</button>' +
      '<img alt="">' +
      '<button class="lb-next" aria-label="Next">›</button>' +
      '<div class="lb-cap"></div>';
    document.body.appendChild(lb);
    var img = lb.querySelector('img');
    var cap = lb.querySelector('.lb-cap');
    var idx = 0;
    function show(i) {
      idx = (i + shots.length) % shots.length;
      var s = shots[idx].querySelector('img');
      img.src = s.currentSrc || s.src;
      img.alt = s.alt;
      var fc = shots[idx].parentElement.querySelector('figcaption');
      cap.textContent = fc ? fc.textContent : s.alt;
    }
    function open(i) { show(i); lb.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { lb.classList.remove('open'); document.body.style.overflow = ''; }
    shots.forEach(function (s, i) { s.addEventListener('click', function () { open(i); }); });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  // Model switcher: <div class="viewer-tabs" data-target="id"><button data-src="...">
  document.querySelectorAll('.viewer-tabs').forEach(function (tabs) {
    var mv = document.getElementById(tabs.dataset.target);
    if (!mv) return;
    tabs.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        tabs.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        mv.src = b.dataset.src;
        if (b.dataset.orbit) mv.cameraOrbit = b.dataset.orbit;
      });
    });
  });

  // Footer year
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
