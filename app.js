const SHIFTS = [
  { id: 'day', name: '白班', time: '08:00–16:00', start: '080000', end: '160000', startHour: 8, duration: 8 },
  { id: 'night', name: '夜班', time: '00:00–08:00', start: '000000', end: '080000', startHour: 0, duration: 8 },
  { id: 'mid', name: '中班', time: '16:00–24:00', start: '160000', end: '235959', startHour: 16, duration: 8 },
  { id: 'rest', name: '休息' },
  { id: 'rest', name: '休息' },
];

// 2026 年放假和调休安排，依据国办发明电〔2025〕7 号。
const HOLIDAY_NOTICES = Object.freeze({
  '2026-01-01': { label: '元旦休' }, '2026-01-02': { label: '元旦休' }, '2026-01-03': { label: '元旦休' }, '2026-01-04': { label: '元旦补班', workday: true },
  '2026-02-14': { label: '春节补班', workday: true }, '2026-02-15': { label: '春节休' }, '2026-02-16': { label: '春节休' }, '2026-02-17': { label: '春节休' }, '2026-02-18': { label: '春节休' }, '2026-02-19': { label: '春节休' }, '2026-02-20': { label: '春节休' }, '2026-02-21': { label: '春节休' }, '2026-02-22': { label: '春节休' }, '2026-02-23': { label: '春节休' }, '2026-02-28': { label: '春节补班', workday: true },
  '2026-04-04': { label: '清明休' }, '2026-04-05': { label: '清明休' }, '2026-04-06': { label: '清明休' },
  '2026-05-01': { label: '劳动节休' }, '2026-05-02': { label: '劳动节休' }, '2026-05-03': { label: '劳动节休' }, '2026-05-04': { label: '劳动节休' }, '2026-05-05': { label: '劳动节休' }, '2026-05-09': { label: '劳动节补班', workday: true },
  '2026-06-19': { label: '端午休' }, '2026-06-20': { label: '端午休' }, '2026-06-21': { label: '端午休' },
  '2026-09-20': { label: '国庆补班', workday: true }, '2026-09-25': { label: '中秋休' }, '2026-09-26': { label: '中秋休' }, '2026-09-27': { label: '中秋休' },
  '2026-10-01': { label: '国庆休' }, '2026-10-02': { label: '国庆休' }, '2026-10-03': { label: '国庆休' }, '2026-10-04': { label: '国庆休' }, '2026-10-05': { label: '国庆休' }, '2026-10-06': { label: '国庆休' }, '2026-10-07': { label: '国庆休' }, '2026-10-10': { label: '国庆补班', workday: true },
});
const SHIFT_BY_ID = Object.freeze({ day: SHIFTS[0], night: SHIFTS[1], mid: SHIFTS[2], rest: SHIFTS[3] });
const OVERRIDE_STORAGE_KEY = 'shiftflow-shift-overrides';

const dateInput = document.querySelector('#anchor-date');
const dateDisplay = document.querySelector('#anchor-date-display');
const shiftInput = document.querySelector('#anchor-shift');
const yearsInput = document.querySelector('#years');
const grid = document.querySelector('#calendar-grid');
const monthLabel = document.querySelector('#month-label');
const exportSummary = document.querySelector('#export-summary');
const colorInputs = document.querySelectorAll('[data-shift-color]');
const hexInputs = document.querySelectorAll('[data-hex-input]');
const COLOR_DEFAULTS = { day: '#E4A836', night: '#3D629B', mid: '#D16B4E', rest: '#A2ABB2', today: '#1F8578' };
const COLOR_STORAGE_KEY = 'shiftflow-shift-colors';
let shiftOverrides = readShiftOverrides();
let selectedDateKey = null;
const currentDate = new Date();
let displayMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function updateAnchorDateDisplay() {
  const date = parseDate(dateInput.value);
  dateDisplay.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function cycleIndexFor(date) {
  const anchor = parseDate(dateInput.value);
  const anchorPositions = { day: 0, night: 1, mid: 2, rest1: 3, rest2: 4 };
  const anchorIndex = anchorPositions[shiftInput.value];
  const distance = daysBetween(anchor, date);
  return ((anchorIndex + distance) % SHIFTS.length + SHIFTS.length) % SHIFTS.length;
}

function baseShiftFor(date) { return SHIFTS[cycleIndexFor(date)]; }

function shiftFor(date) {
  const override = shiftOverrides[toDateKey(date)];
  return override ? SHIFT_BY_ID[override] : baseShiftFor(date);
}

function holidayFor(date) { return HOLIDAY_NOTICES[toDateKey(date)]; }

function readShiftOverrides() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const stored = JSON.parse(localStorage.getItem(OVERRIDE_STORAGE_KEY)) || {};
    return Object.fromEntries(Object.entries(stored).filter(([, shift]) => Object.prototype.hasOwnProperty.call(SHIFT_BY_ID, shift)));
  } catch {
    return {};
  }
}

function saveShiftOverrides() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(shiftOverrides));
  } catch {
    // The adjustment remains active for the current session if storage is unavailable.
  }
}

