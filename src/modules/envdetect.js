/**
 * Control Ultra — Environment Detector
 * Определяет что установлено в системе, версии, пути
 * AI-ассистент использует это чтобы понять что доступно
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class EnvDetector {
    constructor() {
        this._cache = null;
        this._cacheTime = 0;
        this._cacheTTL = 60000; // 1 минута кэш
    }

    /**
     * Полное сканирование окружения
     */
    async detect() {
        if (this._cache && (Date.now() - this._cacheTime < this._cacheTTL)) {
            return this._cache;
        }

        const result = {
            system: this._detectSystem(),
            runtimes: this._detectRuntimes(),
            packageManagers: this._detectPackageManagers(),
            tools: this._detectTools(),
            shells: this._detectShells(),
            editors: this._detectEditors(),
            databases: this._detectDatabases(),
            containers: this._detectContainers(),
            cloud: this._detectCloud(),
            project: null, // Заполняется если указан путь
        };

        this._cache = result;
        this._cacheTime = Date.now();
        return result;
    }

    /**
     * Анализ конкретного проекта
     */
    analyzeProject(projectPath) {
        const result = {
            path: projectPath,
            type: 'unknown',
            language: [],
            framework: null,
            packageManager: null,
            hasGit: false,
            dependencies: {},
            scripts: {},
            structure: [],
        };

        try {
            // Проверяем package.json (Node.js)
            const pkgPath = path.join(projectPath, 'package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                result.type = 'node';
                result.language.push('javascript');
                result.packageManager = fs.existsSync(path.join(projectPath, 'yarn.lock')) ? 'yarn'
                    : fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml')) ? 'pnpm'
                        : 'npm';
                result.dependencies = {
                    production: Object.keys(pkg.dependencies || {}),
                    dev: Object.keys(pkg.devDependencies || {}),
                };
                result.scripts = pkg.scripts || {};

                // Detect framework
                const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
                if (allDeps.next) result.framework = 'next.js';
                else if (allDeps.react) result.framework = 'react';
                else if (allDeps.vue) result.framework = 'vue';
                else if (allDeps.angular || allDeps['@angular/core']) result.framework = 'angular';
                else if (allDeps.svelte) result.framework = 'svelte';
                else if (allDeps.express) result.framework = 'express';
                else if (allDeps.fastify) result.framework = 'fastify';
                else if (allDeps.nuxt) result.framework = 'nuxt';

                if (pkg.type === 'module' || allDeps.typescript) {
                    result.language.push('typescript');
                }
            }

            // Проверяем requirements.txt / pyproject.toml (Python)
            if (fs.existsSync(path.join(projectPath, 'requirements.txt')) ||
                fs.existsSync(path.join(projectPath, 'pyproject.toml')) ||
                fs.existsSync(path.join(projectPath, 'setup.py'))) {
                result.type = result.type === 'node' ? 'fullstack' : 'python';
                result.language.push('python');

                if (fs.existsSync(path.join(projectPath, 'Pipfile'))) result.packageManager = 'pipenv';
                else if (fs.existsSync(path.join(projectPath, 'poetry.lock'))) result.packageManager = 'poetry';
                else result.packageManager = result.packageManager || 'pip';

                // Detect framework
                const reqPath = path.join(projectPath, 'requirements.txt');
                if (fs.existsSync(reqPath)) {
                    const reqs = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
                    if (reqs.includes('django')) result.framework = result.framework || 'django';
                    else if (reqs.includes('flask')) result.framework = result.framework || 'flask';
                    else if (reqs.includes('fastapi')) result.framework = result.framework || 'fastapi';
                    else if (reqs.includes('pytorch') || reqs.includes('torch')) result.framework = result.framework || 'pytorch';
                    else if (reqs.includes('tensorflow')) result.framework = result.framework || 'tensorflow';
                }
            }

            // Проверяем Cargo.toml (Rust)
            if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
                result.type = 'rust';
                result.language.push('rust');
                result.packageManager = 'cargo';
            }

            // Проверяем go.mod (Go)
            if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
                result.type = 'go';
                result.language.push('go');
                result.packageManager = 'go mod';
            }

            // Проверяем pom.xml / build.gradle (Java)
            if (fs.existsSync(path.join(projectPath, 'pom.xml'))) {
                result.type = 'java';
                result.language.push('java');
                result.packageManager = 'maven';
            } else if (fs.existsSync(path.join(projectPath, 'build.gradle')) ||
                fs.existsSync(path.join(projectPath, 'build.gradle.kts'))) {
                result.type = 'java';
                result.language.push('java');
                result.packageManager = 'gradle';
            }

            // Проверяем .csproj (C#/.NET)
            const csprojFiles = this._findFiles(projectPath, /\.csproj$/i, 1);
            if (csprojFiles.length > 0) {
                result.type = 'dotnet';
                result.language.push('csharp');
                result.packageManager = 'nuget';
            }

            // Git
            result.hasGit = fs.existsSync(path.join(projectPath, '.git'));

            // Docker
            result.hasDocker = fs.existsSync(path.join(projectPath, 'Dockerfile')) ||
                fs.existsSync(path.join(projectPath, 'docker-compose.yml'));

            // Файловая структура (первый уровень)
            try {
                result.structure = fs.readdirSync(projectPath)
                    .filter(f => !f.startsWith('.') && f !== 'node_modules')
                    .slice(0, 30);
            } catch { }

        } catch (err) {
            result.error = err.message;
        }

        return result;
    }

    /**
     * Быстрая проверка: что нужно для запуска проекта?
     */
    whatDoINeed(projectPath) {
        const analysis = this.analyzeProject(projectPath);
        const needs = [];

        if (analysis.language.includes('javascript') || analysis.language.includes('typescript')) {
            needs.push({ tool: 'node', check: 'node --version', install: 'https://nodejs.org' });
            if (analysis.packageManager === 'yarn') {
                needs.push({ tool: 'yarn', check: 'yarn --version', install: 'npm install -g yarn' });
            } else if (analysis.packageManager === 'pnpm') {
                needs.push({ tool: 'pnpm', check: 'pnpm --version', install: 'npm install -g pnpm' });
            }
        }

        if (analysis.language.includes('python')) {
            needs.push({ tool: 'python', check: 'python --version', install: 'https://python.org' });
            if (analysis.packageManager === 'pipenv') {
                needs.push({ tool: 'pipenv', check: 'pipenv --version', install: 'pip install pipenv' });
            } else if (analysis.packageManager === 'poetry') {
                needs.push({ tool: 'poetry', check: 'poetry --version', install: 'pip install poetry' });
            }
        }

        if (analysis.language.includes('rust')) {
            needs.push({ tool: 'rustc', check: 'rustc --version', install: 'https://rustup.rs' });
        }

        if (analysis.language.includes('go')) {
            needs.push({ tool: 'go', check: 'go version', install: 'https://go.dev' });
        }

        if (analysis.hasGit) {
            needs.push({ tool: 'git', check: 'git --version', install: 'https://git-scm.com' });
        }

        if (analysis.hasDocker) {
            needs.push({ tool: 'docker', check: 'docker --version', install: 'https://docker.com' });
        }

        // Проверяем каждый инструмент
        const installed = [];
        const missing = [];

        for (const need of needs) {
            const version = this._getVersion(need.check);
            if (version) {
                installed.push({ ...need, version, status: 'installed' });
            } else {
                missing.push({ ...need, status: 'missing' });
            }
        }

        return {
            project: analysis,
            installed,
            missing,
            ready: missing.length === 0,
            suggestion: missing.length > 0
                ? `Install missing tools: ${missing.map(m => m.tool).join(', ')}`
                : 'All tools installed! Ready to go.',
        };
    }

    // ── Detection helpers ──

    _detectSystem() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            user: os.userInfo().username,
            homeDir: os.homedir(),
            tmpDir: os.tmpdir(),
            cpus: os.cpus().length,
            totalMemory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
            freeMemory: `${Math.round(os.freemem() / (1024 * 1024 * 1024))}GB`,
            uptime: `${Math.round(os.uptime() / 3600)}h`,
        };
    }

    _detectRuntimes() {
        return {
            node: this._getVersion('node --version'),
            python: this._getVersion('python --version 2>&1') || this._getVersion('python3 --version 2>&1'),
            ruby: this._getVersion('ruby --version'),
            java: this._getVersion('java -version 2>&1'),
            go: this._getVersion('go version'),
            rust: this._getVersion('rustc --version'),
            dotnet: this._getVersion('dotnet --version'),
            php: this._getVersion('php --version'),
            perl: this._getVersion('perl --version'),
            deno: this._getVersion('deno --version'),
            bun: this._getVersion('bun --version'),
        };
    }

    _detectPackageManagers() {
        return {
            npm: this._getVersion('npm --version'),
            yarn: this._getVersion('yarn --version'),
            pnpm: this._getVersion('pnpm --version'),
            pip: this._getVersion('pip --version'),
            conda: this._getVersion('conda --version'),
            cargo: this._getVersion('cargo --version'),
            composer: this._getVersion('composer --version 2>&1'),
            gem: this._getVersion('gem --version'),
            nuget: this._getVersion('nuget help 2>&1') ? 'installed' : null,
            choco: this._getVersion('choco --version'),
            scoop: this._getVersion('scoop --version 2>&1'),
            winget: this._getVersion('winget --version'),
        };
    }

    _detectTools() {
        return {
            git: this._getVersion('git --version'),
            gcc: this._getVersion('gcc --version 2>&1'),
            make: this._getVersion('make --version 2>&1'),
            cmake: this._getVersion('cmake --version'),
            curl: this._getVersion('curl --version'),
            wget: this._getVersion('wget --version 2>&1'),
            ssh: this._getVersion('ssh -V 2>&1'),
            openssl: this._getVersion('openssl version'),
            ffmpeg: this._getVersion('ffmpeg -version 2>&1'),
        };
    }

    _detectShells() {
        return {
            powershell: this._getVersion('powershell -Command "$PSVersionTable.PSVersion.ToString()"'),
            pwsh: this._getVersion('pwsh --version'),
            cmd: 'built-in',
            bash: this._getVersion('bash --version 2>&1'),
            wsl: this._getVersion('wsl --version 2>&1') ? 'installed' : null,
        };
    }

    _detectEditors() {
        return {
            vscode: this._getVersion('code --version 2>&1'),
            cursor: this._commandExists('cursor'),
            vim: this._getVersion('vim --version 2>&1'),
            notepadpp: this._commandExists('notepad++'),
        };
    }

    _detectDatabases() {
        return {
            mysql: this._getVersion('mysql --version 2>&1'),
            postgres: this._getVersion('psql --version 2>&1'),
            sqlite: this._getVersion('sqlite3 --version 2>&1'),
            mongodb: this._getVersion('mongod --version 2>&1'),
            redis: this._getVersion('redis-server --version 2>&1'),
        };
    }

    _detectContainers() {
        return {
            docker: this._getVersion('docker --version'),
            dockerCompose: this._getVersion('docker compose version 2>&1') || this._getVersion('docker-compose --version 2>&1'),
            kubectl: this._getVersion('kubectl version --client 2>&1'),
            helm: this._getVersion('helm version 2>&1'),
        };
    }

    _detectCloud() {
        return {
            aws: this._getVersion('aws --version 2>&1'),
            gcloud: this._getVersion('gcloud --version 2>&1'),
            az: this._getVersion('az --version 2>&1'),
            vercel: this._getVersion('vercel --version 2>&1'),
            netlify: this._getVersion('netlify --version 2>&1'),
            heroku: this._getVersion('heroku --version 2>&1'),
            fly: this._getVersion('fly version 2>&1'),
        };
    }

    _getVersion(cmd) {
        try {
            const result = execSync(cmd, {
                timeout: 5000,
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true,
            }).toString().trim();

            // Извлекаем номер версии
            const match = result.match(/(\d+\.\d+[\.\d]*)/);
            return match ? match[1] : result.substring(0, 50);
        } catch {
            return null;
        }
    }

    _commandExists(cmd) {
        try {
            execSync(`where ${cmd}`, { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
            return 'installed';
        } catch {
            return null;
        }
    }

    _findFiles(dirPath, pattern, maxDepth, depth = 0) {
        const results = [];
        if (depth > maxDepth) return results;
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'node_modules' || entry.name === '.git') continue;
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isFile() && pattern.test(entry.name)) {
                    results.push(fullPath);
                } else if (entry.isDirectory()) {
                    results.push(...this._findFiles(fullPath, pattern, maxDepth, depth + 1));
                }
            }
        } catch { }
        return results;
    }
}

module.exports = EnvDetector;
