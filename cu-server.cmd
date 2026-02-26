@echo off
chcp 65001 >nul 2>&1
:: Control Ultra — Server Manager
:: Убивает старый сервер и запускает новый без зависаний

set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=restart"

if /i "%ACTION%"=="start" goto :start
if /i "%ACTION%"=="stop" goto :stop
if /i "%ACTION%"=="restart" goto :restart
if /i "%ACTION%"=="status" goto :status
goto :help

:stop
echo [CU-Server] Stopping server...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3777 " ^| findstr "LISTENING"') do (
    echo [CU-Server] Killing PID: %%P
    taskkill /PID %%P /T /F >nul 2>&1
)
:: Also kill any node processes running server.js
wmic process where "commandline like '%%server.js%%' and name='node.exe'" call terminate >nul 2>&1
echo [CU-Server] Stopped.
exit /b 0

:start
echo [CU-Server] Starting server...
start "Control Ultra Server" /B cmd /c "node src/server.js > cu-server.log 2>&1"
ping -n 2 127.0.0.1 >nul 2>&1
:: Check if started
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3777 " ^| findstr "LISTENING"') do (
    echo [CU-Server] Running on port 3777, PID: %%P
    goto :started
)
echo [CU-Server] WARNING: Server may not have started. Check cu-server.log
:started
exit /b 0

:restart
echo [CU-Server] Restarting...
call :stop
ping -n 2 127.0.0.1 >nul 2>&1
call :start
exit /b 0

:status
echo [CU-Server] Checking port 3777...
set "FOUND=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3777 " ^| findstr "LISTENING"') do (
    echo [CU-Server] RUNNING on PID: %%P
    set "FOUND=1"
)
if "%FOUND%"=="0" echo [CU-Server] NOT RUNNING
exit /b 0

:help
echo Usage: cu-server.cmd [start^|stop^|restart^|status]
exit /b 0
