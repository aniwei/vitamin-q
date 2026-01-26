#include "QuickJS/extension/taro_js_module.h"

#include <string>

#include "./settup.h"

static int test_module_init(JSContext* ctx, JSModuleDef* m) {
  taro_js_set_module_export(ctx, m, "testValue", JS_NewInt32(ctx, 42));

  JSValue func = JS_NewCFunction(
      ctx,
      [](JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
          -> JSValue {
        return JS_NewInt32(ctx, argc > 0 ? JS_VALUE_GET_INT(argv[0]) * 2 : 0);
      },
      "testFunction",
      1);
  taro_js_set_module_export(ctx, m, "testFunction", func);

  taro_js_set_module_export(
      ctx, m, "TEST_CONSTANT", JS_NewString(ctx, "Hello from C module"));

  return 0;
}

TEST(TaroJSModuleTest, CreateCModule) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  JSModuleDef* m = taro_js_new_c_module(ctx, "testModule", test_module_init);
  ASSERT_NE(m, nullptr);

  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSModuleTest, ModuleExportFunctions) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  JSModuleDef* m = taro_js_new_c_module(ctx, "testModule", test_module_init);
  ASSERT_NE(m, nullptr);

  int res = taro_js_add_module_export(ctx, m, "testValue");
  EXPECT_EQ(res, 0);
  res = taro_js_add_module_export(ctx, m, "testFunction");
  EXPECT_EQ(res, 0);
  res = taro_js_add_module_export(ctx, m, "TEST_CONSTANT");
  EXPECT_EQ(res, 0);

  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSModuleTest, ResolveJSModule) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  const char* js_module_code =
      "export const testValue = 42;\n"
      "export function test() { return testValue; }";

  JSValue module_val = JS_Eval(
      ctx,
      js_module_code,
      strlen(js_module_code),
      "test_module.js",
      JS_EVAL_TYPE_MODULE);

  if (!taro_is_exception(module_val)) {
    int res = taro_js_resolve_module(ctx, module_val);
    EXPECT_EQ(res, 0);
  }

  JS_FreeValue(ctx, module_val);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSModuleTest, HostResolveImportedModule) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  JSModuleDef* resolved = taro_js_host_resolve_imported_module(
      ctx, "base_module.js", "imported_module.js");

  if (resolved != NULL) {
    int res = taro_js_resolve_module(ctx, resolved);
    EXPECT_EQ(res, 0);
  }

  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}
