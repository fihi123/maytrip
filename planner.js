'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let day = 1;
  const dates = ['5/13 (목)', '5/14 (금)', '5/15 (토)', '5/16 (일)'];
  const views = ['schedule', 'budget', 'prep', 'notes', 'guide'];
  function view(name) {
    if (!views.includes(name)) name = 'schedule';
    for (const page of document.querySelectorAll('[data-page]')) page.hidden = page.dataset.page !== name;
    for (const tab of document.querySelectorAll('[data-workspace]')) {
      if (tab.dataset.workspace === name) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
  }
  for (const button of document.querySelectorAll('[data-workspace]')) button.addEventListener('click', () => { view(button.dataset.workspace); history.replaceState(null, '', '#' + button.dataset.workspace); });
  view(location.hash.slice(1));
  function render() {
    const events = window.maytrip.getEvents();
    $('day-tabs').replaceChildren();
    dates.forEach((date, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = `${index + 1}일차 · ${date}`;
      if (day === index + 1) button.setAttribute('aria-current', 'date');
      button.addEventListener('click', () => { day = index + 1; render(); }); $('day-tabs').append(button);
    });
    const selected = events.filter(event => event.day === day).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    $('day-heading').textContent = `${dates[day - 1]} · ${selected.length}개의 일정`;
    $('event-list').replaceChildren();
    if (!selected.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = '아직 정한 일정이 없어요. 항공, 식사, 휴식부터 하나씩 추가해 보세요.'; $('event-list').append(empty); }
    selected.forEach(event => $('event-list').append(card(event)));
  }
  function card(event) {
    const row = document.createElement('article'); row.className = 'event-card';
    const time = document.createElement('time'); time.textContent = event.time || '시간 미정';
    const body = document.createElement('div'); const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = `${dates[event.day - 1]} · ${event.status}`;
    const title = document.createElement('h3'); title.textContent = event.name; body.append(tag, title);
    if (event.place) { const place = document.createElement('p'); place.textContent = event.place; body.append(place); const map = document.createElement('a'); map.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(event.place); map.target = '_blank'; map.rel = 'noopener noreferrer'; map.textContent = '지도에서 장소 검색 ↗'; map.className = 'note'; body.append(map); }
    if (event.note) { const note = document.createElement('p'); note.className = 'muted'; note.textContent = event.note; body.append(note); }
    const actions = document.createElement('div'); actions.className = 'event-actions';
    const edit = document.createElement('button'); edit.className = 'btn'; edit.textContent = '수정'; edit.addEventListener('click', () => open(event));
    const remove = document.createElement('button'); remove.className = 'btn'; remove.textContent = '삭제'; remove.addEventListener('click', () => { if (confirm(`‘${event.name}’ 일정을 삭제할까요?`)) { window.maytrip.setEvents(window.maytrip.getEvents().filter(e => e.id !== event.id)); render(); } });
    actions.append(edit, remove); row.append(time, body, actions); return row;
  }
  function open(event) {
    const form = $('event-form'); form.reset();
    const values = event || { id: '', day, name: '', time: '', status: '예정', place: '', note: '' };
    Object.entries(values).forEach(([key, value]) => { if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value; });
    $('event-dialog-title').textContent = event ? '일정 수정' : '일정 추가'; $('event-dialog').showModal();
  }
  $('add-event').addEventListener('click', () => open());
  $('close-event').addEventListener('click', () => $('event-dialog').close());
  $('event-form').addEventListener('submit', event => {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const record = { id: fields.get('id') || crypto.randomUUID(), day: Number(fields.get('day')), name: fields.get('name').trim(), time: fields.get('time'), status: fields.get('status'), place: fields.get('place').trim(), note: fields.get('note').trim() };
    const events = window.maytrip.getEvents(); const index = events.findIndex(e => e.id === record.id);
    if (index >= 0) events[index] = record; else events.push(record);
    if (!window.maytrip.setEvents(events)) { alert('일정 이름을 입력해 주세요. 일정은 최대 500개까지 저장할 수 있습니다.'); return; }
    day = record.day; render(); $('event-dialog').close();
  });
  $('print-schedule').addEventListener('click', () => {
    const events = window.maytrip.getEvents().sort((a,b) => a.day - b.day || (a.time || '99:99').localeCompare(b.time || '99:99'));
    $('event-list').replaceChildren(...events.map(card)); $('day-heading').textContent = '전체 여행 일정 · 5/13 — 5/16'; document.body.classList.add('print-schedule'); window.print(); document.body.classList.remove('print-schedule'); render();
  });
  window.addEventListener('maytrip-render', render);
  render();
})();
