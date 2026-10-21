# clannad.icu SEO 修复计划

日期：2026-10-21。源码：`clannadzsy.github.io`。生产域名：`https://clannad.icu/`，由 GitHub Actions 构建后发布到 GitHub Pages。

## 目标与范围

修复全站与栏目 Sitemap 的地址格式和重复记录，补全首页的标题、主标题、描述及分享卡片。保留首页六组动漫台词、现有排版、配色和深色模式。

本次保留已有文章、路径和索引设置。文章摘要、模板示例清理、工具拆页及结构化数据的其他问题列入后续 P1/P2。

## 实施步骤

1. 将 Sitemap 的 `loc` 和多语言链接改为完整绝对 URL，按最终 URL 去重。全站和栏目共用输出逻辑，保留排除规则、更新时间及嵌套栏目。
2. 将首页 Title 改为“CLannadZSY｜动漫收藏、技术笔记与在线工具”，补充可见 H1 和简介，并增加博客与工具入口。
3. 统一首页 description、Open Graph 与 Twitter 的标题和描述；使用规范绝对分享 URL，增加 1200 × 630 PNG 分享图及替代文本；省略未配置的社交账号字段。
4. 按 GitHub Pages 的生产配置构建，检查生成的 Sitemap、首页 HTML、分享图和其他页面的回归情况。
5. 完成本地验收后形成可审阅的代码变更。推送后由现有 GitHub Actions 发布；发布后复查线上文件，并在 Search Console 重新提交 Sitemap。

## 验收标准

- 所有生成的 Sitemap XML 均可解析，`loc` 和多语言链接使用完整绝对地址。
- 每个 Sitemap 内无重复 URL；原有有效地址和 `sitemap_exclude` 行为得到保留。
- 首页 Title、description 和 H1 非空，且不再包含 Doks 默认介绍。
- Open Graph 与 Twitter 标题、描述一致；分享 URL 与 canonical 一致，图片 URL 可用、图片尺寸正确。
- 六组动漫台词仍完整显示，博客与工具入口可访问；桌面和手机宽度下无横向溢出，深色模式可读。
- 生产构建和仓库规定检查通过；对既有错误单独记录，避免误报为本次引入。

## 回退方式

按本次变更文件恢复上一版本后重新构建和发布，无需迁移文章 URL。

## 后续修复计划

| 阶段 | 任务 | 验收方式 |
| --- | --- | --- |
| P1 已完成 | 处理现有文章的 Markdown 格式错误，恢复 GitHub Actions 的 `npm test` 检查 | 不绕过检查，完整 `npm test` 已通过 |
| P1 摘要已完成 | 为全部 29 个独立博客页面填写准确摘要，并同步 HTML、Open Graph、Twitter 与 Article 描述 | 摘要非空且各不相同，元信息一致；正文与渲染后的文章区域不变 |
| P1 文章示例已完成 | 修正 SSH、Python、MySQL、Go 等文章的残缺示例，补充适用环境与验证方法 | 可运行示例实际验证；系统及设备步骤明确验证边界；部署前执行 Python/Go 回归 |
| P1 示例清理已完成 | 移除 9 个 Doks 示例文档及栏目页、Henk 示例作者页；保留真实作者与文章 | 10 个旧 URL 不再生成，根 Sitemap 剩余 34 个有效 URL；真实作者归档和 29 篇文章保留 |
| P1 工具拆页已完成 | 为 JSON、cURL 转 requests、时间戳工具建立独立页面，补充说明、示例和工具互链 | 三个独立 URL、Title、H1、description、可见说明与可验证示例；进入 Sitemap 和站内搜索 |
| P2 | 修正文章日期、面包屑和作者结构化数据，以及中文页语言声明 | Rich Results Test 与生成 HTML 检查通过 |
| P2 | 检查 www 证书和跳转，优化图片及广告占位、脚本加载 | 域名访问和跳转正常；移动端实测 LCP、INP、CLS |
| 持续 | 用 Search Console 验证索引状态和实际搜索需求，再扩展技术或动漫专题 | 对比页面和查询的展示、点击、CTR、排名及索引状态 |

## 本次执行结果

已完成 P0 源码修改和本地验收，并清除了 Markdown 检查阻碍。下述为本次提交前的验收记录；推送后由现有 GitHub Actions 部署，线上状态以工作流和实际响应为准。

