#include "QuickJS/extension/taro_js_module.h"

#include "../core/module.h"
#include "../core/parser.h"
#include "../core/types.h"
#include "QuickJS/quickjs.h"

// 解析导入的模块
JSModuleDef* taro_js_host_resolve_imported_module(
    JSContext* ctx,
    const char* base_cname,
    const char* cname1,
    JSValueConst attributes) {
  return js_host_resolve_imported_module(ctx, base_cname, cname1, attributes);
}

int taro_js_resolve_module(JSContext* ctx, JSValueConst obj) {
  return JS_ResolveModule(ctx, obj);
}

int taro_js_resolve_module(JSContext* ctx, JSModuleDef* m) {
  return js_resolve_module(ctx, m);
}

JSModuleDef* taro_js_find_loaded_module(JSContext* ctx, JSAtom name) {
  return js_find_loaded_module(ctx, name);
}

int taro_js_add_module_export(
    JSContext* ctx,
    JSModuleDef* m,
    const char* export_name) {
  return JS_AddModuleExport(ctx, m, export_name);
}

int taro_js_set_module_export(
    JSContext* ctx,
    JSModuleDef* m,
    const char* export_name,
    JSValue val) {
  return JS_SetModuleExport(ctx, m, export_name, val);
}

// JSValue taro_js_get_module_export(
//     JSContext* ctx,
//     JSModuleDef* m,
//     const char* export_name) {
// }

JSModuleDef* taro_js_new_c_module(
    JSContext* ctx,
    const char* name_str,
    JSModuleInitFunc* func) {
  return JS_NewCModule(ctx, name_str, func);
}

/* create a C module */
JSModuleDef* taro_js_new_c_module(
    JSContext* ctx,
    const char* name_str,
    JSModuleInitDataFunc* func,
    void* opaque) {
  JSModuleDef* m;
  JSAtom name;
  name = JS_NewAtom(ctx, name_str);
  if (name == JS_ATOM_NULL)
    return NULL;
  m = js_new_module_def(ctx, name);
  m->init_data_func = func;
  m->init_data_opaque = opaque;
  return m;
}

/* Set module name */
int taro_js_set_module_name(JSContext* ctx, JSModuleDef* m, const char* name) {
  JSAtom filename = JS_NewAtom(ctx, name);
  if (filename == JS_ATOM_NULL)
    return -1;
  JS_FreeAtom(ctx, m->module_name);
  m->module_name = filename;

  auto fb = (JSFunctionBytecode*)JS_VALUE_GET_PTR(m->func_obj);
  return taro_js_set_function_bytecode_name(ctx, fb, name);
}

/* Set function bytecode name */
int taro_js_set_function_bytecode_name(
    JSContext* ctx,
    JSFunctionBytecode* fb,
    const char* name) {
  if (fb) {
    JSAtom filename = JS_NewAtom(ctx, name);
    if (filename == JS_ATOM_NULL)
      return -1;
    fb->debug.filename = filename;

    for (int i = 0; i < fb->cpool_count; i++) {
      JSValue val = fb->cpool[i];
      if (JS_VALUE_GET_TAG(val) == JS_TAG_FUNCTION_BYTECODE) {
        auto fb1 = (JSFunctionBytecode*)JS_VALUE_GET_PTR(val);
        taro_js_set_function_bytecode_name(ctx, fb1, name);
      }
    }
  }

  return 0;
}

void taro_js_free_module_def(JSContext* ctx, JSModuleDef* m) {
  JS_FreeValue(ctx, JS_MKPTR(JS_TAG_MODULE, m));
}

void taro_js_free_module_def(JSRuntime* rt, JSModuleDef* m) {
  js_free_module_def(rt, m);
}
