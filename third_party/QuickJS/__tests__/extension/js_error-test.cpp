#include "QuickJS/extension/taro_js_error.h"

#include "./settup.h"

// 测试不同类型的错误
TEST(TaroJSErrorTest, DifferentErrorTypes) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  struct TestCase {
    const char* code;
    const char* expected;
  };

  TestCase tests[] = {
      {"new Error('General error')", "Error: General error"},
      {"new TypeError('Type error')", "TypeError: Type error"},
      {"new ReferenceError('Reference error')",
       "ReferenceError: Reference error"},
      {"new SyntaxError('Syntax error')", "SyntaxError: Syntax error"},
      {"new RangeError('Range error')", "RangeError: Range error"},
      {"new URIError('URI error')", "URIError: URI error"}};

  for (const auto& test : tests) {
    JSValue error = EvalJS(ctx, test.code);
    ASSERT_FALSE(taro_is_exception(error));

    JSValue errorStr = taro_js_error_to_string(ctx, error);
    ASSERT_FALSE(taro_is_exception(errorStr));

    std::string result = JSToString(ctx, errorStr);
    EXPECT_EQ(result, test.expected);

    JS_FreeValue(ctx, errorStr);
    JS_FreeValue(ctx, error);
  }

  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试自定义错误类
TEST(TaroJSErrorTest, CustomErrorClass) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  JSValue error = EvalJS(
      ctx,
      "class CustomError extends Error {\n"
      "  constructor(message) {\n"
      "    super(message);\n"
      "    this.name = 'CustomError';\n"
      "  }\n"
      "}\n"
      "new CustomError('Custom error');");
  ASSERT_FALSE(taro_is_exception(error));

  JSValue errorStr = taro_js_error_to_string(ctx, error);
  ASSERT_FALSE(taro_is_exception(errorStr));

  std::string result = JSToString(ctx, errorStr);
  EXPECT_EQ(result, "CustomError: Custom error");

  JS_FreeValue(ctx, errorStr);
  JS_FreeValue(ctx, error);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试空错误消息
TEST(TaroJSErrorTest, EmptyErrorMessage) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 错误没有消息
  JSValue error = EvalJS(ctx, "new Error()");
  ASSERT_FALSE(taro_is_exception(error));

  JSValue errorStr = taro_js_error_to_string(ctx, error);
  ASSERT_FALSE(taro_is_exception(errorStr));

  std::string result = JSToString(ctx, errorStr);
  EXPECT_EQ(result, "Error"); // 没有消息时应该只有错误名称

  JS_FreeValue(ctx, errorStr);
  JS_FreeValue(ctx, error);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试自定义错误属性
TEST(TaroJSErrorTest, CustomErrorProperties) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  JSValue error = EvalJS(
      ctx,
      "const e = new Error('With custom props');\n"
      "e.code = 'ERR_CUSTOM';\n"
      "e.statusCode = 500;\n"
      "e;");
  ASSERT_FALSE(taro_is_exception(error));

  // 标准 toString 只会显示 name 和 message
  JSValue errorStr = taro_js_error_to_string(ctx, error);
  ASSERT_FALSE(taro_is_exception(errorStr));

  std::string result = JSToString(ctx, errorStr);
  EXPECT_EQ(result, "Error: With custom props");

  JS_FreeValue(ctx, errorStr);
  JS_FreeValue(ctx, error);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试非错误对象输入
TEST(TaroJSErrorTest, NonErrorInput) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 普通对象，不是错误
  JSValue obj =
      EvalJS(ctx, "({name: 'NotAnError', message: 'Just a message'})");
  ASSERT_FALSE(taro_is_exception(obj));

  // 尝试使用错误转字符串功能
  JSValue str = taro_js_error_to_string(ctx, obj);

  // 由于它不是错误但有必要属性，可能会输出类似错误的字符串
  if (!taro_is_exception(str)) {
    std::string result = JSToString(ctx, str);
    EXPECT_EQ(result, "NotAnError: Just a message");
    JS_FreeValue(ctx, str);
  }

  JS_FreeValue(ctx, obj);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试 taro_js_throw 和 taro_js_has_exception 函数
