
const fs = require('node:fs'), path = require('node:path');
const TOKEN = JSON.parse(fs.readFileSync('/Users/shawnjr/Hexo-aurora/.blog-studio.json', 'utf8')).token;
(async () => {
  const r = await fetch('http://127.0.0.1:7788/api/publish?token=' + TOKEN, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'post: 精简《老桑大学习》结尾；studio: 推送按钮改为构建+发布直出' })
  });
  const j = await r.json();
  console.log('ok=' + j.ok, 'needsMessage=' + j.needsMessage, 'error=' + (j.error || '-'));
  for (const s of j.steps || []) {
    console.log('[' + (s.ok ? 'OK  ' : 'FAIL') + '] ' + s.name + ' :: ' + (s.output || '').split('\n').filter(Boolean).slice(-2).join(' | '));
  }
})();
