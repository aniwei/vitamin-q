# QuickJS 操作码宏系统

> **文档版本**: 基于 QuickJS 2025-04-26  
> **源码 Commit**: `70e83ae71b637592f2c4ad4171fc9db66782c027`  
> **定义文件**: [quickjs-opcode.h](../../third_party/QuickJS/include/QuickJS/quickjs-opcode.h)

## 概述

QuickJS 使用 **X-Macro 技术** 来定义操作码。通过单一源文件 `quickjs-opcode.h` 定义所有操作码，然后在不同位置通过不同的宏定义来生成：

1. **枚举值** - 操作码 ID
2. **信息数组** - 操作码元数据（大小、栈效果等）
3. **名称数组** - 操作码名称字符串（调试用）
4. **分发表** - 虚拟机解释器跳转表

```mermaid
flowchart TB
    subgraph "quickjs-opcode.h"
        DEFS["DEF(push_i32, 5, 0, 1, i32)
DEF(add, 1, 2, 1, none)
DEF(call, 3, 1, 1, npop)
..."]
    end
    
    subgraph "使用位置 1: 枚举定义"
        ENUM["#define DEF(id,...) OP_##id,
enum OPCodeEnum {
    #include quickjs-opcode.h
};
// → OP_push_i32 = 0
// → OP_add = 1
// → ..."]
    end
    
    subgraph "使用位置 2: 信息数组"
        INFO["#define DEF(id,size,n_pop,n_push,f) \
    {size, n_pop, n_push, OP_FMT_##f},
static const JSOpCodeInfo opcode_info[] = {
    #include quickjs-opcode.h
};"]
    end
    
    subgraph "使用位置 3: 名称数组"
        NAMES["#define DEF(id,...) #id,
static const char* opcode_names[] = {
    #include quickjs-opcode.h
};
// → \"push_i32\", \"add\", ..."]
    end
    
    subgraph "使用位置 4: 解释器分发"
        DISPATCH["#define DEF(id,...) &&lbl_##id,
static void* dispatch_table[] = {
    #include quickjs-opcode.h
};
// → &&lbl_push_i32, &&lbl_add, ..."]
    end
    
    DEFS --> ENUM
    DEFS --> INFO
    DEFS --> NAMES
    DEFS --> DISPATCH
```

---

## 1. 宏定义格式

### 1.1 DEF 宏（运行时操作码）

```c
DEF(id, size, n_pop, n_push, format)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | 标识符 | 操作码名称，如 `push_i32` |
| `size` | 整数 | 操作码字节长度（含操作数） |
| `n_pop` | 整数 | 从栈弹出的值数量 |
| `n_push` | 整数 | 压入栈的值数量 |
| `format` | 枚举 | 操作数格式，如 `i32`, `atom`, `none` |

**示例**:
```c
DEF(push_i32, 5, 0, 1, i32)
// 操作码: push_i32
// 大小: 5 字节 (1 opcode + 4 bytes i32)
// 弹出: 0 个值
// 压入: 1 个值
// 格式: i32 (32位有符号整数)
```

### 1.2 def 宏（临时操作码）

```c
def(id, size, n_pop, n_push, format)
```

与 `DEF` 相同的参数，但用于定义临时操作码。如果没有特别定义 `def`，它会默认展开为 `DEF`：

```c
#ifndef def
#define def(id, size, n_pop, n_push, f) DEF(id, size, n_pop, n_push, f)
#endif
```

这意味着临时操作码在枚举中也有值，但运行时解释器可以选择不处理它们。

### 1.3 FMT 宏（操作数格式）

```c
FMT(format_name)
```

定义操作数格式枚举：

```c
#ifdef FMT
FMT(none)
FMT(none_int)
FMT(none_loc)
FMT(u8)
FMT(i8)
FMT(loc8)
FMT(const8)
FMT(label8)
// ... 更多格式
#undef FMT
#endif
```

---

## 2. 宏展开详解

### 2.1 生成枚举值

```c
// 在 quickjs.c 或 parser.c 中
typedef enum OPCodeEnum {
#define DEF(id, size, n_pop, n_push, f) OP_##id,
#include "quickjs-opcode.h"
    OP_COUNT,  // 操作码总数
    OP_TEMP_START = OP_nop + 1,  // 临时操作码起始位置
} OPCodeEnum;
```

**展开结果**:
```c
typedef enum OPCodeEnum {
    OP_invalid,        // 0
    OP_push_i32,       // 1
    OP_push_const,     // 2
    OP_fclosure,       // 3
    // ... 所有 DEF 定义的操作码
    OP_nop,            // 最后一个运行时操作码
    // def 定义的临时操作码
    OP_enter_scope,
    OP_leave_scope,
    OP_label,
    // ...
    OP_COUNT,
    OP_TEMP_START = OP_nop + 1,
} OPCodeEnum;
```

### 2.2 生成操作码信息数组

```c
// 操作码信息结构
typedef struct JSOpCodeInfo {
    uint8_t size;      // 操作码大小
    uint8_t n_pop;     // 弹出数量
    uint8_t n_push;    // 压入数量
    uint8_t fmt;       // 操作数格式
} JSOpCodeInfo;

