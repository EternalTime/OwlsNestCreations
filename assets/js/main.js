// Owl's Nest - scroll reveals and glass-card tilt.
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal-on-scroll
  var revealed = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    revealed.forEach(function (el) { io.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add('visible'); });
  }

  // Pointer tilt on glass cards
  if (!reduced) {
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      card.addEventListener('pointermove', function (ev) {
        var r = card.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width - 0.5;
        var y = (ev.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(700px) rotateY(' + (x * 7) + 'deg) rotateX(' + (-y * 7) + 'deg)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }
})();
