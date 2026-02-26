/**
 * Control Ultra — Command Engine
 * Очередь команд, выполнение, таймауты, управление процессами
 */

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
let treeKill;
try {
    treeKill = require('tree-kill');
} catch {
    // Fallback если tree-kill не установлен
    treeKill = (pid, signal, cb) => {
        try { process.kill(pid, signal); } catch (e) { /* ignore */ }
        if (cb) cb();
    };
}

// Статусы команд
const STATUS = {
    QUEUED: 'queued',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    TIMEOUT: 'timeout',
    KILLED: 'killed',
    BLOCKED: 'blocked',
};

class CommandEngine extends EventEmitter {
    constructor(superFileManager) {
        super();
        this.superFile = superFileManager;
        this.queue = [];         // Очередь ожидающих команд
        this.running = new Map(); // Запущенные процессы: id -> processInfo
        this.history = [];       // История выполненных команд
        this.maxHistory = 500;
        this._processing = false;
    }

    /**
     * Добавляет команду в очередь
     * @returns {Object} commandInfo с id, status и прочим
     */
    enqueue(command, options = {}) {
        const config = this.superFile.getConfig();

        // Проверяем разрешения
        const permission = this.superFile.isCommandAllowed(command);
        if (!permission.allowed) {
            const blocked = {
                id: uuidv4(),
                command,
                status: STATUS.BLOCKED,
                reason: permission.reason,
                createdAt: new Date().toISOString(),
                output: [],
                errors: [],
            };
            this.history.push(blocked);
            this._trimHistory();
            this.emit('command:blocked', blocked);
            return blocked;
        }

        const cmdInfo = {
            id: uuidv4(),
            command,
            status: STATUS.QUEUED,
            cwd: options.cwd || process.cwd(),
            timeout: options.timeout || config.safety.commandTimeout,
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            exitCode: null,
            output: [],
            errors: [],
            pid: null,
            autoApproved: permission.autoApproved || false,
            requireConfirmation: permission.requireConfirmation || false,
            confirmed: !permission.requireConfirmation,
            env: options.env || {},
            shell: options.shell !== undefined ? options.shell : true,
            priority: options.priority || 0,
            metadata: options.metadata || {},
        };

        this.queue.push(cmdInfo);
        // Сортируем по приоритету (высокий приоритет первым)
        this.queue.sort((a, b) => b.priority - a.priority);

        this.emit('command:queued', cmdInfo);
        this._processQueue();

        return cmdInfo;
    }

    /**
     * Подтверждает команду, требующую подтверждения
     */
    confirm(commandId) {
        const cmd = this.queue.find(c => c.id === commandId);
        if (cmd && cmd.requireConfirmation) {
            cmd.confirmed = true;
            this.emit('command:confirmed', cmd);
            this._processQueue();
            return true;
        }
        return false;
    }

    /**
     * Отклоняет команду
     */
    reject(commandId) {
        const idx = this.queue.findIndex(c => c.id === commandId);
        if (idx !== -1) {
            const cmd = this.queue.splice(idx, 1)[0];
            cmd.status = STATUS.BLOCKED;
            cmd.reason = 'Rejected by user';
            cmd.finishedAt = new Date().toISOString();
            this.history.push(cmd);
            this._trimHistory();
            this.emit('command:rejected', cmd);
            return true;
        }
        return false;
    }

    /**
     * Убивает запущенный процесс
     */
    kill(commandId, signal = 'SIGTERM') {
        const proc = this.running.get(commandId);
        if (!proc) return false;

        try {
            treeKill(proc.process.pid, signal, (err) => {
                if (err) {
                    console.error(`[Engine] Failed to kill PID ${proc.process.pid}:`, err.message);
                    // Fallback — жёсткий kill
                    try { process.kill(proc.process.pid, 'SIGKILL'); } catch (e) { /* ignore */ }
                }
            });
            proc.info.status = STATUS.KILLED;
            proc.info.finishedAt = new Date().toISOString();
            this.emit('command:killed', proc.info);
            return true;
        } catch (err) {
            console.error(`[Engine] Kill error:`, err.message);
            return false;
        }
    }

    /**
     * Убивает все запущенные процессы
     */
    killAll() {
        const killed = [];
        for (const [id] of this.running) {
            if (this.kill(id)) {
                killed.push(id);
            }
        }
        return killed;
    }

    /**
     * Отправляет ввод в stdin запущенного процесса
     */
    sendInput(commandId, input) {
        const proc = this.running.get(commandId);
        if (!proc || !proc.process.stdin) return false;

        try {
            proc.process.stdin.write(input);
            this.emit('command:input', { id: commandId, input });
            return true;
        } catch (err) {
            console.error(`[Engine] Send input error:`, err.message);
            return false;
        }
    }

    /**
     * Возвращает текущее состояние
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            runningCount: this.running.size,
            maxConcurrent: this.superFile.getConfig().safety.maxConcurrentProcesses,
            queue: this.queue.map(c => ({
                id: c.id,
                command: c.command,
                status: c.status,
                createdAt: c.createdAt,
                requireConfirmation: c.requireConfirmation,
                confirmed: c.confirmed,
                priority: c.priority,
            })),
            running: Array.from(this.running.values()).map(p => ({
                id: p.info.id,
                command: p.info.command,
                pid: p.info.pid,
                startedAt: p.info.startedAt,
                output: p.info.output.slice(-20), // Последние 20 строк
                errors: p.info.errors.slice(-10),
            })),
        };
    }

    /**
     * Возвращает историю команд
     */
    getHistory(limit = 50) {
        return this.history.slice(-limit);
    }

