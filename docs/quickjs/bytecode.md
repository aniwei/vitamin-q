# QuickJS 字节码生成逻辑（ES2020 完整覆盖）

> 本文基于仓库内 third_party/QuickJS 源码与 opcode 定义整理。文档目标：
> 1) 覆盖所有 QuickJS 字节码指令的作用；
> 2) 说明字节码生成全流程（函数级）；
> 3) 为 ES2020 全语法提供“源码→字节码”示例与函数级路径；
> 4) 与 fixtures/es2020 示例一一对应。

## 1. 版本与范围

- QuickJS 来源：third_party/QuickJS，fork 自 bellard/quickjs（见 third_party/QuickJS/README.md）
- 关键源码目录：third_party/QuickJS/src/core
  - 解析/发射：parser.c
  - 运行与字节码执行：function.c
  - 字节码对象与读写：bytecode.cpp
  - Opcode 定义：include/QuickJS/quickjs-opcode.h

## 2. 字节码生成全流程（函数级）

### 2.1 顶层入口
- __JS_EvalInternal()：创建 JSParseState 与 JSFunctionDef，设置解析模式与模块信息，调用 js_parse_program()。
- js_parse_program()：
  - 读取指令流（next_token, js_parse_directives）。
  - 循环解析顶层语句：js_parse_source_element() → js_parse_statement_or_decl()。
  - 生成返回逻辑（emit_return）。

### 2.2 语法解析 → 语义树 → 字节码发射
- 语法入口：
  - js_parse_source_element()
  - js_parse_statement_or_decl()
  - js_parse_statement()
  - js_parse_expr()/js_parse_expr2()
  - js_parse_assign_expr()/js_parse_assign_expr2()
  - js_parse_postfix_expr()
  - js_parse_left_hand_side_expr()
  - js_parse_unary()
  - js_parse_object_literal()
  - js_parse_array_literal()
  - js_parse_class()
  - js_parse_function_decl()/js_parse_function_decl2()
  - js_parse_for_in_of()
  - js_parse_var()

- 字节码发射核心：
  - emit_op(), emit_u8(), emit_u16(), emit_u32()
  - emit_atom(), emit_ic()
  - emit_label(), emit_goto()
  - emit_push_const()
  - emit_return()

### 2.3 解析后处理与优化
- resolve_variables()：
  - 处理临时 scope 指令（OP_enter_scope/OP_leave_scope/OP_scope_*）。
  - 变量解析（resolve_scope_var / resolve_scope_private_field）。
  - 变量初始化与闭包捕获。
- resolve_labels()：
  - 处理跳转与标签重定位（OP_label/OP_goto/OP_if_*）。
  - 短跳转/短指令优化（SHORT_OPCODES）。
- compute_pc2line_info()：生成 pc2line 表（调试映射）。

### 2.4 运行时准备
- js_create_function()：生成 JSFunctionBytecode 与函数对象。
- JS_CallInternal()：执行字节码（function.c 中的 opcode dispatch）。

## 3. 字节码格式与指令类别

### 3.1 指令格式（OP_FMT）
指令由 opcode + 若干操作数构成，格式在 include/QuickJS/quickjs-opcode.h 中定义：
- none / none_int / none_loc / none_arg / none_var_ref
- u8 / i8 / loc8 / const8 / label8
- u16 / i16 / label16 / npop / npopx / npop_u16
- loc / arg / var_ref
- u32 / i32 / const / label
- atom / atom_u8 / atom_u16 / atom_label_u8 / atom_label_u16 / label_u16

### 3.2 指令类别（按语义分组）
- 栈与常量：push_*, dup/swap/rot
- 调用与返回：call/call_method/tail_call/return
- 变量与作用域：get/put/set_loc|arg|var_ref，scope_*，special_object
- 属性访问：get/put_field, get/put_array_el, define_field/method/class
- 控制流：if_true/if_false/goto/catch/gosub/ret
- 迭代器与生成器：for_in/of, iterator_*, yield, await
- 运算与比较：add/sub/mul/div/mod, eq/strict_eq, in/instanceof
- 类型/元信息：typeof, delete, to_object, to_propkey

## 4. Opcode 目录（每条指令作用）

> 说明：栈变化以“pop→push”表示（例如 0→1 表示入栈一个值）。

### 4.1 栈与常量
- OP_push_i32：0→1，压入 32 位整型常量
- OP_push_const：0→1，压入常量池值
- OP_fclosure：0→1，压入闭包函数对象（紧随 push_const）
- OP_push_atom_value：0→1，按 atom 压入值
- OP_private_symbol：0→1，创建私有 symbol
- OP_undefined：0→1，压入 undefined
- OP_null：0→1，压入 null
- OP_push_this：0→1，压入 this（函数开头使用）
- OP_push_false：0→1，压入 false
- OP_push_true：0→1，压入 true
- OP_object：0→1，创建空对象
- OP_special_object：0→1，创建特殊对象（arguments/new.target/home_object 等）
- OP_rest：0→1，构造 rest 参数数组