function setShiftOverride(dateKey, shift) {
  if (!Object.prototype.hasOwnProperty.call(SHIFT_BY_ID, shift)) return;
  shiftOverrides = { ...shiftOverrides, [dateKey]: shift };
  saveShiftOverrides();
}

function clearShiftOverride(dateKey) {
  const { [dateKey]: removed, ...remaining } = shiftOverrides;
  shiftOverrides = remaining;
  saveShiftOverrides();
}

function openShiftEditor(dateKey) {
  const date = parseDate(dateKey);
  const editor = document.querySelector('#shift-editor');
  const isAdjusted = Boolean(shiftOverrides[dateKey]);
  selectedDateKey = dateKey;
  document.querySelector('#editor-date').textContent = date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  document.querySelector('#editor-shift').value = shiftFor(date).id;
  document.querySelector('#reset-day-shift').disabled = !isAdjusted;
  document.querySelector('#editor-note').textContent = isAdjusted
    ? '已调整为自定义班次；会用于统计与 .ics 导出。'
    : '选择新班次后会立即保存，并用于统计与 .ics 导出；不会改变后续循环。';
  editor.hidden = false;
}

function normalizeHex(value) {
  const color = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : null;
}

function readSavedColors() {
  try {
    return typeof localStorage === 'undefined' ? {} : JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveColors(colors) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Local storage may be unavailable in private browsing; the current session still works.
  }
}

function setShiftColor(shift, value, shouldSave = true) {
  const color = normalizeHex(value);
  if (!color || !Object.prototype.hasOwnProperty.call(COLOR_DEFAULTS, shift)) return false;
  document.documentElement.style.setProperty(`--${shift}`, color);
  document.querySelector(`[data-shift-color="${shift}"]`).value = color;
  document.querySelector(`[data-hex-input="${shift}"]`).value = color;
  if (shouldSave) {
    const colors = { ...readSavedColors(), [shift]: color };
    saveColors(colors);
  }
  return true;
}

function initializeColors() {
  const savedColors = readSavedColors();
  Object.entries(COLOR_DEFAULTS).forEach(([shift, defaultColor]) => setShiftColor(shift, savedColors[shift] || defaultColor, false));

  colorInputs.forEach((input) => {
    input.addEventListener('input', () => setShiftColor(input.dataset.shiftColor, input.value));
  });
  hexInputs.forEach((input) => {
    const applyHex = () => {
      if (!setShiftColor(input.dataset.hexInput, input.value)) {
        input.value = document.querySelector(`[data-shift-color="${input.dataset.hexInput}"]`).value.toUpperCase();
      }
    };
    input.addEventListener('change', applyHex);
    input.addEventListener('blur', applyHex);
  });
  document.querySelector('#reset-colors').addEventListener('click', () => {
    Object.entries(COLOR_DEFAULTS).forEach(([shift, color]) => setShiftColor(shift, color, false));
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(COLOR_STORAGE_KEY);
    } catch {
      // Keep the default colours for this session if storage is unavailable.
    }
  });
}

function renderCycle() {
  document.querySelector('#cycle-steps').innerHTML = SHIFTS.map((shift, index) =>
    `<li class="shift-${shift.id}"><small>第 ${index + 1} 天</small>${shift.name}</li>`
  ).join('');
}

function renderCalendar() {
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = addDays(first, -firstWeekday);
  const todayKey = toDateKey(new Date());
  monthLabel.textContent = `${year} 年 ${month + 1} 月`;
  grid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    const shift = shiftFor(date);
    const holiday = holidayFor(date);
    const outside = date.getMonth() !== month;
    const dateKey = toDateKey(date);
    const classes = `calendar-cell${outside ? ' outside' : ''}${dateKey === todayKey ? ' today' : ''}${dateKey === selectedDateKey ? ' selected' : ''}`;
    const timeline = shift.duration
      ? `<div class="day-timeline" aria-label="${shift.name} ${shift.time}"><span class="timeline-block shift-${shift.id}" style="--start: ${shift.startHour}; --duration: ${shift.duration}"></span></div>`
      : `<div class="day-timeline is-rest" aria-label="休息日"></div>`;
    const holidayTag = holiday ? `<span class="holiday-tag${holiday.workday ? ' workday' : ''}" title="${holiday.workday ? '调休补班提醒' : '法定节假日提醒'}">${holiday.label}</span>` : '';
    return `<div class="${classes}" data-date="${dateKey}"><div class="date-row"><span class="date-number">${date.getDate()}</span>${holidayTag}</div><span class="shift-label text-${shift.id}">${shift.name}</span>${shift.time ? `<span class="shift-time">${shift.time}</span>` : ''}${timeline}</div>`;
  }).join('');
  updateExportSummary();
}

function updateExportSummary() {
  const anchor = parseDate(dateInput.value);
  const end = yearsLater(anchor, Number(yearsInput.value));
  exportSummary.textContent = `将导出从 ${toDateKey(anchor)} 到 ${toDateKey(end)} 的工作班次（休息日不会写入日历）。`;
  renderShiftStats();
}

