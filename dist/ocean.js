/* Small, progressively enhanced entrances; content is readable without motion. */
(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const candidates = document.querySelectorAll('.section-heading, .price-card, .trial-strip, .coach, .camp-copy, .reviews-copy, .contact-card');
  if (!preference.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if(entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, {threshold:0.08});
    candidates.forEach((element,index) => {
      element.classList.add('will-reveal');
      if (element.matches('.price-card')) element.style.setProperty('--reveal-delay',`${index % 4 * 65}ms`);
      observer.observe(element);
    });
    preference.addEventListener('change',event=>{if(event.matches){observer.disconnect();candidates.forEach(element=>element.classList.add('is-visible'));}});
  }
  const hero=document.querySelector('.ocean-hero');
  let pending=false;
  function paintWater(){
    pending=false;
    if(document.hidden||preference.matches)return;
    const box=hero.getBoundingClientRect();
    if(box.bottom>0)hero.style.setProperty('--water-shift',`${Math.min(28,Math.max(0,-box.top)*.045)}px`);
  }
  addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(paintWater);}},{passive:true});
  preference.addEventListener('change',()=>{if(preference.matches)hero.style.removeProperty('--water-shift');});
})();
