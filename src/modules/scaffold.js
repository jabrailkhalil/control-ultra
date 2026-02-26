/**
 * Control Ultra — Project Scaffolder
 * Готовые шаблоны для быстрого старта проектов любого типа
 */
const path = require('path');

const TEMPLATES = {
    // ── Node.js ──
    'node-basic': {
        name: 'Node.js Basic',
        files: {
            'package.json': JSON.stringify({ name: '{{PROJECT_NAME}}', version: '1.0.0', main: 'src/index.js', scripts: { start: 'node src/index.js', dev: 'node --watch src/index.js' } }, null, 2),
            'src/index.js': "console.log('Hello from {{PROJECT_NAME}}!');\n",
            '.gitignore': 'node_modules/\n.env\nlogs/\ndist/\n',
            'README.md': '# {{PROJECT_NAME}}\n\n## Quick Start\n```bash\nnpm install\nnpm start\n```\n',
        },
        postCommands: [],
    },
    'node-express': {
        name: 'Express.js API',
        files: {
            'package.json': JSON.stringify({ name: '{{PROJECT_NAME}}', version: '1.0.0', main: 'src/server.js', scripts: { start: 'node src/server.js', dev: 'node --watch src/server.js' }, dependencies: { express: '^4.18.0', cors: '^2.8.5' } }, null, 2),
            'src/server.js': `const express = require('express');\nconst cors = require('cors');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(cors());\napp.use(express.json());\n\napp.get('/', (req, res) => res.json({ message: 'Welcome to {{PROJECT_NAME}}!' }));\napp.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));\n\napp.listen(PORT, () => console.log('Server running on port ' + PORT));\n`,
            '.gitignore': 'node_modules/\n.env\nlogs/\n',
            '.env': 'PORT=3000\nNODE_ENV=development\n',
            'README.md': '# {{PROJECT_NAME}}\n\nExpress.js API\n\n```bash\nnpm install\nnpm start\n```\n',
        },
        postCommands: ['npm install'],
    },
    'node-cli': {
        name: 'Node.js CLI Tool',
        files: {
            'package.json': JSON.stringify({ name: '{{PROJECT_NAME}}', version: '1.0.0', bin: { '{{PROJECT_NAME}}': './src/cli.js' }, scripts: { start: 'node src/cli.js' } }, null, 2),
            'src/cli.js': `#!/usr/bin/env node\nconst args = process.argv.slice(2);\nconsole.log('{{PROJECT_NAME}} CLI v1.0');\nconsole.log('Arguments:', args.join(' ') || '(none)');\n`,
            '.gitignore': 'node_modules/\n',
        },
        postCommands: [],
    },

    // ── Python ──
    'python-basic': {
        name: 'Python Basic',
        files: {
            'src/__init__.py': '',
            'src/main.py': 'def main():\n    print("Hello from {{PROJECT_NAME}}!")\n\nif __name__ == "__main__":\n    main()\n',
            'requirements.txt': '',
            '.gitignore': '__pycache__/\n*.pyc\nvenv/\n.env\n*.egg-info/\ndist/\n',
            'README.md': '# {{PROJECT_NAME}}\n\n```bash\npython -m venv venv\nvenv\\Scripts\\activate\npip install -r requirements.txt\npython src/main.py\n```\n',
        },
        postCommands: [],
    },
    'python-flask': {
        name: 'Flask Web App',
        files: {
            'app.py': `from flask import Flask, jsonify\n\napp = Flask(__name__)\n\n@app.route('/')\ndef index():\n    return jsonify(message='Welcome to {{PROJECT_NAME}}!')\n\n@app.route('/api/health')\ndef health():\n    return jsonify(status='ok')\n\nif __name__ == '__main__':\n    app.run(debug=True, port=5000)\n`,
            'requirements.txt': 'flask>=3.0\npython-dotenv\n',
            '.gitignore': '__pycache__/\n*.pyc\nvenv/\n.env\n',
            '.env': 'FLASK_ENV=development\n',
            'README.md': '# {{PROJECT_NAME}}\n\nFlask API\n\n```bash\npip install -r requirements.txt\npython app.py\n```\n',
        },
        postCommands: ['pip install -r requirements.txt'],
    },
    'python-fastapi': {
        name: 'FastAPI',
        files: {
            'main.py': `from fastapi import FastAPI\n\napp = FastAPI(title="{{PROJECT_NAME}}")\n\n@app.get("/")\ndef root():\n    return {"message": "Welcome to {{PROJECT_NAME}}!"}\n\n@app.get("/health")\ndef health():\n    return {"status": "ok"}\n`,
            'requirements.txt': 'fastapi>=0.100.0\nuvicorn[standard]>=0.23.0\n',
            '.gitignore': '__pycache__/\n*.pyc\nvenv/\n.env\n',
            'README.md': '# {{PROJECT_NAME}}\n\nFastAPI\n\n```bash\npip install -r requirements.txt\nuvicorn main:app --reload\n```\n',
        },
        postCommands: ['pip install -r requirements.txt'],
    },

    // ── HTML/CSS/JS ──
    'html-basic': {
        name: 'HTML/CSS/JS',
        files: {
            'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{PROJECT_NAME}}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>{{PROJECT_NAME}}</h1>\n  <script src="app.js"></script>\n</body>\n</html>\n',
            'style.css': '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; background: #0a0a0f; color: #eee; display: flex; justify-content: center; align-items: center; min-height: 100vh; }\nh1 { font-size: 3rem; background: linear-gradient(135deg, #785aff, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }\n',
            'app.js': "console.log('{{PROJECT_NAME}} loaded!');\n",
        },
        postCommands: [],
    },

    // ── Fullstack ──
    'fullstack-express-react': {
        name: 'Fullstack (Express + Static Frontend)',
        files: {
            'package.json': JSON.stringify({ name: '{{PROJECT_NAME}}', version: '1.0.0', scripts: { start: 'node server.js', dev: 'node --watch server.js' }, dependencies: { express: '^4.18.0', cors: '^2.8.5' } }, null, 2),
            'server.js': `const express = require('express');\nconst path = require('path');\nconst app = express();\nconst PORT = 3000;\n\napp.use(express.json());\napp.use(express.static(path.join(__dirname, 'public')));\n\napp.get('/api/hello', (req, res) => res.json({ message: 'Hello from API!' }));\n\napp.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));\n\napp.listen(PORT, () => console.log('http://localhost:' + PORT));\n`,
            'public/index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>{{PROJECT_NAME}}</title>\n  <style>\n    body { font-family: system-ui; background: #111; color: #fff; text-align: center; padding: 50px; }\n    h1 { font-size: 2.5rem; }\n    #result { margin-top: 20px; color: #785aff; }\n  </style>\n</head>\n<body>\n  <h1>{{PROJECT_NAME}}</h1>\n  <button onclick="callApi()">Call API</button>\n  <div id="result"></div>\n  <script>\n    async function callApi() {\n      const res = await fetch("/api/hello");\n      const data = await res.json();\n      document.getElementById("result").textContent = data.message;\n    }\n  </script>\n</body>\n</html>\n',
            '.gitignore': 'node_modules/\n.env\n',
        },
        postCommands: ['npm install'],
    },
};

class Scaffolder {
    constructor(fileOps) {
        this.fileOps = fileOps;
    }

    listTemplates() {
        return Object.entries(TEMPLATES).map(([key, tmpl]) => ({
            id: key,
            name: tmpl.name,
            files: Object.keys(tmpl.files).length,
        }));
    }

    getTemplate(templateId) {
        return TEMPLATES[templateId] || null;
    }

    scaffold(templateId, projectName, targetDir) {
        const template = TEMPLATES[templateId];
        if (!template) {
            return { success: false, error: 'Unknown template: ' + templateId + '. Available: ' + Object.keys(TEMPLATES).join(', ') };
        }

        const results = [];
        const baseDir = targetDir || projectName;

        for (const [filePath, content] of Object.entries(template.files)) {
            const fullPath = path.join(baseDir, filePath);
            const finalContent = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
            const result = this.fileOps.create(fullPath, finalContent);
            results.push({ file: filePath, ...result });
        }

        return {
            success: results.every(r => r.success),
            template: template.name,
            project: projectName,
            path: path.resolve(baseDir),
            files: results,
            postCommands: template.postCommands || [],
        };
    }
}

module.exports = { Scaffolder, TEMPLATES };
