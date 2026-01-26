#include "QuickJS/extension/taro_js_symbol.h"

#include <string>

#include "./settup.h"

// 测试基本 Symbol 到字符串的转换
TEST(TaroJSSymbolTest, BasicSymbolToString) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);
  
  // 创建一个普通的 Symbol
  JSValue symbol = EvalJS(ctx, "Symbol()");
  ASSERT_FALSE(taro_is_exception(symbol));
  ASSERT_TRUE(taro_is_symbol(symbol));
  
  // 转换为字符串
  JSValue symbolStr = taro_js_symbol_to_string(ctx, symbol);
  ASSERT_FALSE(taro_is_exception(symbolStr));
  
  // 验证结果格式
  std::string result = JSToString(ctx, symbolStr);
  EXPECT_EQ(result, "Symbol()");
  
  JS_FreeValue(ctx, symbolStr);
  JS_FreeValue(ctx, symbol);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试带描述的 Symbol
TEST(TaroJSSymbolTest, SymbolWithDescription) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);
  
  // 创建带描述的 Symbol
  JSValue symbol = EvalJS(ctx, "Symbol('test description')");
  ASSERT_FALSE(taro_is_exception(symbol));
  ASSERT_TRUE(taro_is_symbol(symbol));
  
  // 转换为字符串
  JSValue symbolStr = taro_js_symbol_to_string(ctx, symbol);
  ASSERT_FALSE(taro_is_exception(symbolStr));
  
  // 验证结果是否包含描述
  std::string result = JSToString(ctx, symbolStr);
  EXPECT_EQ(result, "Symbol(test description)");
  
  JS_FreeValue(ctx, symbolStr);
  JS_FreeValue(ctx, symbol);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试内置的 Symbol 值
TEST(TaroJSSymbolTest, WellKnownSymbols) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);
  
  struct SymbolTest {
    const char* code;
    const char* expected;
  };
  
  SymbolTest tests[] = {
    {"Symbol.iterator", "Symbol(Symbol.iterator)"},
    {"Symbol.hasInstance", "Symbol(Symbol.hasInstance)"},
    {"Symbol.toPrimitive", "Symbol(Symbol.toPrimitive)"},
    {"Symbol.toStringTag", "Symbol(Symbol.toStringTag)"},
    {"Symbol.isConcatSpreadable", "Symbol(Symbol.isConcatSpreadable)"}
  };
  
  for (const auto& test : tests) {
    JSValue symbol = EvalJS(ctx, test.code);
    ASSERT_FALSE(taro_is_exception(symbol)) << "Failed on: " << test.code;
    ASSERT_TRUE(taro_is_symbol(symbol)) << "Not a symbol: " << test.code;
    
    JSValue symbolStr = taro_js_symbol_to_string(ctx, symbol);
    ASSERT_FALSE(taro_is_exception(symbolStr)) << "Exception converting: " << test.code;
    
    std::string result = JSToString(ctx, symbolStr);
    EXPECT_EQ(result, test.expected) << "Mismatch for: " << test.code;
    
    JS_FreeValue(ctx, symbolStr);
    JS_FreeValue(ctx, symbol);
  }
  
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试 Symbol.for() 创建的 Symbol
TEST(TaroJSSymbolTest, SymbolForGlobalRegistry) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);
  
  // 使用 Symbol.for 创建全局 Symbol
  JSValue symbol = EvalJS(ctx, "Symbol.for('global symbol')");
  ASSERT_FALSE(taro_is_exception(symbol));
  ASSERT_TRUE(taro_is_symbol(symbol));
  
  // 转换为字符串
  JSValue symbolStr = taro_js_symbol_to_string(ctx, symbol);
  ASSERT_FALSE(taro_is_exception(symbolStr));
  
  // 验证结果
  std::string result = JSToString(ctx, symbolStr);
  EXPECT_EQ(result, "Symbol(global symbol)");
  
  // 验证相同 key 获取的是同一个 Symbol
  JSValue symbol2 = EvalJS(ctx, "Symbol.for('global symbol')");
  JSValue symbolStr2 = taro_js_symbol_to_string(ctx, symbol2);
  std::string result2 = JSToString(ctx, symbolStr2);
  EXPECT_EQ(result, result2);
  
  JS_FreeValue(ctx, symbolStr2);
  JS_FreeValue(ctx, symbol2);
  JS_FreeValue(ctx, symbolStr);
  JS_FreeValue(ctx, symbol);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试 Symbol.keyFor 功能
