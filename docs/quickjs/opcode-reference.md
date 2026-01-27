# QuickJS 字节码操作码参考

> **文档版本**: 基于 QuickJS 2025-04-26  
> **源码 Commit**: `70e83ae71b637592f2c4ad4171fc9db66782c027`  
> **定义文件**: [quickjs-opcode.h](../../third_party/QuickJS/include/QuickJS/quickjs-opcode.h)

## 概述

QuickJS 定义了 **254 个操作码**，分为两大类：

1. **运行时操作码 (DEF)**: 最终字节码中保留，由 `JS_CallInternal` 执行
2. **临时操作码 (def)**: 仅在编译阶段使用，最终字节码生成前被移除

## 操作码格式说明

每个操作码定义格式：`DEF(id, size, n_pop, n_push, format)`

| 参数 | 说明 |
|------|------|
| `id` | 操作码名称 |
| `size` | 操作码字节长度（包含操作数） |
| `n_pop` | 从栈中弹出的值数量 |
| `n_push` | 压入栈中的值数量 |
| `format` | 操作数格式 |

### 操作数格式 (FMT)

| 格式 | 说明 | 字节数 |
|------|------|--------|
| `none` | 无操作数 | 0 |
| `none_int` | 无操作数（整数优化） | 0 |
| `none_loc` | 无操作数（本地变量优化） | 0 |
| `none_arg` | 无操作数（参数优化） | 0 |
| `none_var_ref` | 无操作数（闭包变量优化） | 0 |
| `u8` | 无符号 8 位整数 | 1 |
| `i8` | 有符号 8 位整数 | 1 |
| `loc8` | 本地变量索引（8位） | 1 |
| `const8` | 常量池索引（8位） | 1 |
| `label8` | 跳转偏移（8位） | 1 |
| `u16` | 无符号 16 位整数 | 2 |
| `i16` | 有符号 16 位整数 | 2 |
| `label16` | 跳转偏移（16位） | 2 |
| `npop` | 参数数量（16位） | 2 |
| `npopx` | 参数数量（优化版） | 0 |
| `npop_u16` | 参数数量 + 16位数据 | 4 |
| `loc` | 本地变量索引（16位） | 2 |
| `arg` | 参数索引（16位） | 2 |
| `var_ref` | 闭包变量索引（16位） | 2 |
| `u32` | 无符号 32 位整数 | 4 |
| `i32` | 有符号 32 位整数 | 4 |
| `const` | 常量池索引（32位） | 4 |
| `label` | 跳转偏移（32位） | 4 |
| `atom` | 原子字符串索引（32位） | 4 |
| `atom_u8` | 原子 + 8位数据 | 5 |
| `atom_u16` | 原子 + 16位数据 | 6 |
| `atom_label_u8` | 原子 + 跳转 + 8位数据 | 9 |
| `atom_label_u16` | 原子 + 跳转 + 16位数据 | 10 |
| `label_u16` | 跳转 + 16位数据 | 6 |

---

## 1. 值压栈操作码

将值压入操作数栈。

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `invalid` | 1 | 0 | 0 | none | 无效操作码，不会生成 |
| `push_i32` | 5 | 0 | 1 | i32 | 压入 32 位有符号整数 |
| `push_const` | 5 | 0 | 1 | const | 从常量池压入值 |
| `fclosure` | 5 | 0 | 1 | const | 创建函数闭包（必须跟在 push_const 后） |
| `push_atom_value` | 5 | 0 | 1 | atom | 压入原子字符串值 |
| `private_symbol` | 5 | 0 | 1 | atom | 压入私有符号 |
| `undefined` | 1 | 0 | 1 | none | 压入 undefined |
| `null` | 1 | 0 | 1 | none | 压入 null |
| `push_this` | 1 | 0 | 1 | none | 压入 this（仅在函数开始使用） |
| `push_false` | 1 | 0 | 1 | none | 压入 false |
| `push_true` | 1 | 0 | 1 | none | 压入 true |
| `object` | 1 | 0 | 1 | none | 创建空对象 `{}` |
| `special_object` | 2 | 0 | 1 | u8 | 创建特殊对象（仅在函数开始） |
| `rest` | 3 | 0 | 1 | u16 | 创建 rest 参数数组（仅在函数开始） |