- 根 Sitemap：原 45 条记录，修复后 44 条绝对地址、无重复；与原先的 44 个有效地址集合完全相同。
- 共检查 5 份 Sitemap、87 条记录，XML 可解析，页面存在，canonical 与 Sitemap 一致。
- 首页 Title、H1、description、Open Graph、Twitter 卡片及 1200 × 630 PNG 分享图检查通过。
- 六组动漫内容和原有布局保留；1440 像素桌面、390 像素手机及手机深色模式检查通过，无横向溢出、无本地资源缺失。
- 博客、工具和分享图片在本地生产产物预览中均可访问。
- 完整 `npm run build` 通过；本机使用临时无空格路径，并仅在构建进程启用 `NODE_OPTIONS=--openssl-legacy-provider`，兼容旧版 Hugo/PostCSS 和 Webpack。依赖及锁文件未改动。
- 两个 SEO 验收脚本、改动 Markdown 的格式检查、工作流 YAML 解析及 `git diff --check` 均通过。
- 已将 SEO 输出检查加入 GitHub Pages 工作流的构建后步骤。

已修复 27 份历史文章中的 645 处 Markdownlint 问题，完整 `npm test` 通过。修改仅涉及空白、标题层级、列表和代码围栏等格式，并为两张现有图片补充替代文本；文章文字、链接、元数据及代码逻辑保留。制表符按 4 列展开，保持原代码缩进结构；没有关闭检查规则。

`lint:markdown` 的通配符已加引号，确保 Windows 与 GitHub Linux runner 检查相同的全部文章。两个工作流引用的 SEO 验收脚本及多语言 Sitemap fixture 测试会随本次修复一起提交。

复核命令（生产构建完成后）：

```sh
python3 tests/seo-sitemap.py public --base-url https://clannad.icu/
python3 tests/seo-homepage.py public --base-url https://clannad.icu/
```

## 博客 description 修复记录

已为 30 个源文件对应的 29 个独立博客页面补充准确、独立的摘要。两份共用同一 URL 且正文相同的 Golang Chronicles 源文件共用同一摘要；故事明确描述为虚构冒险，Hello World 的摘要仅概括实际存在的两个 Python import 示例。

本次文章改动仅限 frontmatter 的 `description` 字段，其他元数据、正文、代码、链接和图片保持原样。30 份源文件的正文及 29 个页面渲染后的文章区域均通过 SHA-256 比对，完全一致。首页模板、样式和动漫内容未修改。

提交前，本地 `npm test`、完整生产构建、博客摘要检查以及原有首页和 Sitemap 验收均通过。工作流新增博客摘要检查，验证 HTML description、Open Graph、Twitter 和 Article 描述一致，且不再使用重复的站点口号。推送后由 GitHub Actions 部署，线上结果需按实际页面响应核验。

```sh
python3 tests/seo-blog-descriptions.py public --base-url https://clannad.icu/
```

## Doks 示例内容清理记录

删除 `content/docs` 中的 9 份模板文档与栏目索引，以及 `henk-verlinde` 示例作者页；实际博客中的 Hugo/Doks 建站文章和引用链接保留。作者目录改为本站说明，明确保留 `clannadzsy` 作者页、GitHub 信息及完整文章归档，原作者 URL 不变。

根 Sitemap 从 44 个 URL 减为 34 个，恰好移除上述 10 个旧地址；博客 Sitemap 仍为 29 个独立文章地址。三个示例文档栏目 Sitemap 和相关 RSS 不再生成，旧页面在 GitHub Pages 发布后应返回 404。保留原 robots 规则，允许搜索引擎读取这些 404。

站内搜索从模板文档切换为已发布的博客和工具，按最终 URL 去重，并更新搜索框提示；避免删除示例后出现空索引。文章正文、元数据和图片、首页六组动漫内容及样式源码均未改动。

新增发布内容验收并加入部署工作流，检查旧页面与 Sitemap 清理、真实文章保留、有效站内链接及作者归档。发布后同时检查普通请求和带缓存参数的响应。

提交前完整 `npm test`、生产构建及四项 SEO 输出验收通过。29 个渲染后的文章区域与清理前的 SHA-256 完全一致，158 份文章、图片、主题样式及首页等受保护文件逐字节未变；另有一份搜索脚本按上述范围更新。生产 CSS 仅清除了两个未使用的 tutorial/showcase 选择器，桌面、手机和手机深色模式中，同一首页使用清理前后 CSS 的截图像素完全一致。浏览器实测文章及工具搜索通过，索引为 30 个唯一地址。

```sh
python3 tests/seo-published-content.py public --base-url https://clannad.icu/
```

## 三个工具独立页面记录

- `/tools/json-formatter/`：格式化 JSON、JSON5 与常见 Python Dict，提供标准 JSON 和字典输入输出示例，说明数值精度及特殊值的序列化行为。
- `/tools/curl-to-requests/`：把常见 cURL 命令转换为 Python requests 代码，提供 GET 和 JSON POST 示例，并说明支持的参数及文件上传等边界。
- `/tools/timestamp/`：转换 Unix 秒、毫秒与日期时间，提供上海时区和 UTC 对照、批量转换示例及夏令时处理说明。

三个页面有各自的 Title、H1、description、绝对 canonical 和分享 URL，默认可见的单个工具面板，以及无需 JavaScript 即可阅读的使用说明与示例。工具导航和相关工具使用实际链接互通；保留现有主题配色、布局、深色模式与首页动漫内容。

