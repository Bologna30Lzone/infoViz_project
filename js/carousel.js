export function initCarousel({ onSlideChange } = {}) {
  const track = document.getElementById('track');
  const panels = Array.from(track.querySelectorAll('.panel'));
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const quickNav = document.getElementById('quickNav');
  const viewport = document.getElementById('viewport');
  const announce = document.getElementById('announce');

  let index = 0;

  // Build left nav from data-labels
  panels.forEach((p, i) => {
    const lab = p.dataset.label || `Slide ${i+1}`;
    const b = document.createElement('button');
    b.className = 'nav-item';
    b.type = 'button';
    b.textContent = lab;
    b.setAttribute('aria-label', `Go to ${lab}`);
    b.addEventListener('click', () => goTo(i));
    quickNav.appendChild(b);
  });

  const size = () => ({ width: viewport.clientWidth, height: viewport.clientHeight });
  const translateFor = (i, pxWidth = size().width) => `translateX(${-i * pxWidth}px)`;

  function updateUI() {
    btnPrev.disabled = index === 0;
    btnNext.disabled = index === panels.length - 1;
    quickNav.querySelectorAll('.nav-item').forEach((b, i) => b.setAttribute('aria-current', i === index ? 'true' : 'false'));
    if (announce) announce.textContent = `Slide ${index+1} of ${panels.length}`;
  }

  function goTo(i) {
    const clamped = Math.max(0, Math.min(i, panels.length - 1));
    index = clamped;
    track.style.transform = translateFor(index);
    onSlideChange?.(index, panels);
    updateUI();
  }

  // Keyboard
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(index - 1); }
  });
  viewport.tabIndex = 0;

  // Pointer swipe (ignore if starting on controls/nav)
  let startX = 0, startTx = 0, dragging = false;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.nav-btn') || e.target.closest('.navbar')) return;
    dragging = true; startX = e.clientX; startTx = -index * size().width; track.style.transition = 'none';
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - startX; track.style.transform = `translateX(${startTx + dx}px)`; });
  function endDrag(e) {
    if (!dragging) return; dragging = false; track.style.transition = '';
    const dx = e.clientX - startX; const threshold = size().width * 0.15;
    if (dx > threshold) goTo(index - 1); else if (dx < -threshold) goTo(index + 1); else goTo(index);
  }
  viewport.addEventListener('pointerup', endDrag); 
  viewport.addEventListener('pointercancel', endDrag);

  // Keep transform aligned & re-mount visible charts on resize
  const ro = new ResizeObserver(() => {
    track.style.transform = translateFor(index);
    onSlideChange?.(index, panels);
  });
  ro.observe(viewport);

  // Buttons
  btnPrev.addEventListener('click', () => goTo(index - 1));
  btnNext.addEventListener('click', () => goTo(index + 1));

  // Init
  goTo(0);

  return { panels, goTo };
}