### 4.2 栈操作
- OP_drop：1→0，丢弃栈顶
- OP_nip：2→1，移除次栈顶
- OP_nip1：3→2，移除第三个
- OP_dup：1→2，复制栈顶
- OP_dup1：2→3，复制次顶
- OP_dup2：2→4，复制双顶
- OP_dup3：3→6，复制三项
- OP_insert2：2→3，插入（dup_x1）
- OP_insert3：3→4，插入（dup_x2）
- OP_insert4：4→5，插入
- OP_perm3：3→3，三项重排
- OP_perm4：4→4，四项重排
- OP_perm5：5→5，五项重排
- OP_swap：2→2，交换栈顶
- OP_swap2：4→4，双交换
- OP_rot3l：3→3，左旋
- OP_rot3r：3→3，右旋
- OP_rot4l：4→4，左旋
- OP_rot5l：5→5，左旋

### 4.3 调用与返回
- OP_call_constructor：调用构造器（含 new.target）
- OP_call：函数调用
- OP_tail_call：尾调用
- OP_call_method：方法调用（含 this）
- OP_tail_call_method：方法尾调用
- OP_array_from：构造数组（展开实参）
- OP_apply：应用调用
- OP_return：返回（有值）
- OP_return_undef：返回（无值）
- OP_check_ctor_return：检查构造器返回值
- OP_check_ctor：检查构造器
- OP_init_ctor：初始化构造器
- OP_check_brand：私有字段品牌检查
- OP_add_brand：添加私有品牌
- OP_return_async：异步返回
- OP_throw：抛出异常
- OP_throw_error：抛出特定错误（带 atom）
- OP_eval：直接 eval
- OP_apply_eval：通过 apply 的 eval
- OP_regexp：创建 RegExp
- OP_get_super：获取 super 基对象
- OP_import：动态 import()

### 4.4 变量与引用
- OP_check_var：检查变量存在
- OP_get_var_undef：变量不存在则 undefined
- OP_get_var：读取变量
- OP_put_var：写变量
- OP_put_var_init：初始化全局 lexical 变量
- OP_put_var_strict：严格模式写
- OP_get_ref_value：读取引用值
- OP_put_ref_value：写引用值
- OP_define_var：定义变量
- OP_check_define_var：检查定义
- OP_define_func：定义函数

### 4.5 属性与对象
- OP_get_field：读取对象属性
- OP_get_field2：读取属性并保留对象
- OP_get_field_ic：读取对象属性（IC 优化）
- OP_get_field2_ic：读取属性并保留对象（IC 优化）
- OP_put_field：写属性
- OP_put_field_ic：写属性（IC 优化）
- OP_get_private_field：读取私有字段
- OP_put_private_field：写私有字段
- OP_define_private_field：定义私有字段
- OP_get_array_el：读取数组下标
- OP_get_array_el2：读取下标并保留对象
- OP_get_array_el3：读取下标并保留 obj/prop
- OP_put_array_el：写数组下标
- OP_get_super_value：读取 super.prop
- OP_put_super_value：写 super.prop
- OP_define_field：定义对象字段
- OP_set_name：设置函数名
- OP_set_name_computed：设置计算属性名
- OP_set_proto：设置对象原型
- OP_set_home_object：设置 home_object
- OP_define_array_el：定义数组元素
- OP_append：追加枚举对象并更新长度
- OP_copy_data_properties：对象扩展拷贝
- OP_define_method：定义方法
- OP_define_method_computed：定义计算名方法
- OP_define_class：定义类
- OP_define_class_computed：定义计算名类

### 4.6 局部/参数/闭包变量
- OP_get_loc / OP_put_loc / OP_set_loc：读/写/设局部
- OP_get_arg / OP_put_arg / OP_set_arg：读/写/设参数
- OP_get_var_ref / OP_put_var_ref / OP_set_var_ref：读/写/设闭包变量
- OP_set_loc_uninitialized：设置 TDZ 未初始化
- OP_get_loc_check：读取前检查 TDZ
- OP_put_loc_check：写前检查 TDZ
- OP_put_loc_check_init：初始化检查
- OP_get_loc_checkthis：派生类构造器 this 检查
- OP_get_var_ref_check / OP_put_var_ref_check / OP_put_var_ref_check_init：闭包变量 TDZ 检查
- OP_close_loc：关闭局部（闭包捕获）

### 4.7 控制流与异常
- OP_if_false / OP_if_true：条件跳转
- OP_goto：无条件跳转
- OP_catch：catch 入口
- OP_gosub：finally 子程序
- OP_ret：finally 返回
- OP_nip_catch：配合 finally 的栈修整

### 4.8 类型与转换
- OP_to_object：转对象
- OP_to_propkey：转属性键

### 4.9 with 作用域
- OP_with_get_var / OP_with_put_var / OP_with_delete_var
- OP_with_make_ref / OP_with_get_ref

### 4.10 引用构造
- OP_make_loc_ref / OP_make_arg_ref / OP_make_var_ref_ref / OP_make_var_ref

### 4.11 迭代器与生成器
- OP_for_in_start / OP_for_of_start / OP_for_await_of_start
- OP_for_in_next / OP_for_of_next / OP_for_await_of_next
- OP_iterator_check_object / OP_iterator_get_value_done / OP_iterator_close
- OP_iterator_next / OP_iterator_call
- OP_initial_yield / OP_yield / OP_yield_star / OP_async_yield_star
- OP_await

