/*
 * QuickJS TypeScript Compiler - Trace/Debug utilities
 *
 * 本文件提供编译过程的埋点/调试工具，用于跟踪 QuickJS 的编译行为，
 * 帮助验证 TypeScript 侧的 lowering 是否与 QuickJS 保持逐字节一致。
 */

#pragma once

#include <stdio.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * Trace Configuration
 * ============================================================================
 * 
 * QTS_TRACE_ENABLED: 总开关（0/1），控制是否输出任何 trace
 * QTS_TRACE_LEVEL: 详细程度（1=最少，2=详细，3=最详细）
 * 
 * 分类开关（默认：开启 trace 时各类都开启；也可单独覆盖）：
 *   QTS_TRACE_EMIT       - 字节码发射（emit_op/emit_u8/...）
 *   QTS_TRACE_VARIABLE   - 变量解析
 *   QTS_TRACE_CLOSURE    - 闭包变量处理
 *   QTS_TRACE_LABEL      - 标签/跳转解析
 *   QTS_TRACE_STACK      - 栈深计算
 *   QTS_TRACE_PC2LINE    - pc2line/debug 槽位与编码
 *   QTS_TRACE_SCOPE      - 作用域管理
 *   QTS_TRACE_ASSIGN     - 赋值/左值处理（get_lvalue/put_lvalue/复合赋值）
 */

#ifndef QTS_TRACE_ENABLED
#define QTS_TRACE_ENABLED 0
#endif

#ifndef QTS_TRACE_LEVEL
#define QTS_TRACE_LEVEL 1
#endif

/* Individual category enables (default: all on when tracing enabled) */
#ifndef QTS_TRACE_EMIT
#define QTS_TRACE_EMIT QTS_TRACE_ENABLED
#endif

#ifndef QTS_TRACE_VARIABLE
#define QTS_TRACE_VARIABLE QTS_TRACE_ENABLED
#endif

#ifndef QTS_TRACE_CLOSURE
#define QTS_TRACE_CLOSURE QTS_TRACE_ENABLED
#endif

#ifndef QTS_TRACE_LABEL
#define QTS_TRACE_LABEL QTS_TRACE_ENABLED
#endif

#ifndef QTS_TRACE_STACK
#define QTS_TRACE_STACK QTS_TRACE_ENABLED
#endif

#ifndef QTS_TRACE_PC2LINE
#define QTS_TRACE_PC2LINE QTS_TRACE_ENABLED
#endif

#ifndef QTS_TRACE_SCOPE
#define QTS_TRACE_SCOPE QTS_TRACE_ENABLED
#endif

#ifndef QTS_TRACE_ASSIGN
#define QTS_TRACE_ASSIGN QTS_TRACE_ENABLED
#endif

/* ============================================================================
 * Trace Macros
 * ============================================================================ */

#if QTS_TRACE_ENABLED

