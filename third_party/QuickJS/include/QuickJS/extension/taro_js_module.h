#pragma once

#include "QuickJS/common.h"
#include "QuickJS/extension/builtins.h"

#ifdef __cplusplus

JSModuleDef* taro_js_host_resolve_imported_module(
    JSContext* ctx,
    const char* base_cname,
    const char* cname1,
    JSValueConst attributes = JS_UNDEFINED);

int taro_js_resolve_module(JSContext* ctx, JSValueConst obj);
int taro_js_resolve_module(JSContext* ctx, JSModuleDef* m);

JSModuleDef* taro_js_find_loaded_module(JSContext* ctx, JSAtom name);

int taro_js_add_module_export(
    JSContext* ctx,
    JSModuleDef* m,
    const char* export_name);

int taro_js_set_module_export(
    JSContext* ctx,
    JSModuleDef* m,
    const char* export_name,
    JSValue val);

// JSValue taro_js_get_module_export(
//     JSContext* ctx,
//     JSModuleDef* m,
//     const char* export_name);

JSModuleDef* taro_js_new_c_module(
    JSContext* ctx,
    const char* name_str,
    JSModuleInitFunc* func);

JSModuleDef* taro_js_new_c_module(
    JSContext* ctx,
    const char* name_str,
    JSModuleInitDataFunc* func,
    void* opaque);

/* Expose the c function to the outside */
int taro_js_set_module_name(
    JSContext* ctx,
    JSModuleDef* m,
    const char* module_name);

typedef struct JSFunctionBytecode JSFunctionBytecode;
int taro_js_set_function_bytecode_name(
    JSContext* ctx,
    JSFunctionBytecode* fb,
    const char* name);

void taro_js_free_module_def(JSContext* ctx, JSModuleDef* m);
void taro_js_free_module_def(JSRuntime* rt, JSModuleDef* m);

#endif
