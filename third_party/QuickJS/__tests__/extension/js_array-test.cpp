#include "QuickJS/extension/taro_js_array.h"

#include "./settup.h"

TEST(TaroJSArrayTest, Length) {
  JSValue arr = EvalJS("[1, 2, 3, 4, 5]");
  JSValue len = taro_js_array_length(ctx, arr);

  EXPECT_EQ(5, JSToInt32(len));
  JS_FreeValue(ctx, arr);
}

TEST(TaroJSArrayTest, LengthEmptyArray) {
  JSValue arr = EvalJS("[]");
  JSValue len = taro_js_array_length(ctx, arr);

  EXPECT_EQ(0, JSToInt32(len));
  JS_FreeValue(ctx, arr);
}

TEST(TaroJSArrayTest, LengthSparseArray) {
  JSValue arr = EvalJS("const a = []; a[10] = 10; a");
  JSValue len = taro_js_array_length(ctx, arr);

  EXPECT_EQ(11, JSToInt32(len));
  JS_FreeValue(ctx, arr);
}

TEST(TaroJSArrayTest, SliceWithBothParams) {
  JSValue arr = EvalJS("[0, 1, 2, 3, 4]");
  JSValue start = JS_NewInt32(ctx, 1);
  JSValue end = JS_NewInt32(ctx, 3);

  JSValue result = taro_js_array_slice(ctx, arr, start, end);
  JSValue expected = EvalJS("[1, 2]");

  EXPECT_TRUE(CompareArrays(result, expected));

  JS_FreeValue(ctx, start);
  JS_FreeValue(ctx, end);
  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, expected);
}

TEST(TaroJSArrayTest, SliceWithStartOnly) {
  JSValue arr = EvalJS("[0, 1, 2, 3, 4]");
  JSValue start = JS_NewInt32(ctx, 2);

  JSValue result = taro_js_array_slice(ctx, arr, start);
  JSValue expected = EvalJS("[2, 3, 4]");

  EXPECT_TRUE(CompareArrays(result, expected));

  JS_FreeValue(ctx, start);
  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, expected);
}

TEST(TaroJSArrayTest, SliceWithNoParams) {
  JSValue arr = EvalJS("[0, 1, 2, 3, 4]");

  JSValue result = taro_js_array_slice(ctx, arr);
  JSValue expected = EvalJS("[0, 1, 2, 3, 4]");

  EXPECT_TRUE(CompareArrays(result, expected));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, expected);
}

TEST(TaroJSArrayTest, SpliceWithStartOnly) {
  JSValue arr = EvalJS("[0, 1, 2, 3, 4]");
  JSValue start = JS_NewInt32(ctx, 2);

  JSValue result = taro_js_array_splice(ctx, arr, start);
  JSValue expectedResult = EvalJS("[2, 3, 4]");
  JSValue expectedArr = EvalJS("[0, 1]");

  EXPECT_TRUE(CompareArrays(result, expectedResult));
  EXPECT_TRUE(CompareArrays(arr, expectedArr));

  JS_FreeValue(ctx, start);
  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, expectedResult);
  JS_FreeValue(ctx, expectedArr);
}

TEST(TaroJSArrayTest, SpliceWithStartAndDeleteCount) {
  JSValue arr = EvalJS("[0, 1, 2, 3, 4]");
  JSValue start = JS_NewInt32(ctx, 1);
  JSValue deleteCount = JS_NewInt32(ctx, 2);

  JSValue result = taro_js_array_splice(ctx, arr, start, deleteCount);
  JSValue expectedResult = EvalJS("[1, 2]");
  JSValue expectedArr = EvalJS("[0, 3, 4]");

  EXPECT_TRUE(CompareArrays(result, expectedResult));
  EXPECT_TRUE(CompareArrays(arr, expectedArr));

  JS_FreeValue(ctx, start);
  JS_FreeValue(ctx, deleteCount);
  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, expectedResult);
  JS_FreeValue(ctx, expectedArr);
}

