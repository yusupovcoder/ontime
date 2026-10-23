// On Time — логика приложения.
// Данные хранятся в localStorage браузера. Блок с window.claude нужен только
// для версии на claude.ai и вне её просто пропускается.
(() => {
  // ---------- constants ----------
  const DAY = 864e5;
  const LS_KEY = "sdam-vovremya-v1";
  const KIND_LIST = ["hw", "lab", "ref", "essay", "course", "test", "coll", "credit", "exam", "project"];
  const KIND_KEYS = new Set(KIND_LIST);
  const COLORS = ["blue", "red", "green", "amber", "violet", "teal"];
  const CLASS_LIST = ["lec", "sem", "lab", "prac", "other"];
  const CLASS_KEYS = new Set(CLASS_LIST);
  const GRADE_LIST = ["cur", "test", "exam"];
  const GRADE_KIND_KEYS = new Set(GRADE_LIST);
  const TARGETS = ["3.5", "4", "4.5", "4.75", "5"];
  const ACCENTS = ["blue", "indigo", "purple", "pink", "graphite"];
  const PHASES = ["focus", "short", "long"];
  const TCONF_OPTS = { focus: [15, 20, 25, 30, 45, 50, 60, 90], short: [3, 5, 10], long: [10, 15, 20, 30] };
  // Лимиты защищают от переполнения хранилища и от «тяжёлых» файлов при импорте.
  const LIMITS = { subjects: 60, tasks: 3000, steps: 60, classes: 200, grades: 2000, sessions: 3000, importBytes: 2 * 1024 * 1024 };
  const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const IN_ARTIFACT = !!(window.claude && typeof window.claude.use === "function");
  // Android-сборка (Capacitor): мост внедряется самим WebView, без сети и без внешних скриптов.
  const CAP = (() => {
    try {
      const c = window.Capacitor;
      return !IN_ARTIFACT && c && typeof c.isNativePlatform === "function" && c.isNativePlatform() && typeof c.nativePromise === "function" ? c : null;
    } catch { return null; }
  })();
  const hasPlugin = (name) => !!(CAP && Array.isArray(CAP.PluginHeaders) && CAP.PluginHeaders.some((h) => h && h.name === name));
  const native = (plugin, method, opts) => (hasPlugin(plugin) ? CAP.nativePromise(plugin, method, opts || {}) : Promise.reject(new Error("unavailable")));
  const VERSION = "4.1";

  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    tasks: svg('<circle cx="5" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/><path d="M9.5 6h11M9.5 12h11M9.5 18h11"/>'),
    cal: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    sched: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    settings: svg('<path d="M4 7h9M17.5 7H20M4 17h3M11.5 17H20"/><circle cx="15.2" cy="7" r="2.2"/><circle cx="9.2" cy="17" r="2.2"/>'),
    focus: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.6 1.6M9.5 3h5M19 6.5l1.5-1.5"/>'),
    grades: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
    reset: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3.8h3.8"/>'),
    skip: svg('<path d="M6 6l8 6-8 6z"/><path d="M18 6v12"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    chev: svg('<path d="M9 5l7 7-7 7"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    updown: svg('<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    done: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.6 2.6 5-5.3"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>')
  };
  const TABS = [["tasks", ICON.tasks], ["cal", ICON.cal], ["sched", ICON.sched], ["focus", ICON.focus], ["grades", ICON.grades]];

  // ---------- i18n: словарь на трёх языках ----------
  // Ключ → строка. {name} подставляется из параметров. Формы множественного числа — в PL.
  const LANGS = [["ru", "Русский"], ["uz", "Oʻzbekcha"], ["en", "English"]];
  const LOCALE = { ru: "ru-RU", uz: "uz-Latn-UZ", en: "en-US" };
  const PL = {
    ru: {
      day: ["день", "дня", "дней"], task: ["задание", "задания", "заданий"], subject: ["предмет", "предмета", "предметов"],
      class: ["пара", "пары", "пар"], grade: ["оценка", "оценки", "оценок"], due: ["сдача", "сдачи", "сдач"], five: ["пятёрка", "пятёрки", "пятёрок"]
    },
    en: {
      day: ["day", "days"], task: ["task", "tasks"], subject: ["subject", "subjects"],
      class: ["class", "classes"], grade: ["grade", "grades"], due: ["deadline", "deadlines"], five: ["five", "fives"]
    },
    uz: {
      day: ["kun"], task: ["ta topshiriq"], subject: ["ta fan"],
      class: ["ta dars"], grade: ["ta baho"], due: ["ta topshiriq"], five: ["ta «5»"]
    }
  };
  const STR = {
    ru: {
      app: "On Time", "tab.tasks": "Задания", "tab.cal": "Календарь", "tab.sched": "Пары", "tab.focus": "Фокус", "tab.grades": "Оценки",
      settings: "Настройки", sections: "Разделы", loading: "Загружаю…",
      "week.num": "{n}-я неделя, {p}", "week.plain": "{p} неделя", "parity.odd": "нечётная", "parity.even": "чётная",
      "weekTitle.odd": "Нечётная неделя", "weekTitle.even": "Чётная неделя",
      "u.over": "просрочено", "u.overH": "просрочено на {n} ч", "u.overD": "просрочено на {days}", "u.todayHM": "сегодня, осталось {h} ч {m} мин",
      "u.todayM": "сегодня, осталось {m} мин", "u.today": "сегодня", "u.tomorrowFull": "сдать завтра", "u.tomorrow": "завтра", "u.in": "через {days}", "u.done": "сдано",
      "cd.dh": "{d} д {h} ч", "cd.hm": "{h} ч {m} мин", "plan.today": "сегодня", "plan.tomorrow": "завтра", "plan.by": "к {d}",
      "dur.m": "{m} мин", "dur.hm": "{h} ч {m} мин", "dur.h": "{h} ч", "bar.m": "{m} м", "bar.h": "{h} ч", "min": "{m} мин",
      "st.connecting": "Подключаюсь…", "st.saving": "Сохраняю…", "st.saved": "Сохранено в твоём аккаунте, видно только тебе",
      "st.local": "Сохраняется только в этом браузере", "st.error": "Не получилось сохранить. Попробую при следующем изменении.",
      "st.quota": "Место в хранилище закончилось. Удали старые сданные задания.",
      "hero.next": "Ближайший дедлайн", "hero.over": "Уже просрочено", "hero.allDone": "Всё сдано. Можно выдохнуть.", "hero.nothing": "Пока ничего не горит.",
      "hero.steps": "шаги {d} из {n}", "stat.over": "Просрочено", "stat.now": "До завтра", "stat.week": "На неделе",
      "banner.text": "Сейчас здесь примеры, чтобы было видно, как всё работает.", "banner.btn": "Убрать примеры",
      "filter.label": "Фильтр по предметам", "filter.all": "Все",
      "empty.tasks": "Заданий нет", "empty.tasksSubj": "По этому предмету заданий нет",
      "empty.tasksText": "Добавь ближайшую лабу, реферат или экзамен с датой сдачи. Приложение покажет, что горит, и поможет разбить работу на шаги.",
      "btn.newTask": "Новое задание", "g.over": "Просрочено", "g.now": "Сегодня и завтра", "g.week": "Ближайшие 7 дней", "g.later": "Позже", "g.done": "Сдано",
      show: "Показать", hide: "Скрыть", "row.steps": "Шаги: {d} из {n}", "row.markDone": "Отметить сданным", "row.markUndone": "Вернуть в работу",
      "cal.today": "Сегодня", "cal.prev": "Предыдущий месяц", "cal.next": "Следующий месяц", "cal.none": "сдач нет",
      "cal.empty": "В этот день сдач нет", "cal.add": "Добавить задание на этот день",
      "cal.note": "Оранжевое число — три и больше сдачи в один день. Такие дни лучше готовить заранее.",
      "sched.add": "Добавить пару", "sched.emptyTitle": "Расписания пока нет",
      "sched.emptyText": "Когда появится расписание, внеси пары один раз. Здесь будет видно, какая пара сейчас, где она проходит и что по этому предмету скоро сдавать.",
      "sched.week": "Неделя", "sched.this": "Эта неделя", "sched.nextWeek": "Следующая", "sched.nowOn": "Сейчас идёт", "sched.nextClass": "Следующая пара",
      "sched.todayCap": "Сегодня", "sched.over": "Пары закончились", "sched.noneToday": "Пар нет", "sched.until": "до {t}, ещё {d}", "sched.at": "в {t}, через {d}",
      "sched.todaySuffix": " · сегодня", "sched.noneWeek": "На этой неделе пар нет", "sched.none": "Пар нет", "sched.now": "идёт",
      "sched.oddOnly": "по нечётным", "sched.evenOnly": "по чётным", "sched.due": "Сдать: {t}", "sched.dueBy": " до {time}",
      "sched.note": "Чётность считается от 1 сентября. Если в твоём вузе наоборот, поменяй её в настройках.",
      back: "Назад", "set.clearex": "Убрать примеры", "set.clearexNote": "Примеры заданий, оценок и занятий показывают, как работает приложение. Твои данные останутся.",
      "set.lang": "Язык", "set.appearance": "Оформление", "set.theme": "Тема", "theme.light": "Светлая", "theme.dark": "Тёмная", "theme.auto": "Авто",
      "set.accent": "Акцент", "set.accentLabel": "Цвет акцента", "set.autoNote": "«Авто» следует теме устройства{x}.", "set.autoClaude": " или claude.ai",
      "acc.blue": "Синий", "acc.indigo": "Индиго", "acc.purple": "Фиолетовый", "acc.pink": "Розовый", "acc.graphite": "Графит",
      "set.subjects": "Предметы", "set.delSubj": "Удалить предмет {n}", "set.addSubj": "Добавить предмет",
      "set.weeks": "Недели", "set.flip": "Поменять чётные и нечётные",
      "set.flipNote": "Сейчас {p} неделя. Чётность считается от 1 сентября. Если в твоём вузе наоборот, включи переключатель.",
      "set.focus": "Фокус", "set.focusLen": "Фокус", "set.short": "Перерыв", "set.long": "Длинный перерыв", "set.sound": "Звук по окончании",
      "set.focusNote": "Длинный перерыв — после каждых четырёх циклов фокуса.",
      "set.notif": "Уведомления", "set.notifOn": "Напоминать о сдачах", "set.notifEve": "Накануне", "set.notifMorn": "В день сдачи",
      "set.notifBefore": "До срока", "set.notifTimer": "Конец фокуса и перерыва", "set.off": "Выкл.", "set.at": "в {t}", "set.before": "за {d}",
      "set.notifNote": "Напоминания приходят только по несданным заданиям. «До срока» — для заданий, у которых указано время.",
      "set.notifExact": "Точное время уведомлений", "set.notifExactNote": "Сейчас Android может присылать уведомления с опозданием на несколько минут. Нажми, чтобы разрешить точное время.",
      "n.tomorrow": "Сдать завтра", "n.tomorrowAt": "Сдать завтра до {t}", "n.today": "Сдать сегодня", "n.todayAt": "Сдать сегодня до {t}",
      "n.soon": "До сдачи осталось {d}", "n.focusEnd": "Фокус окончен", "n.focusEndB": "Пора сделать перерыв.",
      "n.breakEnd": "Перерыв окончен", "n.breakEndB": "Пора вернуться к делу.", "ch.deadlines": "Сдачи заданий", "ch.timer": "Таймер",
      "set.whereApp": "Данные хранятся только в памяти этого телефона и никуда не отправляются.", "st.app": "Сохраняется только на этом телефоне", "set.update": "Обновления", "set.build": "Версия {v} · сборка {b}", "set.checkUpd": "Проверить обновление", "set.autoUpd": "Проверять при запуске",
      "set.updNote": "Приложение спрашивает у GitHub только номер последней версии. Ничего о тебе и твоих заданиях не отправляется.",
      "upd.checking": "Проверяю…", "upd.latest": "У тебя последняя версия.", "upd.latestShort": "Последняя", "upd.avail": "Вышла новая версия — сборка {b}",
      "upd.get": "Скачать и установить", "upd.later": "Позже", "upd.fail": "Не удалось проверить. Нужен интернет.", "upd.failShort": "Нет связи",
      "upd.how": "Открой скачанный файл и нажми «Обновить». Задания сохранятся.",
      "t.notifOn": "Напоминания включены.", "t.notifDenied": "Уведомления запрещены. Разреши их в настройках телефона.",
      "set.data": "Данные", "set.export": "Скачать резервную копию", "set.import": "Загрузить из файла", "set.wipe": "Удалить все данные",
      "set.whereCloud": "Данные хранятся в твоём аккаунте Claude, в личном разделе этого приложения. Видишь их только ты.",
      "set.whereLocal": "Данные хранятся только в этом браузере на этом устройстве и никуда не отправляются.",
      "set.privacy": "Конфиденциальность", "set.policy": "Политика конфиденциальности", "set.version": "{app} · версия {v}",
      cancel: "Отмена", close: "Закрыть", edit: "Изменить", done: "Готово", add: "Добавить",
      "detail.title": "Задание", "detail.deleted": "Задание удалено", "detail.due": "Сдать: {d}", "detail.steps": "Шаги", "detail.stepsOf": "Шаги · {d} из {n}",
      "detail.delStep": "Удалить шаг {s}", "detail.newStep": "Новый шаг",
      "detail.planNote": "Справа — план, к какому дню сделать шаг. Оставшиеся шаги разложены равномерно до срока.",
      "detail.splitNote": "Большую работу проще сдать по частям.", "detail.suggest": "Подсказать типовые шаги", "detail.delete": "Удалить задание",
      "form.edit": "Изменить", "form.new": "Новое задание", "form.what": "Что сдать", "form.errTitle": "Напиши, что нужно сдать.",
      "form.subject": "Предмет", "form.noSubject": "Без предмета", "form.newSubject": "Новый предмет…", "form.newSubjName": "Название нового предмета",
      "form.kind": "Тип работы", "form.due": "Срок", "form.time": "Время", "form.errDate": "Укажи дату сдачи.", "form.steps": "Шаги", "form.suggest": "Подсказать",
      "form.stepsPh": "По одному в строке", "form.stepsAria": "Шаги, по одному в строке",
      "form.suggestNote": "«Подсказать» добавит типовые этапы для выбранного типа работы.",
      "t.needSubjName": "Напиши название нового предмета.", "t.tooManyTasks": "Слишком много заданий. Удали старые сданные.", "t.saved": "Сохранено.",
      "t.addedPast": "Добавлено. Срок уже прошёл.", "t.addedToday": "Добавлено. Сдавать сегодня!", "t.addedIn": "Добавлено. До сдачи {days}.",
      "class.new": "Новая пара", "class.edit": "Пара", "class.subjName": "Название предмета", "class.type": "Тип", "class.day": "День", "class.weeks": "Недели",
      "weeks.all": "Каждую", "weeks.odd": "Нечётные", "weeks.even": "Чётные", "class.start": "Начало", "class.end": "Конец",
      "class.errTime": "Конец пары должен быть позже начала.", "class.room": "Аудитория, например 305", "class.roomAria": "Аудитория", "class.delete": "Удалить пару",
      "t.needName": "Напиши название предмета.", "t.tooManyClasses": "Пар может быть не больше {n}.", "t.classSaved": "Пара сохранена.",
      "t.classAdded": "Пара добавлена: {day}, {t}.", "c.delClass": "Удалить эту пару из расписания?", "t.classDeleted": "Пара удалена.",
      "subj.new": "Новый предмет", "subj.namePh": "Название, например Философия", "subj.nameAria": "Название предмета", "subj.color": "Цвет", "subj.colorAria": "Цвет предмета",
      "col.blue": "синий", "col.red": "красный", "col.green": "зелёный", "col.amber": "оранжевый", "col.violet": "фиолетовый", "col.teal": "бирюзовый",
      "t.dupSubj": "Такой предмет уже есть.", "t.tooManySubj": "Предметов может быть не больше {n}.", "t.subjAdded": "Предмет «{n}» добавлен.",
      "c.delSubj": "Удалить предмет «{n}»?", "c.delSubjMsg": "Задания и пары останутся, но без предмета. Оценки по нему удалятся.", "btn.delSubj": "Удалить предмет",
      "t.subjDeleted": "Предмет удалён.",
      "t.dlUnavailable": "Скачивание недоступно в этом окне. Открой приложение на claude.ai в браузере.", "t.backupSaved": "Резервная копия сохранена.",
      "t.saveFailLater": "Не получилось сохранить файл. Попробуй ещё раз чуть позже.", "t.saveFail": "Не получилось сохранить файл.",
      "t.tooBig": "Файл слишком большой. Резервная копия обычно весит меньше 1 МБ.", "t.badFile": "Это не похоже на резервную копию: файл не читается.",
      "t.emptyFile": "В файле не нашлось заданий, предметов или пар.", "c.import": "Заменить данные из файла?", "c.importMsg": "В файле {parts}. Текущие данные пропадут.",
      "c.importBtn": "Заменить", "t.imported": "Данные загружены из файла.",
      "t.doneLeft": "Сдано! В работе ещё {tasks}.", "t.doneAll": "Сдано! Больше ничего не висит.", "t.exRemoved": "Примеры убраны.",
      "t.parity": "Готово: эта неделя теперь {p}.", "t.allSteps": "Все шаги готовы. Отметь задание сданным, когда сдашь.",
      "t.maxSteps": "В одном задании может быть не больше {n} шагов.", "c.delTask": "Удалить «{t}»?", "c.delTaskMsg": "Задание удалится вместе с шагами.",
      "t.taskDeleted": "Задание удалено.", "c.wipe": "Удалить все задания, предметы и пары?",
      "c.wipeMsg": "Это нельзя отменить. Если сомневаешься, сначала скачай резервную копию.", "c.wipeBtn": "Удалить всё", "t.wiped": "Все данные удалены.",
      "policy.title": "Конфиденциальность",
      "focus.today": "Сегодня {d}", "focus.todayNone": "Сегодня ещё не занимался", "focus.endsAt": "закончится в {t}", "focus.paused": "на паузе",
      "focus.cycle": "цикл {c} из 4", "ph.focus": "Фокус", "ph.short": "Перерыв", "ph.long": "Длинный перерыв", "ph.longShort": "Длинный",
      "focus.mode": "Режим", "focus.subject": "Предмет", "focus.reset": "Сбросить", "focus.skip": "Пропустить этап", "focus.start": "Начать",
      "focus.pause": "Пауза", "focus.resume": "Продолжить", "focus.rest": "Отдохнуть", "focus.week": "Эта неделя", "focus.bySubj": "По предметам",
      "focus.none": "На этой неделе занятий ещё не было. Запусти таймер — время запишется само.",
      "focus.note": "Помодоро: {f} мин работы, {s} мин отдыха, после четырёх циклов — {l} мин. Длительность меняется в настройках.",
      "focus.done": "Фокус завершён: {m} мин{s}. Время отдохнуть.", "focus.skipped": "Цикл пропущен, время не записано.",
      "focus.breakOver": "Перерыв окончен. Можно продолжать.", "focus.breakSkipped": "Перерыв пропущен.",
      "c.skip": "Пропустить этот цикл?", "c.skipMsg": "Время этого цикла не запишется в статистику.", "c.skipBtn": "Пропустить",
      "gr.new": "Новая оценка", "gr.needSubjTitle": "Сначала добавь предмет", "gr.needSubjText": "Оценки ставятся по предметам. Добавь первый, например «Матанализ».",
      "gr.emptyTitle": "Оценок пока нет",
      "gr.emptyText": "Добавляй оценки по предметам. Приложение посчитает средний балл и подскажет, сколько пятёрок нужно до цели.",
      "gr.addBtn": "Добавить оценку", "gr.avg": "Средний балл", "gr.noThrees": "Без троек", "gr.threes": "Троек: {n}", "gr.twos": "Двоек: {n}", "gr.exams": "Экзамены: {a}",
      "gr.subjects": "Предметы", "gr.noneYet": "Оценок пока нет",
      "gr.note": "Нажми на предмет, чтобы поставить оценку и посчитать, сколько пятёрок нужно до цели. Экзамены обведены рамкой.",
      "gr.put": "Поставить {v}", "gr.kind": "Тип", "gr.date": "Дата", "gk.cur": "Текущая", "gk.test": "Контрольная", "gk.exam": "Экзамен",
      "gr.subjDeleted": "Предмет удалён", "gr.putTitle": "Поставить оценку", "gr.list": "Оценки", "gr.listEmpty": "Здесь появятся оценки",
      "gr.listNote": "Нажми на оценку, чтобы удалить её. Экзамены обведены рамкой.", "gr.delAria": "Удалить оценку {v}, {k}, {d}",
      "gr.goal": "Цель", "gr.want": "Хочу средний", "tg.first": "Поставь первую оценку, и здесь появится расчёт.", "tg.reached": "Цель уже достигнута.",
      "tg.impossible": "Средний 5,0 уже недостижим: есть оценки ниже пятёрки.", "tg.need": "Нужно ещё {n} {w} подряд.",
      "gr.pickNote": "Нажми на оценку, чтобы сохранить её.", "gr.gradeTitle": "Оценка", "t.needSubjFirst": "Сначала добавь предмет.",
      "t.tooManyGrades": "Слишком много оценок. Удали старые.", "t.gradeAdded": "Оценка {v} по предмету «{s}» добавлена.",
      "c.delGrade": "Удалить оценку {v}?", "btn.delGrade": "Удалить оценку", "t.gradeDeleted": "Оценка удалена.",
      "k.hw": "Домашка", "k.lab": "Лабораторная", "k.ref": "Реферат", "k.essay": "Эссе", "k.course": "Курсовая", "k.test": "Контрольная",
      "k.coll": "Коллоквиум", "k.credit": "Зачёт", "k.exam": "Экзамен", "k.project": "Проект",
      "ct.lec": "Лекция", "ct.sem": "Семинар", "ct.lab": "Лабораторная", "ct.prac": "Практика", "ct.other": "Другое"
    },
    en: {
      app: "On Time", "tab.tasks": "Tasks", "tab.cal": "Calendar", "tab.sched": "Classes", "tab.focus": "Focus", "tab.grades": "Grades",
      settings: "Settings", sections: "Sections", loading: "Loading…",
      "week.num": "Week {n}, {p}", "week.plain": "{P} week", "parity.odd": "odd", "parity.even": "even",
      "weekTitle.odd": "Odd week", "weekTitle.even": "Even week",
      "u.over": "overdue", "u.overH": "overdue by {n} h", "u.overD": "overdue by {days}", "u.todayHM": "today, {h} h {m} min left",
      "u.todayM": "today, {m} min left", "u.today": "today", "u.tomorrowFull": "due tomorrow", "u.tomorrow": "tomorrow", "u.in": "in {days}", "u.done": "done",
      "cd.dh": "{d}d {h}h", "cd.hm": "{h}h {m}m", "plan.today": "today", "plan.tomorrow": "tomorrow", "plan.by": "by {d}",
      "dur.m": "{m} min", "dur.hm": "{h} h {m} min", "dur.h": "{h} h", "bar.m": "{m}m", "bar.h": "{h}h", "min": "{m} min",
      "st.connecting": "Connecting…", "st.saving": "Saving…", "st.saved": "Saved to your account, visible only to you",
      "st.local": "Saved only in this browser", "st.error": "Couldn't save. Will retry on the next change.",
      "st.quota": "Storage is full. Delete old completed tasks.",
      "hero.next": "Next deadline", "hero.over": "Already overdue", "hero.allDone": "All done. You can relax.", "hero.nothing": "Nothing urgent yet.",
      "hero.steps": "steps {d} of {n}", "stat.over": "Overdue", "stat.now": "By tomorrow", "stat.week": "This week",
      "banner.text": "These are examples to show how everything works.", "banner.btn": "Remove examples",
      "filter.label": "Filter by subject", "filter.all": "All",
      "empty.tasks": "No tasks", "empty.tasksSubj": "No tasks for this subject",
      "empty.tasksText": "Add your next lab, essay or exam with its due date. The app will show what's urgent and help you break the work into steps.",
      "btn.newTask": "New task", "g.over": "Overdue", "g.now": "Today & tomorrow", "g.week": "Next 7 days", "g.later": "Later", "g.done": "Done",
      show: "Show", hide: "Hide", "row.steps": "Steps: {d} of {n}", "row.markDone": "Mark as done", "row.markUndone": "Mark as not done",
      "cal.today": "Today", "cal.prev": "Previous month", "cal.next": "Next month", "cal.none": "no deadlines",
      "cal.empty": "No deadlines on this day", "cal.add": "Add a task for this day",
      "cal.note": "An orange date means three or more deadlines on one day. Start preparing for those days early.",
      "sched.add": "Add class", "sched.emptyTitle": "No schedule yet",
      "sched.emptyText": "Once you have your timetable, add your classes once. You'll see which class is on now, where it is, and what's due soon for that subject.",
      "sched.week": "Week", "sched.this": "This week", "sched.nextWeek": "Next week", "sched.nowOn": "Happening now", "sched.nextClass": "Next class",
      "sched.todayCap": "Today", "sched.over": "Classes are over", "sched.noneToday": "No classes", "sched.until": "until {t}, {d} left", "sched.at": "at {t}, in {d}",
      "sched.todaySuffix": " · today", "sched.noneWeek": "No classes this week", "sched.none": "No classes", "sched.now": "now",
      "sched.oddOnly": "odd weeks", "sched.evenOnly": "even weeks", "sched.due": "Due: {t}", "sched.dueBy": " by {time}",
      "sched.note": "Week parity is counted from September 1. If your university counts the other way, change it in Settings.",
      back: "Back", "set.clearex": "Remove examples", "set.clearexNote": "Example tasks, grades and study sessions show how the app works. Your own data will stay.",
      "set.lang": "Language", "set.appearance": "Appearance", "set.theme": "Theme", "theme.light": "Light", "theme.dark": "Dark", "theme.auto": "Auto",
      "set.accent": "Accent", "set.accentLabel": "Accent color", "set.autoNote": "“Auto” follows your device theme{x}.", "set.autoClaude": " or claude.ai",
      "acc.blue": "Blue", "acc.indigo": "Indigo", "acc.purple": "Purple", "acc.pink": "Pink", "acc.graphite": "Graphite",
      "set.subjects": "Subjects", "set.delSubj": "Delete subject {n}", "set.addSubj": "Add subject",
      "set.weeks": "Weeks", "set.flip": "Swap odd and even weeks",
      "set.flipNote": "This is an {p} week. Parity is counted from September 1. If your university counts the other way, turn this on.",
      "set.focus": "Focus", "set.focusLen": "Focus", "set.short": "Break", "set.long": "Long break", "set.sound": "Sound when finished",
      "set.focusNote": "A long break comes after every four focus cycles.",
      "set.notif": "Notifications", "set.notifOn": "Deadline reminders", "set.notifEve": "The day before", "set.notifMorn": "On the due day",
      "set.notifBefore": "Before the deadline", "set.notifTimer": "End of focus and breaks", "set.off": "Off", "set.at": "at {t}", "set.before": "{d} before",
      "set.notifNote": "Reminders are only sent for unfinished tasks. “Before the deadline” works for tasks with a set time.",
      "set.notifExact": "Exact notification times", "set.notifExactNote": "Right now Android may deliver notifications a few minutes late. Tap to allow exact times.",
      "n.tomorrow": "Due tomorrow", "n.tomorrowAt": "Due tomorrow at {t}", "n.today": "Due today", "n.todayAt": "Due today at {t}",
      "n.soon": "{d} left until the deadline", "n.focusEnd": "Focus finished", "n.focusEndB": "Time for a break.",
      "n.breakEnd": "Break is over", "n.breakEndB": "Time to get back to work.", "ch.deadlines": "Deadlines", "ch.timer": "Timer",
      "set.whereApp": "Your data is stored only on this phone and is never sent anywhere.", "st.app": "Saved only on this phone", "set.update": "Updates", "set.build": "Version {v} · build {b}", "set.checkUpd": "Check for updates", "set.autoUpd": "Check on launch",
      "set.updNote": "The app only asks GitHub for the latest version number. Nothing about you or your tasks is sent.",
      "upd.checking": "Checking…", "upd.latest": "You have the latest version.", "upd.latestShort": "Up to date", "upd.avail": "A new version is out — build {b}",
      "upd.get": "Download and install", "upd.later": "Later", "upd.fail": "Couldn't check. An internet connection is needed.", "upd.failShort": "Offline",
      "upd.how": "Open the downloaded file and tap “Update”. Your tasks will stay.",
      "t.notifOn": "Reminders are on.", "t.notifDenied": "Notifications are blocked. Allow them in your phone settings.",
      "set.data": "Data", "set.export": "Download backup", "set.import": "Restore from file", "set.wipe": "Delete all data",
      "set.whereCloud": "Your data is stored in your Claude account, in this app's private section. Only you can see it.",
      "set.whereLocal": "Your data is stored only in this browser on this device and is never sent anywhere.",
      "set.privacy": "Privacy", "set.policy": "Privacy policy", "set.version": "{app} · version {v}",
      cancel: "Cancel", close: "Close", edit: "Edit", done: "Done", add: "Add",
      "detail.title": "Task", "detail.deleted": "Task deleted", "detail.due": "Due: {d}", "detail.steps": "Steps", "detail.stepsOf": "Steps · {d} of {n}",
      "detail.delStep": "Delete step {s}", "detail.newStep": "New step",
      "detail.planNote": "On the right is a plan for which day to finish each step. Remaining steps are spread evenly until the due date.",
      "detail.splitNote": "Big assignments are easier in parts.", "detail.suggest": "Suggest typical steps", "detail.delete": "Delete task",
      "form.edit": "Edit task", "form.new": "New task", "form.what": "What's due", "form.errTitle": "Enter what's due.",
      "form.subject": "Subject", "form.noSubject": "No subject", "form.newSubject": "New subject…", "form.newSubjName": "New subject name",
      "form.kind": "Type", "form.due": "Due date", "form.time": "Time", "form.errDate": "Choose a due date.", "form.steps": "Steps", "form.suggest": "Suggest",
      "form.stepsPh": "One per line", "form.stepsAria": "Steps, one per line",
      "form.suggestNote": "“Suggest” adds typical steps for the selected type.",
      "t.needSubjName": "Enter a name for the new subject.", "t.tooManyTasks": "Too many tasks. Delete old completed ones.", "t.saved": "Saved.",
      "t.addedPast": "Added. The due date has already passed.", "t.addedToday": "Added. Due today!", "t.addedIn": "Added. Due in {days}.",
      "class.new": "New class", "class.edit": "Class", "class.subjName": "Subject name", "class.type": "Type", "class.day": "Day", "class.weeks": "Weeks",
      "weeks.all": "Every week", "weeks.odd": "Odd", "weeks.even": "Even", "class.start": "Start", "class.end": "End",
      "class.errTime": "The end must be later than the start.", "class.room": "Room, e.g. 305", "class.roomAria": "Room", "class.delete": "Delete class",
      "t.needName": "Enter a subject name.", "t.tooManyClasses": "You can have at most {n} classes.", "t.classSaved": "Class saved.",
      "t.classAdded": "Class added: {day}, {t}.", "c.delClass": "Remove this class from the schedule?", "t.classDeleted": "Class deleted.",
      "subj.new": "New subject", "subj.namePh": "Name, e.g. Philosophy", "subj.nameAria": "Subject name", "subj.color": "Color", "subj.colorAria": "Subject color",
      "col.blue": "blue", "col.red": "red", "col.green": "green", "col.amber": "orange", "col.violet": "purple", "col.teal": "teal",
      "t.dupSubj": "This subject already exists.", "t.tooManySubj": "You can have at most {n} subjects.", "t.subjAdded": "Subject “{n}” added.",
      "c.delSubj": "Delete subject “{n}”?", "c.delSubjMsg": "Tasks and classes will stay without a subject. Its grades will be deleted.", "btn.delSubj": "Delete subject",
      "t.subjDeleted": "Subject deleted.",
      "t.dlUnavailable": "Downloads aren't available here. Open the app on claude.ai in a browser.", "t.backupSaved": "Backup saved.",
      "t.saveFailLater": "Couldn't save the file. Try again a bit later.", "t.saveFail": "Couldn't save the file.",
      "t.tooBig": "The file is too large. A backup is usually under 1 MB.", "t.badFile": "This doesn't look like a backup: the file can't be read.",
      "t.emptyFile": "The file has no tasks, subjects or classes.", "c.import": "Replace data from the file?", "c.importMsg": "The file contains {parts}. Your current data will be replaced.",
      "c.importBtn": "Replace", "t.imported": "Data restored from the file.",
      "t.doneLeft": "Done! {tasks} left.", "t.doneAll": "Done! Nothing left.", "t.exRemoved": "Examples removed.",
      "t.parity": "Done: this week is now {p}.", "t.allSteps": "All steps done. Mark the task as done once you hand it in.",
      "t.maxSteps": "A task can have at most {n} steps.", "c.delTask": "Delete “{t}”?", "c.delTaskMsg": "The task will be deleted with its steps.",
      "t.taskDeleted": "Task deleted.", "c.wipe": "Delete all tasks, subjects and classes?",
      "c.wipeMsg": "This can't be undone. If unsure, download a backup first.", "c.wipeBtn": "Delete all", "t.wiped": "All data deleted.",
      "policy.title": "Privacy",
      "focus.today": "Today {d}", "focus.todayNone": "No study yet today", "focus.endsAt": "ends at {t}", "focus.paused": "paused",
      "focus.cycle": "cycle {c} of 4", "ph.focus": "Focus", "ph.short": "Break", "ph.long": "Long break", "ph.longShort": "Long",
      "focus.mode": "Mode", "focus.subject": "Subject", "focus.reset": "Reset", "focus.skip": "Skip", "focus.start": "Start",
      "focus.pause": "Pause", "focus.resume": "Resume", "focus.rest": "Start break", "focus.week": "This week", "focus.bySubj": "By subject",
      "focus.none": "No study sessions this week yet. Start the timer and your time will be recorded automatically.",
      "focus.note": "Pomodoro: {f} min of work, {s} min of rest, and {l} min after four cycles. Change durations in Settings.",
      "focus.done": "Focus complete: {m} min{s}. Time for a break.", "focus.skipped": "Cycle skipped, time not recorded.",
      "focus.breakOver": "Break's over. Back to it.", "focus.breakSkipped": "Break skipped.",
      "c.skip": "Skip this cycle?", "c.skipMsg": "This cycle's time won't be added to your stats.", "c.skipBtn": "Skip",
      "gr.new": "New grade", "gr.needSubjTitle": "Add a subject first", "gr.needSubjText": "Grades belong to subjects. Add your first one, e.g. “Calculus”.",
      "gr.emptyTitle": "No grades yet",
      "gr.emptyText": "Add grades by subject. The app will calculate your average and tell you how many 5s you need to reach your goal.",
      "gr.addBtn": "Add grade", "gr.avg": "Average", "gr.noThrees": "No 3s", "gr.threes": "3s: {n}", "gr.twos": "2s: {n}", "gr.exams": "Exams: {a}",
      "gr.subjects": "Subjects", "gr.noneYet": "No grades yet",
      "gr.note": "Tap a subject to add a grade and see how many 5s you need to reach your goal. Exams have an outline.",
      "gr.put": "Add a {v}", "gr.kind": "Type", "gr.date": "Date", "gk.cur": "Regular", "gk.test": "Test", "gk.exam": "Exam",
      "gr.subjDeleted": "Subject deleted", "gr.putTitle": "Add a grade", "gr.list": "Grades", "gr.listEmpty": "Your grades will appear here",
      "gr.listNote": "Tap a grade to delete it. Exams have an outline.", "gr.delAria": "Delete grade {v}, {k}, {d}",
      "gr.goal": "Goal", "gr.want": "Target average", "tg.first": "Add your first grade to see the calculation.", "tg.reached": "Goal already reached.",
      "tg.impossible": "An average of 5.0 is no longer possible: there are grades below 5.", "tg.need": "You need {n} more {w} in a row.",
      "gr.pickNote": "Tap a grade to save it.", "gr.gradeTitle": "Grade", "t.needSubjFirst": "Add a subject first.",
      "t.tooManyGrades": "Too many grades. Delete old ones.", "t.gradeAdded": "Grade {v} added to “{s}”.",
      "c.delGrade": "Delete grade {v}?", "btn.delGrade": "Delete grade", "t.gradeDeleted": "Grade deleted.",
      "k.hw": "Homework", "k.lab": "Lab", "k.ref": "Report", "k.essay": "Essay", "k.course": "Term paper", "k.test": "Test",
      "k.coll": "Oral exam", "k.credit": "Pass/fail test", "k.exam": "Exam", "k.project": "Project",
      "ct.lec": "Lecture", "ct.sem": "Seminar", "ct.lab": "Lab", "ct.prac": "Practice", "ct.other": "Other"
    },
    uz: {
      app: "On Time", "tab.tasks": "Topshiriqlar", "tabbar.tasks": "Vazifalar", "tab.cal": "Taqvim", "tab.sched": "Darslar", "tab.focus": "Fokus", "tab.grades": "Baholar",
      settings: "Sozlamalar", sections: "Boʻlimlar", loading: "Yuklanmoqda…",
      "week.num": "{n}-hafta, {p}", "week.plain": "{P} hafta", "parity.odd": "toq", "parity.even": "juft",
      "weekTitle.odd": "Toq hafta", "weekTitle.even": "Juft hafta",
      "u.over": "kechikkan", "u.overH": "{n} soat kechikdi", "u.overD": "{days} kechikdi", "u.todayHM": "bugun, {h} soat {m} daq qoldi",
      "u.todayM": "bugun, {m} daq qoldi", "u.today": "bugun", "u.tomorrowFull": "ertaga topshirish", "u.tomorrow": "ertaga", "u.in": "{days}dan keyin", "u.done": "topshirildi",
      "cd.dh": "{d} kun {h} soat", "cd.hm": "{h} soat {m} daq", "plan.today": "bugun", "plan.tomorrow": "ertaga", "plan.by": "{d} gacha",
      "dur.m": "{m} daq", "dur.hm": "{h} soat {m} daq", "dur.h": "{h} soat", "bar.m": "{m} daq", "bar.h": "{h} soat", "min": "{m} daq",
      "st.connecting": "Ulanmoqda…", "st.saving": "Saqlanmoqda…", "st.saved": "Hisobingizda saqlandi, faqat sizga koʻrinadi",
      "st.local": "Faqat shu brauzerda saqlanadi", "st.error": "Saqlab boʻlmadi. Keyingi oʻzgarishda yana urinib koʻraman.",
      "st.quota": "Xotira toʻldi. Eski topshirilgan topshiriqlarni oʻchiring.",
      "hero.next": "Eng yaqin muddat", "hero.over": "Muddati oʻtib ketgan", "hero.allDone": "Hammasi topshirildi. Dam olsangiz boʻladi.", "hero.nothing": "Hozircha shoshilinch ish yoʻq.",
      "hero.steps": "qadamlar {d}/{n}", "stat.over": "Kechikkan", "stat.now": "Ertagacha", "stat.week": "Shu hafta",
      "banner.text": "Bu yerda ilova qanday ishlashini koʻrsatuvchi namunalar.", "banner.btn": "Namunalarni olib tashlash",
      "filter.label": "Fanlar boʻyicha saralash", "filter.all": "Hammasi",
      "empty.tasks": "Topshiriqlar yoʻq", "empty.tasksSubj": "Bu fan boʻyicha topshiriq yoʻq",
      "empty.tasksText": "Eng yaqin laboratoriya ishi, referat yoki imtihonni muddati bilan qoʻshing. Ilova shoshilinch ishlarni koʻrsatadi va ishni qadamlarga boʻlishga yordam beradi.",
      "btn.newTask": "Yangi topshiriq", "g.over": "Muddati oʻtgan", "g.now": "Bugun va ertaga", "g.week": "Yaqin 7 kun", "g.later": "Keyinroq", "g.done": "Topshirilgan",
      show: "Koʻrsatish", hide: "Yashirish", "row.steps": "Qadamlar: {d}/{n}", "row.markDone": "Topshirildi deb belgilash", "row.markUndone": "Qayta ishga qaytarish",
      "cal.today": "Bugun", "cal.prev": "Oldingi oy", "cal.next": "Keyingi oy", "cal.none": "topshiriq yoʻq",
      "cal.empty": "Bu kunda topshiriq yoʻq", "cal.add": "Shu kunga topshiriq qoʻshish",
      "cal.note": "Toʻq sariq raqam — bir kunda uch va undan ortiq topshiriq. Bunday kunlarga oldindan tayyorlaning.",
      "sched.add": "Dars qoʻshish", "sched.emptyTitle": "Hozircha dars jadvali yoʻq",
      "sched.emptyText": "Dars jadvalingiz paydo boʻlgach, darslarni bir marta kiriting. Bu yerda hozir qaysi dars, qayerda boʻlayotgani va shu fan boʻyicha nimani topshirish kerakligi koʻrinadi.",
      "sched.week": "Hafta", "sched.this": "Shu hafta", "sched.nextWeek": "Keyingi hafta", "sched.nowOn": "Hozir davom etmoqda", "sched.nextClass": "Keyingi dars",
      "sched.todayCap": "Bugun", "sched.over": "Darslar tugadi", "sched.noneToday": "Darslar yoʻq", "sched.until": "{t} gacha, yana {d}", "sched.at": "soat {t} da, {d}dan keyin",
      "sched.todaySuffix": " · bugun", "sched.noneWeek": "Bu hafta darslar yoʻq", "sched.none": "Darslar yoʻq", "sched.now": "hozir",
      "sched.oddOnly": "toq haftalar", "sched.evenOnly": "juft haftalar", "sched.due": "Topshirish: {t}", "sched.dueBy": ", soat {time} gacha",
      "sched.note": "Hafta juftligi 1-sentabrdan hisoblanadi. Agar oliygohingizda aksincha boʻlsa, sozlamalarda oʻzgartiring.",
      back: "Orqaga", "set.clearex": "Namunalarni olib tashlash", "set.clearexNote": "Topshiriq, baho va mashgʻulot namunalari ilova qanday ishlashini koʻrsatadi. Oʻz maʼlumotlaringiz saqlanib qoladi.",
      "set.lang": "Til", "set.appearance": "Koʻrinish", "set.theme": "Mavzu", "theme.light": "Yorugʻ", "theme.dark": "Qorongʻi", "theme.auto": "Avto",
      "set.accent": "Urgʻu rangi", "set.accentLabel": "Urgʻu rangi", "set.autoNote": "«Avto» qurilma mavzusiga moslashadi{x}.", "set.autoClaude": " yoki claude.ai",
      "acc.blue": "Koʻk", "acc.indigo": "Indigo", "acc.purple": "Binafsha", "acc.pink": "Pushti", "acc.graphite": "Grafit",
      "set.subjects": "Fanlar", "set.delSubj": "{n} fanini oʻchirish", "set.addSubj": "Fan qoʻshish",
      "set.weeks": "Haftalar", "set.flip": "Juft va toq haftalarni almashtirish",
      "set.flipNote": "Hozir {p} hafta. Juftlik 1-sentabrdan hisoblanadi. Agar oliygohingizda aksincha boʻlsa, buni yoqing.",
      "set.focus": "Fokus", "set.focusLen": "Fokus", "set.short": "Tanaffus", "set.long": "Uzun tanaffus", "set.sound": "Tugaganda ovoz",
      "set.focusNote": "Uzun tanaffus har toʻrt fokus siklidan keyin boʻladi.",
      "set.notif": "Bildirishnomalar", "set.notifOn": "Topshirish muddatini eslatish", "set.notifEve": "Bir kun oldin", "set.notifMorn": "Topshirish kuni",
      "set.notifBefore": "Muddatdan oldin", "set.notifTimer": "Fokus va tanaffus tugashi", "set.off": "Oʻchiq", "set.at": "soat {t} da", "set.before": "{d} oldin",
      "set.notifNote": "Eslatmalar faqat topshirilmagan vazifalar uchun keladi. «Muddatdan oldin» — vaqti koʻrsatilgan vazifalar uchun.",
      "set.notifExact": "Bildirishnomalarning aniq vaqti", "set.notifExactNote": "Hozir Android bildirishnomalarni bir necha daqiqa kechiktirib yuborishi mumkin. Aniq vaqtga ruxsat berish uchun bosing.",
      "n.tomorrow": "Ertaga topshirish kerak", "n.tomorrowAt": "Ertaga soat {t} gacha topshirish kerak", "n.today": "Bugun topshirish kerak", "n.todayAt": "Bugun soat {t} gacha topshirish kerak",
      "n.soon": "Topshirishga {d} qoldi", "n.focusEnd": "Fokus tugadi", "n.focusEndB": "Tanaffus qilish vaqti.",
      "n.breakEnd": "Tanaffus tugadi", "n.breakEndB": "Ishga qaytish vaqti.", "ch.deadlines": "Topshirish muddatlari", "ch.timer": "Taymer",
      "set.whereApp": "Maʼlumotlar faqat shu telefon xotirasida saqlanadi va hech qayerga yuborilmaydi.", "st.app": "Faqat shu telefonda saqlanadi", "set.update": "Yangilanishlar", "set.build": "Versiya {v} · {b}-yigʻma", "set.checkUpd": "Yangilanishni tekshirish", "set.autoUpd": "Ishga tushganda tekshirish",
      "set.updNote": "Ilova GitHubʼdan faqat soʻnggi versiya raqamini soʻraydi. Siz va vazifalaringiz haqida hech narsa yuborilmaydi.",
      "upd.checking": "Tekshirilmoqda…", "upd.latest": "Sizda eng soʻnggi versiya.", "upd.latestShort": "Soʻnggi", "upd.avail": "Yangi versiya chiqdi — {b}-yigʻma",
      "upd.get": "Yuklab olish va oʻrnatish", "upd.later": "Keyinroq", "upd.fail": "Tekshirib boʻlmadi. Internet kerak.", "upd.failShort": "Aloqa yoʻq",
      "upd.how": "Yuklab olingan faylni oching va «Yangilash»ni bosing. Vazifalar saqlanib qoladi.",
      "t.notifOn": "Eslatmalar yoqildi.", "t.notifDenied": "Bildirishnomalar taqiqlangan. Ularni telefon sozlamalarida yoqing.",
      "set.data": "Maʼlumotlar", "set.export": "Zaxira nusxani yuklab olish", "set.import": "Fayldan tiklash", "set.wipe": "Barcha maʼlumotlarni oʻchirish",
      "set.whereCloud": "Maʼlumotlar Claude hisobingizda, ushbu ilovaning shaxsiy boʻlimida saqlanadi. Ularni faqat siz koʻrasiz.",
      "set.whereLocal": "Maʼlumotlar faqat shu qurilmadagi brauzerda saqlanadi va hech qayerga yuborilmaydi.",
      "set.privacy": "Maxfiylik", "set.policy": "Maxfiylik siyosati", "set.version": "{app} · {v}-versiya",
      cancel: "Bekor qilish", close: "Yopish", edit: "Tahrirlash", done: "Tayyor", add: "Qoʻshish",
      "detail.title": "Topshiriq", "detail.deleted": "Topshiriq oʻchirildi", "detail.due": "Muddat: {d}", "detail.steps": "Qadamlar", "detail.stepsOf": "Qadamlar · {d}/{n}",
      "detail.delStep": "{s} qadamini oʻchirish", "detail.newStep": "Yangi qadam",
      "detail.planNote": "Oʻngda har bir qadamni qaysi kungacha bajarish rejasi. Qolgan qadamlar muddatgacha teng taqsimlangan.",
      "detail.splitNote": "Katta ishni qismlarga boʻlib topshirish osonroq.", "detail.suggest": "Odatiy qadamlarni taklif qilish", "detail.delete": "Topshiriqni oʻchirish",
      "form.edit": "Tahrirlash", "form.new": "Yangi topshiriq", "form.what": "Nimani topshirish kerak", "form.errTitle": "Nimani topshirish kerakligini yozing.",
      "form.subject": "Fan", "form.noSubject": "Fansiz", "form.newSubject": "Yangi fan…", "form.newSubjName": "Yangi fan nomi",
      "form.kind": "Ish turi", "form.due": "Muddat", "form.time": "Vaqt", "form.errDate": "Topshirish sanasini tanlang.", "form.steps": "Qadamlar", "form.suggest": "Taklif qilish",
      "form.stepsPh": "Har qatorda bittadan", "form.stepsAria": "Qadamlar, har qatorda bittadan",
      "form.suggestNote": "«Taklif qilish» tanlangan ish turi uchun odatiy bosqichlarni qoʻshadi.",
      "t.needSubjName": "Yangi fan nomini yozing.", "t.tooManyTasks": "Topshiriqlar juda koʻp. Eski topshirilganlarini oʻchiring.", "t.saved": "Saqlandi.",
      "t.addedPast": "Qoʻshildi. Muddat allaqachon oʻtgan.", "t.addedToday": "Qoʻshildi. Bugun topshirish kerak!", "t.addedIn": "Qoʻshildi. Muddatgacha {days}.",
      "class.new": "Yangi dars", "class.edit": "Dars", "class.subjName": "Fan nomi", "class.type": "Turi", "class.day": "Kun", "class.weeks": "Haftalar",
      "weeks.all": "Har hafta", "weeks.odd": "Toq", "weeks.even": "Juft", "class.start": "Boshlanishi", "class.end": "Tugashi",
      "class.errTime": "Tugash vaqti boshlanishdan keyin boʻlishi kerak.", "class.room": "Xona, masalan 305", "class.roomAria": "Xona", "class.delete": "Darsni oʻchirish",
      "t.needName": "Fan nomini yozing.", "t.tooManyClasses": "Darslar soni {n} tadan oshmasligi kerak.", "t.classSaved": "Dars saqlandi.",
      "t.classAdded": "Dars qoʻshildi: {day}, {t}.", "c.delClass": "Bu dars jadvaldan oʻchirilsinmi?", "t.classDeleted": "Dars oʻchirildi.",
      "subj.new": "Yangi fan", "subj.namePh": "Nomi, masalan Falsafa", "subj.nameAria": "Fan nomi", "subj.color": "Rang", "subj.colorAria": "Fan rangi",
      "col.blue": "koʻk", "col.red": "qizil", "col.green": "yashil", "col.amber": "toʻq sariq", "col.violet": "binafsha", "col.teal": "feruza",
      "t.dupSubj": "Bunday fan allaqachon bor.", "t.tooManySubj": "Fanlar soni {n} tadan oshmasligi kerak.", "t.subjAdded": "«{n}» fani qoʻshildi.",
      "c.delSubj": "«{n}» fani oʻchirilsinmi?", "c.delSubjMsg": "Topshiriq va darslar fansiz qoladi. Shu fan boʻyicha baholar oʻchiriladi.", "btn.delSubj": "Fanni oʻchirish",
      "t.subjDeleted": "Fan oʻchirildi.",
      "t.dlUnavailable": "Bu oynada yuklab olish mavjud emas. Ilovani brauzerda claude.ai orqali oching.", "t.backupSaved": "Zaxira nusxa saqlandi.",
      "t.saveFailLater": "Faylni saqlab boʻlmadi. Birozdan soʻng qayta urinib koʻring.", "t.saveFail": "Faylni saqlab boʻlmadi.",
      "t.tooBig": "Fayl juda katta. Zaxira nusxa odatda 1 MB dan kichik boʻladi.", "t.badFile": "Bu zaxira nusxaga oʻxshamaydi: faylni oʻqib boʻlmadi.",
      "t.emptyFile": "Faylda topshiriq, fan yoki dars topilmadi.", "c.import": "Maʼlumotlar fayldagilar bilan almashtirilsinmi?", "c.importMsg": "Faylda: {parts}. Joriy maʼlumotlar oʻchadi.",
      "c.importBtn": "Almashtirish", "t.imported": "Maʼlumotlar fayldan tiklandi.",
      "t.doneLeft": "Topshirildi! Yana {tasks} qoldi.", "t.doneAll": "Topshirildi! Boshqa hech narsa qolmadi.", "t.exRemoved": "Namunalar olib tashlandi.",
      "t.parity": "Tayyor: bu hafta endi {p}.", "t.allSteps": "Barcha qadamlar bajarildi. Topshirgach, topshiriqni belgilang.",
      "t.maxSteps": "Bitta topshiriqda {n} tadan ortiq qadam boʻlmaydi.", "c.delTask": "«{t}» oʻchirilsinmi?", "c.delTaskMsg": "Topshiriq qadamlari bilan birga oʻchiriladi.",
      "t.taskDeleted": "Topshiriq oʻchirildi.", "c.wipe": "Barcha topshiriq, fan va darslar oʻchirilsinmi?",
      "c.wipeMsg": "Buni bekor qilib boʻlmaydi. Ikkilansangiz, avval zaxira nusxani yuklab oling.", "c.wipeBtn": "Hammasini oʻchirish", "t.wiped": "Barcha maʼlumotlar oʻchirildi.",
      "policy.title": "Maxfiylik",
      "focus.today": "Bugun {d}", "focus.todayNone": "Bugun hali mashgʻulot boʻlmadi", "focus.endsAt": "soat {t} da tugaydi", "focus.paused": "pauzada",
      "focus.cycle": "{c}/4-sikl", "ph.focus": "Fokus", "ph.short": "Tanaffus", "ph.long": "Uzun tanaffus", "ph.longShort": "Uzun",
      "focus.mode": "Rejim", "focus.subject": "Fan", "focus.reset": "Qayta boshlash", "focus.skip": "Oʻtkazib yuborish", "focus.start": "Boshlash",
      "focus.pause": "Pauza", "focus.resume": "Davom ettirish", "focus.rest": "Dam olish", "focus.week": "Shu hafta", "focus.bySubj": "Fanlar boʻyicha",
      "focus.none": "Bu hafta hali mashgʻulot boʻlmadi. Taymerni ishga tushiring — vaqt avtomatik yoziladi.",
      "focus.note": "Pomodoro: {f} daq ish, {s} daq dam, toʻrt sikldan keyin — {l} daq. Davomiylikni sozlamalarda oʻzgartiring.",
      "focus.done": "Fokus tugadi: {m} daq{s}. Dam olish vaqti.", "focus.skipped": "Sikl oʻtkazib yuborildi, vaqt yozilmadi.",
      "focus.breakOver": "Tanaffus tugadi. Davom etish mumkin.", "focus.breakSkipped": "Tanaffus oʻtkazib yuborildi.",
      "c.skip": "Bu sikl oʻtkazib yuborilsinmi?", "c.skipMsg": "Bu sikl vaqti statistikaga yozilmaydi.", "c.skipBtn": "Oʻtkazib yuborish",
      "gr.new": "Yangi baho", "gr.needSubjTitle": "Avval fan qoʻshing", "gr.needSubjText": "Baholar fanlar boʻyicha qoʻyiladi. Birinchisini qoʻshing, masalan «Matematik tahlil».",
      "gr.emptyTitle": "Hozircha baholar yoʻq",
      "gr.emptyText": "Fanlar boʻyicha baholarni qoʻshing. Ilova oʻrtacha bahoni hisoblaydi va maqsadga yetish uchun nechta «5» kerakligini aytadi.",
      "gr.addBtn": "Baho qoʻshish", "gr.avg": "Oʻrtacha baho", "gr.noThrees": "Uchlarsiz", "gr.threes": "Uchlar: {n}", "gr.twos": "Ikkilar: {n}", "gr.exams": "Imtihonlar: {a}",
      "gr.subjects": "Fanlar", "gr.noneYet": "Hozircha baholar yoʻq",
      "gr.note": "Baho qoʻyish va maqsadgacha nechta «5» kerakligini bilish uchun fanni bosing. Imtihonlar ramka bilan ajratilgan.",
      "gr.put": "{v} qoʻyish", "gr.kind": "Turi", "gr.date": "Sana", "gk.cur": "Joriy", "gk.test": "Nazorat ishi", "gk.exam": "Imtihon",
      "gr.subjDeleted": "Fan oʻchirilgan", "gr.putTitle": "Baho qoʻyish", "gr.list": "Baholar", "gr.listEmpty": "Baholar shu yerda paydo boʻladi",
      "gr.listNote": "Bahoni oʻchirish uchun ustiga bosing. Imtihonlar ramka bilan ajratilgan.", "gr.delAria": "{v} bahoni oʻchirish, {k}, {d}",
      "gr.goal": "Maqsad", "gr.want": "Kerakli oʻrtacha", "tg.first": "Hisob-kitobni koʻrish uchun birinchi bahoni qoʻying.", "tg.reached": "Maqsadga erishildi.",
      "tg.impossible": "5,0 oʻrtachaga endi erishib boʻlmaydi: 5 dan past baholar bor.", "tg.need": "Ketma-ket yana {n} {w} kerak.",
      "gr.pickNote": "Saqlash uchun bahoni bosing.", "gr.gradeTitle": "Baho", "t.needSubjFirst": "Avval fan qoʻshing.",
      "t.tooManyGrades": "Baholar juda koʻp. Eskilarini oʻchiring.", "t.gradeAdded": "«{s}» faniga {v} baho qoʻshildi.",
      "c.delGrade": "{v} baho oʻchirilsinmi?", "btn.delGrade": "Bahoni oʻchirish", "t.gradeDeleted": "Baho oʻchirildi.",
      "k.hw": "Uy vazifasi", "k.lab": "Laboratoriya ishi", "k.ref": "Referat", "k.essay": "Esse", "k.course": "Kurs ishi", "k.test": "Nazorat ishi",
      "k.coll": "Kollokvium", "k.credit": "Sinov", "k.exam": "Imtihon", "k.project": "Loyiha",
      "ct.lec": "Maʼruza", "ct.sem": "Seminar", "ct.lab": "Laboratoriya", "ct.prac": "Amaliyot", "ct.other": "Boshqa"
    }
  };
  const STEPS = {
    ru: {
      hw: ["Разобрать задание", "Решить", "Проверить и сдать"],
      lab: ["Прочитать методичку", "Выполнить работу", "Оформить отчёт", "Подготовиться к защите"],
      ref: ["Подобрать 5–7 источников", "Составить план", "Написать черновик", "Оформить по ГОСТ", "Проверить на антиплагиат"],
      essay: ["Набросать тезисы", "Написать черновик", "Вычитать и сократить"],
      course: ["Согласовать тему с руководителем", "Обзор литературы", "Глава 1", "Глава 2", "Введение и заключение", "Оформить по ГОСТ", "Отправить на проверку"],
      test: ["Повторить конспект", "Прорешать типовые задачи", "Разобрать ошибки"],
      coll: ["Собрать вопросы", "Выучить первую половину", "Выучить вторую половину", "Прогнать всё вслух"],
      credit: ["Узнать требования к зачёту", "Закрыть долги", "Повторить материал"],
      exam: ["Собрать билеты", "Выучить первую треть", "Выучить вторую треть", "Выучить остальное", "Прорешать задачи", "Финальный прогон"],
      project: ["Разбить на задачи", "Сделать прототип", "Доделать", "Подготовить презентацию"]
    },
    en: {
      hw: ["Read the assignment", "Solve it", "Check and submit"],
      lab: ["Read the lab manual", "Do the work", "Write the report", "Prepare for the defense"],
      ref: ["Find 5–7 sources", "Make an outline", "Write a draft", "Format citations", "Check for plagiarism"],
      essay: ["Outline main points", "Write a draft", "Proofread and trim"],
      course: ["Agree on the topic with the supervisor", "Literature review", "Chapter 1", "Chapter 2", "Introduction and conclusion", "Format the paper", "Submit for review"],
      test: ["Review notes", "Solve typical problems", "Go over mistakes"],
      coll: ["Gather the questions", "Learn the first half", "Learn the second half", "Rehearse out loud"],
      credit: ["Check the pass requirements", "Clear any backlog", "Review the material"],
      exam: ["Collect exam questions", "Learn the first third", "Learn the second third", "Learn the rest", "Practice problems", "Final run-through"],
      project: ["Break into tasks", "Build a prototype", "Finish it", "Prepare a presentation"]
    },
    uz: {
      hw: ["Topshiriqni tahlil qilish", "Yechish", "Tekshirib topshirish"],
      lab: ["Uslubiy qoʻllanmani oʻqish", "Ishni bajarish", "Hisobotni rasmiylashtirish", "Himoyaga tayyorlanish"],
      ref: ["5–7 ta manba topish", "Reja tuzish", "Qoralama yozish", "Talablarga koʻra rasmiylashtirish", "Antiplagiatdan oʻtkazish"],
      essay: ["Asosiy fikrlarni yozish", "Qoralama yozish", "Tahrirlash va qisqartirish"],
      course: ["Mavzuni rahbar bilan kelishish", "Adabiyotlar sharhi", "1-bob", "2-bob", "Kirish va xulosa", "Rasmiylashtirish", "Tekshiruvga yuborish"],
      test: ["Konspektni takrorlash", "Odatiy masalalarni yechish", "Xatolar ustida ishlash"],
      coll: ["Savollarni yigʻish", "Birinchi yarmini oʻrganish", "Ikkinchi yarmini oʻrganish", "Hammasini ovoz chiqarib takrorlash"],
      credit: ["Sinov talablarini bilish", "Qarzlarni yopish", "Materialni takrorlash"],
      exam: ["Imtihon savollarini yigʻish", "Birinchi uchdan birini oʻrganish", "Ikkinchi uchdan birini oʻrganish", "Qolganini oʻrganish", "Masalalar yechish", "Yakuniy takrorlash"],
      project: ["Vazifalarga boʻlish", "Prototip yaratish", "Yakunlash", "Taqdimot tayyorlash"]
    }
  };
  // Примеры: у предметов и заданий постоянные id (ex-…), чтобы при смене языка их можно было перевести.
  const EXAMPLES = {
    ru: {
      subj: ["Программирование", "Матанализ", "История", "Английский", "Физика"],
      tasks: [
        ["Типовой расчёт по интегралам", ["Задачи 1–5", "Задачи 6–10", "Оформить решение"]],
        ["Лабораторная №3: связные списки", ["Прочитать методичку", "Написать код", "Покрыть тестами", "Оформить отчёт"]],
        ["Essay: My future profession", ["Набросать тезисы", "Черновик на 250 слов", "Проверить грамматику"]],
        ["Коллоквиум по механике", ["Вопросы 1–10", "Вопросы 11–20", "Повторить формулы", "Прогнать всё вслух"]],
        ["Реферат: реформы Петра I", ["Подобрать 5–7 источников", "Составить план", "Написать черновик", "Оформить по ГОСТ", "Проверить на антиплагиат"]],
        ["Курсовая: глава 1", ["Согласовать тему с руководителем", "Обзор литературы", "Написать главу 1"]],
        ["Unit 5: упражнения 1–8", ["Упражнения 1–4", "Упражнения 5–8"]]
      ]
    },
    en: {
      subj: ["Programming", "Calculus", "History", "English", "Physics"],
      tasks: [
        ["Integrals problem set", ["Problems 1–5", "Problems 6–10", "Write up the solutions"]],
        ["Lab 3: linked lists", ["Read the lab manual", "Write the code", "Add tests", "Write the report"]],
        ["Essay: My future profession", ["Outline main points", "Draft 250 words", "Check grammar"]],
        ["Mechanics oral exam", ["Questions 1–10", "Questions 11–20", "Review formulas", "Rehearse out loud"]],
        ["Report: the Industrial Revolution", ["Find 5–7 sources", "Make an outline", "Write a draft", "Format citations", "Check for plagiarism"]],
        ["Term paper: chapter 1", ["Agree on the topic with the supervisor", "Literature review", "Write chapter 1"]],
        ["Unit 5: exercises 1–8", ["Exercises 1–4", "Exercises 5–8"]]
      ]
    },
    uz: {
      subj: ["Dasturlash", "Matematik tahlil", "Tarix", "Ingliz tili", "Fizika"],
      tasks: [
        ["Integrallar boʻyicha hisob ishi", ["1–5-masalalar", "6–10-masalalar", "Yechimni rasmiylashtirish"]],
        ["3-laboratoriya ishi: bogʻlangan roʻyxatlar", ["Uslubiy qoʻllanmani oʻqish", "Kod yozish", "Testlar yozish", "Hisobotni rasmiylashtirish"]],
        ["Essay: My future profession", ["Asosiy fikrlarni yozish", "250 soʻzlik qoralama", "Grammatikani tekshirish"]],
        ["Mexanika boʻyicha kollokvium", ["1–10-savollar", "11–20-savollar", "Formulalarni takrorlash", "Hammasini ovoz chiqarib takrorlash"]],
        ["Referat: Amir Temur davlati", ["5–7 ta manba topish", "Reja tuzish", "Qoralama yozish", "Talablarga koʻra rasmiylashtirish", "Antiplagiatdan oʻtkazish"]],
        ["Kurs ishi: 1-bob", ["Mavzuni rahbar bilan kelishish", "Adabiyotlar sharhi", "1-bobni yozish"]],
        ["Unit 5: 1–8-mashqlar", ["1–4-mashqlar", "5–8-mashqlar"]]
      ]
    }
  };

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const iso = (d) => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const parseDate = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const addDays = (n) => { const d = startOfDay(new Date()); d.setDate(d.getDate() + n); return d; };
  const dueAt = (t) => { const d = parseDate(t.due); const [h, mi] = (t.time || "23:59").split(":").map(Number); d.setHours(h || 0, mi || 0, 0, 0); return d; };
  const dayDiff = (t) => Math.round((startOfDay(parseDate(t.due)) - startOfDay(new Date())) / DAY);
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fromMin = (m) => { m = Math.min(Math.max(m, 0), 23 * 60 + 59); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pref = (k, ok, def) => { try { const v = localStorage.getItem(LS_KEY + ":" + k); return ok.includes(v) ? v : def; } catch { return def; } };
  const setPref = (k, v) => { try { localStorage.setItem(LS_KEY + ":" + k, v); } catch {} };

  // ---------- language ----------
  function detectLang() {
    const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "ru"]).map((x) => String(x).toLowerCase());
    for (const l of list) {
      if (l.startsWith("uz")) return "uz";
      if (l.startsWith("ru")) return "ru";
      if (l.startsWith("en")) return "en";
    }
    return "ru";
  }
  let lang = pref("lang", LANGS.map((l) => l[0]), detectLang());
  function t(key, vars) {
    const s = (STR[lang] && STR[lang][key]) ?? STR.ru[key] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "")) : s;
  }
  // Форма слова для числа n: русские 3 формы, английские 2, узбекская 1.
  function pf(n, key) {
    const f = (PL[lang] && PL[lang][key]) || PL.ru[key];
    if (lang === "ru") {
      const a = Math.abs(n) % 100, b = a % 10;
      if (a > 10 && a < 20) return f[2];
      if (b > 1 && b < 5) return f[1];
      if (b === 1) return f[0];
      return f[2];
    }
    if (lang === "en") return Math.abs(n) === 1 ? f[0] : f[1];
    return f[0];
  }
  const pn = (n, key) => `${n} ${pf(n, key)}`;

  let F = {};
  // Узбекские названия заданы вручную: в Chrome и Android WebView нет встроенных данных для узбекского языка.
  const UZ = {
    months: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
    monthsShort: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"],
    days: ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"],
    daysShort: ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"]
  };
  const uzNum = (digits, minDigits) => ({ format: (n) => {
    let s = Number(n).toFixed(digits);
    if (minDigits < digits) s = s.replace(/0+$/, "").replace(/\.$/, "");
    if (minDigits > 0 && !s.includes(".")) s += "." + "0".repeat(minDigits);
    return s.replace(".", ",");
  } });
  function makeFormats() {
    const L = LOCALE[lang];
    const df = (o) => new Intl.DateTimeFormat(L, o);
    if (lang === "uz") {
      F = {
        date: { format: (d) => `${UZ.daysShort[d.getDay()]}, ${d.getDate()}-${UZ.monthsShort[d.getMonth()]}` },
        long: { format: (d) => `${UZ.days[d.getDay()]}, ${d.getDate()}-${UZ.months[d.getMonth()]}` },
        month: { format: (d) => `${UZ.months[d.getMonth()]} ${d.getFullYear()}` },
        dm: { format: (d) => `${d.getDate()}-${UZ.months[d.getMonth()]}` },
        num2: uzNum(2, 2), num1: uzNum(1, 0), numT: uzNum(2, 1)
      };
      F.days = [1, 2, 3, 4, 5, 6, 0].map((i) => cap(UZ.days[i]));
      F.wd = [1, 2, 3, 4, 5, 6, 0].map((i) => UZ.daysShort[i]);
      return;
    }
    F = {
      date: df({ weekday: "short", day: "numeric", month: "short" }),
      long: df({ weekday: "long", day: "numeric", month: "long" }),
      month: df({ month: "long", year: "numeric" }),
      dm: df({ day: "numeric", month: "long" }),
      num2: new Intl.NumberFormat(L, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      num1: new Intl.NumberFormat(L, { maximumFractionDigits: 1 }),
      numT: new Intl.NumberFormat(L, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
    };
    F.days = [0, 1, 2, 3, 4, 5, 6].map((i) => cap(df({ weekday: "long" }).format(new Date(2024, 0, 1 + i))));
    F.wd = [0, 1, 2, 3, 4, 5, 6].map((i) => cap(df({ weekday: "short" }).format(new Date(2024, 0, 1 + i))).replace(/\.$/, ""));
  }
  makeFormats();
  const fmtDue = (x) => F.date.format(parseDate(x.due)).replace(/\.$/, "") + (x.time ? ", " + x.time : "");
  const fmtMonthTitle = (d) => cap(F.month.format(d).replace(/\s*г\.?$/, "").replace(", ", " "));
  const dayLower = (i) => (lang === "en" ? F.days[i] : F.days[i].toLowerCase());
  const kindName = (k) => t("k." + k);
  const classTypeName = (k) => t("ct." + k);
  const gradeKindName = (k) => t("gk." + k);
  const parityWord = (p) => t("parity." + p);
  const kindSteps = (k) => (STEPS[lang] && STEPS[lang][k]) || STEPS.ru[k] || [];

  function semesterWeek(now) {
    const y = now.getFullYear(), m = now.getMonth();
    let start;
    if (m >= 8) start = new Date(y, 8, 1);
    else if (m >= 1) start = new Date(y, 1, 9);
    else start = new Date(y - 1, 8, 1);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const w = Math.floor((startOfDay(now) - start) / (7 * DAY)) + 1;
    return w >= 1 && w <= 18 ? w : null;
  }
  function isoWeek(d) {
    const x = startOfDay(d);
    x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
    const w1 = new Date(x.getFullYear(), 0, 4);
    return 1 + Math.round(((x - w1) / DAY - 3 + ((w1.getDay() + 6) % 7)) / 7);
  }
  function weekInfo(d) {
    const sw = semesterWeek(d);
    const n = (sw || isoWeek(d)) + (state && state.weekFlip ? 1 : 0);
    return { num: sw, parity: n % 2 === 1 ? "odd" : "even" };
  }

  function urgency(x) {
    if (x.done) return { cls: "done", text: t("u.done"), short: t("u.done") };
    const ms = dueAt(x) - Date.now(), dd = dayDiff(x);
    if (ms < 0) {
      const days = Math.floor(-ms / DAY);
      if (days < 1) return { cls: "over", text: t("u.overH", { n: Math.max(1, Math.floor(-ms / 36e5)) }), short: t("u.over") };
      return { cls: "over", text: t("u.overD", { days: pn(days, "day") }), short: t("u.over") };
    }
    if (dd === 0) {
      const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4);
      return { cls: "hot", text: h > 0 ? t("u.todayHM", { h, m }) : t("u.todayM", { m }), short: t("u.today") };
    }
    if (dd === 1) return { cls: "hot", text: t("u.tomorrowFull"), short: t("u.tomorrow") };
    return { cls: dd <= 7 ? "soon" : "later", text: t("u.in", { days: pn(dd, "day") }), short: pn(dd, "day") };
  }
  function groupOf(x) {
    if (x.done) return "done";
    if (dueAt(x) < Date.now()) return "over";
    const dd = dayDiff(x);
    if (dd <= 1) return "now";
    if (dd <= 7) return "week";
    return "later";
  }
  function countdown(ms) {
    ms = Math.abs(ms);
    const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    return d > 0 ? t("cd.dh", { d, h }) : t("cd.hm", { h, m: String(m).padStart(2, "0") });
  }
  function stepPlan(x) {
    const undone = x.steps.filter((s) => !s.done);
    const today = startOfDay(new Date());
    const d = Math.max(0, Math.round((startOfDay(parseDate(x.due)) - today) / DAY));
    const map = {};
    undone.forEach((s, j) => {
      const off = j === undone.length - 1 ? d : Math.floor(((j + 1) * d) / undone.length);
      map[s.id] = new Date(today.getTime() + off * DAY);
    });
    return map;
  }
  function planLabel(date) {
    const diff = Math.round((startOfDay(date) - startOfDay(new Date())) / DAY);
    if (diff <= 0) return t("plan.today");
    if (diff === 1) return t("plan.tomorrow");
    return t("plan.by", { d: F.date.format(date).replace(/\.$/, "") });
  }
  function dur(m) {
    if (m < 60) return t("dur.m", { m });
    const h = Math.floor(m / 60), r = m % 60;
    return r ? t("dur.hm", { h, m: r }) : t("dur.h", { h });
  }

  // ---------- data validation ----------
  // Всё, что приходит из хранилища, облака или файла, проходит через sanitize():
  // лишние поля отбрасываются, строки обрезаются, значения сверяются со списками
  // допустимых. Так чужой или испорченный файл не сможет внедрить код или сломать приложение.
  const CTRL_RE = new RegExp("[\\u0000-\\u001F\\u007F\\u2028\\u2029]", "g");
  const cleanStr = (v, max) => (typeof v === "string" ? v.replace(CTRL_RE, " ").trim().slice(0, max) : "");
  const validDate = (s) => typeof s === "string" && DATE_RE.test(s) && iso(parseDate(s)) === s;
  const validTime = (s) => typeof s === "string" && TIME_RE.test(s);
  const posInt = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null);
  const exFlag = (x) => (x.ex === true ? { ex: true } : {});

  function sanitize(d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) return null;
    const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
    const subjects = [], sIds = new Set();
    for (const x of arr(d.subjects, LIMITS.subjects)) {
      if (!x || typeof x !== "object" || !ID_RE.test(x.id) || sIds.has(x.id)) continue;
      const name = cleanStr(x.name, 40);
      if (!name) continue;
      sIds.add(x.id);
      subjects.push({ id: x.id, name, color: COLORS.includes(x.color) ? x.color : "blue", ...exFlag(x) });
    }
    const sid = (v) => (typeof v === "string" && sIds.has(v) ? v : null);
    const tasks = [], tIds = new Set();
    for (const x of arr(d.tasks, LIMITS.tasks)) {
      if (!x || typeof x !== "object" || !ID_RE.test(x.id) || tIds.has(x.id) || !validDate(x.due)) continue;
      const title = cleanStr(x.title, 120);
      if (!title) continue;
      tIds.add(x.id);
      const steps = [], stIds = new Set();
      for (const s of arr(x.steps, LIMITS.steps)) {
        if (!s || typeof s !== "object" || !ID_RE.test(s.id) || stIds.has(s.id)) continue;
        const text = cleanStr(s.text, 120);
        if (!text) continue;
        stIds.add(s.id);
        steps.push({ id: s.id, text, done: s.done === true });
      }
      tasks.push({
        id: x.id, title, subjectId: sid(x.subjectId), kind: KIND_KEYS.has(x.kind) ? x.kind : "hw",
        due: x.due, time: validTime(x.time) ? x.time : "", steps,
        done: x.done === true, doneAt: x.done === true ? posInt(x.doneAt) : null,
        createdAt: posInt(x.createdAt) || Date.now(), ...exFlag(x)
      });
    }
    const classes = [], cIds = new Set();
    for (const x of arr(d.classes, LIMITS.classes)) {
      if (!x || typeof x !== "object" || !ID_RE.test(x.id) || cIds.has(x.id)) continue;
      if (!Number.isInteger(x.day) || x.day < 0 || x.day > 6) continue;
      if (!validTime(x.start) || !validTime(x.end) || toMin(x.end) <= toMin(x.start)) continue;
      cIds.add(x.id);
      classes.push({
        id: x.id, subjectId: sid(x.subjectId), day: x.day, start: x.start, end: x.end,
        type: CLASS_KEYS.has(x.type) ? x.type : "other", room: cleanStr(x.room, 30),
        weeks: ["all", "odd", "even"].includes(x.weeks) ? x.weeks : "all", ...exFlag(x)
      });
    }
    const grades = [], gIds = new Set();
    for (const x of arr(d.grades, LIMITS.grades)) {
      if (!x || typeof x !== "object" || !ID_RE.test(x.id) || gIds.has(x.id)) continue;
      if (!sid(x.subjectId) || !Number.isInteger(x.value) || x.value < 2 || x.value > 5 || !validDate(x.date)) continue;
      gIds.add(x.id);
      grades.push({ id: x.id, subjectId: x.subjectId, value: x.value, kind: GRADE_KIND_KEYS.has(x.kind) ? x.kind : "cur", date: x.date, ...exFlag(x) });
    }
    const sessions = [], sesIds = new Set();
    for (const x of arr(d.sessions, LIMITS.sessions)) {
      if (!x || typeof x !== "object" || !ID_RE.test(x.id) || sesIds.has(x.id)) continue;
      if (!posInt(x.start) || !Number.isInteger(x.minutes) || x.minutes < 1 || x.minutes > 240) continue;
      sesIds.add(x.id);
      sessions.push({ id: x.id, subjectId: sid(x.subjectId), start: posInt(x.start), minutes: x.minutes, ...exFlag(x) });
    }
    return { v: 1, examples: d.examples === true, weekFlip: d.weekFlip === true, subjects, tasks, classes, grades, sessions };
  }
  // Убирает пары-примеры из прошлых версий: своё расписание пользователь вносит сам.
  function migrate(d) {
    if (d && d.classes.some((c) => c.ex)) d.classes = d.classes.filter((c) => !c.ex);
    return d;
  }

  // ---------- examples ----------
  const EX_SUBJ = [["ex-prog", "blue"], ["ex-math", "violet"], ["ex-hist", "amber"], ["ex-eng", "teal"], ["ex-phys", "green"]];
  function examples() {
    const L = EXAMPLES[lang] || EXAMPLES.ru;
    const subj = EX_SUBJ.map(([id, color], i) => ({ id, name: L.subj[i], color, ex: true }));
    const [prog, math, hist, eng, phys] = EX_SUBJ.map((x) => x[0]);
    const g = (subjectId, value, kind, daysAgo) => ({ id: uid(), subjectId, value, kind, date: iso(addDays(-daysAgo)), ex: true });
    const ses = (subjectId, daysAgo, hour, minutes) => { const d = addDays(-daysAgo); d.setHours(hour, 0, 0, 0); return { id: uid(), subjectId, start: d.getTime(), minutes, ex: true }; };
    // [предмет, тип, через сколько дней срок, время, какие шаги уже сделаны, сдано]
    const plan = [
      [math, "hw", -1, "10:00", [0]], [prog, "lab", 1, "23:59", [0, 1]], [eng, "essay", 4, "", [0]], [phys, "coll", 6, "12:40", []],
      [hist, "ref", 9, "", []], [prog, "course", 24, "", [0]], [eng, "hw", -3, "", [0, 1], true]
    ];
    const tasks = plan.map(([subjectId, kind, inDays, time, doneSteps, done], i) => ({
      id: "ex-t" + (i + 1), title: L.tasks[i][0], subjectId, kind, due: iso(addDays(inDays)), time,
      steps: L.tasks[i][1].map((text, j) => ({ id: `ex-t${i + 1}-s${j + 1}`, text, done: doneSteps.includes(j) })),
      done: !!done, doneAt: done ? Date.now() - 3 * DAY : null, createdAt: Date.now(), ex: true
    }));
    return {
      v: 1, examples: true, weekFlip: false, subjects: subj, classes: [], tasks,
      grades: [
        ...[[5, "cur"], [4, "cur"], [4, "cur"], [5, "cur"], [3, "test"]].map(([v, k], i) => g(math, v, k, 40 - i * 7)),
        ...[[5, "cur"], [5, "cur"], [4, "cur"], [5, "test"]].map(([v, k], i) => g(prog, v, k, 38 - i * 8)),
        ...[[4, "cur"], [4, "cur"], [5, "cur"]].map(([v, k], i) => g(hist, v, k, 35 - i * 9)),
        ...[[5, "cur"], [4, "cur"], [5, "cur"], [5, "cur"]].map(([v, k], i) => g(eng, v, k, 30 - i * 6)),
        ...[[4, "cur"], [3, "cur"], [4, "test"]].map(([v, k], i) => g(phys, v, k, 33 - i * 10))
      ],
      sessions: [
        ses(prog, 3, 18, 50), ses(math, 3, 20, 25), ses(eng, 2, 17, 25), ses(prog, 1, 19, 75),
        ses(phys, 1, 21, 50), ses(math, 0, 8, 25), ses(hist, 5, 16, 45), ses(eng, 6, 12, 25)
      ]
    };
  }
  // При смене языка примеры переводятся (свои данные пользователя не трогаются).
  function relocalizeExamples() {
    if (!state || !state.examples) return false;
    const L = EXAMPLES[lang] || EXAMPLES.ru;
    let changed = false;
    for (const s of state.subjects) {
      const i = EX_SUBJ.findIndex(([id]) => id === s.id);
      if (s.ex && i >= 0 && s.name !== L.subj[i]) { s.name = L.subj[i]; changed = true; }
    }
    for (const x of state.tasks) {
      const m = /^ex-t(\d+)$/.exec(x.id);
      if (!x.ex || !m || !L.tasks[m[1] - 1]) continue;
      const [title, steps] = L.tasks[m[1] - 1];
      if (x.title !== title) { x.title = title; changed = true; }
      for (const s of x.steps) {
        const sm = /^ex-t\d+-s(\d+)$/.exec(s.id);
        if (sm && steps[sm[1] - 1] && s.text !== steps[sm[1] - 1]) { s.text = steps[sm[1] - 1]; changed = true; }
      }
    }
    return changed;
  }

  // ---------- state ----------
  function loadLocal() {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? migrate(sanitize(JSON.parse(raw))) : null; } catch { return null; }
  }
  function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }

  let state = loadLocal();
  const hadLocal = !!state;
  let tab = pref("tab", ["tasks", "cal", "sched", "focus", "grades", "settings"], "tasks");
  let prevTab = "tasks";
  let filter = "all";
  try { filter = localStorage.getItem(LS_KEY + ":filter") || "all"; } catch {}
  let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selDay = iso(new Date());
  let schedWeek = "this";
  let showDone = false;

  // ---------- persistence ----------
  let ref = null, mode = "connecting", saveTimer = null, saving = false, dirty = false, statusKind = "connecting", statusExtraKey = "";
  const STATUS_CLS = { connecting: "", saving: "busy", saved: "ok", local: "", error: "err" };
  function setStatus(kind, extraKey) {
    statusKind = kind; statusExtraKey = extraKey || "";
    const el = $("saveStatus");
    if (!el) return;
    el.parentElement.className = "status " + (STATUS_CLS[kind] ?? "");
    el.textContent = t(statusExtraKey || (kind === "local" && CAP ? "st.app" : "st." + kind));
  }
  function scheduleSave() {
    saveLocal();
    syncNotifications();
    if (!ref) { setStatus("local"); return; }
    dirty = true;
    setStatus("saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 600);
  }
  async function flush() {
    saveTimer = null;
    if (!ref || !dirty) return;
    if (saving) { saveTimer = setTimeout(flush, 400); return; }
    saving = true; dirty = false;
    try {
      await ref.set(JSON.parse(JSON.stringify(state)));
      if (!dirty) setStatus("saved");
    } catch (e) {
      const code = e && e.code;
      if (code === "unavailable") { dirty = true; saveTimer = setTimeout(flush, 1200 + Math.random() * 1200); }
      else if (code === "quota_exceeded") setStatus("error", "st.quota");
      else if (code === "invalid_argument" || code === "revoked" || code === "not_granted") { ref = null; mode = "local"; setStatus("local"); }
      else setStatus("error");
    } finally {
      saving = false;
      if (dirty && !saveTimer) saveTimer = setTimeout(flush, 300);
    }
  }
  function commit() { renderScreen(); refreshSheet(); scheduleSave(); }

  // Примеры сразу сохраняются локально, чтобы после перезагрузки не менялись их id (иначе сбрасывается фильтр).
  function freshExamples() { state = examples(); saveLocal(); }

  async function init() {
    const fallback = setTimeout(() => { if (!state) { freshExamples(); render(); } }, 3500);
    let db = null, id = null;
    try {
      if (IN_ARTIFACT) {
        db = await window.claude.use("db");
        const user = await window.claude.use("user");
        id = user ? await user.id() : null;
      }
    } catch {}
    const goLocal = () => { clearTimeout(fallback); mode = "local"; if (!state) freshExamples(); render(); setStatus("local"); };
    if (!db || !id) return goLocal();
    try { ref = db.doc("data/users/" + id + "/planner"); } catch { ref = null; }
    if (!ref) return goLocal();
    mode = "cloud";
    let first = true;
    ref.onSnapshot((snap) => {
      clearTimeout(fallback);
      if (snap.metadata.hasPendingWrites || saveTimer || saving || dirty) return;
      if (snap.exists) {
        const raw = sanitize(snap.data());
        if (raw) {
          const hadEx = raw.classes.some((c) => c.ex);
          state = migrate(raw);
          const relocalized = relocalizeExamples();
          saveLocal(); render();
          if (hadEx || relocalized) scheduleSave(); else setStatus("saved");
        }
      } else if (first) {
        if (!state) { freshExamples(); render(); setStatus("saved"); }
        else if (hadLocal && !state.examples) { render(); scheduleSave(); }
        else { render(); setStatus("saved"); }
      }
      first = false;
    }, () => { ref = null; mode = "local"; if (!state) { freshExamples(); render(); } setStatus("local"); });
  }

  // ---------- render helpers ----------
  const subjById = (id) => (state ? state.subjects.find((s) => s.id === id) : null) || null;
  const progress = (x) => { const n = x.steps.length, d = x.steps.filter((s) => s.done).length; return { n, d }; };
  const scStyle = (s) => (s ? ` style="--sc: var(--sub-${esc(s.color)})"` : "");
  const lessonName = (c) => { const s = subjById(c.subjectId); return s ? s.name : t("form.noSubject"); };
  const visibleTasks = () => state.tasks.filter((x) => filter === "all" || (filter === "none" ? !subjById(x.subjectId) : x.subjectId === filter));
  const byDue = (a, b) => dueAt(a) - dueAt(b);

  function todayLine() {
    const now = new Date();
    const wi = weekInfo(now);
    const p = parityWord(wi.parity);
    return cap(F.long.format(now)) + " · " + (wi.num ? t("week.num", { n: wi.num, p }) : t("week.plain", { p, P: cap(p) }));
  }
  const gearBtn = () => `<button type="button" class="nav-btn-circle" data-tab="settings" aria-label="${esc(t("settings"))}">${ICON.settings}</button>`;
  const navGroup = (...btns) => `<div class="nav-group glass">${btns.join('<span class="nav-div" aria-hidden="true"></span>')}</div>`;
  const navHeader = (title, sub, right = "", left = "") =>
    `<header class="nav"><div class="nav-bar">${left || "<span></span>"}${right}</div><div class="nav-text"><h1 class="large-title">${esc(title)}</h1>${sub ? `<p class="nav-sub">${esc(sub)}</p>` : ""}</div></header>`;
  const plusBtn = (action, label) => `<button type="button" class="nav-btn-circle" data-action="${action}" aria-label="${esc(label)}">${ICON.plus}</button>`;

  function taskRow(x) {
    const s = subjById(x.subjectId);
    const u = urgency(x);
    const { n, d } = progress(x);
    const meta = [s ? `<span class="sdot"${scStyle(s)}></span>${esc(s.name)}` : "", esc(kindName(x.kind)), esc(fmtDue(x))].filter(Boolean).join(" · ");
    return `<div class="row trow" data-id="${esc(x.id)}">
      <button type="button" class="ring" data-action="toggle" aria-pressed="${x.done}" aria-label="${esc(t(x.done ? "row.markUndone" : "row.markDone"))}: ${esc(x.title)}"${scStyle(s)}></button>
      <button type="button" class="trow-main" data-action="open">
        <span class="trow-text">
          <span class="t ${x.done ? "done" : ""}">${esc(x.title)}</span>
          <span class="s">${meta}</span>
          ${n ? `<span class="s">${esc(t("row.steps", { d, n }))}</span>` : ""}
        </span>
        <span class="urg c-${u.cls}" data-urg="${esc(x.id)}">${esc(u.short)}</span>
        <span class="chev">${ICON.chev}</span>
      </button>
    </div>`;
  }

  // ---------- screens ----------
  function renderTasks() {
    const el = $("scr-tasks");
    const all = state.tasks;
    const active = all.filter((x) => !x.done).sort(byDue);
    let h = navHeader(t("tab.tasks"), todayLine(), navGroup(gearBtn(), plusBtn("newtask", t("btn.newTask"))));
    h += updBanner();

    if (active.length) {
      const x = active[0];
      const ms = dueAt(x) - Date.now(), over = ms < 0;
      const s = subjById(x.subjectId);
      const { n, d } = progress(x);
      const meta = [s ? esc(s.name) : "", esc(kindName(x.kind)), esc(fmtDue(x)), n ? esc(t("hero.steps", { d, n })) : ""].filter(Boolean).join(" · ");
      h += `<button type="button" class="card hero" data-action="open" data-id="${esc(x.id)}">
        <p class="cap ${over ? "c-over" : ""}">${esc(t(over ? "hero.over" : "hero.next"))}</p>
        <p class="hero-title">${esc(x.title)}</p>
        <p class="countdown ${over ? "c-over" : ""}">${over ? "−" : ""}${esc(countdown(ms))}</p>
        <p class="hero-meta">${meta}</p>
      </button>`;
    } else {
      h += `<div class="card hero"><p class="cap">${esc(t("hero.next"))}</p><p class="hero-title">${esc(t(all.length ? "hero.allDone" : "hero.nothing"))}</p></div>`;
    }

    const cnt = (g) => active.filter((x) => groupOf(x) === g).length;
    h += `<div class="card stats">
      <div class="stat"><b class="c-over">${cnt("over")}</b><span>${esc(t("stat.over"))}</span></div>
      <div class="stat"><b class="c-hot">${cnt("now")}</b><span>${esc(t("stat.now"))}</span></div>
      <div class="stat"><b>${cnt("week")}</b><span>${esc(t("stat.week"))}</span></div>
    </div>`;

    if (state.examples) {
      h += `<div class="card banner"><p>${esc(t("banner.text"))}</p>
        <button type="button" class="btn-tinted glass" data-action="clearex">${esc(t("banner.btn"))}</button></div>`;
    }

    if (state.subjects.length) {
      if (filter !== "all" && filter !== "none" && !subjById(filter)) filter = "all";
      const ac = (fn) => active.filter(fn).length;
      h += `<div class="pills" role="toolbar" aria-label="${esc(t("filter.label"))}">
        <button type="button" class="pill glass" data-filter="all" aria-pressed="${filter === "all"}">${esc(t("filter.all"))} <span class="n">${active.length}</span></button>
        ${state.subjects.map((s) => `<button type="button" class="pill glass" data-filter="${esc(s.id)}" aria-pressed="${filter === s.id}"><span class="sdot"${scStyle(s)}></span>${esc(s.name)} <span class="n">${ac((x) => x.subjectId === s.id)}</span></button>`).join("")}
      </div>`;
    }

    const vis = visibleTasks();
    if (!vis.length) {
      h += `<div class="card empty">
        <span class="ico">${ICON.done}</span>
        <h3>${esc(t(filter === "all" ? "empty.tasks" : "empty.tasksSubj"))}</h3>
        <p>${esc(t("empty.tasksText"))}</p>
        <button type="button" class="btn-fill" data-action="newtask">${esc(t("btn.newTask"))}</button>
      </div>`;
    } else {
      for (const key of ["over", "now", "week", "later", "done"]) {
        const items = vis.filter((x) => groupOf(x) === key);
        if (!items.length) continue;
        const label = esc(t("g." + key));
        if (key === "done") {
          items.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
          h += `<section class="grp"><h2 class="sec-h"><span>${label} · ${items.length}</span>
            <button type="button" class="sec-btn" data-action="showdone" aria-expanded="${showDone}">${esc(t(showDone ? "hide" : "show"))}</button></h2>
            ${showDone ? `<div class="list">${items.map(taskRow).join("")}</div>` : ""}</section>`;
        } else {
          items.sort(byDue);
          h += `<section class="grp"><h2 class="sec-h ${key === "over" ? "c-over" : ""}"><span>${label} · ${items.length}</span></h2>
            <div class="list">${items.map(taskRow).join("")}</div></section>`;
        }
      }
    }
    el.innerHTML = h;
  }

  function renderCal() {
    const el = $("scr-cal");
    const vis = visibleTasks();
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const cells = Math.ceil((offset + new Date(y, m + 1, 0).getDate()) / 7) * 7;
    const byDay = {};
    vis.forEach((x) => { (byDay[x.due] = byDay[x.due] || []).push(x); });
    Object.values(byDay).forEach((a) => a.sort((p, q) => (p.done - q.done) || byDue(p, q)));
    const todayIso = iso(new Date());
    let h = navHeader(t("tab.cal"), "", navGroup(`<button type="button" class="nav-text-btn" data-action="caltoday">${esc(t("cal.today"))}</button>`, gearBtn()));
    h += `<div class="card cal-card">
      <div class="cal-top">
        <h3>${esc(fmtMonthTitle(calMonth))}</h3>
        <button type="button" class="icon-btn" data-action="calprev" aria-label="${esc(t("cal.prev"))}">${ICON.back}</button>
        <button type="button" class="icon-btn" data-action="calnext" aria-label="${esc(t("cal.next"))}">${ICON.chev}</button>
      </div>
      <div class="cal-week" aria-hidden="true">${F.wd.map((w) => `<span>${esc(w)}</span>`).join("")}</div>
      <div class="cal-grid">`;
    for (let i = 0; i < cells; i++) {
      const d = new Date(y, m, 1 - offset + i);
      const key = iso(d);
      const items = byDay[key] || [];
      const active = items.filter((x) => !x.done).length;
      const cls = ["cal-day", d.getMonth() !== m ? "out" : "", key === todayIso ? "today" : "", active >= 3 ? "heavy" : ""].filter(Boolean).join(" ");
      const dots = items.slice(0, 3).map((x) => `<i class="${x.done ? "done" : ""}"${scStyle(subjById(x.subjectId))}></i>`).join("");
      const label = `${F.long.format(d)}: ${items.length ? pn(items.length, "due") : t("cal.none")}`;
      h += `<button type="button" class="${cls}" data-action="selday" data-day="${key}" aria-pressed="${key === selDay}" aria-label="${esc(label)}">
        <span class="num">${d.getDate()}</span><span class="dots">${dots}</span></button>`;
    }
    h += `</div></div>`;
    const dayItems = byDay[selDay] || [];
    h += `<section class="grp">
      <h2 class="sec-h"><span>${esc(cap(F.long.format(parseDate(selDay))))}</span></h2>
      <div class="list">
        ${dayItems.length ? dayItems.map(taskRow).join("") : `<div class="row"><span class="grow muted-text">${esc(t("cal.empty"))}</span></div>`}
        <button type="button" class="row link-row" data-action="addday">${esc(t("cal.add"))}</button>
      </div>
      <p class="sec-f">${esc(t("cal.note"))}</p>
    </section>`;
    el.innerHTML = h;
  }

  function renderSched() {
    const el = $("scr-sched");
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const monday = startOfDay(now);
    monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7) + (schedWeek === "next" ? 7 : 0));
    const wi = weekInfo(monday);
    let h = navHeader(t("tab.sched"), state.classes.length ? t("weekTitle." + wi.parity) : "", navGroup(gearBtn(), plusBtn("addclass", t("sched.add"))));
    if (!state.classes.length) {
      h += `<div class="card empty">
        <span class="ico">${ICON.sched}</span>
        <h3>${esc(t("sched.emptyTitle"))}</h3>
        <p>${esc(t("sched.emptyText"))}</p>
        <button type="button" class="btn-fill" data-action="addclass">${esc(t("sched.add"))}</button>
      </div>`;
      el.innerHTML = h;
      return;
    }
    const vis = state.classes.filter((c) => filter === "all" || (filter === "none" ? !subjById(c.subjectId) : c.subjectId === filter));
    const inWeek = (c) => c.weeks === "all" || c.weeks === wi.parity;
    const byStart = (a, b) => toMin(a.start) - toMin(b.start);
    h += `<div class="segmented glass" role="tablist" aria-label="${esc(t("sched.week"))}">
      <button type="button" role="tab" data-action="schedweek" data-week="this" aria-selected="${schedWeek === "this"}">${esc(t("sched.this"))}</button>
      <button type="button" role="tab" data-action="schedweek" data-week="next" aria-selected="${schedWeek === "next"}">${esc(t("sched.nextWeek"))}</button>
    </div>`;
    if (schedWeek === "this") {
      const todays = vis.filter((c) => c.day === (now.getDay() + 6) % 7 && inWeek(c)).sort(byStart);
      const cur = todays.find((c) => toMin(c.start) <= mins && mins < toMin(c.end));
      const next = todays.find((c) => toMin(c.start) > mins);
      const sub = (c) => esc(classTypeName(c.type)) + (c.room ? " · " + esc(c.room) : "");
      let inner;
      if (cur) inner = `<p class="cap">${esc(t("sched.nowOn"))}</p><p>${esc(lessonName(cur))}</p><p class="s">${sub(cur)} · ${esc(t("sched.until", { t: cur.end, d: dur(toMin(cur.end) - mins) }))}</p>`;
      else if (next) inner = `<p class="cap">${esc(t("sched.nextClass"))}</p><p>${esc(lessonName(next))}</p><p class="s">${sub(next)} · ${esc(t("sched.at", { t: next.start, d: dur(toMin(next.start) - mins) }))}</p>`;
      else inner = `<p class="cap">${esc(t("sched.todayCap"))}</p><p>${esc(t(todays.length ? "sched.over" : "sched.noneToday"))}</p>`;
      h += `<div class="card now-card">${inner}</div>`;
    }
    const todayIso = iso(now);
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday); date.setDate(date.getDate() + i);
      const dIso = iso(date);
      const any = vis.some((c) => c.day === i);
      if (i >= 5 && !any) continue;
      const list = vis.filter((c) => c.day === i && inWeek(c)).sort(byStart);
      const isToday = dIso === todayIso;
      h += `<section class="grp"><h2 class="sec-h"><span>${esc(F.days[i])}${isToday ? esc(t("sched.todaySuffix")) : ""}</span><span>${esc(F.dm.format(date))}</span></h2><div class="list">`;
      if (!list.length) h += `<div class="row"><span class="grow muted-text">${esc(t(any ? "sched.noneWeek" : "sched.none"))}</span></div>`;
      for (const c of list) {
        const s = subjById(c.subjectId);
        const dues = c.subjectId ? state.tasks.filter((x) => !x.done && x.subjectId === c.subjectId && x.due === dIso) : [];
        const isNow = isToday && toMin(c.start) <= mins && mins < toMin(c.end);
        const badge = isNow ? `<span class="badge now">${esc(t("sched.now"))}</span>` : c.weeks !== "all" ? `<span class="badge">${esc(t(c.weeks === "odd" ? "sched.oddOnly" : "sched.evenOnly"))}</span>` : "";
        h += `<button type="button" class="row lesson ${isNow ? "now" : ""}" data-action="editclass" data-cid="${esc(c.id)}">
          <span class="time">${c.start}<small>${c.end}</small></span>
          <span class="info">
            <span class="t"><span class="sdot"${scStyle(s)}></span>${esc(lessonName(c))}</span>
            <span class="s">${esc(classTypeName(c.type))}${c.room ? " · " + esc(c.room) : ""}</span>
            ${dues.map((x) => `<span class="due">${esc(t("sched.due", { t: x.title }))}${x.time ? esc(t("sched.dueBy", { time: x.time })) : ""}</span>`).join("")}
          </span>
          ${badge}
        </button>`;
      }
      h += `</div></section>`;
    }
    h += `<p class="sec-f">${esc(t("sched.note"))}</p>`;
    el.innerHTML = h;
  }

  function renderSettings() {
    const el = $("scr-settings");
    const wi = weekInfo(new Date());
    let h = navHeader(t("settings"), "", "", `<button type="button" class="nav-btn-circle glass" data-action="back" aria-label="${esc(t("back"))}">${ICON.back}</button>`);
    if (state.examples) {
      h += `<section class="grp"><div class="list"><button type="button" class="row link-row" data-action="clearex">${esc(t("set.clearex"))}</button></div>
        <p class="sec-f">${esc(t("set.clearexNote"))}</p></section>`;
    }
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("set.lang"))}</span></h2><div class="list" role="radiogroup" aria-label="${esc(t("set.lang"))}">
      ${LANGS.map(([k, name]) => `<button type="button" class="row lang-row" role="radio" aria-checked="${lang === k}" data-lang-opt="${k}" lang="${k}"><span class="grow">${esc(name)}</span><span class="lang-check" aria-hidden="true">${lang === k ? ICON.check : ""}</span></button>`).join("")}
    </div></section>`;
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("set.appearance"))}</span></h2><div class="list">
      <div class="themes" role="radiogroup" aria-label="${esc(t("set.theme"))}">
        ${[["light", "theme.light", "pv-light"], ["dark", "theme.dark", "pv-dark"], ["system", "theme.auto", "pv-auto"]].map(([k, l, pv]) =>
          `<button type="button" class="theme-tile" role="radio" aria-checked="${appearance === k}" data-theme-opt="${k}"><span class="preview ${pv}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${esc(t(l))}</span><span class="radio" aria-hidden="true"></span></button>`).join("")}
      </div>
      <div class="row"><span class="grow">${esc(t("set.accent"))}</span><div class="accents" role="radiogroup" aria-label="${esc(t("set.accentLabel"))}">
        ${ACCENTS.map((k) => `<button type="button" class="swatch" role="radio" aria-checked="${accent === k}" aria-label="${esc(t("acc." + k))}" data-accent-opt="${k}" style="--sc: var(--acc-${k})"></button>`).join("")}
      </div></div>
    </div><p class="sec-f">${esc(t("set.autoNote", { x: IN_ARTIFACT ? t("set.autoClaude") : "" }))}</p></section>`;
    if (notifAvailable()) {
      const on = nconf.on;
      h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("set.notif"))}</span></h2><div class="list">
        <label class="row"><span class="grow">${esc(t("set.notifOn"))}</span><input type="checkbox" class="switch" id="n-on" ${on ? "checked" : ""}></label>
        ${on ? `<label class="row field"><span>${esc(t("set.notifEve"))}</span>${selectHTML("n-eve", N_EVE.map((v) => [v, v === "off" ? t("set.off") : t("set.at", { t: v + ":00" })]), nconf.eve)}</label>
        <label class="row field"><span>${esc(t("set.notifMorn"))}</span>${selectHTML("n-morn", N_MORN.map((v) => [v, v === "off" ? t("set.off") : t("set.at", { t: v.padStart(2, "0") + ":00" })]), nconf.morn)}</label>
        <label class="row field"><span>${esc(t("set.notifBefore"))}</span>${selectHTML("n-before", N_BEFORE.map((v) => [v, v ? t("set.before", { d: dur(v) }) : t("set.off")]), nconf.before)}</label>` : ""}
        <label class="row"><span class="grow">${esc(t("set.notifTimer"))}</span><input type="checkbox" class="switch" id="n-timer" ${nconf.timer ? "checked" : ""}></label>
        ${(on || nconf.timer) && exactAlarm === "denied" ? `<button type="button" class="row" data-action="exactalarm"><span class="grow">${esc(t("set.notifExact"))}</span><span class="chev">${ICON.chev}</span></button>` : ""}
      </div><p class="sec-f">${esc(t((on || nconf.timer) && exactAlarm === "denied" ? "set.notifExactNote" : "set.notifNote"))}</p></section>`;
    }
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("set.subjects"))}</span></h2><div class="list" style="--inset: 50px">
      ${state.subjects.map((s) => {
        const n = state.tasks.filter((x) => x.subjectId === s.id).length + state.classes.filter((c) => c.subjectId === s.id).length + state.grades.filter((x) => x.subjectId === s.id).length;
        return `<div class="row"><button type="button" class="minus" data-action="delsubj" data-sid="${esc(s.id)}" aria-label="${esc(t("set.delSubj", { n: s.name }))}"></button>
          <span class="sdot big"${scStyle(s)}></span><span class="grow">${esc(s.name)}</span><span class="cnt">${n || ""}</span></div>`;
      }).join("")}
      <button type="button" class="row link-row" data-action="addsubj"><span class="plus-c" aria-hidden="true"></span>${esc(t("set.addSubj"))}</button>
    </div></section>`;
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("set.weeks"))}</span></h2><div class="list">
      <label class="row"><span class="grow">${esc(t("set.flip"))}</span><input type="checkbox" class="switch" id="weekFlip" ${state.weekFlip ? "checked" : ""}></label>
    </div><p class="sec-f">${esc(t("set.flipNote", { p: parityWord(wi.parity) }))}</p></section>`;
    const minOpts = (arr) => arr.map((m) => [m, t("min", { m })]);
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("set.focus"))}</span></h2><div class="list">
      <label class="row field"><span>${esc(t("set.focusLen"))}</span>${selectHTML("s-focus", minOpts(TCONF_OPTS.focus), tconf.focus)}</label>
      <label class="row field"><span>${esc(t("set.short"))}</span>${selectHTML("s-short", minOpts(TCONF_OPTS.short), tconf.short)}</label>
      <label class="row field"><span>${esc(t("set.long"))}</span>${selectHTML("s-long", minOpts(TCONF_OPTS.long), tconf.long)}</label>
      <label class="row"><span class="grow">${esc(t("set.sound"))}</span><input type="checkbox" class="switch" id="s-sound" ${tconf.sound ? "checked" : ""}></label>
    </div><p class="sec-f">${esc(t("set.focusNote"))}</p></section>`;
    if (updSupported()) {
      const st = { checking: t("upd.checking"), latest: t("upd.latestShort"), fail: t("upd.failShort") }[upd.status] || "";
      h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("set.update"))}</span></h2><div class="list">
        <div class="row"><span class="grow">${esc(t("set.build", { v: VERSION, b: appBuild || "—" }))}</span></div>
        <button type="button" class="row link-row" data-action="updcheck"${upd.status === "checking" ? " disabled" : ""}><span class="grow">${esc(t("set.checkUpd"))}</span><span class="cnt">${esc(st)}</span></button>
        ${upd.status === "avail" ? `<a class="row link-row" href="${esc(upd.url)}" data-action="updget"><span class="grow">${esc(t("upd.get"))}</span><span class="cnt">${esc(String(upd.build))}</span></a>` : ""}
        <label class="row"><span class="grow">${esc(t("set.autoUpd"))}</span><input type="checkbox" class="switch" id="upd-auto" ${autoUpd ? "checked" : ""}></label>
      </div><p class="sec-f">${esc(t("set.updNote"))}</p></section>`;
    }
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("set.data"))}</span></h2><div class="list">
      <button type="button" class="row link-row" data-action="export">${esc(t("set.export"))}</button>
      <button type="button" class="row link-row" data-action="import">${esc(t("set.import"))}</button>
      <button type="button" class="row link-row danger" data-action="wipe">${esc(t("set.wipe"))}</button>
    </div><p class="sec-f">${esc(t(mode === "cloud" ? "set.whereCloud" : CAP ? "set.whereApp" : "set.whereLocal"))}</p></section>`;
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("set.privacy"))}</span></h2><div class="list">
      <button type="button" class="row" data-action="policy"><span class="grow">${esc(t("set.policy"))}</span><span class="chev">${ICON.chev}</span></button>
    </div></section>`;
    h += `<p class="status"><span class="s-dot"></span><span id="saveStatus"></span></p><p class="ver">${esc(t("set.version", { app: t("app"), v: VERSION }))}</p>`;
    el.innerHTML = h;
    setStatus(statusKind, statusExtraKey);
  }

  function renderTabbar() {
    $("tabbar").innerHTML = TABS.map(([k, icon]) =>
      `<button type="button" class="tab" data-tab="${k}" ${tab === k ? 'aria-current="page"' : ""}>${icon}<span>${esc(STR[lang]["tabbar." + k] || t("tab." + k))}</span></button>`).join("");
  }
  // Неизменные части страницы (подписи для экранных дикторов, заголовок окна, язык документа).
  function applyStatic() {
    document.documentElement.lang = lang;
    document.title = t("app");
    for (const k of ["tasks", "cal", "sched", "focus", "grades"]) $("scr-" + k).setAttribute("aria-label", t("tab." + k));
    $("scr-settings").setAttribute("aria-label", t("settings"));
    document.querySelector(".tabbar").setAttribute("aria-label", t("sections"));
    $("asCancel").textContent = t("cancel");
  }
  const SCREENS = { tasks: renderTasks, cal: renderCal, sched: renderSched, focus: renderFocus, grades: renderGrades, settings: renderSettings };
  function renderScreen() {
    if (!state) return;
    for (const k of Object.keys(SCREENS)) $("scr-" + k).hidden = k !== tab;
    SCREENS[tab]();
  }
  function render() {
    applyStatic();
    renderTabbar();
    if (!state) {
      $("scr-tasks").innerHTML = navHeader(t("tab.tasks"), t("loading"));
      return;
    }
    renderScreen();
    syncNotifications();
  }

  function tick() {
    if (!state) return;
    const busy = !$("sheetOv").hidden || !$("asOv").hidden || !$("menuPop").hidden;
    if (!busy && tab !== "settings") { const y = window.scrollY; renderScreen(); window.scrollTo(0, y); }
    else if (sheet && sheet.kind === "detail" && $("asOv").hidden) refreshSheet();
  }
  setInterval(tick, 30000);

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, ms = 2800) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  // ---------- sheets ----------
  const sh = { ov: $("sheetOv"), title: $("sheetTitle"), left: $("sheetLeft"), right: $("sheetRight"), body: $("sheetBody") };
  let sheet = null, lastFocus = null;
  function openSheet(cfg) {
    const wasOpen = !sh.ov.hidden;
    sheet = cfg;
    sh.title.textContent = cfg.title;
    sh.left.innerHTML = ICON.x;
    sh.left.setAttribute("aria-label", cfg.left || t("cancel"));
    sh.right.hidden = !cfg.right;
    sh.right.textContent = cfg.right || "";
    sh.right.classList.toggle("primary", cfg.rightStyle !== "plain");
    sh.body.innerHTML = cfg.html();
    if (!wasOpen) { lastFocus = document.activeElement; sh.ov.hidden = false; document.body.style.overflow = "hidden"; }
    sh.body.scrollTop = 0;
    setTimeout(() => { const f = cfg.focus && $(cfg.focus); (f || sh.left).focus(); }, 40);
  }
  function refreshSheet() {
    if (!sheet || !sheet.refresh) return;
    const y = sh.body.scrollTop;
    sh.body.innerHTML = sheet.html();
    sh.body.scrollTop = y;
  }
  function closeSheet() {
    closeMenu(false);
    sh.ov.hidden = true;
    sheet = null;
    document.body.style.overflow = "";
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  sh.left.addEventListener("click", () => (sheet && sheet.onLeft ? sheet.onLeft() : closeSheet()));
  sh.right.addEventListener("click", () => sheet && sheet.onOk && sheet.onOk());
  sh.ov.addEventListener("click", (e) => { if (e.target === sh.ov) closeSheet(); });

  // Action sheet: подтверждение действий внутри страницы, без системных диалогов.
  const as = { ov: $("asOv"), title: $("asTitle"), msg: $("asMsg"), ok: $("asOk"), cancel: $("asCancel") };
  let asResolve = null;
  function confirmAction({ title, message = "", label, destructive = true }) {
    return new Promise((res) => {
      as.title.textContent = title;
      as.msg.textContent = message;
      as.msg.hidden = !message;
      as.ok.textContent = label;
      as.ok.classList.toggle("danger", destructive);
      as.cancel.textContent = t("cancel");
      as.ov.hidden = false;
      asResolve = res;
      setTimeout(() => as.cancel.focus(), 40);
    });
  }
  function finishAction(v) {
    as.ov.hidden = true;
    const r = asResolve; asResolve = null;
    if (r) r(v);
  }
  as.ok.addEventListener("click", () => finishAction(true));
  as.cancel.addEventListener("click", () => finishAction(false));
  as.ov.addEventListener("click", (e) => { if (e.target === as.ov) finishAction(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!as.ov.hidden) finishAction(false);
    else if (!sh.ov.hidden) closeSheet();
  });
  // Системная кнопка «Назад» на Android: меню → подтверждение → лист → настройки → вкладка «Задачи» → выход.
  if (hasPlugin("App")) {
    try {
      CAP.addListener("App", "backButton", () => {
        if (!menu.pop.hidden) closeMenu();
        else if (!as.ov.hidden) finishAction(false);
        else if (!sh.ov.hidden) closeSheet();
        else if (tab === "settings") { tab = SCREENS[prevTab] && prevTab !== "settings" ? prevTab : "tasks"; setPref("tab", tab); renderTabbar(); renderScreen(); window.scrollTo(0, 0); }
        else if (tab !== "tasks") { tab = "tasks"; setPref("tab", tab); renderTabbar(); renderScreen(); window.scrollTo(0, 0); }
        else native("App", "minimizeApp").catch(() => native("App", "exitApp").catch(() => {}));
      });
    } catch {}
  }

  // Выпадающие списки — свои меню в стиле iOS (системный <select> плохо выглядит в тёмной теме на компьютере).
  // Значение хранится в скрытом input с тем же id, при выборе отправляется событие change.
  const menuOpts = {};
  const selectHTML = (id, options, value) => {
    menuOpts[id] = options;
    const cur = options.find(([v]) => String(v) === String(value)) || options[0];
    return `<span class="sel"><input type="hidden" id="${id}" value="${esc(cur[0])}"><button type="button" class="menu-btn" data-menu="${id}" aria-haspopup="listbox" aria-expanded="false"><span class="menu-val">${esc(cur[1])}</span>${ICON.updown}</button></span>`;
  };
  const menu = { pop: $("menuPop"), scrim: $("menuScrim"), btn: null, id: null };
  function openMenu(btn) {
    const id = btn.dataset.menu, opts = menuOpts[id], input = $(id);
    if (!opts || !input) return;
    menu.btn = btn; menu.id = id;
    menu.pop.innerHTML = opts.map(([v, l], i) =>
      (v === "__new" && i > 0 ? `<div class="menu-sep" role="separator"></div>` : "") +
      `<button type="button" class="menu-item ${v === "__new" ? "accent" : ""}" role="option" aria-selected="${String(v) === input.value}" data-val="${esc(v)}"><span class="check">${v === "__new" ? ICON.plus : ICON.check}</span><span class="grow">${esc(v === "__new" ? String(l).replace(/…$/, "") : l)}</span></button>`
    ).join("");
    if (opts.some(([v]) => v === "__new")) menu.pop.querySelector('[data-val="__new"] .check').style.visibility = "visible";
    menu.scrim.hidden = false; menu.pop.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    const r = btn.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    const w = menu.pop.offsetWidth, h = menu.pop.offsetHeight;
    const left = Math.min(Math.max(r.right - w, 16), vw - 16 - w);
    let top = r.bottom + 6;
    if (top + h > vh - 16) top = Math.max(16, r.top - 6 - h);
    menu.pop.style.left = left + "px";
    menu.pop.style.top = top + "px";
    const sel = menu.pop.querySelector('[aria-selected="true"]') || menu.pop.querySelector(".menu-item");
    if (sel) sel.focus();
  }
  function closeMenu(refocus = true) {
    if (menu.pop.hidden) return;
    menu.pop.hidden = true; menu.scrim.hidden = true;
    if (menu.btn) { menu.btn.setAttribute("aria-expanded", "false"); if (refocus && document.contains(menu.btn)) menu.btn.focus(); }
    menu.btn = null; menu.id = null;
  }
  function chooseMenu(item) {
    const input = $(menu.id), opts = menuOpts[menu.id], btn = menu.btn;
    const opt = opts && opts.find(([v]) => String(v) === item.dataset.val);
    if (!input || !opt) return closeMenu();
    input.value = String(opt[0]);
    btn.querySelector(".menu-val").textContent = opt[1];
    closeMenu();
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  document.addEventListener("keydown", (e) => {
    if (menu.pop.hidden) return;
    const items = [...menu.pop.querySelectorAll(".menu-item")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); closeMenu(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
  }, true);
  menu.scrim.addEventListener("click", () => closeMenu());
  menu.pop.addEventListener("click", (e) => { const it = e.target.closest(".menu-item"); if (it) chooseMenu(it); });
  const subjectOptions = (withNone) => (withNone ? [["", t("form.noSubject")]] : []).concat(state.subjects.map((s) => [s.id, s.name]), [["__new", t("form.newSubject")]]);

  function ensureSubject(rawName) {
    const name = cleanStr(rawName, 40);
    if (!name) return null;
    const existing = state.subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    if (state.subjects.length >= LIMITS.subjects) { toast(t("t.tooManySubj", { n: LIMITS.subjects })); return null; }
    const used = state.subjects.map((s) => s.color);
    const color = COLORS.find((c) => !used.includes(c)) || COLORS[state.subjects.length % COLORS.length];
    const s = { id: uid(), name, color };
    state.subjects.push(s);
    return s.id;
  }

  // Task detail
  function openDetail(id) {
    if (!state.tasks.some((x) => x.id === id)) return;
    openSheet({
      kind: "detail", id, title: t("detail.title"), left: t("close"), right: t("edit"), rightStyle: "plain", refresh: true,
      onOk: () => { const tt = state.tasks.find((x) => x.id === id); if (tt) openTaskForm(tt); },
      html: () => detailHTML(id)
    });
  }
  function detailHTML(id) {
    const x = state.tasks.find((y) => y.id === id);
    if (!x) return `<div class="card empty"><h3>${esc(t("detail.deleted"))}</h3></div>`;
    const s = subjById(x.subjectId);
    const u = urgency(x);
    const { n, d } = progress(x);
    const plan = x.done ? {} : stepPlan(x);
    const over = groupOf(x) === "over";
    let h = `<div class="detail-wrap" data-id="${esc(x.id)}">
      <div class="detail-head">
        <h3>${esc(x.title)}</h3>
        <p class="s">${s ? `<span class="sdot"${scStyle(s)}></span>${esc(s.name)} · ` : ""}${esc(kindName(x.kind))}</p>
        <p class="s">${esc(t("detail.due", { d: F.long.format(parseDate(x.due)) + (x.time ? ", " + x.time : "") }))}</p>
        <p class="u c-${u.cls}">${esc(cap(u.text))}</p>
      </div>
      <section class="grp"><h2 class="sec-h"><span>${esc(n ? t("detail.stepsOf", { d, n }) : t("detail.steps"))}</span></h2><div class="list">`;
    for (const st of x.steps) {
      const p = plan[st.id];
      h += `<div class="row step ${st.done ? "done" : ""}">
        <input type="checkbox" id="st-${esc(st.id)}" data-action="step" data-step="${esc(st.id)}" ${st.done ? "checked" : ""}>
        <label for="st-${esc(st.id)}">${esc(st.text)}</label>
        ${p ? `<span class="plan ${over ? "late" : ""}">${esc(planLabel(p))}</span>` : ""}
        <button type="button" class="x-btn" data-action="delstep" data-step="${esc(st.id)}" aria-label="${esc(t("detail.delStep", { s: st.text }))}">${ICON.x}</button>
      </div>`;
    }
    h += `<form class="row addstep" data-action="addstep">
        <span class="plus-tint" aria-hidden="true">${ICON.plus}</span>
        <input class="cell-input" id="addstep-input" placeholder="${esc(t("detail.newStep"))}" maxlength="120" autocomplete="off" aria-label="${esc(t("detail.newStep"))}">
      </form></div>`;
    if (!x.done && Object.keys(plan).length) h += `<p class="sec-f">${esc(t("detail.planNote"))}</p>`;
    else if (!x.steps.length) h += `<p class="sec-f">${esc(t("detail.splitNote"))}${kindSteps(x.kind).length ? ` <button type="button" class="link" data-action="suggest">${esc(t("detail.suggest"))}</button>` : ""}</p>`;
    h += `</section>
      <div class="list"><button type="button" class="row link-row" data-action="toggle">${esc(t(x.done ? "row.markUndone" : "row.markDone"))}</button></div>
      <div class="list"><button type="button" class="row link-row danger" data-action="deltask">${esc(t("detail.delete"))}</button></div>
    </div>`;
    return h;
  }

  // Task form
  function openTaskForm(x, presetDate) {
    const editing = !!x;
    const defDate = presetDate || (tab === "cal" && selDay >= iso(new Date()) ? selDay : iso(addDays(7)));
    const presetSubj = editing ? x.subjectId || "" : (filter !== "all" && filter !== "none" && subjById(filter) ? filter : "");
    openSheet({
      kind: "taskform", title: t(editing ? "form.edit" : "form.new"), left: t("cancel"), right: t(editing ? "done" : "add"),
      focus: "f-title",
      onLeft: () => (editing ? openDetail(x.id) : closeSheet()),
      onOk: () => saveTaskForm(editing ? x.id : null),
      html: () => `<form class="stack" data-action="sheetsubmit" novalidate>
        <div class="list"><div class="row"><input class="cell-input" id="f-title" maxlength="120" placeholder="${esc(t("form.what"))}" autocomplete="off" value="${editing ? esc(x.title) : ""}" aria-label="${esc(t("form.what"))}"></div></div>
        <p class="err" id="err-title" hidden>${esc(t("form.errTitle"))}</p>
        <div class="list">
          <label class="row field"><span>${esc(t("form.subject"))}</span>${selectHTML("f-subject", subjectOptions(true), presetSubj)}</label>
          <div class="row" id="f-newsubj-row" hidden><input class="cell-input" id="f-newsubj" maxlength="40" placeholder="${esc(t("form.newSubjName"))}" autocomplete="off" aria-label="${esc(t("form.newSubjName"))}"></div>
          <label class="row field"><span>${esc(t("form.kind"))}</span>${selectHTML("f-kind", KIND_LIST.map((k) => [k, kindName(k)]), editing ? x.kind : "hw")}</label>
        </div>
        <div class="list">
          <label class="row field"><span>${esc(t("form.due"))}</span><input type="date" class="pill-input" id="f-date" value="${editing ? x.due : defDate}"></label>
          <label class="row field"><span>${esc(t("form.time"))}</span><input type="time" class="pill-input" id="f-time" value="${editing ? x.time : ""}"></label>
        </div>
        <p class="err" id="err-date" hidden>${esc(t("form.errDate"))}</p>
        <section class="grp">
          <h2 class="sec-h"><span>${esc(t("form.steps"))}</span><button type="button" class="sec-btn" data-action="suggestform">${esc(t("form.suggest"))}</button></h2>
          <div class="list"><div class="row"><textarea class="cell-input" id="f-steps" rows="4" placeholder="${esc(t("form.stepsPh"))}" aria-label="${esc(t("form.stepsAria"))}">${editing ? esc(x.steps.map((s) => s.text).join("\n")) : ""}</textarea></div></div>
          <p class="sec-f">${esc(t("form.suggestNote"))}</p>
        </section>
        <button type="submit" hidden></button>
      </form>`
    });
  }
  function saveTaskForm(editingId) {
    const title = cleanStr($("f-title").value, 120);
    const due = $("f-date").value;
    $("err-title").hidden = !!title;
    $("err-date").hidden = validDate(due);
    if (!title) return $("f-title").focus();
    if (!validDate(due)) return $("f-date").focus();
    let subjectId = $("f-subject").value;
    if (subjectId === "__new") {
      if (!$("f-newsubj").value.trim()) { toast(t("t.needSubjName")); return $("f-newsubj").focus(); }
      subjectId = ensureSubject($("f-newsubj").value);
      if (!subjectId) return;
    }
    if (!editingId && state.tasks.length >= LIMITS.tasks) { toast(t("t.tooManyTasks")); return; }
    const kind = KIND_KEYS.has($("f-kind").value) ? $("f-kind").value : "hw";
    const time = validTime($("f-time").value) ? $("f-time").value : "";
    const lines = $("f-steps").value.split("\n").map((x) => cleanStr(x, 120)).filter(Boolean).slice(0, LIMITS.steps);
    const sid = subjById(subjectId) ? subjectId : null;
    if (editingId) {
      const x = state.tasks.find((y) => y.id === editingId);
      if (x) {
        const old = x.steps;
        Object.assign(x, { title, subjectId: sid, kind, due, time });
        x.steps = lines.map((text) => old.find((s) => s.text === text) || { id: uid(), text, done: false });
      }
      openDetail(editingId);
      commit();
      toast(t("t.saved"));
    } else {
      const x = { id: uid(), title, subjectId: sid, kind, due, time, steps: lines.map((text) => ({ id: uid(), text, done: false })), done: false, doneAt: null, createdAt: Date.now() };
      state.tasks.push(x);
      if (tab === "cal") { selDay = due; const d = parseDate(due); calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
      closeSheet();
      commit();
      const dd = dayDiff(x);
      toast(dd < 0 ? t("t.addedPast") : dd === 0 ? t("t.addedToday") : t("t.addedIn", { days: pn(dd, "day") }));
    }
  }

  // Class form
  function openClassForm(c) {
    const editing = !!c;
    const presetSubj = editing ? (c.subjectId || "__new") : (filter !== "all" && filter !== "none" && subjById(filter) ? filter : (state.subjects[0] ? state.subjects[0].id : "__new"));
    openSheet({
      kind: "classform", title: t(editing ? "class.edit" : "class.new"), left: t("cancel"), right: t(editing ? "done" : "add"),
      focus: presetSubj === "__new" ? "c-newsubj" : null,
      onOk: () => saveClassForm(editing ? c.id : null),
      html: () => `<form class="stack" data-action="sheetsubmit" novalidate>
        <div class="list">
          <label class="row field"><span>${esc(t("form.subject"))}</span>${selectHTML("c-subject", subjectOptions(false), presetSubj)}</label>
          <div class="row" id="c-newsubj-row" ${presetSubj === "__new" ? "" : "hidden"}><input class="cell-input" id="c-newsubj" maxlength="40" placeholder="${esc(t("class.subjName"))}" autocomplete="off" aria-label="${esc(t("class.subjName"))}"></div>
          <label class="row field"><span>${esc(t("class.type"))}</span>${selectHTML("c-type", CLASS_LIST.map((k) => [k, classTypeName(k)]), editing ? c.type : "lec")}</label>
        </div>
        <div class="list">
          <label class="row field"><span>${esc(t("class.day"))}</span>${selectHTML("c-day", F.days.map((d, i) => [i, d]), editing ? c.day : Math.min((new Date().getDay() + 6) % 7, 5))}</label>
          <label class="row field"><span>${esc(t("class.weeks"))}</span>${selectHTML("c-weeks", [["all", t("weeks.all")], ["odd", t("weeks.odd")], ["even", t("weeks.even")]], editing ? c.weeks : "all")}</label>
          <label class="row field"><span>${esc(t("class.start"))}</span><input type="time" class="pill-input" id="c-start" value="${editing ? c.start : "09:00"}"></label>
          <label class="row field"><span>${esc(t("class.end"))}</span><input type="time" class="pill-input" id="c-end" value="${editing ? c.end : "10:30"}" data-touched="${editing}"></label>
        </div>
        <p class="err" id="err-ctime" hidden>${esc(t("class.errTime"))}</p>
        <div class="list"><div class="row"><input class="cell-input" id="c-room" maxlength="30" placeholder="${esc(t("class.room"))}" autocomplete="off" value="${editing ? esc(c.room) : ""}" aria-label="${esc(t("class.roomAria"))}"></div></div>
        ${editing ? `<div class="list"><button type="button" class="row link-row danger" data-action="delclass" data-cid="${esc(c.id)}">${esc(t("class.delete"))}</button></div>` : ""}
        <button type="submit" hidden></button>
      </form>`
    });
  }
  function saveClassForm(editingId) {
    let subjectId = $("c-subject").value;
    if (subjectId === "__new" && !$("c-newsubj").value.trim()) { toast(t("t.needName")); return $("c-newsubj").focus(); }
    const start = $("c-start").value, end = $("c-end").value;
    const ok = validTime(start) && validTime(end) && toMin(end) > toMin(start);
    $("err-ctime").hidden = ok;
    if (!ok) return $("c-end").focus();
    if (!editingId && state.classes.length >= LIMITS.classes) { toast(t("t.tooManyClasses", { n: LIMITS.classes })); return; }
    if (subjectId === "__new") { subjectId = ensureSubject($("c-newsubj").value); if (!subjectId) return; }
    const data = {
      subjectId: subjById(subjectId) ? subjectId : null,
      day: Math.min(Math.max(parseInt($("c-day").value, 10) || 0, 0), 6),
      start, end,
      type: CLASS_KEYS.has($("c-type").value) ? $("c-type").value : "other",
      weeks: ["all", "odd", "even"].includes($("c-weeks").value) ? $("c-weeks").value : "all",
      room: cleanStr($("c-room").value, 30)
    };
    if (editingId) {
      const c = state.classes.find((x) => x.id === editingId);
      if (c) Object.assign(c, data);
      toast(t("t.classSaved"));
    } else {
      state.classes.push({ id: uid(), ...data });
      toast(t("t.classAdded", { day: dayLower(data.day), t: start }));
    }
    closeSheet();
    commit();
  }

  // Subject form
  let pickedColor = COLORS[0];
  const swatchesHTML = () => COLORS.map((c) => `<button type="button" class="swatch" role="radio" aria-checked="${c === pickedColor}" aria-label="${esc(t("col." + c))}" data-color="${c}" style="--sc: var(--sub-${c})"></button>`).join("");
  function openSubjectForm() {
    const used = state.subjects.map((s) => s.color);
    pickedColor = COLORS.find((c) => !used.includes(c)) || COLORS[0];
    openSheet({
      kind: "subjform", title: t("subj.new"), left: t("cancel"), right: t("add"), focus: "s-name",
      onOk: saveSubjectForm,
      html: () => `<form class="stack" data-action="sheetsubmit" novalidate>
        <div class="list"><div class="row"><input class="cell-input" id="s-name" maxlength="40" placeholder="${esc(t("subj.namePh"))}" autocomplete="off" aria-label="${esc(t("subj.nameAria"))}"></div></div>
        <section class="grp"><h2 class="sec-h"><span>${esc(t("subj.color"))}</span></h2>
          <div class="list"><div class="swatches" role="radiogroup" aria-label="${esc(t("subj.colorAria"))}" id="swatches">${swatchesHTML()}</div></div>
        </section>
        <button type="submit" hidden></button>
      </form>`
    });
  }
  function saveSubjectForm() {
    const name = cleanStr($("s-name").value, 40);
    if (!name) return $("s-name").focus();
    if (state.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) { toast(t("t.dupSubj")); return; }
    if (state.subjects.length >= LIMITS.subjects) { toast(t("t.tooManySubj", { n: LIMITS.subjects })); return; }
    state.subjects.push({ id: uid(), name, color: pickedColor });
    closeSheet();
    commit();
    toast(t("t.subjAdded", { n: name }));
  }

  // Privacy policy
  const POLICY = {
    ru: (cloud) => `
      <p class="muted">Действует с 22 октября 2026 года.</p>
      <h4>Какие данные</h4>
      <p>Только то, что ты вводишь сам: задания, предметы, даты сдачи, шаги, расписание пар, оценки и время занятий по таймеру. Приложение не спрашивает имя, телефон и почту, не определяет местоположение и не обращается к камере и микрофону.</p>
      <h4>Где хранятся</h4>
      ${cloud
        ? `<p>Данные хранятся в твоём аккаунте Claude, в личном разделе этого приложения. Его видишь только ты: ни автор приложения, ни люди, с которыми ты поделишься ссылкой, твои задания и расписание не увидят. Хранение обеспечивает Anthropic по своей политике конфиденциальности. Копия для быстрой загрузки лежит в хранилище браузера на этом устройстве.</p>`
        : `<p>Данные хранятся только в хранилище браузера (localStorage) на этом устройстве. У приложения нет своего сервера: задания и расписание никуда не отправляются.</p>${CAP ? `<p>Во внутренней памяти приложения на Android данные недоступны другим приложениям, а облачная копия Google для приложения отключена. Напоминания планируются на самом телефоне и никуда не отправляются; если не хочешь, чтобы название задания было видно на заблокированном экране, скрой содержимое уведомлений в настройках телефона. Чтобы проверить обновления, приложение запрашивает у GitHub номер последней версии (при запуске — не чаще раза в 6 часов, это можно выключить в настройках); GitHub видит только адрес подключения, данные приложения не передаются.</p>` : ""}`}
      <h4>Чего приложение не делает</h4>
      <ul><li>не показывает рекламу;</li><li>не собирает статистику и не ставит трекеры;</li><li>не продаёт и не передаёт данные третьим лицам.</li></ul>
      <h4>Сторонние сервисы</h4>
      <p>Приложение использует системный шрифт устройства и не обращается к сторонним сайтам${CAP ? ", кроме проверки обновлений на GitHub (см. выше)" : ""}.</p>
      <h4>Твой контроль</h4>
      <p>В настройках можно скачать резервную копию, загрузить её обратно и удалить все данные. Файл копии хранится там, куда ты его сохранил. Береги его как личный документ.</p>
      <h4>Защита</h4>
      <ul>
        <li>Весь текст выводится безопасно: введённые символы не исполняются как код.</li>
        <li>Данные из хранилища и из файлов проверяются, лишнее отбрасывается, размеры ограничены.</li>
        <li>Хранилище браузера не шифруется. Любой, кто получит доступ к твоему браузеру, сможет увидеть задания. Не записывай сюда пароли и документы.</li>
      </ul>
      <h4>Изменения</h4>
      <p>Если политика изменится, здесь обновится дата.</p>`,
    en: (cloud) => `
      <p class="muted">Effective October 22, 2026.</p>
      <h4>What data</h4>
      <p>Only what you enter yourself: tasks, subjects, due dates, steps, class schedule, grades and study time from the timer. The app doesn't ask for your name, phone number or email, doesn't track your location and doesn't use the camera or microphone.</p>
      <h4>Where it's stored</h4>
      ${cloud
        ? `<p>Your data is stored in your Claude account, in this app's private section. Only you can see it: neither the app's author nor people you share the link with can see your tasks or schedule. Storage is provided by Anthropic under its privacy policy. A copy for faster loading is kept in this device's browser storage.</p>`
        : `<p>Your data is stored only in browser storage (localStorage) on this device. The app has no server of its own: your tasks and schedule are never sent anywhere.</p>${CAP ? `<p>On Android, the data sits in the app's private storage that other apps can't read, and Google cloud backup is turned off for the app. Reminders are scheduled on the phone itself and are never sent anywhere; to keep task names off the lock screen, hide notification content in your phone settings. To check for updates, the app asks GitHub for the latest version number (on launch at most every 6 hours; you can turn this off in settings); GitHub only sees your connection address, and no app data is sent.</p>` : ""}`}
      <h4>What the app doesn't do</h4>
      <ul><li>show ads;</li><li>collect analytics or use trackers;</li><li>sell or share your data with third parties.</li></ul>
      <h4>Third-party services</h4>
      <p>The app uses your device's system font and doesn't contact any third-party websites${CAP ? ", except for checking GitHub for updates (see above)" : ""}.</p>
      <h4>Your control</h4>
      <p>In Settings you can download a backup, restore it and delete all data. The backup file stays wherever you save it. Keep it safe like any personal document.</p>
      <h4>Security</h4>
      <ul>
        <li>All text is displayed safely: what you type is never run as code.</li>
        <li>Data from storage and from files is validated, anything extra is discarded, and sizes are limited.</li>
        <li>Browser storage isn't encrypted. Anyone with access to your browser can see your tasks. Don't store passwords or documents here.</li>
      </ul>
      <h4>Changes</h4>
      <p>If this policy changes, the date above will be updated.</p>`,
    uz: (cloud) => `
      <p class="muted">2026-yil 22-oktabrdan amal qiladi.</p>
      <h4>Qanday maʼlumotlar</h4>
      <p>Faqat oʻzingiz kiritgan narsalar: topshiriqlar, fanlar, topshirish muddatlari, qadamlar, dars jadvali, baholar va taymer boʻyicha mashgʻulot vaqti. Ilova ism, telefon raqami yoki elektron pochtani soʻramaydi, joylashuvni aniqlamaydi, kamera va mikrofondan foydalanmaydi.</p>
      <h4>Qayerda saqlanadi</h4>
      ${cloud
        ? `<p>Maʼlumotlar Claude hisobingizda, ushbu ilovaning shaxsiy boʻlimida saqlanadi. Ularni faqat siz koʻrasiz: na ilova muallifi, na havolani ulashgan odamlaringiz topshiriq va jadvalingizni koʻra olmaydi. Saqlashni Anthropic oʻz maxfiylik siyosatiga muvofiq taʼminlaydi. Tez yuklash uchun nusxa shu qurilmadagi brauzer xotirasida turadi.</p>`
        : `<p>Maʼlumotlar faqat shu qurilmadagi brauzer xotirasida (localStorage) saqlanadi. Ilovaning oʻz serveri yoʻq: topshiriq va jadvallar hech qayerga yuborilmaydi.</p>${CAP ? `<p>Androidʼda maʼlumotlar ilovaning shaxsiy xotirasida turadi, boshqa ilovalar uni oʻqiy olmaydi, Google bulutiga zaxira nusxa olish esa oʻchirilgan. Eslatmalar telefonning oʻzida rejalashtiriladi va hech qayerga yuborilmaydi; vazifa nomi qulflangan ekranda koʻrinmasligi uchun telefon sozlamalarida bildirishnoma matnini yashiring. Yangilanishlarni tekshirish uchun ilova GitHubʼdan soʻnggi versiya raqamini soʻraydi (ishga tushganda 6 soatda bir martadan koʻp emas, buni sozlamalarda oʻchirish mumkin); GitHub faqat ulanish manzilini koʻradi, ilova maʼlumotlari yuborilmaydi.</p>` : ""}`}
      <h4>Ilova nima qilmaydi</h4>
      <ul><li>reklama koʻrsatmaydi;</li><li>statistika yigʻmaydi va kuzatuvchilarni oʻrnatmaydi;</li><li>maʼlumotlarni sotmaydi va uchinchi shaxslarga bermaydi.</li></ul>
      <h4>Uchinchi tomon xizmatlari</h4>
      <p>Ilova qurilmaning tizim shriftidan foydalanadi va${CAP ? " GitHubʼda yangilanishlarni tekshirishdan tashqari (yuqoriga qarang)" : ""} begona saytlarga murojaat qilmaydi.</p>
      <h4>Sizning nazoratingiz</h4>
      <p>Sozlamalarda zaxira nusxani yuklab olish, uni qayta tiklash va barcha maʼlumotlarni oʻchirish mumkin. Zaxira fayl siz saqlagan joyda turadi. Uni shaxsiy hujjat kabi asrang.</p>
      <h4>Himoya</h4>
      <ul>
        <li>Barcha matn xavfsiz koʻrsatiladi: kiritilgan belgilar kod sifatida bajarilmaydi.</li>
        <li>Xotira va fayllardan olingan maʼlumotlar tekshiriladi, ortiqchasi tashlab yuboriladi, hajmi cheklangan.</li>
        <li>Brauzer xotirasi shifrlanmaydi. Brauzeringizga kirish huquqi bor har kim topshiriqlarni koʻra oladi. Bu yerda parol va hujjatlarni saqlamang.</li>
      </ul>
      <h4>Oʻzgarishlar</h4>
      <p>Siyosat oʻzgarsa, yuqoridagi sana yangilanadi.</p>`
  };
  const policyHTML = () => `<div class="card policy">${(POLICY[lang] || POLICY.ru)(IN_ARTIFACT)}</div>`;

  // ---------- appearance (тема и акцент) ----------
  const getJSON = (k, def) => { try { const v = JSON.parse(localStorage.getItem(LS_KEY + ":" + k)); return v ?? def; } catch { return def; } };
  const setJSON = (k, v) => { try { localStorage.setItem(LS_KEY + ":" + k, JSON.stringify(v)); } catch {} };
  let appearance = pref("theme", ["system", "light", "dark"], "system");
  let accent = pref("accent", ACCENTS, "blue");
  const rootEl = document.documentElement;
  // Тему, которую выставил сам claude.ai (если открыто там), запоминаем, чтобы вернуть её в режиме «Авто».
  let viewerTheme = rootEl.getAttribute("data-theme");
  function applyAppearance() {
    if (appearance === "light" || appearance === "dark") rootEl.setAttribute("data-theme", appearance);
    else if (viewerTheme === "light" || viewerTheme === "dark") rootEl.setAttribute("data-theme", viewerTheme);
    else rootEl.removeAttribute("data-theme");
    if (accent !== "blue") rootEl.setAttribute("data-accent", accent); else rootEl.removeAttribute("data-accent");
    syncSystemBars();
  }
  // Цвет значков строки состояния на Android под текущую тему.
  function syncSystemBars() {
    if (!hasPlugin("SystemBars")) return;
    const th = rootEl.getAttribute("data-theme");
    const dark = th ? th === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    native("SystemBars", "setStyle", { style: dark ? "DARK" : "LIGHT" }).catch(() => {});
  }
  if (window.matchMedia) { try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => syncSystemBars()); } catch {} }
  new MutationObserver(() => {
    const cur = rootEl.getAttribute("data-theme");
    if (appearance === "system") viewerTheme = cur;
    else if (cur !== appearance) applyAppearance();
  }).observe(rootEl, { attributes: true, attributeFilter: ["data-theme"] });
  applyAppearance();

  // ---------- focus timer (помодоро) ----------
  const fmtMin = (m) => dur(m);
  const fmtShortMin = (m) => (!m ? "" : m < 60 ? t("bar.m", { m }) : t("bar.h", { h: F.num1.format(Math.round(m / 6) / 10) }));
  const fmtHM = (ms) => { const d = new Date(ms); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const fmtClock = (ms) => { const sec = Math.ceil(ms / 1000); return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0"); };
  function cleanTconf(c) {
    const o = { focus: 25, short: 5, long: 15, sound: true };
    if (c && typeof c === "object") {
      for (const k of ["focus", "short", "long"]) if (TCONF_OPTS[k].includes(c[k])) o[k] = c[k];
      if (typeof c.sound === "boolean") o.sound = c.sound;
    }
    return o;
  }
  let tconf = cleanTconf(getJSON("tconf", null));
  const newTimer = (phase, cycles = 0, subjectId = "") => {
    const total = tconf[phase] * 60000;
    return { phase, status: "idle", total, endsAt: 0, remaining: total, subjectId, cycles };
  };
  function loadTimer() {
    const x = getJSON("timer", null);
    const ok = x && typeof x === "object" && PHASES.includes(x.phase) && ["idle", "running", "paused"].includes(x.status) &&
      Number.isFinite(x.total) && x.total > 0 && x.total <= 4 * 36e5;
    if (!ok) return newTimer("focus");
    return {
      phase: x.phase, status: x.status, total: x.total, endsAt: Number(x.endsAt) || 0,
      remaining: Math.min(Math.max(Number(x.remaining) || 0, 0), x.total),
      subjectId: typeof x.subjectId === "string" && ID_RE.test(x.subjectId) ? x.subjectId : "",
      cycles: Math.min(Math.max(parseInt(x.cycles, 10) || 0, 0), 1000)
    };
  }
  let timer = loadTimer();
  const storeTimer = () => { setJSON("timer", timer); syncTimerNotif(); };
  const timerRemaining = () => (timer.status === "running" ? Math.max(0, timer.endsAt - Date.now()) : timer.remaining);

  let audioCtx = null;
  function ensureAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx && AC) audioCtx = new AC();
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    } catch {}
  }
  function beep() {
    if (!tconf.sound || !audioCtx) return;
    try {
      const t0 = audioCtx.currentTime;
      [0, 0.28, 0.56].forEach((d) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.22, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.2);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t0 + d); o.stop(t0 + d + 0.22);
      });
    } catch {}
  }
  function updateTimerUI(full) {
    if (tab !== "focus" || !state) return;
    if (full) { const y = window.scrollY; renderScreen(); window.scrollTo(0, y); return; }
    const el = $("timerTime"), r = $("timerRing");
    if (!el || !r) return;
    const rem = timerRemaining(), C = 2 * Math.PI * 108;
    el.textContent = fmtClock(rem);
    r.setAttribute("stroke-dashoffset", (C * (rem / timer.total)).toFixed(1));
  }
  function timerStart() {
    ensureAudio();
    if (timer.status === "running") return;
    timer.endsAt = Date.now() + (timer.status === "paused" ? timer.remaining : timer.total);
    timer.status = "running";
    storeTimer(); updateTimerUI(true);
  }
  function timerPause() {
    if (timer.status !== "running") return;
    timer.remaining = Math.max(0, timer.endsAt - Date.now());
    timer.status = "paused";
    storeTimer(); updateTimerUI(true);
  }
  function timerReset() { timer = newTimer(timer.phase, timer.cycles, timer.subjectId); storeTimer(); updateTimerUI(true); }
  function timerSetPhase(p) {
    if (timer.status !== "idle" || !PHASES.includes(p)) return;
    timer = newTimer(p, timer.cycles, timer.subjectId); storeTimer(); updateTimerUI(true);
  }
  function addSession(subjectId, start, minutes) {
    state.sessions.push({ id: uid(), subjectId: subjById(subjectId) ? subjectId : null, start, minutes: Math.min(Math.max(minutes, 1), 240) });
    if (state.sessions.length > LIMITS.sessions) state.sessions = state.sessions.slice(-LIMITS.sessions);
  }
  function timerFinish(record) {
    const wasFocus = timer.phase === "focus";
    let msg;
    if (wasFocus && record) {
      const minutes = Math.max(1, Math.round(timer.total / 60000));
      addSession(timer.subjectId, timer.endsAt - timer.total, minutes);
      timer.cycles++;
      const s = subjById(timer.subjectId);
      msg = t("focus.done", { m: minutes, s: s ? " · " + s.name : "" });
    } else if (wasFocus) msg = t("focus.skipped");
    else msg = t(record ? "focus.breakOver" : "focus.breakSkipped");
    const next = wasFocus ? (record && timer.cycles > 0 && timer.cycles % 4 === 0 ? "long" : "short") : "focus";
    timer = newTimer(next, timer.cycles, timer.subjectId);
    storeTimer();
    if (record) { beep(); scheduleSave(); }
    if (tab === "focus") { const y = window.scrollY; renderScreen(); window.scrollTo(0, y); }
    toast(msg, 4000);
  }
  setInterval(() => {
    if (!state) return;
    if (timer.status === "running" && Date.now() >= timer.endsAt) timerFinish(true);
    else if (timer.status === "running") updateTimerUI(false);
  }, 250);

  // ---------- уведомления (только Android, плагин LocalNotifications) ----------
  // Всё планируется на самом телефоне: без сервера и без интернета.
  const N_EVE = ["off", "18", "19", "20", "21"], N_MORN = ["off", "7", "8", "9", "10"], N_BEFORE = [0, 30, 60, 120, 180];
  const NID_TIMER = 1, NID_BASE = 1000, NID_SPAN = 1000, N_MAX = 64;
  function cleanNconf(c) {
    const o = { on: false, eve: "19", morn: "8", before: 60, timer: true };
    if (c && typeof c === "object") {
      if (typeof c.on === "boolean") o.on = c.on;
      if (N_EVE.includes(c.eve)) o.eve = c.eve;
      if (N_MORN.includes(c.morn)) o.morn = c.morn;
      if (N_BEFORE.includes(c.before)) o.before = c.before;
      if (typeof c.timer === "boolean") o.timer = c.timer;
    }
    return o;
  }
  let nconf = cleanNconf(getJSON("notif", null));
  let exactAlarm = "granted";
  const notifAvailable = () => hasPlugin("LocalNotifications");
  const LN = (method, opts) => native("LocalNotifications", method, opts);
  async function notifPermission(ask) {
    try {
      let p = await LN("checkPermissions");
      if (p && p.display === "granted") return true;
      if (!ask) return false;
      p = await LN("requestPermissions");
      return !!(p && p.display === "granted");
    } catch { return false; }
  }
  function notifChannels() {
    if (!notifAvailable()) return;
    // visibility 0 = «личное»: на заблокированном экране Android скрывает текст, если так настроено в телефоне.
    LN("createChannel", { id: "deadlines", name: t("ch.deadlines"), importance: 4, visibility: 0, vibration: true }).catch(() => {});
    LN("createChannel", { id: "timer", name: t("ch.timer"), importance: 4, visibility: 0, vibration: true }).catch(() => {});
  }
  async function refreshExact() {
    if (!notifAvailable()) return;
    try { const r = await LN("checkExactNotificationSetting"); exactAlarm = r && r.exact_alarm === "denied" ? "denied" : "granted"; } catch { exactAlarm = "granted"; }
    if (tab === "settings" && $("sheetOv").hidden) renderScreen();
  }
  const nDueAt = (x, days, h, m) => { const [Y, M, D] = x.due.split("-").map(Number); return new Date(Y, M - 1, D + days, h, m, 0, 0); };
  function deadlineNotifs() {
    if (!state || !nconf.on) return [];
    const now = Date.now() + 5000, out = [];
    for (const x of state.tasks) {
      if (x.done || x.ex || !DATE_RE.test(x.due)) continue;
      const s = subjById(x.subjectId), tail = s ? " · " + s.name : "";
      const [th, tm] = x.time ? x.time.split(":").map(Number) : [23, 59];
      const add = (at, body) => { if (at.getTime() > now) out.push({ at, title: x.title, body: body + tail, taskId: x.id }); };
      if (nconf.eve !== "off") add(nDueAt(x, -1, +nconf.eve, 0), x.time ? t("n.tomorrowAt", { t: x.time }) : t("n.tomorrow"));
      if (nconf.morn !== "off" && (!x.time || th * 60 + tm > +nconf.morn * 60 + 30)) add(nDueAt(x, 0, +nconf.morn, 0), x.time ? t("n.todayAt", { t: x.time }) : t("n.today"));
      if (nconf.before && x.time) add(new Date(nDueAt(x, 0, th, tm).getTime() - nconf.before * 60000), t("n.soon", { d: dur(nconf.before) }));
    }
    out.sort((a, b) => a.at - b.at);
    return out.slice(0, N_MAX).map((n, i) => ({
      id: NID_BASE + i, title: n.title, body: n.body, channelId: "deadlines", autoCancel: true,
      schedule: { at: n.at.toISOString(), allowWhileIdle: true }, extra: { taskId: n.taskId }
    }));
  }
  let nChain = Promise.resolve(), nSyncTimer = null;
  function syncNotifications() {
    if (!notifAvailable()) return;
    clearTimeout(nSyncTimer);
    nSyncTimer = setTimeout(() => { nChain = nChain.then(doSyncNotifications, doSyncNotifications); }, 700);
  }
  async function doSyncNotifications() {
    try {
      const pend = await LN("getPending");
      const old = ((pend && pend.notifications) || []).map((n) => Number(n.id)).filter((id) => id >= NID_BASE && id < NID_BASE + NID_SPAN);
      if (old.length) await LN("cancel", { notifications: old.map((id) => ({ id })) });
      const list = deadlineNotifs();
      if (list.length && (await notifPermission(false))) await LN("schedule", { notifications: list });
    } catch {}
  }
  function syncTimerNotif() {
    if (!notifAvailable()) return;
    nChain = nChain.then(async () => {
      try {
        await LN("cancel", { notifications: [{ id: NID_TIMER }] });
        if (!nconf.timer || timer.status !== "running" || timer.endsAt <= Date.now() + 1500) return;
        if (!(await notifPermission(true))) return;
        const focus = timer.phase === "focus";
        await LN("schedule", { notifications: [{
          id: NID_TIMER, title: t(focus ? "n.focusEnd" : "n.breakEnd"), body: t(focus ? "n.focusEndB" : "n.breakEndB"),
          channelId: "timer", autoCancel: true, schedule: { at: new Date(timer.endsAt).toISOString(), allowWhileIdle: true }, extra: { tab: "focus" }
        }] });
      } catch {}
    });
  }
  async function setNotifOn(on) {
    if (on && !(await notifPermission(true))) {
      nconf.on = false; setJSON("notif", nconf); renderScreen();
      toast(t("t.notifDenied"), 4500); return;
    }
    nconf.on = on; setJSON("notif", nconf);
    syncNotifications();
    if (on) { toast(t("t.notifOn")); await refreshExact(); }
    renderScreen();
  }
  function openFromNotification(extra, tries = 0) {
    if (!extra || typeof extra !== "object") return;
    if (!state) { if (tries < 20) setTimeout(() => openFromNotification(extra, tries + 1), 250); return; }
    closeMenu(false);
    if (!$("asOv").hidden) finishAction(false);
    if (typeof extra.taskId === "string" && ID_RE.test(extra.taskId) && state.tasks.some((x) => x.id === extra.taskId)) {
      tab = "tasks"; setPref("tab", tab); renderTabbar(); renderScreen(); openDetail(extra.taskId);
    } else if (extra.tab === "focus") {
      if (!sh.ov.hidden) closeSheet();
      tab = "focus"; setPref("tab", tab); renderTabbar(); renderScreen();
    }
  }
  if (notifAvailable()) {
    try {
      CAP.addListener("LocalNotifications", "localNotificationActionPerformed", (a) => openFromNotification(a && a.notification && a.notification.extra));
      if (hasPlugin("App")) CAP.addListener("App", "resume", () => { refreshExact(); syncNotifications(); });
    } catch {}
    notifChannels();
    refreshExact();
    syncTimerNotif();
  }

  // ---------- обновления (только Android): номер последней сборки из GitHub Releases ----------
  const UPDATE_REPO = "yusupovcoder/ontime";
  const UPDATE_API = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
  const UPDATE_DL = `https://github.com/${UPDATE_REPO}/releases/download/`;
  let appBuild = 0, upd = { status: "idle", build: 0, url: "" };
  const updSupported = () => !!CAP && hasPlugin("App");
  let autoUpd = pref("autoupd", ["1", "0"], "1") === "1";
  async function loadAppInfo() {
    try { const i = await native("App", "getInfo"); appBuild = parseInt(i && i.build, 10) || 0; } catch {}
  }
  function rerenderUpd() {
    if ((tab === "settings" || tab === "tasks") && $("sheetOv").hidden && $("menuPop").hidden) { const y = window.scrollY; renderScreen(); window.scrollTo(0, y); }
  }
  async function checkUpdate(manual) {
    if (!updSupported() || upd.status === "checking") return;
    upd = { status: "checking", build: 0, url: "" };
    if (manual) rerenderUpd();
    let ctl = null, to = null;
    try {
      if (!appBuild) await loadAppInfo();
      ctl = typeof AbortController === "function" ? new AbortController() : null;
      to = setTimeout(() => ctl && ctl.abort(), 10000);
      const r = await fetch(UPDATE_API, { headers: { Accept: "application/vnd.github+json" }, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error("http " + r.status);
      const j = await r.json();
      const m = /^b(\d{1,7})$/.exec((j && typeof j.tag_name === "string" && j.tag_name) || "");
      const asset = (j && Array.isArray(j.assets) ? j.assets : []).find((a) => a && a.name === "on-time.apk");
      const url = asset && typeof asset.browser_download_url === "string" ? asset.browser_download_url : "";
      if (!m || !url.startsWith(UPDATE_DL) || !/^[A-Za-z0-9/:._-]+$/.test(url)) throw new Error("bad release");
      const b = parseInt(m[1], 10);
      upd = b > appBuild ? { status: "avail", build: b, url } : { status: "latest", build: b, url: "" };
      setJSON("updLast", Date.now());
    } catch { upd = { status: "fail", build: 0, url: "" }; }
    finally { clearTimeout(to); }
    rerenderUpd();
    if (manual && upd.status === "latest") toast(t("upd.latest"));
    if (manual && upd.status === "fail") toast(t("upd.fail"), 4000);
  }
  const updBanner = () => (upd.status === "avail" && upd.build !== getJSON("updSkip", 0)
    ? `<div class="card banner upd"><p><b>${esc(t("upd.avail", { b: upd.build }))}</b><br>${esc(t("upd.how"))}</p>
        <a class="btn-tinted glass" href="${esc(upd.url)}" data-action="updget">${esc(t("upd.get"))}</a>
        <button type="button" class="btn-tinted glass" data-action="updlater">${esc(t("upd.later"))}</button></div>` : "");
  if (updSupported()) {
    loadAppInfo().then(() => {
      const last = Number(getJSON("updLast", 0)) || 0;
      if (autoUpd && Date.now() - last > 6 * 36e5) setTimeout(() => checkUpdate(false), 2500);
      else rerenderUpd();
    });
  }

  function weekStats() {
    const monday = startOfDay(new Date());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const t0 = monday.getTime(), t1 = t0 + 7 * DAY;
    const days = Array(7).fill(0), bySubj = {};
    for (const x of state.sessions) {
      if (x.start < t0 || x.start >= t1) continue;
      const i = Math.round((startOfDay(new Date(x.start)) - monday) / DAY);
      if (i < 0 || i > 6) continue;
      days[i] += x.minutes;
      const k = subjById(x.subjectId) ? x.subjectId : "";
      bySubj[k] = (bySubj[k] || 0) + x.minutes;
    }
    return { days, bySubj, total: days.reduce((a, b) => a + b, 0) };
  }

  function renderFocus() {
    const el = $("scr-focus");
    const ws = weekStats(), todayIdx = (new Date().getDay() + 6) % 7;
    let h = navHeader(t("tab.focus"), ws.days[todayIdx] ? t("focus.today", { d: fmtMin(ws.days[todayIdx]) }) : t("focus.todayNone"), navGroup(gearBtn()));
    const rem = timerRemaining(), C = 2 * Math.PI * 108;
    const running = timer.status === "running", paused = timer.status === "paused", idle = timer.status === "idle";
    const sub = running ? t("focus.endsAt", { t: fmtHM(timer.endsAt) }) : paused ? t("focus.paused") : timer.phase === "focus" ? t("focus.cycle", { c: (timer.cycles % 4) + 1 }) : t("ph." + timer.phase).toLowerCase();
    h += `<div class="card timer-card">
      <div class="segmented glass" role="tablist" aria-label="${esc(t("focus.mode"))}">
        ${[["focus", "ph.focus"], ["short", "ph.short"], ["long", "ph.longShort"]].map(([k, l]) =>
          `<button type="button" role="tab" data-action="phase" data-phase="${k}" aria-selected="${timer.phase === k}" ${!idle && timer.phase !== k ? "disabled" : ""}>${esc(t(l))}</button>`).join("")}
      </div>
      <div class="ring-wrap ${timer.phase !== "focus" ? "is-break" : ""}">
        <svg viewBox="0 0 240 240" aria-hidden="true"><circle class="ring-track" cx="120" cy="120" r="108"/><circle class="ring-prog" id="timerRing" cx="120" cy="120" r="108" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (rem / timer.total)).toFixed(1)}"/></svg>
        <div class="ring-center"><span class="ring-time" id="timerTime" role="timer">${fmtClock(rem)}</span><span class="ring-sub">${esc(sub)}</span></div>
      </div>
      <div class="timer-subject"><span>${esc(t("focus.subject"))}</span>${selectHTML("t-subject", [["", t("form.noSubject")]].concat(state.subjects.map((x) => [x.id, x.name])), subjById(timer.subjectId) ? timer.subjectId : "")}</div>
      <div class="timer-actions">
        <button type="button" class="round-btn glass" data-action="treset" aria-label="${esc(t("focus.reset"))}" ${idle ? "disabled" : ""}>${ICON.reset}</button>
        <button type="button" class="big-btn ${running ? "pause" : ""}" data-action="${running ? "tpause" : "tstart"}">${esc(t(running ? "focus.pause" : paused ? "focus.resume" : timer.phase === "focus" ? "focus.start" : "focus.rest"))}</button>
        <button type="button" class="round-btn glass" data-action="tskip" aria-label="${esc(t("focus.skip"))}">${ICON.skip}</button>
      </div>
    </div>`;
    const max = Math.max(60, ...ws.days);
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("focus.week"))}</span><span>${ws.total ? esc(fmtMin(ws.total)) : ""}</span></h2><div class="card">
      <div class="bars" role="img" aria-label="${esc(F.wd.map((d, i) => `${d}: ${dur(ws.days[i])}`).join(", "))}">
        ${ws.days.map((m, i) => `<div class="bar-col"><span class="bar-val">${esc(fmtShortMin(m))}</span><span class="bar ${i === todayIdx ? "today" : ""}" style="height: ${Math.max(3, Math.round((m / max) * 110))}px"></span></div>`).join("")}
      </div>
      <div class="bar-days">${F.wd.map((d, i) => `<span class="${i === todayIdx ? "today" : ""}">${esc(d)}</span>`).join("")}</div>
    </div></section>`;
    const entries = Object.entries(ws.bySubj).sort((a, b) => b[1] - a[1]);
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("focus.bySubj"))}</span></h2><div class="list">
      ${entries.length ? entries.map(([sid, m]) => {
        const s = subjById(sid);
        return `<div class="row share-row"><div class="share-head"><span class="grow"><span class="sdot"${scStyle(s)}></span>${esc(s ? s.name : t("form.noSubject"))}</span><span class="cnt">${esc(fmtMin(m))}</span></div>
          <div class="share"><i style="width: ${Math.max(2, Math.round((m / ws.total) * 100))}%${s ? `; --sc: var(--sub-${esc(s.color)})` : ""}"></i></div></div>`;
      }).join("") : `<div class="row"><span class="grow muted-text">${esc(t("focus.none"))}</span></div>`}
    </div><p class="sec-f">${esc(t("focus.note", { f: tconf.focus, s: tconf.short, l: tconf.long }))}</p></section>`;
    el.innerHTML = h;
  }

  // ---------- grades (оценки) ----------
  let gradeKind = "cur", gradeDate = iso(new Date()), lastGradeSid = null;
  let gradeTarget = pref("gtarget", TARGETS, "4.5");
  const avgOf = (list) => (list.length ? list.reduce((a, g) => a + g.value, 0) / list.length : null);
  const fmtAvg = (n) => (n == null ? "—" : F.num2.format(n));
  const avgCls = (n) => (n == null ? "muted-text" : n >= 4.5 ? "g-hi" : n >= 3.5 ? "g-mid" : n >= 2.5 ? "g-lo" : "g-bad");
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const chip = (g, tag = "span", extra = "") => `<${tag} ${tag === "button" ? 'type="button" ' : ""}class="gchip v${g.value} ${g.kind === "exam" ? "exam" : ""}" ${extra}>${g.value}</${tag}>`;
  function targetInfo(list, target) {
    if (!list.length) return { cls: "muted-text", text: t("tg.first") };
    const sum = list.reduce((a, g) => a + g.value, 0), n = list.length;
    if (sum / n >= target - 1e-9) return { cls: "g-hi", text: t("tg.reached") };
    if (target >= 5) return { cls: "g-lo", text: t("tg.impossible") };
    const k = Math.ceil((target * n - sum) / (5 - target) - 1e-9);
    return { cls: "g-mid", text: t("tg.need", { n: k, w: pf(k, "five") }) };
  }

  function renderGrades() {
    const el = $("scr-grades");
    const all = state.grades;
    let h = navHeader(t("tab.grades"), all.length ? pn(all.length, "grade") : "", navGroup(gearBtn(), plusBtn("newgrade", t("gr.new"))));
    if (!state.subjects.length) {
      h += `<div class="card empty"><span class="ico">${ICON.grades}</span><h3>${esc(t("gr.needSubjTitle"))}</h3>
        <p>${esc(t("gr.needSubjText"))}</p>
        <button type="button" class="btn-fill" data-action="addsubj">${esc(t("set.addSubj"))}</button></div>`;
      el.innerHTML = h; return;
    }
    if (!all.length) {
      h += `<div class="card empty"><span class="ico">${ICON.grades}</span><h3>${esc(t("gr.emptyTitle"))}</h3>
        <p>${esc(t("gr.emptyText"))}</p>
        <button type="button" class="btn-fill" data-action="newgrade">${esc(t("gr.addBtn"))}</button></div>`;
    } else {
      const a = avgOf(all), threes = all.filter((g) => g.value === 3).length, twos = all.filter((g) => g.value === 2).length;
      const exams = all.filter((g) => g.kind === "exam");
      h += `<div class="card avg-card"><p class="cap">${esc(t("gr.avg"))}</p><p class="avg-big ${avgCls(a)}">${fmtAvg(a)}</p>
        <div class="badges">
          ${!threes && !twos ? `<span class="badge good">${esc(t("gr.noThrees"))}</span>` : ""}
          ${threes ? `<span class="badge warn">${esc(t("gr.threes", { n: threes }))}</span>` : ""}
          ${twos ? `<span class="badge bad">${esc(t("gr.twos", { n: twos }))}</span>` : ""}
          ${exams.length ? `<span class="badge">${esc(t("gr.exams", { a: fmtAvg(avgOf(exams)) }))}</span>` : ""}
        </div></div>`;
    }
    h += `<section class="grp"><h2 class="sec-h"><span>${esc(t("gr.subjects"))}</span></h2><div class="list">
      ${state.subjects.map((s) => {
        const gs = state.grades.filter((g) => g.subjectId === s.id).sort(byDate);
        const av = avgOf(gs);
        return `<button type="button" class="row grade-row" data-action="opensubjgrades" data-sid="${esc(s.id)}">
          <span class="grow grade-text"><span class="t"><span class="sdot"${scStyle(s)}></span>${esc(s.name)}</span>
            ${gs.length ? `<span class="gchips">${gs.slice(-8).map((g) => chip(g)).join("")}</span>` : `<span class="s muted-text">${esc(t("gr.noneYet"))}</span>`}</span>
          <span class="grade-avg ${avgCls(av)}">${fmtAvg(av)}</span><span class="chev">${ICON.chev}</span></button>`;
      }).join("")}
    </div><p class="sec-f">${esc(t("gr.note"))}</p></section>`;
    el.innerHTML = h;
  }
  const pickerHTML = () => `<div class="grade-picker">${[2, 3, 4, 5].map((v) => `<button type="button" class="grade-btn v${v}" data-action="addgrade" data-v="${v}" aria-label="${esc(t("gr.put", { v }))}">${v}</button>`).join("")}</div>`;
  const gradeFields = () => `<label class="row field"><span>${esc(t("gr.kind"))}</span>${selectHTML("g-kind", GRADE_LIST.map((k) => [k, gradeKindName(k)]), gradeKind)}</label>
      <label class="row field"><span>${esc(t("gr.date"))}</span><input type="date" class="pill-input" id="g-date" value="${esc(gradeDate)}"></label>`;
  const targetOpts = () => TARGETS.map((v) => [v, F.numT.format(Number(v))]);
  function subjGradesHTML(sid) {
    const s = subjById(sid);
    if (!s) return `<div class="card empty"><h3>${esc(t("gr.subjDeleted"))}</h3></div>`;
    const gs = state.grades.filter((g) => g.subjectId === sid).sort(byDate);
    const av = avgOf(gs), ti = targetInfo(gs, Number(gradeTarget));
    return `<div class="detail-wrap">
      <div class="detail-head"><h3>${esc(s.name)}</h3>
        <p class="s">${gs.length ? `${esc(t("gr.avg"))} <b class="${avgCls(av)}">${fmtAvg(av)}</b> · ${esc(pn(gs.length, "grade"))}` : esc(t("gr.noneYet"))}</p></div>
      <section class="grp"><h2 class="sec-h"><span>${esc(t("gr.putTitle"))}</span></h2><div class="list">${pickerHTML()}${gradeFields()}</div></section>
      <section class="grp"><h2 class="sec-h"><span>${esc(t("gr.list"))}${gs.length ? " · " + gs.length : ""}</span></h2><div class="list">
        ${gs.length ? `<div class="gchips big">${gs.map((g) => chip(g, "button", `data-action="delgrade" data-gid="${esc(g.id)}" aria-label="${esc(t("gr.delAria", { v: g.value, k: gradeKindName(g.kind).toLowerCase(), d: F.dm.format(parseDate(g.date)) }))}"`)).join("")}</div>`
          : `<div class="row"><span class="grow muted-text">${esc(t("gr.listEmpty"))}</span></div>`}
      </div>${gs.length ? `<p class="sec-f">${esc(t("gr.listNote"))}</p>` : ""}</section>
      <section class="grp"><h2 class="sec-h"><span>${esc(t("gr.goal"))}</span></h2><div class="list">
        <label class="row field"><span>${esc(t("gr.want"))}</span>${selectHTML("g-target", targetOpts(), gradeTarget)}</label>
        <div class="row"><span class="grow target-result ${ti.cls}" id="target-result">${esc(ti.text)}</span></div>
      </div></section>
    </div>`;
  }
  function openSubjectGrades(sid) {
    if (!subjById(sid)) return;
    gradeDate = iso(new Date());
    openSheet({ kind: "subjgrades", sid, title: t("gr.list"), left: t("close"), refresh: true, html: () => subjGradesHTML(sid) });
  }
  function openNewGrade() {
    if (!state.subjects.length) { toast(t("t.needSubjFirst")); return openSubjectForm(); }
    const def = filter !== "all" && subjById(filter) ? filter : lastGradeSid && subjById(lastGradeSid) ? lastGradeSid : state.subjects[0].id;
    gradeDate = iso(new Date());
    openSheet({
      kind: "newgrade", title: t("gr.new"), left: t("cancel"),
      html: () => `<div class="stack">
        <div class="list"><label class="row field"><span>${esc(t("form.subject"))}</span>${selectHTML("ng-subject", state.subjects.map((x) => [x.id, x.name]), def)}</label>${gradeFields()}</div>
        <section class="grp"><h2 class="sec-h"><span>${esc(t("gr.gradeTitle"))}</span></h2><div class="list">${pickerHTML()}</div><p class="sec-f">${esc(t("gr.pickNote"))}</p></section>
      </div>`
    });
  }
  function addGrade(sid, v) {
    if (!subjById(sid) || ![2, 3, 4, 5].includes(v)) return;
    if (state.grades.length >= LIMITS.grades) { toast(t("t.tooManyGrades")); return; }
    state.grades.push({ id: uid(), subjectId: sid, value: v, kind: GRADE_KIND_KEYS.has(gradeKind) ? gradeKind : "cur", date: validDate(gradeDate) ? gradeDate : iso(new Date()) });
    lastGradeSid = sid;
    if (sheet && sheet.kind === "newgrade") closeSheet();
    commit();
    toast(t("t.gradeAdded", { v, s: subjById(sid).name }));
  }

  // ---------- language switch ----------
  function setLang(next) {
    if (!LANGS.some(([k]) => k === next) || next === lang) return;
    lang = next;
    setPref("lang", lang);
    makeFormats();
    const changed = relocalizeExamples();
    render();
    if (changed) scheduleSave();
    notifChannels(); syncTimerNotif();
  }

  // ---------- actions ----------
  async function exportData() {
    const payload = JSON.stringify({ app: "sdam-vovremya", format: 1, exportedAt: new Date().toISOString(), data: state }, null, 2);
    const filename = `on-time-backup-${iso(new Date())}.json`;
    if (IN_ARTIFACT) {
      let dl = null;
      try { dl = await window.claude.use("downloads"); } catch {}
      if (!dl) { toast(t("t.dlUnavailable"), 4000); return; }
      try { await dl.save({ filename, data: payload }); toast(t("t.backupSaved")); }
      catch (e) { if (!(e && e.code === "declined")) toast(t("t.saveFailLater")); }
      return;
    }
    if (hasPlugin("Filesystem") && hasPlugin("Share")) {
      try {
        const res = await native("Filesystem", "writeFile", { path: filename, data: payload, directory: "CACHE", encoding: "utf8" });
        await native("Share", "share", { title: filename, url: res && res.uri, dialogTitle: t("app") });
        toast(t("t.backupSaved"));
      } catch (e) {
        if (!/cancel/i.test(String((e && e.message) || e))) toast(t("t.saveFail"));
      }
      return;
    }
    try {
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(t("t.backupSaved"));
    } catch { toast(t("t.saveFail")); }
  }
  $("importFile").addEventListener("change", async (e) => {
    const input = e.target;
    const f = input.files && input.files[0];
    input.value = "";
    if (!f) return;
    if (f.size > LIMITS.importBytes) return toast(t("t.tooBig"), 4000);
    let obj;
    try { obj = JSON.parse(await f.text()); } catch { return toast(t("t.badFile"), 4000); }
    const raw = obj && typeof obj === "object" && obj.app === "sdam-vovremya" ? obj.data : obj;
    const clean = sanitize(raw);
    if (!clean || (!clean.tasks.length && !clean.subjects.length && !clean.classes.length)) return toast(t("t.emptyFile"), 4000);
    const parts = [pn(clean.tasks.length, "task"), pn(clean.subjects.length, "subject"), pn(clean.classes.length, "class")].join(", ");
    if (!(await confirmAction({ title: t("c.import"), message: t("c.importMsg", { parts }), label: t("c.importBtn") }))) return;
    state = clean;
    filter = "all"; showDone = false;
    commit();
    toast(t("t.imported"));
  });

  function toggleTask(x) {
    x.done = !x.done;
    x.doneAt = x.done ? Date.now() : null;
    commit();
    if (x.done) {
      const left = state.tasks.filter((y) => !y.done).length;
      toast(left ? t("t.doneLeft", { tasks: pn(left, "task") }) : t("t.doneAll"));
    }
  }

  function clearExamples() {
    state.tasks = state.tasks.filter((x) => !x.ex);
    state.classes = state.classes.filter((c) => !c.ex);
    state.grades = state.grades.filter((x) => !x.ex);
    state.sessions = state.sessions.filter((x) => !x.ex);
    const used = new Set([...state.tasks, ...state.classes, ...state.grades, ...state.sessions].map((x) => x.subjectId));
    state.subjects = state.subjects.filter((s) => !s.ex || used.has(s.id));
    state.examples = false;
    filter = "all";
    commit();
    toast(t("t.exRemoved"));
  }

  document.addEventListener("click", async (e) => {
    const mBtn = e.target.closest("[data-menu]");
    if (mBtn) { openMenu(mBtn); return; }
    const tabBtn = e.target.closest("[data-tab]");
    if (tabBtn) {
      const next = SCREENS[tabBtn.dataset.tab] ? tabBtn.dataset.tab : "tasks";
      if (next === "settings" && tab !== "settings") prevTab = tab;
      tab = next; setPref("tab", tab);
      renderTabbar(); renderScreen(); window.scrollTo(0, 0);
      return;
    }
    if (!state) return;
    const lBtn = e.target.closest("[data-lang-opt]");
    if (lBtn) { setLang(lBtn.dataset.langOpt); return; }
    const fBtn = e.target.closest("[data-filter]");
    if (fBtn) {
      filter = fBtn.dataset.filter;
      try { localStorage.setItem(LS_KEY + ":filter", filter); } catch {}
      renderScreen(); return;
    }
    const thBtn = e.target.closest("[data-theme-opt]");
    if (thBtn) {
      appearance = ["light", "dark", "system"].includes(thBtn.dataset.themeOpt) ? thBtn.dataset.themeOpt : "system";
      setPref("theme", appearance); applyAppearance(); renderScreen(); return;
    }
    const acBtn = e.target.closest("[data-accent-opt]");
    if (acBtn) {
      accent = ACCENTS.includes(acBtn.dataset.accentOpt) ? acBtn.dataset.accentOpt : "blue";
      setPref("accent", accent); applyAppearance(); renderScreen(); return;
    }
    const sw = e.target.closest("[data-color]");
    if (sw) { pickedColor = COLORS.includes(sw.dataset.color) ? sw.dataset.color : COLORS[0]; $("swatches").innerHTML = swatchesHTML(); return; }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const holder = btn.closest("[data-id]");
    const x = holder ? state.tasks.find((y) => y.id === holder.dataset.id) : null;
    switch (action) {
      case "newtask": return openTaskForm();
      case "updcheck": return checkUpdate(true);
      case "updget": toast(t("upd.how"), 6000); return;
      case "updlater": setJSON("updSkip", upd.build); renderScreen(); return;
      case "exactalarm":
        try { await LN("changeExactNotificationSetting"); } catch {}
        await refreshExact(); syncNotifications(); syncTimerNotif(); return;
      case "back":
        tab = SCREENS[prevTab] && prevTab !== "settings" ? prevTab : "tasks";
        setPref("tab", tab); renderTabbar(); renderScreen(); window.scrollTo(0, 0); return;
      case "phase": return timerSetPhase(btn.dataset.phase);
      case "tstart": return timerStart();
      case "tpause": return timerPause();
      case "treset": return timerReset();
      case "tskip":
        if (timer.status !== "idle" && timer.phase === "focus" &&
            !(await confirmAction({ title: t("c.skip"), message: t("c.skipMsg"), label: t("c.skipBtn") }))) return;
        return timerFinish(false);
      case "newgrade": return openNewGrade();
      case "opensubjgrades": return openSubjectGrades(btn.dataset.sid);
      case "addgrade": {
        const sid = sheet && sheet.kind === "newgrade" ? $("ng-subject").value : sheet && sheet.sid;
        return addGrade(sid, parseInt(btn.dataset.v, 10));
      }
      case "delgrade": {
        const g = state.grades.find((y) => y.id === btn.dataset.gid);
        if (!g) return;
        if (!(await confirmAction({ title: t("c.delGrade", { v: g.value }), message: `${gradeKindName(g.kind)}, ${F.dm.format(parseDate(g.date))}.`, label: t("btn.delGrade") }))) return;
        state.grades = state.grades.filter((y) => y.id !== g.id);
        commit(); toast(t("t.gradeDeleted")); return;
      }
      case "open": if (x) openDetail(x.id); return;
      case "toggle": if (x) toggleTask(x); return;
      case "showdone": showDone = !showDone; renderScreen(); return;
      case "clearex": return clearExamples();
      case "calprev": case "calnext": {
        calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + (action === "calnext" ? 1 : -1), 1);
        renderScreen();
        const again = document.querySelector(`[data-action="${action}"]`); if (again) again.focus();
        return;
      }
      case "caltoday": { const n = new Date(); calMonth = new Date(n.getFullYear(), n.getMonth(), 1); selDay = iso(n); renderScreen(); return; }
      case "selday": {
        selDay = btn.dataset.day;
        const d = parseDate(selDay);
        if (d.getMonth() !== calMonth.getMonth() || d.getFullYear() !== calMonth.getFullYear()) calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        renderScreen();
        const again = document.querySelector(`[data-day="${selDay}"]`); if (again) again.focus();
        return;
      }
      case "addday": return openTaskForm(null, selDay);
      case "schedweek": schedWeek = btn.dataset.week === "next" ? "next" : "this"; renderScreen(); return;
      case "addclass": return openClassForm();
      case "editclass": { const c = state.classes.find((y) => y.id === btn.dataset.cid); if (c) openClassForm(c); return; }
      case "delclass": {
        if (!(await confirmAction({ title: t("c.delClass"), label: t("class.delete") }))) return;
        state.classes = state.classes.filter((y) => y.id !== btn.dataset.cid);
        closeSheet(); commit(); toast(t("t.classDeleted")); return;
      }
      case "addsubj": return openSubjectForm();
      case "delsubj": {
        const s = subjById(btn.dataset.sid);
        if (!s) return;
        const n = state.tasks.filter((y) => y.subjectId === s.id).length + state.classes.filter((c) => c.subjectId === s.id).length;
        if (!(await confirmAction({ title: t("c.delSubj", { n: s.name }), message: n ? t("c.delSubjMsg") : "", label: t("btn.delSubj") }))) return;
        state.subjects = state.subjects.filter((y) => y.id !== s.id);
        state.tasks.forEach((y) => { if (y.subjectId === s.id) y.subjectId = null; });
        state.classes.forEach((c) => { if (c.subjectId === s.id) c.subjectId = null; });
        state.grades = state.grades.filter((y) => y.subjectId !== s.id);
        state.sessions.forEach((y) => { if (y.subjectId === s.id) y.subjectId = null; });
        if (filter === s.id) filter = "all";
        commit(); toast(t("t.subjDeleted")); return;
      }
      case "export": return exportData();
      case "import": return $("importFile").click();
      case "wipe": {
        if (!(await confirmAction({ title: t("c.wipe"), message: t("c.wipeMsg"), label: t("c.wipeBtn") }))) return;
        state = { v: 1, examples: false, weekFlip: false, subjects: [], tasks: [], classes: [], grades: [], sessions: [] };
        filter = "all";
        try { localStorage.removeItem(LS_KEY + ":filter"); } catch {}
        commit(); toast(t("t.wiped")); return;
      }
      case "policy": return openSheet({ kind: "policy", title: t("policy.title"), left: t("close"), html: policyHTML });
      case "suggestform": {
        const area = $("f-steps");
        const have = area.value.split("\n").map((y) => y.trim()).filter(Boolean);
        area.value = have.concat(kindSteps($("f-kind").value).filter((y) => !have.includes(y))).join("\n");
        area.focus(); return;
      }
      case "suggest":
        if (x) { x.steps = x.steps.concat(kindSteps(x.kind).map((text) => ({ id: uid(), text, done: false }))).slice(0, LIMITS.steps); commit(); }
        return;
      case "delstep": if (x) { x.steps = x.steps.filter((s) => s.id !== btn.dataset.step); commit(); } return;
      case "deltask": {
        if (!x) return;
        if (!(await confirmAction({ title: t("c.delTask", { t: x.title }), message: t("c.delTaskMsg"), label: t("detail.delete") }))) return;
        state.tasks = state.tasks.filter((y) => y.id !== x.id);
        closeSheet(); commit(); toast(t("t.taskDeleted")); return;
      }
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (!state) return;
    if (el.id === "weekFlip") {
      state.weekFlip = el.checked;
      commit();
      toast(t("t.parity", { p: parityWord(weekInfo(new Date()).parity) }));
      return;
    }
    if (el.id === "t-subject") { timer.subjectId = subjById(el.value) ? el.value : ""; storeTimer(); return; }
    if (["s-focus", "s-short", "s-long"].includes(el.id)) {
      const k = el.id.slice(2), v = parseInt(el.value, 10);
      if (TCONF_OPTS[k].includes(v)) { tconf[k] = v; setJSON("tconf", tconf); if (timer.status === "idle") { timer = newTimer(timer.phase, timer.cycles, timer.subjectId); storeTimer(); } }
      return;
    }
    if (el.id === "n-on") { setNotifOn(el.checked); return; }
    if (el.id === "upd-auto") { autoUpd = el.checked; setPref("autoupd", autoUpd ? "1" : "0"); return; }
    if (el.id === "n-timer") {
      nconf.timer = el.checked; setJSON("notif", nconf);
      if (el.checked) notifPermission(true).then((ok) => { if (!ok) toast(t("t.notifDenied"), 4500); refreshExact(); });
      syncTimerNotif(); renderScreen(); return;
    }
    if (["n-eve", "n-morn", "n-before"].includes(el.id)) {
      const k = el.id.slice(2), v = k === "before" ? parseInt(el.value, 10) : el.value;
      if ((k === "eve" ? N_EVE : k === "morn" ? N_MORN : N_BEFORE).includes(v)) { nconf[k] = v; setJSON("notif", nconf); syncNotifications(); }
      return;
    }
    if (el.id === "s-sound") { tconf.sound = el.checked; setJSON("tconf", tconf); if (el.checked) { ensureAudio(); beep(); } return; }
    if (el.id === "g-kind") { gradeKind = GRADE_KIND_KEYS.has(el.value) ? el.value : "cur"; return; }
    if (el.id === "g-target") { gradeTarget = TARGETS.includes(el.value) ? el.value : "4.5"; setPref("gtarget", gradeTarget); refreshSheet(); return; }
    if (el.id === "g-date") { if (validDate(el.value)) gradeDate = el.value; return; }
    if (el.id === "f-subject") { $("f-newsubj-row").hidden = el.value !== "__new"; if (el.value === "__new") $("f-newsubj").focus(); return; }
    if (el.id === "c-subject") { $("c-newsubj-row").hidden = el.value !== "__new"; if (el.value === "__new") $("c-newsubj").focus(); return; }
    if (el.dataset && el.dataset.action === "step") {
      const holder = el.closest("[data-id]");
      const x = holder && state.tasks.find((y) => y.id === holder.dataset.id);
      const st = x && x.steps.find((s) => s.id === el.dataset.step);
      if (!st) return;
      st.done = el.checked;
      commit();
      if (!x.done && x.steps.every((s) => s.done)) toast(t("t.allSteps"));
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "g-date" && validDate(e.target.value)) gradeDate = e.target.value;
    if (e.target.id === "c-start") {
      const end = $("c-end");
      if (end.dataset.touched !== "true" && validTime(e.target.value)) end.value = fromMin(toMin(e.target.value) + 90);
    } else if (e.target.id === "c-end") e.target.dataset.touched = "true";
  });
  document.addEventListener("submit", (e) => {
    const form = e.target;
    e.preventDefault();
    if (!state) return;
    if (form.dataset.action === "sheetsubmit") { if (sheet && sheet.onOk) sheet.onOk(); return; }
    if (form.dataset.action === "addstep") {
      const holder = form.closest("[data-id]");
      const x = holder && state.tasks.find((y) => y.id === holder.dataset.id);
      const input = form.querySelector("input");
      const text = cleanStr(input.value, 120);
      if (!x || !text) return;
      if (x.steps.length >= LIMITS.steps) { toast(t("t.maxSteps", { n: LIMITS.steps })); return; }
      x.steps.push({ id: uid(), text, done: false });
      commit();
      const again = $("addstep-input"); if (again) again.focus();
    }
  });

  // ---------- start ----------
  const intro = $("intro");
  if (intro) {
    const dropIntro = () => { if (intro.isConnected) intro.remove(); };
    intro.addEventListener("animationend", (e) => { if (e.target === intro) dropIntro(); });
    setTimeout(dropIntro, 2500);
  }
  render();
  init();
})();
