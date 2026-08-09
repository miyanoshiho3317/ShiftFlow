const SHIFTS = [
  { id: 'day', name: '白班', time: '08:00–16:00', start: '080000', end: '160000', startHour: 8, duration: 8 },
  { id: 'night', name: '夜班', time: '00:00–08:00', start: '000000', end: '080000', startHour: 0, duration: 8 },
  { id: 'rest', name: '休息' },
  { id: 'mid', name: '中班', time: '16:00–24:00', start: '160000', end: '235959', startHour: 16, duration: 8 },
  { id: 'rest', name: '休息' },
  { id: 'rest', name: '休息' },
];

const dateInput = document.querySelector('#anchor-date');
const shiftInput = document.querySelector('#anchor-shift');
const yearsInput = document.querySelector('#years');
const grid = document.querySelector('#calendar-grid');
const monthLabel = document.querySelector('#month-label');
const exportSummary = document.querySelector('#export-summary');
let displayMonth = new Date(2026, 7, 1);

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  const anchorPositions = { day: 0, night: 1, rest1: 2, mid: 3, rest2: 4, rest3: 5 };
  const anchorIndex = anchorPositions[shiftInput.value];
  const distance = daysBetween(anchor, date);
  return ((anchorIndex + distance) % SHIFTS.length + SHIFTS.length) % SHIFTS.length;
}

function shiftFor(date) { return SHIFTS[cycleIndexFor(date)]; }

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
    const outside = date.getMonth() !== month;
    const classes = `calendar-cell${outside ? ' outside' : ''}${toDateKey(date) === todayKey ? ' today' : ''}`;
    const timeline = shift.duration
      ? `<div class="day-timeline" aria-label="${shift.name} ${shift.time}"><span class="timeline-block shift-${shift.id}" style="--start: ${shift.startHour}; --duration: ${shift.duration}"></span></div>`
      : `<div class="day-timeline is-rest" aria-label="休息日"></div>`;
    return `<div class="${classes}"><span class="date-number">${date.getDate()}</span><span class="shift-label text-${shift.id}">${shift.name}</span>${shift.time ? `<span class="shift-time">${shift.time}</span>` : ''}${timeline}</div>`;
  }).join('');
  updateExportSummary();
}

function updateExportSummary() {
  const anchor = parseDate(dateInput.value);
  const end = yearsLater(anchor, Number(yearsInput.value));
  exportSummary.textContent = `将导出从 ${toDateKey(anchor)} 到 ${toDateKey(end)} 的工作班次（休息日不会写入日历）。`;
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
document.querySelector('#previous-month').addEventListener('click', () => { displayMonth.setMonth(displayMonth.getMonth() - 1); renderCalendar(); });
document.querySelector('#next-month').addEventListener('click', () => { displayMonth.setMonth(displayMonth.getMonth() + 1); renderCalendar(); });
yearsInput.addEventListener('change', updateExportSummary);
document.querySelector('#export-ics').addEventListener('click', exportIcs);

renderCycle();
renderCalendar();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