TEST(TaroJSArrayTest, SpliceWithStartDeleteCountAndItems) {
  JSValue arr = EvalJS("[0, 1, 2, 3, 4]");
  JSValue start = JS_NewInt32(ctx, 1);
  JSValue deleteCount = JS_NewInt32(ctx, 2);

  // 准备要插入的项目
  JSValue items[2];
  items[0] = JS_NewInt32(ctx, 99);
  items[1] = JS_NewInt32(ctx, 100);

  JSValue result = taro_js_array_splice(
      ctx, arr, start, deleteCount, 2, (JSValueConst*)items);
  JSValue expectedResult = EvalJS("[1, 2]");
  JSValue expectedArr = EvalJS("[0, 99, 100, 3, 4]");

  EXPECT_TRUE(CompareArrays(result, expectedResult));
  EXPECT_TRUE(CompareArrays(arr, expectedArr));

  JS_FreeValue(ctx, start);
  JS_FreeValue(ctx, deleteCount);
  JS_FreeValue(ctx, items[0]);
  JS_FreeValue(ctx, items[1]);
  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, expectedResult);
  JS_FreeValue(ctx, expectedArr);
}

TEST(TaroJSArrayTest, Every_AllTrue) {
  JSValue arr = EvalJS("[2, 4, 6, 8]");
  JSValue callback = EvalJS("(x) => x % 2 === 0");

  JSValue result = taro_js_array_every(ctx, arr, callback);

  EXPECT_TRUE(JSToBool(result));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
}

TEST(TaroJSArrayTest, Every_OneFalse) {
  JSValue arr = EvalJS("[2, 4, 5, 8]");
  JSValue callback = EvalJS("(x) => x % 2 === 0");

  JSValue result = taro_js_array_every(ctx, arr, callback);

  EXPECT_FALSE(JSToBool(result));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
}

TEST(TaroJSArrayTest, Some_OneTrue) {
  JSValue arr = EvalJS("[1, 3, 5, 8]");
  JSValue callback = EvalJS("(x) => x % 2 === 0");

  JSValue result = taro_js_array_some(ctx, arr, callback);

  EXPECT_TRUE(JSToBool(result));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
}

TEST(TaroJSArrayTest, Some_AllFalse) {
  JSValue arr = EvalJS("[1, 3, 5, 7]");
  JSValue callback = EvalJS("(x) => x % 2 === 0");

  JSValue result = taro_js_array_some(ctx, arr, callback);

  EXPECT_FALSE(JSToBool(result));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
}

TEST(TaroJSArrayTest, ForEach) {
  // 准备一个数组和一个存储结果的对象
  EvalJS("let testSum = 0");
  JSValue arr = EvalJS("[1, 2, 3, 4]");
  JSValue callback = EvalJS("(x) => { testSum += x }");

  JSValue result = taro_js_array_foreach(ctx, arr, callback);

  // 验证forEach没有返回值
  EXPECT_TRUE(taro_is_undefined(result));
  JS_FreeValue(ctx, result);

  // 验证回调被执行，且修改了外部变量
  JSValue sum = EvalJS("testSum");
  EXPECT_EQ(10, JSToInt32(sum));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
}

TEST(TaroJSArrayTest, ForEach_WithThisArg) {
  // 准备带有 thisArg 的测试
  EvalJS("const testObj = { multiplier: 2, sum: 0 };");
  JSValue arr = EvalJS("[1, 2, 3, 4]");
  JSValue callback =
      EvalJS("(function(x) { this.sum += x * this.multiplier; })");
  JSValue thisArg = EvalJS("testObj");

  taro_js_array_foreach(ctx, arr, callback, thisArg);

  JSValue result = EvalJS("testObj.sum");
  EXPECT_EQ(20, JSToInt32(result)); // 1*2 + 2*2 + 3*2 + 4*2 = 20

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
  JS_FreeValue(ctx, thisArg);
}

TEST(TaroJSArrayTest, Map) {
  JSValue arr = EvalJS("[1, 2, 3]");
  JSValue callback = EvalJS("(x) => x * 2");

  JSValue result = taro_js_array_map(ctx, arr, callback);
  JSValue expected = EvalJS("[2, 4, 6]");

  EXPECT_TRUE(CompareArrays(result, expected));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, expected);
}

TEST(TaroJSArrayTest, Filter) {
  JSValue arr = EvalJS("[1, 2, 3, 4, 5]");
  JSValue callback = EvalJS("(x) => x % 2 === 0");

  JSValue result = taro_js_array_filter(ctx, arr, callback);
  JSValue expected = EvalJS("[2, 4]");

  EXPECT_TRUE(CompareArrays(result, expected));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, expected);
}

TEST(TaroJSArrayTest, Reduce_NoInitialValue) {
  JSValue arr = EvalJS("[1, 2, 3, 4]");
  JSValue callback = EvalJS("(acc, val) => acc + val");

  JSValue result = taro_js_array_reduce(ctx, arr, callback);

  EXPECT_EQ(10, JSToInt32(result));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
}

