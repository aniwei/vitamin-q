#include "QuickJS/extension/taro_js_class.h"

#include "./settup.h"
#include "../../src/core/builtins/js-promise.h"
#include "../../src/core/runtime.h"
#include "../../src/core/types.h"

typedef struct {
  int value;
} TestData;

// 析构函数
static void test_class_finalizer(JSRuntime* rt, JSValue val) {
  TestData* data = (TestData*)JS_GetOpaque(val, JS_CLASS_OBJECT);
  if (data) {
    js_free_rt(rt, data);
  }
}

// 标记函数 (GC相关)
static void
test_class_gc_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func) {}

TEST(TaroJSClassTest, CreateClassID) {
  JSClassID class_id = taro_js_new_class_id();
  EXPECT_NE(class_id, JS_INVALID_CLASS_ID);

  // 使用指针接收
  JSClassID another_id = 0;
  JSClassID* pid = &another_id;
  taro_js_new_class_id(pid);
  EXPECT_NE(another_id, JS_INVALID_CLASS_ID);
  EXPECT_NE(another_id, class_id); // 应该是唯一的
}

TEST(TaroJSClassTest, CreateClass) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);

  JSClassID class_id = taro_js_new_class_id();
  EXPECT_NE(class_id, JS_INVALID_CLASS_ID);

  JSClassDef class_def = {
      .class_name = "TestClass",
      .finalizer = test_class_finalizer,
      .gc_mark = test_class_gc_mark,
  };

  int ret = taro_js_new_class(rt, class_id, &class_def);
  EXPECT_EQ(ret, 0);

  JS_FreeRuntime(rt);
}

