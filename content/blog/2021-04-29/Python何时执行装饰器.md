---
title: "Python何时执行装饰器"
description: ""
lead: ""
date: 2021-04-29T02:39:20Z
lastmod: 2021-04-29T02:39:20Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/452409391/"
---

1. 装饰器的一个关键特性是, 它们在被装饰函数定义之后立即运行。这通常是在导入时(即Python加载模块时)
```python
# decorator.py

decorators = []


def decorator(func):
    print(f'running decorator {func}')
    decorators.append(func)
    return func


@decorator
def f1():
    print('running f1()')


@decorator
def f2():
    print('running f2()')


def f3():
    print('running f3()')


def main():
    print('running main()')
    print('decorators ->', decorators)
    f1()
    f2()
    f3()


if __name__ == '__main__':
    main()

```

```python
running decorator <function f1 at 0x000002AC46B37550>
running decorator <function f2 at 0x000002AC46B55C10>
running main()
decorators -> [<function f1 at 0x000002AC46B37550>, <function f2 at 0x000002AC46B55C10>]
running f1()
running f2()
running f3()
```


2. 当 `decorator.py` 被导入, 而不是作为脚本运行
```python
import decorator

print(decorator.decorators)

# running decorator <function f1 at 0x000001BBC3585C10>
# running decorator <function f2 at 0x000001BBC3586310>
# [<function f1 at 0x000001BBC3585C10>, <function f2 at 0x000001BBC3586310>]
```