// 生成信息数组
static const JSOpCodeInfo opcode_info[OP_COUNT] = {
#define DEF(id, size, n_pop, n_push, f) \
    { size, n_pop, n_push, OP_FMT_##f },
#include "quickjs-opcode.h"
};
```

**展开结果**:
```c
static const JSOpCodeInfo opcode_info[OP_COUNT] = {
    { 1, 0, 0, OP_FMT_none },       // OP_invalid
    { 5, 0, 1, OP_FMT_i32 },        // OP_push_i32
    { 5, 0, 1, OP_FMT_const },      // OP_push_const
    { 5, 0, 1, OP_FMT_const },      // OP_fclosure
    // ...
    { 1, 2, 1, OP_FMT_none },       // OP_add
    { 1, 0, 0, OP_FMT_none },       // OP_nop
    // 临时操作码
    { 3, 0, 0, OP_FMT_u16 },        // OP_enter_scope
    // ...
};
```

### 2.3 生成操作码名称数组（调试用）

```c
#ifdef DUMP_BYTECODE
static const char* const opcode_names[OP_COUNT] = {
#define DEF(id, size, n_pop, n_push, f) #id,
#include "quickjs-opcode.h"
};
#endif
```

**展开结果**:
```c
static const char* const opcode_names[OP_COUNT] = {
    "invalid",
    "push_i32",
    "push_const",
    "fclosure",
    // ...
    "add",
    "nop",
    "enter_scope",
    // ...
};
```

### 2.4 生成解释器分发表（计算跳转）

```c
// 在 JS_CallInternal 中
#if defined(__GNUC__) && !defined(EMSCRIPTEN)
#define USE_COMPUTED_GOTO 1
#endif

#if USE_COMPUTED_GOTO
    // 使用 GCC 计算跳转扩展
    static const void* const dispatch_table[OP_COUNT] = {
#define DEF(id, size, n_pop, n_push, f) &&label_##id,
#include "quickjs-opcode.h"
    };
    
    #define DISPATCH() goto *dispatch_table[*pc++]
#else
    // 使用传统 switch-case
    #define DISPATCH() continue
#endif
```

**展开结果**（计算跳转版本）:
```c
static const void* const dispatch_table[OP_COUNT] = {
    &&label_invalid,
    &&label_push_i32,
    &&label_push_const,
    &&label_fclosure,
    // ...
    &&label_add,
    &&label_nop,
    // ...
};
```

---

## 3. 操作数格式枚举

```c
typedef enum OPCodeFormat {
#define FMT(f) OP_FMT_##f,
#include "quickjs-opcode.h"
} OPCodeFormat;
```

**展开结果**:
```c
typedef enum OPCodeFormat {
    OP_FMT_none,          // 无操作数
    OP_FMT_none_int,      // 无操作数（整数优化）
    OP_FMT_none_loc,      // 无操作数（本地变量优化）
    OP_FMT_none_arg,      // 无操作数（参数优化）
    OP_FMT_none_var_ref,  // 无操作数（闭包变量优化）
    OP_FMT_u8,            // 无符号 8 位
    OP_FMT_i8,            // 有符号 8 位
    OP_FMT_loc8,          // 本地变量索引 8 位
    OP_FMT_const8,        // 常量索引 8 位
    OP_FMT_label8,        // 跳转偏移 8 位
    OP_FMT_u16,           // 无符号 16 位
    OP_FMT_i16,           // 有符号 16 位
    OP_FMT_label16,       // 跳转偏移 16 位
    OP_FMT_npop,          // 参数数量
    OP_FMT_npopx,         // 参数数量（优化）
    OP_FMT_npop_u16,      // 参数数量 + 16 位数据
    OP_FMT_loc,           // 本地变量索引 16 位
    OP_FMT_arg,           // 参数索引 16 位
    OP_FMT_var_ref,       // 闭包变量索引 16 位
    OP_FMT_u32,           // 无符号 32 位
    OP_FMT_i32,           // 有符号 32 位
    OP_FMT_const,         // 常量索引 32 位
    OP_FMT_label,         // 跳转偏移 32 位
    OP_FMT_atom,          // 原子字符串索引
    OP_FMT_atom_u8,       // 原子 + 8 位数据
    OP_FMT_atom_u16,      // 原子 + 16 位数据
    OP_FMT_atom_label_u8, // 原子 + 跳转 + 8 位
    OP_FMT_atom_label_u16,// 原子 + 跳转 + 16 位
    OP_FMT_label_u16,     // 跳转 + 16 位数据
} OPCodeFormat;
```

---

## 4. 运行时 vs 临时操作码区分

### 4.1 通过宏区分

```c
// quickjs-opcode.h 中的默认处理
#ifdef DEF

#ifndef def
#define def(id, size, n_pop, n_push, f) DEF(id, size, n_pop, n_push, f)
#endif

// 运行时操作码
DEF(push_i32, 5, 0, 1, i32)
DEF(add, 1, 2, 1, none)
// ...
DEF(nop, 1, 0, 0, none)  // 最后一个运行时操作码

// 临时操作码
def(enter_scope, 3, 0, 0, u16)
def(leave_scope, 3, 0, 0, u16)
def(label, 5, 0, 0, label)
// ...

#undef DEF
#undef def
#endif
```

### 4.2 通过枚举值区分

```c
// OP_nop 是最后一个运行时操作码
// OP_TEMP_START = OP_nop + 1 是临时操作码起始

static inline int is_runtime_opcode(int op) {
    return op <= OP_nop;
}

static inline int is_temp_opcode(int op) {
    return op > OP_nop && op < OP_COUNT;
}
```

### 4.3 解释器处理

```c
// 在 JS_CallInternal 中，临时操作码通常不应该被执行
label_enter_scope:
label_leave_scope:
label_label:
    // 这些操作码不应该出现在最终字节码中
    abort();  // 或者直接不定义这些标签
```

---

## 5. 短操作码条件编译

```c
#if SHORT_OPCODES
DEF(push_minus1, 1, 0, 1, none_int)
DEF(push_0, 1, 0, 1, none_int)
DEF(push_1, 1, 0, 1, none_int)
// ... 更多短操作码
DEF(get_loc0, 1, 0, 1, none_loc)
DEF(get_loc1, 1, 0, 1, none_loc)
// ...
#endif
```

当 `SHORT_OPCODES` 定义时，这些优化操作码会被包含。它们的枚举值和信息会被正确生成。

---

## 6. 实际使用示例

### 6.1 发射操作码

```c
// parser.c
static void emit_op(JSParseState *s, uint8_t op) {
    JSFunctionDef *fd = s->cur_func;
    // 将操作码写入字节码缓冲区
    dbuf_putc(&fd->byte_code, op);
}

static void emit_push_i32(JSParseState *s, int32_t val) {
    emit_op(s, OP_push_i32);
    emit_i32(s, val);
}
```

### 6.2 读取操作码信息

```c
// 获取操作码大小
int op = byte_code[pc];
int op_size = opcode_info[op].size;

// 获取栈效果
int pop_count = opcode_info[op].n_pop;
int push_count = opcode_info[op].n_push;

// 获取操作数格式
int fmt = opcode_info[op].fmt;
```

### 6.3 调试输出

```c
#ifdef DUMP_BYTECODE
void dump_bytecode(const uint8_t *bc, int len) {
    int pc = 0;
    while (pc < len) {
        int op = bc[pc];
        printf("%4d: %s", pc, opcode_names[op]);
        // 根据 opcode_info[op].fmt 解析并打印操作数
        pc += opcode_info[op].size;
        printf("\n");
    }
}
#endif
```

---

## 7. 设计优势

### 7.1 单一数据源

所有操作码定义在一个文件中，保证一致性。添加新操作码只需在一处修改。

### 7.2 自动生成

通过宏展开自动生成枚举、数组、分发表，避免手动维护多处数据。

### 7.3 编译时计算

所有数据在编译时生成，无运行时开销。

### 7.4 灵活性

可以选择性包含某些操作码（如 `SHORT_OPCODES`），支持不同配置。

---

## 相关文档

- [操作码参考](opcode-reference.md) - 完整操作码列表
- [操作码分类](opcode-categories.md) - 运行时 vs 临时操作码
- [架构概述](architecture.md) - QuickJS 整体架构
