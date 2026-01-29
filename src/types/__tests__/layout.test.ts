import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'

type LayoutField = { name: string; offset: number; size: number }

const expectedLayouts: Record<string, LayoutField[]> = {
  BlockEnv: [
    { name: '__size__', offset: 0, size: 32 },
    { name: 'prev', offset: 0, size: 4 },
    { name: 'label_name', offset: 4, size: 4 },
    { name: 'label_break', offset: 8, size: 4 },
    { name: 'label_cont', offset: 12, size: 4 },
    { name: 'drop_count', offset: 16, size: 4 },
    { name: 'label_finally', offset: 20, size: 4 },
    { name: 'scope_level', offset: 24, size: 4 },
  ],
  JSFunctionBytecode: [
    { name: '__size__', offset: 0, size: 96 },
    { name: 'header', offset: 0, size: 16 },
    { name: 'js_mode', offset: 16, size: 1 },
    { name: 'byte_code_buf', offset: 20, size: 4 },
    { name: 'byte_code_len', offset: 24, size: 4 },
    { name: 'func_name', offset: 28, size: 4 },
    { name: 'vardefs', offset: 32, size: 4 },
    { name: 'closure_var', offset: 36, size: 4 },
    { name: 'arg_count', offset: 40, size: 2 },
    { name: 'var_count', offset: 42, size: 2 },
    { name: 'defined_arg_count', offset: 44, size: 2 },
    { name: 'stack_size', offset: 46, size: 2 },
    { name: 'realm', offset: 48, size: 4 },
    { name: 'cpool', offset: 52, size: 4 },
    { name: 'cpool_count', offset: 56, size: 4 },
    { name: 'closure_var_count', offset: 60, size: 4 },
    { name: 'ic', offset: 64, size: 4 },
    { name: 'debug', offset: 68, size: 28 },
  ],
  JSModuleDef: [
    { name: '__size__', offset: 0, size: 224 },
    { name: 'header', offset: 0, size: 16 },
    { name: 'module_name', offset: 16, size: 4 },
    { name: 'link', offset: 20, size: 8 },
    { name: 'req_module_entries', offset: 28, size: 4 },
    { name: 'req_module_entries_count', offset: 32, size: 4 },
    { name: 'req_module_entries_size', offset: 36, size: 4 },
    { name: 'export_entries', offset: 40, size: 4 },
    { name: 'export_entries_count', offset: 44, size: 4 },
    { name: 'export_entries_size', offset: 48, size: 4 },
    { name: 'star_export_entries', offset: 52, size: 4 },
    { name: 'star_export_entries_count', offset: 56, size: 4 },
    { name: 'star_export_entries_size', offset: 60, size: 4 },
    { name: 'import_entries', offset: 64, size: 4 },
    { name: 'import_entries_count', offset: 68, size: 4 },
    { name: 'import_entries_size', offset: 72, size: 4 },
    { name: 'module_ns', offset: 80, size: 8 },
    { name: 'func_obj', offset: 88, size: 8 },
    { name: 'init_func', offset: 96, size: 4 },
    { name: 'init_data_func', offset: 100, size: 4 },
    { name: 'dfs_index', offset: 108, size: 4 },
    { name: 'dfs_ancestor_index', offset: 112, size: 4 },
    { name: 'stack_prev', offset: 116, size: 4 },
    { name: 'async_parent_modules', offset: 120, size: 4 },
    { name: 'async_parent_modules_count', offset: 124, size: 4 },
    { name: 'async_parent_modules_size', offset: 128, size: 4 },
    { name: 'pending_async_dependencies', offset: 132, size: 4 },
    { name: 'async_evaluation_timestamp', offset: 144, size: 8 },
    { name: 'cycle_root', offset: 152, size: 4 },
    { name: 'promise', offset: 160, size: 8 },
    { name: 'resolving_funcs', offset: 168, size: 16 },
    { name: 'eval_exception', offset: 192, size: 8 },
    { name: 'meta_obj', offset: 200, size: 8 },
    { name: 'private_value', offset: 208, size: 8 },
    { name: 'init_data_opaque', offset: 216, size: 4 },
  ],
  JSVarDef: [
    { name: '__size__', offset: 0, size: 16 },
    { name: 'var_name', offset: 0, size: 4 },
    { name: 'scope_level', offset: 4, size: 4 },
    { name: 'scope_next', offset: 8, size: 4 },
  ],
  JSVarScope: [
    { name: '__size__', offset: 0, size: 8 },
    { name: 'parent', offset: 0, size: 4 },
    { name: 'first', offset: 4, size: 4 },
  ],
  JSClosureVar: [
    { name: '__size__', offset: 0, size: 8 },
    { name: 'var_idx', offset: 2, size: 2 },
    { name: 'var_name', offset: 4, size: 4 },
  ],
  JSGlobalVar: [
    { name: '__size__', offset: 0, size: 16 },
    { name: 'cpool_idx', offset: 0, size: 4 },
    { name: 'scope_level', offset: 8, size: 4 },
    { name: 'var_name', offset: 12, size: 4 },
  ],
  JSFunctionDef: [
    { name: '__size__', offset: 0, size: 464 },
    { name: 'ctx', offset: 0, size: 4 },
    { name: 'parent', offset: 4, size: 4 },
    { name: 'parent_cpool_idx', offset: 8, size: 4 },
    { name: 'parent_scope_level', offset: 12, size: 4 },
    { name: 'child_list', offset: 16, size: 8 },
    { name: 'link', offset: 24, size: 8 },
    { name: 'is_eval', offset: 32, size: 4 },
    { name: 'eval_type', offset: 36, size: 4 },
    { name: 'is_global_var', offset: 40, size: 4 },
    { name: 'is_func_expr', offset: 44, size: 4 },
    { name: 'has_home_object', offset: 48, size: 4 },
    { name: 'has_prototype', offset: 52, size: 4 },
    { name: 'has_simple_parameter_list', offset: 56, size: 4 },
    { name: 'has_parameter_expressions', offset: 60, size: 4 },
    { name: 'has_use_strict', offset: 64, size: 4 },
    { name: 'has_eval_call', offset: 68, size: 4 },
    { name: 'has_arguments_binding', offset: 72, size: 4 },
    { name: 'has_this_binding', offset: 76, size: 4 },
    { name: 'new_target_allowed', offset: 80, size: 4 },
    { name: 'super_call_allowed', offset: 84, size: 4 },
    { name: 'super_allowed', offset: 88, size: 4 },
    { name: 'arguments_allowed', offset: 92, size: 4 },
    { name: 'is_derived_class_constructor', offset: 96, size: 4 },
    { name: 'in_function_body', offset: 100, size: 4 },
    { name: 'js_mode', offset: 106, size: 1 },
    { name: 'func_name', offset: 108, size: 4 },
    { name: 'vars', offset: 112, size: 4 },
    { name: 'var_size', offset: 116, size: 4 },
    { name: 'var_count', offset: 120, size: 4 },
    { name: 'args', offset: 124, size: 4 },
    { name: 'arg_size', offset: 128, size: 4 },
    { name: 'arg_count', offset: 132, size: 4 },
    { name: 'defined_arg_count', offset: 136, size: 4 },
    { name: 'var_object_idx', offset: 140, size: 4 },
    { name: 'arg_var_object_idx', offset: 144, size: 4 },
    { name: 'arguments_var_idx', offset: 148, size: 4 },
    { name: 'arguments_arg_idx', offset: 152, size: 4 },
    { name: 'func_var_idx', offset: 156, size: 4 },
    { name: 'eval_ret_idx', offset: 160, size: 4 },
    { name: 'this_var_idx', offset: 164, size: 4 },
    { name: 'new_target_var_idx', offset: 168, size: 4 },
    { name: 'this_active_func_var_idx', offset: 172, size: 4 },
    { name: 'home_object_var_idx', offset: 176, size: 4 },
    { name: 'need_home_object', offset: 180, size: 4 },
    { name: 'scope_level', offset: 184, size: 4 },
    { name: 'scope_first', offset: 188, size: 4 },
    { name: 'scope_size', offset: 192, size: 4 },
    { name: 'scope_count', offset: 196, size: 4 },
    { name: 'scopes', offset: 200, size: 4 },
    { name: 'def_scope_array', offset: 204, size: 32 },
    { name: 'body_scope', offset: 236, size: 4 },
    { name: 'global_var_count', offset: 240, size: 4 },
    { name: 'global_var_size', offset: 244, size: 4 },
    { name: 'global_vars', offset: 248, size: 4 },
    { name: 'byte_code', offset: 252, size: 24 },
    { name: 'last_opcode_pos', offset: 276, size: 4 },
    { name: 'last_opcode_source_ptr', offset: 280, size: 4 },
    { name: 'use_short_opcodes', offset: 284, size: 4 },
    { name: 'label_slots', offset: 288, size: 4 },
    { name: 'label_size', offset: 292, size: 4 },
    { name: 'label_count', offset: 296, size: 4 },
    { name: 'top_break', offset: 300, size: 4 },
    { name: 'cpool', offset: 304, size: 4 },
    { name: 'cpool_count', offset: 308, size: 4 },
    { name: 'cpool_size', offset: 312, size: 4 },
    { name: 'closure_var_count', offset: 316, size: 4 },
    { name: 'closure_var_size', offset: 320, size: 4 },
    { name: 'closure_var', offset: 324, size: 4 },
    { name: 'jump_slots', offset: 328, size: 4 },
    { name: 'jump_size', offset: 332, size: 4 },
    { name: 'jump_count', offset: 336, size: 4 },
    { name: 'line_number_slots', offset: 340, size: 4 },
    { name: 'line_number_size', offset: 344, size: 4 },
    { name: 'line_number_count', offset: 348, size: 4 },
    { name: 'line_number_last', offset: 352, size: 4 },
    { name: 'line_number_last_pc', offset: 356, size: 4 },
    { name: 'column_number_slots', offset: 360, size: 4 },
    { name: 'column_number_size', offset: 364, size: 4 },
    { name: 'column_number_count', offset: 368, size: 4 },
    { name: 'column_number_last', offset: 372, size: 4 },
    { name: 'column_number_last_pc', offset: 376, size: 4 },
    { name: 'filename', offset: 384, size: 4 },
    { name: 'source_pos', offset: 388, size: 4 },
    { name: 'get_line_col_cache', offset: 392, size: 4 },
    { name: 'pc2line', offset: 396, size: 24 },
    { name: 'pc2column', offset: 420, size: 24 },
    { name: 'source', offset: 444, size: 4 },
    { name: 'source_len', offset: 448, size: 4 },
    { name: 'module', offset: 452, size: 4 },
    { name: 'has_await', offset: 456, size: 4 },
    { name: 'ic', offset: 460, size: 4 },
  ],
}

