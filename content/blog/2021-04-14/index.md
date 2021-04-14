---
title: "装饰器"
description: "装饰器的几种写法"
lead: ""
date: 2021-04-14T20:33:28+08:00
lastmod: 2021-04-14T20:33:28+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/11e77188fd7d6dd4adf6175e7e7b94ff"
---

### 装饰器

1. ##### 普通装饰器

   ```python
   def logger(func):
       def wrapper(*args, **kwargs):
           func_name = func.__name__
           print(f'执行了 {func_name} 函数')
           func(*args, **kwargs)
           print(f'{func_name} 函数执行完成')

       return wrapper


   @logger
   def add(x, y):
       print(f'{x} + {y} = {x + y}')


   add(1, 2)

   # 执行了 add 函数
   # 1 + 2 = 3
   # add 函数执行完成
   ```



   ```python
   def logger(func):
       def wrapper(*args, **kwargs):
           func_name = func.__name__
           print(f'执行了 {func_name} 函数')
           ret = func(*args, **kwargs)
           print(f'{func_name} 函数执行完成')
           return ret

       return wrapper


   @logger
   def add(x, y):
       print(f'{x} + {y} = {x + y}')
       return x + y


   add_res = add(1, 2)
   print(add_res)

   # 执行了 add 函数
   # 1 + 2 = 3
   # add 函数执行完成
   # 3
   ```

2. ##### `定时执行任务`装饰器

   ```python
   import schedule, functools, time
   from schedule import every, repeat, run_pending


   def run_task():
       """
       定时执行任务
       :return:
       """

       while True:
           schedule.run_pending()
           time.sleep(1)


   def run_every(func):
       @functools.wraps(func)
       def wrapper(*args, **kwargs):
           try:
               run_task()
           except Exception as e:
               print('任务执行出错啦')

       return wrapper


   @run_every
   @repeat(every(1).seconds)
   def test():
       print('hello world')


   test()

   # hello world
   # hello world
   # hello world
   ```


3. ##### 带参数的装饰器

   ```python
   import schedule, functools, time
   from schedule import every, repeat, run_pending


   def run_every(param):
       """
       定时任务装饰器
       :param param:
       :return:
       """

       def decorator(func):
           @functools.wraps(func)
           def wrapper(*args, **kwargs):
               print(f'{param=}')
               func(*args, **kwargs)

           return wrapper

       return decorator


   @run_every('你好')
   def test():
       print('hello world')


   test()

   # param='你好'
   # hello world
   ```

4. ##### 不带参数的类装饰器

   ```python
   class logger(object):

       def __init__(self, func):
           self.func = func

       def __call__(self, *args, **kwargs):
           func_name = self.func.__name__
           print(f'执行了 {func_name} 函数')
           ret = self.func(*args, **kwargs)
           print(f'{func_name} 函数执行完成')
           return ret


   @logger
   def test():
       print('test()')


   ret_print = test()
   print(ret_print)

   # 执行了 test 函数
   # test()
   # test 函数执行完成
   # None
   ```

5. ##### 带参数的类装饰器

   ```python
   class logger(object):
       def __init__(self, level='INFO'):
           self.level = level

       def __call__(self, func):
           def wrapper(*args, **kwargs):

               func_name = func.__name__
               print(f'{self.level} 日志等级')
               print(f'执行了 {func_name} 函数')
               ret = func(*args, **kwargs)
               print(f'{func_name} 函数执行完成')
               return ret

           return wrapper


   @logger(level='DEBUG')
   def test():
       print('test()')


   ret_print = test()
   print(ret_print)

   # DEBUG 日志等级
   # 执行了 test 函数
   # test()
   # test 函数执行完成
   # None
   ```

6. ##### 将装饰器定义为类的一部分

   ```python
   from functools import wraps


   class A:
       # 装饰器作为实例方法
       def decorator1(self, func):
           @wraps(func)
           def wrapper(*args, **kwargs):
               print('Decorator 1')
               return func(*args, **kwargs)

           return wrapper

       # 装饰器作为类方法
       @classmethod
       def decorator2(cls, func):
           @wraps(func)
           def wrapper(*args, **kwargs):
               print('Decorator 2')
               return func(*args, **kwargs)

           return wrapper


   a = A()


   @a.decorator1
   def test1():
       pass


   @A.decorator2
   def test2():
       pass


   test1()
   test2()

   # Decorator 1
   # Decorator 2
   ```

