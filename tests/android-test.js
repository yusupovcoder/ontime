// Проверка Android-веток (Capacitor) с подменённым мостом: кнопка «Назад», экспорт через «Поделиться», строка состояния.
// Запуск: python3 -m http.server 8765 (из www), затем node tests/android-test.js
const { chromium } = require(process.env.PW || 'playwright');
const URL = 'http://localhost:8765/index.html';
let ok = 0, all = 0;
const check = (name, cond) => { all++; if (cond) ok++; console.log((cond ? '  ✓ ' : '  ✗ ') + name); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ locale: 'ru-RU', viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const calls = (window.__calls = []);
    const listeners = (window.__listeners = {});
    window.Capacitor = {
      PluginHeaders: ['App', 'Filesystem', 'Share', 'SystemBars', 'LocalNotifications'].map((name) => ({ name, methods: [] })),
      isNativePlatform: () => true,
      nativePromise: (p, m, o) => {
        calls.push([p, m, o]);
        if (p === 'Filesystem') return Promise.resolve({ uri: 'file:///cache/' + o.path });
        if (p === 'LocalNotifications') {
          const pend = (window.__pending = window.__pending || new Map());
          if (m === 'checkPermissions') return Promise.resolve({ display: window.__perm || 'prompt' });
          if (m === 'requestPermissions') { window.__perm = 'granted'; return Promise.resolve({ display: 'granted' }); }
          if (m === 'getPending') return Promise.resolve({ notifications: [...pend.values()] });
          if (m === 'schedule') { for (const n of o.notifications) pend.set(n.id, n); return Promise.resolve({ notifications: o.notifications.map((n) => ({ id: n.id })) }); }
          if (m === 'cancel') { for (const n of o.notifications) pend.delete(n.id); return Promise.resolve(); }
          if (m === 'checkExactNotificationSetting') return Promise.resolve({ exact_alarm: window.__exact || 'denied' });
          if (m === 'changeExactNotificationSetting') { window.__exact = 'granted'; return Promise.resolve({ exact_alarm: 'granted' }); }
        }
        return Promise.resolve({});
      },
      addListener: (p, ev, cb) => { listeners[p + ':' + ev] = cb; return { remove() {} }; },
    };
  });
  await page.goto(URL); await page.waitForTimeout(500);
  const back = async () => { await page.evaluate(() => window.__listeners['App:backButton']()); await page.waitForTimeout(150); };
  const calls = () => page.evaluate(() => window.__calls);
  const curTab = () => page.evaluate(() => document.querySelector('.tabbar [aria-current="page"], .tabbar .on')?.dataset.tab || null);

  check('Слушатель кнопки «Назад» зарегистрирован', await page.evaluate(() => typeof window.__listeners['App:backButton'] === 'function'));
  check('Строка состояния получила стиль', (await calls()).some(([p, m]) => p === 'SystemBars' && m === 'setStyle'));

  // лист закрывается «Назад»
  await page.click('.screen:not([hidden]) [data-action="newtask"]'); await page.waitForTimeout(300);
  check('Лист открыт', await page.isVisible('#sheetOv'));
  await back();
  check('«Назад» закрывает лист', !(await page.isVisible('#sheetOv')));

  // вкладка → «Задачи»
  await page.click('.tabbar [data-tab="grades"]'); await page.waitForTimeout(200);
  await back();
  check('«Назад» с другой вкладки ведёт на «Задачи»', await page.evaluate(() => !document.getElementById('scr-tasks').hidden));

  // настройки → предыдущая вкладка
  await page.click('.tabbar [data-tab="focus"]'); await page.waitForTimeout(200);
  await page.click('.screen:not([hidden]) [data-tab="settings"]'); await page.waitForTimeout(200);
  await back();
  const focusVisible = await page.evaluate(() => [...document.querySelectorAll('.screen')].filter((s) => !s.hidden).map((s) => s.id).join());
  check('«Назад» из настроек возвращает на прошлую вкладку (' + focusVisible + ')', /focus/i.test(focusVisible));

  // на «Задачах» — свернуть приложение
  await back(); await back();
  check('«Назад» на главной сворачивает приложение', (await calls()).some(([p, m]) => p === 'App' && m === 'minimizeApp'));

  // экспорт через Filesystem + Share
  await page.click('.tabbar [data-tab="tasks"]'); await page.waitForTimeout(150);
  await page.click('.screen:not([hidden]) [data-tab="settings"]'); await page.waitForTimeout(200);
  await page.click('.screen:not([hidden]) [data-action="export"]'); await page.waitForTimeout(400);
  const c = await calls();
  const w = c.find(([p, m]) => p === 'Filesystem' && m === 'writeFile');
  const sh = c.find(([p, m]) => p === 'Share' && m === 'share');
  check('Экспорт пишет файл во временную папку', !!w && w[2].directory === 'CACHE' && /^on-time-backup-\d{4}-\d\d-\d\d\.json$/.test(w[2].path));
  let parsed = null; try { parsed = JSON.parse(w[2].data); } catch {}
  check('Файл — корректная резервная копия', !!parsed && parsed.app === 'sdam-vovremya' && Array.isArray(parsed.data.tasks));
  check('Открывается системное «Поделиться»', !!sh && sh[2].url === 'file:///cache/' + w[2].path && sh[2].dialogTitle === 'On Time');

  // тема → стиль значков
  await page.evaluate(() => { window.__calls.length = 0; });
  await page.click('.screen:not([hidden]) [data-theme-opt="dark"]'); await page.waitForTimeout(150);
  check('Тёмная тема → светлые значки (DARK)', (await calls()).some(([p, m, o]) => p === 'SystemBars' && o.style === 'DARK'));
  await page.click('.screen:not([hidden]) [data-theme-opt="light"]'); await page.waitForTimeout(150);
  check('Светлая тема → тёмные значки (LIGHT)', (await calls()).some(([p, m, o]) => p === 'SystemBars' && o.style === 'LIGHT'));

  await page.click('.screen:not([hidden]) [data-action="policy"]'); await page.waitForTimeout(300);
  check('Политика упоминает Android-хранилище', /Android/.test(await page.textContent('#sheetOv')));
  await back();
  // ---------- уведомления ----------
  const pending = () => page.evaluate(() => [...(window.__pending || new Map()).values()].sort((a, b) => a.id - b.id));
  const d2 = new Date(); d2.setDate(d2.getDate() + 2);
  const due = d2.getFullYear() + '-' + String(d2.getMonth() + 1).padStart(2, '0') + '-' + String(d2.getDate()).padStart(2, '0');
  await page.evaluate((due) => {
    localStorage.setItem('sdam-vovremya-v1', JSON.stringify({ v: 1, examples: false, weekFlip: false,
      subjects: [{ id: 's1', name: 'Матан', color: 'blue' }],
      tasks: [{ id: 't1', title: 'Курсовая', subjectId: 's1', kind: 'course', due, time: '10:00', steps: [], done: false, doneAt: null, createdAt: Date.now() }],
      classes: [], grades: [], sessions: [] }));
    localStorage.setItem('sdam-vovremya-v1:tab', 'settings');
    localStorage.removeItem('sdam-vovremya-v1:notif');
  }, due);
  await page.reload(); await page.waitForTimeout(1500);
  check('В настройках есть раздел «Уведомления»', (await page.textContent('#scr-settings')).includes('Напоминать о сдачах'));
  check('Пока выключено — ничего не запланировано', (await pending()).filter((n) => n.id >= 1000).length === 0);
  check('Строки времени скрыты, пока напоминания выключены', !(await page.$('[data-menu="n-eve"]')));
  await page.click('#scr-settings label:has(#n-on)'); await page.waitForTimeout(1200);
  check('Включение спрашивает разрешение', (await calls()).some(([p, m]) => p === 'LocalNotifications' && m === 'requestPermissions'));
  check('Тост «Напоминания включены»', (await page.textContent('#toast')).includes('Напоминания включены'));
  let pn = (await pending()).filter((n) => n.id >= 1000);
  const at = (n) => new Date(n.schedule.at);
  check('Запланировано 3 напоминания (накануне, утром, за час)', pn.length === 3, pn.map((n) => n.body));
  check('Накануне в 19:00: «Сдать завтра до 10:00 · Матан»', pn.some((n) => n.body === 'Сдать завтра до 10:00 · Матан' && at(n).getHours() === 19 && at(n).getDate() === new Date(d2.getTime() - 864e5).getDate()));
  check('В день сдачи в 8:00: «Сдать сегодня до 10:00»', pn.some((n) => n.body.startsWith('Сдать сегодня до 10:00') && at(n).getHours() === 8 && at(n).getDate() === d2.getDate()));
  check('За час: «До сдачи осталось 1 ч» в 9:00', pn.some((n) => n.body.startsWith('До сдачи осталось 1 ч') && at(n).getHours() === 9));
  check('Заголовок — название задания, канал «deadlines», ссылка на задание', pn.every((n) => n.title === 'Курсовая' && n.channelId === 'deadlines' && n.extra.taskId === 't1' && n.schedule.allowWhileIdle));
  check('Каналы созданы', (await calls()).filter(([p, m]) => m === 'createChannel').map(([, , o]) => o.id).sort().join() .includes('deadlines,timer'));
  check('Видна строка «Точное время уведомлений»', (await page.textContent('#scr-settings')).includes('Точное время уведомлений'));
  await page.click('#scr-settings [data-action="exactalarm"]'); await page.waitForTimeout(400);
  check('Нажатие открывает системную настройку точного времени', (await calls()).some(([p, m]) => m === 'changeExactNotificationSetting') && !(await page.textContent('#scr-settings')).includes('Точное время уведомлений'));
  await page.click('[data-menu="n-eve"]'); await page.waitForTimeout(200);
  await page.click('#menuPop [data-val="off"]'); await page.waitForTimeout(1200);
  pn = (await pending()).filter((n) => n.id >= 1000);
  check('«Накануне: выкл.» → 2 напоминания', pn.length === 2 && !pn.some((n) => n.body.startsWith('Сдать завтра')));
  // нажатие на уведомление открывает задание
  await page.evaluate(() => window.__listeners['LocalNotifications:localNotificationActionPerformed']({ actionId: 'tap', notification: { id: 1000, extra: { taskId: 't1' } } }));
  await page.waitForTimeout(400);
  check('Нажатие на уведомление открывает карточку задания', (await page.isVisible('#sheetOv')) && (await page.textContent('#sheetOv')).includes('Курсовая'));
  await back();
  // сдано → напоминания снимаются
  await page.click('#scr-tasks [data-action="toggle"]'); await page.waitForTimeout(1300);
  check('Сданное задание — без напоминаний', (await pending()).filter((n) => n.id >= 1000).length === 0);
  // таймер
  await page.click('.tabbar [data-tab="focus"]'); await page.waitForTimeout(200);
  await page.click('[data-action="tstart"]'); await page.waitForTimeout(500);
  let tn = (await pending()).find((n) => n.id === 1);
  const endsAt = await page.evaluate(() => JSON.parse(localStorage.getItem('sdam-vovremya-v1:timer')).endsAt);
  check('Старт фокуса → уведомление на момент окончания', !!tn && tn.title === 'Фокус окончен' && Math.abs(new Date(tn.schedule.at) - endsAt) < 1000 && tn.channelId === 'timer');
  await page.click('[data-action="tpause"]'); await page.waitForTimeout(400);
  check('Пауза → уведомление таймера снято', !(await pending()).some((n) => n.id === 1));
  // язык
  await page.click('.screen:not([hidden]) [data-tab="settings"]'); await page.waitForTimeout(200);
  await page.click('[data-lang-opt="en"]'); await page.waitForTimeout(400);
  check('Смена языка переименовывает каналы', (await calls()).some(([p, m, o]) => m === 'createChannel' && o.name === 'Deadlines'));
  check('Раздел на английском', (await page.textContent('#scr-settings')).includes('Deadline reminders'));
  await page.click('[data-lang-opt="ru"]'); await page.waitForTimeout(300);

  // в обычном браузере раздела нет
  const plain = await browser.newPage({ locale: 'ru-RU' });
  await plain.goto(URL); await plain.waitForTimeout(400);
  await plain.click('.screen:not([hidden]) [data-tab="settings"]'); await plain.waitForTimeout(200);
  check('В браузере раздела «Уведомления» нет', !(await plain.textContent('#scr-settings')).includes('Напоминать о сдачах'));
  await plain.close();

  check('Нет ошибок в консоли', errors.length === 0 || (console.log(errors), false));
  await browser.close();
  console.log(`\nИТОГО (Android): ${ok} из ${all} проверок пройдено`);
  process.exit(ok === all ? 0 : 1);
})();
