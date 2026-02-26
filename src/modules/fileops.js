/**
 * Control Ultra — File Operations Module
 * Полноценные файловые операции для AI-ассистентов:
 * создание, чтение, поиск, замена, копирование, удаление
 */

const fs = require('fs');
const path = require('path');

class FileOps {
    constructor(superFileManager) {
        this.superFile = superFileManager;
    }

    /**
     * Создать файл с содержимым (создаёт директории если нужно)
     */
    create(filePath, content = '', encoding = 'utf-8') {
        const check = this._checkPermission(filePath);
        if (!check.allowed) return check;

        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content, encoding);
            return { success: true, path: filePath, size: Buffer.byteLength(content, encoding) };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Читать файл
     */
    read(filePath, encoding = 'utf-8') {
        const check = this._checkPermission(filePath);
        if (!check.allowed) return check;

        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }
            const content = fs.readFileSync(filePath, encoding);
            const stats = fs.statSync(filePath);
            return {
                success: true,
                path: filePath,
                content,
                size: stats.size,
                modified: stats.mtime.toISOString(),
                lines: content.replace(/\r\n/g, '\n').split('\n').length,
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Дописать в файл
     */
    append(filePath, content, encoding = 'utf-8') {
        const check = this._checkPermission(filePath);
        if (!check.allowed) return check;

        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.appendFileSync(filePath, content, encoding);
            return { success: true, path: filePath };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Вставить содержимое в определённую строку
     */
    insertAtLine(filePath, lineNumber, content, encoding = 'utf-8') {
        const check = this._checkPermission(filePath);
        if (!check.allowed) return check;

        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }
            const lines = fs.readFileSync(filePath, encoding).split('\n');
            const idx = Math.max(0, Math.min(lineNumber - 1, lines.length));
            lines.splice(idx, 0, content);
            fs.writeFileSync(filePath, lines.join('\n'), encoding);
            return { success: true, path: filePath, insertedAt: idx + 1, totalLines: lines.length };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Заменить текст в файле (поддерживает regex)
     */
    replace(filePath, search, replacement, options = {}) {
        const check = this._checkPermission(filePath);
        if (!check.allowed) return check;

        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }
            let content = fs.readFileSync(filePath, 'utf-8');
            const flags = options.global !== false ? 'g' : '';
            const pattern = options.regex ? new RegExp(search, flags + (options.ignoreCase ? 'i' : '')) : search;

            let count = 0;
            if (typeof pattern === 'string') {
                // Считаем замены для строк
                while (content.includes(pattern)) {
                    content = content.replace(pattern, replacement);
                    count++;
                    if (!options.global) break;
                }
            } else {
                const matches = content.match(pattern);
                count = matches ? matches.length : 0;
                content = content.replace(pattern, replacement);
            }

            fs.writeFileSync(filePath, content, 'utf-8');
            return { success: true, path: filePath, replacements: count };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Удалить строки из файла
     */
    deleteLines(filePath, fromLine, toLine, encoding = 'utf-8') {
        const check = this._checkPermission(filePath);
        if (!check.allowed) return check;

        try {
            const lines = fs.readFileSync(filePath, encoding).split('\n');
            const from = Math.max(0, fromLine - 1);
            const to = Math.min(lines.length, toLine);
            const deleted = lines.splice(from, to - from);
            fs.writeFileSync(filePath, lines.join('\n'), encoding);
            return { success: true, path: filePath, deletedLines: deleted.length, remainingLines: lines.length };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Копировать файл/директорию
     */
    copy(src, dest) {
        const check = this._checkPermission(dest);
        if (!check.allowed) return check;

        try {
            const stats = fs.statSync(src);
            if (stats.isDirectory()) {
                this._copyDir(src, dest);
            } else {
                const dir = path.dirname(dest);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.copyFileSync(src, dest);
            }
            return { success: true, src, dest };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Переместить/переименовать файл
     */
    move(src, dest) {
        const check = this._checkPermission(dest);
        if (!check.allowed) return check;

        try {
            const dir = path.dirname(dest);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.renameSync(src, dest);
            return { success: true, src, dest };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Удалить файл или директорию
     */
    remove(targetPath) {
        const check = this._checkPermission(targetPath);
        if (!check.allowed) return check;

        try {
            const stats = fs.statSync(targetPath);
            if (stats.isDirectory()) {
                fs.rmSync(targetPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(targetPath);
            }
            return { success: true, path: targetPath };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Список файлов в директории (рекурсивно)
     */
    list(dirPath, options = {}) {
        try {
            if (!fs.existsSync(dirPath)) {
                return { success: false, error: 'Directory not found' };
            }

            const recursive = options.recursive !== false;
            const pattern = options.pattern ? new RegExp(options.pattern, 'i') : null;
            const maxDepth = options.maxDepth || 10;
            const results = [];

            this._walkDir(dirPath, results, 0, maxDepth, recursive, pattern);

            return {
                success: true,
                path: dirPath,
                count: results.length,
                files: results,
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Поиск текста в файлах (grep)
     */
    search(dirPath, searchText, options = {}) {
        try {
            const filePattern = options.filePattern ? new RegExp(options.filePattern, 'i') : null;
            const searchRegex = options.regex
                ? new RegExp(searchText, options.ignoreCase ? 'gi' : 'g')
                : null;
            const maxResults = options.maxResults || 100;
            const results = [];

            const files = [];
            this._walkDir(dirPath, files, 0, options.maxDepth || 5, true, filePattern);

            for (const file of files) {
                if (file.type !== 'file') continue;
                if (results.length >= maxResults) break;

                try {
                    const content = fs.readFileSync(file.path, 'utf-8');
                    const lines = content.split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        if (results.length >= maxResults) break;

                        const match = searchRegex
                            ? searchRegex.test(lines[i])
                            : lines[i].includes(searchText);

                        if (match) {
                            results.push({
                                file: file.path,
                                line: i + 1,
                                content: lines[i].trim(),
                            });
                        }

                        // Reset regex lastIndex
                        if (searchRegex) searchRegex.lastIndex = 0;
                    }
                } catch {
                    // Skip binary files or unreadable files
                }
            }

            return { success: true, query: searchText, count: results.length, results };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Получить структуру проекта как дерево
     */
    tree(dirPath, maxDepth = 3) {
        try {
            const result = this._buildTree(dirPath, 0, maxDepth);
            return { success: true, tree: result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Проверить существование файла/директории
     */
    exists(targetPath) {
        try {
            const exists = fs.existsSync(targetPath);
            if (exists) {
                const stats = fs.statSync(targetPath);
                return {
                    exists: true,
                    type: stats.isDirectory() ? 'directory' : 'file',
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                };
            }
            return { exists: false };
        } catch {
            return { exists: false };
        }
    }

    // ── Internal helpers ──

    _checkPermission(filePath) {
        if (this.superFile) {
            return this.superFile.isFileOperationAllowed(filePath);
        }
        return { allowed: true };
    }

    _copyDir(src, dest) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                this._copyDir(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    _walkDir(dirPath, results, depth, maxDepth, recursive, pattern) {
        if (depth > maxDepth) return;

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                // Skip node_modules, .git, etc.
                if (['node_modules', '.git', '.svn', '__pycache__', '.next', 'dist'].includes(entry.name)) continue;

                const fullPath = path.join(dirPath, entry.name);
                const isDir = entry.isDirectory();

                if (!pattern || pattern.test(entry.name)) {
                    const stats = fs.statSync(fullPath);
                    results.push({
                        name: entry.name,
                        path: fullPath,
                        type: isDir ? 'directory' : 'file',
                        size: isDir ? null : stats.size,
                        modified: stats.mtime.toISOString(),
                    });
                }

                if (isDir && recursive) {
                    this._walkDir(fullPath, results, depth + 1, maxDepth, recursive, pattern);
                }
            }
        } catch {
            // Permission denied or other errors
        }
    }

    _buildTree(dirPath, depth, maxDepth, prefix = '') {
        if (depth > maxDepth) return '...';

        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
            .filter(e => !['node_modules', '.git', '.svn', '__pycache__'].includes(e.name))
            .sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

        let result = '';
        entries.forEach((entry, index) => {
            const isLast = index === entries.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';

            if (entry.isDirectory()) {
                result += `${prefix}${connector}${entry.name}/\n`;
                result += this._buildTree(
                    path.join(dirPath, entry.name),
                    depth + 1,
                    maxDepth,
                    prefix + childPrefix
                );
            } else {
                const size = fs.statSync(path.join(dirPath, entry.name)).size;
                const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`;
                result += `${prefix}${connector}${entry.name} (${sizeStr})\n`;
            }
        });

        return result;
    }
}

module.exports = FileOps;