    /**
     * Возвращает информацию о конкретной команде
     */
    getCommand(commandId) {
        // Проверяем очередь
        const queued = this.queue.find(c => c.id === commandId);
        if (queued) return queued;

        // Проверяем запущенные
        const running = this.running.get(commandId);
        if (running) return running.info;

        // Проверяем историю
        return this.history.find(c => c.id === commandId);
    }

    /**
     * Обрабатывает очередь
     */
    _processQueue() {
        if (this._processing) return;
        this._processing = true;

        const config = this.superFile.getConfig();
        const maxConcurrent = config.safety.maxConcurrentProcesses;

        while (this.queue.length > 0 && this.running.size < maxConcurrent) {
            // Ищем первую подтверждённую команду
            const idx = this.queue.findIndex(c => c.confirmed);
            if (idx === -1) break;

            const cmd = this.queue.splice(idx, 1)[0];
            this._execute(cmd);
        }

        this._processing = false;
    }

    /**
     * Выполняет команду
     */
    _execute(cmdInfo) {
        cmdInfo.status = STATUS.RUNNING;
        cmdInfo.startedAt = new Date().toISOString();

        const env = { ...process.env, ...cmdInfo.env };

        let proc;
        try {
            if (cmdInfo.shell) {
                // Команда через shell
                const isWindows = process.platform === 'win32';
                const shellCmd = isWindows ? 'cmd.exe' : '/bin/sh';
                const shellArg = isWindows ? '/c' : '-c';

                proc = spawn(shellCmd, [shellArg, cmdInfo.command], {
                    cwd: cmdInfo.cwd,
                    env,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    windowsHide: true,
                });
            } else {
                const parts = cmdInfo.command.split(/\s+/);
                proc = spawn(parts[0], parts.slice(1), {
                    cwd: cmdInfo.cwd,
                    env,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
            }
        } catch (err) {
            cmdInfo.status = STATUS.FAILED;
            cmdInfo.finishedAt = new Date().toISOString();
            cmdInfo.errors.push(`Spawn error: ${err.message}`);
            this.history.push(cmdInfo);
            this._trimHistory();
            this.emit('command:failed', cmdInfo);
            this._processQueue();
            return;
        }

        cmdInfo.pid = proc.pid;
        this.running.set(cmdInfo.id, { process: proc, info: cmdInfo });

        this.emit('command:started', cmdInfo);

        // Сбор stdout
        proc.stdout.on('data', (data) => {
            const line = data.toString();
            cmdInfo.output.push(line);
            // Лимитируем буфер
            if (cmdInfo.output.length > 10000) {
                cmdInfo.output = cmdInfo.output.slice(-5000);
            }
            this.emit('command:stdout', { id: cmdInfo.id, data: line });
        });

        // Сбор stderr
        proc.stderr.on('data', (data) => {
            const line = data.toString();
            cmdInfo.errors.push(line);
            if (cmdInfo.errors.length > 5000) {
                cmdInfo.errors = cmdInfo.errors.slice(-2500);
            }
            this.emit('command:stderr', { id: cmdInfo.id, data: line });
        });

        // Таймаут
        let timeoutHandle = null;
        if (cmdInfo.timeout > 0) {
            timeoutHandle = setTimeout(() => {
                if (this.running.has(cmdInfo.id)) {
                    console.log(`[Engine] Command timeout (${cmdInfo.timeout}ms): ${cmdInfo.command}`);
                    cmdInfo.status = STATUS.TIMEOUT;
                    cmdInfo.errors.push(`Process timed out after ${cmdInfo.timeout}ms`);
                    this.kill(cmdInfo.id, 'SIGKILL');
                    this.emit('command:timeout', cmdInfo);
                }
            }, cmdInfo.timeout);
        }

        // Завершение процесса
        proc.on('close', (code, signal) => {
            if (timeoutHandle) clearTimeout(timeoutHandle);

            if (cmdInfo.status !== STATUS.KILLED && cmdInfo.status !== STATUS.TIMEOUT) {
                cmdInfo.status = code === 0 ? STATUS.COMPLETED : STATUS.FAILED;
            }
            cmdInfo.exitCode = code;
            cmdInfo.finishedAt = new Date().toISOString();

            this.running.delete(cmdInfo.id);
            this.history.push(cmdInfo);
            this._trimHistory();

            this.emit('command:finished', cmdInfo);
            this._processQueue();
        });

        proc.on('error', (err) => {
            if (timeoutHandle) clearTimeout(timeoutHandle);

            cmdInfo.status = STATUS.FAILED;
            cmdInfo.errors.push(`Process error: ${err.message}`);
            cmdInfo.finishedAt = new Date().toISOString();

            this.running.delete(cmdInfo.id);
            this.history.push(cmdInfo);
            this._trimHistory();

            this.emit('command:failed', cmdInfo);
            this._processQueue();
        });
    }

    _trimHistory() {
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }
}

module.exports = { CommandEngine, STATUS };
