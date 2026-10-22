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
      PluginHeaders: ['App', 'Filesystem', 'Share', 'SystemBars'].map((name) => ({ name, methods: [] })),
      isNativePlatform: () => true,
      nativePromise: (p, m, o) => {
        calls.push([p, m, o]);
        if (p === 'Filesystem') return Promise.resolve({ uri: 'file:///cache/' + o.path });
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
  check('Нет ошибок в консоли', errors.length === 0 || (console.log(errors), false));
  await browser.close();
  console.log(`\nИТОГО (Android): ${ok} из ${all} проверок пройдено`);
  process.exit(ok === all ? 0 : 1);
})();