### 4.12 运算与比较
- OP_neg / OP_plus / OP_dec / OP_inc / OP_post_dec / OP_post_inc
- OP_dec_loc / OP_inc_loc / OP_add_loc
- OP_not / OP_lnot / OP_typeof / OP_delete / OP_delete_var
- OP_mul / OP_div / OP_mod / OP_add / OP_sub / OP_pow
- OP_shl / OP_sar / OP_shr
- OP_lt / OP_lte / OP_gt / OP_gte
- OP_instanceof / OP_in
- OP_eq / OP_neq / OP_strict_eq / OP_strict_neq
- OP_and / OP_xor / OP_or
- OP_is_undefined_or_null / OP_private_in
- OP_push_bigint_i32
- OP_nop

### 4.15 调试
- OP_debugger：调试断点

### 4.16 Opcode 栈效果表（来自 quickjs-opcode.h）

| opcode | size | n_pop | n_push | fmt |
|---|---:|---:|---:|---|
| invalid | 1 | 0 | 0 | none |
| push_i32 | 5 | 0 | 1 | i32 |
| push_const | 5 | 0 | 1 | const |
| fclosure | 5 | 0 | 1 | const |
| push_atom_value | 5 | 0 | 1 | atom |
| private_symbol | 5 | 0 | 1 | atom |
| undefined | 1 | 0 | 1 | none |
| null | 1 | 0 | 1 | none |
| push_this | 1 | 0 | 1 | none |
| push_false | 1 | 0 | 1 | none |
| push_true | 1 | 0 | 1 | none |
| object | 1 | 0 | 1 | none |
| special_object | 2 | 0 | 1 | u8 |
| rest | 3 | 0 | 1 | u16 |
| drop | 1 | 1 | 0 | none |
| nip | 1 | 2 | 1 | none |
| nip1 | 1 | 3 | 2 | none |
| dup | 1 | 1 | 2 | none |
| dup1 | 1 | 2 | 3 | none |
| dup2 | 1 | 2 | 4 | none |
| dup3 | 1 | 3 | 6 | none |
| insert2 | 1 | 2 | 3 | none |
| insert3 | 1 | 3 | 4 | none |
| insert4 | 1 | 4 | 5 | none |
| perm3 | 1 | 3 | 3 | none |
| perm4 | 1 | 4 | 4 | none |
| perm5 | 1 | 5 | 5 | none |
| swap | 1 | 2 | 2 | none |
| swap2 | 1 | 4 | 4 | none |
| rot3l | 1 | 3 | 3 | none |
| rot3r | 1 | 3 | 3 | none |
| rot4l | 1 | 4 | 4 | none |
| rot5l | 1 | 5 | 5 | none |
| call_constructor | 3 | 2 | 1 | npop |
| call | 3 | 1 | 1 | npop |
| tail_call | 3 | 1 | 0 | npop |
| call_method | 3 | 2 | 1 | npop |
| tail_call_method | 3 | 2 | 0 | npop |
| array_from | 3 | 0 | 1 | npop |
| apply | 3 | 3 | 1 | u16 |
| return | 1 | 1 | 0 | none |
| return_undef | 1 | 0 | 0 | none |
| check_ctor_return | 1 | 1 | 2 | none |
| check_ctor | 1 | 0 | 0 | none |
| init_ctor | 1 | 0 | 1 | none |
| check_brand | 1 | 2 | 2 | none |
| add_brand | 1 | 2 | 0 | none |
| return_async | 1 | 1 | 0 | none |
| throw | 1 | 1 | 0 | none |
| throw_error | 6 | 0 | 0 | atom_u8 |
| eval | 5 | 1 | 1 | npop_u16 |
| apply_eval | 3 | 2 | 1 | u16 |
| regexp | 1 | 2 | 1 | none |
| get_super | 1 | 1 | 1 | none |
| import | 1 | 2 | 1 | none |
| check_var | 5 | 0 | 1 | atom |
| get_var_undef | 5 | 0 | 1 | atom |
| get_var | 5 | 0 | 1 | atom |
| put_var | 5 | 1 | 0 | atom |
| put_var_init | 5 | 1 | 0 | atom |
| put_var_strict | 5 | 2 | 0 | atom |
| get_ref_value | 1 | 2 | 3 | none |
| put_ref_value | 1 | 3 | 0 | none |
| define_var | 6 | 0 | 0 | atom_u8 |
| check_define_var | 6 | 0 | 0 | atom_u8 |
| define_func | 6 | 1 | 0 | atom_u8 |
| get_field | 5 | 1 | 1 | atom |
| get_field2 | 5 | 1 | 2 | atom |
| put_field | 5 | 2 | 0 | atom |
| get_private_field | 1 | 2 | 1 | none |
| put_private_field | 1 | 3 | 0 | none |
| define_private_field | 1 | 3 | 1 | none |
| get_array_el | 1 | 2 | 1 | none |
| get_array_el2 | 1 | 2 | 2 | none |
| get_array_el3 | 1 | 2 | 3 | none |
| put_array_el | 1 | 3 | 0 | none |
| get_super_value | 1 | 3 | 1 | none |
| put_super_value | 1 | 4 | 0 | none |
| define_field | 5 | 2 | 1 | atom |
| set_name | 5 | 1 | 1 | atom |
| set_name_computed | 1 | 2 | 2 | none |
| set_proto | 1 | 2 | 1 | none |
| set_home_object | 1 | 2 | 2 | none |
| define_array_el | 1 | 3 | 2 | none |
| append | 1 | 3 | 2 | none |
| copy_data_properties | 2 | 3 | 3 | u8 |
| define_method | 6 | 2 | 1 | atom_u8 |
| define_method_computed | 2 | 3 | 1 | u8 |
| define_class | 6 | 2 | 2 | atom_u8 |
| define_class_computed | 6 | 3 | 3 | atom_u8 |
| get_loc | 3 | 0 | 1 | loc |
| put_loc | 3 | 1 | 0 | loc |
| set_loc | 3 | 1 | 1 | loc |
| get_arg | 3 | 0 | 1 | arg |
| put_arg | 3 | 1 | 0 | arg |
| set_arg | 3 | 1 | 1 | arg |
| get_var_ref | 3 | 0 | 1 | var_ref |
| put_var_ref | 3 | 1 | 0 | var_ref |
| set_var_ref | 3 | 1 | 1 | var_ref |
| set_loc_uninitialized | 3 | 0 | 0 | loc |
| get_loc_check | 3 | 0 | 1 | loc |
| put_loc_check | 3 | 1 | 0 | loc |
| put_loc_check_init | 3 | 1 | 0 | loc |
| get_loc_checkthis | 3 | 0 | 1 | loc |
| get_var_ref_check | 3 | 0 | 1 | var_ref |
| put_var_ref_check | 3 | 1 | 0 | var_ref |
| put_var_ref_check_init | 3 | 1 | 0 | var_ref |
| close_loc | 3 | 0 | 0 | loc |
| if_false | 5 | 1 | 0 | label |
| if_true | 5 | 1 | 0 | label |
| goto | 5 | 0 | 0 | label |
| catch | 5 | 0 | 1 | label |
| gosub | 5 | 0 | 0 | label |
| ret | 1 | 1 | 0 | none |
| nip_catch | 1 | 2 | 1 | none |
| to_object | 1 | 1 | 1 | none |
| to_propkey | 1 | 1 | 1 | none |
| with_get_var | 10 | 1 | 0 | atom_label_u8 |
| with_put_var | 10 | 2 | 1 | atom_label_u8 |
| with_delete_var | 10 | 1 | 0 | atom_label_u8 |
| with_make_ref | 10 | 1 | 0 | atom_label_u8 |
| with_get_ref | 10 | 1 | 0 | atom_label_u8 |
| make_loc_ref | 7 | 0 | 2 | atom_u16 |
| make_arg_ref | 7 | 0 | 2 | atom_u16 |
| make_var_ref_ref | 7 | 0 | 2 | atom_u16 |
| make_var_ref | 5 | 0 | 2 | atom |
| for_in_start | 1 | 1 | 1 | none |
| for_of_start | 1 | 1 | 3 | none |
| for_await_of_start | 1 | 1 | 3 | none |
| for_in_next | 1 | 1 | 3 | none |
| for_of_next | 2 | 3 | 5 | u8 |
| for_await_of_next | 1 | 3 | 4 | none |
| iterator_check_object | 1 | 1 | 1 | none |
| iterator_get_value_done | 1 | 2 | 3 | none |
| iterator_close | 1 | 3 | 0 | none |
| iterator_next | 1 | 4 | 4 | none |
| iterator_call | 2 | 4 | 5 | u8 |
| initial_yield | 1 | 0 | 0 | none |
| yield | 1 | 1 | 2 | none |
| yield_star | 1 | 1 | 2 | none |
| async_yield_star | 1 | 1 | 2 | none |
| await | 1 | 1 | 1 | none |
| neg | 1 | 1 | 1 | none |
| plus | 1 | 1 | 1 | none |
| dec | 1 | 1 | 1 | none |
| inc | 1 | 1 | 1 | none |
| post_dec | 1 | 1 | 2 | none |
| post_inc | 1 | 1 | 2 | none |
| dec_loc | 2 | 0 | 0 | loc8 |
| inc_loc | 2 | 0 | 0 | loc8 |
| add_loc | 2 | 1 | 0 | loc8 |
| not | 1 | 1 | 1 | none |
| lnot | 1 | 1 | 1 | none |
| typeof | 1 | 1 | 1 | none |
| delete | 1 | 2 | 1 | none |
| delete_var | 5 | 0 | 1 | atom |
| mul | 1 | 2 | 1 | none |
| div | 1 | 2 | 1 | none |
| mod | 1 | 2 | 1 | none |
| add | 1 | 2 | 1 | none |
| sub | 1 | 2 | 1 | none |
| pow | 1 | 2 | 1 | none |
| shl | 1 | 2 | 1 | none |
| sar | 1 | 2 | 1 | none |
| shr | 1 | 2 | 1 | none |
| lt | 1 | 2 | 1 | none |
| lte | 1 | 2 | 1 | none |
| gt | 1 | 2 | 1 | none |
| gte | 1 | 2 | 1 | none |
| instanceof | 1 | 2 | 1 | none |
| in | 1 | 2 | 1 | none |
| eq | 1 | 2 | 1 | none |
| neq | 1 | 2 | 1 | none |
| strict_eq | 1 | 2 | 1 | none |
| strict_neq | 1 | 2 | 1 | none |
| and | 1 | 2 | 1 | none |
| xor | 1 | 2 | 1 | none |
| or | 1 | 2 | 1 | none |
| is_undefined_or_null | 1 | 1 | 1 | none |
| private_in | 1 | 2 | 1 | none |
| push_bigint_i32 | 5 | 0 | 1 | i32 |
| nop | 1 | 0 | 0 | none |
| push_minus1 | 1 | 0 | 1 | none_int |
| push_0 | 1 | 0 | 1 | none_int |
| push_1 | 1 | 0 | 1 | none_int |
| push_2 | 1 | 0 | 1 | none_int |
| push_3 | 1 | 0 | 1 | none_int |
| push_4 | 1 | 0 | 1 | none_int |
| push_5 | 1 | 0 | 1 | none_int |
| push_6 | 1 | 0 | 1 | none_int |
| push_7 | 1 | 0 | 1 | none_int |
| push_i8 | 2 | 0 | 1 | i8 |
| push_i16 | 3 | 0 | 1 | i16 |
| push_const8 | 2 | 0 | 1 | const8 |
| fclosure8 | 2 | 0 | 1 | const8 |
| push_empty_string | 1 | 0 | 1 | none |
| get_loc8 | 2 | 0 | 1 | loc8 |
| put_loc8 | 2 | 1 | 0 | loc8 |
| set_loc8 | 2 | 1 | 1 | loc8 |
| get_loc0 | 1 | 0 | 1 | none_loc |
| get_loc1 | 1 | 0 | 1 | none_loc |
| get_loc2 | 1 | 0 | 1 | none_loc |
| get_loc3 | 1 | 0 | 1 | none_loc |
| put_loc0 | 1 | 1 | 0 | none_loc |
| put_loc1 | 1 | 1 | 0 | none_loc |
| put_loc2 | 1 | 1 | 0 | none_loc |
| put_loc3 | 1 | 1 | 0 | none_loc |
| set_loc0 | 1 | 1 | 1 | none_loc |
| set_loc1 | 1 | 1 | 1 | none_loc |
| set_loc2 | 1 | 1 | 1 | none_loc |
| set_loc3 | 1 | 1 | 1 | none_loc |
| get_arg0 | 1 | 0 | 1 | none_arg |
| get_arg1 | 1 | 0 | 1 | none_arg |
| get_arg2 | 1 | 0 | 1 | none_arg |
| get_arg3 | 1 | 0 | 1 | none_arg |
| put_arg0 | 1 | 1 | 0 | none_arg |
| put_arg1 | 1 | 1 | 0 | none_arg |
| put_arg2 | 1 | 1 | 0 | none_arg |
| put_arg3 | 1 | 1 | 0 | none_arg |
| set_arg0 | 1 | 1 | 1 | none_arg |
| set_arg1 | 1 | 1 | 1 | none_arg |
| set_arg2 | 1 | 1 | 1 | none_arg |
| set_arg3 | 1 | 1 | 1 | none_arg |
| get_var_ref0 | 1 | 0 | 1 | none_var_ref |
| get_var_ref1 | 1 | 0 | 1 | none_var_ref |
| get_var_ref2 | 1 | 0 | 1 | none_var_ref |
| get_var_ref3 | 1 | 0 | 1 | none_var_ref |
| put_var_ref0 | 1 | 1 | 0 | none_var_ref |
| put_var_ref1 | 1 | 1 | 0 | none_var_ref |
| put_var_ref2 | 1 | 1 | 0 | none_var_ref |
| put_var_ref3 | 1 | 1 | 0 | none_var_ref |
| set_var_ref0 | 1 | 1 | 1 | none_var_ref |
| set_var_ref1 | 1 | 1 | 1 | none_var_ref |
| set_var_ref2 | 1 | 1 | 1 | none_var_ref |
| set_var_ref3 | 1 | 1 | 1 | none_var_ref |
| get_length | 1 | 1 | 1 | none |
| if_false8 | 2 | 1 | 0 | label8 |
| if_true8 | 2 | 1 | 0 | label8 |
| goto8 | 2 | 0 | 0 | label8 |
| goto16 | 3 | 0 | 0 | label16 |
| call0 | 1 | 1 | 1 | npopx |
| call1 | 1 | 1 | 1 | npopx |
| call2 | 1 | 1 | 1 | npopx |
| call3 | 1 | 1 | 1 | npopx |
| is_undefined | 1 | 1 | 1 | none |
| is_null | 1 | 1 | 1 | none |
| typeof_is_undefined | 1 | 1 | 1 | none |
| typeof_is_function | 1 | 1 | 1 | none |
| get_field_ic | 5 | 1 | 1 | none |
| get_field2_ic | 5 | 1 | 2 | none |
| put_field_ic | 5 | 2 | 0 | none |
| debugger | 1 | 0 | 0 | none |

