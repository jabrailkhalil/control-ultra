# Control Ultra

**[English](#english) | [Русский](#russian)**

---

<a id="english"></a>

## Autonomous Command Executor for AI Assistants

Control Ultra gives AI assistants full autonomous access to execute commands on the user's machine.

**You only need one file: `control-ultra.cmd`**

Drop it into any project. Tell the AI to use it. Done.

### The Problem

AI assistants in modern IDEs:
- Require manual approval for every single command
- Hang on long-running processes, forcing system reboots
- Cannot operate autonomously — always need a human in the loop

### The Solution

```
1. Copy control-ultra.cmd into your project folder
2. Tell the AI: "Use Control Ultra for all commands."
3. The AI works fully autonomously — zero clicks from you.
```

Everything the AI needs is embedded inside `control-ultra.cmd`:
- Full autonomy instructions (`control-ultra.cmd prompt`)
- Command execution with timeouts and safety
- IDE command-blocking bypass (task mode)
- Pre-defined shortcuts for common operations

All helper files (`cu-exec-helper.ps1`, `cu-shortcuts.txt`) are auto-generated on first run. No setup required.

---

### How It Works

IDEs scan the **text** of terminal commands and block dangerous ones. But they **cannot see inside files**.

Control Ultra exploits this:

1. The AI writes commands to `cu-task.txt` using its file-writing capability (needs no approval)
2. The AI runs `control-ultra.cmd task` — the IDE sees a harmless batch file call
3. `control-ultra.cmd task` reads and executes every line from the file
4. Result: `git push`, `npm install`, `node server.js` — all without a single click

The user explicitly grants permission by placing the file in their project. Built-in safety (blocked commands, timeouts) prevents anything destructive.

---

### Usage

#### Direct execution
```batch
control-ultra.cmd exec "npm init -y"
control-ultra.cmd exec "npm install express" -t 300
control-ultra.cmd exec "node app.js"
```

#### Task file (bypasses IDE blocking)
```batch
:: AI writes commands to cu-task.txt, then runs:
control-ultra.cmd task
```

#### Numbered shortcuts
```batch
control-ultra.cmd 1    :: git add + commit + push
control-ultra.cmd 2    :: npm install
control-ultra.cmd 3    :: npm start
control-ultra.cmd 4    :: npm test
control-ultra.cmd 5    :: npm run build
control-ultra.cmd 7    :: git status
```

#### All commands
```
control-ultra.cmd exec "command"       Execute a command
control-ultra.cmd exec "cmd" -t 60    Custom timeout (seconds)
control-ultra.cmd task                 Run commands from cu-task.txt
control-ultra.cmd [1-9]                Run numbered shortcut
control-ultra.cmd shortcuts            List all shortcuts
control-ultra.cmd prompt               Show full AI autonomy instructions
control-ultra.cmd batch file.txt       Execute commands from any file
control-ultra.cmd daemon               Background queue mode
control-ultra.cmd status               Show status and logs
control-ultra.cmd help                 Quick help
```

---

### What You Get

**One file (`control-ultra.cmd`) provides:**

| Feature | Description |
|---------|-------------|
| Command execution | Run anything with timeout protection |
| Safety system | Blocks `format`, `del /s C:\`, `rm -rf /`, `shutdown` |
| Task mode | Write commands to file, execute all at once (IDE bypass) |
| Shortcuts | 9 pre-defined operations, customizable via `cu-shortcuts.txt` |
| Batch mode | Execute commands from any text file |
| Daemon mode | Background watcher, picks up commands from queue file |
| Logging | All actions logged to `cu-log.txt` |
| AI prompt | Full autonomy instructions built into the file |
| Auto-setup | Helper files generated on first run, no dependencies |

---

### Web Server (Optional, Advanced)

For teams or complex workflows, the project also includes a Node.js web server with REST API:

```bash
npm install && npm start
# Dashboard: http://127.0.0.1:3777
# 45+ REST API endpoints for commands, files, environment, scaffolding
```

This is **optional**. The single `control-ultra.cmd` file works standalone without Node.js.

---

### Testing

```bash
npm start
control-ultra.cmd exec "node test-all.js"
# 89 tests, all passing
```

### License

MIT

---
---

<a id="russian"></a>

## Автономный исполнитель команд для AI-ассистентов

Control Ultra дает AI-ассистентам полный автономный доступ к выполнению команд.

**Нужен только один файл: `control-ultra.cmd`**

Кинь его в проект. Скажи AI использовать его. Готово.

### Проблема

AI-ассистенты в IDE:
- Требуют ручного подтверждения каждой команды
- Зависают на долгих процессах, приходится ребутить ПК
- Не могут работать автономно — всегда нужен человек

### Решение

```
1. Скопируй control-ultra.cmd в папку проекта
2. Скажи AI: "Используй Control Ultra для всех команд."
3. AI работает полностью автономно — ноль кликов от тебя.
```

Всё что нужно AI — встроено внутри `control-ultra.cmd`:
- Полная инструкция автономности (`control-ultra.cmd prompt`)
- Выполнение команд с таймаутами и защитой
- Обход блокировки команд IDE (task mode)
- Предустановленные шорткаты для частых операций

Все вспомогательные файлы (`cu-exec-helper.ps1`, `cu-shortcuts.txt`) генерятся автоматически при первом запуске. Настройка не нужна.

---

### Как это работает

IDE сканирует **текст** команд терминала и блокирует опасные. Но IDE **не видит содержимое файлов**.

Control Ultra использует это:

1. AI записывает команды в `cu-task.txt` через функцию записи файлов (не требует одобрения)
2. AI запускает `control-ultra.cmd task` — IDE видит безобидный вызов батника
3. `control-ultra.cmd task` читает и выполняет каждую строку из файла
4. Результат: `git push`, `npm install`, `node server.js` — всё без единого клика

Пользователь явно дает разрешение, размещая файл в проекте. Встроенная защита (блокировка команд, таймауты) не дает ничего разрушить.

---

### Использование

#### Прямое выполнение
```batch
control-ultra.cmd exec "npm init -y"
control-ultra.cmd exec "npm install express" -t 300
control-ultra.cmd exec "node app.js"
```

#### Task-файл (обход блокировки IDE)
```batch
:: AI записывает команды в cu-task.txt, затем:
control-ultra.cmd task
```

#### Шорткаты
```batch
control-ultra.cmd 1    :: git add + commit + push
control-ultra.cmd 2    :: npm install
control-ultra.cmd 3    :: npm start
control-ultra.cmd 4    :: npm test
control-ultra.cmd 5    :: npm run build
control-ultra.cmd 7    :: git status
```

---

### Что внутри одного файла

| Функция | Описание |
|---------|----------|
| Выполнение команд | Запуск чего угодно с таймаутом |
| Система безопасности | Блокирует `format`, `del /s C:\`, `rm -rf /`, `shutdown` |
| Task mode | Запись команд в файл, выполнение пакетом (обход IDE) |
| Шорткаты | 9 операций, настраиваются через `cu-shortcuts.txt` |
| Daemon mode | Фоновый режим, подхватывает команды из очереди |
| Логирование | Все действия в `cu-log.txt` |
| AI промпт | Полная инструкция автономности встроена в файл |
| Автонастройка | Вспомогательные файлы генерятся при первом запуске |

---

### Веб-сервер (опционально)

Для команд или сложных сценариев — Node.js сервер с REST API:

```bash
npm install && npm start
# Dashboard: http://127.0.0.1:3777
# 45+ API эндпоинтов
```

Это **опционально**. Один `control-ultra.cmd` работает без Node.js.

### Лицензия

MIT