/* General trace */
#define QTS_TRACE(fmt, ...) \
    fprintf(stderr, "[QTS] " fmt "\n", ##__VA_ARGS__)

/* Section markers */
#define QTS_TRACE_SECTION_BEGIN(name) \
    fprintf(stderr, "[QTS] ===== %s BEGIN =====\n", name)

#define QTS_TRACE_SECTION_END(name) \
    fprintf(stderr, "[QTS] ===== %s END =====\n", name)

/* Bytecode emission tracing */
#if QTS_TRACE_EMIT
#define QTS_TRACE_EMIT_OP(op, pos) \
    fprintf(stderr, "[QTS:EMIT] pos=%zu op=%d\n", (size_t)(pos), (int)(op))

#define QTS_TRACE_EMIT_U8(val, pos) \
    fprintf(stderr, "[QTS:EMIT] pos=%zu u8=0x%02x\n", (size_t)(pos), (uint8_t)(val))

/* 语义化埋点：用于标记特定 opcode 的操作数含义（不改变任何 emit 行为） */
#if QTS_TRACE_LEVEL >= 2
#define QTS_TRACE_EMIT_COPY_DATA_PROPERTIES(kind, operand, pos) \
    fprintf(stderr, "[QTS:EMIT] pos=%zu copy_data_properties(%s) operand=0x%02x\n", \
            (size_t)(pos), (kind), (uint8_t)(operand))

#define QTS_TRACE_EMIT_FOR_OF_NEXT(operand, pos) \
    fprintf(stderr, "[QTS:EMIT] pos=%zu for_of_next operand=0x%02x\n", \
            (size_t)(pos), (uint8_t)(operand))
#else
#define QTS_TRACE_EMIT_COPY_DATA_PROPERTIES(kind, operand, pos)
#define QTS_TRACE_EMIT_FOR_OF_NEXT(operand, pos)
#endif

#define QTS_TRACE_EMIT_U16(val, pos) \
    fprintf(stderr, "[QTS:EMIT] pos=%zu u16=0x%04x (%d)\n", (size_t)(pos), (uint16_t)(val), (int)(val))

#define QTS_TRACE_EMIT_U32(val, pos) \
    fprintf(stderr, "[QTS:EMIT] pos=%zu u32=0x%08x (%d)\n", (size_t)(pos), (uint32_t)(val), (int)(val))

#define QTS_TRACE_EMIT_ATOM(atom, pos) \
    fprintf(stderr, "[QTS:EMIT] pos=%zu atom=%d\n", (size_t)(pos), (int)(atom))
#else
#define QTS_TRACE_EMIT_OP(op, pos)
#define QTS_TRACE_EMIT_U8(val, pos)
#define QTS_TRACE_EMIT_U16(val, pos)
#define QTS_TRACE_EMIT_U32(val, pos)
#define QTS_TRACE_EMIT_ATOM(atom, pos)
#define QTS_TRACE_EMIT_COPY_DATA_PROPERTIES(kind, operand, pos)
#define QTS_TRACE_EMIT_FOR_OF_NEXT(operand, pos)
#endif

/* pc2line tracing */
#if QTS_TRACE_PC2LINE
#if QTS_TRACE_LEVEL >= 2
#define QTS_TRACE_PC2LINE_BEGIN(line_count, source_pos) \
    fprintf(stderr, "[QTS:PC2LINE] begin: slots=%d source_pos=%u\n", (int)(line_count), (unsigned)(source_pos))

#define QTS_TRACE_PC2LINE_INIT(line_num, col_num) \
    fprintf(stderr, "[QTS:PC2LINE] init: line=%d col=%d\n", (int)(line_num), (int)(col_num))

#define QTS_TRACE_PC2LINE_END(out_len) \
    fprintf(stderr, "[QTS:PC2LINE] end: pc2line_len=%d\n", (int)(out_len))
#else
#define QTS_TRACE_PC2LINE_BEGIN(line_count, source_pos)
#define QTS_TRACE_PC2LINE_INIT(line_num, col_num)
#define QTS_TRACE_PC2LINE_END(out_len)
#endif

#if QTS_TRACE_LEVEL >= 3
#define QTS_TRACE_PC2LINE_ADD(pc, source_pos, count) \
    fprintf(stderr, "[QTS:PC2LINE] add: pc=%u source_pos=%u count=%d\n", (unsigned)(pc), (unsigned)(source_pos), (int)(count))

#define QTS_TRACE_PC2LINE_SLOT(i, pc, source_pos, line_num, col_num, diff_pc, diff_line, diff_col, is_short, op) \
    fprintf(stderr, "[QTS:PC2LINE] slot[%d]: pc=%u src=%u line=%d col=%d dpc=%d dline=%d dcol=%d %s op=0x%02x\n", \
            (int)(i), (unsigned)(pc), (unsigned)(source_pos), (int)(line_num), (int)(col_num), (int)(diff_pc), (int)(diff_line), (int)(diff_col), \
            (is_short) ? "short" : "long", (unsigned)(op))
#else
#define QTS_TRACE_PC2LINE_ADD(pc, source_pos, count) \
        do { (void)(pc); (void)(source_pos); (void)(count); } while (0)

#define QTS_TRACE_PC2LINE_SLOT(i, pc, source_pos, line_num, col_num, diff_pc, diff_line, diff_col, is_short, op) \
        do { \
            (void)(i); (void)(pc); (void)(source_pos); (void)(line_num); (void)(col_num); \
            (void)(diff_pc); (void)(diff_line); (void)(diff_col); (void)(is_short); (void)(op); \
        } while (0)
#endif
#else
#define QTS_TRACE_PC2LINE_BEGIN(line_count, source_pos)
#define QTS_TRACE_PC2LINE_INIT(line_num, col_num)
#define QTS_TRACE_PC2LINE_END(out_len)
#define QTS_TRACE_PC2LINE_ADD(pc, source_pos, count) \
        do { (void)(pc); (void)(source_pos); (void)(count); } while (0)

#define QTS_TRACE_PC2LINE_SLOT(i, pc, source_pos, line_num, col_num, diff_pc, diff_line, diff_col, is_short, op) \
        do { \
            (void)(i); (void)(pc); (void)(source_pos); (void)(line_num); (void)(col_num); \
            (void)(diff_pc); (void)(diff_line); (void)(diff_col); (void)(is_short); (void)(op); \
        } while (0)
#endif

/* Variable resolution tracing */
#if QTS_TRACE_VARIABLE
#define QTS_TRACE_VAR_RESOLVE(name, scope, op) \
    fprintf(stderr, "[QTS:VAR] resolve: atom=%d scope=%d op=%d\n", (int)(name), (int)(scope), (int)(op))

#define QTS_TRACE_VAR_FOUND(idx, is_arg) \
    fprintf(stderr, "[QTS:VAR]   found: idx=%d is_arg=%d\n", (int)(idx), (int)(is_arg))

#define QTS_TRACE_VAR_NOT_FOUND(name) \
    fprintf(stderr, "[QTS:VAR]   not found: atom=%d\n", (int)(name))

#define QTS_TRACE_VAR_EMIT(op, idx) \
    fprintf(stderr, "[QTS:VAR]   emit: op=%d idx=%d\n", (int)(op), (int)(idx))

/* Hoisted definitions / global var init tracing */
#define QTS_TRACE_VAR_HOIST_BEGIN(eval_type, is_module, global_var_count, closure_var_count) \
    fprintf(stderr, "[QTS:VAR] hoist: eval_type=%d module=%d globals=%d closures=%d\n", \
            (int)(eval_type), (int)(is_module), (int)(global_var_count), (int)(closure_var_count))

#define QTS_TRACE_VAR_HOIST_GLOBAL(var_name, has_closure, flags, cpool_idx, is_lexical, is_const, force_init) \
    fprintf(stderr, "[QTS:VAR]   global: atom=%d has_closure=%d flags=0x%02x cpool=%d lexical=%d const=%d force_init=%d\n", \
            (int)(var_name), (int)(has_closure), (int)(flags), (int)(cpool_idx), \
            (int)(is_lexical), (int)(is_const), (int)(force_init))
#else
#define QTS_TRACE_VAR_RESOLVE(name, scope, op)
#define QTS_TRACE_VAR_FOUND(idx, is_arg)
#define QTS_TRACE_VAR_NOT_FOUND(name)
#define QTS_TRACE_VAR_EMIT(op, idx)
#define QTS_TRACE_VAR_HOIST_BEGIN(eval_type, is_module, global_var_count, closure_var_count)
#define QTS_TRACE_VAR_HOIST_GLOBAL(var_name, has_closure, flags, cpool_idx, is_lexical, is_const, force_init)
#endif

/* Closure variable tracing */
#if QTS_TRACE_CLOSURE
#define QTS_TRACE_CLOSURE_ADD(var_idx, is_local, is_arg, var_name) \
    fprintf(stderr, "[QTS:CLOSURE] add: var_idx=%d is_local=%d is_arg=%d var_name=%d\n", \
            (int)(var_idx), (int)(is_local), (int)(is_arg), (int)(var_name))

#define QTS_TRACE_CLOSURE_GET(fd_idx, var_idx, is_arg) \
    fprintf(stderr, "[QTS:CLOSURE] get: fd_depth=%d var_idx=%d is_arg=%d\n", \
            (int)(fd_idx), (int)(var_idx), (int)(is_arg))

#define QTS_TRACE_CLOSURE_CAPTURE(var_idx, var_name) \
    fprintf(stderr, "[QTS:CLOSURE] capture: var_idx=%d var_name=%d\n", \
            (int)(var_idx), (int)(var_name))
#else
#define QTS_TRACE_CLOSURE_ADD(var_idx, is_local, is_arg, var_name)
#define QTS_TRACE_CLOSURE_GET(fd_idx, var_idx, is_arg)
#define QTS_TRACE_CLOSURE_CAPTURE(var_idx, var_name)
#endif

/* Label resolution tracing */
#if QTS_TRACE_LABEL
#define QTS_TRACE_LABEL_BEGIN(bc_len, label_count, jump_size, line_number_size, strip_debug) \
    fprintf(stderr, "[QTS:LABEL] begin: bc_len=%d label_count=%d jump_size=%d line_number_size=%d strip_debug=%d\n", \
            (int)(bc_len), (int)(label_count), (int)(jump_size), (int)(line_number_size), (int)(strip_debug))

#define QTS_TRACE_LABEL_END(out_len) \
    fprintf(stderr, "[QTS:LABEL] end: out_len=%d\n", (int)(out_len))

#define QTS_TRACE_LABEL_NEW(label) \
    fprintf(stderr, "[QTS:LABEL] new: label=%d\n", (int)(label))

#define QTS_TRACE_LABEL_EMIT(label, pos) \
    fprintf(stderr, "[QTS:LABEL] emit: label=%d pos=%zu\n", (int)(label), (size_t)(pos))

#define QTS_TRACE_LABEL_GOTO(opcode, label) \
    fprintf(stderr, "[QTS:LABEL] goto: opcode=%d label=%d\n", (int)(opcode), (int)(label))

#define QTS_TRACE_LABEL_RESOLVE(label, addr) \
    fprintf(stderr, "[QTS:LABEL] resolve: label=%d addr=%d\n", (int)(label), (int)(addr))

/* resolve_labels(): typeof-test side effects (parser.c:12007+) */
#if QTS_TRACE_LEVEL >= 2
#define QTS_TRACE_LABEL_TYPEOF_TEST_MATCH(pos, pos_next, line_before, line_after, atom, cmp_op) \
    fprintf(stderr, "[QTS:LABEL] typeof_test: pos=%d pos_next=%d line_num:%d->%d atom=%d cmp_op=%d\n", \
            (int)(pos), (int)(pos_next), (int)(line_before), (int)(line_after), (int)(atom), (int)(cmp_op))
#else
#define QTS_TRACE_LABEL_TYPEOF_TEST_MATCH(pos, pos_next, line_before, line_after, atom, cmp_op) \
        do { \
            (void)(pos); (void)(pos_next); (void)(line_before); (void)(line_after); (void)(atom); (void)(cmp_op); \
        } while (0)
#endif
#else
#define QTS_TRACE_LABEL_BEGIN(bc_len, label_count, jump_size, line_number_size, strip_debug)
#define QTS_TRACE_LABEL_END(out_len)
#define QTS_TRACE_LABEL_NEW(label)
#define QTS_TRACE_LABEL_EMIT(label, pos)
#define QTS_TRACE_LABEL_GOTO(opcode, label)
#define QTS_TRACE_LABEL_RESOLVE(label, addr)
#define QTS_TRACE_LABEL_TYPEOF_TEST_MATCH(pos, pos_next, line_before, line_after, atom, cmp_op) \
        do { \
            (void)(pos); (void)(pos_next); (void)(line_before); (void)(line_after); (void)(atom); (void)(cmp_op); \
        } while (0)
#endif

/* Stack size tracing */
#if QTS_TRACE_STACK
#define QTS_TRACE_STACK_OP(op, stack_before, stack_after) \
    fprintf(stderr, "[QTS:STACK] op=%d stack: %d -> %d\n", \
            (int)(op), (int)(stack_before), (int)(stack_after))

#define QTS_TRACE_STACK_RESULT(max_stack, var_count) \
    fprintf(stderr, "[QTS:STACK] result: max_stack=%d var_count=%d\n", \
            (int)(max_stack), (int)(var_count))
#else
#define QTS_TRACE_STACK_OP(op, stack_before, stack_after)
#define QTS_TRACE_STACK_RESULT(max_stack, var_count)
#endif

/* Scope tracing */
#if QTS_TRACE_SCOPE
#define QTS_TRACE_SCOPE_PUSH(scope_level, first_var) \
    fprintf(stderr, "[QTS:SCOPE] push: level=%d first_var=%d\n", \
            (int)(scope_level), (int)(first_var))

#define QTS_TRACE_SCOPE_POP(scope_level) \
    fprintf(stderr, "[QTS:SCOPE] pop: level=%d\n", (int)(scope_level))

#define QTS_TRACE_SCOPE_ENTER(scope_idx, body_scope) \
    fprintf(stderr, "[QTS:SCOPE] enter: idx=%d is_body=%d\n", \
            (int)(scope_idx), (int)((scope_idx) == (body_scope)))

#define QTS_TRACE_SCOPE_LEAVE(scope_idx) \
    fprintf(stderr, "[QTS:SCOPE] leave: idx=%d\n", (int)(scope_idx))
#else
#define QTS_TRACE_SCOPE_PUSH(scope_level, first_var)
#define QTS_TRACE_SCOPE_POP(scope_level)
#define QTS_TRACE_SCOPE_ENTER(scope_idx, body_scope)
#define QTS_TRACE_SCOPE_LEAVE(scope_idx)
#endif

/* Assignment/lvalue tracing */
#if QTS_TRACE_ASSIGN
#define QTS_TRACE_ASSIGN_LVALUE(op, scope, name, label) \
    fprintf(stderr, "[QTS:ASSIGN] lvalue: opcode=%d scope=%d atom=%d label=%d\n", \
            (int)(op), (int)(scope), (int)(name), (int)(label))

#define QTS_TRACE_ASSIGN_COMPOUND(assign_tok, op) \
    fprintf(stderr, "[QTS:ASSIGN] compound: tok=%d op=%d\n", (int)(assign_tok), (int)(op))
#else
#define QTS_TRACE_ASSIGN_LVALUE(op, scope, name, label)
#define QTS_TRACE_ASSIGN_COMPOUND(assign_tok, op)
#endif

#else /* QTS_TRACE_ENABLED == 0 */

/* All macros become no-ops when tracing is disabled */
#define QTS_TRACE(fmt, ...)
#define QTS_TRACE_SECTION_BEGIN(name)
#define QTS_TRACE_SECTION_END(name)
#define QTS_TRACE_EMIT_OP(op, pos)
#define QTS_TRACE_EMIT_U8(val, pos)
#define QTS_TRACE_EMIT_U16(val, pos)
#define QTS_TRACE_EMIT_U32(val, pos)
#define QTS_TRACE_EMIT_ATOM(atom, pos)
#define QTS_TRACE_EMIT_COPY_DATA_PROPERTIES(kind, operand, pos)
#define QTS_TRACE_EMIT_FOR_OF_NEXT(operand, pos)
#define QTS_TRACE_VAR_RESOLVE(name, scope, op)
#define QTS_TRACE_VAR_FOUND(idx, is_arg)
#define QTS_TRACE_VAR_NOT_FOUND(name)
#define QTS_TRACE_VAR_EMIT(op, idx)
#define QTS_TRACE_VAR_HOIST_BEGIN(eval_type, is_module, global_var_count, closure_var_count)
#define QTS_TRACE_VAR_HOIST_GLOBAL(var_name, has_closure, flags, cpool_idx, is_lexical, is_const, force_init)
#define QTS_TRACE_CLOSURE_ADD(var_idx, is_local, is_arg, var_name)
#define QTS_TRACE_CLOSURE_GET(fd_idx, var_idx, is_arg)
#define QTS_TRACE_CLOSURE_CAPTURE(var_idx, var_name)
#define QTS_TRACE_LABEL_BEGIN(bc_len, label_count, jump_size, line_number_size, strip_debug)
#define QTS_TRACE_LABEL_END(out_len)
#define QTS_TRACE_LABEL_NEW(label)
#define QTS_TRACE_LABEL_EMIT(label, pos)
#define QTS_TRACE_LABEL_GOTO(opcode, label)
#define QTS_TRACE_LABEL_RESOLVE(label, addr)
#define QTS_TRACE_LABEL_TYPEOF_TEST_MATCH(pos, pos_next, line_before, line_after, atom, cmp_op) \
        do { \
            (void)(pos); (void)(pos_next); (void)(line_before); (void)(line_after); (void)(atom); (void)(cmp_op); \
        } while (0)
#define QTS_TRACE_STACK_OP(op, stack_before, stack_after)
#define QTS_TRACE_STACK_RESULT(max_stack, var_count)
#define QTS_TRACE_PC2LINE_BEGIN(line_count, source_pos)
#define QTS_TRACE_PC2LINE_INIT(line_num, col_num)
#define QTS_TRACE_PC2LINE_END(out_len)
#define QTS_TRACE_PC2LINE_ADD(pc, source_pos, count) \
        do { (void)(pc); (void)(source_pos); (void)(count); } while (0)

#define QTS_TRACE_PC2LINE_SLOT(i, pc, source_pos, line_num, col_num, diff_pc, diff_line, diff_col, is_short, op) \
        do { \
            (void)(i); (void)(pc); (void)(source_pos); (void)(line_num); (void)(col_num); \
            (void)(diff_pc); (void)(diff_line); (void)(diff_col); (void)(is_short); (void)(op); \
        } while (0)
#define QTS_TRACE_SCOPE_PUSH(scope_level, first_var)
#define QTS_TRACE_SCOPE_POP(scope_level)
#define QTS_TRACE_SCOPE_ENTER(scope_idx, body_scope)
#define QTS_TRACE_SCOPE_LEAVE(scope_idx)
#define QTS_TRACE_ASSIGN_LVALUE(op, scope, name, label)
#define QTS_TRACE_ASSIGN_COMPOUND(assign_tok, op)

#endif /* QTS_TRACE_ENABLED */

/* ============================================================================
 * Trace Functions (for complex logging)
 * ============================================================================ */

#if QTS_TRACE_ENABLED

/* Dump function definition summary */
static inline void qts_trace_func_def(
    const char* phase,
    int var_count,
    int arg_count,
    int closure_var_count,
    int scope_count,
    size_t bc_size
) {
    fprintf(stderr, "[QTS:FUNC] %s: vars=%d args=%d closures=%d scopes=%d bc_size=%zu\n",
            phase, var_count, arg_count, closure_var_count, scope_count, bc_size);
}

/* Dump bytecode hex (first N bytes) */
static inline void qts_trace_bytecode_hex(const uint8_t* buf, size_t len, size_t max_bytes) {
    fprintf(stderr, "[QTS:HEX] ");
    size_t n = len < max_bytes ? len : max_bytes;
    for (size_t i = 0; i < n; i++) {
        fprintf(stderr, "%02x ", buf[i]);
        if ((i + 1) % 16 == 0 && i + 1 < n) {
            fprintf(stderr, "\n[QTS:HEX] ");
        }
    }
    if (len > max_bytes) {
        fprintf(stderr, "... (%zu more bytes)", len - max_bytes);
    }
    fprintf(stderr, "\n");
}

#else

static inline void qts_trace_func_def(
    const char* phase,
    int var_count,
    int arg_count,
    int closure_var_count,
    int scope_count,
    size_t bc_size
) { (void)phase; (void)var_count; (void)arg_count; (void)closure_var_count; (void)scope_count; (void)bc_size; }

static inline void qts_trace_bytecode_hex(const uint8_t* buf, size_t len, size_t max_bytes) {
    (void)buf; (void)len; (void)max_bytes;
}

#endif /* QTS_TRACE_ENABLED */

#ifdef __cplusplus
}
#endif
