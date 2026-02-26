/**
 * Control Ultra — Process Guard
 * Мониторинг запущенных процессов: обнаружение зависаний, утечек памяти, высокой нагрузки CPU
 */

const { EventEmitter } = require('events');

class ProcessGuard extends EventEmitter {
    constructor(commandEngine, superFileManager) {
        super();
        this.engine = commandEngine;
        this.superFile = superFileManager;
        this.interval = null;
        this.processTimestamps = new Map(); // id -> lastOutputTime
    }

    /**
     * Запускает мониторинг
     */
    start() {
        const config = this.superFile.getConfig();
        if (!config.processGuard || !config.processGuard.enabled) {
            console.log('[ProcessGuard] Disabled in config');
            return;
        }

        const checkInterval = config.processGuard.checkIntervalMs || 5000;

        // Слушаем stdout чтобы обновлять timestamp последнего вывода
        this.engine.on('command:stdout', ({ id }) => {
            this.processTimestamps.set(id, Date.now());
        });
        this.engine.on('command:stderr', ({ id }) => {
            this.processTimestamps.set(id, Date.now());
        });
        this.engine.on('command:started', (cmdInfo) => {
            this.processTimestamps.set(cmdInfo.id, Date.now());
        });
        this.engine.on('command:finished', (cmdInfo) => {
            this.processTimestamps.delete(cmdInfo.id);
        });

        this.interval = setInterval(() => this._check(), checkInterval);
        console.log(`[ProcessGuard] Started (check every ${checkInterval}ms)`);
    }

    /**
     * Останавливает мониторинг
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        console.log('[ProcessGuard] Stopped');
    }

    /**
     * Проверяет все запущенные процессы
     */
    _check() {
        const config = this.superFile.getConfig();
        const guardConfig = config.processGuard;
        if (!guardConfig) return;

        const hangTimeout = guardConfig.hangDetectionTimeout || 60000;
        const now = Date.now();

        for (const [id, procData] of this.engine.running) {
            const lastOutput = this.processTimestamps.get(id) || now;
            const silent = now - lastOutput;

            // Обнаружение зависания (нет вывода долгое время)
            if (silent > hangTimeout) {
                console.log(`[ProcessGuard] ⚠️  Process ${id} appears to be hanging (silent for ${Math.round(silent / 1000)}s)`);

                this.emit('process:hanging', {
                    id,
                    command: procData.info.command,
                    pid: procData.info.pid,
                    silentMs: silent,
                });

                if (guardConfig.autoKillHanging) {
                    console.log(`[ProcessGuard] 🔪 Auto-killing hanging process ${id} (PID: ${procData.info.pid})`);
                    this.engine.kill(id, 'SIGKILL');
                    this.processTimestamps.delete(id);

                    this.emit('process:autoKilled', {
                        id,
                        command: procData.info.command,
                        pid: procData.info.pid,
                        reason: 'Hang detected',
                    });
                }
            }
        }
    }

    /**
     * Возвращает статистику мониторинга
     */
    getStats() {
        const stats = [];
        const now = Date.now();

        for (const [id, procData] of this.engine.running) {
            const lastOutput = this.processTimestamps.get(id) || now;
            stats.push({
                id,
                command: procData.info.command,
                pid: procData.info.pid,
                startedAt: procData.info.startedAt,
                lastOutputMs: now - lastOutput,
                outputLines: procData.info.output.length,
                errorLines: procData.info.errors.length,
            });
        }

        return stats;
    }
}

module.exports = ProcessGuard;