TEST(TaroJSClassTest, CreateAndManipulateObject) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  JSClassID class_id = taro_js_new_class_id();
  JSClassDef class_def = {
      .class_name = "TestClass",
      .finalizer = test_class_finalizer,
      .gc_mark = test_class_gc_mark,
  };
  taro_js_new_class(rt, class_id, &class_def);

  // 创建对象
  JSValue obj = taro_js_new_object_class(ctx, class_id);
  EXPECT_TRUE(taro_is_object(obj));

  // 设置不透明数据
  TestData* data = (TestData*)js_malloc(ctx, sizeof(TestData));
  data->value = 42;
  taro_js_set_opaque(obj, data);

  // 获取不透明数据
  TestData* retrieved = (TestData*)taro_js_get_opaque(obj, class_id);
  EXPECT_NE(retrieved, nullptr);
  EXPECT_EQ(retrieved->value, 42);

  // 测试类型检查
  EXPECT_TRUE(taro_js_is_object_of_class(obj, class_id));

  // 创建并使用类原型
  JSValue proto = JS_NewObject(ctx);
  taro_js_set_class_proto(ctx, class_id, proto);

  JSValue proto_retrieved = JS_DupValue(ctx, taro_js_get_class_proto(ctx, class_id));
  EXPECT_TRUE(JS_StrictEq(ctx, proto, proto_retrieved));

  // 使用指定原型创建对象
  JSValue obj_with_proto = taro_js_new_object_class_proto(ctx, class_id, proto);
  EXPECT_TRUE(taro_is_object(obj_with_proto));
  EXPECT_TRUE(taro_js_is_object_of_class(obj_with_proto, class_id));

  // 仅使用原型创建普通对象
  JSValue plain_obj = taro_js_new_object_proto(ctx, proto);
  EXPECT_TRUE(taro_is_object(plain_obj));
  EXPECT_FALSE(taro_js_is_object_of_class(plain_obj, class_id));

  JS_FreeValue(ctx, obj);
  JS_FreeValue(ctx, proto);
  JS_FreeValue(ctx, proto_retrieved);
  JS_FreeValue(ctx, obj_with_proto);
  JS_FreeValue(ctx, plain_obj);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSClassTest, PromiseTest) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  JSValue executor = js_promise_executor_new(ctx);
  JSValue promise_obj = taro_js_promise_constructor(ctx, executor);

  EXPECT_TRUE(taro_js_is_promise(ctx, promise_obj));

  JSValue regular_obj = JS_NewObject(ctx);
  EXPECT_FALSE(taro_js_is_promise(ctx, regular_obj));

  JS_FreeValue(ctx, executor);
  JS_FreeValue(ctx, promise_obj);
  JS_FreeValue(ctx, regular_obj);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSClassTest, GetOpaqueWithContext) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  JSClassID class_id = taro_js_new_class_id();
  JSClassDef class_def = {
      .class_name = "TestClass",
      .finalizer = test_class_finalizer,
      .gc_mark = test_class_gc_mark,
  };
  taro_js_new_class(rt, class_id, &class_def);

  JSValue obj = taro_js_new_object_class(ctx, class_id);

  TestData* data = (TestData*)js_malloc(ctx, sizeof(TestData));
  data->value = 123;
  taro_js_set_opaque(obj, data);

  TestData* retrieved = (TestData*)taro_js_get_opaque(ctx, obj, class_id);
  EXPECT_NE(retrieved, nullptr);
  EXPECT_EQ(retrieved->value, 123);

  JS_FreeValue(ctx, obj);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSClassTest, EdgeCases) {
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  JSValue number = JS_NewInt32(ctx, 42);
  EXPECT_FALSE(taro_js_is_object_of_class(number, JS_CLASS_OBJECT));

  // 测试不存在的类ID
  JSValue obj = JS_NewObject(ctx);
  JSClassID invalid_id = 9999; // 假设这是一个无效的ID
  EXPECT_FALSE(taro_js_is_object_of_class(obj, invalid_id));

  // 测试从非对象获取不透明数据
  void* opaque = taro_js_get_opaque(number, JS_CLASS_OBJECT);
  EXPECT_EQ(opaque, nullptr);

  // 测试从错误类型的对象获取不透明数据
  JSClassID class_id = taro_js_new_class_id();
  JSClassDef class_def = {
      .class_name = "TestClass",
      .finalizer = test_class_finalizer,
      .gc_mark = test_class_gc_mark,
  };
  taro_js_new_class(rt, class_id, &class_def);

  void* wrong_opaque = taro_js_get_opaque(obj, class_id);
  EXPECT_EQ(wrong_opaque, nullptr);

  JS_FreeValue(ctx, number);
  JS_FreeValue(ctx, obj);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}

TEST(TaroJSClassTest, ClassInheritance) {
  // 这个测试假设我们可以设置类之间的继承关系
  JSRuntime* rt = JS_NewRuntime();
  ASSERT_NE(rt, nullptr);
  JSContext* ctx = JS_NewContext(rt);
  ASSERT_NE(ctx, nullptr);

  JSClassID parent_id = taro_js_new_class_id();
  JSClassDef parent_def = {
      .class_name = "ParentClass",
      .finalizer = test_class_finalizer,
      .gc_mark = test_class_gc_mark,
  };
  taro_js_new_class(rt, parent_id, &parent_def);

  JSClassID child_id = taro_js_new_class_id();
  JSClassDef child_def = {
      .class_name = "ChildClass",
      .finalizer = test_class_finalizer,
      .gc_mark = test_class_gc_mark,
  };
  taro_js_new_class(rt, child_id, &child_def);

  JSValue parent_obj = taro_js_new_object_class(ctx, parent_id);
  JSValue child_obj = taro_js_new_object_class(ctx, child_id);

  EXPECT_TRUE(taro_js_is_object_of_class(parent_obj, parent_id));
  EXPECT_TRUE(taro_js_is_object_of_class(child_obj, child_id));

  // 子类对象不是父类的实例（除非我们设置了继承关系）
  EXPECT_FALSE(taro_js_is_object_of_class(child_obj, parent_id));

  JS_FreeValue(ctx, parent_obj);
  JS_FreeValue(ctx, child_obj);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
}