TEST(TaroJSSymbolTest, SymbolKeyFor) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);
  
  // 创建全局 Symbol 和普通 Symbol
  const char* code = 
      "const globalSym = Symbol.for('test key');\n"
      "const localSym = Symbol('test key');\n"
      "[globalSym, localSym, Symbol.keyFor(globalSym), Symbol.keyFor(localSym)];";
  
  JSValue result = EvalJS(ctx, code);
  ASSERT_FALSE(taro_is_exception(result));
  
  // 提取结果数组中的元素
  JSValue globalSym = JS_GetPropertyUint32(ctx, result, 0);
  JSValue localSym = JS_GetPropertyUint32(ctx, result, 1);
  JSValue globalKey = JS_GetPropertyUint32(ctx, result, 2);
  JSValue localKey = JS_GetPropertyUint32(ctx, result, 3);
  
  // 测试 Symbol 转字符串
  JSValue globalSymStr = taro_js_symbol_to_string(ctx, globalSym);
  JSValue localSymStr = taro_js_symbol_to_string(ctx, localSym);
  
  // 验证结果
  std::string globalSymResult = JSToString(ctx, globalSymStr);
  std::string localSymResult = JSToString(ctx, localSymStr);
  std::string globalKeyResult = JSToString(ctx, globalKey);
  
  EXPECT_EQ(globalSymResult, "Symbol(test key)");
  EXPECT_EQ(localSymResult, "Symbol(test key)");
  EXPECT_EQ(globalKeyResult, "test key");
  EXPECT_TRUE(taro_is_undefined(localKey)); // 非全局 Symbol 返回 undefined
  
  // 清理
  JS_FreeValue(ctx, globalSymStr);
  JS_FreeValue(ctx, localSymStr);
  JS_FreeValue(ctx, globalSym);
  JS_FreeValue(ctx, localSym);
  JS_FreeValue(ctx, globalKey);
  JS_FreeValue(ctx, localKey);
  JS_FreeValue(ctx, result);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试非 Symbol 值作为输入
TEST(TaroJSSymbolTest, NonSymbolInput) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);
  
  // 创建非 Symbol 值
  JSValue nonSymbol = JS_NewString(ctx, "not a symbol");
  
  // 尝试转换为字符串
  JSValue result = taro_js_symbol_to_string(ctx, nonSymbol);
  
  // 应该抛出异常
  EXPECT_TRUE(taro_is_exception(result));
  
  // 清理异常
  JSValue exception = JS_GetException(ctx);
  
  // 清理
  JS_FreeValue(ctx, exception);
  JS_FreeValue(ctx, nonSymbol);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试 Symbol 属性
TEST(TaroJSSymbolTest, SymbolProperties) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);
  
  // 使用 Symbol 作为对象属性
  const char* code = 
      "const s = Symbol('prop');\n"
      "const obj = {};\n"
      "obj[s] = 'symbol value';\n"
      "[s, obj[s]];";
  
  JSValue result = EvalJS(ctx, code);
  ASSERT_FALSE(taro_is_exception(result));
  
  JSValue symbol = JS_GetPropertyUint32(ctx, result, 0);
  
  // 转换 Symbol 为字符串
  JSValue symbolStr = taro_js_symbol_to_string(ctx, symbol);
  ASSERT_FALSE(taro_is_exception(symbolStr));
  
  std::string strResult = JSToString(ctx, symbolStr);
  EXPECT_EQ(strResult, "Symbol(prop)");
  
  // 验证对象属性值
  JSValue propValue = JS_GetPropertyUint32(ctx, result, 1);
  std::string propValueStr = JSToString(ctx, propValue);
  EXPECT_EQ(propValueStr, "symbol value");
  
  // 清理
  JS_FreeValue(ctx, propValue);
  JS_FreeValue(ctx, symbolStr);
  JS_FreeValue(ctx, symbol);
  JS_FreeValue(ctx, result);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

// 测试空描述的 Symbol
TEST(TaroJSSymbolTest, EmptyDescriptionSymbol) {
  JSRuntime* rt = JS_NewRuntime();
  JSContext* ctx = JS_NewContext(rt);
  
  // 创建空描述的 Symbol
  JSValue symbol = EvalJS(ctx, "Symbol('')");
  ASSERT_FALSE(taro_is_exception(symbol));
  ASSERT_TRUE(taro_is_symbol(symbol));
  
  // 转换为字符串
  JSValue symbolStr = taro_js_symbol_to_string(ctx, symbol);
  ASSERT_FALSE(taro_is_exception(symbolStr));
  
  // 验证结果
  std::string result = JSToString(ctx, symbolStr);
  EXPECT_EQ(result, "Symbol()");
  
  JS_FreeValue(ctx, symbolStr);
  JS_FreeValue(ctx, symbol);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}
