#include "QuickJS/extension/taro_js_object.h"

#include "./settup.h"

// 测试 Object.create 方法
TEST(TaroJSObjectTest, Create) {
  // 使用 null 作为原型创建对象
  JSValue proto = JS_NULL;
  JSValue obj = taro_js_object_create(ctx, proto);
  EXPECT_TRUE(taro_is_object(obj));

  // 验证原型是 null
  JSValue getProto = JS_GetPrototype(ctx, obj);
  EXPECT_TRUE(taro_is_null(getProto));
  JS_FreeValue(ctx, getProto);
  JS_FreeValue(ctx, obj);

  // 使用 Object.prototype 创建对象
  JSValue objProto = JS_GetPropertyStr(ctx, JS_GetGlobalObject(ctx), "Object");
  JSValue objProtoProto = JS_GetPropertyStr(ctx, objProto, "prototype");
  obj = taro_js_object_create(ctx, objProtoProto);
  EXPECT_TRUE(taro_is_object(obj));

  // 验证原型是 Object.prototype
  getProto = JS_GetPrototype(ctx, obj);
  EXPECT_TRUE(JS_StrictEq(ctx, getProto, objProtoProto));

  JS_FreeValue(ctx, getProto);
  JS_FreeValue(ctx, objProtoProto);
  JS_FreeValue(ctx, objProto);
  JS_FreeValue(ctx, obj);
}

// 测试 Object.assign 方法
TEST(TaroJSObjectTest, Assign) {
  // 创建目标对象和源对象
  JSValue target = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, target, "a", JS_NewInt32(ctx, 1));

  JSValue source = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, source, "b", JS_NewInt32(ctx, 2));

  // 执行 assign 操作
  JSValue result = taro_js_object_assign(ctx, target, source);
  EXPECT_TRUE(JS_StrictEq(ctx, result, target));

  // 验证属性合并结果
  JSValue prop_a = JS_GetPropertyStr(ctx, result, "a");
  JSValue prop_b = JS_GetPropertyStr(ctx, result, "b");

  int32_t val_a, val_b;
  JS_ToInt32(ctx, &val_a, prop_a);
  JS_ToInt32(ctx, &val_b, prop_b);

  EXPECT_EQ(val_a, 1);
  EXPECT_EQ(val_b, 2);

  JS_FreeValue(ctx, prop_a);
  JS_FreeValue(ctx, prop_b);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, source);
}

// 测试 Object.keys, Object.values, Object.entries 方法
TEST(TaroJSObjectTest, KeysValuesEntries) {
  // 创建测试对象 { a: 1, b: 2 }
  JSValue obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "a", JS_NewInt32(ctx, 1));
  JS_SetPropertyStr(ctx, obj, "b", JS_NewInt32(ctx, 2));

  // 测试 keys
  JSValue keys = taro_js_object_keys(ctx, obj);
  EXPECT_TRUE(taro_is_array(ctx, keys));
  JSValue length = JS_GetPropertyStr(ctx, keys, "length");
  int32_t len;
  JS_ToInt32(ctx, &len, length);
  EXPECT_EQ(len, 2);
  JS_FreeValue(ctx, length);
  JS_FreeValue(ctx, keys);

  // 测试 values
  JSValue values = taro_js_object_values(ctx, obj);
  EXPECT_TRUE(taro_is_array(ctx, values));
  length = JS_GetPropertyStr(ctx, values, "length");
  JS_ToInt32(ctx, &len, length);
  EXPECT_EQ(len, 2);
  JS_FreeValue(ctx, length);
  JS_FreeValue(ctx, values);

  // 测试 entries
  JSValue entries = taro_js_object_entries(ctx, obj);
  EXPECT_TRUE(taro_is_array(ctx, entries));
  length = JS_GetPropertyStr(ctx, entries, "length");
  JS_ToInt32(ctx, &len, length);
  EXPECT_EQ(len, 2);
  JS_FreeValue(ctx, length);
  JS_FreeValue(ctx, entries);

  JS_FreeValue(ctx, obj);
}

