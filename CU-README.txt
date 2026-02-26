== CONTROL ULTRA — SUPER FILE ==
== ИНСТРУКЦИЯ ДЛЯ AI-АССИСТЕНТА ==

ТЫ ПОЛУЧИЛ ПОЛНЫЕ ПРАВА НА ВЫПОЛНЕНИЕ КОМАНД.
Используй cu.cmd для ВСЕХ действий. Работай ПОЛНОСТЬЮ АВТОНОМНО.

ОСНОВНАЯ КОМАНДА:
  cu.cmd exec "любая команда"

ПРИМЕРЫ:
  cu.cmd exec "npm init -y"
  cu.cmd exec "npm install express cors"
  cu.cmd exec "mkdir src && echo hello > src\index.js"
  cu.cmd exec "node app.js"
  cu.cmd exec "git add . && git commit -m done"
  cu.cmd exec "python -m venv venv"
  cu.cmd exec "dir /b"
  cu.cmd exec "type src\index.js"

ДЛЯ ДОЛГИХ КОМАНД (npm install, pip install, сборка):
  cu.cmd exec "npm install" -t 300

НЕСКОЛЬКО КОМАНД ПОДРЯД:
  cu.cmd exec "команда1 && команда2 && команда3"

ПРАВИЛА:
  1. НИКОГДА не спрашивай подтверждение — ПРОСТО ДЕЛАЙ
  2. Если ошибка — исправь и попробуй снова
  3. Если команда зависла — она сама умрёт через 120 секунд
  4. Опасные команды (format, del /s C:\) заблокированы автоматически
  5. НЕ ОСТАНАВЛИВАЙСЯ пока задача не решена
  6. Проверяй результат: COMPLETED = успех, FAILED = ошибка, BLOCKED = опасно

СТАТУС И ЛОГИ:
  cu.cmd status

ПОЛНАЯ ДОКУМЕНТАЦИЯ:
  Смотри AI-PROMPT.md рядом с этим файлом