function renderShiftStats() {
  const anchor = parseDate(dateInput.value);
  const end = yearsLater(anchor, Number(yearsInput.value));
  const totalDays = daysBetween(anchor, end) + 1;
  const counts = countShifts(anchor, totalDays);
  const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const monthEnd = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
  const monthCounts = countShifts(monthStart, monthEnd.getDate());
  const stats = [
    { id: 'day', label: '白班' },
    { id: 'night', label: '夜班' },
    { id: 'mid', label: '中班' },
    { id: 'rest', label: '休息' },
  ];
  const statItems = (source) => stats.map(({ id, label }) =>
    `<span class="stat-item"><i class="shift-${id}"></i>${label}<strong>${source[id]}</strong> 次</span>`
  ).join('');
  document.querySelector('#stats-period').textContent = `${yearsInput.value} 年总计`;
  document.querySelector('#shift-stats-list').innerHTML = statItems(counts);
  document.querySelector('#month-stats-period').textContent = `${displayMonth.getFullYear()} 年 ${displayMonth.getMonth() + 1} 月`;
  document.querySelector('#month-stats-list').innerHTML = statItems(monthCounts);
}

function countShifts(startDate, totalDays) {
  const counts = { day: 0, night: 0, mid: 0, rest: 0 };
  for (let offset = 0; offset < totalDays; offset += 1) counts[shiftFor(addDays(startDate, offset)).id] += 1;
  return counts;
}

function yearsLater(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function icsDate(date, time) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}T${time}`;
}

function icsEnd(date, shift) {
  if (shift.id === 'mid') return icsDate(addDays(date, 1), '000000');
  return icsDate(date, shift.end);
}

function escapeIcs(text) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line) {
  return line.length <= 74 ? line : `${line.slice(0, 74)}\r\n ${line.slice(74)}`;
}

function exportIcs() {
  const anchor = parseDate(dateInput.value);
  const totalDays = daysBetween(anchor, yearsLater(anchor, Number(yearsInput.value))) + 1;
  const stamp = new Date();
  const stampUtc = `${stamp.getUTCFullYear()}${String(stamp.getUTCMonth() + 1).padStart(2, '0')}${String(stamp.getUTCDate()).padStart(2, '0')}T${String(stamp.getUTCHours()).padStart(2, '0')}${String(stamp.getUTCMinutes()).padStart(2, '0')}${String(stamp.getUTCSeconds()).padStart(2, '0')}Z`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ShiftFlow//倒班日历//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:倒班日历', 'X-WR-TIMEZONE:Asia/Shanghai',
  ];
  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = addDays(anchor, offset);
    const shift = shiftFor(date);
    if (shift.id === 'rest') continue;
    const uid = `${toDateKey(date)}-${shift.id}@shiftflow.local`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stampUtc}`,
      `DTSTART;TZID=Asia/Shanghai:${icsDate(date, shift.start)}`,
      `DTEND;TZID=Asia/Shanghai:${icsEnd(date, shift)}`,
      `SUMMARY:${escapeIcs(shift.name)}`,
      `DESCRIPTION:${escapeIcs(`${shift.name} ${shift.time}｜ShiftFlow 倒班日历`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  const content = lines.map(foldLine).join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `倒班日历_${toDateKey(anchor)}_${yearsInput.value}年.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelector('#generate').addEventListener('click', () => {
  displayMonth = new Date(parseDate(dateInput.value).getFullYear(), parseDate(dateInput.value).getMonth(), 1);
  renderCalendar();
});
dateInput.addEventListener('change', updateAnchorDateDisplay);
document.querySelector('#previous-month').addEventListener('click', () => { displayMonth.setMonth(displayMonth.getMonth() - 1); renderCalendar(); });
document.querySelector('#next-month').addEventListener('click', () => { displayMonth.setMonth(displayMonth.getMonth() + 1); renderCalendar(); });
yearsInput.addEventListener('change', updateExportSummary);
document.querySelector('#export-ics').addEventListener('click', exportIcs);
grid.addEventListener('click', (event) => {
  const cell = event.target.closest('.calendar-cell[data-date]');
  if (!cell) return;
  selectedDateKey = cell.dataset.date;
  renderCalendar();
  openShiftEditor(cell.dataset.date);
});
document.querySelector('#editor-shift').addEventListener('change', (event) => {
  if (!selectedDateKey) return;
  setShiftOverride(selectedDateKey, event.target.value);
  renderCalendar();
  openShiftEditor(selectedDateKey);
});
document.querySelector('#reset-day-shift').addEventListener('click', () => {
  if (!selectedDateKey) return;
  clearShiftOverride(selectedDateKey);
  renderCalendar();
  openShiftEditor(selectedDateKey);
});
document.querySelector('#close-editor').addEventListener('click', () => {
  selectedDateKey = null;
  document.querySelector('#shift-editor').hidden = true;
  renderCalendar();
});

renderCycle();
renderCalendar();
initializeColors();
updateAnchorDateDisplay();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
