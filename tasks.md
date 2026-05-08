# Tasks: плагин Obsidian Sync

Подробный план разработки плагина Obsidian. Задачи выполняются последовательно сверху вниз. **Перед началом** должна быть готова и запущена серверная часть (см. соседнюю папку `server/`), как минимум этапы 1–9 (БД, авторизация, API-ключи, проекты, файлы, CRDT, Socket.IO).

**Стек:** TypeScript + esbuild + Obsidian API + Yjs + y-indexeddb + Socket.IO client + chokidar + better-sqlite3 + Jest.

---

## Этап 0. Инициализация плагина

- [ ] **0.1.** Сделать форк / клон [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) или сгенерировать из шаблона.
- [ ] **0.2.** Заполнить `manifest.json`:
  ```json
  {
    "id": "obsidian-sync",
    "name": "Obsidian Sync",
    "version": "0.1.0",
    "minAppVersion": "1.5.0",
    "description": "Self-hosted Obsidian vault synchronization with live collaboration.",
    "author": "...",
    "isDesktopOnly": true
  }
  ```
  В MVP делаем **desktop-only** (для мобильного слишком много адаптации FS-watcher и SQLite).
- [ ] **0.3.** Установить зависимости:
  ```bash
  pnpm add yjs y-indexeddb y-protocols socket.io-client chokidar better-sqlite3 diff lib0
  pnpm add -D @types/node @types/diff typescript esbuild builtin-modules obsidian jest @types/jest ts-jest
  ```
  ⚠️ `better-sqlite3` — нативный модуль, должен подгружаться только в desktop. Если позже понадобится мобильная версия — заменить на `sql.js` или абстрагировать через интерфейс.
- [ ] **0.4.** Настроить `tsconfig.json` со строгими опциями (`strict`, `noUncheckedIndexedAccess`).
- [ ] **0.5.** Настроить ESLint + Prettier + husky + lint-staged (зеркало настроек сервера).
- [ ] **0.6.** Настроить Jest с пресетом `ts-jest`. Создать пример теста.
- [ ] **0.7.** Создать структуру:
  ```
  src/
  ├── main.ts                  # entry point, расширяет Plugin
  ├── settings/
  │   ├── settings.ts          # типы и дефолты
  │   ├── tab.ts               # PluginSettingTab
  │   └── modals/              # модалки добавления сервера, привязки папки
  ├── client/
  │   ├── api.ts               # REST-клиент
  │   ├── socket.ts            # Socket.IO клиент-обёртка
  │   └── types.ts             # типы DTO (зеркальные с сервером)
  ├── sync/
  │   ├── engine.ts            # центральный оркестратор
  │   ├── operation-log.ts     # локальный SQLite-журнал
  │   ├── vector-clock.ts
  │   ├── reconnect.ts         # стратегия догона при онлайне
  │   └── conflict.ts          # модалка конфликтов
  ├── crdt/
  │   ├── doc-manager.ts       # Yjs документы и y-indexeddb
  │   └── editor-binding.ts    # связь с CodeMirror Obsidian
  ├── watcher/
  │   ├── obsidian-events.ts   # обработка vault.on(...)
  │   └── fs-watcher.ts        # chokidar для внешних изменений
  ├── ui/
  │   ├── status-bar.ts
  │   ├── icons.ts
  │   └── views/               # ItemView для истории, конфликтов
  ├── i18n/
  │   ├── ru.json
  │   └── index.ts
  └── utils/
      ├── debounce.ts
      ├── hash.ts
      └── paths.ts
  tests/                       # Jest
  ```
