---
title: "List, Tuple, += 问题记录"
date: 2021-04-26T07:15:47Z
lastmod: 2021-04-26T07:15:47Z
draft: false
description: "Python List, Tuple, += 问题记录"
lead: ""
weight: 50
contributors: [clannadzsy]
url: "/blog/2414890336/"
---



#### Building Lists of Lists

```python
test_1 = [['1'] * 3 for i in range(3)]
test_2 = [['1'] * 3] * 3

test_1[1][1] = 0
test_1 = [['1', '1', '1'], ['1', 0, '1'], ['1', '1', '1']]

test_2[1][1] = 0
# 引用了同一对象
test_2 = [['1', 0, '1'], ['1', 0, '1'], ['1', 0, '1']]
```



### Tuple, += 

```python
a = (1, 2, [3, 4])
a[2] += [5, 6]
# TypeError: 'tuple' object does not support item assignment
print(a)
# (1, 2, [3, 4, 5, 6])
# why?
dis.dis('a[2] += [5, 6]')
  1           0 LOAD_NAME                0 (a)
              2 LOAD_CONST               0 (2)
              4 DUP_TOP_TWO
              6 BINARY_SUBSCR
              8 LOAD_CONST               1 (5)
             10 LOAD_CONST               2 (6)
             12 BUILD_LIST               2
             14 INPLACE_ADD
             16 ROT_THREE
             18 STORE_SUBSCR
             20 LOAD_CONST               3 (None)
             22 RETURN_VALUE

a = (1, 2, [3, 4])
a[2].append([5, 6])
# no error
print(a)
# (1, 2, [3, 4, 5, 6])
dis.dis('a[2].append([5, 6])')
  1           0 LOAD_NAME                0 (a)
              2 LOAD_CONST               0 (2)
              4 BINARY_SUBSCR
              6 LOAD_METHOD              1 (append)
              8 LOAD_CONST               1 (5)
             10 LOAD_CONST               2 (6)
             12 BUILD_LIST               2
             14 CALL_METHOD              1
             16 RETURN_VALUE
```

