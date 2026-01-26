/*
 * QuickJS Javascript Engine
 *
 * Copyright (c) 2017-2025 Fabrice Bellard
 * Copyright (c) 2017-2025 Charlie Gordon
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

#pragma once

#include "QuickJS/quickjs.h"
#include "object.h"
#include "types.h"

typedef struct JSResolveEntry {
  JSModuleDef* module;
  JSAtom name;
} JSResolveEntry;

typedef struct JSResolveState {
  JSResolveEntry* array;
  int size;
  int count;
} JSResolveState;

#ifdef __cplusplus
extern "C" {
#endif

/* load the dependencies of the module 'obj'. Useful when JS_ReadObject()
  returns a module. */
int JS_ResolveModule(JSContext* ctx, JSValueConst obj);

/* C module definition */

JSModuleDef*
JS_NewCModule(JSContext* ctx, const char* name_str, JSModuleInitFunc* func);

/* can only be called before the module is instantiated */
int JS_AddModuleExport(JSContext* ctx, JSModuleDef* m, const char* name_str);
int JS_AddModuleExportList(
    JSContext* ctx,
    JSModuleDef* m,
    const JSCFunctionListEntry* tab,
    int len);
/* can only be called after the module is instantiated */
int JS_SetModuleExport(
    JSContext* ctx,
    JSModuleDef* m,
    const char* export_name,
    JSValue val);
int JS_SetModuleExportList(
    JSContext* ctx,
    JSModuleDef* m,
    const JSCFunctionListEntry* tab,
    int len);
/* associate a JSValue to a C module */
int JS_SetModulePrivateValue(JSContext* ctx, JSModuleDef* m, JSValue val);
JSValue JS_GetModulePrivateValue(JSContext* ctx, JSModuleDef* m);

/* 'name' is freed */
JSModuleDef* js_new_module_def(JSContext* ctx, JSAtom name);

void js_mark_module_def(JSRuntime* rt, JSModuleDef* m, JS_MarkFunc* mark_func);

int add_req_module_entry(JSContext* ctx, JSModuleDef* m, JSAtom module_name);

JSExportEntry*
find_export_entry(JSContext* ctx, JSModuleDef* m, JSAtom export_name);

char* js_default_module_normalize_name(
    JSContext* ctx,
    const char* base_name,
    const char* name);

JSModuleDef* js_find_loaded_module(JSContext* ctx, JSAtom name);

/* return NULL in case of exception (e.g. module could not be loaded) */
JSModuleDef* js_host_resolve_imported_module(
    JSContext* ctx,
    const char* base_cname,
    const char* cname1,
    JSValueConst attributes);

JSModuleDef* js_host_resolve_imported_module_atom(
    JSContext* ctx,
    JSAtom base_module_name,
    JSAtom module_name1,
    JSValueConst attributes);

int js_create_module_function(JSContext* ctx, JSModuleDef* m);

/* Load all the required modules for module 'm' */
int js_resolve_module(JSContext* ctx, JSModuleDef* m);

/* Prepare a module to be executed by resolving all the imported
   variables. */
int js_link_module(JSContext* ctx, JSModuleDef* m);

/* Run the <eval> function of the module and of all its requested
   modules. */
JSValue js_evaluate_module(JSContext* ctx, JSModuleDef* m);

JSValue
js_dynamic_import(JSContext* ctx, JSValueConst specifier, JSValueConst options);

JSValue JS_NewModuleValue(JSContext* ctx, JSModuleDef* m);

#ifdef __cplusplus
} /* end of extern "C" */
#endif
