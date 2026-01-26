#include "QuickJS/extension/taro_js_promise.h"

#include "./settup.h"

// 辅助函数：执行 Promise 微任务队列直到稳定
static void execute_pending_jobs(JSContext* ctx) {
  JSContext* ctx1;
  int err;

  // 执行所有待处理的 Promise 任务
  for (;;) {
    err = JS_ExecutePendingJob(JS_GetRuntime(ctx), &ctx1);
    if (err <= 0) {
      if (err < 0) {
        JSValue exception = JS_GetException(ctx1);
        js_print_exception(ctx1, exception);
        JS_FreeValue(ctx1, exception);
      }
      break;
    }
  }
}

// 辅助函数：检查 Promise 状态
static bool check_promise_state(
    JSContext* ctx,
    JSValue promise,
    JSPromiseStateEnum expected_state) {
  JSPromiseStateEnum state = JS_PromiseState(ctx, promise);
  return state == expected_state;
}

// 辅助函数：获取 Promise 结果并比较
static bool
check_promise_result(JSContext* ctx, JSValue promise, JSValue expected_result) {
  JSValue result = JS_PromiseResult(ctx, promise);
  bool is_equal = JS_StrictEq(ctx, result, expected_result);
  JS_FreeValue(ctx, result);
  return is_equal;
}