### 短操作码（优化版）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `push_minus1` | 1 | 0 | 1 | none_int | 压入 -1 |
| `push_0` | 1 | 0 | 1 | none_int | 压入 0 |
| `push_1` | 1 | 0 | 1 | none_int | 压入 1 |
| `push_2` | 1 | 0 | 1 | none_int | 压入 2 |
| `push_3` | 1 | 0 | 1 | none_int | 压入 3 |
| `push_4` | 1 | 0 | 1 | none_int | 压入 4 |
| `push_5` | 1 | 0 | 1 | none_int | 压入 5 |
| `push_6` | 1 | 0 | 1 | none_int | 压入 6 |
| `push_7` | 1 | 0 | 1 | none_int | 压入 7 |
| `push_i8` | 2 | 0 | 1 | i8 | 压入 8 位整数 |
| `push_i16` | 3 | 0 | 1 | i16 | 压入 16 位整数 |
| `push_const8` | 2 | 0 | 1 | const8 | 从常量池压入值（8位索引） |
| `fclosure8` | 2 | 0 | 1 | const8 | 创建函数闭包（8位索引） |
| `push_empty_string` | 1 | 0 | 1 | none | 压入空字符串 `""` |
| `push_bigint_i32` | 5 | 0 | 1 | i32 | 压入 BigInt 值 |

---

## 2. 栈操作码

操作数栈的栈操作。

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `drop` | 1 | 1 | 0 | none | 丢弃栈顶值 `a ->` |
| `nip` | 1 | 2 | 1 | none | 移除次顶值 `a b -> b` |
| `nip1` | 1 | 3 | 2 | none | 移除第三值 `a b c -> b c` |
| `dup` | 1 | 1 | 2 | none | 复制栈顶 `a -> a a` |
| `dup1` | 1 | 2 | 3 | none | 插入复制 `a b -> a a b` |
| `dup2` | 1 | 2 | 4 | none | 复制两个值 `a b -> a b a b` |
| `dup3` | 1 | 3 | 6 | none | 复制三个值 `a b c -> a b c a b c` |
| `insert2` | 1 | 2 | 3 | none | 插入复制 `obj a -> a obj a` |
| `insert3` | 1 | 3 | 4 | none | 插入复制 `obj prop a -> a obj prop a` |
| `insert4` | 1 | 4 | 5 | none | 插入复制 `this obj prop a -> a this obj prop a` |
| `perm3` | 1 | 3 | 3 | none | 重排 `obj a b -> a obj b` |
| `perm4` | 1 | 4 | 4 | none | 重排 `obj prop a b -> a obj prop b` |
| `perm5` | 1 | 5 | 5 | none | 重排 `this obj prop a b -> a this obj prop b` |
| `swap` | 1 | 2 | 2 | none | 交换栈顶两值 `a b -> b a` |
| `swap2` | 1 | 4 | 4 | none | 交换四值 `a b c d -> c d a b` |
| `rot3l` | 1 | 3 | 3 | none | 左旋转 `x a b -> a b x` |
| `rot3r` | 1 | 3 | 3 | none | 右旋转 `a b x -> x a b` |
| `rot4l` | 1 | 4 | 4 | none | 左旋转 `x a b c -> a b c x` |
| `rot5l` | 1 | 5 | 5 | none | 左旋转 `x a b c d -> a b c d x` |

---

