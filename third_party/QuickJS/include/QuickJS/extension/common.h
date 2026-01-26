#pragma once

#include "QuickJS/common.h"
#include "QuickJS/config.h"

#define JS_CONST_UNINITIALIZED ((JSValueConst)JS_MKVAL(JS_TAG_UNINITIALIZED, 0))

typedef void JSValueFreeRecall(JSRuntime* rt, JSValue* v, void* fun_context);
void JS_SetValueFreeRecall(
    JSRuntime* rt,
    JSValueFreeRecall* fun,
    void* fun_context);
void JS_MaskValueFreeRecall(JSValue* v, JS_BOOL flag);

// mode: 0: disable, 1: connect, 2: wait for connection
int JS_SetDebugger(JSContext* ctx, int mode, const char* address);

// mark filename can be debugger
void js_debugger_mark_file(JSContext* ctx, const char* filename);

#if QUICKJS_DEBUG

void js_debugger_push_log_to_front_page(
    JSContext* context,
    const char* log_str);
// end internal api functions


#define JS_DEBUGGER_FRONT_LOG(ctx, log) \
  js_debugger_push_log_to_front_page(ctx, log)
#else
#define JS_DEBUGGER_FRONT_LOG(ctx, log)
#endif

typedef struct {
  JSModuleDef* m;
  const char* name;
} JSModuleInfo;

typedef struct {
  int len;
  JSModuleInfo* arr;
} JSModuleInfoArray;

JSModuleInfoArray JS_GetAllModulesInfo(JSContext* ctx);
void JS_FreeAllModulesInfo(JSContext* ctx, JSModuleInfoArray infos);