TEST(TaroJSArrayTest, Reduce_WithInitialValue) {
  JSValue arr = EvalJS("[1, 2, 3, 4]");
  JSValue callback = EvalJS("(acc, val) => acc + val");
  JSValue initialValue = JS_NewInt32(ctx, 10);

  JSValue result = taro_js_array_reduce(ctx, arr, callback, initialValue);

  EXPECT_EQ(20, JSToInt32(result));

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
  JS_FreeValue(ctx, initialValue);
}

TEST(TaroJSArrayTest, ReduceRight_NoInitialValue) {
  JSValue arr = EvalJS("['a', 'b', 'c', 'd']");
  JSValue callback = EvalJS("(acc, val) => acc + val");

  JSValue result = taro_js_array_reduce_right(ctx, arr, callback);
  const char* resultStr = JS_ToCString(ctx, result);

  EXPECT_STREQ("dcba", resultStr);

  JS_FreeCString(ctx, resultStr);
  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
  JS_FreeValue(ctx, result);
}

TEST(TaroJSArrayTest, ReduceRight_WithInitialValue) {
  JSValue arr = EvalJS("['a', 'b', 'c', 'd']");
  JSValue callback = EvalJS("(acc, val) => acc + val");
  JSValue initialValue = JS_NewString(ctx, "x");

  JSValue result = taro_js_array_reduce_right(ctx, arr, callback, initialValue);
  const char* resultStr = JS_ToCString(ctx, result);

  EXPECT_STREQ("xdcba", resultStr);

  JS_FreeCString(ctx, resultStr);
  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, callback);
  JS_FreeValue(ctx, initialValue);
  JS_FreeValue(ctx, result);
}

TEST(TaroJSArrayTest, EdgeCases_EmptyArray) {
  // 测试空数组
  JSValue emptyArr = EvalJS("[]");

  // 测试空数组的every (应该返回true)
  {
    JSValue callback = EvalJS("(x) => false");
    JSValue result = taro_js_array_every(ctx, emptyArr, callback);
    EXPECT_TRUE(JSToBool(result));
    JS_FreeValue(ctx, callback);
  }

  // 测试空数组的some (应该返回false)
  {
    JSValue callback = EvalJS("(x) => true");
    JSValue result = taro_js_array_some(ctx, emptyArr, callback);
    EXPECT_FALSE(JSToBool(result));
    JS_FreeValue(ctx, callback);
  }

  // 测试空数组的map (应该返回空数组)
  {
    JSValue callback = EvalJS("(x) => x * 2");
    JSValue result = taro_js_array_map(ctx, emptyArr, callback);
    JSValue expected = EvalJS("[]");
    EXPECT_TRUE(CompareArrays(result, expected));
    JS_FreeValue(ctx, callback);
    JS_FreeValue(ctx, result);
    JS_FreeValue(ctx, expected);
  }

  // 测试空数组没有初始值的reduce (应该抛出异常)
  {
    JSValue callback = EvalJS("(acc, val) => acc + val");
    JSValue result = taro_js_array_reduce(ctx, emptyArr, callback);
    EXPECT_TRUE(taro_is_exception(result));
    JS_GetException(ctx); // 清除异常
    JS_FreeValue(ctx, callback);
  }

  // 测试空数组有初始值的reduce (应该返回初始值)
  {
    JSValue callback = EvalJS("(acc, val) => acc + val");
    JSValue initialValue = JS_NewInt32(ctx, 10);
    JSValue result =
        taro_js_array_reduce(ctx, emptyArr, callback, initialValue);
    EXPECT_EQ(10, JSToInt32(result));
    JS_FreeValue(ctx, callback);
    JS_FreeValue(ctx, initialValue);
  }

  JS_FreeValue(ctx, emptyArr);
}

TEST(TaroJSArrayTest, EdgeCases_InvalidCallback) {
  JSValue arr = EvalJS("[1, 2, 3]");
  JSValue invalidCallback = JS_NewInt32(ctx, 123); // 不是函数的回调

  // 测试传入非函数回调
  JSValue result = taro_js_array_map(ctx, arr, invalidCallback);
  EXPECT_TRUE(taro_is_exception(result));
  JS_GetException(ctx); // 清除异常

  JS_FreeValue(ctx, arr);
  JS_FreeValue(ctx, invalidCallback);
}