## 3. 函数调用与返回

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `call_constructor` | 3 | 2 | 1 | npop | `func new.target args -> ret`（参数不计入 n_pop） |
| `call` | 3 | 1 | 1 | npop | 普通函数调用 |
| `tail_call` | 3 | 1 | 0 | npop | 尾调用优化 |
| `call_method` | 3 | 2 | 1 | npop | 方法调用 |
| `tail_call_method` | 3 | 2 | 0 | npop | 方法尾调用 |
| `array_from` | 3 | 0 | 1 | npop | 从参数创建数组 |
| `apply` | 3 | 3 | 1 | u16 | Function.prototype.apply |
| `return` | 1 | 1 | 0 | none | 返回栈顶值 |
| `return_undef` | 1 | 0 | 0 | none | 返回 undefined |
| `check_ctor_return` | 1 | 1 | 2 | none | 检查构造函数返回值 |
| `check_ctor` | 1 | 0 | 0 | none | 检查是否通过 new 调用 |
| `init_ctor` | 1 | 0 | 1 | none | 初始化构造函数 |
| `check_brand` | 1 | 2 | 2 | none | 检查私有方法品牌 `this_obj func -> this_obj func` |
| `add_brand` | 1 | 2 | 0 | none | 添加私有方法品牌 `this_obj home_obj ->` |
| `return_async` | 1 | 1 | 0 | none | 异步函数返回 |
| `throw` | 1 | 1 | 0 | none | 抛出异常 |
| `throw_error` | 6 | 0 | 0 | atom_u8 | 抛出指定错误 |
| `eval` | 5 | 1 | 1 | npop_u16 | 执行 eval `func args... -> ret_val` |
| `apply_eval` | 3 | 2 | 1 | u16 | 应用 eval `func array -> ret_eval` |
| `regexp` | 1 | 2 | 1 | none | 从 pattern 和 bytecode 创建 RegExp |
| `get_super` | 1 | 1 | 1 | none | 获取 super |
| `import` | 1 | 2 | 1 | none | 动态模块导入 |

### 短操作码（优化版）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `call0` | 1 | 1 | 1 | npopx | 0 参数调用 |
| `call1` | 1 | 1 | 1 | npopx | 1 参数调用 |
| `call2` | 1 | 1 | 1 | npopx | 2 参数调用 |
| `call3` | 1 | 1 | 1 | npopx | 3 参数调用 |

---

## 4. 变量访问

### 4.1 全局变量

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `check_var` | 5 | 0 | 1 | atom | 检查变量是否存在 |
| `get_var_undef` | 5 | 0 | 1 | atom | 获取变量，不存在则返回 undefined |
| `get_var` | 5 | 0 | 1 | atom | 获取变量，不存在则抛出异常 |
| `put_var` | 5 | 1 | 0 | atom | 设置变量值 |
| `put_var_init` | 5 | 1 | 0 | atom | 初始化全局词法变量 |
| `put_var_strict` | 5 | 2 | 0 | atom | 严格模式变量写入 |
| `delete_var` | 5 | 0 | 1 | atom | 删除变量 |
| `define_var` | 6 | 0 | 0 | atom_u8 | 定义变量 |
| `check_define_var` | 6 | 0 | 0 | atom_u8 | 检查是否可定义变量 |
| `define_func` | 6 | 1 | 0 | atom_u8 | 定义函数 |

### 4.2 本地变量

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_loc` | 3 | 0 | 1 | loc | 获取本地变量 |
| `put_loc` | 3 | 1 | 0 | loc | 设置本地变量 |
| `set_loc` | 3 | 1 | 1 | loc | 设置本地变量并保留值 |
| `set_loc_uninitialized` | 3 | 0 | 0 | loc | 标记变量未初始化 |
| `get_loc_check` | 3 | 0 | 1 | loc | 获取并检查 TDZ |
| `put_loc_check` | 3 | 1 | 0 | loc | 设置并检查 TDZ |
| `put_loc_check_init` | 3 | 1 | 0 | loc | 初始化 let/const |
| `get_loc_checkthis` | 3 | 0 | 1 | loc | 获取 this（派生类构造函数） |
| `close_loc` | 3 | 0 | 0 | loc | 关闭本地变量（闭包捕获） |

#### 短操作码（优化版）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_loc8` | 2 | 0 | 1 | loc8 | 获取本地变量（8位索引） |
| `put_loc8` | 2 | 1 | 0 | loc8 | 设置本地变量（8位索引） |
| `set_loc8` | 2 | 1 | 1 | loc8 | 设置并保留（8位索引） |
| `get_loc0` ~ `get_loc3` | 1 | 0 | 1 | none_loc | 获取本地变量 0-3 |
| `put_loc0` ~ `put_loc3` | 1 | 1 | 0 | none_loc | 设置本地变量 0-3 |
| `set_loc0` ~ `set_loc3` | 1 | 1 | 1 | none_loc | 设置并保留变量 0-3 |

