const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'Europe/Moscow', locale: 'ru-RU' });
  const out = []; const errs = [];
  const check = (n, ok, i = '') => out.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' ← ' + i));
  await ctx.addInitScript(() => {
    // Имитация платформы claude.ai: db + user + downloads
    const store = JSON.parse(sessionStorage.getItem('cloud') || 'null');
    window.__cloud = { doc: store, sets: 0, saves: [] };
    const listeners = [];
    const ref = {
      onSnapshot(next) { listeners.push(next); setTimeout(() => next({ exists: !!window.__cloud.doc, data: () => window.__cloud.doc, metadata: { hasPendingWrites: false, fromCache: false } }), 50); return () => {}; },
      async set(d) { window.__cloud.doc = d; window.__cloud.sets++; sessionStorage.setItem('cloud', JSON.stringify(d)); },
    };
    window.claude = { use: async (n) => n === 'db' ? { doc: (p) => { window.__cloud.path = p; return ref; } } : n === 'user' ? { id: async () => 'u_test1' } : n === 'downloads' ? { save: async (r) => { window.__cloud.saves.push(r.filename + ':' + r.data.length); return { status: 'saved' }; } } : null };
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-22T10:00:00+03:00'));
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(700);
  check('Путь в облаке — личный раздел пользователя', (await page.evaluate(() => window.__cloud.path)) === 'data/users/u_test1/planner');
  check('Примеры показаны при пустом облаке', (await page.locator('.screen:not([hidden]) .trow').count()) === 6);
  check('Без изменений в облако ничего не пишется', (await page.evaluate(() => window.__cloud.sets)) === 0);
  await page.click('.screen:not([hidden]) .ring >> nth=0'); await page.waitForTimeout(1200);
  check('Изменение сохраняется в облако', (await page.evaluate(() => window.__cloud.sets)) >= 1);
  await page.click('[data-tab="settings"]'); await page.waitForTimeout(150);
  check('Статус «Сохранено в твоём аккаунте»', (await page.textContent('#saveStatus')).includes('в твоём аккаунте'));
  check('Подпись о хранении в аккаунте', (await page.textContent('#scr-settings')).includes('в твоём аккаунте Claude'));
  await page.click('[data-action="policy"]'); await page.waitForTimeout(150);
  check('Политика описывает хранение в Claude', (await page.textContent('.policy')).includes('аккаунте Claude'));
  await page.click('#sheetLeft');
  await page.click('[data-action="export"]'); await page.waitForTimeout(300);
  check('Экспорт идёт через загрузку платформы', (await page.evaluate(() => window.__cloud.saves.length)) === 1 && (await page.textContent('#toast')).includes('сохранена'));
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(700);
  await page.click('[data-tab="tasks"]'); await page.waitForTimeout(150);
  check('После очистки браузера данные приходят из облака', (await page.locator('.screen:not([hidden]) .trow').count()) === 5);
  check('Нет ошибок', errs.length === 0, errs.join('|'));
  console.log(out.join('\n'));
  await browser.close();
})();
