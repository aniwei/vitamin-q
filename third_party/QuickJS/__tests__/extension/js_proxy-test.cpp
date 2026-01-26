#include "QuickJS/extension/taro_js_proxy.h"

#include "./settup.h"

TEST(TaroJSProxyTest, BasicProxyCreation) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  // 创建目标对象
  JSValue target = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, target, "value", JS_NewInt32(ctx, 42));

  // 创建处理器对象
  JSValue handler = JS_NewObject(ctx);

  // 创建代理
  JSValue proxy = taro_js_proxy_constructor(ctx, target, handler);

  // 验证代理创建成功
  EXPECT_TRUE(taro_is_object(proxy));

  // 测试代理透明传递属性访问
  JSValue value = JS_GetPropertyStr(ctx, proxy, "value");
  EXPECT_EQ(JSToInt32(ctx, value), 42);

  JS_FreeValue(ctx, value);
  JS_FreeValue(ctx, proxy);
  JS_FreeValue(ctx, handler);
  JS_FreeValue(ctx, target);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSProxyTest, ProxyWithGetTrap) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  // 创建目标对象
  JSValue target = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, target, "originalValue", JS_NewInt32(ctx, 42));

  // 创建处理器对象，带有 get 陷阱
  JSValue handler = JS_NewObject(ctx);

  // 添加 get 陷阱函数
  JSValue get_func = EvalJS(
      ctx,
      "(function(target, prop) {\n"
      "  if (prop === 'value') return 100\n"
      "  return target[prop]\n"
      "})\n");
  JS_SetPropertyStr(ctx, handler, "get", get_func);

  // 创建代理
  JSValue proxy = taro_js_proxy_constructor(ctx, target, handler);

  // 测试通过陷阱拦截的属性
  JSValue intercepted_value = JS_GetPropertyStr(ctx, proxy, "value");
  EXPECT_EQ(JSToInt32(ctx, intercepted_value), 100);

  // 测试正常传递的属性
  JSValue original_value = JS_GetPropertyStr(ctx, proxy, "originalValue");
  EXPECT_EQ(JSToInt32(ctx, original_value), 42);

  JS_FreeValue(ctx, intercepted_value);
  JS_FreeValue(ctx, original_value);
  JS_FreeValue(ctx, proxy);
  JS_FreeValue(ctx, handler);
  JS_FreeValue(ctx, target);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSProxyTest, ProxyTarget) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  // 创建目标对象
  JSValue target = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, target, "id", JS_NewString(ctx, "target-object"));

  // 创建处理器对象
  JSValue handler = JS_NewObject(ctx);

  // 创建代理
  JSValue proxy = taro_js_proxy_constructor(ctx, target, handler);

  // 使用 taro_js_proxy_target 获取代理的目标对象
  JSValue retrieved_target = taro_js_proxy_target(ctx, proxy);

  // 验证返回的是正确的目标对象
  JSValue id = JS_GetPropertyStr(ctx, retrieved_target, "id");
  std::string id_str = JSToString(ctx, id);
  EXPECT_EQ(id_str, "target-object");

  // 验证目标对象和获取的目标对象是相同的
  EXPECT_TRUE(JS_StrictEq(ctx, target, retrieved_target));

  JS_FreeValue(ctx, id);
  JS_FreeValue(ctx, retrieved_target);
  JS_FreeValue(ctx, proxy);
  JS_FreeValue(ctx, handler);
  JS_FreeValue(ctx, target);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSProxyTest, ProxyWithSetTrap) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  // 创建目标对象
  JSValue target = JS_NewObject(ctx);

  // 创建处理器对象，带有 set 陷阱
  JSValue handler = JS_NewObject(ctx);

  // 添加 set 陷阱函数 - 所有设置的值都会加倍
  JSValue set_func = EvalJS(
      ctx,
      "(function(target, prop, value) {\n"
      "  if (typeof value === 'number') {\n"
      "    target[prop] = value * 2\n"
      "  } else {\n"
      "    target[prop] = value\n"
      "  }\n"
      "  return true\n"
      "})\n");
  JS_SetPropertyStr(ctx, handler, "set", set_func);

  // 创建代理
  JSValue proxy = taro_js_proxy_constructor(ctx, target, handler);

  // 通过代理设置属性
  JS_SetPropertyStr(ctx, proxy, "number", JS_NewInt32(ctx, 50));
  JS_SetPropertyStr(ctx, proxy, "text", JS_NewString(ctx, "hello"));

  // 验证陷阱逻辑是否生效
  JSValue number_value = JS_GetPropertyStr(ctx, target, "number");
  EXPECT_EQ(JSToInt32(ctx, number_value), 100); // 应该是 50 * 2

  JSValue text_value = JS_GetPropertyStr(ctx, target, "text");
  std::string text_str = JSToString(ctx, text_value);
  EXPECT_EQ(text_str, "hello"); // 字符串应该不变

  JS_FreeValue(ctx, number_value);
  JS_FreeValue(ctx, text_value);
  JS_FreeValue(ctx, proxy);
  JS_FreeValue(ctx, handler);
  JS_FreeValue(ctx, target);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSProxyTest, EdgeCases) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  // 测试非对象作为目标
  JSValue number_target = JS_NewInt32(ctx, 42);
  JSValue empty_handler = JS_NewObject(ctx);

  JSValue invalid_proxy =
      taro_js_proxy_constructor(ctx, number_target, empty_handler);
  // 应当抛出类型错误，所以结果应该是异常值
  EXPECT_TRUE(taro_is_exception(invalid_proxy));

  // 清理可能的异常
  JS_GetException(ctx);

  // 测试从非代理对象获取目标
  JSValue regular_obj = JS_NewObject(ctx);
  JSValue retrieval_result = taro_js_proxy_target(ctx, regular_obj);
  // 从非代理对象获取目标应该返回异常
  EXPECT_TRUE(taro_is_exception(retrieval_result));

  // 清理可能的异常
  JS_GetException(ctx);

  // 测试正确的代理对象
  JSValue valid_target = JS_NewObject(ctx);
  JSValue valid_proxy =
      taro_js_proxy_constructor(ctx, valid_target, empty_handler);

  // 从有效代理获取目标
  JSValue target_result = taro_js_proxy_target(ctx, valid_proxy);
  EXPECT_TRUE(JS_StrictEq(ctx, target_result, valid_target));

  JS_FreeValue(ctx, target_result);
  JS_FreeValue(ctx, valid_proxy);
  JS_FreeValue(ctx, valid_target);
  JS_FreeValue(ctx, retrieval_result);
  JS_FreeValue(ctx, regular_obj);
  JS_FreeValue(ctx, invalid_proxy);
  JS_FreeValue(ctx, empty_handler);
  JS_FreeValue(ctx, number_target);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSProxyTest, NestedProxies) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  // 创建最内层目标对象
  JSValue inner_target = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, inner_target, "value", JS_NewInt32(ctx, 1));

  // 创建第一层代理
  JSValue inner_handler = JS_NewObject(ctx);
  // 添加将值加倍的 get 陷阱
  JSValue inner_get_func = EvalJS(
      ctx,
      "(function(target, prop) {\n"
      "  const val = target[prop]\n"
      "  if (typeof val === 'number') return val * 2\n"
      "  return val\n"
      "})\n");
  JS_SetPropertyStr(
      ctx, inner_handler, "get", JS_DupValue(ctx, inner_get_func));

  JSValue inner_proxy =
      taro_js_proxy_constructor(ctx, inner_target, inner_handler);

  // 创建第二层代理，目标是第一层代理
  JSValue outer_handler = JS_NewObject(ctx);
  // 添加将值加3的 get 陷阱
  JSValue outer_get_func = EvalJS(
      ctx,
      "(function(target, prop) {\n"
      "  const val = target[prop]\n"
      "  if (typeof val === 'number') return val + 3\n"
      "  return val\n"
      "})\n");
  JS_SetPropertyStr(
      ctx, outer_handler, "get", JS_DupValue(ctx, outer_get_func));

  JSValue outer_proxy =
      taro_js_proxy_constructor(ctx, inner_proxy, outer_handler);

  // 测试嵌套代理
  // 最内层值是 1，经过内层代理变成 1*2=2，经过外层代理变成 2+3=5
  JSValue result = JS_GetPropertyStr(ctx, outer_proxy, "value");
  EXPECT_EQ(JSToInt32(ctx, result), 5);

  // 测试 taro_js_proxy_target 获取嵌套代理的目标
  JSValue outer_target = taro_js_proxy_target(ctx, outer_proxy);
  // 外层代理的目标应该是内层代理
  EXPECT_TRUE(JS_StrictEq(ctx, outer_target, inner_proxy));

  // 再次获取内层代理的目标
  JSValue retrieved_inner_target = taro_js_proxy_target(ctx, outer_target);
  // 内层代理的目标应该是最内层目标对象
  EXPECT_TRUE(JS_StrictEq(ctx, retrieved_inner_target, inner_target));

  JS_FreeValue(ctx, retrieved_inner_target);
  JS_FreeValue(ctx, outer_target);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, outer_proxy);
  JS_FreeValue(ctx, outer_get_func);
  JS_FreeValue(ctx, outer_handler);
  JS_FreeValue(ctx, inner_proxy);
  JS_FreeValue(ctx, inner_get_func);
  JS_FreeValue(ctx, inner_handler);
  JS_FreeValue(ctx, inner_target);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}
