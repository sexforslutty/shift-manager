const getTodayIso = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const today = new Date();
const initialTodayIso = getTodayIso();
const state = { month: new Date(today.getFullYear(), today.getMonth(), 1), selected: initialTodayIso, today: initialTodayIso, mobileDirection: 'next' };
const appData = { shifts: [], team: [] };
const $ = (selector) => document.querySelector(selector);
const loaderStartedAt = performance.now();
let loaderProgress = 8;
const loaderTimer = setInterval(() => {
  loaderProgress = Math.min(loaderProgress + Math.random() * 7, 88);
  updateLoader(loaderProgress);
}, 140);
const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const weekdayNames = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const getData = (key, fallback = []) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
const themeStorageKey = 'shift-manager-theme';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const initials = (name) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const rowValue = (row, names) => { const key = Object.keys(row).find((item) => names.includes(item.trim().toLowerCase())); return key ? String(row[key]).trim() : ''; };
const replayAnimation = (element, className) => {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
};
function updateLoader(value) {
  const progress = $('#page-loader-progress');
  const percent = $('#page-loader-percent');
  if (progress) progress.style.width = `${value}%`;
  if (percent) percent.textContent = `${Math.round(value)}%`;
}
function finishLoader() {
  const loader = $('#page-loader');
  if (!loader || loader.classList.contains('is-hidden')) return;
  const wait = Math.max(0, 650 - (performance.now() - loaderStartedAt));
  clearInterval(loaderTimer);
  setTimeout(() => {
    updateLoader(100);
    setTimeout(() => {
      loader.classList.add('is-hidden');
      setTimeout(() => loader.remove(), 650);
    }, 260);
  }, wait);
}
updateLoader(loaderProgress);
const normalizeDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const text = String(value ?? '').trim();
  const localized = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (localized) {
    const date = new Date(Date.UTC(Number(localized[3]), Number(localized[2]) - 1, Number(localized[1])));
    if (date.getUTCFullYear() !== Number(localized[3]) || date.getUTCMonth() !== Number(localized[2]) - 1 || date.getUTCDate() !== Number(localized[1])) return '';
    return `${localized[3]}-${localized[2].padStart(2, '0')}-${localized[1].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text) return text;
    return '';
  }
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 0 && serial < 100000) {
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  return '';
};
const parseShiftRows = (rows) => {
  const parsed = rows.map((row) => ({ date: normalizeDate(rowValue(row, ['дата','дата (дд.мм.гггг)','date'])), shift: rowValue(row, ['смена','shift']), name: rowValue(row, ['сотрудник','имя','name']), role: rowValue(row, ['роль','должность','role']) }));
  if (parsed.some((row) => !row.date)) throw new Error('В листе «Смены» есть пустая или некорректная дата');
  return parsed;
};
const isNight = (shift) => {
  const normalized = String(shift).toLowerCase();
  return /ноч|night/.test(normalized) || /(?:^|\D)22\s*[:.]\s*\d{2}/.test(normalized);
};
function applyTheme(isDark) {
  document.body.classList.toggle('dark-theme', isDark);
  const toggle = $('#theme-toggle');
  toggle.setAttribute('aria-pressed', String(isDark));
  toggle.setAttribute('aria-label', isDark ? 'Выключить тёмную тему' : 'Включить тёмную тему');
  toggle.querySelector('.theme-toggle-label').textContent = isDark ? 'Светлая тема' : 'Тёмная тема';
}
const isShiftActive = (row) => {
  if (state.selected !== getTodayIso()) return false;
  if ((row.date || row['Дата']) && (row.date || row['Дата']) !== state.selected) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const night = isNight(String(row.shift || row['Смена'] || ''));
  return night ? currentMinutes >= 22 * 60 || currentMinutes < 10 * 60 : currentMinutes >= 10 * 60 && currentMinutes < 22 * 60;
};

function renderEmployees() {
  const team = appData.team.map((person) => ({
    name: person.name || person['Сотрудник'] || person['Имя'] || '',
    role: person.role || person['Роль'] || person['Должность'] || 'Администратор'
  })).filter((person) => person.name);
  $('#employee-count').textContent = team.length;
  $('#employee-list').innerHTML = team.length ? team.map((person) => `<div class="employee"><div class="avatar">${escapeHtml(initials(person.name))}</div><div><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role || 'Администратор')}</small></div></div>`).join('') : '<div class="empty-state">Сотрудники не загружены</div>';
  replayAnimation($('#employee-list'), 'list-swap');
}

function renderCurrent() {
  const shifts = appData.shifts.filter((row) => row.date === state.selected || row['Дата'] === state.selected);
  const isToday = state.selected === getTodayIso();
  $('#current-title').textContent = isToday ? 'СЕЙЧАС' : 'ВЫБРАННАЯ ДАТА';
  const currentType = new Date().getHours() >= 22 ? 'night' : 'day';
  const current = (isToday
    ? shifts.find((row) => isShiftActive(row)) || shifts.find((row) => isNight(String(row.shift || row['Смена'] || '')) === (currentType === 'night'))
    : shifts[0]) || shifts[0];
  if (!current) {
    $('#current-content').innerHTML = '<div class="current-empty"><h2>Загрузите данные</h2><p>Добавьте Excel-файл в админке, чтобы увидеть расписание.</p><span class="current-status empty"><i></i>нет данных</span></div>';
    replayAnimation($('#current-content'), 'content-swap');
    return;
  }
  const night = isNight(String(current.shift || current['Смена'] || ''));
  const name = current.name || current['Сотрудник'] || current['Имя'];
  const shift = current.shift || current['Смена'] || (night ? 'Ночь' : 'День');
  const active = isShiftActive(current);
  $('#current-content').innerHTML = `<div class="current-main"><div><h2>${escapeHtml(name)}</h2><p>${shift === 'Ночь' || night ? 'Ночная смена' : 'Дневная смена'} · ${night ? '22:00 — 10:00' : '10:00 — 22:00'}</p></div><span class="current-status${active ? ' active' : ''}"><i></i>${active ? 'идёт сейчас' : 'смена по расписанию'}</span></div>`;
  replayAnimation($('#current-content'), 'content-swap');
}

function renderCalendar() {
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  $('#month-title').textContent = `${monthNames[month]} ${year}`;
  replayAnimation($('#month-title'), 'month-swap');
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const shifts = appData.shifts;
  let html = '';
  for (let i = 0; i < firstDay; i += 1) html += '<div class="calendar-day empty"></div>';
  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayShifts = shifts.filter((row) => (row.date || row['Дата']) === date);
    const todayMarker = date === getTodayIso() ? ' today' : '';
    html += `<button class="calendar-day${todayMarker}${date === state.selected ? ' selected' : ''}" data-date="${date}"><span class="calendar-day-number">${day}</span>${dayShifts.map((row) => `<span class="calendar-shift ${isNight(String(row.shift || row['Смена'] || '')) ? 'night' : 'day'}">${escapeHtml(row.name || row['Сотрудник'] || 'Смена')}</span>`).join('')}</button>`;
  }
  $('#calendar-grid').innerHTML = html;
  replayAnimation($('#calendar-grid'), 'grid-swap');
  document.querySelectorAll('.calendar-day[data-date]').forEach((day) => day.addEventListener('click', () => {
    state.mobileDirection = day.dataset.date >= state.selected ? 'next' : 'previous';
    state.selected = day.dataset.date;
    renderCurrent();
    renderCalendar();
  }));
  renderMobileDay();
}

function render() { renderCurrent(); renderCalendar(); renderEmployees(); }

function renderMobileDay() {
  const mobileView = $('#mobile-day-view');
  mobileView.classList.toggle('is-next', state.mobileDirection === 'next');
  mobileView.classList.toggle('is-previous', state.mobileDirection === 'previous');
  const selectedDate = new Date(`${state.selected}T12:00:00`);
  const shifts = appData.shifts.filter((row) => (row.date || row['Дата']) === state.selected);
  $('#mobile-day-title').textContent = weekdayNames[selectedDate.getDay()];
  $('.mobile-day-label').textContent = state.selected === getTodayIso() ? 'СЕГОДНЯ' : 'ВЫБРАННЫЙ ДЕНЬ';
  $('#mobile-day-date').textContent = selectedDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  $('#mobile-day-shifts').innerHTML = shifts.length ? shifts.map((row) => {
    const night = isNight(String(row.shift || row['Смена'] || ''));
    const name = row.name || row['Сотрудник'] || row['Имя'] || 'Сотрудник не указан';
    const shift = row.shift || row['Смена'] || (night ? 'Ночь' : 'День');
    const active = isShiftActive(row);
    return `<div class="mobile-shift-row ${night ? 'night' : 'day'}${active ? ' active' : ''}"><span class="mobile-shift-dot"></span><div><strong>${escapeHtml(name)}</strong><small>${night ? 'Ночная смена' : 'Дневная смена'}</small></div><b>${active ? 'Идёт сейчас' : (night ? '22:00 — 10:00' : '10:00 — 22:00')}</b></div>`;
  }).join('') : '<div class="mobile-no-shift">На этот день смены не назначены</div>';
  replayAnimation($('.mobile-day-current'), 'mobile-day-swap');
  replayAnimation($('#mobile-day-shifts'), 'content-swap');
}

function shiftSelectedDay(offset) {
  state.mobileDirection = offset > 0 ? 'next' : 'previous';
  const date = new Date(`${state.selected}T12:00:00`);
  date.setDate(date.getDate() + offset);
  state.selected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  state.month = new Date(date.getFullYear(), date.getMonth(), 1);
  renderCurrent();
  renderCalendar();
}

$('#previous-month').addEventListener('click', () => { state.month.setMonth(state.month.getMonth() - 1); renderCalendar(); });
$('#next-month').addEventListener('click', () => { state.month.setMonth(state.month.getMonth() + 1); renderCalendar(); });
$('#previous-day').addEventListener('click', () => shiftSelectedDay(-1));
$('#next-day').addEventListener('click', () => shiftSelectedDay(1));

function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; script.onload = () => resolve(window.XLSX); script.onerror = () => reject(new Error('Не удалось загрузить Excel-модуль')); document.head.appendChild(script); });
}
function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); setTimeout(() => element.classList.remove('show'), 2600); }
function credentials() { return getData('shiftline-admin-credentials', { name: 'admin', password: 'admin' }); }

function openAdmin() { $('#admin-modal').hidden = false; $('#admin-login').hidden = false; $('#admin-panel').hidden = true; $('#login-error').hidden = true; $('#login-name').value = credentials().name; $('#login-password').value = ''; }
$('#admin-open').addEventListener('click', openAdmin);
const savedTheme = localStorage.getItem(themeStorageKey);
applyTheme(savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches));
$('#theme-toggle').addEventListener('click', () => {
  const isDark = !document.body.classList.contains('dark-theme');
  localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light');
  applyTheme(isDark);
});
$('#close-admin').addEventListener('click', () => { $('#admin-modal').hidden = true; });
$('#admin-login').addEventListener('submit', (event) => { event.preventDefault(); const auth = credentials(); if ($('#login-name').value.trim() !== auth.name || $('#login-password').value !== auth.password) { $('#login-error').hidden = false; return; } $('#login-error').hidden = true; $('#admin-login').hidden = true; $('#admin-panel').hidden = false; $('#admin-name').textContent = auth.name; $('#new-name').value = auth.name; });
$('#logout').addEventListener('click', openAdmin);

$('#download-template').addEventListener('click', async () => {
  const XLSX = await loadXlsx();
  const book = XLSX.utils.book_new();
  const shiftsSheet = XLSX.utils.aoa_to_sheet([['Дата','Смена','Сотрудник','Роль']]);
  XLSX.utils.book_append_sheet(book, shiftsSheet, 'Смены');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Сотрудник','Роль']]), 'Команда');
  XLSX.writeFile(book, 'shiftline-шаблон.xlsx'); toast('Шаблон скачан');
});
$('#download-current').addEventListener('click', () => {
  window.location.href = '/api/current.xlsx';
});
$('#excel-file').addEventListener('change', async (event) => {
  const file = event.target.files[0]; if (!file) return;
  $('#file-name').textContent = file.name;
  try {
    const XLSX = await loadXlsx(); const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const shiftsSheet = book.Sheets['Смены'] || book.Sheets[book.SheetNames[0]]; const teamSheet = book.Sheets['Команда'];
    const shifts = XLSX.utils.sheet_to_json(shiftsSheet, { defval: '' }); const team = teamSheet ? XLSX.utils.sheet_to_json(teamSheet, { defval: '' }) : [];
    if (!shifts.length || !team.length) throw new Error('Нужны листы «Смены» и «Команда» с данными');
    const parsedShifts = parseShiftRows(shifts);
    const upload = await fetch('/api/upload', { method: 'POST', body: (() => { const data = new FormData(); data.append('file', file, file.name); return data; })() });
    if (!upload.ok) throw new Error('Не удалось сохранить Excel на сервере');
    appData.shifts = parsedShifts;
    appData.team = team.map((row) => ({ name: rowValue(row, ['сотрудник','имя','name']), role: rowValue(row, ['роль','должность','role']) })).filter((row) => row.name);
    render(); toast('Данные загружены');
  } catch (error) { toast(error.message); }
});
$('#credentials-form').addEventListener('submit', (event) => { event.preventDefault(); localStorage.setItem('shiftline-admin-credentials', JSON.stringify({ name: $('#new-name').value.trim(), password: $('#new-password').value })); $('#new-password').value = ''; toast('Данные сохранены'); });
render();

function renderClock() {
  const now = new Date();
  $('#live-clock').textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('#live-clock').dateTime = now.toISOString();
}

renderClock();

async function loadSavedWorkbook() {
  try {
    const response = await fetch('/api/current.xlsx');
    if (!response.ok) return;
    const XLSX = await loadXlsx();
    const book = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const shifts = XLSX.utils.sheet_to_json(book.Sheets['Смены'] || book.Sheets[book.SheetNames[0]], { defval: '' });
    const team = book.Sheets['Команда'] ? XLSX.utils.sheet_to_json(book.Sheets['Команда'], { defval: '' }) : [];
    appData.shifts = parseShiftRows(shifts);
    appData.team = team.map((row) => ({ name: rowValue(row, ['сотрудник','имя','name']), role: rowValue(row, ['роль','должность','role']) })).filter((row) => row.name);
    render();
  } catch (error) {
    toast('Не удалось загрузить сохранённый Excel');
  } finally {
    finishLoader();
  }
}
loadSavedWorkbook();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Не удалось включить offline-режим PWA', error);
    });
  });
}
setInterval(() => {
  const currentDate = getTodayIso();
  const dayChanged = currentDate !== state.today;
  if (state.selected === state.today) state.selected = currentDate;
  const monthKey = `${state.month.getFullYear()}-${String(state.month.getMonth() + 1).padStart(2, '0')}`;
  if (monthKey !== currentDate.slice(0, 7) && state.selected === currentDate) {
    state.month = new Date(`${currentDate}-01T00:00:00`);
  }
  state.today = currentDate;
  if (dayChanged) render();
  else {
    renderCurrent();
    renderMobileDay();
  }
}, 60000);
setInterval(renderClock, 1000);