TEST(TaroJSErrorTest, ThrowAndHasException) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个错误对象
  JSValue error = taro_js_new_error(ctx);
  JS_DefinePropertyValue(
      ctx,
      error,
      JS_ATOM_message,
      JS_NewString(ctx, "Test error message"),
      JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);

  // 确认当前没有异常
  EXPECT_FALSE(taro_js_has_exception(ctx));

  // 抛出异常
  JSValue result = taro_js_throw(ctx, error);

  // 检查返回值应该是 JS_EXCEPTION
  EXPECT_TRUE(taro_is_exception(result));

  // 确认现在有异常
  EXPECT_TRUE(taro_js_has_exception(ctx));

  // 不要调用 JS_FreeValue(ctx, error)，因为错误已经被传递给 runtime
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试 taro_js_get_exception 函数
TEST(TaroJSErrorTest, GetException) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 先抛出一个异常
  JSValue originalError =
      taro_js_new_error(ctx, JSErrorEnum::JS_EVAL_ERROR, "Test exception");
  taro_js_throw(ctx, originalError);
  EXPECT_TRUE(taro_js_has_exception(ctx));

  // 获取异常
  JSValue exception = taro_js_get_exception(ctx);

  // 验证获取异常后，异常状态应该被清除
  EXPECT_FALSE(taro_js_has_exception(ctx));

  // 验证获取的异常对象
  JSAtom messageAtom = JS_NewAtom(ctx, "message");
  JSValue message = JS_GetProperty(ctx, exception, messageAtom);
  JS_FreeAtom(ctx, messageAtom);

  std::string messageStr = JSToString(ctx, message);
  EXPECT_EQ(messageStr, "Test exception");

  JS_FreeValue(ctx, message);
  JS_FreeValue(ctx, exception);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试 taro_js_new_error 创建基本错误
TEST(TaroJSErrorTest, NewBasicError) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个基本错误
  JSValue error = taro_js_new_error(ctx);
  ASSERT_FALSE(taro_is_exception(error));

  // 验证是否为错误对象
  EXPECT_TRUE(taro_is_error(ctx, error));

  JS_FreeValue(ctx, error);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试使用错误枚举创建不同类型的错误
TEST(TaroJSErrorTest, NewErrorWithEnum) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  struct ErrorTestCase {
    JSErrorEnum errorType;
    const char* message;
    const char* expectedName;
  };

  ErrorTestCase testCases[] = {
      {JS_EVAL_ERROR, "Evaluation failed", "EvalError"},
      {JS_RANGE_ERROR, "Value out of range", "RangeError"},
      {JS_REFERENCE_ERROR, "Invalid reference", "ReferenceError"},
      {JS_SYNTAX_ERROR, "Syntax issue", "SyntaxError"},
      {JS_TYPE_ERROR, "Invalid type", "TypeError"},
      {JS_URI_ERROR, "Invalid URI", "URIError"}};

  for (const auto& testCase : testCases) {
    JSValue error = taro_js_new_error(
        ctx,
        testCase.errorType,
        "%s: %s",
        testCase.expectedName,
        testCase.message);

    ASSERT_FALSE(taro_is_exception(error));

    // 获取错误名称
    JSAtom nameAtom = JS_NewAtom(ctx, "name");
    JSValue name = JS_GetProperty(ctx, error, nameAtom);
    JS_FreeAtom(ctx, nameAtom);

    std::string nameStr = JSToString(ctx, name);
    EXPECT_EQ(nameStr, testCase.expectedName);

    // 获取错误消息
    JSAtom messageAtom = JS_NewAtom(ctx, "message");
    JSValue message = JS_GetProperty(ctx, error, messageAtom);
    JS_FreeAtom(ctx, messageAtom);

    std::string messageStr = JSToString(ctx, message);
    EXPECT_THAT(messageStr, ::testing::HasSubstr(testCase.message));

    JS_FreeValue(ctx, name);
    JS_FreeValue(ctx, message);
    JS_FreeValue(ctx, error);
  }

  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

JSValue createErrorWithStackTrace(JSContext* ctx, const char* message, ...) {
  va_list args;
  va_start(args, message);
  JSValue error =
      taro_js_new_error(ctx, JS_EVAL_ERROR, message, args, 1);
  va_end(args);
  return error;
}

