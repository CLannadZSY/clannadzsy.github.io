---
title: "使用 Hugo + Github + Doks 搭建个人网站"
description: "记录使用 Hugo 和 Doks 搭建个人网站的步骤，涵盖主题安装、本地预览、博客文章创建及 GitHub Pages 自动部署，并整理模板定制和构建问题。"
lead: ""
date: 2021-04-10T17:09:32+08:00
lastmod: 2021-04-10T17:09:32+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "blog/2726440838/"
---

### 使用 Hugo + Github + Doks 搭建个人网站

本文保留 2021 年 Doks 旧版项目的搭建思路，本站依赖文件中的主题版本为 Doks `0.2.3`，不代表新版 Doks 的安装教程。原先的 Node.js 15、`ubuntu-18.04` 和旧版 Actions 配置属于历史环境；Node.js 15 已结束维护，见 [Node.js 版本状态](https://nodejs.org/en/about/previous-releases)。新建项目应按所选版本的 [Doks 文档](https://getdoks.org/docs/)和 [Hugo 文档](https://gohugo.io/documentation/)选择相容的工具链。

下面的命令需在项目根目录执行。复现已有站点时以仓库的 `package.json`、`package-lock.json` 和工作流为准；记录 `node --version`、`npm --version`、`hugo version`，不要直接混用不同年代的主题与依赖。本次校订核对了仓库脚本和配置，没有重新执行安装、构建或部署。

#### 1. 安装 [Hugo](https://gohugo.io/getting-started/installing/), 参阅官方文档

#### 2. 选择合适的[主题](https://themes.gohugo.io/)

#### 3. 安装主题，选择与版本对应的方式

以下是 2021 年使用的历史克隆来源，二选一。远端默认分支可能已经升级；它们不保证现在克隆出来仍是 Doks 0.2.3。复现旧项目应使用已知提交和锁文件，新项目应使用对应版本的官方安装步骤。

1. Hugo网站的Doks主题: [Huog-Doks-Theme](https://themes.gohugo.io/doks/)

2. Doks官网: [Doks](https://getdoks.org/)

3. ```bash
   # 历史来源：Doks child theme
   git clone https://github.com/h-enk/doks-child-theme.git my-doks-site && cd my-doks-site
   ```

4. ```bash
   # 历史来源：Doks starter theme
   git clone https://github.com/h-enk/doks.git my-doks-site && cd my-doks-site
   ```

5. ```bash
   # 已有 package-lock.json 的项目按锁文件安装
   npm ci
   ```

6. ```bash
   # Start development server
   # 本站旧项目可用的预览脚本；服务地址以终端输出为准
   npm run server
   ```

#### 4. 参照所选主题的文档, 自定义修改样式

#### 5. 以 Doks 为例

1. 添加 `blog` 文章

      ```bash
   # 本站旧版脚本的两种等价方式，选择一条执行
   npm run create -- "blog/my-first-post/index.md"
   # 或者：
   hugo new "blog/my-first-post/index.md"
   ```

2. 编写博客文件, 完成之后, 注意事项

   ```yaml
   # 在新文章的 frontmatter 中取消草稿形式
   draft: false
   ```

3. 预览效果

      ```bash
      npm run server
      ```

4. 发布到Github

      1. GitHub 上建立 `{username}.github.io` 仓库，`username` 替换为自己的账号。项目站点的地址和 `baseURL` 与用户站点不同，按 [GitHub Pages 文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)配置发布来源。

      2. 工作流参考本站维护的 [`.github/workflows/deploy-github.yml`](https://github.com/CLannadZSY/clannadzsy.github.io/blob/main/.github/workflows/deploy-github.yml)。校订时它监听 `main`，执行锁文件安装、检查、构建和静态输出验收，再把 `public` 发布到 `gh-pages`；GitHub Pages 的发布分支应与实际产物分支相符。该文件仍包含为旧项目兼容而保留的工具版本，不应作为新项目的版本推荐。新项目可参考 [Hugo 官方 GitHub Pages 部署指南](https://gohugo.io/host-and-deploy/deploy-to-github-pages/)，不要把它的直接 Actions 发布方式与 `gh-pages` 分支方式混在一起。

      3. 源码分支、工作流触发分支和推送分支保持一致。本例统一为 `main`；如果自己的仓库使用别的分支，应同步修改工作流，而不是一边监听 `master`、一边推送 `main`。

      4. 先检查仓库状态。旧版 Doks 的 `npm run init` 实际包含 `rimraf .git`，会删除现有 Git 元数据，已有项目不要执行它。下面的初始化命令只用于尚无 Git 仓库的新目录，`git init -b main` 要求 Git 2.28 或更高版本，见 [Git 官方说明](https://git-scm.com/docs/git-init)。

         ```bash
         # 仅在尚无 Git 仓库的新项目根目录中初始化
         git init -b main
         git add .
         git commit -m "First Commit"
         # 将 owner 和仓库名替换成自己的远程仓库
         git remote add origin https://github.com/owner/owner.github.io.git
         git remote -v
         git push -u origin main
         ```

         如果目录来自 `git clone`，它已经是 Git 仓库，应跳过 `git init`；先用 `git status`、`git branch --show-current` 和 `git remote -v` 检查状态。已有 `origin` 时按需用 `git remote set-url origin 自己的仓库地址` 修改，不要再次添加同名远程，也不要删除 `.git`。

5. 验证发布结果

   本地先按仓库脚本检查并构建，确认预览中的首页、文章和资源能加载；推送后在 GitHub Actions 中核对对应提交的工作流是否成功，再检查 Pages 部署状态。最后打开 `https://{username}.github.io/`，核对新文章、CSS/JS 和站内链接。仅看到一次本地预览成功，不等于线上已发布；失败时先看具体步骤日志，不要反复改依赖碰运气。

#### 6. 个人修改项, 仅供参考

1. 修改博客默认生成的模板, `archetypes/blog.md`

   ```yaml
   # 修改之后，以下是 Hugo archetype 模板内容
   ---
   title: "{{ replace .Name "-" " " | title }}"
   description: ""
   lead: ""
   date: {{ .Date }}
   lastmod: {{ .Date }}
   draft: false
   weight: 50
   contributors: [作者名字]
   ---
   ```

#### 7. 问题记录

1. `rimraf not found`：先确认在正确的项目目录，并按原锁文件执行 `npm ci`。`rimraf` 已在本站 `devDependencies` 中，省略开发依赖的生产安装会导致构建工具缺失；不应在依赖没有装全时靠删除 `.git` 或盲目全局安装解决。

2. `POSTCSS: failed to transform "main.css"`：保留完整报错，检查是否安装了主题要求的 Hugo Extended 及匹配的本地 PostCSS 依赖。可用 `npm ls postcss postcss-cli autoprefixer` 核对已安装版本，再针对错误修复；全局安装 `postcss-cli` 不保证被项目构建调用。旧文中的 `npm audit fix` 会改变依赖树，不作为通用构建修复命令，更新依赖应另行审查锁文件并验证。
