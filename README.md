# Control Ultra — AI Super Commander

> **Один файл. Полная автономия. Никаких "Принять".**

Control Ultra — это инструмент, который даёт AI-ассистентам (Claude, Gemini, Copilot, ChatGPT, Cursor и любые другие) **полный автономный доступ** к выполнению команд на компьютере пользователя.

## Проблема

AI-ассистенты в IDE постоянно:
- ❌ Просят нажать "Принять" на каждую команду
- ❌ Зависают на долгих командах (приходится ребутить ПК)
- ❌ Не имеют доступа к файловой системе, git, npm и т.д.
- ❌ Не могут работать автономно — всегда нужен человек

## Решение

Пользователь закидывает **один файл** (`cu.cmd`) в проект и говорит AI:

> "Вот cu.cmd — используй его для всех команд. Работай автономно."

AI получает:
- ✅ Выполнение любых команд через `cu.cmd exec "команда"`
- ✅ Защиту от зависаний (таймаут + auto-kill)
- ✅ Блокировку опасных команд (format, del /s, shutdown)
- ✅ Логирование всех действий
- ✅ Полную автономность — никаких "Принять"

## Быстрый старт

### Вариант 1: Батник (простой)

1. Скопируй `cu.cmd` в папку проекта
2. Открой AI-чат
3. Скопируй содержимое `AI-PROMPT.md` в чат
4. Скажи: *"Создай мне Express API с авторизацией"*
5. AI делает всё сам через cu.cmd

```batch
cu.cmd exec "npm init -y"
cu.cmd exec "npm install express"
cu.cmd exec "node app.js"
cu.cmd exec "git add . && git commit -m done"
```

### Вариант 2: PowerShell (с JSON)

```powershell
.\cu.ps1 exec "git status" -Json
# { "success": true, "stdout": "...", "exitCode": 0 }

.\cu.ps1 multi "npm init -y", "npm install express", "node -v"
# 3 команды за один вызов
```

### Вариант 3: Веб-сервер (продвинутый)

```bash
npm install
npm start
# http://127.0.0.1:3777 — панель управления + REST API
```

## Файлы проекта

| Файл | Назначение |
|------|-----------|
| `cu.cmd` | **Главный батник** — кидаешь в любой чат |
| `cu.ps1` | PowerShell версия с JSON-выводом |
| `cu-server.cmd` | Менеджер сервера (start/stop/restart) |
| `AI-PROMPT.md` | **Промпт для AI** — скопируй в чат |
| `CU-README.txt` | Короткая инструкция для AI |

### Веб-сервер и API

| Модуль | Описание |
|--------|----------|
| `src/core/engine.js` | Очередь команд, выполнение, таймауты |
| `src/core/guard.js` | Защита от зависших процессов |
| `src/core/superfile.js` | Конфигурация прав и безопасности |
| `src/modules/fileops.js` | Файловые операции (CRUD, поиск, дерево) |
| `src/modules/envdetect.js` | Определение окружения (что установлено) |
| `src/modules/chain.js` | Цепочки команд с условиями |
| `src/modules/scaffold.js` | Шаблоны проектов (8 штук) |
| `src/api/routes.js` | REST API (45+ эндпоинтов) |
| `src/api/websocket.js` | WebSocket для live-стриминга |
| `src/public/` | Веб-панель управления |

## API Reference

### Команды
```
POST /api/commands          — Выполнить команду
POST /api/commands/batch    — Выполнить пакет команд
GET  /api/commands/:id      — Статус команды
POST /api/commands/:id/kill — Убить процесс
POST /api/commands/:id/input — Отправить stdin
POST /api/commands/kill-all — Убить все
```

### Файлы
```
POST /api/files/create      — Создать файл
POST /api/files/read        — Читать файл
POST /api/files/write       — Записать файл
POST /api/files/append      — Дописать в файл
POST /api/files/replace     — Найти и заменить текст
POST /api/files/search      — Поиск по файлам (grep)
POST /api/files/tree        — Дерево директории
POST /api/files/list        — Список файлов
POST /api/files/copy        — Копировать
POST /api/files/move        — Переместить
POST /api/files/remove      — Удалить
POST /api/files/exists      — Проверить существование
```

### Окружение
```
GET  /api/env               — Полный скан системы
POST /api/env/analyze       — Анализ проекта
POST /api/env/check         — Что нужно установить?
```

### Шаблоны
```
GET  /api/scaffold/templates — Список шаблонов
POST /api/scaffold/create    — Создать проект из шаблона
```

### Цепочки
```
POST /api/chain             — Последовательная цепочка
POST /api/parallel          — Параллельное выполнение
```

### Управление
```
GET  /api/status            — Статус системы
GET  /api/history           — История команд
GET  /api/config            — Конфигурация
PATCH /api/config           — Обновить конфиг
POST /api/restart           — Перезапуск сервера
```

## Тесты

```bash
npm start                    # Запустить сервер
cu.cmd exec "node test-all.js"  # 89 тестов, все проходят
```

## Безопасность

- Блокировка: `format`, `del /s /q C:\`, `rm -rf /`, `shutdown`
- Таймаут: 120 сек по умолчанию, настраивается
- Auto-kill зависших процессов
- Все действия логируются в `cu-log.txt`
- Конфигурация в `control-ultra.config.json`

## Лицензия

MIT