### 4.13 临时与优化指令（解析期/优化期）
- OP_enter_scope / OP_leave_scope：作用域进入/退出（解析阶段，后续消解）
- OP_label：解析阶段标签
- OP_scope_*：作用域变量访问临时指令（resolve_variables 时转译）
- OP_get_field_opt_chain / OP_get_array_el_opt_chain：可选链临时指令
- OP_set_class_name：类名补丁指令
- OP_line_num：行号信息

### 4.14 SHORT_OPCODES（短指令）
- push_minus1/push_0..push_7/push_i8/push_i16/push_const8/fclosure8/push_empty_string
- get_loc8/put_loc8/set_loc8，get_loc0..3/put_loc0..3/set_loc0..3
- get_arg0..3/put_arg0..3/set_arg0..3
- get_var_ref0..3/put_var_ref0..3/set_var_ref0..3
- get_length
- if_false8/if_true8/goto8/goto16
- call0..3
- is_undefined/is_null/typeof_is_undefined/typeof_is_function

## 5. ES2020 全语法字节码生成流程（函数级 + 示例）

> 说明：以下示例与 fixtures/es2020 对齐；列出的字节码为“典型序列”。

### 5.1 字面量与主表达式
- 数字/字符串/布尔/null/undefined
  - 解析：js_parse_postfix_expr() → js_parse_expr()
  - 发射：emit_op(OP_push_i32/OP_push_const/OP_push_true/OP_push_false/OP_null/OP_undefined)
  - 示例：`const x = 1;`
  - 字节码：push_i32 → scope_put_var_init

