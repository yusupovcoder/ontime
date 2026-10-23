# On Time

Веб-приложение — планировщик для студентов: дедлайны, календарь, расписание пар, таймер учёбы, оценки. Общайся со мной по-русски. Интерфейс приложения — на трёх языках: русский, узбекский (латиница), английский.

## Проект
Чистый HTML + CSS + JavaScript, без фреймворков и сборщиков. Запуск через Live Server в VS Code.

- index.html — каркас: 4 экрана (scr-tasks, scr-cal, scr-sched, scr-settings), нижний таб-бар, шторка (sheetOv), action sheet (asOv), тост. В `<head>` — строгая CSP
- style.css — оформление в стиле iOS; цвета — системные цвета Apple токенами в :root (светлая и тёмная тема), системный шрифт
- app.js — вся логика внутри одной IIFE
- PRIVACY.md — политика конфиденциальности; при изменении работы с данными обновляй и её, и функцию policyHTML() в app.js

## Android (Capacitor 8)
- package.json, capacitor.config.json (appId app.ontime.planner, appName «On Time», webDir www), папка android/ — нативный проект
- В app.js: CAP (window.Capacitor, только в нативной сборке), hasPlugin(name), native(plugin, method, opts) — вызовы через мост без сборщика
- Кнопка «Назад» (App.backButton): меню → подтверждение → шторка → настройки → вкладка «Задачи» → свернуть
- Экспорт на Android: Filesystem.writeFile в CACHE + Share.share; цвет значков строки состояния — SystemBars.setStyle в applyAppearance()
- Без CAP всё работает как в браузере. После правок www/ — `npx cap sync android`; APK собирает .github/workflows/android.yml
- В манифесте allowBackup=false (данные не уходят в облачную копию Google) — не включать без правки PRIVACY.md
- MainActivity.java: preferHighRefreshRate() просит максимальную частоту экрана (90/120 Гц), matchWebViewBackground() — фон без вспышки
- Уведомления (@capacitor/local-notifications, только Android): настройки в `:notif` {on, eve, morn, before, timer}; deadlineNotifs() строит список (id 1000+, не больше 64, примеры ex пропускаются), syncNotifications() пересоздаёт их после каждого scheduleSave()/render(); уведомление таймера id 1 — syncTimerNotif() из storeTimer(); каналы deadlines/timer (notifChannels, переименовываются при смене языка); нажатие на уведомление → openFromNotification(); значок — res/drawable/ic_stat_ontime.xml
- Заставка при запуске: #intro в разметке + CSS (.intro, intro-*), удаляется после анимации; при prefers-reduced-motion не показывается

## Модель данных (localStorage, ключ "sdam-vovremya-v1")
```
{
  v: 1,
  examples: boolean,
  weekFlip: boolean,                       // поменять местами чётные/нечётные недели
  subjects: [{ id, name, color, ex? }],    // color: blue|red|green|amber|violet|teal
  tasks: [{
    id, title, subjectId|null,
    kind,                                  // hw|lab|ref|essay|course|test|coll|credit|exam|project
    due: "YYYY-MM-DD", time: "HH:MM" | "",
    steps: [{ id, text, done }],
    done, doneAt|null, createdAt, ex?
  }],
  classes: [{
    id, subjectId|null, day: 0..6 (0 = пн),
    start: "HH:MM", end: "HH:MM",
    type,                                  // lec|sem|lab|prac|other
    room, weeks: "all"|"odd"|"even", ex?
  }],
  grades: [{ id, subjectId (обязателен), value: 2..5, kind: "cur"|"test"|"exam", date: "YYYY-MM-DD", ex? }],
  sessions: [{ id, subjectId|null, start: ms, minutes: 1..240, ex? }]   // записи таймера
}
```
Удобства (не данные), только в localStorage: `:lang` (ru|uz|en), `:filter`, `:tab`, `:theme` (system|light|dark), `:accent`, `:tconf` (длительности и звук таймера), `:timer` (текущее состояние таймера), `:gtarget`.

## Интерфейс (iOS)
- Таб-бар: Задания / Календарь / Пары / Фокус / Оценки (переменная tab, renderScreen() рисует активный экран). Настройки открываются шестерёнкой в группе кнопок справа вверху (navGroup + gearBtn), «Назад» возвращает на prevTab
- Заголовок: navHeader(title, sub, right, left) — кнопки в верхней строке, крупный заголовок ниже
- Экраны собираются из navHeader() (крупный заголовок), .grp/.sec-h/.list/.row (inset grouped списки), .card
- Шторка снизу: openSheet({title, left, right, html, onOk, onLeft, refresh}); формы внутри — <form data-action="sheetsubmit">
- Подтверждения — только confirmAction() (action sheet), системные confirm/alert не использовать
- Выпадающие списки — только selectHTML(id, options, value): своё стеклянное меню (openMenu/chooseMenu), значение в скрытом input с этим id, при выборе — событие change. Системный <select> не использовать: в тёмной теме на компьютере он нечитаем
- Liquid Glass: класс .glass (размытие + блик + тень), токены --glass-*; плавающий таб-бар, стеклянные кнопки, фильтры, сегменты, шторки, меню, тост
- Карточка задания открывается шторкой (openDetail), правка — openTaskForm, пары — openClassForm, предметы — openSubjectForm

