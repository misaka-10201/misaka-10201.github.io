# blog-studio

自建的博客审阅 / 编辑 / 提交应用。零新增依赖：只用 Node 自带模块 + 仓库里已有的 `js-yaml`、`marked`、`hexo-abbrlink`，git 用系统命令。

## 启动

```bash
npm run studio            # 默认 0.0.0.0:7788
npm run studio -- --port 9000 --host 127.0.0.1
```

启动日志会打印两个地址（都带访问口令）：

- 本机：`http://127.0.0.1:7788/?token=...`
- 局域网：`http://<Mac 的内网 IP>:7788/?token=...` ← iPhone 同 WiFi 直接用这个

口令随机生成并保存在 `.blog-studio.json`（已 gitignore）。首次带 `?token=` 打开后浏览器会记住 cookie，之后不必再带。

## 界面

| 区域 | 作用 |
| --- | --- |
| 左栏 | 文章列表，可按 标题/标签 搜索，按「草稿 / 有改动」筛选；底部是仓库状态（分支、未提交数、远端） |
| 中间 | 上半是 front-matter **原文**（YAML，不做重排，避免污染 diff），下半是 Markdown 正文 |
| 右栏 | 预览（marked 实时渲染）/ 主题预览（内嵌 hexo server）/ Diff（该文件未提交的改动）/ 输出（命令回显） |

按钮：保存（⌘S，另有 1.3 秒自动保存）、还原、校验（跑 `hexo generate`）、提交、发布、＋（新建文章，自动按标题算 crc32 abbrlink）。

两个出口的区别：

- **提交**：只提交到源码分支（`source`），对话框里默认勾选「先跑 hexo generate 校验」，构建不过不会提交。站点不会变化。
- **发布**：一条链走完 `提交改动 → 推送源码 → hexo clean → hexo generate → hexo deploy`，最后一步把 `public/` force-push 到 `main`，aurora.love 立刻更新。构建失败或 `public/CNAME` 丢失都会在部署前中断，站点保持原样。

保存走的是「先比对内容哈希再写」的乐观锁：磁盘上的文件若已被别的标签页改过，保存会被拒绝（400/409）并提示刷新，不会静默覆盖。

## 前置条件（一次性）

1. 仓库初始化：左栏底部「初始化仓库」→ 会 `git init -b main` + 首次提交。若 `themes/*/` 里还有嵌套 `.git`，接口会拒绝并提示先移走。
2. 设置远端：「设置远端」填 `git@github.com:<你>/<仓库>.git`，之后就能推送。
3. 手机上用：确认 Mac 和 iPhone 在同一 WiFi；防火墙若拦截请放行 7788。

## 注意

- 口令走明文 HTTP，只在可信局域网内使用，别把这个端口暴露到公网。
- `hexo server`（主题预览）默认占用 4000；与「校验」并发跑时 `public/` 和 `db.json` 会互相抢，先停预览再做正式构建更稳。
- 页面的主题预览 iframe 用 `location.hostname` 拼地址，所以手机上看到的是 Mac 的局域网地址，不是 `127.0.0.1`。