- BigInt
  - 解析：js_parse_postfix_expr()
  - 发射：emit_op(OP_push_bigint_i32)
  - 示例：`const n = 1n;`
  - 字节码：push_bigint_i32 → scope_put_var_init

- this / super / new.target
  - 解析：js_parse_postfix_expr()
  - 发射：OP_scope_get_var(JS_ATOM_this) / OP_get_super / OP_special_object(new_target)

- import.meta / import()
  - 解析：js_parse_postfix_expr()
  - 发射：OP_special_object(OP_SPECIAL_OBJECT_IMPORT_META) / OP_import

### 5.2 对象与数组字面量
- Object literal
  - 解析：js_parse_object_literal()
  - 发射：OP_object、OP_define_field、OP_define_method、OP_define_method_computed、OP_copy_data_properties、OP_set_proto
  - 示例：`const o = {a:1, b(){}, ['c']:2, ...x};`
  - 字节码：object → define_field → define_method → to_propkey → define_method_computed → copy_data_properties

- Array literal
  - 解析：js_parse_array_literal()
  - 发射：OP_array_from、OP_define_array_el、OP_define_field、OP_append
  - 示例：`const a = [1, ...xs, 3];`
  - 字节码：push_i32 → array_from → define_array_el/append

### 5.3 模板字符串与正则
- Template literal / Tagged template
  - 解析：js_parse_template()
  - 发射：OP_push_const（模板对象）→ OP_get_field2(concat)/OP_call_method

