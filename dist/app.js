'use strict';

// Verified public content from flashswim.ru. Change schedules here when groups change.
const pools = [
  { id: 'ocsp', name: 'ОЦСП · ЗИЛ', fullName: 'Олимпийский центр синхронного плавания', address: 'Москва, Автозаводская улица, 23А, корпус 4', metro: 'ЗИЛ (МЦК) · Автозаводская', schedule: [['Понедельник', '17:30 · 19:00'], ['Вторник', '17:30 · 18:15 · 19:45'], ['Среда', '17:30 · 19:00'], ['Четверг', '17:30 · 18:15 · 19:45'], ['Суббота', '10:00'], ['Воскресенье', '11:30 · 13:00']], query: 'Олимпийский центр синхронного плавания Автозаводская 23А корпус 4 Москва', mapEmbed: 'https://yandex.ru/map-widget/v1/?mode=search&oid=79694199910&ol=biz&z=16' },
  { id: 'kolomensky', name: 'Коломенский', fullName: 'Бассейн на Коломенском проезде', address: 'Москва, Коломенский проезд, 15А', metro: '', schedule: [], query: 'Flash Swim Коломенский проезд 15А Москва', mapEmbed: 'https://yandex.ru/map-widget/v1/?mode=search&oid=205959555192&ol=biz&z=16' }
];
const coaches = [
  {name:'Алексей Мунтяну', initials:'АМ', role:'Групповые занятия', description:'КМС по водному поло. Бронзовый призёр Первенства России, серебряный призёр Спартакиады молодёжи.'},
  {name:'Даниил Оханов', initials:'ДО', role:'Персональные занятия', description:'КМС по плаванию. Высшее педагогическое образование. Призёр Московских соревнований среди студентов.'}
];
const reviewsOrganizationId = '79694199910';

let selectedPool = null;
let activePool = pools[0];
let currentSlot = null;
let chosenSlot = null;
let routeOrigin = '';
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const mapUrl = pool => 'https://yandex.ru/maps/?text=' + encodeURIComponent(pool.query || pool.address);

function updateContactLinks() {
  const program = byId('program-select').value;
  const slot = selectedPool && chosenSlot?.poolId === selectedPool.id ? chosenSlot : null;
  const message = `Здравствуйте! Хочу записаться в FLASH SWIM. Интересует: ${program}.${selectedPool ? ` Бассейн: ${selectedPool.name}.` : ''}${slot ? ` Удобное время: ${slot.day}, ${slot.time}.` : ''} Подскажите, пожалуйста, расписание и свободные места.`;
  byId('whatsapp-link').href = 'https://wa.me/79013853452?text=' + encodeURIComponent(message);
  byId('telegram-link').href = 'https://t.me/andreakman?text=' + encodeURIComponent(message);
  byId('selected-pool').textContent = selectedPool ? `Выбран бассейн: ${selectedPool.name}${slot ? ` · ${slot.day}, ${slot.time}` : ''} · ${selectedPool.address}` : 'Бассейн поможем подобрать в переписке';
}

function setMap(pool) {
  byId('map-select').value = pool.id;
  byId('location-address').textContent = pool.address;
  const params = new URLSearchParams({rtext: `${routeOrigin}~${pool.address}`, rtt: byId('route-mode').value});
  const embed = routeOrigin ? `https://yandex.ru/map-widget/v1/?${params}` : pool.mapEmbed;
  const frame = byId('map-frame');
  if (frame.getAttribute('src') !== embed) frame.src = embed;
  frame.title = routeOrigin ? `Маршрут до бассейна ${pool.name} на Яндекс Картах` : `Бассейн ${pool.name} на Яндекс Картах`;
  byId('map-external').href = routeOrigin ? `https://yandex.ru/maps/?${params}` : mapUrl(pool);
  byId('route-reset').hidden = !routeOrigin;
  byId('route-status').hidden = !routeOrigin;
  byId('route-status').textContent = routeOrigin ? `${routeOrigin} → ${pool.name}. Уточнить начальную точку и посмотреть время в пути можно на карте.` : '';
}

byId('route-form').addEventListener('submit', event => {
  event.preventDefault();
  const nextOrigin = byId('route-from').value.replace(/~/g, ' ').trim();
  if (!nextOrigin) { byId('route-from').value = ''; byId('route-from').reportValidity(); return; }
  routeOrigin = nextOrigin;
  setMap(activePool);
});
byId('route-mode').addEventListener('change', () => { if (routeOrigin) setMap(activePool); });
byId('route-reset').addEventListener('click', () => {
  routeOrigin = '';
  byId('route-from').value = '';
  setMap(activePool);
  byId('route-from').focus();
});

