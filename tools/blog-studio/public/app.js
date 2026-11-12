(function () {
  'use strict';
  var state = {
    posts: [], current: null, repo: null, filter: 'all', search: '',
    previewPort: 4000, previewRunning: false, saveTimer: null, dirty: false
  };
  function $(id) { return document.getElementById(id); }

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    return fetch('/api' + path, init).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; });
    }).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
  }

  function status(msg, isErr) {
    var el = $('status-text');
    el.textContent = msg;
    el.style.color = isErr ? 'var(--bad)' : '';
  }
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 列表 ---------- */
  function visiblePosts() {
    var q = state.search.trim().toLowerCase();
    return state.posts.filter(function (p) {
      if (state.filter === 'draft' && p.published !== false) return false;
      if (state.filter === 'changed' && !p.git) return false;
      if (!q) return true;
      return (p.title + ' ' + p.tags.join(' ') + ' ' + p.file).toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderList() {
    var ul = $('list');
    var items = visiblePosts();
    if (!items.length) {
      ul.innerHTML = '<li style="color:var(--muted);cursor:default">没有匹配的文章</li>';
      return;
    }
    ul.innerHTML = items.map(function (p) {
      var badges = '';
      if (p.published === false) badges += '<i class="badge draft">草稿</i>';
      if (p.git) badges += '<i class="badge mod">' + esc(p.git) + '</i>';
      if (p.fmError) badges += '<i class="badge err">YAML</i>';
      var active = state.current && state.current.file === p.file ? ' class="active"' : '';
      return '<li data-file="' + esc(p.file) + '"' + active + '>' +
        '<div class="li-title"><span class="t">' + esc(p.title) + '</span>' + badges + '</div>' +
        '<div class="li-meta"><span>' + esc((p.date || '').slice(0, 10)) + '</span><span>' + esc(p.tags.join(' / ')) + '</span></div>' +
        '</li>';
    }).join('');
    Array.prototype.forEach.call(ul.querySelectorAll('li[data-file]'), function (li) {
      li.addEventListener('click', function () {
        document.body.classList.remove('drawer');
        openPost(li.getAttribute('data-file'));
      });
    });
  }

  function renderRepo() {
    var el = $('repo');
    var r = state.repo;
    if (!r) { el.innerHTML = '<span>仓库状态读取中…</span>'; return; }
    if (!r.isRepo) {
      el.innerHTML = '<span>当前目录还不是 git 仓库</span>' +
        '<div class="rep-actions"><button id="btn-init">初始化仓库</button></div>';
      var b = $('btn-init');
      if (b) b.addEventListener('click', function () {
        var url = window.prompt('远程仓库地址（可留空，稍后再填）：', 'git@github.com:misaka-10201/hexo-source.git');
        if (url === null) return;
        status('初始化中…');
        api('/repo/init', { method: 'POST', body: { remote: (url || '').trim() } }).then(function (res) {
          $('output').textContent = res.output || '';
          toast(res.ok ? '仓库已初始化' : '初始化失败');
          refresh();
        });
      });
      return;
    }
    el.innerHTML =
      '<div>分支 <b>' + esc(r.branch || '-') + '</b> · 未提交 <b>' + r.dirty + '</b></div>' +
      '<div>远端 <b>' + esc(r.remote || '未配置') + '</b></div>' +
      '<div style="color:var(--muted)">' + esc(r.lastCommit || '还没有提交') + '</div>' +
      '<div class="rep-actions"><button id="btn-remote">设置远端</button><button id="btn-refresh">刷新</button></div>';
    $('btn-remote').addEventListener('click', function () {
      var url = window.prompt('remote origin 地址：', r.remote || 'git@github.com:misaka-10201/hexo-source.git');
      if (!url) return;
      api('/repo/remote', { method: 'POST', body: { url: url.trim() } }).then(function (res) {
        toast(res.ok ? '远端已保存' : '设置失败');
        refresh();
      });
    });
    $('btn-refresh').addEventListener('click', function () { refresh(); });
  }

  function refresh() {
    return api('/state').then(function (r) {
      if (!r.ok) { status('状态读取失败：' + (r.error || ''), true); return; }
      state.posts = r.posts || [];
      state.repo = r.repo;
      state.previewRunning = r.preview.running;
      state.previewPort = r.preview.port;
      renderList();
      renderRepo();
      $('btn-theme-start').textContent = state.previewRunning ? '重启 hexo server' : '启动 hexo server';
    });
  }

  /* ---------- 打开 / 保存 ---------- */
  function openPost(file) {
    localStorage.setItem('bs:last', file);
    return api('/post?file=' + encodeURIComponent(file)).then(function (r) {
      if (!r.ok) { toast(r.error || '打开失败'); return; }
      state.current = r.post;
      state.dirty = false;
      $('fm').value = r.post.frontMatter;
      $('body').value = r.post.body;
      $('cur-title').textContent = r.post.title;
      $('cur-sub').textContent = (r.post.date || '') +
        (r.post.abbrlink ? ' · post/' + r.post.abbrlink + '.html' : ' · 无 abbrlink') +
        (r.post.published === false ? ' · 草稿' : '');
      renderList();
      renderPreview();
      loadDiff();
      status('已打开 ' + file);
      $('theme-frame').removeAttribute('src');
      $('theme-hint').textContent = '';
    });
  }

  function save(silent) {
    if (!state.current) { toast('先选一篇文章'); return Promise.resolve(); }
    var payload = {
      file: state.current.file,
      frontMatter: $('fm').value,
      body: $('body').value
    };
    return api('/post', { method: 'PUT', body: payload }).then(function (r) {
      if (!r.ok) { status('保存失败：' + (r.error || ''), true); toast('保存失败：' + (r.error || '')); return; }
      state.dirty = false;
      var keep = state.current.file;
      state.current = r.post;
      $('cur-title').textContent = r.post.title;
      $('cur-sub').textContent = (r.post.date || '') +
        (r.post.abbrlink ? ' · post/' + r.post.abbrlink + '.html' : ' · 无 abbrlink') +
        (r.post.published === false ? ' · 草稿' : '');
      status((silent ? '已自动保存 ' : '已保存 ') + new Date().toLocaleTimeString());
      if (!silent) toast('已保存到磁盘');
      return refresh().then(function () { if (state.current) loadDiff(); });
    });
  }

  function scheduleSave() {
    state.dirty = true;
    status('编辑中… 未保存');
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(function () { save(true); }, 1300);
  }

  /* ---------- 预览 ---------- */
  function renderPreview() {
    if (typeof marked === 'undefined') { $('tab-preview').textContent = 'marked 未加载'; return; }
    var text = $('body').value || '';
    $('tab-preview').innerHTML = marked.parse(text, { gfm: true, breaks: false });
  }

  function themeUrl() {
    if (!state.current || !state.current.abbrlink) return '';
    return 'http://' + location.hostname + ':' + state.previewPort + '/post/' + encodeURIComponent(state.current.abbrlink) + '.html';
  }

  function startTheme() {
    if (!state.current) { toast('先选一篇文章'); return; }
    $('theme-hint').textContent = '启动中…';
    save(true).then(function () {
      return api('/preview/start', { method: 'POST' });
    }).then(function (r) {
      if (!r.ok) { $('theme-hint').textContent = '启动失败'; toast(r.error || '启动失败'); return; }
      state.previewRunning = true;
      state.previewPort = r.port;
      var u = themeUrl();
      $('theme-hint').textContent = u ? '' : '这篇文章没有 abbrlink，先在 front-matter 里补一个';
      if (u) $('theme-frame').src = u + '?t=' + Date.now();
    });
  }

  /* ---------- diff / 输出 ---------- */
  function loadDiff() {
    if (!state.current) return Promise.resolve();
    return api('/diff?file=' + encodeURIComponent(state.current.file)).then(function (r) {
      var text = (r && r.diff) || '（无）';
      $('diff-out').innerHTML = text.split('\n').map(function (line) {
        var cls = '';
        if (line.indexOf('+++') === 0 || line.indexOf('---') === 0) cls = 'diff-hunk';
        else if (line.indexOf('@@') === 0) cls = 'diff-hunk';
        else if (line.charAt(0) === '+') cls = 'diff-add';
        else if (line.charAt(0) === '-') cls = 'diff-del';
        return '<span class="' + cls + '">' + esc(line) + '</span>';
      }).join('\n');
    });
  }

  /* ---------- 校验 / 提交 / 推送 ---------- */
  function validate() {
    status('正在跑 hexo generate…');
    switchTab('output');
    switchView('output');
    $('output').textContent = '正在构建…';
    return api('/validate', { method: 'POST' }).then(function (r) {
      $('output').textContent = r.output || (r.ok ? '构建通过' : '构建失败');
      status(r.ok ? '构建通过 ✓' : '构建失败 ✗', !r.ok);
      toast(r.ok ? '构建通过' : '构建失败，看输出');
      return r.ok;
    });
  }

  function openCommit() {
    if (!state.repo || !state.repo.isRepo) { toast('先初始化 git 仓库'); return; }
    var t = state.current ? state.current.title : '';
    $('commit-msg').value = t ? 'post: 更新《' + t + '》' : 'chore: 站点更新';
    $('commit-out').classList.add('hidden');
    $('btn-commit-go').disabled = false;
    $('modal').classList.remove('hidden');
    $('commit-msg').focus();
  }

  function doCommit() {
    var msg = $('commit-msg').value.trim();
    if (!msg) { toast('提交信息不能为空'); return; }
    var out = $('commit-out');
    out.classList.remove('hidden');
    out.textContent = '';
    $('btn-commit-go').disabled = true;

    var chain = Promise.resolve(true);
    if ($('commit-validate').checked) {
      out.textContent = '1/2 正在跑 hexo generate…';
      chain = api('/validate', { method: 'POST' }).then(function (r) {
        if (!r.ok) {
          out.textContent = r.output || '构建失败';
          out.textContent += '\n\n✗ 构建失败，已阻止提交。';
          $('btn-commit-go').disabled = false;
          return false;
        }
        return true;
      });
    }
    chain.then(function (pass) {
      if (!pass) return null;
      out.textContent += '\n2/2 提交中…';
      return save(false).then(function () {
        return api('/commit', { method: 'POST', body: { message: msg } });
      });
    }).then(function (r) {
      if (!r) return;
      out.textContent = (out.textContent || '') + '\n\n' + (r.output || '');
      if (r.ok) {
        toast('已提交');
        $('modal').classList.add('hidden');
        refresh();
      } else {
        toast(r.error || '提交失败');
        $('btn-commit-go').disabled = false;
      }
    });
  }

  function doPush() {
    if (!state.repo || !state.repo.remote) { toast('先设置 remote origin'); return; }
    if (state.dirty) { toast('还有未保存的编辑'); return; }
    if (!window.confirm('推送到 ' + state.repo.remote + ' 的 ' + (state.repo.branch || 'HEAD') + '？')) return;
    status('推送中…');
    switchTab('output');
    switchView('output');
    $('output').textContent = '正在 push…';
    api('/push', { method: 'POST' }).then(function (r) {
      $('output').textContent = (r.output || '') + (r.error ? '\n' + r.error : '') + (r.hint ? '\n提示：' + r.hint : '');
      status(r.ok ? '推送成功 ✓' : '推送失败 ✗', !r.ok);
      toast(r.ok ? '已推送到 GitHub' : '推送失败，看输出');
      refresh();
    });
  }

  /* ---------- 界面切换 ---------- */
  function switchTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tabpane'), function (p) {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
  }
  function switchView(view) {
    document.body.setAttribute('data-view', view);
    Array.prototype.forEach.call(document.querySelectorAll('#mobilenav button'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    if (view === 'diff') loadDiff();
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    $('btn-menu').addEventListener('click', function () { document.body.classList.toggle('drawer'); });
    $('drawer-backdrop').addEventListener('click', function () { document.body.classList.remove('drawer'); });
    $('btn-save').addEventListener('click', function () { clearTimeout(state.saveTimer); save(false); });
    $('btn-revert').addEventListener('click', function () {
      if (!state.current) { toast('先选一篇文章'); return; }
      if (!window.confirm('丢弃这篇文章未提交的改动，回到上次提交的版本？')) return;
      api('/post/restore', { method: 'POST', body: { file: state.current.file } }).then(function (r) {
        if (!r.ok) { toast(r.error || '还原失败'); return; }
        var p = r.post;
        state.current = p;
        state.dirty = false;
        $('fm').value = p.frontMatter;
        $('body').value = p.body;
        $('cur-title').textContent = p.title;
        renderPreview();
        loadDiff();
        toast('已还原到上次提交');
        refresh();
      });
    });
    $('btn-validate').addEventListener('click', validate);
    $('btn-commit').addEventListener('click', openCommit);
    $('btn-push').addEventListener('click', doPush);
    $('btn-theme-start').addEventListener('click', startTheme);
    $('btn-theme-refresh').addEventListener('click', function () {
      var u = themeUrl();
      if (u) $('theme-frame').src = u + '?t=' + Date.now();
      else $('theme-hint').textContent = '这篇文章没有 abbrlink';
    });
    $('btn-new').addEventListener('click', function () {
      var title = window.prompt('新文章标题：');
      if (!title || !title.trim()) return;
      var tags = window.prompt('标签（逗号分隔，可留空）：', '') || '';
      var cats = window.prompt('分类（逗号分隔，可留空）：', '') || '';
      api('/post/new', { method: 'POST', body: { title: title.trim(), tags: tags, categories: cats } }).then(function (r) {
        if (!r.ok) { toast(r.error || '创建失败'); return; }
        toast('已创建 ' + r.file);
        refresh().then(function () { openPost(r.file); });
      });
    });
    $('search').addEventListener('input', function () { state.search = this.value; renderList(); });
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
      c.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (x) { x.classList.remove('active'); });
        c.classList.add('active');
        state.filter = c.getAttribute('data-filter');
        renderList();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#mobilenav button'), function (b) {
      b.addEventListener('click', function () {
        var view = b.getAttribute('data-view');
        if (view === 'preview') switchTab('preview');
        if (view === 'diff') switchTab('diff');
        if (view === 'output') switchTab('output');
        switchView(view);
      });
    });
    ['fm', 'body'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        scheduleSave();
        if (id === 'body') renderPreview();
      });
      $(id).addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          var t = e.target, s = t.selectionStart, en = t.selectionEnd;
          t.value = t.value.slice(0, s) + '  ' + t.value.slice(en);
          t.selectionStart = t.selectionEnd = s + 2;
          scheduleSave();
        }
      });
    });
    $('btn-commit-cancel').addEventListener('click', function () { $('modal').classList.add('hidden'); });
    $('btn-commit-go').addEventListener('click', doCommit);
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); clearTimeout(state.saveTimer); save(false); }
    });
  }

  bind();
  refresh().then(function () {
    var last = localStorage.getItem('bs:last');
    if (last && state.posts.some(function (p) { return p.file === last; })) openPost(last);
  });
})();