const assertLayoutEqual = (name: string, actual: LayoutField[], expected: LayoutField[]) => {
  assert.deepEqual(actual, expected, `${name} 布局不一致`)
}

test('layout: BlockEnv 对齐', async () => {
  const actual = await QuickJSLib.getBlockEnvLayout()
  assertLayoutEqual('BlockEnv', actual, expectedLayouts.BlockEnv)
})

test('layout: JSFunctionBytecode 对齐', async () => {
  const actual = await QuickJSLib.getFunctionBytecodeLayout()
  assertLayoutEqual('JSFunctionBytecode', actual, expectedLayouts.JSFunctionBytecode)
})

test('layout: JSModuleDef 对齐', async () => {
  const actual = await QuickJSLib.getModuleDefLayout()
  assertLayoutEqual('JSModuleDef', actual, expectedLayouts.JSModuleDef)
})

test('layout: JSVarDef 对齐', async () => {
  const actual = await QuickJSLib.getVarDefLayout()
  assertLayoutEqual('JSVarDef', actual, expectedLayouts.JSVarDef)
})

test('layout: JSVarScope 对齐', async () => {
  const actual = await QuickJSLib.getVarScopeLayout()
  assertLayoutEqual('JSVarScope', actual, expectedLayouts.JSVarScope)
})

test('layout: JSClosureVar 对齐', async () => {
  const actual = await QuickJSLib.getClosureVarLayout()
  assertLayoutEqual('JSClosureVar', actual, expectedLayouts.JSClosureVar)
})

test('layout: JSGlobalVar 对齐', async () => {
  const actual = await QuickJSLib.getGlobalVarLayout()
  assertLayoutEqual('JSGlobalVar', actual, expectedLayouts.JSGlobalVar)
})

test('layout: JSFunctionDef 对齐', async () => {
  const actual = await QuickJSLib.getFunctionDefLayout()
  assertLayoutEqual('JSFunctionDef', actual, expectedLayouts.JSFunctionDef)
})
