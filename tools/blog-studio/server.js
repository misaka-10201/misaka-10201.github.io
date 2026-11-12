#!/usr/bin/env node
'use strict';
/**
 * blog-studio — 本地「审阅 + 编辑 + git 提交推送」应用
 * 用法: node tools/blog-studio/server.js [--port 7788] [--host 0.0.0.0] [--token xxx]
 */
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { URL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const POSTS_DIR = path.join(ROOT, 'source', '_posts');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_PATH = path.join(ROOT, '.blog-studio.json');
const HEXO_BIN = path.join(ROOT, 'node_modules', 'hexo', 'bin', 'hexo');
const GIT = 'git';

const yaml = require(path.join(ROOT, 'node_modules', 'js-yaml'));
const crc32 = require(path.join(ROOT, 'node_modules', 'hexo-abbrlink', 'lib', 'crc32'));

// ---------- 参数与配置 ----------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}
const ARGS = parseArgs(process.argv.slice(2));

function loadConfig() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) { cfg = {}; }
  if (!cfg.token) cfg.token = crypto.randomBytes(12).toString('hex');
  cfg.port = Number(ARGS.port || cfg.port || 7788);
  cfg.host = ARGS.host || cfg.host || '0.0.0.0';
  cfg.previewPort = Number(cfg.previewPort || 4000);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return cfg;
}
const CFG = loadConfig();
if (ARGS.token) CFG.token = String(ARGS.token);

// ---------- 子进程 ----------
function run(cmd, args, opts = {}) {
  const { cwd = ROOT, timeout = 180000, env } = opts;
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, env: { ...process.env, ...(env || {}) } });
    } catch (e) {
      return resolve({ code: -1, out: '', err: String(e && e.message) });
    }
    let out = '', err = '', done = false;
    const timer = setTimeout(() => {
      if (!done) { try { child.kill('SIGKILL'); } catch (_) {} err += '\n[超时 ' + timeout + 'ms，已终止]'; }
    }, timeout);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { done = true; clearTimeout(timer); resolve({ code: -1, out, err: err + String(e && e.message) }); });
    child.on('close', (code) => { done = true; clearTimeout(timer); resolve({ code, out, err }); });
  });
}
const git = (args, opts) => run(GIT, args, opts);
const hexoCli = (args, opts) => run(process.execPath, [HEXO_BIN, ...args], opts);

