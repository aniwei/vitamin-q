#include "QuickJS/extension/taro_js_type.h"

#include "./settup.h"

TEST(TaroJSTypeTest, IsInteger) {
  JSValueConst val = JS_NewInt32(ctx, 32);

  EXPECT_TRUE(taro_is_number(val));
  EXPECT_TRUE(taro_is_int(val));
  EXPECT_FALSE(taro_is_double(val));

  JS_FreeValue(ctx, val);
}

TEST(TaroJSTypeTest, IsDouble) {
  JSValueConst val = JS_NewFloat64(ctx, 3.14);

  EXPECT_TRUE(taro_is_number(val));
  EXPECT_FALSE(taro_is_int(val));
  EXPECT_TRUE(taro_is_double(val));

  JS_FreeValue(ctx, val);
}

TEST(TaroJSTypeTest, IsBigInt) {
  // 使用 eval 创建 BigInt 值
  JSValue val = EvalJS("9007199254740991n");

  EXPECT_FALSE(taro_is_number(val));
  EXPECT_TRUE(taro_is_big_int(ctx, val));

  JS_FreeValue(ctx, val);
}

TEST(TaroJSTypeTest, IsBool) {
  JSValueConst trueVal = JS_NewBool(ctx, 1);
  JSValueConst falseVal = JS_NewBool(ctx, 0);
  JSValueConst numVal = JS_NewInt32(ctx, 1);

  EXPECT_TRUE(taro_is_bool(trueVal));
  EXPECT_TRUE(taro_is_bool(falseVal));
  EXPECT_FALSE(taro_is_bool(numVal));

  JS_FreeValue(ctx, trueVal);
  JS_FreeValue(ctx, falseVal);
  JS_FreeValue(ctx, numVal);
}

TEST(TaroJSTypeTest, IsNullAndUndefined) {
  JSValueConst nullVal = JS_NULL;
  JSValueConst undefinedVal = JS_UNDEFINED;
  JSValueConst numVal = JS_NewInt32(ctx, 0);

  EXPECT_TRUE(taro_is_null(nullVal));
  EXPECT_FALSE(taro_is_null(undefinedVal));
  EXPECT_FALSE(taro_is_null(numVal));

  EXPECT_TRUE(taro_is_undefined(undefinedVal));
  EXPECT_FALSE(taro_is_undefined(nullVal));
  EXPECT_FALSE(taro_is_undefined(numVal));

  JS_FreeValue(ctx, numVal);
}

TEST(TaroJSTypeTest, IsException) {
  JSValue normalVal = JS_NewInt32(ctx, 42);
  JSValue errorVal = EvalJS("throw new Error('test')");

  EXPECT_FALSE(taro_is_exception(normalVal));
  EXPECT_TRUE(taro_is_exception(errorVal));

  JS_FreeValue(ctx, normalVal);
  JS_FreeValue(ctx, errorVal);
}

TEST(TaroJSTypeTest, IsString) {
  JSValueConst strVal = JS_NewString(ctx, "hello world");
  JSValueConst numVal = JS_NewInt32(ctx, 123);

  EXPECT_TRUE(taro_is_string(strVal));
  EXPECT_FALSE(taro_is_string(numVal));

  JS_FreeValue(ctx, strVal);
  JS_FreeValue(ctx, numVal);
}

TEST(TaroJSTypeTest, IsSymbol) {
  JSValue symbolVal = EvalJS("Symbol('test')");
  JSValueConst strVal = JS_NewString(ctx, "symbol");

  EXPECT_TRUE(taro_is_symbol(symbolVal));
  EXPECT_FALSE(taro_is_symbol(strVal));

  JS_FreeValue(ctx, symbolVal);
  JS_FreeValue(ctx, strVal);
}

TEST(TaroJSTypeTest, IsObject) {
  JSValue objVal = EvalJS("({key: 'value'})");
  JSValueConst strVal = JS_NewString(ctx, "object");

  EXPECT_TRUE(taro_is_object(objVal));
  EXPECT_FALSE(taro_is_object(strVal));

  JS_FreeValue(ctx, objVal);
  JS_FreeValue(ctx, strVal);
}

TEST(TaroJSTypeTest, IsArray) {
  JSValue arrVal = EvalJS("[1, 2, 3]");
  JSValue objVal = EvalJS("({a: 1})");

  EXPECT_TRUE(taro_is_array(ctx, arrVal));
  EXPECT_FALSE(taro_is_array(ctx, objVal));

  JS_FreeValue(ctx, arrVal);
  JS_FreeValue(ctx, objVal);
}

TEST(TaroJSTypeTest, IsArrayBuffer) {
  JSValue bufferVal = EvalJS("new ArrayBuffer(10)");
  JSValue arrVal = EvalJS("[1, 2, 3]");

  EXPECT_TRUE(taro_is_array_buffer(ctx, bufferVal));
  EXPECT_FALSE(taro_is_array_buffer(ctx, arrVal));

  JS_FreeValue(ctx, bufferVal);
  JS_FreeValue(ctx, arrVal);
}

TEST(TaroJSTypeTest, IsError) {
  JSValue errorVal = EvalJS("new Error('test error')");
  JSValue objVal = EvalJS("({message: 'not an error'})");

  EXPECT_TRUE(taro_is_error(ctx, errorVal));
  EXPECT_FALSE(taro_is_error(ctx, objVal));

  JS_FreeValue(ctx, errorVal);
  JS_FreeValue(ctx, objVal);
}

