---
title: "MySQL8 InnoDB 数据恢复"
description: "记录 MySQL 8 InnoDB 表空间恢复笔记，涉及重建表结构、处理 .ibd 文件、设置文件权限，以及丢弃和导入表空间等操作。"
lead: ""
date: 2024-04-30T08:51:56Z
lastmod: 2026-10-22T00:06:41+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/429417542/"
---

硬盘损坏后，如果仍保留完整的 InnoDB 独立表空间文件，可以尝试把数据导入重建的空表。这里整理的是表空间导入流程，不是对任意损坏 `.ibd` 文件都能成功的恢复保证。

## 适用环境与前提

- 目标为 MySQL 8.0，使用 InnoDB 独立表空间（`innodb_file_per_table=ON`）；来源和目标版本、页大小以及表结构须满足 [MySQL 导入表空间的要求](https://dev.mysql.com/doc/refman/8.0/en/innodb-table-import.html)。演练时使用相同版本。
- 保存原始文件的只读备份，在新的恢复实例、空表中操作。`DISCARD TABLESPACE` 会丢弃目标空表的表空间文件，所以应先 DISCARD，再复制恢复文件，不能反过来。
- 必须知道原表的完整 DDL，包括列顺序、类型、索引、字符集、排序规则和行格式。下面的 `notes` 只是演练表，不能用于导入结构不同的业务表。
- 本文的简化步骤针对非分区、未加密、无外键关联和无全文索引的普通表；其他情况应按官方对应流程处理。仅有文件名相同并不足以恢复。

Linux 文件复制命令假设数据库系统用户为 `mysql`，实际服务用户和路径以目标实例为准。SQL 在 MySQL 客户端执行，Shell 命令在操作系统终端执行，两者不要混用。

## 1. 检查版本与真实数据目录

```bash
mysql -u root -p
```

```sql
SELECT VERSION(), @@datadir, @@innodb_file_per_table, @@innodb_page_size;
```

数据文件位于 `@@datadir` 对应目录，不一定在 MySQL 程序安装目录中。先核对页大小与来源一致，并确认独立表空间已启用。

如果来源实例还可读，优先取得 `SHOW CREATE TABLE` 结果。需要导出一致的物理副本时，在来源连接执行 `FLUSH TABLES notes FOR EXPORT`，保持连接和锁，在另一终端复制 `.ibd`、`.cfg` 后再 `UNLOCK TABLES`。不要把运行中的普通文件复制当成一致备份。

## 2. 在恢复库重建一致的空表

以下 DDL 是可复现的演练示例。恢复真实表时，必须替换为原表的完整 DDL，且恢复库应预先确认为空的专用数据库。

```sql
CREATE DATABASE recovery_lab
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE recovery_lab;

CREATE TABLE notes (
    id BIGINT UNSIGNED NOT NULL,
    body VARCHAR(255) NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC
  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

选择数据库的命令是 `USE recovery_lab;`，不是 `user`。不在 SQL 中原样填写 `<table_name>` 之类的占位符。

## 3. 先丢弃目标空表的表空间

在恢复库的 MySQL 连接执行：

```sql
USE recovery_lab;
ALTER TABLE notes DISCARD TABLESPACE;
```

确认这是刚创建的空表，且原始恢复文件位于数据目录以外的备份位置。此时目标的 `notes.ibd` 被移除，这是预期行为。

## 4. 再复制备份文件并修正权限

以下为 Linux Bash 示例。把 `DATADIR` 改为上面查询得到的目录，`BACKUP` 改为恢复文件副本的位置；每次只处理一张表。

```bash
DATADIR=/var/lib/mysql
BACKUP=/backup/recovered

sudo cp "$BACKUP/notes.ibd" "$DATADIR/recovery_lab/notes.ibd"
sudo chown mysql:mysql "$DATADIR/recovery_lab/notes.ibd"
sudo chmod 660 "$DATADIR/recovery_lab/notes.ibd"

if [ -f "$BACKUP/notes.cfg" ]; then
    sudo cp "$BACKUP/notes.cfg" "$DATADIR/recovery_lab/notes.cfg"
    sudo chown mysql:mysql "$DATADIR/recovery_lab/notes.cfg"
    sudo chmod 660 "$DATADIR/recovery_lab/notes.cfg"
fi
```

如只剩 `.ibd` 而没有 `.cfg`，MySQL 可以在部分条件下尝试导入，但不会进行同样的元数据核对。尤其不能直接套用到含 `ALGORITHM=INSTANT` 加列或删列历史的表；无法确认原结构和修改历史时，应先查阅官方限制，不要在唯一原件上试错。

## 5. 导入并检查结果

回到恢复库的 MySQL 连接：

```sql
USE recovery_lab;
ALTER TABLE notes IMPORT TABLESPACE;
SHOW WARNINGS;
```

```sql
CHECK TABLE recovery_lab.notes;
SELECT COUNT(*) FROM recovery_lab.notes;
SELECT id, body FROM recovery_lab.notes ORDER BY id LIMIT 10;
```

`CHECK TABLE` 应返回正常状态。还需将行数、主键、抽样记录及业务约束与备份记录核对，不能仅凭 `IMPORT` 没报错或读到一行就认定完整恢复。导入失败时保留日志和原始备份副本，不要反复覆盖它。

确认数据正确后，导出逻辑备份，后续在正常实例中恢复：

```bash
mysqldump -u root -p --single-transaction --no-tablespaces recovery_lab notes > recovered-notes.sql
```

## 演练与验证范围

可在隔离实例中按相同 DDL 创建来源表：先把第 2 步 DDL 的库名替换为 `recovery_source` 执行，再写入两条已知记录并锁定导出。

```sql
INSERT INTO recovery_source.notes (id, body)
VALUES (1, '演练A'), (2, '演练B');
FLUSH TABLES recovery_source.notes FOR EXPORT;
```

保持这个连接，在另一终端把来源数据目录中 `recovery_source/notes.ibd` 和 `notes.cfg` 复制到备份目录；复制完成后，在原连接执行：

```sql
UNLOCK TABLES;
```

再在目标 `recovery_lab` 中按第 2～5 步恢复。预期行数为 `2`，两条记录与来源逐项相同，并能继续插入新记录。

本次维护使用独立的 Windows MySQL 8.0.44 实例，验证了带 `.cfg` 的导入，以及这张没有 INSTANT 列变更历史的普通表不带 `.cfg` 的导入，核对记录、恢复后写入和逻辑导出均通过，实例已停止。Linux 的 `chown`/`chmod` 仅作为对应平台操作说明。磁盘损坏、加密表、分区表及未知结构文件不在这个正常文件演练的验证范围内。

参考：[导入 InnoDB 表](https://dev.mysql.com/doc/refman/8.0/en/innodb-table-import.html)、[移动或复制 InnoDB 表](https://dev.mysql.com/doc/refman/8.0/en/innodb-migration.html)。