// ---------- 文章读写 ----------
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function splitPost(raw) {
  const m = raw.match(FM_RE);
  if (!m) return { frontMatter: '', body: raw };
  let body = raw.slice(m[0].length);
  if (body.startsWith('\r\n')) body = body.slice(2);
  else if (body.startsWith('\n')) body = body.slice(1);
  return { frontMatter: m[1], body };
}
function joinPost(frontMatter, body) {
  const fm = String(frontMatter == null ? '' : frontMatter).replace(/\s+$/, '');
  const b = String(body == null ? '' : body).replace(/\n+$/, '');
  return '---\n' + fm + '\n---\n\n' + (b ? b + '\n' : '');
}
function parseFmList(fm) {
  const m = fm.match(/^tags:\s*\n((?:[ \t]*-[ \t]*.*\n?)+)/m);
  if (!m) return [];
  return m[1].split(/\r?\n/).map((l) => l.replace(/^[ \t]*-[ \t]*/, '').trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}
function listFiles() {
  return fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
}
function safeName(file) {
  const base = path.basename(String(file || ''));
  if (!/^[^\\/]+\.md$/.test(base)) throw new Error('文件名非法');
  return base;
}
async function readPost(file) {
  const name = safeName(file);
  const full = path.join(POSTS_DIR, name);
  const raw = await fsp.readFile(full, 'utf8');
  const { frontMatter, body } = splitPost(raw);
  let data = {};
  let fmError = null;
  try { data = yaml.load(frontMatter) || {}; } catch (e) { fmError = String(e.message); }
  const stat = await fsp.stat(full);
  const dateVal = data.date instanceof Date ? toDateStr(data.date) : (data.date ? String(data.date) : '');
  return {
    file: name, raw, frontMatter, body, fmError,
    title: data.title ? String(data.title) : name.replace(/\.md$/, ''),
    date: dateVal,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : (data.tags ? [String(data.tags)] : []),
    categories: Array.isArray(data.categories) ? data.categories.map(String) : (data.categories ? [String(data.categories)] : []),
    abbrlink: data.abbrlink ? String(data.abbrlink) : '',
    published: data.published === false ? false : true,
    mtime: stat.mtimeMs,
    bytes: stat.size,
  };
}
function toDateStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
async function gitStatusMap() {
  const res = await git(['status', '--porcelain=v1', '-z']);
  const map = {};
  if (res.code !== 0) return map;
  const parts = res.out.split('\0').filter(Boolean);
  for (const p of parts) {
    const code = p.slice(0, 2);
    const file = p.slice(3);
    map[file] = code.trim() || 'M';
  }
  return map;
}
async function repoState() {
  const inside = await git(['rev-parse', '--is-inside-work-tree']);
  const isRepo = inside.code === 0 && inside.out.trim() === 'true';
  if (!isRepo) return { isRepo: false, branch: '', remote: '', ahead: 0, dirty: 0, lastCommit: '' };
  const [br, remote, dirty, last] = await Promise.all([
    git(['rev-parse', '--abbrev-ref', 'HEAD']),
    git(['remote', 'get-url', 'origin']),
    git(['status', '--porcelain']),
    git(['log', '-1', '--format=%h %s']),
  ]);
  return {
    isRepo: true,
    branch: br.code === 0 ? br.out.trim() : '',
    remote: remote.code === 0 ? remote.out.trim() : '',
    dirty: dirty.out.split('\n').filter(Boolean).length,
    lastCommit: last.code === 0 ? last.out.trim() : '',
  };
}

// ---------- 预览服务器 ----------
let preview = { child: null, port: CFG.previewPort, startedAt: 0, log: '' };
async function startPreview() {
  if (preview.child) return preview;
  const child = spawn(process.execPath, [HEXO_BIN, 'server', '-p', String(CFG.previewPort), '-i', '0.0.0.0'], { cwd: ROOT });
  preview = { child, port: CFG.previewPort, startedAt: Date.now(), log: '' };
  child.stdout.on('data', (d) => { preview.log = (preview.log + d.toString()).slice(-4000); });
  child.stderr.on('data', (d) => { preview.log = (preview.log + d.toString()).slice(-4000); });
  child.on('close', () => { preview.child = null; });
  return preview;
}
function stopPreview() {
  if (preview.child) { try { preview.child.kill('SIGKILL'); } catch (_) {} preview.child = null; }
}
function previewUrlFor(post) {
  if (!post || !post.abbrlink) return '';
  return 'http://127.0.0.1:' + CFG.previewPort + '/post/' + encodeURIComponent(post.abbrlink) + '.html';
}

// ---------- HTTP 工具 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' };
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}
function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('请求体过大')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { const t = Buffer.concat(chunks).toString('utf8'); try { resolve(t ? JSON.parse(t) : {}); } catch (e) { reject(new Error('JSON 解析失败')); } });
    req.on('error', reject);
  });
}
function cookieToken(req) {
  const c = req.headers.cookie || '';
  const m = c.match(/(?:^|;\s*)bs_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}
function authorized(req, url) {
  const t = url.searchParams.get('token') || req.headers['x-bs-token'] || cookieToken(req);
  return t && t === CFG.token;
}

// ---------- 路由 ----------
async function handleApi(req, res, url) {
  const p = url.pathname.replace(/^\/api/, '');
  const method = req.method;

  if (p === '/state' && method === 'GET') {
    const [repo, statusMap, files] = await Promise.all([repoState(), gitStatusMap(), Promise.resolve(listFiles())]);
    const posts = [];
    for (const f of files) {
      try {
        const post = await readPost(f);
        const rel = 'source/_posts/' + f;
        posts.push({
          file: post.file, title: post.title, date: post.date, tags: post.tags,
          abbrlink: post.abbrlink, published: post.published, mtime: post.mtime,
          git: statusMap[rel] || '', fmError: post.fmError,
        });
      } catch (_) { /* 跳过损坏文件 */ }
    }
    posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return sendJson(res, 200, {
      ok: true, repo, posts,
      preview: { running: !!preview.child, port: CFG.previewPort, url: 'http://127.0.0.1:' + CFG.previewPort + '/', log: preview.log.slice(-1500) },
      root: ROOT,
    });
  }

  if (p === '/post' && method === 'GET') {
    return sendJson(res, 200, { ok: true, post: await readPost(url.searchParams.get('file')) });
  }

  if (p === '/post' && method === 'PUT') {
    const body = await readBody(req);
    const name = safeName(body.file);
    const fm = String(body.frontMatter == null ? '' : body.frontMatter);
    try { yaml.load(fm); } catch (e) { return sendJson(res, 400, { ok: false, error: 'YAML 语法错误：' + e.message }); }
    await fsp.writeFile(path.join(POSTS_DIR, name), joinPost(fm, body.body), 'utf8');
    const post = await readPost(name);
    return sendJson(res, 200, { ok: true, post, savedAt: Date.now() });
  }

  if (p === '/post/new' && method === 'POST') {
    const body = await readBody(req);
    const title = String(body.title || '').trim();
    if (!title) return sendJson(res, 400, { ok: false, error: '标题不能为空' });
    const slug = title.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
    let name = slug + '.md';
    let i = 2;
    while (fs.existsSync(path.join(POSTS_DIR, name))) name = slug + '-' + i++ + '.md';
    const abbrlink = (crc32.str(title) >>> 0).toString(16);
    const lines = [
      'title: ' + title,
      'abbrlink: ' + abbrlink,
      'date: ' + toDateStr(new Date()),
    ];
    if (body.tags) lines.push('tags:', ...String(body.tags).split(/[,，、\s]+/).filter(Boolean).map((t) => '  - ' + t.trim()));
    if (body.categories) lines.push('categories:', ...String(body.categories).split(/[,，、\s]+/).filter(Boolean).map((t) => '  - ' + t.trim()));
    if (body.published === false) lines.push('published: false');
    await fsp.writeFile(path.join(POSTS_DIR, name), joinPost(lines.join('\n'), ''), 'utf8');
    return sendJson(res, 200, { ok: true, file: name, abbrlink });
  }

  if (p === '/post/restore' && method === 'POST') {
    const body = await readBody(req);
    const name = safeName(body.file);
    const rel = 'source/_posts/' + name;
    const r = await git(['checkout', '--', rel]);
    if (r.code !== 0) return sendJson(res, 400, { ok: false, error: (r.err || r.out || '还原失败').trim() });
    return sendJson(res, 200, { ok: true, post: await readPost(name) });
  }

  if (p === '/post/delete' && method === 'POST') {
    const body = await readBody(req);
    const name = safeName(body.file);
    await fsp.unlink(path.join(POSTS_DIR, name));
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/diff' && method === 'GET') {
    const name = safeName(url.searchParams.get('file'));
    const rel = 'source/_posts/' + name;
    const staged = await git(['diff', '--cached', '--no-color', '--', rel]);
    const unstaged = await git(['diff', '--no-color', '--', rel]);
    let text = (staged.out || '') + (unstaged.out || '');
    if (!text.trim()) {
      const stat = await git(['status', '--porcelain', '--', rel]);
      if (stat.out.trim().startsWith('??')) {
        const raw = await fsp.readFile(path.join(POSTS_DIR, name), 'utf8');
        text = raw.split('\n').map((l) => '+' + l).join('\n');
      }
    }
    return sendJson(res, 200, { ok: true, diff: text || '（该文件暂无改动）' });
  }

  if (p === '/validate' && method === 'POST') {
    const r = await hexoCli(['generate']);
    const text = (r.out + '\n' + r.err).trim();
    const ok = r.code === 0 && !/ERROR|Error:/.test(r.out);
    return sendJson(res, 200, { ok, code: r.code, output: text.slice(-8000) });
  }

  if (p === '/commit' && method === 'POST') {
    const body = await readBody(req);
    const message = String(body.message || '').trim();
    if (!message) return sendJson(res, 400, { ok: false, error: '提交信息不能为空' });
    const add = await git(['add', '-A']);
    if (add.code !== 0) return sendJson(res, 200, { ok: false, output: add.err || add.out, step: 'add' });
    const commit = await git(['commit', '-m', message]);
    const output = [add.out, add.err, commit.out, commit.err].filter(Boolean).join('\n').trim();
    return sendJson(res, 200, { ok: commit.code === 0, output, step: 'commit' });
  }

  if (p === '/push' && method === 'POST') {
    const repo = await repoState();
    if (!repo.isRepo) return sendJson(res, 400, { ok: false, error: '还不是 git 仓库，请先初始化' });
    if (!repo.remote) return sendJson(res, 400, { ok: false, error: '还没有配置远程仓库（remote origin）' });
    const push = await git(['push', 'origin', 'HEAD'], { timeout: 120000 });
    const output = (push.out + '\n' + push.err).trim();
    return sendJson(res, 200, { ok: push.code === 0, output, hint: push.code === 0 ? '' : '常见原因：远端还没有这个分支（可先 push 一次）、SSH key 未加载、或需要先 pull' });
  }

  if (p === '/repo/init' && method === 'POST') {
    const body = await readBody(req);
    const themesDir = path.join(ROOT, 'themes');
    const nested = fs.existsSync(themesDir)
      ? fs.readdirSync(themesDir).filter((d) => fs.existsSync(path.join(themesDir, d, '.git')))
      : [];
    if (nested.length) {
      return sendJson(res, 400, {
        ok: false,
        error: 'themes 下有嵌套 git 仓库（' + nested.join(', ') + '），直接提交会变成空的 submodule。' +
          '先把这些 .git 移走再初始化，例如：mv themes/' + nested[0] + '/.git ~/Desktop/' + nested[0] + '-git-backup',
      });
    }
    if (!fs.existsSync(path.join(ROOT, '.git'))) {
      const init = await git(['init', '-b', 'main']);
      if (init.code !== 0) return sendJson(res, 200, { ok: false, output: init.err });
      await git(['add', '-A']);
      await git(['commit', '-m', 'chore: 初始化博客源码仓库']);
    }
    if (body.remote) {
      await git(['remote', 'remove', 'origin']);
      await git(['remote', 'add', 'origin', String(body.remote)]);
    }
    return sendJson(res, 200, { ok: true, output: (await git(['status', '-sb'])).out });
  }

  if (p === '/repo/remote' && method === 'POST') {
    const body = await readBody(req);
    const u = String(body.url || '').trim();
    if (!u) return sendJson(res, 400, { ok: false, error: 'URL 不能为空' });
    const cur = await git(['remote', 'get-url', 'origin']);
    const r = cur.code === 0 ? await git(['remote', 'set-url', 'origin', u]) : await git(['remote', 'add', 'origin', u]);
    return sendJson(res, 200, { ok: r.code === 0, output: (r.out + r.err).trim() });
  }

  if (p === '/preview/start' && method === 'POST') {
    await startPreview();
    await new Promise((r) => setTimeout(r, 3500));
    return sendJson(res, 200, { ok: !!preview.child, port: CFG.previewPort, url: 'http://127.0.0.1:' + CFG.previewPort + '/', log: preview.log.slice(-1500) });
  }

  if (p === '/preview/stop' && method === 'POST') {
    stopPreview();
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { ok: false, error: '未知接口 ' + p });
}

async function serveStatic(req, res, url) {
  if (url.pathname === '/vendor/marked.js') {
    const buf = await fsp.readFile(path.join(ROOT, 'node_modules', 'marked', 'marked.min.js'));
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'max-age=3600' });
    return res.end(buf);
  }
  let rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[\/\\])+/, ''));
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    const buf = await fsp.readFile(full);
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  } catch (_) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  try {
    if (url.pathname === '/health') return sendJson(res, 200, { ok: true });
    if (!authorized(req, url)) {
      res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' });
      return res.end('<meta charset="utf-8"><h3>需要访问口令</h3><p>用启动日志里的完整地址打开（带 <code>?token=...</code>）。</p>');
    }
    if (url.searchParams.get('token')) {
      res.setHeader('set-cookie', 'bs_token=' + encodeURIComponent(CFG.token) + '; Path=/; Max-Age=31536000; SameSite=Lax');
    }
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String((e && e.message) || e) });
  }
});

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const k of Object.keys(nets)) {
    for (const n of nets[k] || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

server.listen(CFG.port, CFG.host, () => {
  const ips = CFG.host === '0.0.0.0' ? lanAddresses() : [CFG.host];
  console.log('\n  blog-studio 已启动');
  console.log('  本机:   http://127.0.0.1:' + CFG.port + '/?token=' + CFG.token);
  for (const ip of ips) console.log('  局域网: http://' + ip + ':' + CFG.port + '/?token=' + CFG.token);
  console.log('  口令保存在 .blog-studio.json（已加入 .gitignore）\n');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { stopPreview(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 500); });
}
