#include "QuickJS/extension/taro_js_json.h"

#include "./settup.h"

// JSON.parse 基本测试
TEST(TaroJSJsonTest, ParseBasic) {
  // 解析对象
  JSValue text = JS_NewString(ctx, "{\"name\":\"张三\",\"age\":30}");
  JSValue obj = taro_js_json_parse(ctx, text);
  ASSERT_FALSE(taro_is_exception(obj));
  ASSERT_TRUE(taro_is_object(obj));

  // 验证解析结果
  JSValue name = JS_GetPropertyStr(ctx, obj, "name");
  JSValue age = JS_GetPropertyStr(ctx, obj, "age");
  EXPECT_EQ(JSToString(name), "张三");
  EXPECT_EQ(JS_VALUE_GET_INT(age), 30);

  JS_FreeValue(ctx, name);
  JS_FreeValue(ctx, age);
  JS_FreeValue(ctx, obj);
  JS_FreeValue(ctx, text);
}

// JSON.parse 数组测试
TEST(TaroJSJsonTest, ParseArray) {
  JSValue text = JS_NewString(ctx, "[1,2,3,\"四\",true,null]");
  JSValue arr = taro_js_json_parse(ctx, text);
  ASSERT_FALSE(taro_is_exception(arr));
  ASSERT_TRUE(taro_is_array(ctx, arr));

  // 验证数组元素
  JSValue e0 = JS_GetPropertyUint32(ctx, arr, 0);
  JSValue e3 = JS_GetPropertyUint32(ctx, arr, 3);
  JSValue e4 = JS_GetPropertyUint32(ctx, arr, 4);
  JSValue e5 = JS_GetPropertyUint32(ctx, arr, 5);

  EXPECT_EQ(JS_VALUE_GET_INT(e0), 1);
  EXPECT_EQ(JSToString(e3), "四");
  EXPECT_TRUE(JS_ToBool(ctx, e4));
  EXPECT_TRUE(taro_is_null(e5));

  JS_FreeValue(ctx, e0);
  JS_FreeValue(ctx, e3);
  JS_FreeValue(ctx, e4);
  JS_FreeValue(ctx, e5);
  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, text);
}

// JSON.parse 使用 reviver 函数
TEST(TaroJSJsonTest, ParseWithReviver) {
  // 创建一个reviver函数，将所有数字值乘以2
  const char* reviver_code =
      "(function(key, value) { return typeof value === 'number' ? value * 2 : value; })";
  JSValue reviver = EvalJS(reviver_code);

  JSValue text = JS_NewString(ctx, "{\"a\":10,\"b\":20,\"c\":\"test\"}");
  JSValue obj = taro_js_json_parse(ctx, text, reviver);
  ASSERT_FALSE(taro_is_exception(obj));

  // 验证reviver的效果
  JSValue a = JS_GetPropertyStr(ctx, obj, "a");
  JSValue b = JS_GetPropertyStr(ctx, obj, "b");
  JSValue c = JS_GetPropertyStr(ctx, obj, "c");

  EXPECT_EQ(JS_VALUE_GET_INT(a), 20); // 10 * 2
  EXPECT_EQ(JS_VALUE_GET_INT(b), 40); // 20 * 2
  EXPECT_EQ(JSToString(c), "test"); // 字符串不变

  JS_FreeValue(ctx, a);
  JS_FreeValue(ctx, b);
  JS_FreeValue(ctx, c);
  JS_FreeValue(ctx, obj);
  JS_FreeValue(ctx, text);
  JS_FreeValue(ctx, reviver);
}

// JSON.parse 错误处理测试
TEST(TaroJSJsonTest, ParseError) {
  // 无效的JSON
  JSValue text = JS_NewString(ctx, "{name:\"错误的JSON\"}"); // 缺少引号
  JSValue obj = taro_js_json_parse(ctx, text);
  EXPECT_TRUE(taro_is_exception(obj));

  JS_FreeValue(ctx, obj);
  JS_FreeValue(ctx, text);
}

// JSON.stringify 基本测试
TEST(TaroJSJsonTest, StringifyBasic) {
  // 创建一个对象
  JSValue obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "name", JS_NewString(ctx, "李四"));
  JS_SetPropertyStr(ctx, obj, "age", JS_NewInt32(ctx, 25));
  JS_SetPropertyStr(ctx, obj, "active", JS_NewBool(ctx, true));

  // 序列化为JSON
  JSValue json = taro_js_json_stringify(ctx, obj);
  ASSERT_FALSE(taro_is_exception(json));

  std::string json_str = JSToString(json);
  // 注意：不同的QuickJS版本可能有不同的输出格式，所以这里不做精确匹配
  EXPECT_TRUE(json_str.find("\"name\":\"李四\"") != std::string::npos);
  EXPECT_TRUE(json_str.find("\"age\":25") != std::string::npos);
  EXPECT_TRUE(json_str.find("\"active\":true") != std::string::npos);

  JS_FreeValue(ctx, json);
  JS_FreeValue(ctx, obj);
}

// JSON.stringify 数组测试
TEST(TaroJSJsonTest, StringifyArray) {
  JSValue arr = JS_NewArray(ctx);
  JS_SetPropertyUint32(ctx, arr, 0, JS_NewInt32(ctx, 1));
  JS_SetPropertyUint32(ctx, arr, 1, JS_NewInt32(ctx, 2));
  JS_SetPropertyUint32(ctx, arr, 2, JS_NewString(ctx, "三"));
  JS_SetPropertyUint32(ctx, arr, 3, JS_NULL);

  JSValue json = taro_js_json_stringify(ctx, arr);
  std::string json_str = JSToString(json);

  EXPECT_TRUE(json_str.find("[1,2,\"三\",null]") != std::string::npos);

  JS_FreeValue(ctx, json);
  JS_FreeValue(ctx, arr);
}

