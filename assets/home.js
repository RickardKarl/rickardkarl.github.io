// Home page: sections fade in as they scroll into view, a down-arrow invites scrolling, and "Rickard" signs off under the last section.
document.documentElement.classList.add('js'); // the CSS hides .reveal only when this script runs

// sections fade in as they scroll into view (a little before they're fully on screen)
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: .15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// the arrow: fades in after a few seconds, scrolls to the About block, and goes away once the visitor scrolls
const down = document.getElementById('down');
setTimeout(() => down.classList.add('on'), 2500);
down.addEventListener('click', () => document.querySelector('.about').scrollIntoView({ behavior: 'smooth', block: 'start' }));
addEventListener('scroll', () => down.classList.toggle('away', scrollY > 40), { passive: true });

// the sign-off writes itself 7.5 s after it comes into view
let signed = false;
new IntersectionObserver(([e]) => {
  if (!e.isIntersecting || signed || !window.Vara) return; signed = true;
  setTimeout(() => {
    const el = document.getElementById('sig');
    const v = new Vara('#sig', '/assets/parisienne.json',
      [{ text: 'with love, Rickard', fontSize: 24, strokeWidth: 1.2, color: '#000', duration: 3000, textAlign: 'right', letterSpacing: -1 }]);
    v.ready(() => { el.style.transform = 'skewX(-25deg) scaleX(.97)'; }); // Vara measures on-screen size, so slant after layout
  }, 7500);
}, { threshold: .6 }).observe(document.getElementById('sig'));
