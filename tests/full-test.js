// Полная проверка «Сдам вовремя»: каждая кнопка и действие.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs');
const DIR = __dirname;
const URL = 'http://localhost:8765/index.html';
const T0 = new Date('2026-10-22T10:00:00+03:00'); // четверг, 10:00 МСК

const results = [];
let section = '';
function check(name, ok, info = '') {
  results.push({ section, name, ok: !!ok, info: ok ? '' : String(info) });
}
const sec = (s) => { section = s; };
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

(async () => {
  const browser = await chromium.launch();
  const errors = [], external = [];
  async function newPage(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'Europe/Moscow', locale: 'ru-RU', acceptDownloads: true, ...opts });
    const p = await ctx.newPage();
    await p.clock.setFixedTime(T0);
    p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    p.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
    p.on('request', (r) => { if (!r.url().startsWith('http://localhost:8765') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
    return p;
  }
  const page = await newPage();
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('sdam-vovremya-v1') || 'null'));
  const vis = (sel) => page.isVisible(sel);
  const txt = async (sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const sheetOpen = async () => !(await page.isHidden('#sheetOv'));
  const asOpen = async () => !(await page.isHidden('#asOv'));
  const toast = () => txt('#toast');
  const wait = (ms = 150) => page.waitForTimeout(ms);
  const tab = async (k) => {
    if (k === 'settings') { if (await page.isVisible('#scr-settings')) return; await page.click('.screen:not([hidden]) [data-tab="settings"]'); }
    else await page.click(`.tabbar [data-tab="${k}"]`);
    await wait();
  };
  const rowByTitle = (t) => page.locator('.screen:not([hidden]) .trow', { hasText: t }).first();
  const choose = async (id, v) => {
    await page.click(`[data-menu="${id}"]`); await page.waitForTimeout(80);
    if (typeof v === 'object') await page.click(`#menuPop .menu-item:has-text("${v.label}")`);
    else await page.click(`#menuPop .menu-item[data-val="${v}"]`);
    await page.waitForTimeout(80);
  };
  const openTask = async (t) => { await rowByTitle(t).locator('.trow-main').click(); await wait(250); };

  await page.goto(URL); await wait(500);

  // ---------- 1. Старт ----------
  sec('Старт');
  let s = await st();
  check('Загружаются примеры (6 активных заданий на экране)', (await page.locator('.screen:not([hidden]) .trow').count()) === 6);
  check('Видна вкладка «Задания»', await vis('#scr-tasks .large-title'));
  check('Заголовок «Задания»', (await txt('#scr-tasks .large-title')) === 'Задания');
  check('Подзаголовок с датой и неделей', (await txt('#scr-tasks .nav-sub')).includes('Четверг, 22 октября · 8-я неделя, чётная'), await txt('#scr-tasks .nav-sub'));
  check('Hero: «Уже просрочено»', (await txt('.hero .cap')) === 'Уже просрочено', await txt('.hero .cap'));
  check('Hero: отсчёт −1 д 0 ч', (await txt('.countdown')) === '−1 д 0 ч', await txt('.countdown'));
  const stats = await page.$$eval('.stat b', (b) => b.map((x) => x.textContent));
  check('Счётчики 1 / 1 / 2', stats.join('/') === '1/1/2', stats.join('/'));
  check('Баннер примеров виден', await vis('.banner'));
  check('Фильтр: 6 кнопок (Все + 5 предметов)', (await page.locator('.pill').count()) === 6);
  const groups = await page.$$eval('#scr-tasks .sec-h > span', (x) => x.map((e) => e.textContent.trim()));
  check('Группы по срочности', groups.join('|') === 'Просрочено · 1|Сегодня и завтра · 1|Ближайшие 7 дней · 2|Позже · 2|Сдано · 1', groups.join('|'));
  check('Сданные скрыты по умолчанию', (await page.locator('.screen:not([hidden]) .trow').count()) === 6);

  // ---------- 2. Вкладки ----------
  sec('Вкладки');
  check('В нижней панели 5 вкладок', (await page.locator('.tabbar .tab').count()) === 5);
  for (const [k, title] of [['cal', 'Календарь'], ['sched', 'Пары'], ['focus', 'Фокус'], ['grades', 'Оценки'], ['tasks', 'Задания']]) {
    await tab(k);
    check(`Вкладка «${title}» открывается`, (await txt(`#scr-${k} .large-title`)) === title && (await page.getAttribute(`.tabbar [data-tab="${k}"]`, 'aria-current')) === 'page');
    const others = ['tasks', 'cal', 'sched', 'focus', 'grades', 'settings'].filter((x) => x !== k);
    let hiddenOk = true;
    for (const o of others) if (await page.isVisible(`#scr-${o}`)) hiddenOk = false;
    check(`Остальные экраны скрыты (${title})`, hiddenOk);
  }
  await tab('grades'); await tab('settings');
  check('Кнопка-шестерёнка открывает настройки', (await txt('#scr-settings .large-title')) === 'Настройки' && (await page.locator('.tabbar [aria-current="page"]').count()) === 0);
  await page.click('#scr-settings [data-action="back"]'); await wait();
  check('Кнопка «Назад» возвращает на прошлую вкладку', await vis('#scr-grades .large-title'));
  await tab('focus'); await page.reload(); await wait(400);
  check('Вкладка запоминается после перезагрузки', await vis('#scr-focus .large-title'));
  await tab('tasks');

  // ---------- 3. Фильтр ----------
  sec('Фильтр по предметам');
  await page.click('.pill:has-text("Матанализ")'); await wait();
  check('Фильтр «Матанализ»: 1 задание', (await page.locator('.screen:not([hidden]) .trow').count()) === 1, await page.locator('.screen:not([hidden]) .trow').count());
  check('Кнопка фильтра нажата', (await page.getAttribute('.pill:has-text("Матанализ")', 'aria-pressed')) === 'true');
  await page.reload(); await wait(400);
  check('Фильтр запоминается после перезагрузки', (await page.getAttribute('.pill:has-text("Матанализ")', 'aria-pressed')) === 'true');
  await page.click('.pill:has-text("Все")'); await wait();
  check('«Все» возвращает список', (await page.locator('.screen:not([hidden]) .trow').count()) === 6);

  // ---------- 4. Карточка задания ----------
  sec('Карточка задания');
  await page.click('.hero'); await wait(250);
  check('Клик по hero открывает карточку', (await sheetOpen()) && (await txt('.detail-head h3')) === 'Типовой расчёт по интегралам');
  await page.keyboard.press('Escape'); await wait();
  check('Escape закрывает карточку', !(await sheetOpen()));
  await openTask('Essay: My future profession');
  check('Клик по строке открывает карточку', (await txt('.detail-head h3')) === 'Essay: My future profession');
  check('В карточке срочность «Через 4 дня»', (await txt('.detail-head .u')) === 'Через 4 дня', await txt('.detail-head .u'));
  check('План по дням показан у невыполненных шагов', (await page.locator('.step .plan').count()) === 2);
  await page.mouse.click(200, 30); await wait();
  check('Клик по затемнению закрывает карточку', !(await sheetOpen()));
  await openTask('Essay: My future profession');
  await page.click('#sheetLeft'); await wait();
  check('Кнопка «Закрыть»', !(await sheetOpen()));

  // ---------- 5. Отметка сдачи ----------
  sec('Отметка «сдано»');
  await rowByTitle('Лабораторная №3').locator('.ring').click(); await wait();
  s = await st();
  let lab = s.tasks.find((t) => t.title.startsWith('Лабораторная №3'));
  check('Кружок отмечает задание сданным', lab.done === true && typeof lab.doneAt === 'number');
  check('Тост «Сдано!»', (await toast()).startsWith('Сдано!'), await toast());
  check('Сданное ушло из активных', (await page.locator('.screen:not([hidden]) .trow').count()) === 5);
  await page.click('[data-action="showdone"]'); await wait();
  check('«Показать» раскрывает сданные', (await page.locator('.screen:not([hidden]) .trow').count()) === 7);
  await rowByTitle('Лабораторная №3').locator('.ring').click(); await wait();
  s = await st(); lab = s.tasks.find((t) => t.title.startsWith('Лабораторная №3'));
  check('Повторный клик возвращает в работу', lab.done === false && lab.doneAt === null);
  await page.click('[data-action="showdone"]'); await wait();
  check('«Скрыть» прячет сданные', (await page.locator('.screen:not([hidden]) .trow').count()) === 6);

  // ---------- 6. Шаги ----------
  sec('Шаги в карточке');
  await openTask('Essay: My future profession');
  await page.locator('.step input').nth(1).click(); await wait();
  s = await st(); let essay = s.tasks.find((t) => t.title.startsWith('Essay'));
  check('Галочка шага сохраняется', essay.steps[1].done === true);
  check('Заголовок «Шаги · 2 из 3»', (await txt('#sheetBody .sec-h')).includes('2 из 3'), await txt('#sheetBody .sec-h'));
  await page.locator('.step input').nth(1).click(); await wait();
  s = await st(); essay = s.tasks.find((t) => t.title.startsWith('Essay'));
  check('Снятие галочки шага', essay.steps[1].done === false);
  await page.press('#addstep-input', 'Enter'); await wait();
  s = await st(); essay = s.tasks.find((t) => t.title.startsWith('Essay'));
  check('Пустой шаг не добавляется', essay.steps.length === 3);
  await page.fill('#addstep-input', '   Сдать в Moodle   '); await page.press('#addstep-input', 'Enter'); await wait();
  s = await st(); essay = s.tasks.find((t) => t.title.startsWith('Essay'));
  check('Новый шаг добавляется (и обрезаются пробелы)', essay.steps.length === 4 && essay.steps[3].text === 'Сдать в Moodle', JSON.stringify(essay.steps[3]));
  check('Фокус остаётся в поле нового шага', (await page.evaluate(() => document.activeElement.id)) === 'addstep-input');
  await page.locator('.step', { hasText: 'Сдать в Moodle' }).locator('.x-btn').click(); await wait();
  s = await st(); essay = s.tasks.find((t) => t.title.startsWith('Essay'));
  check('Крестик удаляет шаг', essay.steps.length === 3);
  for (let i = 0; i < 3; i++) { const cb = page.locator('.step input').nth(i); if (!(await cb.isChecked())) { await cb.click(); await wait(100); } }
  check('Все шаги готовы → подсказка', (await toast()).startsWith('Все шаги готовы'), await toast());
  await page.click('#sheetBody [data-action="toggle"]'); await wait();
  s = await st(); essay = s.tasks.find((t) => t.title.startsWith('Essay'));
  check('«Отметить сданным» в карточке', essay.done === true);
  check('Кнопка меняется на «Вернуть в работу»', (await txt('#sheetBody [data-action="toggle"]')) === 'Вернуть в работу');
  check('План шагов скрыт у сданного', (await page.locator('.step .plan').count()) === 0);
  await page.click('#sheetBody [data-action="toggle"]'); await wait();
  s = await st(); essay = s.tasks.find((t) => t.title.startsWith('Essay'));
  check('«Вернуть в работу» в карточке', essay.done === false);
  await page.keyboard.press('Escape'); await wait();

  // ---------- 7. Форма нового задания ----------
  sec('Новое задание');
  await page.click('.nav-btn-circle[data-action="newtask"]'); await wait(250);
  check('«+» открывает форму', (await sheetOpen()) && (await txt('#sheetTitle')) === 'Новое задание');
  check('Фокус в поле названия', (await page.evaluate(() => document.activeElement.id)) === 'f-title');
  check('Срок по умолчанию +7 дней', (await page.inputValue('#f-date')) === '2026-10-29', await page.inputValue('#f-date'));
  await page.click('#sheetRight'); await wait();
  check('Пустое название → ошибка', (await sheetOpen()) && (await vis('#err-title')));
  await page.fill('#f-title', 'Проверка формы');
  await page.fill('#f-date', ''); await page.click('#sheetRight'); await wait();
  check('Пустая дата → ошибка', (await sheetOpen()) && (await vis('#err-date')) && !(await vis('#err-title')));
  await page.fill('#f-date', '2026-10-30');
  await page.click('[data-menu="f-kind"]'); await wait(100);
  check('Меню «Тип работы» открывается стеклянным списком', (await vis('#menuPop')) && (await page.locator('#menuPop .menu-item').count()) === 10);
  check('В меню отмечен текущий пункт', (await page.getAttribute('#menuPop .menu-item[data-val="hw"]', 'aria-selected')) === 'true');
  const menuColors = await page.evaluate(() => { const it = document.querySelector('#menuPop .menu-item'); return [getComputedStyle(it).color, getComputedStyle(document.getElementById('menuPop')).backgroundColor]; });
  check('Пункты меню читаемы (цвет текста ≠ фону)', menuColors[0] !== menuColors[1], menuColors.join(' / '));
  check('Фокус на выбранном пункте', (await page.evaluate(() => document.activeElement.dataset.val)) === 'hw');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await wait(100);
  check('Клавиатура: стрелка + Enter выбирают пункт', (await page.inputValue('#f-kind')) === 'lab' && (await txt('[data-menu="f-kind"] .menu-val')) === 'Лабораторная');
  check('Меню закрывается после выбора, шторка остаётся', (await page.isHidden('#menuPop')) && (await sheetOpen()));
  await page.click('[data-menu="f-kind"]'); await wait(80); await page.keyboard.press('Escape'); await wait(80);
  check('Escape закрывает только меню', (await page.isHidden('#menuPop')) && (await sheetOpen()));
  await page.click('[data-menu="f-kind"]'); await wait(80); await page.mouse.click(30, 300); await wait(80);
  check('Клик мимо закрывает меню и не закрывает шторку', (await page.isHidden('#menuPop')) && (await sheetOpen()));
  await choose('f-subject', '__new'); await wait(100);
  check('«Новый предмет…» показывает поле', await vis('#f-newsubj'));
  await page.click('#sheetRight'); await wait();
  check('Пустое имя нового предмета → подсказка', (await sheetOpen()) && (await toast()).includes('название нового предмета'), await toast());
  await page.fill('#f-newsubj', 'Линейная алгебра');
  await choose('f-kind', 'exam');
  await page.click('[data-action="suggestform"]'); await wait(100);
  const sugg1 = (await page.inputValue('#f-steps')).split('\n').length;
  await page.click('[data-action="suggestform"]'); await wait(100);
  const sugg2 = (await page.inputValue('#f-steps')).split('\n').length;
  check('«Подсказать» добавляет 6 шагов экзамена без повторов', sugg1 === 6 && sugg2 === 6, `${sugg1}/${sugg2}`);
  await page.fill('#f-time', '09:30');
  await page.press('#f-title', 'Enter'); await wait(250);
  s = await st();
  let nt = s.tasks.find((t) => t.title === 'Проверка формы');
  const la = s.subjects.find((x) => x.name === 'Линейная алгебра');
  check('Enter сохраняет задание', !!nt && !(await sheetOpen()));
  check('Создан новый предмет с незанятым цветом', !!la && la.color === 'red', JSON.stringify(la));
  check('Сохранены тип, время, шаги, предмет', nt && nt.kind === 'exam' && nt.time === '09:30' && nt.steps.length === 6 && nt.subjectId === la.id, JSON.stringify(nt));
  check('Тост «Добавлено. До сдачи 8 дней.»', (await toast()) === 'Добавлено. До сдачи 8 дней.', await toast());
  await page.click('.nav-btn-circle[data-action="newtask"]'); await wait(200);
  await page.fill('#f-title', 'Не сохранять');
  await page.click('#sheetLeft'); await wait();
  s = await st();
  check('«Отмена» не сохраняет', !s.tasks.some((t) => t.title === 'Не сохранять') && !(await sheetOpen()));
  await page.click('.nav-btn-circle[data-action="newtask"]'); await wait(200);
  await page.fill('#f-title', 'Лаба без шагов'); await choose('f-kind', 'lab'); await page.click('#sheetRight'); await wait(250);
  await openTask('Лаба без шагов');
  check('Нет шагов → кнопка «Подсказать типовые шаги»', await vis('#sheetBody [data-action="suggest"]'));
  await page.click('#sheetBody [data-action="suggest"]'); await wait();
  s = await st();
  check('Подсказка добавляет 4 шага лабы', s.tasks.find((t) => t.title === 'Лаба без шагов').steps.length === 4);
  await page.keyboard.press('Escape'); await wait();

  // ---------- 8. Редактирование ----------
  sec('Редактирование');
  await openTask('Лабораторная №3');
  await page.click('#sheetRight'); await wait(200);
  check('«Изменить» открывает форму с данными', (await txt('#sheetTitle')) === 'Изменить' && (await page.inputValue('#f-title')) === 'Лабораторная №3: связные списки');
  check('Форма подставляет предмет и тип', (await page.inputValue('#f-kind')) === 'lab' && (await txt('[data-menu="f-subject"] .menu-val')) === 'Программирование');
  await page.fill('#f-title', 'ИЗМЕНЕНО-ОТМЕНА');
  await page.click('#sheetLeft'); await wait(200);
  check('«Отмена» в правке возвращает к карточке без изменений', (await sheetOpen()) && (await txt('.detail-head h3')) === 'Лабораторная №3: связные списки');
  await page.click('#sheetRight'); await wait(200);
  await page.fill('#f-title', 'Лабораторная №3: списки и стеки');
  const lines = (await page.inputValue('#f-steps')).split('\n').filter((l) => l !== 'Покрыть тестами');
  await page.fill('#f-steps', lines.join('\n'));
  await page.fill('#f-time', '18:00');
  await page.click('#sheetRight'); await wait(250);
  s = await st(); lab = s.tasks.find((t) => t.title === 'Лабораторная №3: списки и стеки');
  check('«Готово» сохраняет правку и возвращает в карточку', !!lab && (await txt('.detail-head h3')) === 'Лабораторная №3: списки и стеки');
  check('Удалённый шаг ушёл, отметки остальных сохранились', lab.steps.length === 3 && lab.steps[0].done && lab.steps[1].done && !lab.steps[2].done, JSON.stringify(lab.steps));
  check('Время обновилось', lab.time === '18:00');
  await page.keyboard.press('Escape'); await wait();

  // ---------- 9. Удаление задания ----------
  sec('Удаление задания');
  await openTask('Лаба без шагов');
  await page.click('[data-action="deltask"]'); await wait();
  check('«Удалить задание» спрашивает подтверждение', (await asOpen()) && (await txt('#asTitle')).includes('Лаба без шагов'));
  await page.click('#asCancel'); await wait();
  s = await st();
  check('«Отмена» не удаляет', s.tasks.some((t) => t.title === 'Лаба без шагов') && (await sheetOpen()));
  await page.click('[data-action="deltask"]'); await wait();
  await page.keyboard.press('Escape'); await wait();
  check('Escape закрывает только подтверждение', !(await asOpen()) && (await sheetOpen()));
  await page.click('[data-action="deltask"]'); await wait();
  await page.click('#asOk'); await wait();
  s = await st();
  check('Подтверждение удаляет задание и закрывает карточку', !s.tasks.some((t) => t.title === 'Лаба без шагов') && !(await sheetOpen()));
  check('Тост «Задание удалено.»', (await toast()) === 'Задание удалено.');

  // ---------- 10. Календарь ----------
  sec('Календарь');
  await tab('cal');
  check('Месяц «Октябрь 2026»', (await txt('.cal-top h3')) === 'Октябрь 2026', await txt('.cal-top h3'));
  check('Сегодня (22) отмечено', (await page.getAttribute('.cal-day.today', 'data-day')) === '2026-10-22');
  check('Выбран сегодняшний день', (await page.getAttribute('.cal-day[aria-pressed="true"]', 'data-day')) === '2026-10-22');
  check('Точка сдачи 23 октября', (await page.locator('[data-day="2026-10-23"] .dots i').count()) === 1);
  await page.click('[data-action="calnext"]'); await wait();
  check('Стрелка вперёд → Ноябрь 2026', (await txt('.cal-top h3')) === 'Ноябрь 2026');
  check('Фокус остаётся на стрелке', (await page.evaluate(() => document.activeElement.dataset.action)) === 'calnext');
  await page.click('[data-action="calprev"]'); await page.click('[data-action="calprev"]'); await wait();
  check('Стрелка назад → Сентябрь 2026', (await txt('.cal-top h3')) === 'Сентябрь 2026');
  await page.click('[data-action="caltoday"]'); await wait();
  check('«Сегодня» возвращает к октябрю', (await txt('.cal-top h3')) === 'Октябрь 2026');
  await page.click('[data-day="2026-10-28"]'); await wait();
  check('Клик по дню показывает его задания', (await txt('#scr-cal .sec-h')).includes('Среда, 28 октября') && (await page.locator('#scr-cal .trow').count()) === 1);
  await page.click('[data-day="2026-11-01"]'); await wait();
  check('День соседнего месяца переключает месяц', (await txt('.cal-top h3')) === 'Ноябрь 2026');
  check('Пустой день: «В этот день сдач нет»', (await txt('#scr-cal .list')).includes('В этот день сдач нет'));
  await page.click('[data-action="caltoday"]'); await wait();
  await page.click('[data-day="2026-10-30"]'); await wait();
  for (const name of ['Сдача A', 'Сдача B']) {
    await page.click('[data-action="addday"]'); await wait(200);
    if (name === 'Сдача A') check('«Добавить задание на этот день» подставляет дату', (await page.inputValue('#f-date')) === '2026-10-30');
    await page.fill('#f-title', name); await page.click('#sheetRight'); await wait(200);
  }
  check('День 30 октября подсвечен как загруженный (3+ сдачи)', await page.$eval('[data-day="2026-10-30"]', (e) => e.classList.contains('heavy')));
  check('Новое задание видно в списке дня', (await page.locator('#scr-cal .trow').count()) === 3);
  await page.locator('#scr-cal .trow').first().locator('.trow-main').click(); await wait(250);
  check('Карточка открывается из календаря', await sheetOpen());
  await page.keyboard.press('Escape'); await wait();
  await page.click('[data-day="2026-10-15"]'); await wait();
  await tab('tasks'); await page.click('.pill:has-text("Физика")'); await tab('cal');
  check('Фильтр предмета действует в календаре', (await page.locator('.cal-grid .dots i').count()) === 1, await page.locator('.cal-grid .dots i').count());
  await tab('tasks'); await page.click('.pill:has-text("Все")'); await wait();

  // ---------- 11. Пары ----------
  sec('Пары');
  await tab('sched');
  check('Пустое расписание: подсказка и кнопка', (await txt('#scr-sched .empty h3')) === 'Расписания пока нет');
  await page.click('.empty [data-action="addclass"]'); await wait(200);
  check('Форма пары открывается', (await txt('#sheetTitle')) === 'Новая пара');
  check('По умолчанию: четверг, 09:00–10:30, лекция, каждую неделю', (await page.inputValue('#c-day')) === '3' && (await page.inputValue('#c-start')) === '09:00' && (await page.inputValue('#c-end')) === '10:30' && (await page.inputValue('#c-type')) === 'lec' && (await page.inputValue('#c-weeks')) === 'all');
  await page.fill('#c-start', '12:00'); await wait(50);
  check('Конец ставится сам: +1,5 часа', (await page.inputValue('#c-end')) === '13:30', await page.inputValue('#c-end'));
  await page.fill('#c-end', '12:00'); await wait(50);
  await page.click('#sheetRight'); await wait();
  check('Конец раньше начала → ошибка', (await sheetOpen()) && (await vis('#err-ctime')));
  await page.fill('#c-start', '11:00'); await wait(50);
  check('После ручной правки конец не меняется сам', (await page.inputValue('#c-end')) === '12:00');
  await page.fill('#c-end', '13:30'); await page.fill('#c-room', 'ауд. 305');
  await page.click('#sheetRight'); await wait(200);
  s = await st();
  check('Пара сохраняется', s.classes.length === 1 && s.classes[0].start === '11:00' && s.classes[0].room === 'ауд. 305', JSON.stringify(s.classes));
  check('Заголовок «Чётная неделя»', (await txt('#scr-sched .nav-sub')) === 'Чётная неделя');
  check('«Следующая пара … через 1 ч»', (await txt('.now-card')).includes('Следующая пара') && (await txt('.now-card')).includes('через 1 ч'), await txt('.now-card'));
  await page.click('.nav-btn-circle[data-action="addclass"]'); await wait(200);
  await page.fill('#c-start', '09:30'); await page.fill('#c-end', '11:00'); await choose('c-type', 'sem');
  await page.click('#sheetRight'); await wait(200);
  check('Идущая пара: «Сейчас идёт … ещё 1 ч»', (await txt('.now-card')).includes('Сейчас идёт') && (await txt('.now-card')).includes('ещё 1 ч'), await txt('.now-card'));
  check('Значок «идёт» у текущей пары', (await page.locator('.badge.now').count()) === 1);
  check('Пары дня отсортированы по времени', (await page.$$eval('#scr-sched .lesson .time', (x) => x.map((e) => e.firstChild.textContent))).join(',') === '09:30,11:00');
  await page.click('.nav-btn-circle[data-action="addclass"]'); await wait(200);
  await choose('c-day', '4'); await choose('c-weeks', 'odd'); await page.fill('#c-start', '13:00'); await page.fill('#c-end', '14:30');
  await page.click('#sheetRight'); await wait(200);
  check('Пара «по нечётным» не видна на чётной неделе', (await page.locator('#scr-sched .lesson').count()) === 2);
  await page.click('[data-week="next"]'); await wait();
  check('«Следующая» неделя: нечётная, пара видна', (await txt('#scr-sched .nav-sub')) === 'Нечётная неделя' && (await page.locator('.badge', { hasText: 'по нечётным' }).count()) === 1);
  check('На следующей неделе нет карточки «сейчас»', (await page.locator('.now-card').count()) === 0);
  await page.click('[data-week="this"]'); await wait();
  await page.click('.nav-btn-circle[data-action="addclass"]'); await wait(200);
  await choose('c-subject', { label: 'Программирование' }); await choose('c-day', '4'); await page.fill('#c-start', '15:00'); await page.fill('#c-end', '16:30');
  await page.click('#sheetRight'); await wait(200);
  check('У пары видно задание по предмету в этот день', (await page.locator('.lesson .due', { hasText: 'Лабораторная №3' }).count()) === 1);
  await page.click('.nav-btn-circle[data-action="addclass"]'); await wait(200);
  await choose('c-day', '6'); await page.fill('#c-start', '10:00'); await page.fill('#c-end', '11:00');
  await page.click('#sheetRight'); await wait(200);
  check('Воскресенье появляется, когда есть пара', (await page.locator('#scr-sched .sec-h', { hasText: 'Воскресенье' }).count()) === 1);
  check('Суббота без пар скрыта', (await page.locator('#scr-sched .sec-h', { hasText: 'Суббота' }).count()) === 0);
  await page.click('.nav-btn-circle[data-action="addclass"]'); await wait(200);
  await choose('c-subject', '__new'); await wait(50);
  await page.click('#sheetRight'); await wait();
  check('Новый предмет в паре: пустое имя → подсказка', (await sheetOpen()) && (await toast()).includes('название предмета'));
  await page.fill('#c-newsubj', 'Философия'); await choose('c-day', '0');
  await page.click('#sheetRight'); await wait(200);
  s = await st();
  check('Новый предмет создаётся из формы пары', s.subjects.some((x) => x.name === 'Философия') && s.classes.some((c) => c.day === 0));
  await page.locator('.lesson', { hasText: 'Философия' }).click(); await wait(200);
  check('Клик по паре открывает правку', (await txt('#sheetTitle')) === 'Пара' && (await page.inputValue('#c-start')) === '09:00');
  await page.fill('#c-room', 'Б-101'); await page.click('#sheetRight'); await wait(200);
  check('Правка пары сохраняется', (await txt('#scr-sched')).includes('Б-101'));
  await page.locator('.lesson', { hasText: 'Философия' }).click(); await wait(200);
  await page.click('[data-action="delclass"]'); await wait();
  check('Удаление пары спрашивает подтверждение', await asOpen());
  await page.click('#asCancel'); await wait();
  check('«Отмена» не удаляет пару', (await st()).classes.some((c) => c.day === 0));
  await page.click('[data-action="delclass"]'); await page.click('#asOk'); await wait(200);
  check('Пара удаляется', !(await st()).classes.some((c) => c.day === 0) && !(await sheetOpen()));
  await page.clock.setFixedTime(new Date('2026-10-22T21:00:00+03:00'));
  await tab('tasks'); await tab('sched');
  check('Вечером: «Пары закончились»', (await txt('.now-card')).includes('Пары закончились'), await txt('.now-card'));
  await page.clock.setFixedTime(T0);

  // ---------- 12. Настройки ----------
  sec('Настройки');
  await tab('settings');
  check('Строка статуса сохранения', (await txt('#saveStatus')) === 'Сохраняется только в этом браузере', await txt('#saveStatus'));
  check('Версия 4.0', (await txt('.ver')).includes('4.0'));
  await page.click('[data-action="addsubj"]'); await wait(200);
  check('«Добавить предмет» открывает форму', (await txt('#sheetTitle')) === 'Новый предмет' && (await page.evaluate(() => document.activeElement.id)) === 's-name');
  await page.click('#sheetRight'); await wait();
  check('Пустое имя не сохраняется', await sheetOpen());
  await page.fill('#s-name', 'матанализ'); await page.click('#sheetRight'); await wait();
  check('Дубликат (без учёта регистра) → подсказка', (await sheetOpen()) && (await toast()) === 'Такой предмет уже есть.');
  await page.fill('#s-name', 'Химия'); await page.click('.swatch[data-color="teal"]'); await wait(50);
  check('Выбор цвета отмечается', (await page.getAttribute('.swatch[data-color="teal"]', 'aria-checked')) === 'true');
  await page.press('#s-name', 'Enter'); await wait(200);
  s = await st();
  check('Предмет создан с выбранным цветом', s.subjects.some((x) => x.name === 'Химия' && x.color === 'teal'));
  const nSub = s.subjects.length;
  await page.click('[aria-label="Удалить предмет Химия"]'); await wait();
  check('Удаление предмета спрашивает подтверждение', await asOpen());
  await page.click('#asCancel'); await wait();
  check('«Отмена» оставляет предмет', (await st()).subjects.length === nSub);
  const progId = s.subjects.find((x) => x.name === 'Программирование').id;
  await page.click('[aria-label="Удалить предмет Программирование"]'); await wait();
  check('Подтверждение предупреждает о заданиях', (await txt('#asMsg')).includes('останутся'));
  await page.click('#asOk'); await wait(200);
  s = await st();
  check('Предмет удалён, задания и пары остались без предмета', !s.subjects.some((x) => x.id === progId) && s.tasks.some((t) => t.title.startsWith('Лабораторная №3') && t.subjectId === null) && s.classes.some((c) => c.start === '15:00' && c.subjectId === null));
  check('Оценки удалённого предмета удалены, время занятий осталось', !s.grades.some((g) => g.subjectId === progId) && s.sessions.some((x) => x.subjectId === null));
  await page.click('#weekFlip'); await wait();
  check('Переключатель чётности', (await st()).weekFlip === true && (await txt('#scr-settings')).includes('Сейчас нечётная неделя'));
  await tab('tasks');
  check('Чётность меняется и в заголовке', (await txt('.nav-sub')).includes('нечётная'));
  await tab('settings'); await page.click('#weekFlip'); await wait();
  await page.click('[data-action="policy"]'); await wait(200);
  check('Политика открывается', (await txt('#sheetTitle')) === 'Конфиденциальность' && (await txt('.policy')).includes('Действует с 22 октября 2026'));
  check('Политика: локальное хранение', (await txt('.policy')).includes('localStorage'));
  await page.click('#sheetLeft'); await wait();
  check('Политика закрывается', !(await sheetOpen()));
  await page.click('.screen:not([hidden]) [data-action="clearex"]'); await wait(200);
  s = await st();
  check('«Убрать примеры» удаляет только примеры', !s.examples && !s.tasks.some((t) => t.ex) && s.tasks.some((t) => t.title === 'Проверка формы'));
  check('Предметы примеров, которые используются, остались', s.subjects.some((x) => x.name === 'Линейная алгебра'));
  check('Кнопка «Убрать примеры» пропала', (await page.locator('.screen:not([hidden]) [data-action="clearex"]').count()) === 0);


  // ---------- Оформление ----------
  sec('Оформление');
  // Начинаем новые разделы с чистыми примерами
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('sdam-vovremya-v1')) localStorage.removeItem(k); });
  await page.reload(); await wait(500);
  await tab('settings');
  const rootTheme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('По умолчанию «Авто»', (await page.getAttribute('[data-theme-opt="system"]', 'aria-checked')) === 'true' && (await rootTheme()) === null);
  await page.click('[data-theme-opt="dark"]'); await wait();
  check('«Тёмная» включает тёмную тему', (await rootTheme()) === 'dark' && (await bodyBg()) === 'rgb(0, 0, 0)', await bodyBg());
  check('Плитка «Тёмная» отмечена', (await page.getAttribute('[data-theme-opt="dark"]', 'aria-checked')) === 'true');
  await page.click('[data-theme-opt="light"]'); await wait();
  check('«Светлая» включает светлую тему', (await rootTheme()) === 'light' && (await bodyBg()) === 'rgb(242, 242, 247)', await bodyBg());
  await page.click('[data-accent-opt="pink"]'); await wait();
  const tintOf = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-action="back"]')).color);
  check('Акцент «Розовый» меняет цвет кнопок', (await page.evaluate(() => document.documentElement.getAttribute('data-accent'))) === 'pink' && (await tintOf()) === 'rgb(255, 45, 85)', await tintOf());
  await page.click('[data-theme-opt="dark"]'); await wait();
  check('Акцент подстраивается под тёмную тему', (await tintOf()) === 'rgb(255, 55, 95)', await tintOf());
  await page.reload(); await wait(400);
  check('Тема и акцент запоминаются', (await rootTheme()) === 'dark' && (await page.evaluate(() => document.documentElement.getAttribute('data-accent'))) === 'pink');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await wait(100);
  check('Выбранная тема не сбивается внешней сменой', (await rootTheme()) === 'dark');
  await tab('settings');
  await page.click('[data-theme-opt="system"]'); await page.click('[data-accent-opt="blue"]'); await wait();
  check('«Авто» возвращает тему устройства', (await rootTheme()) === 'light' || (await rootTheme()) === null);
  check('Синий акцент снимает атрибут', (await page.evaluate(() => document.documentElement.getAttribute('data-accent'))) === null);
  await page.click('[data-action="back"]'); await wait();

  // ---------- Фокус ----------
  sec('Фокус');
  const at = (min) => page.clock.setFixedTime(new Date(T0.getTime() + min * 60000));
  const tstate = () => page.evaluate(() => JSON.parse(localStorage.getItem('sdam-vovremya-v1:timer') || 'null'));
  await tab('focus');
  check('Подзаголовок: время сегодня (25 мин из примеров)', (await txt('#scr-focus .nav-sub')) === 'Сегодня 25 мин', await txt('#scr-focus .nav-sub'));
  check('Таймер показывает 25:00', (await txt('#timerTime')) === '25:00');
  check('«Сбросить» недоступна, пока таймер не запущен', await page.isDisabled('[data-action="treset"]'));
  check('График недели: 7 столбцов, сегодня выделен', (await page.locator('.bar').count()) === 7 && (await page.locator('.bar.today').count()) === 1);
  check('Время по предметам показано', (await page.locator('#scr-focus .share-row').count()) >= 3);
  await choose('t-subject', { label: 'Физика' });
  check('Выбор предмета для таймера', (await txt('[data-menu="t-subject"] .menu-val')) === 'Физика');
  await page.click('[data-action="tstart"]'); await wait(300);
  check('«Начать» запускает таймер', (await tstate()).status === 'running' && (await txt('.big-btn')) === 'Пауза');
  check('Подпись «закончится в 10:25»', (await txt('.ring-sub')) === 'закончится в 10:25', await txt('.ring-sub'));
  check('Режимы заблокированы во время работы', await page.isDisabled('[data-phase="short"]'));
  await at(10); await wait(500);
  check('Отсчёт идёт: через 10 минут осталось 15:00', (await txt('#timerTime')) === '15:00', await txt('#timerTime'));
  await page.click('[data-action="tpause"]'); await wait(200);
  await at(20); await wait(500);
  check('Пауза останавливает отсчёт', (await txt('#timerTime')) === '15:00' && (await txt('.big-btn')) === 'Продолжить');
  await page.reload(); await wait(500);
  check('Пауза сохраняется после перезагрузки', (await txt('#timerTime')) === '15:00' && (await tstate()).status === 'paused');
  await page.click('[data-action="tstart"]'); await wait(200);
  await at(40); await wait(700);
  s = await st();
  const lastSes = s.sessions[s.sessions.length - 1];
  check('По окончании фокус записывается в статистику', lastSes && lastSes.minutes === 25 && s.subjects.find((x) => x.id === lastSes.subjectId)?.name === 'Физика', JSON.stringify(lastSes));
  check('Тост «Фокус завершён»', (await toast()).startsWith('Фокус завершён: 25 мин · Физика'), await toast());
  check('Дальше автоматически перерыв 05:00', (await txt('#timerTime')) === '05:00' && (await page.getAttribute('[data-phase="short"]', 'aria-selected')) === 'true');
  check('Время за сегодня выросло до 50 мин', (await txt('#scr-focus .nav-sub')) === 'Сегодня 50 мин', await txt('#scr-focus .nav-sub'));
  await page.click('[data-phase="focus"]'); await wait();
  check('Переключение режима вручную', (await txt('#timerTime')) === '25:00');
  await page.click('[data-action="tstart"]'); await wait(200);
  await page.click('[data-action="tskip"]'); await wait();
  check('«Пропустить» во время фокуса спрашивает подтверждение', await asOpen());
  await page.click('#asCancel'); await wait();
  check('«Отмена» не останавливает таймер', (await tstate()).status === 'running');
  const nSes = (await st()).sessions.length;
  await page.click('[data-action="tskip"]'); await page.click('#asOk'); await wait(200);
  check('Пропуск не записывает время', (await st()).sessions.length === nSes && (await tstate()).phase === 'short');
  await page.click('[data-phase="focus"]'); await wait();
  await page.click('[data-action="tstart"]'); await wait(150);
  await page.click('[data-action="treset"]'); await wait(150);
  check('«Сбросить» возвращает полное время', (await txt('#timerTime')) === '25:00' && (await tstate()).status === 'idle');
  let clock = 40;
  for (let i = 0; i < 3; i++) {
    if ((await tstate()).phase !== 'focus') { await page.click('[data-phase="focus"]'); await wait(100); }
    await page.click('[data-action="tstart"]'); await wait(150);
    clock += 30; await at(clock); await wait(700);
  }
  check('После 4 циклов — длинный перерыв', (await tstate()).phase === 'long' && (await txt('#timerTime')) === '15:00', JSON.stringify(await tstate()));
  await tab('settings');
  await choose('s-focus', '50'); await choose('s-long', '20');
  await page.click('#s-sound'); await wait();
  check('Звук выключается', (await page.evaluate(() => JSON.parse(localStorage.getItem('sdam-vovremya-v1:tconf')).sound)) === false);
  await tab('focus');
  check('Новая длительность длинного перерыва применяется', (await txt('#timerTime')) === '20:00', await txt('#timerTime'));
  await page.click('[data-phase="focus"]'); await wait();
  check('Новая длительность фокуса применяется', (await txt('#timerTime')) === '50:00', await txt('#timerTime'));
  await at(0);

  // ---------- Оценки ----------
  sec('Оценки');
  await tab('grades');
  check('Средний балл примеров 4,37', (await txt('.avg-big')) === '4,37', await txt('.avg-big'));
  check('Подзаголовок «19 оценок»', (await txt('#scr-grades .nav-sub')) === '19 оценок');
  check('Значок «Троек: 2»', (await txt('.avg-card .badges')).includes('Троек: 2'));
  check('Средний по Матанализу 4,20', (await txt('.grade-row:has-text("Матанализ") .grade-avg')) === '4,20');
  await page.click('.grade-row:has-text("Матанализ")'); await wait(250);
  check('Карточка предмета открывается', (await sheetOpen()) && (await txt('.detail-head h3')) === 'Матанализ');
  check('Цель 4,5: нужно ещё 3 пятёрки', (await txt('#target-result')) === 'Нужно ещё 3 пятёрки подряд.', await txt('#target-result'));
  await page.click('.grade-btn.v5'); await wait();
  s = await st();
  check('Кнопка «5» ставит оценку', s.grades.filter((g) => g.subjectId === s.subjects.find((x) => x.name === 'Матанализ').id).length === 6);
  check('Расчёт обновился: ещё 2 пятёрки', (await txt('#target-result')) === 'Нужно ещё 2 пятёрки подряд.', await txt('#target-result'));
  await choose('g-target', '4');
  check('Цель 4,0 уже достигнута', (await txt('#target-result')) === 'Цель уже достигнута.');
  await choose('g-target', '5');
  check('Цель 5,0 недостижима при четвёрках', (await txt('#target-result')).startsWith('Средний 5,0 уже недостижим'));
  await choose('g-kind', 'exam');
  await page.fill('#g-date', '2026-10-01'); await page.dispatchEvent('#g-date', 'change');
  await page.click('.grade-btn.v4'); await wait();
  s = await st();
  const ex = s.grades[s.grades.length - 1];
  check('Экзамен с выбранной датой сохраняется', ex.kind === 'exam' && ex.date === '2026-10-01' && ex.value === 4, JSON.stringify(ex));
  check('Экзамен обведён рамкой', (await page.locator('#sheetBody .gchip.exam').count()) >= 1);
  const nG = s.grades.length;
  await page.locator('#sheetBody .gchip').first().click(); await wait();
  check('Нажатие на оценку спрашивает об удалении', (await asOpen()) && (await txt('#asTitle')).startsWith('Удалить оценку'));
  await page.click('#asCancel'); await wait();
  check('«Отмена» оставляет оценку', (await st()).grades.length === nG);
  await page.locator('#sheetBody .gchip').first().click(); await page.click('#asOk'); await wait();
  check('Оценка удаляется', (await st()).grades.length === nG - 1);
  await page.keyboard.press('Escape'); await wait();
  await page.click('#scr-grades [data-action="newgrade"]'); await wait(250);
  check('«+» открывает «Новая оценка»', (await txt('#sheetTitle')) === 'Новая оценка');
  await choose('ng-subject', { label: 'История' });
  await choose('g-kind', 'cur');
  await page.click('.grade-btn.v3'); await wait(250);
  s = await st();
  const histId = s.subjects.find((x) => x.name === 'История').id;
  check('Оценка добавлена в выбранный предмет, шторка закрылась', s.grades.filter((g) => g.subjectId === histId).length === 4 && !(await sheetOpen()));
  check('Тост об оценке', (await toast()).startsWith('Оценка 3 по предмету «История»'), await toast());
  check('Главный средний обновился', (await txt('.avg-big')) !== '4,37');

  // ---------- 13. Резервная копия ----------
  sec('Резервная копия');
  await tab('settings');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 4000 }).catch(() => null), page.click('[data-action="export"]')]);
  check('«Скачать резервную копию» скачивает файл', !!dl && dl.suggestedFilename() === 'on-time-backup-2026-10-22.json', dl && dl.suggestedFilename());
  const backupPath = DIR + '/backup.json';
  if (dl) await dl.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  s = await st();
  check('В копии все данные', backup.app === 'sdam-vovremya' && JSON.stringify(backup.data) === JSON.stringify(s));
  if (!fs.existsSync(DIR + '/big.json')) fs.writeFileSync(DIR + '/big.json', JSON.stringify({ pad: 'x'.repeat(2.2 * 1024 * 1024) }));
  for (const [file, expect, name] of [['broken.json', 'не читается', 'Битый файл'], ['big.json', 'слишком большой', 'Файл больше 2 МБ'], ['empty.json', 'не нашлось', 'Пустая копия']]) {
    await page.setInputFiles('#importFile', DIR + '/' + file); await wait(250);
    check(`${name} → понятная ошибка`, (await toast()).includes(expect) && !(await asOpen()), await toast());
  }
  await page.click('[data-action="wipe"]'); await wait();
  check('«Удалить все данные» спрашивает подтверждение', (await asOpen()) && (await txt('#asOk')) === 'Удалить всё');
  await page.click('#asCancel'); await wait();
  check('«Отмена» ничего не удаляет', (await st()).tasks.length === s.tasks.length);
  await page.click('[data-action="wipe"]'); await page.click('#asOk'); await wait(200);
  let w = await st();
  check('Все данные удалены', w.tasks.length + w.subjects.length + w.classes.length === 0);
  await page.setInputFiles('#importFile', backupPath); await wait(250);
  check('Загрузка копии спрашивает подтверждение с количеством', (await asOpen()) && (await txt('#asMsg')).includes(`${s.tasks.length} задан`), await txt('#asMsg'));
  await page.click('#asCancel'); await wait();
  check('«Отмена» загрузки ничего не меняет', (await st()).tasks.length === 0);
  await page.setInputFiles('#importFile', backupPath); await wait(250);
  await page.click('#asOk'); await wait(200);
  check('Копия восстанавливает данные один в один', same(await st(), s));
  await page.setInputFiles('#importFile', (fs.existsSync(DIR + '/evil.json') ? DIR + '/evil.json' : DIR + '/../evil.json')); await wait(250);
  await page.click('#asOk'); await wait(200);
  await tab('tasks'); await openTask('Взлом');
  const sec1 = await page.evaluate(() => ({ pwned: window.__pwned || 0, img: document.querySelectorAll('img').length }));
  check('Вредный файл: код не выполнился, теги показаны текстом', sec1.pwned === 0 && sec1.img === 0 && (await txt('.detail-head h3')).startsWith('<script>'));
  await page.keyboard.press('Escape');
  await page.setInputFiles('#importFile', backupPath); await wait(250); await page.click('#asOk'); await wait(200);

  // ---------- 14. Пустое состояние ----------
  sec('Пустое состояние');
  await tab('settings'); await page.click('[data-action="wipe"]'); await page.click('#asOk'); await wait(200);
  await tab('tasks');
  check('Пустой экран: «Заданий нет»', (await txt('#scr-tasks .empty h3')) === 'Заданий нет');
  await tab('grades');
  check('Оценки без предметов: «Сначала добавь предмет»', (await txt('#scr-grades .empty h3')) === 'Сначала добавь предмет');
  await tab('focus');
  check('Фокус без занятий: подсказка', (await txt('#scr-focus')).includes('занятий ещё не было'));
  await tab('tasks');
  check('Hero: «Пока ничего не горит»', (await txt('.hero-title')) === 'Пока ничего не горит.');
  await page.click('.empty [data-action="newtask"]'); await wait(200);
  check('Кнопка в пустом экране открывает форму', (await txt('#sheetTitle')) === 'Новое задание');
  await page.fill('#f-title', 'Первое своё задание'); await page.fill('#f-date', '2026-10-22'); await page.fill('#f-time', '23:00');
  await page.click('#sheetRight'); await wait(200);
  check('Тост «Сдавать сегодня!»', (await toast()) === 'Добавлено. Сдавать сегодня!', await toast());
  check('Hero: отсчёт 13 ч 00 мин', (await txt('.countdown')) === '13 ч 00 мин', await txt('.countdown'));
  check('Строка «сегодня» оранжевая', (await page.getAttribute('.urg', 'class')).includes('c-hot'));
  await page.click('.screen:not([hidden]) .ring'); await wait();
  check('Всё сдано → «Всё сдано. Можно выдохнуть.»', (await txt('.hero-title')) === 'Всё сдано. Можно выдохнуть.');

  // ---------- 15. Сохранение и устойчивость ----------
  sec('Сохранение');
  const before = await st();
  await page.reload(); await wait(400);
  check('Данные сохраняются после перезагрузки', JSON.stringify(await st()) === JSON.stringify(before));
  check('После удаления всех данных примеры не возвращаются', !(await vis('.banner')));
  await page.evaluate(() => localStorage.setItem('sdam-vovremya-v1', '{ испорчено'));
  await page.reload(); await wait(500);
  check('Испорченное хранилище: приложение открывается с примерами', (await vis('.banner')) && (await page.locator('.screen:not([hidden]) .trow').count()) > 0);
  await page.clock.setFixedTime(new Date(T0.getTime() + 60 * 60 * 1000));
  const cdBefore = await txt('.countdown');
  await page.waitForTimeout(31000);
  check('Отсчёт обновляется сам каждые 30 секунд', (await txt('.countdown')) !== cdBefore, cdBefore + ' → ' + (await txt('.countdown')));
  await page.clock.setFixedTime(T0);

  // ---------- 16. Доступность ----------
  sec('Доступность');
  for (const k of ['tasks', 'cal', 'sched', 'focus', 'grades', 'settings']) {
    await tab(k);
    const unnamed = await page.$$eval('button', (bs) => bs.filter((b) => b.offsetParent && !b.textContent.trim() && !b.getAttribute('aria-label')).map((b) => b.className));
    check(`Все кнопки подписаны (${k})`, unnamed.length === 0, unnamed.join(','));
  }
  await tab('tasks');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  check('Клавиатурная навигация: виден фокус', await page.evaluate(() => document.activeElement && document.activeElement.tagName === 'BUTTON'));

  // ---------- 17. Вёрстка ----------
  sec('Вёрстка');
  for (const [w, h] of [[320, 640], [393, 852], [768, 1024], [1280, 800]]) {
    for (const scheme of ['light', 'dark']) {
      const p = await newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
      await p.goto(URL); await p.waitForTimeout(350);
      let ok = true, where = '';
      for (const k of ['tasks', 'cal', 'sched', 'focus', 'grades', 'settings']) {
        if (k === 'settings') await p.click('.screen:not([hidden]) [data-tab="settings"]'); else await p.click(`.tabbar [data-tab="${k}"]`);
        await p.waitForTimeout(120);
        const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        if (over) { ok = false; where += k + ' '; }
      }
      await p.click('.tabbar [data-tab="tasks"]'); await p.waitForTimeout(100);
      await p.locator('.trow-main').first().click(); await p.waitForTimeout(250);
      const sheetFits = await p.evaluate(() => { const r = document.querySelector('.sheet').getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1; });
      check(`Нет горизонтальной прокрутки ${w}px ${scheme}`, ok, where);
      check(`Шторка помещается ${w}px ${scheme}`, sheetFits);
      if (w === 320 && scheme === 'light') await p.screenshot({ path: DIR + '/w320.png' });
      await p.context().close();
    }
  }
  await tab('tasks');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(200);
  const covered = await page.evaluate(() => {
    const lists = [...document.querySelectorAll('#scr-tasks .card, #scr-tasks .list')];
    const last = lists[lists.length - 1].getBoundingClientRect();
    return last.bottom > document.querySelector('.tabbar').getBoundingClientRect().top + 1;
  });
  check('Нижняя панель не закрывает последний элемент', !covered);

  check('Нет внешних запросов', external.length === 0, external.join(', '));
  check('Нет ошибок в консоли и системных диалогов', errors.length === 0, errors.join(' | '));

  // ---------- отчёт ----------
  const failed = results.filter((r) => !r.ok);
  let cur = '';
  for (const r of results) {
    if (r.section !== cur) { cur = r.section; console.log('\n## ' + cur); }
    console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.ok ? '' : '   ← ' + r.info));
  }
  console.log(`\nИТОГО: ${results.length - failed.length} из ${results.length} проверок пройдено`);
  fs.writeFileSync(DIR + '/results.json', JSON.stringify(results, null, 1));
  await browser.close();
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