## Что уже работает
- Задания: добавление, изменение, удаление с подтверждением в странице; шаги с прогрессом и планом по дням; «Подсказать шаги» (KIND_STEPS)
- Группы по срочности и hero с обратным отсчётом (обновление раз в 30 секунд, tick())
- Календарь: renderCal(), месячная сетка с Пн, день с 3+ активными сдачами подсвечен, по клику (selDay) — задания дня и «+ Задание на этот день»
- Пары (без примеров, пользователь вносит сам; migrate() удаляет старые пары-примеры): renderSched(), неделя «эта / следующая», строка «сейчас идёт / следующая пара», у пары показываются задания по этому предмету с дедлайном в тот же день; чётность от 1 сентября (semesterWeek, weekInfo), переключатель weekFlip
- Предметы с цветами, фильтр (действует на задания и пары)
- Данные: экспорт в JSON, импорт с проверкой и подтверждением, «Удалить все данные», текст политики
- Примеры при первом запуске (ex: true) и «Убрать примеры»
- Блок window.claude (IN_ARTIFACT) нужен только для версии на claude.ai; вне её всё работает на localStorage

- Тема: applyAppearance() ставит data-theme / data-accent на <html>; MutationObserver не даёт внешнему коду сбить выбранную тему; акцент — токены --tint-light/--tint-dark
- Фокус: timerStart/Pause/Reset/Finish, состояние в localStorage, цикл 250 мс; по окончании фокуса addSession(); после 4 циклов — длинный перерыв; звук через WebAudio (beep)
- Оценки: renderGrades(), шторка предмета openSubjectGrades(sid), новая оценка openNewGrade(); targetInfo() считает, сколько пятёрок нужно до цели

## Языки (i18n) — обязательно соблюдать
- Никакого текста прямо в разметке: только t("ключ", {параметры}). Словарь STR = { ru, en, uz } в app.js; новый ключ добавляй сразу во все три языка
- Числа со словами — через pn(n, "ключ") / pf(n, "ключ"), формы в PL (ru — 3 формы, en — 2, uz — 1, обычно с «ta»: «3 ta fan»)
- Даты и числа — только через F (makeFormats): F.long, F.date, F.dm, F.month, F.num2, F.wd, F.days. Для узбекского названия заданы вручную (UZ), потому что в Chrome/Android нет встроенных узбекских данных
- Типы работ, типы пар, виды оценок, цвета — ключи k.*, ct.*, gk.*, col.*; типовые шаги — STEPS[lang]
- Примеры — EXAMPLES[lang]; у примеров постоянные id (ex-…), relocalizeExamples() переводит их при смене языка. Данные пользователя не переводятся
- Узбекский: латиница, буквы oʻ gʻ через U+02BB (ʻ), тутук через U+02BC (ʼ), вежливое обращение на «siz»
- После правок запускай tests/lang-test.js (ищет русские буквы в английской и узбекской версиях) и tests/android-test.js

## Безопасность — обязательно соблюдать
- Пользовательский текст в innerHTML — только через esc()
- Любые данные извне (localStorage, файл, облако) — только через sanitize(); добавляешь поле — добавь его проверку туда
- Значения, которые попадают в style/атрибуты (цвет, тип, id), сверяй со списками допустимых (COLORS, KIND_KEYS, CLASS_KEYS, ID_RE)
- Соблюдай LIMITS при добавлении записей
- Не подключай сторонние скрипты, CDN, аналитику; новые внешние источники требуют правки CSP и PRIVACY.md — сначала спроси меня
- Никаких eval, new Function, inline-обработчиков (onclick="…") — CSP их блокирует

## Дизайн
Стиль iOS 26 (Liquid Glass): фон #F2F2F7 / #000 с мягкими цветными пятнами, карточки со скруглением 22px, шторки 34px, tint #007AFF, системный шрифт (-apple-system).
Срочность: красный — просрочено, оранжевый — сегодня/завтра, синий — неделя, серый — позже, зелёный — сдано.

## Правила
- Стиль кода: функции render*(), делегирование событий через data-action, commit() после любого изменения данных
- Новые цвета — только токенами, в обе темы
- Вёрстка должна работать на телефоне (~400px), без горизонтальной прокрутки
- Тексты интерфейса по-русски, простым языком
- Перед большой переделкой коротко опиши план и спроси

## Идеи на будущее
Уведомления о дедлайнах, синхронизация между устройствами (Firebase), виджет «сегодня», импорт расписания из таблицы.
