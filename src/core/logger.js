/**
 * Control Ultra — Logger
 * Система логирования с ротацией файлов и форматированием
 */

const fs = require('fs');
const path = require('path');

const LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
};

const LEVEL_COLORS = {
    error: '\x1b[31m',    // Red
    warn: '\x1b[33m',     // Yellow
    info: '\x1b[36m',     // Cyan
    verbose: '\x1b[37m',  // White
    debug: '\x1b[90m',    // Gray
};

const RESET = '\x1b[0m';

class Logger {
    constructor(config = {}) {
        this.enabled = config.enabled !== false;
        this.level = config.level || 'info';
        this.maxFileSizeMB = config.maxFileSizeMB || 10;
        this.rotateFiles = config.rotateFiles || 5;
        this.logDir = config.logDir || path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, 'control-ultra.log');
        this.listeners = [];

        if (this.enabled) {
            this._ensureLogDir();
        }
    }

    /**
     * Добавляет слушателя логов (для WebSocket трансляции)
     */
    addListener(fn) {
        this.listeners.push(fn);
    }

    removeListener(fn) {
        this.listeners = this.listeners.filter(l => l !== fn);
    }

    error(module, ...args) { this._log('error', module, args); }
    warn(module, ...args) { this._log('warn', module, args); }
    info(module, ...args) { this._log('info', module, args); }
    verbose(module, ...args) { this._log('verbose', module, args); }
    debug(module, ...args) { this._log('debug', module, args); }

    _log(level, module, args) {
        if (!this.enabled) return;
        if (LEVELS[level] > LEVELS[this.level]) return;

        const timestamp = new Date().toISOString();
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        const fullMessage = `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}`;

        // Console output с цветом
        const color = LEVEL_COLORS[level] || '';
        console.log(`${color}${fullMessage}${RESET}`);

        // File output
        this._writeToFile(fullMessage + '\n');

        // Notify listeners
        const entry = { timestamp, level, module, message };
        for (const listener of this.listeners) {
            try { listener(entry); } catch { /* ignore */ }
        }
    }

    _writeToFile(text) {
        try {
            fs.appendFileSync(this.logFile, text, 'utf-8');
            this._checkRotation();
        } catch {
            // Ignore file write errors
        }
    }

    _checkRotation() {
        try {
            const stats = fs.statSync(this.logFile);
            const sizeMB = stats.size / (1024 * 1024);

            if (sizeMB >= this.maxFileSizeMB) {
                this._rotate();
            }
        } catch {
            // Ignore
        }
    }

    _rotate() {
        // Сдвигаем все файлы: .log.4 -> .log.5, .log.3 -> .log.4, ...
        for (let i = this.rotateFiles - 1; i >= 1; i--) {
            const from = `${this.logFile}.${i}`;
            const to = `${this.logFile}.${i + 1}`;
            try {
                if (fs.existsSync(from)) {
                    fs.renameSync(from, to);
                }
            } catch { /* ignore */ }
        }

        // Текущий лог -> .log.1
        try {
            fs.renameSync(this.logFile, `${this.logFile}.1`);
        } catch { /* ignore */ }
    }

    _ensureLogDir() {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }
        } catch { /* ignore */ }
    }
}

module.exports = Logger;
