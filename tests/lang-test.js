// Проверка трёх языков: нет ли русского текста в EN/UZ, форматы дат и чисел, переключение, вёрстка.
const { chromium } = require(process.env.PW || 'playwright');
const URL = 'http://localhost:8765/index.html';
const T0 = new Date('2026-10-22T10:00:00+03:00');
const results = [];
let section = '';
const check = (name, ok, info = '') => results.push({ section, name, ok: !!ok, info: ok ? '' : String(info) });

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function newPage(locale, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'Europe/Moscow', locale, acceptDownloads: true, ...opts });
    const p = await ctx.newPage();
    await p.clock.setFixedTime(T0);
    p.on('pageerror', (e) => errors.push(locale + ' pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(locale + ' console: ' + m.text()); });
    await p.goto(URL); await p.waitForTimeout(500);
    return p;
  }
  const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const leaks = (p) => p.evaluate(() => {
    const out = [];
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode; if (/[А-Яа-яЁё]/.test(n.textContent) && n.parentElement && vis(n.parentElement) && !n.parentElement.closest('[data-lang-opt]')) out.push(n.textContent.trim()); }
    document.querySelectorAll('[aria-label],[placeholder],[title]').forEach((el) => {
      if (!vis(el)) return;
      for (const a of ['aria-label', 'placeholder', 'title']) { const v = el.getAttribute(a); if (v && /[А-Яа-яЁё]/.test(v)) out.push(a + ': ' + v); }
    });
    if (/[А-Яа-яЁё]/.test(document.title)) out.push('title: ' + document.title);
    return out;
  });
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

  for (const [lang, locale] of [['en', 'en-US'], ['uz', 'uz-UZ']]) {
    section = lang.toUpperCase();
    const p = await newPage(locale);
    const all = [];
    const sweep = async (where) => { const l = await leaks(p); if (l.length) all.push(where + ': ' + l.slice(0, 4).join(' | ')); return l.length; };
    const tab = async (k) => { if (k === 'settings') await p.click('.screen:not([hidden]) [data-tab="settings"]'); else await p.click(`.tabbar [data-tab="${k}"]`); await p.waitForTimeout(150); };
    const esc = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(120); };

    check('Язык определился по браузеру', (await p.getAttribute('html', 'lang')) === lang, await p.getAttribute('html', 'lang'));
    const tabs = await p.$$eval('.tabbar .tab span', (x) => x.map((e) => e.textContent));
    check('Вкладки переведены', lang === 'en' ? tabs.join(',') === 'Tasks,Calendar,Classes,Focus,Grades' : tabs.join(',') === 'Vazifalar,Taqvim,Darslar,Fokus,Baholar', tabs.join(','));
    const sub = await txt(p, '#scr-tasks .nav-sub');
    check('Дата и неделя на языке', lang === 'en' ? sub === 'Thursday, October 22 · Week 8, even' : sub === 'Payshanba, 22-oktabr · 8-hafta, juft', sub);
    check('Отсчёт на языке', lang === 'en' ? (await txt(p, '.countdown')) === '−1d 0h' : (await txt(p, '.countdown')) === '−1 kun 0 soat', await txt(p, '.countdown'));
    check('Примеры на языке', lang === 'en' ? (await txt(p, '.hero-title')) === 'Integrals problem set' : (await txt(p, '.hero-title')) === 'Integrallar boʻyicha hisob ishi', await txt(p, '.hero-title'));
    await sweep('Задания');
    await p.click('.screen:not([hidden]) [data-action="showdone"]'); await p.waitForTimeout(100); await sweep('Сданные');
    await p.click('.hero'); await p.waitForTimeout(250); await sweep('Карточка задания');
    await p.click('#sheetRight'); await p.waitForTimeout(200); await sweep('Правка задания');
    await p.click('[data-menu="f-kind"]'); await p.waitForTimeout(150); await sweep('Меню типов');
    const kinds = await p.$$eval('#menuPop .menu-item', (x) => x.length);
    check('Меню типов: 10 пунктов', kinds === 10);
    await esc(); await p.click('[data-menu="f-subject"]'); await p.waitForTimeout(150); await sweep('Меню предметов'); await esc();
    await p.click('#sheetLeft'); await p.waitForTimeout(150);
    await p.click('[data-action="deltask"]'); await p.waitForTimeout(150); await sweep('Подтверждение удаления');
    await p.click('#asCancel'); await esc();
    await p.click('.screen:not([hidden]) .nav-btn-circle[data-action="newtask"]'); await p.waitForTimeout(200);
    await p.click('#sheetRight'); await p.waitForTimeout(100); await sweep('Новое задание с ошибкой');
    await p.fill('#f-title', 'Test'); await p.click('[data-action="suggestform"]'); await p.waitForTimeout(80);
    const steps = await p.inputValue('#f-steps');
    check('Подсказка шагов на языке', !/[А-Яа-яЁё]/.test(steps) && steps.length > 5, steps);
    await p.click('#sheetRight'); await p.waitForTimeout(250);
    const toast = await txt(p, '#toast');
    check('Тост на языке', lang === 'en' ? toast === 'Added. Due in 7 days.' : toast === 'Qoʻshildi. Muddatgacha 7 kun.', toast);

    await tab('cal'); await sweep('Календарь');
    check('Месяц на языке', lang === 'en' ? (await txt(p, '.cal-top h3')) === 'October 2026' : (await txt(p, '.cal-top h3')) === 'Oktabr 2026', await txt(p, '.cal-top h3'));
    const wd = await p.$$eval('.cal-week span', (x) => x.map((e) => e.textContent).join(','));
    check('Дни недели на языке', lang === 'en' ? wd === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun' : wd === 'Dush,Sesh,Chor,Pay,Jum,Shan,Yak', wd);
    await p.click('[data-day="2026-10-23"]'); await p.waitForTimeout(100); await sweep('День в календаре');

    await tab('sched'); await sweep('Пары: пусто');
    await p.click('.empty [data-action="addclass"]'); await p.waitForTimeout(200); await sweep('Форма пары');
    await p.click('[data-menu="c-day"]'); await p.waitForTimeout(120); await sweep('Меню дней'); await esc();
    await p.fill('#c-start', '09:30'); await p.fill('#c-end', '11:00'); await p.fill('#c-room', '305');
    await p.click('#sheetRight'); await p.waitForTimeout(200); await sweep('Пары с уроком');
    check('Карточка «сейчас идёт» на языке', lang === 'en' ? (await txt(p, '.now-card')).startsWith('Happening now') : (await txt(p, '.now-card')).startsWith('Hozir davom etmoqda'), await txt(p, '.now-card'));
    await p.click('[data-week="next"]'); await p.waitForTimeout(100); await sweep('Следующая неделя'); await p.click('[data-week="this"]');
    await p.click('.lesson'); await p.waitForTimeout(200); await sweep('Правка пары');
    await p.click('[data-action="delclass"]'); await p.waitForTimeout(100); await sweep('Подтверждение удаления пары'); await p.click('#asCancel'); await esc();

    await tab('focus'); await sweep('Фокус');
    await p.click('[data-action="tstart"]'); await p.waitForTimeout(200); await sweep('Фокус идёт');
    await p.click('[data-action="tskip"]'); await p.waitForTimeout(150); await sweep('Подтверждение пропуска'); await p.click('#asCancel');
    await p.click('[data-action="tpause"]'); await p.waitForTimeout(150); await sweep('Пауза');
    await p.click('[data-action="treset"]'); await p.waitForTimeout(100);

    await tab('grades'); await sweep('Оценки');
    const avg = await txt(p, '.avg-big');
    check('Средний балл в формате языка', lang === 'en' ? avg === '4.37' : avg === '4,37', avg);
    await p.click('.grade-row >> nth=1'); await p.waitForTimeout(250); await sweep('Оценки предмета');
    await p.click('[data-menu="g-target"]'); await p.waitForTimeout(120); await sweep('Меню цели'); await esc();
    const target = await txt(p, '#target-result');
    check('Расчёт цели на языке', lang === 'en' ? target === 'You need 3 more fives in a row.' : target === 'Ketma-ket yana 3 ta «5» kerak.', target);
    await p.locator('#sheetBody .gchip').first().click(); await p.waitForTimeout(120); await sweep('Удаление оценки'); await p.click('#asCancel'); await esc();
    await p.click('#scr-grades [data-action="newgrade"]'); await p.waitForTimeout(200); await sweep('Новая оценка'); await esc();

    await tab('settings'); await sweep('Настройки');
    await p.click('[data-action="addsubj"]'); await p.waitForTimeout(200); await sweep('Новый предмет'); await esc();
    await p.click('[data-action="delsubj"] >> nth=0'); await p.waitForTimeout(120); await sweep('Удаление предмета'); await p.click('#asCancel');
    await p.click('[data-action="wipe"]'); await p.waitForTimeout(120); await sweep('Удаление всего'); await p.click('#asCancel');
    await p.click('[data-action="policy"]'); await p.waitForTimeout(200); await sweep('Политика');
    check('Политика на языке', lang === 'en' ? (await txt(p, '.policy')).includes('Effective October 22, 2026') : (await txt(p, '.policy')).includes('2026-yil 22-oktabrdan'), (await txt(p, '.policy')).slice(0, 60));
    await esc();
    for (const k of ['tasks', 'cal', 'sched', 'focus', 'grades', 'settings']) {
      await p.setViewportSize({ width: 320, height: 640 }); await tab(k);
      if (await overflow(p)) all.push('overflow 320px: ' + k);
    }
    await p.setViewportSize({ width: 393, height: 852 });
    check('Во всех экранах, шторках и меню нет русского текста', all.length === 0, all.join(' || '));
    await p.context().close();
  }

  // ---------- переключение языка ----------
  section = 'Переключение';
  const p = await newPage('ru-RU');
  check('Русский по умолчанию для ru-RU', (await p.getAttribute('html', 'lang')) === 'ru');
  await p.click('.screen:not([hidden]) .nav-btn-circle[data-action="newtask"]'); await p.waitForTimeout(200);
  await p.fill('#f-title', 'Моё собственное задание'); await p.click('#sheetRight'); await p.waitForTimeout(250);
  await p.click('.screen:not([hidden]) [data-tab="settings"]'); await p.waitForTimeout(150);
  check('В настройках 3 языка', (await p.locator('[data-lang-opt]').count()) === 3);
  check('Русский отмечен', (await p.getAttribute('[data-lang-opt="ru"]', 'aria-checked')) === 'true');
  await p.click('[data-lang-opt="en"]'); await p.waitForTimeout(200);
  check('Переключение на English сразу меняет интерфейс', (await txt(p, '#scr-settings .large-title')) === 'Settings' && (await p.getAttribute('html', 'lang')) === 'en');
  check('English отмечен', (await p.getAttribute('[data-lang-opt="en"]', 'aria-checked')) === 'true');
  await p.click('[data-action="back"]'); await p.waitForTimeout(150);
  const titles = await p.$$eval('#scr-tasks .trow .t', (x) => x.map((e) => e.textContent));
  check('Примеры переведены на английский', titles.includes('Lab 3: linked lists') && !titles.some((x) => x.startsWith('Лабораторная')), titles.join(' | '));
  check('Своё задание не переводится', titles.includes('Моё собственное задание'));
  const pills = await p.$$eval('.pill', (x) => x.map((e) => e.textContent.replace(/\s*\d+$/, '').trim()));
  check('Предметы-примеры переведены', pills.includes('Calculus') && pills.includes('Physics'), pills.join(','));
  await p.reload(); await p.waitForTimeout(500);
  check('Язык запоминается после перезагрузки', (await p.getAttribute('html', 'lang')) === 'en' && (await txt(p, '.tabbar .tab span')) === 'Tasks');
  await p.click('.screen:not([hidden]) [data-tab="settings"]'); await p.waitForTimeout(150);
  await p.click('[data-lang-opt="uz"]'); await p.waitForTimeout(200);
  await p.click('[data-action="back"]'); await p.waitForTimeout(150);
  check('Переключение на узбекский', (await txt(p, '#scr-tasks .large-title')) === 'Topshiriqlar' && (await txt(p, '.hero-title')) === 'Integrallar boʻyicha hisob ishi');
  await p.click('.screen:not([hidden]) [data-tab="settings"]'); await p.click('[data-lang-opt="ru"]'); await p.waitForTimeout(200);
  await p.click('[data-action="back"]'); await p.waitForTimeout(150);
  check('Обратно на русский — примеры снова русские', (await txt(p, '.hero-title')) === 'Типовой расчёт по интегралам');
  const doneSteps = await p.evaluate(() => JSON.parse(localStorage.getItem('sdam-vovremya-v1')).tasks.find((x) => x.id === 'ex-t2').steps.map((s) => s.done).join(','));
  check('Отметки шагов сохраняются при смене языка', doneSteps === 'true,true,false,false', doneSteps);
  await p.click('.screen:not([hidden]) [data-tab="settings"]'); await p.waitForTimeout(150); await p.click('#scr-settings [data-action="clearex"]'); await p.waitForTimeout(150);
  await p.click('[data-lang-opt="en"]'); await p.waitForTimeout(200);
  const own = await p.evaluate(() => JSON.parse(localStorage.getItem('sdam-vovremya-v1')).tasks.map((x) => x.title));
  check('После удаления примеров смена языка не трогает данные', own.length === 1 && own[0] === 'Моё собственное задание', own.join('|'));
  await p.context().close();

  // ---------- автоопределение ----------
  section = 'Автоопределение';
  for (const [loc, want] of [['de-DE', 'ru'], ['uz-Cyrl-UZ', 'uz'], ['en-GB', 'en']]) {
    const q = await newPage(loc);
    check(`Браузер ${loc} → ${want}`, (await q.getAttribute('html', 'lang')) === want, await q.getAttribute('html', 'lang'));
    await q.context().close();
  }

  check('Нет ошибок в консоли', errors.length === 0, errors.join(' | '));
  let cur = '';
  for (const r of results) {
    if (r.section !== cur) { cur = r.section; console.log('\n## ' + cur); }
    console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.ok ? '' : '   ← ' + r.info));
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nИТОГО (языки): ${results.length - failed} из ${results.length} проверок пройдено`);
  await browser.close();
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