- RegExp literal
  - 解析：js_parse_regexp()
  - 发射：OP_regexp

### 5.4 变量声明与作用域
- var/let/const
  - 解析：js_parse_var()
  - 发射：OP_scope_put_var / OP_scope_put_var_init / OP_set_loc_uninitialized
  - 示例：`let x = 1;`
  - 字节码：push_i32 → scope_put_var_init

- 解构声明与默认值
  - 解析：js_parse_destructuring_element()
  - 发射：OP_get_array_el/OP_get_field/OP_put_loc/OP_put_var_ref

### 5.5 赋值表达式与运算
- 赋值/复合赋值
  - 解析：js_parse_assign_expr2()
  - 发射：OP_put_* / OP_get_ref_value / OP_put_ref_value

- 一元/二元/位运算
  - 解析：js_parse_unary(), js_parse_expr2()
  - 发射：OP_neg/OP_not/OP_lnot/OP_add/OP_sub/OP_and/OP_or 等

- 逻辑/条件/逗号
  - 解析：js_parse_expr2()
  - 发射：OP_if_true/OP_if_false + OP_goto

- 可选链/空值合并
  - 解析：js_parse_postfix_expr() / js_parse_expr2()
  - 发射（临时）：OP_get_field_opt_chain / OP_get_array_el_opt_chain
  - 消解：resolve_variables() → OP_get_field / OP_get_array_el

### 5.6 函数与箭头函数
- Function decl/expr
  - 解析：js_parse_function_decl2()
  - 发射：OP_fclosure + OP_define_func / OP_scope_put_var_init

- Arrow function
  - 解析：js_parse_function_decl2()
  - 发射：OP_fclosure + OP_set_name

- 参数（默认值/rest）
  - 解析：js_parse_function_decl2()
  - 发射：OP_rest + 参数初始化相关 OP_put_loc/OP_get_loc_check

### 5.7 生成器与异步
- Generator / Yield / Yield*
  - 解析：js_parse_function_decl2(), js_parse_statement_or_decl()
  - 发射：OP_initial_yield / OP_yield / OP_yield_star

- Async / Await / Async Generator
  - 解析：js_parse_function_decl2()
  - 发射：OP_await / OP_return_async / OP_async_yield_star

### 5.8 类与继承
- Class / extends / super()
  - 解析：js_parse_class()
  - 发射：OP_define_class / OP_define_class_computed / OP_get_super / OP_call_constructor
  - 过程函数：emit_class_init_start(), emit_class_init_end(), emit_class_field_init()

- 方法 / Getter / Setter / Static
  - 发射：OP_define_method / OP_define_method_computed + OP_set_home_object

### 5.9 控制流语句
- if/else
  - 解析：js_parse_statement_or_decl()
  - 发射：OP_if_false / OP_goto + OP_label

- while / do-while / for
  - 解析：js_parse_statement_or_decl()
  - 发射：OP_if_false / OP_goto / OP_label

- for-in / for-of / for-await-of
  - 解析：js_parse_for_in_of()
  - 发射：OP_for_in_start/OP_for_of_start/OP_for_await_of_start + OP_for_*_next