### 4.3 函数参数

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_arg` | 3 | 0 | 1 | arg | 获取参数 |
| `put_arg` | 3 | 1 | 0 | arg | 设置参数 |
| `set_arg` | 3 | 1 | 1 | arg | 设置参数并保留值 |

#### 短操作码（优化版）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_arg0` ~ `get_arg3` | 1 | 0 | 1 | none_arg | 获取参数 0-3 |
| `put_arg0` ~ `put_arg3` | 1 | 1 | 0 | none_arg | 设置参数 0-3 |
| `set_arg0` ~ `set_arg3` | 1 | 1 | 1 | none_arg | 设置并保留参数 0-3 |

### 4.4 闭包变量 (var_ref)

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_var_ref` | 3 | 0 | 1 | var_ref | 获取闭包变量 |
| `put_var_ref` | 3 | 1 | 0 | var_ref | 设置闭包变量 |
| `set_var_ref` | 3 | 1 | 1 | var_ref | 设置并保留闭包变量 |
| `get_var_ref_check` | 3 | 0 | 1 | var_ref | 获取并检查 TDZ |
| `put_var_ref_check` | 3 | 1 | 0 | var_ref | 设置并检查 TDZ |
| `put_var_ref_check_init` | 3 | 1 | 0 | var_ref | 初始化闭包变量 |

#### 短操作码（优化版）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_var_ref0` ~ `get_var_ref3` | 1 | 0 | 1 | none_var_ref | 获取闭包变量 0-3 |
| `put_var_ref0` ~ `put_var_ref3` | 1 | 1 | 0 | none_var_ref | 设置闭包变量 0-3 |
| `set_var_ref0` ~ `set_var_ref3` | 1 | 1 | 1 | none_var_ref | 设置并保留闭包变量 0-3 |

### 4.5 引用操作

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_ref_value` | 1 | 2 | 3 | none | 获取引用值 |
| `put_ref_value` | 1 | 3 | 0 | none | 设置引用值 |
| `make_loc_ref` | 7 | 0 | 2 | atom_u16 | 创建本地变量引用 |
| `make_arg_ref` | 7 | 0 | 2 | atom_u16 | 创建参数引用 |
| `make_var_ref_ref` | 7 | 0 | 2 | atom_u16 | 创建闭包变量引用 |
| `make_var_ref` | 5 | 0 | 2 | atom | 创建变量引用 |

---

## 5. 属性访问

### 5.1 点属性访问 (obj.prop)

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_field` | 5 | 1 | 1 | atom | 获取属性 `obj -> value` |
| `get_field2` | 5 | 1 | 2 | atom | 获取属性保留对象 `obj -> obj value` |
| `put_field` | 5 | 2 | 0 | atom | 设置属性 `obj value ->` |
| `get_field_ic` | 5 | 1 | 1 | none | 内联缓存获取属性 |
| `get_field2_ic` | 5 | 1 | 2 | none | 内联缓存获取属性2 |
| `put_field_ic` | 5 | 2 | 0 | none | 内联缓存设置属性 |

### 5.2 索引访问 (obj[prop])

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_array_el` | 1 | 2 | 1 | none | 获取数组元素 `obj prop -> value` |
| `get_array_el2` | 1 | 2 | 2 | none | 获取保留对象 `obj prop -> obj value` |
| `get_array_el3` | 1 | 2 | 3 | none | 获取保留对象和属性 `obj prop -> obj prop1 value` |
| `put_array_el` | 1 | 3 | 0 | none | 设置数组元素 `obj prop value ->` |
| `get_length` | 1 | 1 | 1 | none | 获取 length 属性 |

### 5.3 Super 访问

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_super_value` | 1 | 3 | 1 | none | 获取 super 属性 `this obj prop -> value` |
| `put_super_value` | 1 | 4 | 0 | none | 设置 super 属性 `this obj prop value ->` |

