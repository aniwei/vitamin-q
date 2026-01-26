#include "QuickJS/extension/taro_js_big_num.h"

#include <cmath>
#include <string>

#include "./settup.h"

// 辅助函数：测试 BigInt 到字符串的转换
static void test_bigint_to_string(JSContext* ctx, const char* value, int radix, const char* expected) {
  JSValue bigint;
  const char* result_str;
  JSValue result;
  
  // 创建 BigInt
  char script[512];
  snprintf(script, sizeof(script), "BigInt('%s')", value);
  bigint = EvalJS(script);
  EXPECT_FALSE(taro_is_exception(bigint));
  
  // 转换为字符串
  result = taro_js_bigint_to_string(ctx, bigint, radix);
  EXPECT_FALSE(taro_is_exception(result));
  
  // 验证结果
  result_str = JS_ToCString(ctx, result);
  EXPECT_STREQ(result_str, expected);
  
  // 清理资源
  JS_FreeCString(ctx, result_str);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, bigint);
}

// 测试十进制转换
TEST(TaroJSBigNumTest, Decimal) {
  test_bigint_to_string(ctx, "0", 10, "0");
  test_bigint_to_string(ctx, "123", 10, "123");
  test_bigint_to_string(ctx, "-123", 10, "-123");
  test_bigint_to_string(ctx, "9007199254740991", 10, "9007199254740991");  // MAX_SAFE_INTEGER
  test_bigint_to_string(ctx, "-9007199254740991", 10, "-9007199254740991"); // -MAX_SAFE_INTEGER
}

// 测试二进制转换
TEST(TaroJSBigNumTest, Binary) {
  test_bigint_to_string(ctx, "0", 2, "0");
  test_bigint_to_string(ctx, "2", 2, "10");
  test_bigint_to_string(ctx, "10", 2, "1010");
  test_bigint_to_string(ctx, "-10", 2, "-1010");
  test_bigint_to_string(ctx, "15", 2, "1111");
}

// 测试八进制转换
TEST(TaroJSBigNumTest, Octal) {
  test_bigint_to_string(ctx, "0", 8, "0");
  test_bigint_to_string(ctx, "8", 8, "10");
  test_bigint_to_string(ctx, "64", 8, "100");
  test_bigint_to_string(ctx, "-64", 8, "-100");
}

// 测试十六进制转换
TEST(TaroJSBigNumTest, Hexadecimal) {
  test_bigint_to_string(ctx, "0", 16, "0");
  test_bigint_to_string(ctx, "10", 16, "a");
  test_bigint_to_string(ctx, "255", 16, "ff");
  test_bigint_to_string(ctx, "-255", 16, "-ff");
  test_bigint_to_string(ctx, "4095", 16, "fff");
}

// 测试其他基数转换
TEST(TaroJSBigNumTest, OtherBases) {
  test_bigint_to_string(ctx, "35", 36, "z");
  test_bigint_to_string(ctx, "36", 36, "10");
  test_bigint_to_string(ctx, "5", 6, "5");
  test_bigint_to_string(ctx, "31", 32, "v");
}

// 测试大数值
TEST(TaroJSBigNumTest, LargeNumbers) {
  test_bigint_to_string(ctx, "1234567890123456789012345678901234567890", 10, 
                       "1234567890123456789012345678901234567890");
  test_bigint_to_string(ctx, "1152921504606846975", 16, "fffffffffffffff");
}

// 测试无效的基数
TEST(TaroJSBigNumTest, InvalidRadix) {
  JSValue bigint;
  JSValue result;
  
  // 创建一个BigInt
  bigint = EvalJS("BigInt('123')");
  EXPECT_FALSE(taro_is_exception(bigint));
  
  // 测试基数1 (小于最小基数2)
  result = taro_js_bigint_to_string(ctx, bigint, 1);
  EXPECT_TRUE(taro_is_exception(result));
  JS_FreeValue(ctx, result);
  
  // 测试基数37 (大于最大基数36)
  result = taro_js_bigint_to_string(ctx, bigint, 37);
  EXPECT_TRUE(taro_is_exception(result));
  JS_FreeValue(ctx, result);
  
  JS_FreeValue(ctx, bigint);
}

// 测试非BigInt输入
TEST(TaroJSBigNumTest, NonBigIntInput) {
  JSValue string_val;
  
  // 创建一个字符串
  string_val = JS_NewString(ctx, "not a bigint");

  EXPECT_DEATH({
    JSValue result = taro_js_bigint_to_string(ctx, string_val, 10);
    JS_FreeValue(ctx, result);
  }, "JS_VALUE_GET_TAG\\(val\\) == JS_TAG_BIG_INT");
  
  JS_FreeValue(ctx, string_val);
}
