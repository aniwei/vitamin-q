#include "settup.h"

JSRuntime* rt = nullptr;
JSContext* ctx = nullptr;

enum LogLevel { LOG_INFO, LOG_WARNING, LOG_ERROR, LOG_DEBUG };

static std::string
format_console_args(JSContext* ctx, int argc, JSValueConst* argv) {
  std::string output;
  std::string str;

  for (int i = 0; i < argc; i++) {
    if (i != 0)
      output += " ";

    str = JSToString(ctx, argv[i]);
    output += str;
    JS_FreeCString(ctx, str.c_str());
  }

  return output;
}

static void log_message(LogLevel level, const std::string& message) {
  switch (level) {
    case LOG_WARNING:
      LOG(WARNING) << "[JS Console Warning] " << message;
      break;
    case LOG_ERROR:
      LOG(ERROR) << "[JS Console Error] " << message;
      break;
    case LOG_DEBUG:
      VLOG(1) << "[JS Console Debug] " << message;
      break;
    case LOG_INFO:
    default:
      LOG(INFO) << "[JS Console Info] " << message;
  }
}

static JSValue js_console_log_common(
    JSContext* ctx,
    int argc,
    JSValueConst* argv,
    LogLevel level) {
  std::string message = format_console_args(ctx, argc, argv);
  log_message(level, message);
  return JS_UNDEFINED;
}

static JSValue js_console_log(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  return js_console_log_common(ctx, argc, argv, LOG_INFO);
}

static JSValue js_console_warn(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  return js_console_log_common(ctx, argc, argv, LOG_WARNING);
}

static JSValue js_console_error(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  return js_console_log_common(ctx, argc, argv, LOG_ERROR);
}

static JSValue js_console_debug(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  return js_console_log_common(ctx, argc, argv, LOG_DEBUG);
}

// 添加辅助函数到 JS 环境
static void add_helpers(JSContext* ctx) {
  JSValue global_obj, console;

  // 获取全局对象
  global_obj = JS_GetGlobalObject(ctx);

  // 创建 console 对象
  console = JS_NewObject(ctx);
  JS_DefinePropertyValueStr(
      ctx,
      console,
      "log",
      JS_NewCFunction(ctx, js_console_log, "log", 1),
      JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);

  JS_DefinePropertyValueStr(
      ctx,
      console,
      "warn",
      JS_NewCFunction(ctx, js_console_warn, "warn", 1),
      JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);

  JS_DefinePropertyValueStr(
      ctx,
      console,
      "error",
      JS_NewCFunction(ctx, js_console_error, "error", 1),
      JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);

  JS_DefinePropertyValueStr(
      ctx,
      console,
      "debug",
      JS_NewCFunction(ctx, js_console_debug, "debug", 1),
      JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);

  // 常用别名
  JS_DefinePropertyValueStr(
      ctx,
      console,
      "info",
      JS_NewCFunction(ctx, js_console_log, "info", 1),
      JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);

  // 将console对象添加到全局对象中
  JS_DefinePropertyValueStr(
      ctx,
      global_obj,
      "console",
      console,
      JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);

  JS_FreeValue(ctx, global_obj);
}

class GlobalEnvironment : public ::testing::Environment {
 public:
  void SetUp() override {
    rt = JS_NewRuntime();
    if (rt == NULL) {
      LOG(ERROR) << "JS_NewRuntime failure";
      exit(1);
    }
    ctx = JS_NewContext(rt);
    if (ctx == NULL) {
      JS_FreeRuntime(rt);
      LOG(ERROR) << "JS_NewContext failure";
      exit(1);
    }
    add_helpers(ctx);
  }

  void TearDown() override {
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
  }
};

int main(int argc, char** argv) {
  ::google::InitGoogleLogging(argv[0]);
  FLAGS_minloglevel = 0;
  FLAGS_logtostderr = 1;

  ::testing::InitGoogleTest(&argc, argv);
  ::testing::AddGlobalTestEnvironment(new GlobalEnvironment);

  return RUN_ALL_TESTS();
}

