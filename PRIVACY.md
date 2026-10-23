# Политика конфиденциальности · Privacy Policy · Maxfiylik siyosati

[Русский](#русский) · [English](#english) · [Oʻzbekcha](#oʻzbekcha)

---

## Русский

**Приложение On Time.** Действует с 22 октября 2026 года.

### Какие данные обрабатываются

Только то, что пользователь вводит сам: задания, предметы, даты и время сдачи, шаги, расписание пар и аудитории, оценки и время занятий по таймеру. Настройки языка, оформления и таймера хранятся только в браузере устройства.

Приложение не запрашивает имя, телефон, адрес электронной почты и другие персональные данные. Оно не определяет местоположение и не обращается к камере, микрофону, контактам и файлам. Исключение — файл резервной копии, который пользователь сам выбирает для загрузки.

### Где хранятся данные

Данные хранятся только в хранилище браузера (localStorage) на устройстве пользователя. У приложения нет своего сервера. Задания и расписание не передаются ни автору приложения, ни кому-либо ещё. В Android-версии данные хранятся во внутренней памяти приложения (хранилище встроенного WebView), недоступной другим приложениям; системное резервное копирование в облако Google для приложения отключено. Разрешение «Интернет» нужно только встроенному движку WebView — приложение не обращается к сети. Напоминания о сдачах и окончании таймера (если их включить) планируются на самом телефоне через системный будильник Android и никуда не отправляются. В уведомлении видно название задания и предмет; чтобы скрыть их на заблокированном экране, включите скрытие содержимого уведомлений в настройках телефона. Для проверки обновлений Android-версия обращается к api.github.com и получает номер последней сборки (по кнопке «Проверить обновление» и при запуске не чаще раза в 6 часов — автоматическую проверку можно выключить в настройках). Запрос не содержит данных приложения; GitHub видит IP-адрес устройства, как при открытии любого сайта. Файл обновления скачивается браузером телефона со страницы GitHub Releases.

Если приложение открыто как страница на claude.ai, данные хранятся в аккаунте Claude пользователя, в личном разделе этого приложения. Другие люди, включая тех, с кем пользователь поделился ссылкой, к ним доступа не имеют. Хранение обеспечивает Anthropic в соответствии со своей политикой конфиденциальности.

### Чего приложение не делает

- не показывает рекламу;
- не собирает статистику использования и не подключает трекеры;
- не использует cookies;
- не продаёт и не передаёт данные третьим лицам.

### Сторонние сервисы

Приложение использует системный шрифт устройства и не загружает ничего со сторонних сайтов. Единственное исключение — проверка обновлений в Android-версии: запрос номера последней версии к api.github.com (см. выше). Content Security Policy в `index.html` разрешает только файлы самого приложения и этот адрес.

### Управление данными

В настройках, в разделе «Данные», можно:

- скачать резервную копию всех данных в файл JSON;
- загрузить данные из такого файла;
- удалить все данные одной кнопкой.

Файл резервной копии хранится там, куда его сохранил пользователь. Он не зашифрован, поэтому обращаться с ним стоит как с личным документом.

### Защита

- Весь введённый текст выводится безопасно: символы не исполняются как код (защита от XSS).
- Данные из хранилища и из импортируемых файлов проходят строгую проверку: неизвестные поля отбрасываются, значения сверяются со списками допустимых, длина строк и количество записей ограничены.
- Content Security Policy разрешает загружать только файлы самого приложения; из внешних адресов — только api.github.com для проверки обновлений.
- Хранилище браузера не шифруется. Любой, кто имеет доступ к браузеру пользователя, может увидеть сохранённые задания. Не храните в приложении пароли и документы.

### Изменения и контакты

При изменении политики обновляется дата в начале раздела. По вопросам о данных: [укажите свой email или Telegram].

---

## English

**On Time app.** Effective October 22, 2026.

### What data is processed

Only what the user enters: tasks, subjects, due dates and times, steps, class schedule and rooms, grades, and study time recorded by the timer. Language, appearance and timer settings are stored only in the device's browser.

The app does not ask for a name, phone number, email address or any other personal data. It does not track location and does not access the camera, microphone, contacts or files, except for a backup file the user chooses to restore.

### Where data is stored

Data is stored only in browser storage (localStorage) on the user's device. The app has no server of its own. Tasks and schedules are not sent to the app's author or anyone else. In the Android version, data is kept in the app's private storage (the built-in WebView storage), which other apps cannot read; Android cloud backup to Google is turned off for the app. The "Internet" permission is only required by the built-in WebView engine — the app makes no network requests. Deadline and timer reminders (if turned on) are scheduled on the phone itself through Android's alarm system and are never sent anywhere. A notification shows the task name and subject; to hide them on the lock screen, turn on hiding notification content in your phone settings. To check for updates, the Android version contacts api.github.com to get the latest build number (when you tap “Check for updates” and on launch at most every 6 hours — automatic checks can be turned off in settings). The request contains no app data; GitHub sees the device's IP address, as with any website. The update file is downloaded by the phone's browser from GitHub Releases.

When the app is opened as a page on claude.ai, data is stored in the user's Claude account, in this app's private section. Other people, including anyone the user shares the link with, cannot access it. Storage is provided by Anthropic under its privacy policy.

### What the app does not do

- show ads;
- collect usage analytics or use trackers;
- use cookies;
- sell or share data with third parties.

### Third-party services

The app uses the device's system font and loads nothing from third-party websites. The only exception is the update check in the Android version: a request to api.github.com for the latest version number (see above). The Content Security Policy in `index.html` allows only the app's own files and this address.

### Managing your data

In Settings → Data you can:

- download a backup of all data as a JSON file;
- restore data from such a file;
- delete all data with one button.

The backup file stays wherever the user saves it. It is not encrypted, so treat it like any personal document.

### Security

- All entered text is displayed safely: characters are never executed as code (XSS protection).
- Data from storage and imported files is strictly validated: unknown fields are discarded, values are checked against allowed lists, and string lengths and record counts are limited.
- The Content Security Policy allows loading only the app's own files; the only outside address allowed is api.github.com for update checks.
- Browser storage is not encrypted. Anyone with access to the user's browser can see saved tasks. Do not store passwords or documents in the app.

### Changes and contact

If this policy changes, the date at the top of this section is updated. Questions about data: [add your email or Telegram].

---

## Oʻzbekcha

**On Time ilovasi.** 2026-yil 22-oktabrdan amal qiladi.

### Qanday maʼlumotlar qayta ishlanadi

Faqat foydalanuvchi oʻzi kiritgan narsalar: topshiriqlar, fanlar, topshirish sanasi va vaqti, qadamlar, dars jadvali va xonalar, baholar hamda taymer boʻyicha mashgʻulot vaqti. Til, koʻrinish va taymer sozlamalari faqat qurilmadagi brauzerda saqlanadi.

Ilova ism, telefon raqami, elektron pochta manzili va boshqa shaxsiy maʼlumotlarni soʻramaydi. U joylashuvni aniqlamaydi, kamera, mikrofon, kontaktlar va fayllarga murojaat qilmaydi. Istisno — foydalanuvchi tiklash uchun oʻzi tanlagan zaxira fayli.

### Maʼlumotlar qayerda saqlanadi

Maʼlumotlar faqat foydalanuvchi qurilmasidagi brauzer xotirasida (localStorage) saqlanadi. Ilovaning oʻz serveri yoʻq. Topshiriq va jadvallar ilova muallifiga ham, boshqa hech kimga ham yuborilmaydi. Android versiyasida maʼlumotlar ilovaning shaxsiy xotirasida (ichki WebView xotirasi) saqlanadi, boshqa ilovalar uni oʻqiy olmaydi; Google bulutiga tizimli zaxira nusxa olish ilova uchun oʻchirilgan. «Internet» ruxsati faqat ichki WebView mexanizmi uchun kerak — ilova tarmoqqa murojaat qilmaydi. Topshirish muddati va taymer eslatmalari (yoqilgan boʻlsa) telefonning oʻzida Android signal tizimi orqali rejalashtiriladi va hech qayerga yuborilmaydi. Bildirishnomada vazifa nomi va fan koʻrinadi; ularni qulflangan ekranda yashirish uchun telefon sozlamalarida bildirishnoma matnini yashirishni yoqing. Yangilanishlarni tekshirish uchun Android versiyasi api.github.com ga murojaat qilib, soʻnggi yigʻma raqamini oladi («Yangilanishni tekshirish» tugmasi bosilganda va ishga tushganda 6 soatda bir martadan koʻp emas — avtomatik tekshiruvni sozlamalarda oʻchirish mumkin). Soʻrovda ilova maʼlumotlari boʻlmaydi; GitHub istalgan sayt kabi qurilmaning IP manzilini koʻradi. Yangilanish fayli telefon brauzeri orqali GitHub Releases sahifasidan yuklab olinadi.

Agar ilova claude.ai sahifasi sifatida ochilsa, maʼlumotlar foydalanuvchining Claude hisobida, ushbu ilovaning shaxsiy boʻlimida saqlanadi. Boshqa odamlar, jumladan havola ulashilganlar ham, ularga kira olmaydi. Saqlashni Anthropic oʻz maxfiylik siyosatiga muvofiq taʼminlaydi.

### Ilova nima qilmaydi

- reklama koʻrsatmaydi;
- foydalanish statistikasini yigʻmaydi va kuzatuvchilarni ulamaydi;
- cookie fayllaridan foydalanmaydi;
- maʼlumotlarni sotmaydi va uchinchi shaxslarga bermaydi.

### Uchinchi tomon xizmatlari

Ilova qurilmaning tizim shriftidan foydalanadi va begona saytlardan hech narsa yuklamaydi. Yagona istisno — Android versiyasida yangilanishlarni tekshirish: api.github.com dan soʻnggi versiya raqamini soʻrash (yuqoriga qarang). `index.html` dagi Content Security Policy faqat ilovaning oʻz fayllari va shu manzilga ruxsat beradi.

### Maʼlumotlarni boshqarish

Sozlamalar → Maʼlumotlar boʻlimida:

- barcha maʼlumotlarning zaxira nusxasini JSON fayl sifatida yuklab olish;
- maʼlumotlarni shunday fayldan tiklash;
- barcha maʼlumotlarni bitta tugma bilan oʻchirish mumkin.

Zaxira fayl foydalanuvchi saqlagan joyda turadi. U shifrlanmagan, shuning uchun uni shaxsiy hujjat kabi asrang.

### Himoya

- Kiritilgan barcha matn xavfsiz koʻrsatiladi: belgilar kod sifatida bajarilmaydi (XSS himoyasi).
- Xotira va import qilingan fayllardagi maʼlumotlar qatʼiy tekshiriladi: notanish maydonlar tashlab yuboriladi, qiymatlar ruxsat etilganlar roʻyxati bilan solishtiriladi, satr uzunligi va yozuvlar soni cheklangan.
- Content Security Policy faqat ilovaning oʻz fayllarini yuklashga ruxsat beradi; tashqi manzillardan faqat yangilanishlarni tekshirish uchun api.github.com.
- Brauzer xotirasi shifrlanmaydi. Foydalanuvchi brauzeriga kira oladigan har kim saqlangan topshiriqlarni koʻra oladi. Ilovada parol va hujjatlarni saqlamang.

### Oʻzgarishlar va aloqa

Siyosat oʻzgarsa, boʻlim boshidagi sana yangilanadi. Maʼlumotlar boʻyicha savollar: [email yoki Telegram manzilingizni kiriting].
