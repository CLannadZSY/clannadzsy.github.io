---
title: "Python何时执行装饰器"
description: "结合直接运行与导入 decorator.py 的输出，记录 Python 装饰器在函数定义时执行的时机，并区分装饰器执行、函数注册和被装饰函数调用。"
lead: ""
date: 2021-04-29T02:39:20Z
lastmod: 2026-10-22T00:06:41+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/452409391/"
---

运行环境：CPython 3.12.14，只需标准库。将第一个代码块保存为一个空目录中的 `decorator.py`，在该目录执行 `python decorator.py`，即可看到第一组输出。输出里的函数地址每次可能不同，应核对行的顺序和函数名。

1. 执行到函数定义语句时，装饰器会接收刚创建的函数对象，并将返回值绑定到函数名；这通常发生在模块首次导入时。被装饰函数的函数体仍要等到调用才执行。本例装饰器只注册并返回原函数，并未在注册时调用 `f1()` 或 `f2()`，参见[函数定义的官方说明](https://docs.python.org/3.12/reference/compound_stmts.html#function-definitions)。

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

```text
running decorator <function f1 at 0x000002AC46B37550>
running decorator <function f2 at 0x000002AC46B55C10>
running main()
decorators -> [<function f1 at 0x000002AC46B37550>, <function f2 at 0x000002AC46B55C10>]
running f1()
running f2()
running f3()
```

2\. 当 `decorator.py` 被导入，而不是作为脚本运行

下面的代码在同一目录内另存为 `import_demo.py`，用一个新的 Python 进程执行 `python import_demo.py`。不能将它追加到 `decorator.py` 自身，否则脚本会再以模块名加载一遍，混淆这两种运行方式。

```python
import decorator

print(decorator.decorators)
assert [func.__name__ for func in decorator.decorators] == ['f1', 'f2']

# running decorator <function f1 at 0x000001BBC3585C10>
# running decorator <function f2 at 0x000001BBC3586310>
# [<function f1 at 0x000001BBC3585C10>, <function f2 at 0x000001BBC3586310>]
```

导入时会执行注册语句，但 `if __name__ == '__main__'` 不成立，所以不会运行 `main()`。在同一进程中再次普通 `import decorator` 通常会复用 `sys.modules` 中的模块，不会再次执行装饰器；这里用新进程来对照首次导入的输出。
