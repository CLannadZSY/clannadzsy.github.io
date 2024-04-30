---
title: "MySQL8 InnoDB 数据恢复"
description: ""
lead: ""
date: 2024-04-30T08:51:56Z
lastmod: 2024-04-30T08:51:56Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/429417542/"
---

# MySQL8 InnoDB 数据恢复

~~ 硬盘突然损坏, 数据侥幸得以导出 ~~

1. 前提条件

   1.1 提前创建好表的结构 `sql`, 执行 `sql` 恢复表的结构

   1.2 然后使用 `table_name.ibd `的文件覆盖, 最好是一张表恢复成功再覆盖下一张

2. 找到 `mysql` 安装目录文件夹, 进入需要恢复的数据库的`database_name`文件夹

3. 将 `table_name.ibd` 复制进去, 修改文件为所属为 `mysql`

      ```bash
      sudo chown mysql:mysql <table_name>.ibd
      ```

4. ```bach
   mysql -u root -p
   ```

5. ```mysql
   user <database_name>;
   ```

6. ```mysql
   ALTER TABLE <table_name> DISCARD TABLESPACE;
   ```

7. ```mysql
   ALTER TABLE <table_name> IMPORT TABLESPACE;
   ```

8. ```mysql
   # 验证数据是否恢复成功
   select * from  crocodile_user limit 1;
   ```

   


​	