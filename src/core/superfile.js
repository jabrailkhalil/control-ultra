/**
 * Control Ultra — SuperFile Manager
 * Управляет конфигурацией суперправ: загрузка, валидация, hot-reload
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const DEFAULT_CONFIG = {
  version: '1.0',
  superMode: true,
  permissions: {
    allowShellCommands: true,
    allowFileOperations: true,
    allowNetworkRequests: true,
    allowProcessKill: true,
    allowElevated: false,
  },
  safety: {
    commandTimeout: 30000,
    maxConcurrentProcesses: 5,
    blockedCommands: [],
    blockedPaths: [],
    requireConfirmation: [],
  },
  autoApprove: {
    enabled: true,
    patterns: [],
    directories: [],
  },
  processGuard: {
    enabled: true,
    checkIntervalMs: 5000,
    hangDetectionTimeout: 60000,
    autoKillHanging: true,
    maxMemoryMB: 512,
    maxCpuPercent: 90,
  },
  logging: {
    enabled: true,
    level: 'verbose',
    maxFileSizeMB: 10,
    rotateFiles: 5,
  },
};

class SuperFileManager extends EventEmitter {
  constructor(configPath) {
    super();
    this.configPath = configPath || path.join(process.cwd(), 'control-ultra.config.json');
    this.config = null;
    this.watcher = null;
  }

  /**
   * Загружает конфиг из файла. Если файла нет — создаёт дефолтный.
   */
  load() {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.log('[SuperFile] Config not found, creating default...');
        fs.writeFileSync(this.configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
        this.config = { ...DEFAULT_CONFIG };
      } else {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(raw);
        this._validateConfig();
      }
      console.log('[SuperFile] Config loaded successfully');
      console.log(`[SuperFile] Super Mode: ${this.config.superMode ? 'ON ⚡' : 'OFF 🔒'}`);
      this.emit('loaded', this.config);
    } catch (err) {
      console.error('[SuperFile] Failed to load config:', err.message);
      console.log('[SuperFile] Using default config...');
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config;
  }

  /**
   * Сохраняет текущий конфиг в файл
   */
  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      console.log('[SuperFile] Config saved');
      this.emit('saved', this.config);
    } catch (err) {
      console.error('[SuperFile] Failed to save config:', err.message);
    }
  }

  /**
   * Обновляет часть конфига (merge)
   */
  update(partial) {
    this.config = this._deepMerge(this.config, partial);
    this.save();
    this.emit('updated', this.config);
    return this.config;
  }

  /**
   * Включает наблюдение за файлом для hot-reload
   */
  watch() {
    if (this.watcher) return;

    let debounce = null;
    this.watcher = fs.watch(this.configPath, (eventType) => {
      if (eventType === 'change') {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          console.log('[SuperFile] Config file changed, reloading...');
          this.load();
          this.emit('reloaded', this.config);
        }, 300);
      }
    });

    console.log('[SuperFile] Watching config for changes...');
  }

  /**
   * Останавливает наблюдение
   */
  unwatch() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Проверяет, разрешена ли команда
   */
  isCommandAllowed(command) {
    if (!this.config.superMode) {
      return { allowed: false, reason: 'Super Mode is OFF' };
    }

    if (!this.config.permissions.allowShellCommands) {
      return { allowed: false, reason: 'Shell commands are disabled' };
    }

    // Проверка заблокированных команд
    const cmdLower = command.toLowerCase().trim();
    for (const blocked of this.config.safety.blockedCommands) {
      if (cmdLower.includes(blocked.toLowerCase())) {
        return { allowed: false, reason: `Blocked command pattern: "${blocked}"` };
      }
    }

    // Проверка заблокированных путей
    for (const blockedPath of this.config.safety.blockedPaths) {
      if (cmdLower.includes(blockedPath.toLowerCase())) {
        return { allowed: false, reason: `Blocked path: "${blockedPath}"` };
      }
    }

    // Проверка, нужно ли подтверждение
    for (const confirmPattern of this.config.safety.requireConfirmation) {
      if (cmdLower.includes(confirmPattern.toLowerCase())) {
        return { allowed: true, requireConfirmation: true, reason: `Requires confirmation: "${confirmPattern}"` };
      }
    }

    // Авто-одобрение
    if (this.config.autoApprove.enabled) {
      const isAutoApproved = this._matchesPatterns(command, this.config.autoApprove.patterns);
      if (isAutoApproved) {
        return { allowed: true, autoApproved: true, reason: 'Auto-approved by pattern' };
      }
    }

    // По умолчанию разрешаем в Super Mode
    return { allowed: true, reason: 'Super Mode is ON' };
  }

  /**
   * Проверяет, разрешена ли операция с файлом
   */
  isFileOperationAllowed(filePath) {
    if (!this.config.permissions.allowFileOperations) {
      return { allowed: false, reason: 'File operations are disabled' };
    }

    const normalizedPath = path.resolve(filePath).toLowerCase();
    for (const blockedPath of this.config.safety.blockedPaths) {
      const normalizedBlocked = path.resolve(blockedPath).toLowerCase();
      if (normalizedPath.startsWith(normalizedBlocked)) {
        return { allowed: false, reason: `Blocked path: "${blockedPath}"` };
      }
    }

    return { allowed: true, reason: 'File operation allowed' };
  }

  /**
   * Проверяет паттерны с поддержкой wildcards
   */
  _matchesPatterns(input, patterns) {
    for (const pattern of patterns) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
        'i'
      );
      if (regex.test(input.trim())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Валидация конфига
   */
  _validateConfig() {
    if (!this.config.permissions) this.config.permissions = DEFAULT_CONFIG.permissions;
    if (!this.config.safety) this.config.safety = DEFAULT_CONFIG.safety;
    if (!this.config.autoApprove) this.config.autoApprove = DEFAULT_CONFIG.autoApprove;
    if (!this.config.processGuard) this.config.processGuard = DEFAULT_CONFIG.processGuard;
    if (!this.config.logging) this.config.logging = DEFAULT_CONFIG.logging;
  }

  /**
   * Deep merge двух объектов
   */
  _deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  getConfig() {
    return this.config;
  }
}

module.exports = SuperFileManager;
