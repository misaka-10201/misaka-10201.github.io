
const fs = require('node:fs');
const path = require('node:path');
const ROOT = '/Users/shawnjr/Hexo-aurora';
const TOKEN = JSON.parse(fs.readFileSync(path.join(ROOT, '.blog-studio.json'), 'utf8')).token;
const BASE = 'http://127.0.0.1:7788';
const A = (p) => BASE + p + (p.includes('?') ? '&' : '?') + 'token=' + TOKEN;
const H = { 'content-type': 'application/json' };
const log = (ok, n, x) => console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : ''));
async function j(p, opts) {
  const r = await fetch(A(p), opts); const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t.slice(0, 160) }; }
}
(async () => {
  const file = '老桑大学习.md';
  const target = path.join(ROOT, 'source/_posts', file);
  const before = fs.readFileSync(target, 'utf8');

  // 1 幂等（新 joinPost 归一化行尾）
  const post = await j('/api/post?file=' + encodeURIComponent(file));
  await j('/api/post', { method: 'PUT', headers: H, body: JSON.stringify({ file, frontMatter: post.post.frontMatter, body: post.post.body }) });
  const after = fs.readFileSync(target, 'utf8');
  log(before === after, 'round-trip still byte identical', before === after ? 'yes, ' + before.length + 'B' : 'DIFF ' + before.length + '->' + after.length);

  // 2 还原接口
  const p2 = await j('/api/post?file=' + encodeURIComponent(file));
  await j('/api/post', { method: 'PUT', headers: H, body: JSON.stringify({ file, frontMatter: p2.post.frontMatter, body: p2.post.body + '\n破坏性测试行\n' }) });
  const d1 = await j('/api/diff?file=' + encodeURIComponent(file));
  const rev = await j('/api/post/restore', { method: 'POST', headers: H, body: JSON.stringify({ file }) });
  const d2 = await j('/api/diff?file=' + encodeURIComponent(file));
  log(/破坏性测试行/.test(d1.diff || '') && rev.ok === true && /暂无改动/.test(d2.diff || ''), 'restore endpoint', 'diff→revert→' + (d2.diff || '').slice(0, 12));
  log(fs.readFileSync(target, 'utf8') === before, 'restore returns exact committed bytes', before.length + 'B');

  // 3 提交（真实流程）
  const c = await j('/api/commit', { method: 'POST', headers: H, body: JSON.stringify({ message: 'feat(studio): 顶部加「还原」按钮，保存时补行尾换行' }) });
  log(c.ok === true, 'commit via API', (c.output || '').split('\n').filter(Boolean).slice(-2).join(' | '));

  // 4 推送（此前未验证的端点）
  const push = await j('/api/push', { method: 'POST' });
  log(push.ok === true, 'push via API', (push.output || push.error || '').split('\n').slice(-2).join(' | '));
  console.log('DONE');
})();