/***** Helper *****/

// 帮助函数：运行JS表达式并返回结果
JSValue EvalJS(JSContext* ctx, const char* expr) {
  return JS_Eval(ctx, expr, strlen(expr), "<test>", JS_EVAL_TYPE_GLOBAL);
}

JSValue EvalJS(const char* expr) {
  return EvalJS(ctx, expr);
}

// 帮助函数：将JSValue转换为int
int32_t JSToInt32(JSContext* ctx, JSValue val) {
  int32_t result = 0;
  JS_ToInt32(ctx, &result, val);
  JS_FreeValue(ctx, val);
  return result;
}

int32_t JSToInt32(JSValue val) {
  return JSToInt32(ctx, val);
}

// 帮助函数：将JSValue转换为bool
bool JSToBool(JSContext* ctx, JSValue val) {
  bool result = JS_ToBool(ctx, val);
  JS_FreeValue(ctx, val);
  return result;
}

bool JSToBool(JSValue val) {
  return JSToBool(ctx, val);
}

// 辅助函数 - 获取JS字符串的内容
std::string JSToString(JSContext* ctx, JSValueConst value) {
  if (!taro_is_string(value)) {
    return "";
  }

  const char* str = JS_ToCString(ctx, value);
  if (!str) {
    return "";
  }

  std::string result(str);
  JS_FreeCString(ctx, str);
  return result;
}

std::string JSToString(JSValue val) {
  return JSToString(ctx, val);
}

void js_print_exception(JSContext* ctx, JSValueConst exception_val) {
  JSValue val;
  int is_error;

  is_error = taro_is_error(ctx, exception_val);
  LOG(ERROR) << "[exception]: " << JS_ToCString(ctx, exception_val) << ".";
  if (is_error) {
    val = JS_GetPropertyStr(ctx, exception_val, "stack");
    if (!taro_is_undefined(val)) {
      LOG(ERROR) << "[exception]: " << JS_ToCString(ctx, val) << ".";
    }
    JS_FreeValue(ctx, val);
  }
}

// 帮助函数：检查数组内容是否相等
bool CompareArrays(JSValue arr1, JSValue arr2) {
  // 使用JavaScript来比较两个数组
  JSValue compareFunc = EvalJS(
      ctx,
      "(function(arr1, arr2) {\n"
      "  if (arr1.length !== arr2.length) {\n"
      "    console.error(\"CompareArrays error:\", JSON.stringify(arr1), JSON.stringify(arr2), arr1.length, arr2.length)\n"
      "    return false\n"
      "  }\n"
      "  for (let i = 0; i < arr1.length; i++) {\n"
      "    if (arr1[i] !== arr2[i]) {\n"
      "      console.error(\"CompareArrays error:\", JSON.stringify(arr1), JSON.stringify(arr2), arr1[i], arr2[i])\n"
      "      return false\n"
      "    }\n"
      "  }\n"
      "  return true\n"
      "})");

  JSValueConst args[2] = {arr1, arr2};
  JSValue result = JS_Call(ctx, compareFunc, JS_UNDEFINED, 2, args);

  bool areEqual = JS_ToBool(ctx, result);

  JS_FreeValue(ctx, compareFunc);
  JS_FreeValue(ctx, result);

  return areEqual;
}

// 辅助函数 - 测试JS数组长度和内容
void CheckJSArray(
    JSValueConst array,
    const std::vector<std::string>& expected) {
  ASSERT_TRUE(taro_is_array(ctx, array));

  int32_t length;
  JSValue lengthVal = JS_GetPropertyStr(ctx, array, "length");
  JS_ToInt32(ctx, &length, lengthVal);
  JS_FreeValue(ctx, lengthVal);

  ASSERT_EQ(length, expected.size());

  for (int32_t i = 0; i < length; i++) {
    JSValue item = JS_GetPropertyUint32(ctx, array, i);
    std::string itemStr = JSToString(item);
    EXPECT_EQ(itemStr, expected[i]);
    JS_FreeValue(ctx, item);
  }
}
