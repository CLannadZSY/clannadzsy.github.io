---
title: "Hugo 添加评论功能"
description: "记录为 Hugo 博客接入 utterances 评论的配置方法，包括安装 GitHub App、在文章模板中加载评论脚本，以及设置仓库、评论关联规则和主题。"
lead: ""
date: 2021-04-15T20:18:28+08:00
lastmod: 2021-04-15T20:18:28+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/2243409341/" 
---



### Hugo 添加评论功能

适用范围：这是 2021 年 Doks 旧版模板中的 utterances 接入方式，本站 Doks 0.2.3 项目仍使用 `layouts/blog/single.html` 与 `config/_default/config.toml`。其他主题或新版 Doks 应先核对自己的文章模板位置，不要直接覆盖整个模板。以下参数按 [utterances 官方配置](https://utteranc.es/#configuration)核对；本次校订没有发布评论或创建 Issue。

utterances 用 GitHub Issues 保存评论。先准备一个公开的 GitHub 仓库，启用 Issues（fork 的仓库也要检查），再把 [utterances GitHub App](https://github.com/apps/utterances)安装到该仓库，并确认安装授权范围包含它。仓库可以专门用于评论，不必和网站源码相同；私有仓库不适合这里的公开评论读取方式。

1. 完成上述仓库、Issues 和 [App 安装](https://github.com/apps/utterances)前提，记录仓库的 `owner/repo`，例如下面的 `owner/comments-repo` 只是占位值，必须换成自己的仓库。

2. 在 `layouts/blog/single.html` 的文章内容之后添加评论脚本，保留主题原有布局。下面的 `utteranc` 是本站使用的配置键名，需与下一步 TOML 保持一致：

   ```html
   {{ define "main" }}
   <div class="row justify-content-center">
     <div class="col-md-12 col-lg-10 col-xl-8">
       <article>
         <div class="blog-header">
           <h1>{{ .Title }}</h1>
           {{ partial "main/blog-meta.html" . }}
         </div>
         <p class="lead">{{ .Params.lead | safeHTML }}</p>
         {{ .Content }}
       </article>
     </div>
   </div>

   <!-- 添加评论 -->
   {{ if .Site.Params.utteranc.enable }}
   <script src="https://utteranc.es/client.js"
           repo="{{ .Site.Params.utteranc.repo }}"
           issue-term="{{ .Site.Params.utteranc.issueTerm }}"
           theme="{{ .Site.Params.utteranc.theme }}"
           crossorigin="anonymous"
           async>
   </script>
   {{ end }}

   {{ end }}
   ```

3. 在 `config/_default/config.toml` 中合并配置；若已有 `[params.utteranc]`，修改现有表，不要重复定义同名表：

   ```toml
   # 添加配置
   [params.utteranc]
     enable = true
     repo = "owner/comments-repo" # 替换为已授权的公开仓库
     issueTerm = "title"
     theme = "github-light"
   ```

   `issueTerm = "title"` 会按文章标题查找对应 Issue，因此文章重名或后续改标题会影响关联。新站也可选择 `pathname` 按路径关联；已有评论的站点不要随意改规则，应先核对现有 Issue 的对应关系。`theme` 可按官方配置选择，示例保留 `github-light`。

4. 验证加载，不发送测试评论

   本地按本站脚本运行 `npm run server`，打开一篇文章，查看生成的页面源码是否包含自己的 `repo`、预期的 `issue-term` 和评论脚本。浏览器需允许 `utteranc.es/client.js` 及其 iframe 加载；若页面不显示，检查开发者工具的网络和控制台记录，再核对仓库公开状态、Issues、App 授权范围及浏览器拦截规则。

   部署后同样打开文章核对评论区域和已有 Issue 的关联。还没有对应 Issue 的新文章，不会仅因浏览页面就立即创建 Issue；通常在首次实际评论时才由机器人创建。读者提交评论时需要 GitHub 登录和授权，或直接前往对应 GitHub Issue 评论，见[官方工作原理](https://utteranc.es/#how-it-works)。这些读取检查无需发送评论，也不应把评论写入示例作者的仓库。
