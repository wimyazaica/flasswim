/* One silent film on the right. Two synchronized players dissolve between clean pool fragments. */
(async () => {
  'use strict';
  const host = document.querySelector('.hero-water');
  if (!host) return;
  const frameWindow = host.querySelector('.hero-film-frame') || host;
  function sizeFilmFrame() {
    const width = Math.max(host.clientWidth, host.clientHeight * 916 / 402);
    frameWindow.style.setProperty('--film-frame-width', width.toFixed(2) + 'px');
    frameWindow.style.setProperty('--film-frame-height', (width * 402 / 916).toFixed(2) + 'px');
  }
  sizeFilmFrame();
  if ('ResizeObserver' in window) new ResizeObserver(sizeFilmFrame).observe(host);
  else window.addEventListener('resize', sizeFilmFrame);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let playlist;
  try {
    const embedded = document.getElementById('hero-media-data');
    if (embedded) playlist = JSON.parse(embedded.textContent);
    else {
      const response = await fetch('hero-media.json');
      if (!response.ok) return;
      playlist = await response.json();
    }
  } catch { return; }
  const item = Array.isArray(playlist) && playlist.find(entry => entry.type === 'video');
  if (!item || !/^assets\/[a-zA-Z0-9_./-]+$/.test(item.src) || item.src.includes('..')) return;
  const blend = Math.max(.6, Math.min(2, Number(item.crossfade) || 1.2));
  const startTime = Math.max(0, Number(item.segmentStart) || 0);
  const endTime = Math.max(startTime + 4, Number(item.segmentEnd) || 14.8);
  const fallback = host.querySelector('img');
  if (fallback) fallback.className = 'hero-fallback';
  let active = 0;
  let visible = !('IntersectionObserver' in window);
  let switching = false;
  let settleTimer = 0;
  let generation = 0;
  let failed = false;
  host.style.setProperty('--film-dissolve', blend + 's');

  const films = [0, 1].map(index => {
    const film = document.createElement('video');
    film.className = 'hero-film';
    film.muted = true;
    film.defaultMuted = true;
    film.playsInline = true;
    film.controls = false;
    film.preload = 'metadata';
    film.setAttribute('muted', '');
    film.setAttribute('playsinline', '');
    film.setAttribute('aria-hidden', 'true');
    film.tabIndex = -1;
    film.disablePictureInPicture = true;
    if (item.poster && /^assets\/[a-zA-Z0-9_./-]+$/.test(item.poster) && !item.poster.includes('..')) film.poster = item.poster;
    film.addEventListener('timeupdate', () => {
      if (index !== active || !canPlay() || switching) return;
      const stop = Number.isFinite(film.duration) ? Math.min(endTime, film.duration) : endTime;
      if (film.currentTime >= stop - blend) dissolve();
    });
    film.addEventListener('ended', () => { if (index === active && canPlay()) dissolve(); });
    film.addEventListener('error', () => {
      failed = true;
      suspend();
      films.forEach(video => video.classList.remove('is-active'));
      host.classList.remove('has-film');
    });
    film.src = item.src;
    frameWindow.append(film);
    return film;
  });

  function canPlay() { return visible && !document.hidden && !reduced.matches && !failed; }

  function suspend() {
    generation++;
    clearTimeout(settleTimer);
    settleTimer = 0;
    switching = false;
    films.forEach((film, index) => {
      film.pause();
      if (index !== active) film.classList.remove('is-active');
    });
  }

  async function resume() {
    host.classList.toggle('is-reduced', reduced.matches);
    if (!canPlay()) { suspend(); return; }
    const epoch = generation;
    const film = films[active];
    film.preload = 'auto';
    try {
      if (film.currentTime >= endTime - blend) film.currentTime = startTime;
      await film.play();
      if (epoch !== generation) return;
      if (!canPlay()) { film.pause(); return; }
      film.classList.add('is-active');
      host.classList.add('has-film');
    } catch {
      // Autoplay restrictions leave the real team photograph visible.
    }
  }

  async function dissolve() {
    if (switching || !canPlay()) return;
    switching = true;
    const epoch = generation;
    const previous = active;
    const next = 1 - active;
    const film = films[next];
    // Hold the clean pool frame while the next player becomes ready.
    films[previous].pause();
    try {
      film.currentTime = startTime;
      film.preload = 'auto';
      await film.play();
      if (epoch !== generation) return;
      if (!canPlay()) { film.pause(); switching = false; return; }
      active = next;
      films[previous].style.zIndex = '1';
      film.style.zIndex = '2';
      film.classList.add('is-active');
      settleTimer = window.setTimeout(() => {
        films[previous].classList.remove('is-active');
        films[previous].pause();
        try { films[previous].currentTime = startTime; } catch {}
        settleTimer = 0;
        switching = false;
      }, blend * 1000 + 80);
    } catch {
      if (epoch !== generation) return;
      switching = false;
      try { films[previous].currentTime = startTime; } catch {}
      resume();
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) resume(); else suspend();
    }, {threshold:.08}).observe(host);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else resume(); });
  reduced.addEventListener('change', () => {
    suspend();
    host.classList.toggle('is-reduced', reduced.matches);
    if (!reduced.matches) resume();
  });
  host.classList.toggle('is-reduced', reduced.matches);
  if (visible) resume();
})();