时间戳工具在深色模式下的辅助标签与复制按钮沿用主题的浅灰和蓝色，提高文字可读性；其他配色和工具行为保留。

`/tools/` 从叶子页面改为工具栏目，原 URL 保留，提供独立页面入口并保留原有七个工具。原交互代码改为仅初始化当前页面存在的面板，保留命名转换、密码生成、图片预览与代理检测，以及旧 hash 入口；代理服务健康检查仅在选中代理工具时发起。

根 Sitemap 从 34 个 URL 增至 37 个，新增工具栏目 Sitemap 包含三个工具地址；站内搜索为 33 个唯一地址，覆盖 29 篇博客、工具箱及三个独立工具。29 篇既有文章的源码及本地渲染文章区域均未改变。

完整 `npm test`、生产构建、五项 SEO 验收和六项工具函数测试通过。新增 `tests/seo-tools.py` 并加入部署工作流；旧构建环境继续使用 Node 15，工具函数测试单独使用具有 Web Crypto 的 Node 22，不修改旧依赖和锁文件。

浏览器验收通过桌面、390 像素手机及手机深色模式，覆盖三个页面的转换与错误提示、复制、CSV 导出、旧工具入口及导航返回；禁用 JavaScript 后仍可阅读说明和示例。未发现横向溢出、JavaScript 运行错误或站内资源缺失。首页六组动漫内容保留，在同一首页中使用拆页前后 CSS 的三组截图像素完全一致。

```sh
python3 tests/seo-tools.py public --base-url https://clannad.icu/
node tests/loose-json.mjs
node tests/curl-to-requests.mjs
node tests/timestamp-converter.mjs
```

## 文章示例修复记录

2026-10-22 修订 26 篇技术文章，保留原主题、文章地址、标题、日期、作者和图片。补齐 SSH 主机名、配置和认证验证；按“空表 DISCARD、复制、IMPORT”的顺序重写 MySQL 8.0 表空间恢复示例；修正 Python 的导入、缩进、输出和参数示例，以及 Go 的格式化、切片、通道和条件变量示例。Scrapy、WindMouse、历史 JavaScript 分析、Shadow DOM、Android 证书、WSL 和 Hugo 建站文章补充依赖、操作环境及验证步骤。

WSL 改为先异名导入并验证恢复结果，最后才可选注销原实例；Go 网络错误文章区分连接重置与文件描述符耗尽。这两篇的 description 随准确性修订更新，其余文章元数据保持不变。29 篇独立博客的摘要仍各不相同，HTML、Open Graph、Twitter 和 Article 描述一致。

提交前的验证结果：

- Python 7 篇文章的 24 个代码块均可编译，22 个独立执行进程通过；Go 9 篇文章共验证 28 个案例，包含声明片段编译及明确预期的错误，并额外执行 60 次有限的条件变量调度。
- Scrapy 使用本地响应、模拟 Redis 与时钟验证队列和关闭条件；WindMouse 使用固定随机种子验证路径；历史 JavaScript 示例仅做离线复现，不调用第三方业务接口。
- Windows MySQL 8.0.44 独立实例验证了普通演练表带 `.cfg` 与不带 `.cfg` 的恢复，核对数据、恢复后写入和逻辑导出均通过，测试实例已停止。不将正常文件演练描述为损坏磁盘恢复保证。
- Windows OpenSSH 9.5p2 使用独立配置及官方指纹严格校验，通过 GitHub 443 端口认证并读取本站仓库 HEAD，未改动已有 SSH 配置。
- Chrome 实测 Shadow DOM 示例；OpenSSL 核对 Android 证书转换和配置文件语法。Android 设备操作、WSL 导入/注销、Linux 文件权限命令未在本机执行，正文明确适用环境和验证边界。
- 新增 `tests/article-examples.py`，直接从文章提取 Python/Go 示例；GitHub Actions 构建前运行，并在 Linux 上强制对两个条件变量程序执行竞态检查。本机 Go 未启用 CGO，未宣称本机通过竞态检查。
- 完整 `npm test`、生产构建、五项 SEO 检查及六项工具函数测试通过。根 Sitemap 的 37 个 URL、三份 Sitemap 共 69 条记录及 33 个搜索地址保持不变。
- 首页、主题和图片等 196 份受保护文件逐字节未变；首页桌面、手机及手机深色模式截图无像素差异。26 篇文章区域按预期变化，其他三个独立博客页面的文章区域保持一致。

```sh
python -m pip install -r tests/article-examples-requirements.txt
python -B tests/article-examples.py
# Linux CI 另启用 CGO 和竞态检查：
CGO_ENABLED=1 python -B tests/article-examples.py --race
```

上述为提交前验证；GitHub Actions、GitHub Pages 部署状态及线上响应需在推送后单独核验。