- [ ] **0.8.** Настроить `esbuild.config.mjs` для сборки в `main.js` (как в шаблоне), добавить watch-режим для разработки.
- [ ] **0.9.** Настроить hot-reload в Obsidian: использовать [obsidian-hot-reload](https://github.com/pjeby/hot-reload) (положить плагин в тестовый vault, чтобы он перезагружал плагин при пересборке).
- [ ] **0.10.** Создать `LICENSE` (MIT) и `README.md` с заглушкой.

---

## Этап 1. Настройки плагина и UI настроек

- [ ] **1.1.** Описать типы настроек в `src/settings/settings.ts`:

  ```ts
  interface ServerConfig {
    id: string; // uuid локально
    name: string;
    url: string; // https://sync.example.com
    apiKey: string; // хранится в plain в data.json
    addedAt: number;
  }

  interface VaultBinding {
    id: string; // uuid
    serverId: string;
    projectId: string;
    projectName: string; // кеш
    localFolder: string; // путь относительно корня vault'а; "/" для всего vault'а
    enabled: boolean;
    lastSyncedAt: number;
    lastVectorClock: Record<string, number>;
  }

  interface PluginSettings {
    servers: ServerConfig[];
    bindings: VaultBinding[];
    debounceMs: number; // дефолт 500
    syncOnStartup: boolean;
    showSyncNotifications: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    language: 'ru' | 'en';
  }
  ```

  ⚠️ В MVP язык один — русский. Структура заложена под будущую локализацию.

- [ ] **1.2.** Реализовать сохранение/загрузку настроек через `loadData()` / `saveData()`.
- [ ] **1.3.** Реализовать `PluginSettingTab` — главный экран настроек:
  - **Раздел «Серверы»** — список добавленных серверов с кнопками «Удалить», «Проверить подключение». Кнопка «Добавить сервер».
  - **Раздел «Хранилища»** — список привязанных проектов: для каждого — название, сервер, локальная папка, статус синка, кнопки «Изменить папку», «Отключить», «Удалить привязку». Кнопка «Добавить хранилище».
  - **Раздел «Поведение»** — debounce, syncOnStartup, уведомления, log level.
- [ ] **1.4.** Модалка «Добавить сервер»:
  - поля: Имя (произвольное), URL, API-ключ,
  - кнопка «Проверить» — делает `GET /api/auth/me` с переданным ключом, показывает email пользователя на сервере при успехе,
  - после успешной проверки — сохранение и закрытие.
- [ ] **1.5.** Модалка «Добавить хранилище»:
  - выпадающий список серверов,
  - после выбора — запрос `GET /api/projects` с этого сервера, отображение списка проектов пользователя,
  - выбор проекта,
  - выбор локальной папки в vault'е (через FolderSuggestModal — Obsidian API),
  - **валидация:** выбранная папка не должна быть привязана к другому проекту/серверу (проверка по `settings.bindings`),
  - после подтверждения — создание `VaultBinding`, инициализация локального состояния (см. этап 2).
- [ ] **1.6.** Все строки UI берутся из `src/i18n/ru.json` через хелпер `t('key')`.

---

## Этап 2. Локальное состояние (SQLite)

- [ ] **2.1.** Реализовать `src/sync/operation-log.ts`:
  - SQLite-БД в `<vault>/.obsidian/plugins/obsidian-sync/state.db`,
  - таблицы:
    - `bindings_state` — id (FK на VaultBinding), lastVectorClock (json), lastSyncedAt.
    - `pending_operations` — id, bindingId, opType, filePath, newPath, payload (json), createdAt — операции, ещё не отправленные на сервер (оффлайн-очередь).
    - `file_meta` — bindingId, relativePath (PK), serverFileId, contentHash, size, fileType, lastSyncedAt — локальный кеш метаданных файлов.
  - функции:
    - `enqueueOperation(bindingId, op)`,
    - `dequeueOperations(bindingId)` — извлекает все pending для отправки,
    - `markSent(opIds)`,
    - `getFileMeta(bindingId, path)`, `setFileMeta(...)`, `deleteFileMeta(...)`,
    - `updateLastVectorClock(bindingId, vc)`.
- [ ] **2.2.** Миграции БД (простая система: список SQL-стейтментов с версией).
- [ ] **2.3.** Тесты на operation-log в Jest (с in-memory SQLite через `:memory:`).

---

## Этап 3. REST-клиент

- [ ] **3.1.** Реализовать `src/client/api.ts` — обёртка над `requestUrl()` Obsidian (важно: использовать именно его, не `fetch`, чтобы избегать CORS-проблем):
  - конструктор принимает `ServerConfig`,
  - методы:
    - `getMe()` → `{ id, email, name }` для проверки ключа,
    - `getProjects()` → список проектов,
    - `getProjectFiles(projectId)` → список файлов,
    - `downloadFile(projectId, fileId)` → ArrayBuffer,
    - `uploadFile(projectId, path, content)` → метаданные,
    - `getFileVersions(projectId, fileId)` → список версий,
    - `downloadFileVersion(projectId, fileId, versionId)`.
  - Обработка ошибок: 401 → пометить сервер как unauthorized, 403 → отсутствие прав, сетевые → throw retryable error.
- [ ] **3.2.** Зеркальные TypeScript-типы DTO в `src/client/types.ts` (синхронизированы с серверными — желательно скопировать из `server/src/lib/.../types.ts` вручную или через codegen в будущем).
- [ ] **3.3.** Тесты с моком `requestUrl`.

---

## Этап 4. Socket.IO клиент

- [ ] **4.1.** Реализовать `src/client/socket.ts`:
  - конструктор принимает `ServerConfig` и `bindingId`,
  - подключение: `io(url, { auth: { apiKey }, transports: ['websocket'] })`,
  - после подключения — `emit('project:join', { projectId, sinceVectorClock })`,
  - exposed events:
    - `onConnect(cb)`, `onDisconnect(cb)`, `onReconnect(cb)`,
    - `onOperation(cb)` — серверные операции,
    - `onYjsUpdate(cb)`,
  - emit-обёртки для отправки операций и Yjs-обновлений.
- [ ] **4.2.** Reconnect-стратегия: exponential backoff (1s, 2s, 4s, 8s, max 30s), без потери очереди операций.
- [ ] **4.3.** Тесты с локальным Socket.IO моком.

---

## Этап 5. CRDT (Yjs) и интеграция с редактором

- [ ] **5.1.** Реализовать `src/crdt/doc-manager.ts`:
  - кеш `Map<bindingId+filePath, Y.Doc>`,
  - на каждый текстовый файл создаётся `Y.Doc` с `Y.Text` под ключом `'content'`,
  - инициализация y-indexeddb persistence (БД `obsidian-sync-<bindingId>`),
  - подписка на `update`-событие документа → отправка через socket,
  - получение обновлений с сервера → `Y.applyUpdate(doc, update)`.
- [ ] **5.2.** Реализовать `src/crdt/editor-binding.ts`:
  - использовать [y-codemirror.next](https://github.com/yjs/y-codemirror.next) для биндинга `Y.Text` к редактору CodeMirror 6 (Obsidian использует CM6).
  - при открытии файла в Obsidian:
    - получить `EditorView` через `app.workspace.activeEditor.editor.cm`,
    - подключить расширение `yCollab(yText, awareness)`.
  - при закрытии файла — отключать биндинг.
- [ ] **5.3.** Двусторонняя синхронизация Y.Text ↔ файл на диске:
  - при изменении файла **на диске** (вне редактора, например, после загрузки бинарного снапшота) — обновить Y.Text, чтобы открытый редактор отразил изменения.
  - при изменении Y.Text — debounced запись в файл vault'а (через `app.vault.modify()`).
- [ ] **5.4.** Тесты на doc-manager (без Obsidian, на чистых Y.Doc).

---

## Этап 6. Слежение за изменениями

- [ ] **6.1.** Реализовать `src/watcher/obsidian-events.ts`:
  - подписки в `onload()`:
    - `app.vault.on('create', file => ...)`,
    - `app.vault.on('modify', file => ...)`,
    - `app.vault.on('delete', file => ...)`,
    - `app.vault.on('rename', (file, oldPath) => ...)`.
  - дебаунс на `modify` через `src/utils/debounce.ts`.
  - фильтрация: обрабатываются только файлы внутри `binding.localFolder`.
  - **исключение цикличности:** если файл был только что обновлён нами (в результате применения серверной операции) — пометить его в коротком in-memory списке `recentlyAppliedFiles` и не отправлять обратно.
- [ ] **6.2.** Реализовать `src/watcher/fs-watcher.ts`:
  - chokidar следит за абсолютным путём папки vault'а: `vault.adapter.getBasePath() + binding.localFolder`,
  - игнорирует `.obsidian`, `.git`, `.versions`, и временные файлы (`.tmp`, `~`).
  - **главная цель** — ловить изменения от ИИ-агентов, которые пишут напрямую в файловую систему минуя Obsidian (Obsidian события не срабатывают).
  - дебаунс отдельный (например, 1000 мс), потому что у внешних агентов могут быть множественные записи.
  - дедупликация с событиями Obsidian: если событие уже обработано через `vault.on('modify')` за последние N мс — игнорировать.
- [ ] **6.3.** Тесты на дебаунс и дедупликацию (можно мокать FS).

---

## Этап 7. Sync Engine — центральный оркестратор

- [ ] **7.1.** Реализовать `src/sync/engine.ts` — главный класс `SyncEngine`:
  - на одно `VaultBinding` создаётся один `SyncEngine`,
  - держит ссылки на: API client, Socket client, OperationLog, DocManager.
  - lifecycle:
    - `start()` — подключение, начальная синхронизация (см. этап 8), запуск watcher'ов.
    - `stop()` — отключение, отписки, остановка watcher'ов.
- [ ] **7.2.** Поток событий «локально → сервер»:
  - событие из watcher'а → формируется операция (с инкрементом локального vector clock):
    - текстовый файл, modify → отправляется через Yjs (просто применить изменение в Y.Text, доктор автоматически отправит update),
    - текстовый файл, create → отправить операцию `CREATE` через socket + создать Yjs-док,
    - бинарный файл, create/modify → загрузить через REST + отправить операцию через socket,
    - delete/rename/move → операция через socket,
  - при оффлайне → запись в `pending_operations`, попытка отправить позже.
- [ ] **7.3.** Поток событий «сервер → локально»:
  - получаем операцию от socket'а:
    - `CREATE` (бинарный) → скачать файл через REST, записать через `vault.create()`, обновить `file_meta`,
    - `CREATE` (текстовый) → дождаться Yjs sync, потом снапшот в файл,
    - `UPDATE` (бинарный) → скачать, перезаписать,
    - `DELETE` → `vault.delete()`,
    - `RENAME`/`MOVE` → `vault.rename()`,
    - помечаем файл в `recentlyAppliedFiles`, чтобы не зациклить.
  - получаем `yjs:update` → `Y.applyUpdate(doc, update)` → редактор обновится автоматически, debounced снапшот в файл.
- [ ] **7.4.** Обновление status-bar (см. этап 9) при любых событиях: подключено/отключено/синхронизация/ошибка.

---

## Этап 8. Оффлайн-режим и догон при подключении

- [ ] **8.1.** При старте плагина (или возврате онлайна):
  1. для каждого активного binding:
     - подключиться к серверу,
     - отправить `project:join` с `lastVectorClock` из `bindings_state`,
     - сервер ответит:
       - всеми операциями метаданных, произошедшими после этой точки,
       - sync-step1 для всех Yjs-документов проекта (для синхронизации содержимого),
     - применить операции (поток «сервер → локально» из этапа 7.3),
     - после применения — отправить накопленные `pending_operations` (поток «локально → сервер»),
     - после успеха — обновить `lastVectorClock` в БД.
- [ ] **8.2.** Реализовать `src/sync/reconnect.ts` — отдельный модуль для логики догона. Тестируется без Socket.IO, на моках.
- [ ] **8.3.** Сценарий: long offline (несколько дней). Плагин переоткрыт, в vault'е накопились правки.
  - Алгоритм:
    1. Сделать **полное сравнение** (опциональный режим, включается флагом `deepSyncOnStartup`):
       - получить с сервера hash-список всех файлов проекта,
       - сравнить с локальными,
       - расхождения → ставить операции в очередь / запрашивать с сервера.
    2. Это медленно для больших vault'ов, но даёт уверенность.
- [ ] **8.4.** Тесты:
  - симуляция пропуска N операций → они применяются при реконнекте,
  - симуляция накопленных pending operations → они отправляются.

---

## Этап 9. Разрешение конфликтов

- [ ] **9.1.** **Текстовые файлы** — конфликтов нет благодаря Yjs (CRDT гарантирует merge). Действий не требуется.
- [ ] **9.2.** **Бинарные файлы** — реализовать `src/sync/conflict.ts`:
  - при получении операции `UPDATE` для файла, у которого локально есть несохранённые изменения (контент-хеш отличается и от старого серверного, и от пришедшего нового),
  - открыть `ConflictModal`:
    - показать имя файла, размер обеих версий, время изменения,
    - превью (для изображений — `<img>`, для остального — иконка файла),
    - три кнопки: **«Оставить серверную»** (заменить локальную), **«Оставить локальную»** (отправить локальную как новую версию), **«Сохранить обе»** (локальная переименовывается в `<name>.conflict-<timestamp>.<ext>`).
- [ ] **9.3.** **Удаление vs изменение** (delete-update):
  - если сервер прислал `DELETE`, а локальный файл изменён → модалка с двумя вариантами: «Удалить локально» / «Восстановить на сервере».
- [ ] **9.4.** **Параллельные RENAME** разрешаются автоматически по правилу с сервера (этап 8 серверной части), плагин просто применяет результат.
- [ ] **9.5.** **Diff-вью для текстов** (опционально, поверх MVP) — отдельная View в Obsidian для просмотра diff между версиями файла, использует `diff` библиотеку.

---

## Этап 10. UI-компоненты

- [ ] **10.1.** **Status bar** (`src/ui/status-bar.ts`):
  - отображает агрегированный статус по всем активным bindings: 🟢 синхронизировано, 🟡 синхронизируется, 🔴 ошибка/оффлайн,
  - клик по статус-бару → открывает popover со списком всех bindings и их персональным статусом.
- [ ] **10.2.** **Команды** (через `addCommand`):
  - «Sync now» — принудительная синхронизация всех активных bindings,
  - «Pause sync» / «Resume sync» — глобальная пауза,
  - «Show file history» — открывает View с историей версий активного файла,
  - «Open Obsidian Sync settings».
- [ ] **10.3.** **History View** (`src/ui/views/history-view.ts`):
  - ItemView, открывается командой,
  - показывает список версий файла с автором, временем, опциональным сообщением,
  - клик по версии → diff с текущей или восстановление.
- [ ] **10.4.** **Notice'ы** (через `new Notice()`) для пользовательских уведомлений:
  - «Подключено к <serverName>», «Потеряно соединение», «Конфликт в <file>», «Синхронизация завершена».
  - Уважение настройки `showSyncNotifications`.

---

## Этап 11. Локализация

- [ ] **11.1.** Создать `src/i18n/ru.json` со всеми UI-строками:
  ```json
  {
    "settings.title": "Obsidian Sync",
    "settings.servers": "Серверы",
    "settings.add_server": "Добавить сервер",
    "...": "..."
  }
  ```
- [ ] **11.2.** Реализовать `src/i18n/index.ts`:
  - функция `t(key, params?)` — простая подстановка.
  - выбор языка по `settings.language` (в MVP только `ru`).
- [ ] **11.3.** Все user-facing строки через `t()`. Заложить fallback на `en.json` (создать пустым, наполнить позже).

---

## Этап 12. Логирование

- [ ] **12.1.** Реализовать простой logger (`src/utils/logger.ts`) с уровнями `error/warn/info/debug`:
  - в файл `<vault>/.obsidian/plugins/obsidian-sync/sync.log` с ротацией (по размеру),
  - дублирование в DevTools console при `logLevel=debug`.
- [ ] **12.2.** Все ключевые события (подключение, операции, конфликты, ошибки) логируются.
- [ ] **12.3.** Кнопка в настройках «Открыть лог» / «Очистить лог».

---

## Этап 13. Тестирование

- [ ] **13.1.** Unit-тесты Jest для:
  - operation-log,
  - vector-clock (merge, comparison),
  - debounce, hash, paths,
  - REST-клиент (с моком `requestUrl`),
  - reconnect логика.
- [ ] **13.2.** Интеграционные тесты:
  - поднять локально dev-сервер (`server/` в режиме `pnpm dev`),
  - написать Node.js-тесты, эмулирующие плагин: создание `Y.Doc`, подключение через socket.io-client, проверка что изменения долетают до второго клиента.
- [ ] **13.3.** **CLI-эмулятор плагина** (`scripts/cli-emulator.ts`):
  - читает локальную папку,
  - подключается к серверу с указанным API-ключом и projectId,
  - синхронизирует содержимое (в одну сторону или двунаправленно),
  - используется для отладки протокола без Obsidian.
- [ ] **13.4.** Ручное тестирование сценариев:
  - первая привязка, заливка vault'а на пустой проект,
  - привязка к проекту с уже существующими файлами (полная синхронизация),
  - одновременное редактирование одного файла на двух устройствах,
  - отключение интернета → правка → включение → догон,
  - конфликт бинарного файла,
  - переименование файла на одном устройстве,
  - удаление файла на одном устройстве, изменение на другом,
  - изменение файла внешним агентом (через `echo > file.md`),
  - длительный оффлайн (накопить 50+ изменений) → реконнект.
- [ ] **13.5.** Стресс-тест: vault на 1000+ файлов, проверка времени начальной синхронизации.

---

## Этап 14. Документация и публикация

- [ ] **14.1.** Заполнить `README.md` плагина:
  - описание,
  - скриншоты (статус-бар, настройки, модалка добавления хранилища),
  - установка вручную (manual install из релиза),
  - настройка (получение API-ключа, добавление сервера, привязка папки),
  - troubleshooting (частые ошибки, как смотреть логи),
  - ограничения MVP (desktop-only, лимит на размер бинарных и т.п.).
- [ ] **14.2.** Подготовить релиз GitHub:
  - workflow для сборки `main.js`, `manifest.json`, `styles.css` в release artifacts,
  - версионирование по semver,
  - changelog.
- [ ] **14.3.** Подача в **Obsidian Community Plugins** (опционально, после стабилизации):
  - требования: лицензия (MIT — есть), README, manifest, репо публичный.
  - PR в [obsidian-releases](https://github.com/obsidianmd/obsidian-releases).

---

## Критерии готовности плагина

- ✅ Устанавливается вручную через копирование папки в `<vault>/.obsidian/plugins/`.
- ✅ Поддерживает несколько серверов и несколько привязок.
- ✅ Каждая локальная папка привязана к ровно одному проекту, валидация работает.
- ✅ Live-синхронизация двух устройств работает: изменение в одном Obsidian мгновенно видно в другом.
- ✅ Изменения от внешних агентов (вне Obsidian) подхватываются и синхронизируются.
- ✅ Оффлайн-режим работает: правки сохраняются, при реконнекте отправляются и догоняют серверные.
- ✅ Конфликты бинарных файлов разрешаются через модалку.
- ✅ История версий файла доступна через команду.
- ✅ Status-bar показывает корректный статус.
- ✅ Логи пишутся, основные операции покрыты тестами.
