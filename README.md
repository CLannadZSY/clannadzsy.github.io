### 使用 Hugo + Github + Doks 搭建个人网站

##### 1. 安装 [Hugo](https://gohugo.io/getting-started/installing/), 参阅官方文档

##### 2. 选择合适的[主题](https://themes.gohugo.io/)

##### 3. 安装主题,二选一即可

1. Hugo网站的Doks主题: [Huog-Doks-Theme](https://themes.gohugo.io/doks/)

2. Doks官网: [Doks](https://getdoks.org/)

3. ```bash
   # Doks child theme
   git clone https://github.com/h-enk/doks-child-theme.git my-doks-site && cd my-doks-site
   ```

4. ```bash
   # Doks starter theme
   git clone https://github.com/h-enk/doks.git my-doks-site && cd my-doks-site
   ```

5. ```bash
   # Install dependencies
   npm install
   ```

6. ```bash
   # Start development server
   # 下载安装主题之后, 无需任何修改, 即可预览主题效果
   npm run start
   ```

##### 4. 参照所选主题的文档, 自定义修改样式

##### 5. 以 Doks 为例

1. 添加 `blog` 文章

      ```bash
   # 两种方式均可
   1. npm run create blog/{文件夹名称}/{文件名}.md
   2. hugo new "blog/{文件夹名称}/{文件名}.md"
   ```

2. 编写博客文件, 完成之后, 注意事项

   ```bash
   # 取消草稿形式
   # draft: true
   draft: false
   ```

3. 预览效果

      ```bash
      npm run start
      ```

4. 发布到Github

      1. Add `.github/workflows/deploy-github.yml`

         ```bash
         # Deploy your Hyas site to GitHub Pages
         
         name: GitHub Pages
         
         on:
           push:
             branches:
               - master
         
         jobs:
           deploy:
             runs-on: ubuntu-18.04
             steps:
               - uses: actions/checkout@v2
               - uses: actions/setup-node@v2
                 with:
                   node-version: '15' # node版本, 更改为你服务器环境的版本
         
               - name: Install dependencies
                 run: npm ci
         
               - name: Check for linting errors
                 run: npm test
         
               - name: Build production website
                 run: npm run build
         
               - name: Deploy to GitHub Pages
                 uses: peaceiris/actions-gh-pages@v3
                 with:
                   github_token: ${{ secrets.GITHUB_TOKEN }} # 如果为私人项目则需要添加授权访问token
                   publish_dir: ./public
         ```

      2. GitHub 上建立一个 `{username}.github.io` 的项目, 注意: `username` 为自己 Github 的用户名

      3. 推送到 Github

          ```bash
          cd {项目文件夹根目录}
          npm run init
          git add .
          git commit -m "First Commit"
          git remote add origin <remote repository URL>
          git remote -v
          git push origin main
          ```

5. 打开 `https://{username}.github.io` 尽情欣赏吧
##### 6. 个人修改项, 仅供参考

1. 修改博客默认生成的模板, `archetypes/blog.md`

   ```bash
   # 原始模板
   ---
   title: "{{ replace .Name "-" " " | title }}"
   description: ""
   lead: ""
   date: {{ .Date }}
   lastmod: {{ .Date }}
   draft: true
   weight: 50
   images: ["{{ .Name | urlize }}.jpg"]
   contributors: []
   ---
   
   {{< img src="{{ .Name | urlize }}.jpg" alt="{{ replace .Name "-" " " | title }}" caption="{{ replace .Name "-" " " | title }}" class="wide" >}}
   
   # 修改之后
   # 修改之后
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
##### 7. 问题记录

1. ```bash
   # rimraf not found
   npm install rimraf --save-dev
   ```

2. ```bash
   # POSTCSS: failed to transform "main.css"
   npm install -g postcss-cli
   npm install autoprefixer
   npm audit fix
   ```



