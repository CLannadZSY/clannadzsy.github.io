---
title: "Hugo 添加评论功能"
description: "使用 utterances Github App 为你的博客添加评论功能"
lead: ""
date: 2021-04-15T20:18:28+08:00
lastmod: 2021-04-15T20:18:28+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/2243409341/" 
---

 

### Hugo 添加评论功能

1. [安装 utterances](https://github.com/apps/utterances)

2. `layouts/blog/single.html`

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

3. `config/_default/config.toml`

   ```toml
   # 添加配置
   [params.utteranc]
     enable = true
     repo = "CLannadZSY/CLannadZSY.github.io"
     issueTerm = "title"
     theme = "github-light"
   ```

   






