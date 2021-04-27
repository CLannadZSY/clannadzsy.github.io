"""
自动创建博客文件

脚本需要放置在项目的根目录
"""
import os
import re
import zlib
import datetime


class BlogAuto:

    def __init__(self, blog_name):
        self._today = datetime.date.today().isoformat()
        self._blog_folder_path = './content/blog'
        self._blog_folder_command = 'blog'
        self.blog_name = blog_name
        self.blog_path = f'{self._today}/{self.blog_name}.md'

    def create_blog_article(self):
        """
        创建博客文件
        """
        blog_path = f'{self._blog_folder_command}/{self.blog_path}'
        create_blog_article_command = f'npm run create {blog_path}'
        os.system(create_blog_article_command)

    def modify_blog_file(self):
        """
        修改博客文章的文件名, url 路径
        """
        blog_path = f'{self._blog_folder_path}/{self.blog_path}'
        with open(blog_path, "r", encoding="utf-8") as f:
            blog_content = f.read()
            blog_id = zlib.crc32(blog_content.encode())
            with open(blog_path, 'w', encoding="utf-8") as w:
                blog_content_new = re.sub('url: "/blog/"', f'url: "/blog/{blog_id}/"', blog_content)
                w.write(blog_content_new)

    def auto(self):
        self.create_blog_article()
        self.modify_blog_file()


if __name__ == '__main__':
    blog_name_input = input("博客文章名(默认:index): ") or 'index'
    print(blog_name_input)

    ba = BlogAuto(blog_name_input)
    ba.auto()
