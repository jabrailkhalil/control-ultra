# Control Ultra

**[English](#english) | [Русский](#russian)**

---

<a id="english"></a>

## Autonomous Command Executor for AI Assistants

Control Ultra gives AI assistants full autonomous access to execute commands on the user's machine. One file. No confirmations. No hanging processes.

### The Problem

AI assistants in modern IDEs:
- Require manual approval for every single command
- Hang on long-running processes, forcing system reboots
- Lack direct access to file system, git, package managers
- Cannot operate autonomously — always need a human in the loop

### The Solution

User drops **one file** into their project and tells the AI:

> "Use Control Ultra for all commands. Work autonomously."

The AI gets:
- Execution of any command via `cu.cmd exec "command"`
- Timeout protection with automatic process termination
- Dangerous command blocking (format, mass delete, shutdown)
- Full execution logging
- Complete autonomy — zero manual approvals

---

### Quick Start

#### Option 1: Batch File (Simple)

1. Copy `cu.cmd` into your project folder
2. Open any AI chat
3. Paste the contents of `AI-PROMPT.md` as context
4. Say: *"Build me an Express API with authentication"*
5. The AI handles everything through Control Ultra

```batch
cu.cmd exec "npm init -y"
cu.cmd exec "npm install express jsonwebtoken"
cu.cmd exec "node server.js"
cu.cmd exec "git add . && git commit -m done"
```

#### Option 2: PowerShell (JSON output)

```powershell
.\cu.ps1 exec "git status" -Json
# { "success": true, "stdout": "...", "exitCode": 0 }

.\cu.ps1 multi "npm init -y", "npm install express", "node -v"
```

#### Option 3: Web Server (Advanced)

```bash
npm install
npm start
# Dashboard: http://127.0.0.1:3777
# REST API with 45+ endpoints
```

---

### Project Structure

| File | Purpose |
|------|---------|
| `cu.cmd` | Main executor — drop into any AI chat |
| `cu.ps1` | PowerShell version with JSON output |
| `cu-server.cmd` | Server manager (start/stop/restart) |
| `AI-PROMPT.md` | Detailed autonomy instructions for AI |
| `CU-README.txt` | Quick-reference prompt for AI |

#### Web Server Modules

| Module | Description |
|--------|-------------|
| `src/core/engine.js` | Command queue, execution, timeouts |
| `src/core/guard.js` | Automatic termination of hanging processes |
| `src/core/superfile.js` | Permissions and safety configuration |
| `src/modules/fileops.js` | File operations (CRUD, search, directory tree) |
| `src/modules/envdetect.js` | Environment scanner (installed runtimes, tools) |
| `src/modules/chain.js` | Command chains with conditions and retries |
| `src/modules/scaffold.js` | Project templates (8 types) |
| `src/api/routes.js` | REST API (45+ endpoints) |
| `src/api/websocket.js` | WebSocket for live output streaming |
| `src/public/` | Web dashboard |

---

### API Reference

#### Commands
```
POST /api/commands          — Execute a command
POST /api/commands/batch    — Execute a batch of commands
GET  /api/commands/:id      — Get command status
POST /api/commands/:id/kill — Kill a running process
POST /api/commands/:id/input — Send stdin to process
POST /api/commands/kill-all — Kill all running processes
```

#### Files
```
POST /api/files/create      — Create file (auto-creates directories)
POST /api/files/read        — Read file contents
POST /api/files/write       — Write to file
POST /api/files/append      — Append to file
POST /api/files/replace     — Find and replace text
POST /api/files/search      — Search across files (grep)
POST /api/files/tree        — Directory tree view
POST /api/files/list        — List directory contents
POST /api/files/copy        — Copy file or directory
POST /api/files/move        — Move or rename
POST /api/files/remove      — Delete file or directory
POST /api/files/exists      — Check if path exists
```

#### Environment
```
GET  /api/env               — Full system scan
POST /api/env/analyze       — Analyze project type and stack
POST /api/env/check         — Check what tools are missing
```

#### Scaffolding
```
GET  /api/scaffold/templates — List available templates
POST /api/scaffold/create    — Create project from template
```

Available templates: `node-basic`, `node-express`, `node-cli`, `python-basic`, `python-flask`, `python-fastapi`, `html-basic`, `fullstack-express-react`

#### Chains
```
POST /api/chain             — Sequential execution with conditions
POST /api/parallel          — Parallel execution
```

#### Management
```
GET  /api/status            — System status
GET  /api/history           — Command history
GET  /api/config            — Current configuration
PATCH /api/config           — Update configuration
POST /api/restart           — Restart server
```

---

### Testing

```bash
npm start
cu.cmd exec "node test-all.js"
# 89 tests, all passing
```

### Safety

- Blocked commands: `format`, `del /s /q C:\`, `rm -rf /`, `shutdown`
- Default timeout: 120 seconds (configurable)
- Automatic process tree termination on timeout
- Full execution log in `cu-log.txt`
- Configuration in `control-ultra.config.json`

### License

MIT

---
---

<a id="russian"></a>

## Автономный исполнитель команд для AI-ассистентов

Control Ultra дает AI-ассистентам полный автономный доступ к выполнению команд на компьютере пользователя. Один файл. Без подтверждений. Без зависаний.

### Проблема

AI-ассистенты в IDE:
- Требуют ручного подтверждения каждой команды
- Зависают на долгих процессах, приходится ребутить ПК
- Не имеют прямого доступа к файлам, git, пакетным менеджерам
- Не могут работать автономно — всегда нужен человек

### Решение

Пользователь кидает **один файл** в проект и говорит AI:

> "Используй Control Ultra для всех команд. Работай автономно."

AI получает:
- Выполнение любых команд через `cu.cmd exec "команда"`
- Защиту от зависаний (таймаут + автоубийство процессов)
- Блокировку опасных команд (format, массовое удаление, shutdown)
- Логирование всех действий
- Полную автономность — ноль подтверждений

---

### Быстрый старт

#### Вариант 1: Батник (простой)

1. Скопируй `cu.cmd` в папку проекта
2. Открой любой AI-чат
3. Вставь содержимое `AI-PROMPT.md` как контекст
4. Скажи: *"Создай Express API c авторизацией"*
5. AI делает все сам через Control Ultra

```batch
cu.cmd exec "npm init -y"
cu.cmd exec "npm install express jsonwebtoken"
cu.cmd exec "node server.js"
cu.cmd exec "git add . && git commit -m done"
```

#### Вариант 2: PowerShell (с JSON выводом)

```powershell
.\cu.ps1 exec "git status" -Json
# { "success": true, "stdout": "...", "exitCode": 0 }

.\cu.ps1 multi "npm init -y", "npm install express", "node -v"
```

#### Вариант 3: Веб-сервер (продвинутый)

```bash
npm install
npm start
# Панель: http://127.0.0.1:3777
# REST API с 45+ эндпоинтами
```

---

### Структура проекта

| Файл | Назначение |
|------|-----------|
| `cu.cmd` | Главный исполнитель — кидаешь в любой AI-чат |
| `cu.ps1` | PowerShell версия с JSON-выводом |
| `cu-server.cmd` | Менеджер сервера (start/stop/restart) |
| `AI-PROMPT.md` | Детальная инструкция автономности для AI |
| `CU-README.txt` | Краткий промпт для AI |

#### Модули веб-сервера

| Модуль | Описание |
|--------|----------|
| `src/core/engine.js` | Очередь команд, выполнение, таймауты |
| `src/core/guard.js` | Автоубийство зависших процессов |
| `src/core/superfile.js` | Конфигурация прав и безопасности |
| `src/modules/fileops.js` | Файловые операции (CRUD, поиск, дерево) |
| `src/modules/envdetect.js` | Сканер окружения (установленные рантаймы, инструменты) |
| `src/modules/chain.js` | Цепочки команд с условиями и ретраями |
| `src/modules/scaffold.js` | Шаблоны проектов (8 типов) |
| `src/api/routes.js` | REST API (45+ эндпоинтов) |
| `src/api/websocket.js` | WebSocket для live-стриминга вывода |
| `src/public/` | Веб-панель управления |

---

### Тестирование

```bash
npm start
cu.cmd exec "node test-all.js"
# 89 тестов, все проходят
```

### Безопасность

- Заблокировано: `format`, `del /s /q C:\`, `rm -rf /`, `shutdown`
- Таймаут по умолчанию: 120 секунд (настраивается)
- Автоматическое завершение дерева процессов при таймауте
- Полный лог действий в `cu-log.txt`
- Конфигурация в `control-ultra.config.json`

### Лицензия

MIT