- switch
  - 解析：js_parse_statement_or_decl()
  - 发射：OP_strict_eq / OP_if_false / OP_label

- try/catch/finally
  - 解析：js_parse_statement_or_decl()
  - 发射：OP_catch / OP_gosub / OP_ret / OP_nip_catch

- break/continue/label
  - 解析：emit_break()
  - 发射：OP_goto + OP_label

- throw/return
  - 解析：js_parse_statement_or_decl(), emit_return()
  - 发射：OP_throw / OP_return / OP_return_undef / OP_return_async

- with/debugger
  - 解析：js_parse_statement_or_decl()
  - 发射：OP_with_* / OP_debugger

### 5.10 模块语法
- import/export
  - 解析：js_parse_source_element()
  - 发射：OP_define_var / OP_define_func + export entry

### 5.11 语法覆盖矩阵（ES2020）

> 每条语法给出“示例 + 函数级路径 + 典型 opcode”。示例均可在 fixtures/es2020 中找到同类用例。

#### 5.11.1 标识符与基础字面量
- 示例：`x; null; true; 1; 1n; 's';`
- 路径：js_parse_postfix_expr() → js_parse_expr()
- 典型 opcode：OP_scope_get_var / OP_push_i32 / OP_push_bigint_i32 / OP_null / OP_push_true / OP_push_const

#### 5.11.2 this / super / new.target / import.meta
- 示例：`this; super.prop; new.target; import.meta;`
- 路径：js_parse_postfix_expr()
- 典型 opcode：OP_scope_get_var(JS_ATOM_this) / OP_get_super / OP_special_object(OP_SPECIAL_OBJECT_NEW_TARGET|OP_SPECIAL_OBJECT_IMPORT_META)

#### 5.11.3 成员访问与调用
- 示例：`obj.a; obj['a']; obj.m(); new C();`
- 路径：js_parse_postfix_expr() / js_parse_left_hand_side_expr()
- 典型 opcode：OP_get_field / OP_get_array_el / OP_call_method / OP_call_constructor

#### 5.11.4 可选链
- 示例：`obj?.a?.b?.(); obj?.[i];`
- 路径：js_parse_postfix_expr()
- 典型 opcode：OP_get_field_opt_chain / OP_get_array_el_opt_chain → resolve_variables() → OP_get_field/OP_get_array_el

#### 5.11.5 空值合并
- 示例：`a ?? b`
- 路径：js_parse_expr2()
- 典型 opcode：OP_dup → OP_is_undefined_or_null → OP_if_true/OP_goto

#### 5.11.6 对象字面量与扩展
- 示例：`{a:1, b(){}, ['c']:2, ...o}`
- 路径：js_parse_object_literal()
- 典型 opcode：OP_object → OP_define_field → OP_define_method/OP_define_method_computed → OP_copy_data_properties

#### 5.11.7 数组字面量与扩展
- 示例：`[1, ...arr, 3]`
- 路径：js_parse_array_literal()
- 典型 opcode：OP_array_from / OP_define_array_el / OP_append

#### 5.11.8 模板字符串
- 示例：`` `a${b}` `` / `String.raw\`x\``
- 路径：js_parse_template()
- 典型 opcode：OP_push_const → OP_get_field2(concat) → OP_call_method

#### 5.11.9 RegExp 字面量
- 示例：`/a+b?/g`
- 路径：js_parse_regexp()
- 典型 opcode：OP_regexp

#### 5.11.10 一元/更新表达式
- 示例：`-a; !a; ~a; typeof a; delete obj.a; ++i; i--;`
- 路径：js_parse_unary(), js_parse_postfix_expr()
- 典型 opcode：OP_neg/OP_lnot/OP_not/OP_typeof/OP_delete/OP_inc/OP_post_dec

#### 5.11.11 二元/位运算/关系/相等
- 示例：`a+b; a<<b; a<b; a===b; a in obj; a instanceof C;`
- 路径：js_parse_expr2()
- 典型 opcode：OP_add/OP_shl/OP_lt/OP_strict_eq/OP_in/OP_instanceof

#### 5.11.12 逻辑与条件
- 示例：`a && b; a || b; a ? b : c; (a, b)`
- 路径：js_parse_expr2()
- 典型 opcode：OP_if_false/OP_if_true/OP_goto + OP_drop

#### 5.11.13 赋值与解构赋值
- 示例：`x = y; ({a}=obj); [x,y]=arr;`
- 路径：js_parse_assign_expr2() / js_parse_destructuring_element()
- 典型 opcode：OP_put_loc/OP_put_var_ref/OP_get_array_el/OP_get_field

#### 5.11.14 变量声明
- 示例：`var a; let b=1; const c=2;`
- 路径：js_parse_var()
- 典型 opcode：OP_scope_put_var / OP_scope_put_var_init / OP_set_loc_uninitialized

#### 5.11.15 函数声明/表达式/箭头
- 示例：`function f(){}` / `const g = () => 1;`
- 路径：js_parse_function_decl2()
- 典型 opcode：OP_fclosure + OP_define_func / OP_scope_put_var_init + OP_set_name

#### 5.11.16 参数（默认/剩余/解构）
- 示例：`function f(a=1, ...rest){}` / `function f([a], {b}){}`
- 路径：js_parse_function_decl2()
- 典型 opcode：OP_rest + OP_put_loc + OP_get_loc_check