function setPool(id, focus = false) {
  const pool = pools.find(pool => pool.id === id) || pools[0];
  activePool = pool;
  currentSlot = null;
  document.querySelectorAll('.pool-tab').forEach(tab => {
    const active = tab.dataset.pool === pool.id;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  const panel = byId('pool-panel');
  panel.setAttribute('aria-labelledby', 'tab-' + pool.id);
  const shortDays = {Понедельник:'ПН',Вторник:'ВТ',Среда:'СР',Четверг:'ЧТ',Суббота:'СБ',Воскресенье:'ВС'};
  const scheduleMarkup = pool.schedule.length ? `<div class="weekdays" role="tablist" aria-label="Дни групповых тренировок">${pool.schedule.map((row,index)=>`<button type="button" class="schedule-day" role="tab" id="schedule-day-${index}" data-day-index="${index}" aria-label="${escapeHtml(row[0])}" aria-selected="${index===0}" aria-controls="pool-day-panel" tabindex="${index===0?0:-1}">${shortDays[row[0]]}<small>${index<4?'БУДНИ':'ВЫХОДНОЙ'}</small></button>`).join('')}</div><div class="day-details" id="pool-day-panel" role="tabpanel" aria-labelledby="schedule-day-0" aria-live="polite"></div>` : '<p class="schedule-empty">Расписание и доступные форматы занятий в этом бассейне уточняйте у администратора.</p>';
  panel.innerHTML = `<div class="pool-info"><p class="eyebrow">ЗДЕСЬ МЫ ПЛАВАЕМ</p><h3>${escapeHtml(pool.fullName || pool.name)}</h3><p>${escapeHtml(pool.address)}</p>${pool.metro ? `<div class="metro"><span></span>${escapeHtml(pool.metro)}</div>` : ''}<a class="text-link" href="${mapUrl(pool)}" target="_blank" rel="noopener noreferrer">Посмотреть на карте <span>↗</span></a>${pool.id === 'ocsp' ? '<div class="personal-schedule"><span class="type-label">ПЕРСОНАЛЬНЫЕ ЗАНЯТИЯ</span><p>Будни — после 16:00<br>Выходные — в течение дня</p></div>' : ''}${pool.id === 'ocsp' ? '<img class="pool-scene" src="assets/09-swimming-lanes.jpg" alt="Ученики FLASH SWIM на дорожке у стартовых тумб" width="1280" height="718" loading="lazy" decoding="async">' : ''}</div><div class="pool-schedule"><p class="schedule-head">${pool.schedule.length ? 'ГРУППЫ · ТРЕНЕР АЛЕКСЕЙ МУНТЯНУ' : 'ПОДБЕРЁМ УДОБНОЕ ВРЕМЯ'}</p>${scheduleMarkup}<a class="button button-primary" href="#contacts" data-program="Бесплатное занятие в группе" data-pool="${pool.id}">Записаться в этот бассейн <span>↗</span></a></div>`;
  if(pool.schedule.length) setDay(0);
  setMap(pool);
  if (focus) byId('tab-' + pool.id).focus();
}

function setDay(index, focus = false) {
  const row = activePool.schedule[index];
  if(!row)return;
  currentSlot=null;
  document.querySelectorAll('.schedule-day').forEach((day,dayIndex)=>{
    const active=dayIndex===index;
    day.setAttribute('aria-selected',String(active));
    day.tabIndex=active?0:-1;
  });
  const details=byId('pool-day-panel');
  details.setAttribute('aria-labelledby','schedule-day-'+index);
  details.innerHTML=`<h4>${escapeHtml(row[0])}</h4><p class="day-description">Групповая тренировка · выберите удобное время</p><div class="session-times">${row[1].split(' · ').map(time=>`<button type="button" class="time-choice" data-time="${time}" data-day="${escapeHtml(row[0])}" aria-pressed="false">${time}</button>`).join('')}</div>`;
  document.dispatchEvent(new CustomEvent('flashswim:daychange'));
  if(focus)byId('schedule-day-'+index).focus();
}
byId('pool-panel').addEventListener('click',event=>{
  const day=event.target.closest('.schedule-day');
  if(day){setDay(Number(day.dataset.dayIndex));return;}
  const slot=event.target.closest('.time-choice');
  if(slot){
    document.querySelectorAll('.time-choice').forEach(button=>button.setAttribute('aria-pressed',String(button===slot)));
    currentSlot={poolId:activePool.id,day:slot.dataset.day,time:slot.dataset.time};
  }
});
byId('pool-panel').addEventListener('keydown',event=>{
  const day=event.target.closest('.schedule-day');
  if(!day)return;
  if(event.ctrlKey || event.metaKey || event.altKey)return;
  const index=Number(day.dataset.dayIndex), count=activePool.schedule.length;
  let next;
  if(event.key==='ArrowRight')next=(index+1)%count;
  if(event.key==='ArrowLeft')next=(index-1+count)%count;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=count-1;
  if(next!==undefined){event.preventDefault();setDay(next,true);}
});

byId('pool-tabs').innerHTML = pools.map((pool, index) => `<button type="button" class="pool-tab" id="tab-${pool.id}" role="tab" aria-controls="pool-panel" aria-selected="${index === 0}" tabindex="${index === 0 ? '0' : '-1'}" data-pool="${pool.id}">${escapeHtml(pool.name)}</button>`).join('');
byId('map-select').innerHTML = pools.map(pool => `<option value="${pool.id}">${escapeHtml(pool.name)}</option>`).join('');
byId('pool-tabs').addEventListener('click', event => {
  const button = event.target.closest('.pool-tab');
  if (button) setPool(button.dataset.pool);
});
byId('pool-tabs').addEventListener('keydown', event => {
  const index = pools.findIndex(pool => 'tab-' + pool.id === document.activeElement.id);
  let next;
  if(event.ctrlKey || event.metaKey || event.altKey)return;
  if (event.key === 'ArrowRight') next = (index + 1) % pools.length;
  if (event.key === 'ArrowLeft') next = (index - 1 + pools.length) % pools.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = pools.length - 1;
  if (next !== undefined) { event.preventDefault(); setPool(pools[next].id, true); }
});
byId('map-select').addEventListener('change', event => setPool(event.target.value));

byId('coach-grid').innerHTML = coaches.length ? coaches.map((coach,index) => `<article class="coach"><div class="coach-portrait">${coach.photo ? `<img src="${escapeHtml(coach.photo)}" alt="${escapeHtml(coach.name)}" loading="lazy">` : ''}<span class="portrait-label">FLASH SWIM TEAM</span><span class="coach-initials" aria-hidden="true">${escapeHtml(coach.initials)}</span><span class="coach-number">0${index+1} / КОМАНДА</span></div><div><p class="coach-role">${escapeHtml(coach.role)}</p><h3>${escapeHtml(coach.name)}</h3><p>${escapeHtml(coach.description)}</p></div></article>`).join('') : '<div class="team-note"><h3>Знакомство начинается с тренера</h3><p>Подберём специалиста под возраст, уровень подготовки и ваши цели. Узнать о тренерах и выбрать время знакомства можно у администратора.</p><a class="text-link" href="#contacts">Познакомиться с командой <span>↗</span></a></div>';

if (reviewsOrganizationId) {
  byId('reviews-frame').innerHTML = `<iframe title="Отзывы о FLASH SWIM на Яндекс Картах" src="https://yandex.ru/maps-reviews-widget/${encodeURIComponent(reviewsOrganizationId)}?comments" loading="lazy"></iframe>`;
  byId('reviews-link').href = `https://yandex.ru/maps/org/${encodeURIComponent(reviewsOrganizationId)}/reviews/`;
} else {
  byId('reviews-frame').innerHTML = '<div class="reviews-placeholder"><div class="yandex-brand"><span>Я</span>ндекс Карты</div><p>Читайте отзывы учеников и родителей о школе FLASH SWIM на Яндекс Картах.</p><a class="button button-outline" href="https://yandex.ru/maps/?text=Flash%20Swim%20Москва" target="_blank" rel="noopener noreferrer">Перейти к отзывам <span>↗</span></a></div>';
}

document.addEventListener('click', event => {
  const link = event.target.closest('[data-program]');
  if (!link) return;
  const optionExists = [...byId('program-select').options].some(option => option.value === link.dataset.program);
  if (optionExists) byId('program-select').value = link.dataset.program;
  selectedPool = link.dataset.pool ? pools.find(pool => pool.id === link.dataset.pool) : null;
  chosenSlot = selectedPool && currentSlot?.poolId === selectedPool.id ? {...currentSlot} : null;
  updateContactLinks();
  byId('selection-status').textContent = `Выбрано: ${byId('program-select').value}${selectedPool ? ', бассейн ' + selectedPool.name : ''}`;
});
byId('program-select').addEventListener('change', updateContactLinks);

const menuButton = document.querySelector('.menu-toggle');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Открыть меню');
  byId('mobile-nav').hidden = true;
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  byId('mobile-nav').hidden = !open;
});
byId('mobile-nav').addEventListener('click', event => { if(event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if(event.key === 'Escape') closeMenu(); });
window.matchMedia('(min-width: 681px)').addEventListener('change', event => { if(event.matches) closeMenu(); });
byId('year').textContent = String(new Date().getFullYear());
setPool(pools[0].id);
updateContactLinks();
