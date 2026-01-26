#include "../core/types.h"
#include "QuickJS/extension/debugger.h"
#include "QuickJS/quickjs.h"

void JS_SetValueFreeRecall(
    JSRuntime* rt,
    JSValueFreeRecall* fun,
    void* fun_context) {
  rt->free_recall_fun = fun;
  rt->free_recall_fun_context = fun_context;
}

void JS_MaskValueFreeRecall(JSValue* v, JS_BOOL flag) {
  if (JS_VALUE_GET_TAG(*v) == JS_TAG_OBJECT) {
    JS_VALUE_GET_OBJ(*v)->free_recall = flag;
  }
}

/* Extension API */

int JS_SetDebugger(JSContext* ctx, int mode, const char* address) {
#if QUICKJS_ENABLE_DEBUGGER
  return js_debugger_set_mode(ctx, mode, address);
#else
  return 0;
#endif
}

void js_debugger_mark_file(JSContext* ctx, const char* filename) {
#if QUICKJS_ENABLE_DEBUGGER
  js_debugger_report_load_event(ctx, filename);
#endif
}

static JSModuleInfo JS_GetModuleInfo(JSContext* ctx, JSModuleDef* m) {
  JSModuleInfo ret_info;
  ret_info.m = m;
  ret_info.name = JS_AtomToCString(ctx, m->module_name);
  return ret_info;
}

JSModuleInfoArray JS_GetAllModulesInfo(JSContext* ctx) {
  JSModuleInfoArray ret_arr;
  struct list_head* el;
  JSModuleDef* m;
  ret_arr.len = 0;
  ret_arr.arr = NULL;

  /* first look at the loaded modules */
  list_for_each(el, &ctx->loaded_modules) {
    ret_arr.len++;
  }
  if (ret_arr.len == 0) {
    return ret_arr;
  }

  int alloc_size = sizeof(JSModuleInfo) * ret_arr.len;

  ret_arr.arr = static_cast<JSModuleInfo*>(js_malloc(ctx, alloc_size));
  int i = 0;
  list_for_each(el, &ctx->loaded_modules) {
    m = list_entry(el, JSModuleDef, link);
    *(ret_arr.arr + i) = JS_GetModuleInfo(ctx, m);
    i++;
  }
  return ret_arr;
}

static void JS_FreeModuleInfo(JSContext* ctx, JSModuleInfo info) {
  JS_FreeCString(ctx, info.name);
}

void JS_FreeAllModulesInfo(JSContext* ctx, JSModuleInfoArray infos) {
  for (int i = 0; i < infos.len; i++) {
    JS_FreeModuleInfo(ctx, infos.arr[i]);
  }
  js_free(ctx, infos.arr);
  infos.arr = NULL;
  infos.len = 0;
}
