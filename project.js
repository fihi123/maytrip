'use strict';
(() => {
  const projectKey = 'maytrip-project-v1';
  const categories = ['항공', '숙소', '교통', '식사', '기타'];
  const statuses = ['검토 중', '예약 예정', '예약 완료'];
  const money = new Intl.NumberFormat('ko-KR');
  const $ = id => document.getElementById(id);
  let project = { bookings: [], plan: '', notes: '', events: [] };
  function valid(data) {
    return data && (data.events === undefined || (Array.isArray(data.events) && data.events.length <= 500 && new Set(data.events.map(e => e.id)).size === data.events.length && data.events.every(e => e && typeof e.id === 'string' && [1,2,3,4].includes(e.day) && typeof e.name === 'string' && e.name.trim().length > 0 && e.name.length <= 120 && typeof e.time === 'string' && /^(|([01]\d|2[0-3]):[0-5]\d)$/.test(e.time) && ['예정','확정'].includes(e.status) && typeof e.place === 'string' && e.place.length <= 150 && typeof e.note === 'string' && e.note.length <= 2000))) && Array.isArray(data.bookings) && data.bookings.length <= 500 &&
      ['', 'a', 'b'].includes(data.plan) && typeof data.notes === 'string' && data.notes.length <= 10000 &&
      data.bookings.every(b => b && typeof b.id === 'string' && typeof b.name === 'string' && b.name.trim().length > 0 && b.name.length <= 120 && categories.includes(b.category) && statuses.includes(b.status) && Number.isSafeInteger(b.cost) && b.cost >= 0 && b.cost <= 1000000000) && new Set(data.bookings.map(b => b.id)).size === data.bookings.length;
  }
  function message(text) { $('project-message').textContent = text; }
  function persist() {
    try { localStorage.setItem(projectKey, JSON.stringify(project)); return true; }
    catch { $('storage-notice').textContent = '브라우저 저장이 불가능합니다. 페이지를 닫기 전에 준비 파일을 내려받아 보관하세요.'; return false; }
  }
  try {
    const raw = localStorage.getItem(projectKey);
    if (raw) {
      const data = JSON.parse(raw);
      if (valid(data)) project = { ...data, events: data.events || [] };
      else message('이전 저장 내용을 읽을 수 없습니다. 준비 파일을 불러와 주세요.');
    }
  } catch { message('저장 내용을 읽을 수 없습니다. 준비 파일로 보관해 주세요.'); }
  function stats() {
    const complete = items.filter((_, i) => state[i]).length;
    $('ready-count').textContent = `${complete} / ${items.length}`;
    $('ready-progress').max = items.length;
    $('ready-progress').value = complete;
    $('booked-count').textContent = `${project.bookings.filter(b => b.status === '예약 완료').length} / ${project.bookings.length}`;
    $('total-cost').textContent = money.format(project.bookings.reduce((sum, b) => sum + b.cost, 0)) + '원';
    $('selected-plan-label').textContent = project.plan ? `${project.plan.toUpperCase()}안으로 준비 중` : '아직 고민 중';
  }
  function render() {
    $('booking-list').replaceChildren();
    if (!project.bookings.length) {
      const empty = document.createElement('div'); empty.className = 'empty-state';
      empty.textContent = '아직 등록한 예약이 없어요. 첫 번째 예약 후보를 추가해 보세요.';
      $('booking-list').append(empty);
    }
    for (const booking of project.bookings) {
      const row = document.createElement('div'); row.className = 'booking-row';
      const category = document.createElement('span'); category.className = 'tag'; category.textContent = booking.category;
      const name = document.createElement('strong'); name.className = 'booking-name'; name.textContent = booking.name;
      const cost = document.createElement('span'); cost.className = 'booking-cost'; cost.textContent = money.format(booking.cost) + '원';
      const status = document.createElement('select'); status.setAttribute('aria-label', booking.name + ' 진행 상태');
      for (const value of statuses) { const option = new Option(value, value); status.add(option); }
      status.value = booking.status;
      status.addEventListener('change', () => { booking.status = status.value; persist(); stats(); });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-booking'; remove.textContent = '삭제'; remove.setAttribute('aria-label', booking.name + ' 삭제');
      remove.addEventListener('click', () => {
        if (!confirm(`‘${booking.name}’ 예약 기록을 삭제할까요?`)) return;
        project.bookings = project.bookings.filter(b => b.id !== booking.id); persist(); render();
      });
      row.append(category, name, cost, status, remove); $('booking-list').append(row);
    }
    window.dispatchEvent(new Event('maytrip-render')); $('chosen-plan').value = project.plan; $('notes').value = project.notes; stats();
  }
  $('booking-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const booking = { id: crypto.randomUUID(), category: form.get('category'), name: String(form.get('name')).trim(), cost: Number(form.get('cost')), status: form.get('status') };
    const next = { ...project, bookings: [...project.bookings, booking] };
    if (!valid(next)) { message('예약 이름과 금액을 확인해 주세요. 예약은 최대 500개까지 저장할 수 있습니다.'); return; }
    project = next; persist(); render(); event.currentTarget.reset(); message('예약 기록을 추가했습니다.');
  });
  $('chosen-plan').addEventListener('change', event => { project.plan = event.target.value; persist(); stats(); if (project.plan) showPlan(project.plan); });
  $('notes').addEventListener('input', event => { project.notes = event.target.value; $('notes-state').textContent = persist() ? '메모를 이 브라우저에 저장했습니다.' : '저장하지 못했습니다. 준비 파일을 내려받아 주세요.'; });
  $('checklist').addEventListener('change', stats);
  const originalReset = window.resetChecks;
  window.resetChecks = () => { originalReset(); stats(); };
  const today = new Date();
  const days = Math.ceil((Date.UTC(2027, 4, 13) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  $('countdown').textContent = days > 0 ? `여행까지 D-${days}` : days >= -3 ? '우리 가족 여행 중' : '다녀온 여행';
  $('export-project').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ version: 1, ...project, checks: state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'maytrip-family-project.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('가족에게 전달할 준비 파일을 내려받았습니다.');
  });
  $('import-project').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 1000000) throw new Error();
      const data = JSON.parse(await file.text());
      if (data.version !== 1 || !valid(data) || !data.checks || typeof data.checks !== 'object' || Array.isArray(data.checks) || Object.entries(data.checks).some(([k, v]) => !/^\d+$/.test(k) || Number(k) >= items.length || typeof v !== 'boolean')) throw new Error();
      if (!confirm('이 브라우저의 예약·일정 선택·메모·체크리스트를 준비 파일 내용으로 바꿀까요?')) return;
      project = { bookings: data.bookings, plan: data.plan, notes: data.notes, events: data.events || [] }; state = data.checks;
      const saved = persist();
      try { localStorage.setItem(key, JSON.stringify(state)); } catch { message('불러왔지만 브라우저에 저장하지 못했습니다.'); }
      renderChecks(); render(); if (project.plan) showPlan(project.plan);
      if (saved) message('가족의 여행 준비 내용을 불러왔습니다.');
    } catch { message('올바른 여행 준비 파일인지 확인해 주세요. 기존 내용은 유지됩니다.'); }
    finally { event.target.value = ''; }
  });
  window.maytrip = { getEvents: () => structuredClone(project.events || []), setEvents: events => { const next = { ...project, events }; if (!valid(next)) return false; project = next; persist(); return true; } };
  render();
})();