// 测试 Object.hasOwn 方法
TEST(TaroJSObjectTest, HasOwn) {
  // 创建测试对象
  JSValue obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "a", JS_NewInt32(ctx, 1));

  // 测试存在的属性
  JSValue prop_exists = JS_NewString(ctx, "a");
  JSValue has_a = taro_js_object_has_own(ctx, obj, prop_exists);
  EXPECT_TRUE(JS_ToBool(ctx, has_a));
  JS_FreeValue(ctx, has_a);
  JS_FreeValue(ctx, prop_exists);

  // 测试不存在的属性
  JSValue prop_not_exists = JS_NewString(ctx, "b");
  JSValue has_b = taro_js_object_has_own(ctx, obj, prop_not_exists);
  EXPECT_FALSE(JS_ToBool(ctx, has_b));
  JS_FreeValue(ctx, has_b);
  JS_FreeValue(ctx, prop_not_exists);

  JS_FreeValue(ctx, obj);
}

// 测试 Object.defineProperty 和 Object.getOwnPropertyDescriptor 方法
TEST(TaroJSObjectTest, DefinePropertyAndDescriptor) {
  // 创建测试对象
  JSValue obj = JS_NewObject(ctx);

  // 创建属性描述符
  JSValue descriptor = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, descriptor, "value", JS_NewInt32(ctx, 42));
  JS_SetPropertyStr(ctx, descriptor, "writable", JS_FALSE);

  // 定义属性
  JSValue prop_name = JS_NewString(ctx, "answer");
  taro_js_object_define_property(ctx, obj, prop_name, descriptor);

  // 获取属性描述符
  JSValue desc =
      taro_js_object_get_own_property_descriptor(ctx, obj, prop_name);
  EXPECT_TRUE(taro_is_object(desc));

  // 验证描述符内容
  JSValue value = JS_GetPropertyStr(ctx, desc, "value");
  JSValue writable = JS_GetPropertyStr(ctx, desc, "writable");

  int32_t val;
  JS_ToInt32(ctx, &val, value);
  EXPECT_EQ(val, 42);
  EXPECT_FALSE(JS_ToBool(ctx, writable));

  JS_FreeValue(ctx, value);
  JS_FreeValue(ctx, writable);
  JS_FreeValue(ctx, desc);
  JS_FreeValue(ctx, prop_name);
  JS_FreeValue(ctx, descriptor);
  JS_FreeValue(ctx, obj);
}

// 测试 Object.freeze, Object.seal 和相关检查方法
TEST(TaroJSObjectTest, FreezeAndSeal) {
  // 创建测试对象
  JSValue obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "a", JS_NewInt32(ctx, 1));

  // 测试 freeze
  JSValue frozen = taro_js_object_freeze(ctx, obj);
  EXPECT_TRUE(JS_StrictEq(ctx, frozen, obj));

  // 检查是否已冻结
  JSValue is_frozen = taro_js_object_is_frozen(ctx, obj);
  EXPECT_TRUE(JS_ToBool(ctx, is_frozen));
  JS_FreeValue(ctx, is_frozen);

  // 检查是否已密封 (freeze 也会密封对象)
  JSValue is_sealed = taro_js_object_is_sealed(ctx, obj);
  EXPECT_TRUE(JS_ToBool(ctx, is_sealed));
  JS_FreeValue(ctx, is_sealed);

  // 检查是否可扩展 (freeze 会使对象不可扩展)
  JSValue is_extensible = taro_js_object_is_extensible(ctx, obj);
  EXPECT_FALSE(JS_ToBool(ctx, is_extensible));
  JS_FreeValue(ctx, is_extensible);

  JS_FreeValue(ctx, frozen);
  JS_FreeValue(ctx, obj);

  // 测试 seal
  obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "a", JS_NewInt32(ctx, 1));

  JSValue sealed = taro_js_object_seal(ctx, obj);
  EXPECT_TRUE(JS_StrictEq(ctx, sealed, obj));

  // 检查是否已密封
  is_sealed = taro_js_object_is_sealed(ctx, obj);
  EXPECT_TRUE(JS_ToBool(ctx, is_sealed));
  JS_FreeValue(ctx, is_sealed);

  // 检查是否可扩展 (seal 会使对象不可扩展)
  is_extensible = taro_js_object_is_extensible(ctx, obj);
  EXPECT_FALSE(JS_ToBool(ctx, is_extensible));
  JS_FreeValue(ctx, is_extensible);

  JS_FreeValue(ctx, sealed);
  JS_FreeValue(ctx, obj);
}