#### 5.11.17 生成器与 yield
- 示例：`function* g(){ yield 1; yield* [2]; }`
- 路径：js_parse_function_decl2()
- 典型 opcode：OP_initial_yield / OP_yield / OP_yield_star

#### 5.11.18 异步与 await
- 示例：`async function f(){ await p; }` / `async function* g(){ yield 1; }`
- 路径：js_parse_function_decl2(), emit_return()
- 典型 opcode：OP_await / OP_return_async / OP_async_yield_star

#### 5.11.19 类/继承/方法
- 示例：`class D extends B { constructor(){ super(); } m(){} }`
- 路径：js_parse_class() + emit_class_init_start/end()
- 典型 opcode：OP_define_class/OP_define_method + OP_get_super/OP_call_constructor + OP_set_home_object

#### 5.11.20 块与作用域
- 示例：`{ let x = 1; }`
- 路径：js_parse_block()
- 典型 opcode：OP_enter_scope / OP_leave_scope（解析期）→ resolve_variables()

#### 5.11.21 if/else
- 示例：`if (a) b(); else c();`
- 路径：js_parse_statement_or_decl()
- 典型 opcode：OP_if_false / OP_goto / OP_label

#### 5.11.22 while / do-while / for
- 示例：`while(a){}; do{}while(a); for(;;){}`
- 路径：js_parse_statement_or_decl()
- 典型 opcode：OP_label / OP_if_false / OP_goto

#### 5.11.23 for-in / for-of / for-await-of
- 示例：`for (const k in o) {}` / `for (const v of a) {}` / `for await (const v of it) {}`
- 路径：js_parse_for_in_of()
- 典型 opcode：OP_for_in_start / OP_for_of_start / OP_for_await_of_start + OP_for_*_next + OP_iterator_close

#### 5.11.24 switch
- 示例：`switch(x){case 1: break; default:}`
- 路径：js_parse_statement_or_decl()
- 典型 opcode：OP_strict_eq / OP_if_false / OP_label

#### 5.11.25 try/catch/finally
- 示例：`try{}catch(e){}finally{}`
- 路径：js_parse_statement_or_decl(), emit_return()
- 典型 opcode：OP_catch / OP_gosub / OP_ret / OP_nip_catch

#### 5.11.26 throw/return
- 示例：`throw e; return x;`
- 路径：js_parse_statement_or_decl(), emit_return()
- 典型 opcode：OP_throw / OP_return / OP_return_undef

#### 5.11.27 break/continue/label
- 示例：`label: for(;;){break label;}`
- 路径：emit_break()
- 典型 opcode：OP_goto / OP_label

#### 5.11.28 with / debugger
- 示例：`with(obj){ a=1 } debugger;`
- 路径：js_parse_statement_or_decl()
- 典型 opcode：OP_with_* / OP_debugger

#### 5.11.29 模块语法
- 示例：`export const a=1; import x from 'm'; import.meta; import('m');`
- 路径：js_parse_source_element()
- 典型 opcode：OP_define_var / OP_define_func / OP_special_object(OP_SPECIAL_OBJECT_IMPORT_META) / OP_import

## 6. ES2020 fixtures 覆盖说明

fixtures/es2020 目录提供 ES2020 全语法覆盖的最小示例：
- expressions：字面量、运算、可选链、空值合并、模板等
- statements：控制流、异常、with/debugger
- functions/async/generators：函数、async、生成器
- classes：class/extends/super
- modules：import/export/import.meta/dynamic import
- patterns：解构与默认值

详见 fixtures/es2020 下各文件。

### 6.1 ES2020 语法覆盖清单（示例文件）
- 字面量：fixtures/es2020/expressions/literals.ts
- 运算/赋值：fixtures/es2020/expressions/operators.ts
- 成员访问：fixtures/es2020/expressions/member-access.ts
- 调用/构造：fixtures/es2020/expressions/misc.ts
- 可选链：fixtures/es2020/expressions/optional-chaining.ts
- 空值合并：fixtures/es2020/expressions/nullish-coalescing.ts
- 模板字符串：fixtures/es2020/expressions/template.ts
- 正则：fixtures/es2020/expressions/regexp.ts
- 展开/剩余：fixtures/es2020/expressions/spread.ts
- 解构/默认值：fixtures/es2020/patterns/destructuring.ts
- 控制流：fixtures/es2020/statements/control-flow.ts
- 异常：fixtures/es2020/statements/try-catch-finally.ts
- 函数/箭头：fixtures/es2020/functions/functions.ts
- async/await/for-await：fixtures/es2020/async/async-await.ts
- 生成器/async 生成器：fixtures/es2020/generators/generators.ts
- 类/继承/super：fixtures/es2020/classes/classes.ts
- 模块导入导出：fixtures/es2020/modules/modules.ts
- 模块依赖：fixtures/es2020/modules/modules-dep.ts
- with/debugger：fixtures/es2020/misc/with-debugger.ts

## 7. 附录：QuickJS 扩展语法（非 ES2020）

> QuickJS 支持部分后续提案/更高版本语法（如私有字段）。该部分用于完整性说明。

- 私有字段/方法（#x）
  - 路径：js_parse_class() → resolve_scope_private_field()
  - 典型 opcode：OP_private_symbol / OP_define_private_field / OP_get_private_field / OP_put_private_field / OP_private_in / OP_check_brand