TEST(TaroJSPromiseTest, Constructor) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 定义并编译一个执行器函数
  JSValue executor = EvalJS(ctx, "(resolve, reject) => { resolve(42); }");
  ASSERT_FALSE(taro_is_exception(executor));

  // 使用构造函数创建一个 Promise
  JSValue promise = taro_js_promise_constructor(ctx, executor, JS_UNDEFINED);
  ASSERT_FALSE(taro_is_exception(promise));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证 Promise 状态和结果
  EXPECT_TRUE(check_promise_state(ctx, promise, JS_PROMISE_FULFILLED));
  EXPECT_TRUE(check_promise_result(ctx, promise, JS_NewInt32(ctx, 42)));

  // 清理
  JS_FreeValue(ctx, executor);
  JS_FreeValue(ctx, promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, Resolve) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个已解决的 Promise
  JSValue value = JS_NewInt32(ctx, 100);
  JSValue promise = taro_js_promise_resolve(ctx, value);

  // 验证 Promise 状态和结果
  EXPECT_TRUE(check_promise_state(ctx, promise, JS_PROMISE_FULFILLED));
  EXPECT_TRUE(check_promise_result(ctx, promise, value));

  // 清理
  JS_FreeValue(ctx, value);
  JS_FreeValue(ctx, promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, Reject) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个已拒绝的 Promise
  JSValue reason = JS_NewString(ctx, "Error message");
  JSValue promise = taro_js_promise_reject(ctx, reason);

  // 验证 Promise 状态和结果
  EXPECT_TRUE(check_promise_state(ctx, promise, JS_PROMISE_REJECTED));
  EXPECT_TRUE(check_promise_result(ctx, promise, reason));

  // 清理
  JS_FreeValue(ctx, reason);
  JS_FreeValue(ctx, promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, Then) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个已解决的 Promise
  JSValue value = JS_NewInt32(ctx, 42);
  JSValue promise = taro_js_promise_resolve(ctx, value);

  // 定义并编译一个处理函数
  JSValue handler = EvalJS(ctx, "value => value * 2");
  ASSERT_FALSE(taro_is_exception(handler));

  // 调用 then 方法
  JSValue result_promise = taro_js_promise_then(ctx, handler, promise);
  ASSERT_FALSE(taro_is_exception(result_promise));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证结果 Promise 状态和结果
  EXPECT_TRUE(check_promise_state(ctx, result_promise, JS_PROMISE_FULFILLED));
  EXPECT_TRUE(check_promise_result(ctx, result_promise, JS_NewInt32(ctx, 84)));

  // 清理
  JS_FreeValue(ctx, value);
  JS_FreeValue(ctx, promise);
  JS_FreeValue(ctx, handler);
  JS_FreeValue(ctx, result_promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, ThenChaining) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个已解决的 Promise
  JSValue initial_value = JS_NewInt32(ctx, 10);
  JSValue promise = taro_js_promise_resolve(ctx, initial_value);

  // 第一个处理函数：将值加倍
  JSValue handler1 = EvalJS(ctx, "value => value * 2");
  ASSERT_FALSE(taro_is_exception(handler1));

  // 第二个处理函数：将值加10
  JSValue handler2 = EvalJS(ctx, "value => value + 10");
  ASSERT_FALSE(taro_is_exception(handler2));

  // 链式调用 then
  JSValue promise1 = taro_js_promise_then(ctx, handler1, promise);
  JSValue promise2 = taro_js_promise_then(ctx, handler2, promise1);

  ASSERT_FALSE(taro_is_exception(promise1));
  ASSERT_FALSE(taro_is_exception(promise2));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证结果：10 * 2 + 10 = 30
  EXPECT_TRUE(check_promise_state(ctx, promise2, JS_PROMISE_FULFILLED));
  EXPECT_TRUE(check_promise_result(ctx, promise2, JS_NewInt32(ctx, 30)));

  // 清理
  JS_FreeValue(ctx, initial_value);
  JS_FreeValue(ctx, promise);
  JS_FreeValue(ctx, handler1);
  JS_FreeValue(ctx, handler2);
  JS_FreeValue(ctx, promise1);
  JS_FreeValue(ctx, promise2);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, ThenReturningPromise) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个已解决的 Promise
  JSValue initial_value = JS_NewInt32(ctx, 5);
  JSValue promise = taro_js_promise_resolve(ctx, initial_value);

  // 处理函数：返回一个新的 Promise
  JSValue handler = EvalJS(ctx, "value => Promise.resolve(value * 3)");
  ASSERT_FALSE(taro_is_exception(handler));

  // 调用 then 方法
  JSValue result_promise = taro_js_promise_then(ctx, handler, promise);
  ASSERT_FALSE(taro_is_exception(result_promise));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证结果：5 * 3 = 15
  EXPECT_TRUE(check_promise_state(ctx, result_promise, JS_PROMISE_FULFILLED));
  EXPECT_TRUE(check_promise_result(ctx, result_promise, JS_NewInt32(ctx, 15)));

  // 清理
  JS_FreeValue(ctx, initial_value);
  JS_FreeValue(ctx, promise);
  JS_FreeValue(ctx, handler);
  JS_FreeValue(ctx, result_promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, Catch) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个已拒绝的 Promise
  JSValue reason = JS_NewString(ctx, "Error");
  JSValue promise = taro_js_promise_reject(ctx, reason);

  // 定义并编译一个处理函数
  JSValue handler = EvalJS(ctx, "err => 'Caught: ' + err");
  ASSERT_FALSE(taro_is_exception(handler));

  // 调用 catch 方法
  JSValue result_promise = taro_js_promise_catch(ctx, handler, promise);
  ASSERT_FALSE(taro_is_exception(result_promise));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证结果 Promise 状态和结果
  EXPECT_TRUE(check_promise_state(ctx, result_promise, JS_PROMISE_FULFILLED));

  // 清理
  JS_FreeValue(ctx, reason);
  JS_FreeValue(ctx, promise);
  JS_FreeValue(ctx, handler);
  JS_FreeValue(ctx, result_promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, Finally) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个已解决的 Promise
  JSValue value = JS_NewInt32(ctx, 42);
  JSValue promise = taro_js_promise_resolve(ctx, value);

  // 定义并编译一个处理函数
  JSValue handler = EvalJS(ctx, "() => 'Finally called'");
  ASSERT_FALSE(taro_is_exception(handler));

  // 调用 finally 方法
  JSValue result_promise = taro_js_promise_finally(ctx, handler, promise);
  ASSERT_FALSE(taro_is_exception(result_promise));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证结果 Promise 状态和结果 - finally 应该传递原始值
  EXPECT_TRUE(check_promise_state(ctx, result_promise, JS_PROMISE_FULFILLED));
  EXPECT_TRUE(check_promise_result(ctx, result_promise, value));

  // 清理
  JS_FreeValue(ctx, value);
  JS_FreeValue(ctx, promise);
  JS_FreeValue(ctx, handler);
  JS_FreeValue(ctx, result_promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, All) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个 Promise 数组
  JSValue array = JS_NewArray(ctx);

  JSValue p1 = taro_js_promise_resolve(ctx, JS_NewInt32(ctx, 1));
  JSValue p2 = taro_js_promise_resolve(ctx, JS_NewInt32(ctx, 2));
  JSValue p3 = taro_js_promise_resolve(ctx, JS_NewInt32(ctx, 3));

  JS_SetPropertyUint32(ctx, array, 0, p1);
  JS_SetPropertyUint32(ctx, array, 1, p2);
  JS_SetPropertyUint32(ctx, array, 2, p3);

  // 调用 Promise.all
  JSValue result_promise = taro_js_promise_all(ctx, array);
  ASSERT_FALSE(taro_is_exception(result_promise));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证结果 Promise 状态
  EXPECT_TRUE(check_promise_state(ctx, result_promise, JS_PROMISE_FULFILLED));

  // 清理
  JS_FreeValue(ctx, array);
  JS_FreeValue(ctx, result_promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, Race) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个 Promise 数组
  JSValue array = JS_NewArray(ctx);

  JSValue p1 = taro_js_promise_resolve(ctx, JS_NewInt32(ctx, 1));
  JSValue p2 = taro_js_promise_resolve(ctx, JS_NewInt32(ctx, 2));

  JS_SetPropertyUint32(ctx, array, 0, p1);
  JS_SetPropertyUint32(ctx, array, 1, p2);

  // 调用 Promise.race
  JSValue result_promise = taro_js_promise_race(ctx, array);
  ASSERT_FALSE(taro_is_exception(result_promise));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证结果 Promise 状态
  EXPECT_TRUE(check_promise_state(ctx, result_promise, JS_PROMISE_FULFILLED));

  // 清理
  JS_FreeValue(ctx, array);
  JS_FreeValue(ctx, result_promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, AllSettled) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个 Promise 数组
  JSValue array = JS_NewArray(ctx);

  JSValue p1 = taro_js_promise_resolve(ctx, JS_NewInt32(ctx, 1));
  JSValue p2 = taro_js_promise_reject(ctx, JS_NewString(ctx, "Error"));

  JS_SetPropertyUint32(ctx, array, 0, p1);
  JS_SetPropertyUint32(ctx, array, 1, p2);

  // 调用 Promise.allSettled
  JSValue result_promise = taro_js_promise_all_settled(ctx, array);
  ASSERT_FALSE(taro_is_exception(result_promise));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证结果 Promise 状态
  EXPECT_TRUE(check_promise_state(ctx, result_promise, JS_PROMISE_FULFILLED));

  // 清理
  JS_FreeValue(ctx, array);
  JS_FreeValue(ctx, result_promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, Any) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个 Promise 数组
  JSValue array = JS_NewArray(ctx);

  JSValue p1 = taro_js_promise_reject(ctx, JS_NewString(ctx, "Error 1"));
  JSValue p2 = taro_js_promise_resolve(ctx, JS_NewInt32(ctx, 2));

  JS_SetPropertyUint32(ctx, array, 0, p1);
  JS_SetPropertyUint32(ctx, array, 1, p2);

  // 调用 Promise.any
  JSValue result_promise = taro_js_promise_any(ctx, array);
  ASSERT_FALSE(taro_is_exception(result_promise));

  // 执行微任务队列
  execute_pending_jobs(ctx);

  // 验证结果 Promise 状态
  EXPECT_TRUE(check_promise_state(ctx, result_promise, JS_PROMISE_FULFILLED));

  // 清理
  JS_FreeValue(ctx, array);
  JS_FreeValue(ctx, result_promise);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, WithResolvers) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 调用 Promise.withResolvers
  JSValue result = taro_js_promise_with_resolvers(ctx, JS_UNDEFINED);
  ASSERT_FALSE(taro_is_exception(result));

  // 验证返回值是否是对象
  EXPECT_TRUE(taro_is_object(result));

  // 检查对象是否有预期的属性
  JSValue promise = JS_GetPropertyStr(ctx, result, "promise");
  JSValue resolve = JS_GetPropertyStr(ctx, result, "resolve");
  JSValue reject = JS_GetPropertyStr(ctx, result, "reject");

  EXPECT_FALSE(taro_is_exception(promise));
  EXPECT_FALSE(taro_is_exception(resolve));
  EXPECT_FALSE(taro_is_exception(reject));

  EXPECT_TRUE(taro_is_object(promise));
  EXPECT_TRUE(taro_is_function(ctx, resolve));
  EXPECT_TRUE(taro_is_function(ctx, reject));

  // 清理
  JS_FreeValue(ctx, promise);
  JS_FreeValue(ctx, resolve);
  JS_FreeValue(ctx, reject);
  JS_FreeValue(ctx, result);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSPromiseTest, CustomTarget) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个自定义的 Promise 构造函数
  JSValue CustomPromise = EvalJS(
      ctx,
      "class CustomPromise extends Promise {\n"
      "  constructor(executor) {\n"
      "    super(executor);\n"
      "    this.custom = true;\n"
      "  }\n"
      "} CustomPromise;\n");
  ASSERT_FALSE(taro_is_exception(CustomPromise));

  // 使用自定义构造函数作为 target
  JSValue value = JS_NewInt32(ctx, 100);
  JSValue promise = taro_js_promise_resolve(ctx, value, CustomPromise);
  ASSERT_FALSE(taro_is_exception(promise));

  // 检查是否是 CustomPromise 的实例
  JSValue check_fn = EvalJS(ctx, "p => p instanceof CustomPromise");

  JSValue args[1] = {promise};
  JSValue result = JS_Call(ctx, check_fn, JS_UNDEFINED, 1, args);

  EXPECT_TRUE(JS_ToBool(ctx, result));

  // 清理
  JS_FreeValue(ctx, value);
  JS_FreeValue(ctx, promise);
  JS_FreeValue(ctx, CustomPromise);
  JS_FreeValue(ctx, check_fn);
  JS_FreeValue(ctx, result);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}