// JSON.stringify 使用 replacer 函数
TEST(TaroJSJsonTest, StringifyWithReplacer) {
  // 创建一个对象
  JSValue obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "name", JS_NewString(ctx, "王五"));
  JS_SetPropertyStr(ctx, obj, "password", JS_NewString(ctx, "secret123"));
  JS_SetPropertyStr(ctx, obj, "age", JS_NewInt32(ctx, 30));

  // 创建replacer函数，隐藏password字段
  const char* replacer_code =
      "(function(key, value) { return key === 'password' ? undefined : value; })";
  JSValue replacer = EvalJS(replacer_code);

  JSValue json = taro_js_json_stringify(ctx, obj, replacer);
  std::string json_str = JSToString(json);

  // password不应该出现在结果中
  EXPECT_TRUE(json_str.find("\"name\":\"王五\"") != std::string::npos);
  EXPECT_TRUE(json_str.find("\"age\":30") != std::string::npos);
  EXPECT_TRUE(json_str.find("password") == std::string::npos);

  JS_FreeValue(ctx, json);
  JS_FreeValue(ctx, replacer);
  JS_FreeValue(ctx, obj);
}

// JSON.stringify 使用 replacer 数组
TEST(TaroJSJsonTest, StringifyWithReplacerArray) {
  // 创建一个对象
  JSValue obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "name", JS_NewString(ctx, "赵六"));
  JS_SetPropertyStr(ctx, obj, "age", JS_NewInt32(ctx, 35));
  JS_SetPropertyStr(ctx, obj, "email", JS_NewString(ctx, "zhaoiu@example.com"));

  // 创建replacer数组，只包含name和age
  JSValue replacer = JS_NewArray(ctx);
  JS_SetPropertyUint32(ctx, replacer, 0, JS_NewString(ctx, "name"));
  JS_SetPropertyUint32(ctx, replacer, 1, JS_NewString(ctx, "age"));

  JSValue json = taro_js_json_stringify(ctx, obj, replacer);
  std::string json_str = JSToString(json);

  // 只有name和age应该出现在结果中
  EXPECT_TRUE(json_str.find("\"name\":\"赵六\"") != std::string::npos);
  EXPECT_TRUE(json_str.find("\"age\":35") != std::string::npos);
  EXPECT_TRUE(json_str.find("email") == std::string::npos);

  JS_FreeValue(ctx, json);
  JS_FreeValue(ctx, replacer);
  JS_FreeValue(ctx, obj);
}

// JSON.stringify 使用 space 参数
TEST(TaroJSJsonTest, StringifyWithSpace) {
  JSValue obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "name", JS_NewString(ctx, "孙七"));
  JS_SetPropertyStr(ctx, obj, "info", JS_NewObject(ctx));
  JSValue info = JS_GetPropertyStr(ctx, obj, "info");
  JS_SetPropertyStr(ctx, info, "age", JS_NewInt32(ctx, 40));

  // 使用2个空格缩进
  JSValue space = JS_NewInt32(ctx, 2);
  JSValue json = taro_js_json_stringify(ctx, obj, JS_UNDEFINED, space);
  std::string json_str = JSToString(json);

  // 验证格式化（包含换行和缩进）
  EXPECT_TRUE(json_str.find("{\n  \"name\": \"孙七\",") != std::string::npos);
  EXPECT_TRUE(
      json_str.find("  \"info\": {\n    \"age\": 40\n  }") !=
      std::string::npos);

  JS_FreeValue(ctx, json);
  JS_FreeValue(ctx, space);
  JS_FreeValue(ctx, info);
  JS_FreeValue(ctx, obj);
}

// JSON.stringify 特殊值处理
TEST(TaroJSJsonTest, StringifySpecialValues) {
  JSValue obj = JS_NewObject(ctx);

  // 设置各种特殊值
  JS_SetPropertyStr(ctx, obj, "undef", JS_UNDEFINED);
  JS_SetPropertyStr(ctx, obj, "null", JS_NULL);
  JS_SetPropertyStr(ctx, obj, "nan", JS_NewFloat64(ctx, NAN));
  JS_SetPropertyStr(ctx, obj, "infinity", JS_NewFloat64(ctx, INFINITY));

  // 添加一个函数
  const char* func_code = "(function() { return 'hello'; })";
  JSValue func = EvalJS(func_code);
  JS_SetPropertyStr(ctx, obj, "func", func);

  JSValue json = taro_js_json_stringify(ctx, obj);
  std::string json_str = JSToString(json);

  // undefined和函数应该被忽略，NaN和Infinity应该变成null
  EXPECT_TRUE(json_str.find("\"null\":null") != std::string::npos);
  EXPECT_TRUE(json_str.find("\"nan\":null") != std::string::npos);
  EXPECT_TRUE(json_str.find("\"infinity\":null") != std::string::npos);
  EXPECT_TRUE(json_str.find("undef") == std::string::npos); // 不存在
  EXPECT_TRUE(json_str.find("func") == std::string::npos); // 不存在

  JS_FreeValue(ctx, json);
  JS_FreeValue(ctx, obj);
}