### 5.4 私有字段

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_private_field` | 1 | 2 | 1 | none | 获取私有字段 `obj prop -> value` |
| `put_private_field` | 1 | 3 | 0 | none | 设置私有字段 `obj value prop ->` |
| `define_private_field` | 1 | 3 | 1 | none | 定义私有字段 `obj prop value -> obj` |
| `private_in` | 1 | 2 | 1 | none | 检查私有字段是否存在 |

---

## 6. 对象/类定义

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `define_field` | 5 | 2 | 1 | atom | 定义对象字段 |
| `set_name` | 5 | 1 | 1 | atom | 设置函数名称 |
| `set_name_computed` | 1 | 2 | 2 | none | 设置计算属性名 |
| `set_proto` | 1 | 2 | 1 | none | 设置原型 |
| `set_home_object` | 1 | 2 | 2 | none | 设置 home object（super 用） |
| `define_array_el` | 1 | 3 | 2 | none | 定义数组元素 |
| `append` | 1 | 3 | 2 | none | 追加枚举对象，更新 length |
| `copy_data_properties` | 2 | 3 | 3 | u8 | 复制数据属性（展开操作） |
| `define_method` | 6 | 2 | 1 | atom_u8 | 定义方法 |
| `define_method_computed` | 2 | 3 | 1 | u8 | 定义计算属性方法 |
| `define_class` | 6 | 2 | 2 | atom_u8 | 定义类 `parent ctor -> ctor proto` |
| `define_class_computed` | 6 | 3 | 3 | atom_u8 | 定义计算名称类 |

---

## 7. 控制流

### 7.1 条件跳转

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `if_false` | 5 | 1 | 0 | label | 条件假跳转 |
| `if_true` | 5 | 1 | 0 | label | 条件真跳转 |
| `goto` | 5 | 0 | 0 | label | 无条件跳转 |

#### 短操作码（优化版）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `if_false8` | 2 | 1 | 0 | label8 | 条件假跳转（8位偏移） |
| `if_true8` | 2 | 1 | 0 | label8 | 条件真跳转（8位偏移） |
| `goto8` | 2 | 0 | 0 | label8 | 无条件跳转（8位偏移） |
| `goto16` | 3 | 0 | 0 | label16 | 无条件跳转（16位偏移） |

### 7.2 异常处理

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `catch` | 5 | 0 | 1 | label | 设置异常处理器 |
| `gosub` | 5 | 0 | 0 | label | 跳转执行 finally 块 |
| `ret` | 1 | 1 | 0 | none | 从 finally 块返回 |
| `nip_catch` | 1 | 2 | 1 | none | 移除 catch 标记 `catch ... a -> a` |

---

## 8. 类型转换

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `to_object` | 1 | 1 | 1 | none | 转换为对象 |
| `to_propkey` | 1 | 1 | 1 | none | 转换为属性键 |

---

## 9. with 语句

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `with_get_var` | 10 | 1 | 0 | atom_label_u8 | with 作用域获取变量 |
| `with_put_var` | 10 | 2 | 1 | atom_label_u8 | with 作用域设置变量 |
| `with_delete_var` | 10 | 1 | 0 | atom_label_u8 | with 作用域删除变量 |
| `with_make_ref` | 10 | 1 | 0 | atom_label_u8 | with 作用域创建引用 |
| `with_get_ref` | 10 | 1 | 0 | atom_label_u8 | with 作用域获取引用 |

---

## 10. 迭代器

### 10.1 for-in/for-of

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `for_in_start` | 1 | 1 | 1 | none | 开始 for-in 迭代 |
| `for_of_start` | 1 | 1 | 3 | none | 开始 for-of 迭代 |
| `for_await_of_start` | 1 | 1 | 3 | none | 开始 for-await-of 迭代 |
| `for_in_next` | 1 | 1 | 3 | none | 获取下一个 for-in 值 |
| `for_of_next` | 2 | 3 | 5 | u8 | 获取下一个 for-of 值 |
| `for_await_of_next` | 1 | 3 | 4 | none | 获取下一个 for-await-of 值 |

### 10.2 通用迭代器

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `iterator_check_object` | 1 | 1 | 1 | none | 检查迭代器结果是否为对象 |
| `iterator_get_value_done` | 1 | 2 | 3 | none | 获取 value 和 done |
| `iterator_close` | 1 | 3 | 0 | none | 关闭迭代器 |
| `iterator_next` | 1 | 4 | 4 | none | 调用迭代器 next |
| `iterator_call` | 2 | 4 | 5 | u8 | 调用迭代器方法 |

---

## 11. Generator/Async

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `initial_yield` | 1 | 0 | 0 | none | 生成器初始 yield |
| `yield` | 1 | 1 | 2 | none | yield 表达式 |
| `yield_star` | 1 | 1 | 2 | none | yield* 表达式 |
| `async_yield_star` | 1 | 1 | 2 | none | 异步 yield* |
| `await` | 1 | 1 | 1 | none | await 表达式 |

---

## 12. 算术/逻辑运算

### 12.1 一元运算

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `neg` | 1 | 1 | 1 | none | 取负 `-a` |
| `plus` | 1 | 1 | 1 | none | 转换为数字 `+a` |
| `dec` | 1 | 1 | 1 | none | 递减 `a - 1` |
| `inc` | 1 | 1 | 1 | none | 递增 `a + 1` |
| `post_dec` | 1 | 1 | 2 | none | 后递减 `a--` |
| `post_inc` | 1 | 1 | 2 | none | 后递增 `a++` |
| `not` | 1 | 1 | 1 | none | 按位取反 `~a` |
| `lnot` | 1 | 1 | 1 | none | 逻辑非 `!a` |
| `typeof` | 1 | 1 | 1 | none | typeof 运算符 |
| `delete` | 1 | 2 | 1 | none | delete 运算符 |

#### 本地变量优化

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `dec_loc` | 2 | 0 | 0 | loc8 | 本地变量递减 |
| `inc_loc` | 2 | 0 | 0 | loc8 | 本地变量递增 |
| `add_loc` | 2 | 1 | 0 | loc8 | 本地变量加法 |

### 12.2 二元算术运算

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `mul` | 1 | 2 | 1 | none | 乘法 `a * b` |
| `div` | 1 | 2 | 1 | none | 除法 `a / b` |
| `mod` | 1 | 2 | 1 | none | 取模 `a % b` |
| `add` | 1 | 2 | 1 | none | 加法 `a + b` |
| `sub` | 1 | 2 | 1 | none | 减法 `a - b` |
| `pow` | 1 | 2 | 1 | none | 幂运算 `a ** b` |

### 12.3 位运算

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `shl` | 1 | 2 | 1 | none | 左移 `a << b` |
| `sar` | 1 | 2 | 1 | none | 算术右移 `a >> b` |
| `shr` | 1 | 2 | 1 | none | 逻辑右移 `a >>> b` |
| `and` | 1 | 2 | 1 | none | 按位与 `a & b` |
| `xor` | 1 | 2 | 1 | none | 按位异或 `a ^ b` |
| `or` | 1 | 2 | 1 | none | 按位或 `a \| b` |

### 12.4 比较运算

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `lt` | 1 | 2 | 1 | none | 小于 `a < b` |
| `lte` | 1 | 2 | 1 | none | 小于等于 `a <= b` |
| `gt` | 1 | 2 | 1 | none | 大于 `a > b` |
| `gte` | 1 | 2 | 1 | none | 大于等于 `a >= b` |
| `eq` | 1 | 2 | 1 | none | 相等 `a == b` |
| `neq` | 1 | 2 | 1 | none | 不相等 `a != b` |
| `strict_eq` | 1 | 2 | 1 | none | 严格相等 `a === b` |
| `strict_neq` | 1 | 2 | 1 | none | 严格不相等 `a !== b` |
| `instanceof` | 1 | 2 | 1 | none | instanceof 运算符 |
| `in` | 1 | 2 | 1 | none | in 运算符 |

### 12.5 类型检查（短操作码）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `is_undefined` | 1 | 1 | 1 | none | 检查是否为 undefined |
| `is_null` | 1 | 1 | 1 | none | 检查是否为 null |
| `is_undefined_or_null` | 1 | 1 | 1 | none | 检查是否为 undefined 或 null |
| `typeof_is_undefined` | 1 | 1 | 1 | none | typeof === 'undefined' |
| `typeof_is_function` | 1 | 1 | 1 | none | typeof === 'function' |

---

## 13. 其他

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `nop` | 1 | 0 | 0 | none | 空操作 |
| `debugger` | 1 | 0 | 0 | none | debugger 语句 |

---

## 14. 临时操作码 (def)

> ⚠️ 这些操作码仅在编译阶段使用，不会出现在最终字节码中。

### 14.1 作用域管理（Phase 1 生成，Phase 2 移除）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `enter_scope` | 3 | 0 | 0 | u16 | 进入作用域 |
| `leave_scope` | 3 | 0 | 0 | u16 | 离开作用域 |

### 14.2 作用域变量访问（Phase 1 生成，Phase 2 移除）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `scope_get_var_undef` | 7 | 0 | 1 | atom_u16 | 作用域获取变量（不存在返回 undefined） |
| `scope_get_var` | 7 | 0 | 1 | atom_u16 | 作用域获取变量 |
| `scope_put_var` | 7 | 1 | 0 | atom_u16 | 作用域设置变量 |
| `scope_delete_var` | 7 | 0 | 1 | atom_u16 | 作用域删除变量 |
| `scope_make_ref` | 11 | 0 | 2 | atom_label_u16 | 作用域创建引用 |
| `scope_get_ref` | 7 | 0 | 2 | atom_u16 | 作用域获取引用 |
| `scope_put_var_init` | 7 | 0 | 2 | atom_u16 | 作用域初始化变量 |
| `scope_get_var_checkthis` | 7 | 0 | 1 | atom_u16 | 获取 this（派生类构造函数） |

### 14.3 私有字段作用域（Phase 1 生成，Phase 2 移除）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `scope_get_private_field` | 7 | 1 | 1 | atom_u16 | 获取私有字段 `obj -> value` |
| `scope_get_private_field2` | 7 | 1 | 2 | atom_u16 | 获取私有字段 `obj -> obj value` |
| `scope_put_private_field` | 7 | 2 | 0 | atom_u16 | 设置私有字段 `obj value ->` |
| `scope_in_private_field` | 7 | 1 | 1 | atom_u16 | 检查私有字段 `obj -> res` |

### 14.4 可选链（Phase 1 生成，Phase 2 移除）

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `get_field_opt_chain` | 5 | 1 | 1 | atom | 可选链属性访问 |
| `get_array_el_opt_chain` | 1 | 2 | 1 | none | 可选链索引访问 |

### 14.5 其他临时操作码

| 操作码 | 大小 | 弹出 | 压入 | 格式 | 说明 |
|--------|------|------|------|------|------|
| `label` | 5 | 0 | 0 | label | 标签（Phase 1 生成，Phase 3 移除） |
| `set_class_name` | 5 | 1 | 1 | u32 | 设置类名（Phase 1 生成，Phase 2 移除） |
| `line_num` | 5 | 0 | 0 | u32 | 行号信息（Phase 1 生成，Phase 3 移除） |

---

## 操作码统计

| 类别 | 数量 |
|------|------|
| 运行时操作码 (DEF) | 约 237 个 |
| 临时操作码 (def) | 17 个 |
| 短操作码 (#if SHORT_OPCODES) | 约 70 个 |
| **总计** | **约 254 个** |

---

## 相关文档

- [架构概述](architecture.md) - QuickJS 整体架构
- [操作码分类](opcode-categories.md) - 运行时 vs 临时操作码详细分析
- [宏系统](opcode-macro-system.md) - DEF/def 宏生成机制