// 测试带有堆栈跟踪的错误创建
TEST(TaroJSErrorTest, ErrorWithStackTrace) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个带有堆栈跟踪的错误
  const char* message = "Error with stack trace";
  JSValue error = createErrorWithStackTrace(ctx, message);

  ASSERT_FALSE(taro_is_exception(error));

  // 检查错误是否有 stack 属性
  JSAtom stackAtom = JS_NewAtom(ctx, "stack");
  EXPECT_TRUE(JS_HasProperty(ctx, error, stackAtom));

  JS_FreeAtom(ctx, stackAtom);
  JS_FreeValue(ctx, error);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试 JavaScript 执行过程中抛出的错误
TEST(TaroJSErrorTest, JavaScriptErrorHandling) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 执行会抛出错误的 JS 代码
  JSValue result = EvalJS(ctx, "throw new Error('JS thrown error')");

  // 结果应该是异常
  EXPECT_TRUE(taro_is_exception(result));

  // 检查是否有异常
  EXPECT_TRUE(taro_js_has_exception(ctx));

  // 获取异常
  JSValue exception = taro_js_get_exception(ctx);
  ASSERT_FALSE(taro_is_exception(exception));

  // 检查异常消息
  JSAtom messageAtom = JS_NewAtom(ctx, "message");
  JSValue message = JS_GetProperty(ctx, exception, messageAtom);
  JS_FreeAtom(ctx, messageAtom);

  std::string messageStr = JSToString(ctx, message);
  EXPECT_EQ(messageStr, "JS thrown error");

  JS_FreeValue(ctx, message);
  JS_FreeValue(ctx, exception);
  JS_FreeValue(ctx, result);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试异常处理后的恢复
TEST(TaroJSErrorTest, ExceptionRecovery) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 执行会抛出错误的 JS 代码
  JSValue result = EvalJS(ctx, "throw new Error('Recoverable error')");

  // 结果应该是异常
  EXPECT_TRUE(taro_is_exception(result));
  JS_FreeValue(ctx, result);

  // 获取并丢弃异常
  JSValue exception = taro_js_get_exception(ctx);
  JS_FreeValue(ctx, exception);

  // 现在应该可以正常执行代码
  result = EvalJS(ctx, "1+1");
  EXPECT_FALSE(taro_is_exception(result));

  int32_t num;
  EXPECT_TRUE(JS_ToInt32(ctx, &num, result) == 0);
  EXPECT_EQ(num, 2);

  JS_FreeValue(ctx, result);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试多级异常处理
TEST(TaroJSErrorTest, NestedExceptionHandling) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  JSValue result = EvalJS(
      ctx,
      "function level3() { throw new Error('Inner error'); }\n"
      "function level2() { try { level3(); } catch(e) { throw new Error('Mid error: ' + e.message); } }\n"
      "function level1() { try { level2(); } catch(e) { throw new Error('Outer error: ' + e.message); } }\n"
      "level1();");

  // 结果应该是异常
  EXPECT_TRUE(taro_is_exception(result));
  JS_FreeValue(ctx, result);

  // 获取异常
  JSValue exception = taro_js_get_exception(ctx);
  ASSERT_FALSE(taro_is_exception(exception));

  // 检查异常消息应该包含所有层级的错误信息
  JSAtom messageAtom = JS_NewAtom(ctx, "message");
  JSValue message = JS_GetProperty(ctx, exception, messageAtom);
  JS_FreeAtom(ctx, messageAtom);

  std::string messageStr = JSToString(ctx, message);
  EXPECT_THAT(
      messageStr, ::testing::HasSubstr("Outer error: Mid error: Inner error"));

  JS_FreeValue(ctx, message);
  JS_FreeValue(ctx, exception);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试基本错误转字符串
TEST(TaroJSErrorTest, BasicErrorToString) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);

  // 创建一个基本错误
  JSValue error = EvalJS(ctx, "new Error('Basic error message')");
  ASSERT_FALSE(taro_is_exception(error));

  // 转换为字符串
  JSValue errorStr = taro_js_error_to_string(ctx, error);
  ASSERT_FALSE(taro_is_exception(errorStr));

  // 验证结果
  std::string result = JSToString(ctx, errorStr);
  EXPECT_EQ(result, "Error: Basic error message");

  JS_FreeValue(ctx, errorStr);
  JS_FreeValue(ctx, error);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}