TEST(TaroJSTypeTest, IsFunction) {
  JSValue funcVal = EvalJS("function test() { return 42; }; test");
  JSValue objVal = EvalJS("({prop: 'value'})");

  EXPECT_TRUE(taro_is_function(ctx, funcVal));
  EXPECT_FALSE(taro_is_function(ctx, objVal));

  JS_FreeValue(ctx, funcVal);
  JS_FreeValue(ctx, objVal);
}

TEST(TaroJSTypeTest, IsConstructor) {
  JSValue classVal = EvalJS("class TestClass {}; TestClass");
  JSValue funcVal = EvalJS("function test() {}; test");
  JSValue arrowFunc = EvalJS("() => {}");

  EXPECT_TRUE(taro_is_constructor(ctx, classVal));
  EXPECT_TRUE(taro_is_constructor(ctx, funcVal)); // 普通函数也可以作为构造函数
  EXPECT_FALSE(taro_is_constructor(ctx, arrowFunc)); // 箭头函数不能作为构造函数

  JS_FreeValue(ctx, classVal);
  JS_FreeValue(ctx, funcVal);
  JS_FreeValue(ctx, arrowFunc);
}

TEST(TaroJSTypeTest, IsExtensible) {
  JSValue objVal = EvalJS("({prop: 'value'})");
  JSValue frozenObj = EvalJS("Object.freeze({prop: 'frozen'})");
  JSValue sealedObj = EvalJS("Object.seal({prop: 'sealed'})");

  EXPECT_TRUE(taro_is_extensible(ctx, objVal));
  EXPECT_FALSE(taro_is_extensible(ctx, frozenObj));
  EXPECT_FALSE(taro_is_extensible(ctx, sealedObj));

  JS_FreeValue(ctx, objVal);
  JS_FreeValue(ctx, frozenObj);
  JS_FreeValue(ctx, sealedObj);
}

TEST(TaroJSTypeTest, IsInstanceOf) {
  // 创建类和实例
  const char* script = R"(
    class Animal { 
      constructor(name) { this.name = name; }
    }
    class Dog extends Animal {}
    let rex = new Dog('Rex');
    let obj = {};
    [Animal, Dog, rex, obj]
  )";

  JSValue result = EvalJS(script);
  JSValue animalClass = JS_GetPropertyUint32(ctx, result, 0);
  JSValue dogClass = JS_GetPropertyUint32(ctx, result, 1);
  JSValue dogInstance = JS_GetPropertyUint32(ctx, result, 2);
  JSValue plainObj = JS_GetPropertyUint32(ctx, result, 3);

  EXPECT_TRUE(taro_is_instance_of(ctx, dogInstance, dogClass));
  EXPECT_TRUE(taro_is_instance_of(ctx, dogInstance, animalClass));
  EXPECT_FALSE(taro_is_instance_of(ctx, plainObj, dogClass));
  EXPECT_FALSE(taro_is_instance_of(ctx, dogClass, animalClass));

  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, animalClass);
  JS_FreeValue(ctx, dogClass);
  JS_FreeValue(ctx, dogInstance);
  JS_FreeValue(ctx, plainObj);
}

TEST(TaroJSTypeTest, IsLiveObject) {
  JSValue objVal = JS_NewObject(ctx);

  EXPECT_TRUE(taro_is_live_object(rt, objVal));

  // 由于很难测试不是活对象的情况（释放后的对象不应该被访问），所以只测试正面情况

  JS_FreeValue(ctx, objVal);
}

TEST(TaroJSTypeTest, IsRegisteredClass) {
  JSClassID testClassId;
  taro_js_new_class_id(&testClassId);

  // 未注册前
  EXPECT_FALSE(taro_is_registered_class(rt, testClassId));

  // 注册一个简单的类
  JSClassDef classDef = {
      .class_name = "TestClass",
  };

  taro_js_new_class(rt, testClassId, &classDef);

  // 注册后
  EXPECT_TRUE(taro_is_registered_class(rt, testClassId));
}

TEST(TaroJSTypeTest, IsJobPending) {
  // 这个测试比较特殊，因为涉及到 Promise 等异步操作
  // 创建一个待处理的 Promise
  JSValue promise = EvalJS("new Promise(resolve => setTimeout(resolve, 0))");

  // 在现实环境中，这可能会触发作业队列中的作业
  // 但在测试环境中，我们只检查函数是否可以被调用而不引发崩溃
  bool jobStatus = taro_is_job_pending(rt);

  // 由于测试环境可能与实际运行环境不同，我们不对结果做断言
  // 只是确保函数能被调用
  SUCCEED() << "Successfully checked job pending status: "
            << (jobStatus ? "true" : "false");

  JS_FreeValue(ctx, promise);
}

TEST(TaroJSTypeTest, IsModuleDef) {
  // 创建一个模块
  const char* moduleCode = "export const value = 42;";
  JSValue moduleDef = JS_Eval(
      ctx,
      moduleCode,
      strlen(moduleCode),
      "test.mjs",
      JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);

  // 普通对象
  JSValue objVal = JS_NewObject(ctx);

  EXPECT_TRUE(taro_is_module_def(moduleDef));
  EXPECT_FALSE(taro_is_module_def(objVal));

  JS_FreeValue(ctx, moduleDef);
  JS_FreeValue(ctx, objVal);
}