// 测试 Object.is 方法
TEST(TaroJSObjectTest, Is) {
  // 相同值
  JSValue a1 = JS_NewInt32(ctx, 42);
  JSValue a2 = JS_NewInt32(ctx, 42);
  JSValue result = taro_js_object_is(ctx, a1, a2);
  EXPECT_TRUE(JS_ToBool(ctx, result));
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, a1);
  JS_FreeValue(ctx, a2);

  // 不同值
  JSValue b1 = JS_NewInt32(ctx, 42);
  JSValue b2 = JS_NewInt32(ctx, 43);
  result = taro_js_object_is(ctx, b1, b2);
  EXPECT_FALSE(JS_ToBool(ctx, result));
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, b1);
  JS_FreeValue(ctx, b2);

  // NaN 应该等于自身
  JSValue nan1 = JS_NewFloat64(ctx, std::numeric_limits<double>::quiet_NaN());
  JSValue nan2 = JS_NewFloat64(ctx, std::numeric_limits<double>::quiet_NaN());
  result = taro_js_object_is(ctx, nan1, nan2);
  EXPECT_TRUE(JS_ToBool(ctx, result));
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, nan1);
  JS_FreeValue(ctx, nan2);
}

// 测试 Object.fromEntries 方法
TEST(TaroJSObjectTest, FromEntries) {
  // 创建一个包含entries的数组 [["a", 1], ["b", 2]]
  JSValue entries = JS_NewArray(ctx);

  JSValue entry1 = JS_NewArray(ctx);
  JS_SetPropertyUint32(ctx, entry1, 0, JS_NewString(ctx, "a"));
  JS_SetPropertyUint32(ctx, entry1, 1, JS_NewInt32(ctx, 1));

  JSValue entry2 = JS_NewArray(ctx);
  JS_SetPropertyUint32(ctx, entry2, 0, JS_NewString(ctx, "b"));
  JS_SetPropertyUint32(ctx, entry2, 1, JS_NewInt32(ctx, 2));

  JS_SetPropertyUint32(ctx, entries, 0, entry1);
  JS_SetPropertyUint32(ctx, entries, 1, entry2);

  // 转换为对象
  JSValue obj = taro_js_object_from_entries(ctx, entries);
  EXPECT_TRUE(taro_is_object(obj));

  // 验证属性
  JSValue prop_a = JS_GetPropertyStr(ctx, obj, "a");
  JSValue prop_b = JS_GetPropertyStr(ctx, obj, "b");

  int32_t val_a, val_b;
  JS_ToInt32(ctx, &val_a, prop_a);
  JS_ToInt32(ctx, &val_b, prop_b);

  EXPECT_EQ(val_a, 1);
  EXPECT_EQ(val_b, 2);

  JS_FreeValue(ctx, prop_a);
  JS_FreeValue(ctx, prop_b);
  JS_FreeValue(ctx, obj);
  JS_FreeValue(ctx, entries);
}

// 测试 Object.toString 方法
TEST(TaroJSObjectTest, ToString) {
  // 测试普通对象
  JSValue obj = JS_NewObject(ctx);
  JSValue str = taro_js_object_to_string(ctx, obj);

  const char* c_str = JS_ToCString(ctx, str);
  EXPECT_STREQ(c_str, "[object Object]");
  JS_FreeCString(ctx, c_str);

  JS_FreeValue(ctx, str);
  JS_FreeValue(ctx, obj);

  // 测试数组对象
  JSValue arr = JS_NewArray(ctx);
  str = taro_js_object_to_string(ctx, arr);

  c_str = JS_ToCString(ctx, str);
  EXPECT_STREQ(c_str, "[object Array]");
  JS_FreeCString(ctx, c_str);

  JS_FreeValue(ctx, str);
  JS_FreeValue(ctx, arr);
}
