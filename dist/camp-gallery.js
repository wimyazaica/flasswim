/* Click, keyboard and swipe navigation. There is deliberately no autoplay. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-camp-gallery]').forEach(gallery => {
    if (gallery.dataset.campReady) return;
    const track = gallery.querySelector('.camp-gallery-track');
    const windowElement = gallery.querySelector('.camp-gallery-window');
    const originals = track ? [...track.children].filter(element => element.classList.contains('camp-gallery-slide')) : [];
    const count = originals.length;
    if (!count || !windowElement) return;
    gallery.dataset.campReady = 'true';

    const previous = gallery.querySelector('.camp-gallery-prev');
    const next = gallery.querySelector('.camp-gallery-next');
    const caption = gallery.querySelector('.camp-gallery-caption');
    const counter = gallery.querySelector('.camp-gallery-counter');
    const announcement = gallery.querySelector('.camp-gallery-live');
    const thumbnails = [...gallery.querySelectorAll('[data-camp-slide]')];
    let index = 0;
    let position = count > 1 ? 1 : 0;
    let moving = false;
    let finishTimer = 0;
    let focusPhotoAfterMove = false;
    let gesture = null;
    let dragFrame = 0;
    let suppressClickUntil = 0;
    const wrap = value => (value % count + count) % count;

    function cloneSlide(source) {
      const clone = source.cloneNode(true);
      clone.dataset.campClone = 'true';
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;
      clone.querySelectorAll('button,a,[tabindex]').forEach(element => { element.tabIndex = -1; });
      return clone;
    }
    // The bookends allow a one-step transition across either end of the album.
    if (count > 1) {
      track.prepend(cloneSlide(originals[count - 1]));
      track.append(cloneSlide(originals[0]));
    }

    function paintPosition(animate) {
      gallery.classList.toggle('is-resetting', !animate);
      track.style.transform = `translate3d(${-position * 100}%,0,0)`;
      if (!animate) {
        // Commit the invisible bookend reset before enabling transitions again.
        void track.offsetWidth;
        gallery.classList.remove('is-resetting');
      }
    }

    function updateInformation(announce = false) {
      originals.forEach((slide, slideIndex) => {
        const active = slideIndex === index;
        slide.setAttribute('aria-hidden', String(!active));
        slide.inert = !active;
        const photo = slide.querySelector('.camp-gallery-photo');
        if (photo) photo.tabIndex = active ? 0 : -1;
      });
      thumbnails.forEach(button => {
        button.setAttribute('aria-pressed', String(Number(button.dataset.campSlide) === index));
      });
      const activeSlide = originals[index];
      const image = activeSlide.querySelector('img');
      const description = activeSlide.dataset.caption || image?.alt || '';
      if (caption) caption.textContent = description;
      if (counter) counter.textContent = `${index + 1} / ${count}`;
      if (announce && announcement) announcement.textContent = `Фото ${index + 1} из ${count}. ${description}`;
    }

    function finishMove() {
      clearTimeout(finishTimer);
      finishTimer = 0;
      if (count > 1 && (position === 0 || position === count + 1)) {
        position = index + 1;
        paintPosition(false);
      }
      moving = false;
      if (focusPhotoAfterMove) {
        focusPhotoAfterMove = false;
        originals[index].querySelector('.camp-gallery-photo')?.focus({preventScroll: true});
      }
    }

    function select(nextIndex, options = {}) {
      if (moving || count < 2) return;
      const selected = wrap(nextIndex);
      if (selected === index) { paintPosition(!reduced.matches); return; }
      const focusIsOnPhoto = originals.some(slide => slide.contains(document.activeElement));
      // Move focus out before making the previous picture inert/aria-hidden.
      if (focusIsOnPhoto) gallery.focus({preventScroll:true});
      index = selected;
      position = options.position ?? index + 1;
      focusPhotoAfterMove = Boolean(options.focusPhoto || focusIsOnPhoto);
      updateInformation(true);
      moving = !reduced.matches;
      paintPosition(moving);
      if (moving) finishTimer = window.setTimeout(finishMove, 560);
      else finishMove();
    }

    function step(direction, focusPhoto = false) {
      select(index + direction, {position: position + direction, focusPhoto});
    }

    previous?.addEventListener('click', () => step(-1));
    next?.addEventListener('click', () => step(1));
    if (previous) previous.disabled = count < 2;
    if (next) next.disabled = count < 2;
    thumbnails.forEach(button => button.addEventListener('click', () => select(Number(button.dataset.campSlide))));
    track.addEventListener('transitionend', event => {
      if (event.target === track && event.propertyName === 'transform' && moving) finishMove();
    });

    windowElement.addEventListener('click', event => {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const photo = event.target.closest('.camp-gallery-photo');
      if (photo && !photo.closest('[data-camp-clone]')) {
        event.preventDefault();
        step(1, true);
      }
    });

    gallery.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target !== gallery && !event.target.closest('.camp-gallery-photo,.camp-gallery-thumb')) return;
      const focusPhoto = Boolean(event.target.closest('.camp-gallery-photo'));
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1, focusPhoto); }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1, focusPhoto); }
      if (event.key === 'Home') { event.preventDefault(); select(0, {focusPhoto}); }
      if (event.key === 'End') { event.preventDefault(); select(count - 1, {focusPhoto}); }
    });

    function stopGesture(event, cancel = false) {
      if (!gesture || (event && event.pointerId !== gesture.id)) return;
      const ended = gesture;
      gesture = null;
      cancelAnimationFrame(dragFrame);
      dragFrame = 0;
      gallery.classList.remove('is-dragging');
      if (windowElement.hasPointerCapture?.(ended.id)) windowElement.releasePointerCapture(ended.id);
      if (!ended.swiping) return;
      suppressClickUntil = performance.now() + 450;
      const threshold = Math.max(36, Math.min(70, windowElement.clientWidth * .13));
      if (!cancel && Math.abs(ended.dx) >= threshold) step(ended.dx < 0 ? 1 : -1);
      else paintPosition(!reduced.matches);
    }

    windowElement.addEventListener('pointerdown', event => {
      if (moving || count < 2 || !event.isPrimary || event.button !== 0) return;
      // Capture only after a horizontal gesture, so ordinary photo clicks stay native.
      gesture = {id:event.pointerId, x:event.clientX, y:event.clientY, dx:0, swiping:false};
    });
    windowElement.addEventListener('pointermove', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.swiping) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { stopGesture(event, true); return; }
        if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
        gesture.swiping = true;
        gallery.classList.add('is-dragging');
        windowElement.setPointerCapture?.(event.pointerId);
      }
      if (event.cancelable) event.preventDefault();
      const limit = windowElement.clientWidth * .9;
      gesture.dx = Math.max(-limit, Math.min(limit, dx));
      if (!dragFrame) dragFrame = requestAnimationFrame(() => {
        dragFrame = 0;
        if (gesture?.swiping) track.style.transform = `translate3d(calc(${-position * 100}% + ${gesture.dx}px),0,0)`;
      });
    }, {passive:false});
    windowElement.addEventListener('pointerup', event => stopGesture(event));
    windowElement.addEventListener('pointercancel', event => stopGesture(event, true));
    windowElement.addEventListener('lostpointercapture', event => stopGesture(event, true));
    windowElement.addEventListener('pointerleave', event => { if (gesture && !gesture.swiping) stopGesture(event, true); });
    windowElement.addEventListener('dragstart', event => event.preventDefault());
    window.addEventListener('resize', () => { if (gesture) stopGesture(null, true); });
    reduced.addEventListener('change', () => {
      if (gesture) stopGesture(null, true);
      if (moving) finishMove();
      paintPosition(false);
    });

    updateInformation();
    paintPosition(false);
  });
})();
