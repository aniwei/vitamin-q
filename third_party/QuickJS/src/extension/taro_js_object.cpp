#include "QuickJS/extension/taro_js_object.h"

#include "../core/builtins/js-object.h"
#include "../core/common.h"

JSValue taro_js_object_assign(
    JSContext* ctx,
    JSValueConst target,
    int sourcesCount,
    JSValueConst* sources) {
  int argc = 1 + sourcesCount;
  JSValueConst* argv = (JSValueConst*)alloca(argc * sizeof(JSValueConst));
  argv[0] = target;
  for (int i = 0; i < sourcesCount; i++) {
    argv[i + 1] = sources[i];
  }
  return js_object_assign(ctx, JS_NULL, argc, argv);
}

JSValue taro_js_object_assign(
    JSContext* ctx,
    JSValueConst target,
    JSValueConst source) {
  JSValueConst sources[2] = {target, source};
  return js_object_assign(ctx, JS_NULL, 2, sources);
}

JSValue taro_js_object_create(
    JSContext* ctx,
    JSValueConst proto,
    JSValueConst propertiesObject) {
  JSValueConst argv[2];
  int argc = 1;
  argv[0] = proto;

  if (!JS_IsUninitialized(propertiesObject)) {
    argv[argc++] = propertiesObject;
  }
  return js_object_create(ctx, JS_NULL, argc, argv);
}

JSValue taro_js_object_entries(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  int argc = 1;
  return js_object_keys(
      ctx, JS_NULL, argc, argv, JS_ITERATOR_KIND_KEY_AND_VALUE);
}

JSValue taro_js_object_keys(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  int argc = 1;
  return js_object_keys(ctx, JS_NULL, argc, argv, JS_ITERATOR_KIND_KEY);
}

JSValue taro_js_object_values(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  int argc = 1;
  return js_object_keys(ctx, JS_NULL, argc, argv, JS_ITERATOR_KIND_VALUE);
}

JSValue taro_js_object_to_string(JSContext* ctx, JSValueConst this_val) {
  return js_object_toString(ctx, this_val, 0, NULL);
}

JSValue taro_js_object_from_entries(JSContext* ctx, JSValueConst entries) {
  JSValueConst argv[1] = {entries};
  return js_object_fromEntries(ctx, JS_NULL, 1, argv);
}

JSValue
taro_js_object_has_own(JSContext* ctx, JSValueConst obj, JSValueConst prop) {
  JSValueConst argv[2] = {obj, prop};
  return js_object_hasOwn(ctx, JS_NULL, 2, argv);
}

JSValue taro_js_object_get_own_property_names(
    JSContext* ctx,
    JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  return js_object_getOwnPropertyNames(ctx, JS_NULL, 1, argv);
}

JSValue taro_js_object_get_own_property_descriptors(
    JSContext* ctx,
    JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  return js_object_getOwnPropertyDescriptors(ctx, JS_NULL, 1, argv);
}

JSValue taro_js_object_get_own_property_descriptor(
    JSContext* ctx,
    JSValueConst obj,
    JSValueConst prop) {
  JSValueConst argv[2] = {obj, prop};
  return js_object_getOwnPropertyDescriptor(ctx, JS_NULL, 2, argv, 0);
}

JSValue taro_js_object_define_properties(
    JSContext* ctx,
    JSValueConst obj,
    JSValueConst properties) {
  JSValueConst argv[2] = {obj, properties};
  return js_object_defineProperties(ctx, JS_NULL, 2, argv);
}

JSValue taro_js_object_define_property(
    JSContext* ctx,
    JSValueConst obj,
    JSValueConst prop,
    JSValueConst descriptor) {
  JSValueConst argv[3] = {obj, prop, descriptor};
  return js_object_defineProperty(ctx, JS_NULL, 3, argv, 0);
}

JSValue taro_js_object_freeze(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  return js_object_seal(ctx, JS_NULL, 1, argv, 1);
}

JSValue taro_js_object_seal(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  return js_object_seal(ctx, JS_NULL, 1, argv, 0);
}

JSValue taro_js_object_prevent_extensions(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  return js_object_preventExtensions(ctx, JS_NULL, 1, argv, 0);
}

JSValue
taro_js_object_is(JSContext* ctx, JSValueConst value1, JSValueConst value2) {
  JSValueConst argv[2] = {value1, value2};
  return js_object_is(ctx, JS_NULL, 2, argv);
}

JSValue taro_js_object_is_frozen(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  return js_object_isSealed(ctx, JS_NULL, 1, argv, 1);
}

JSValue taro_js_object_is_sealed(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  return js_object_isSealed(ctx, JS_NULL, 1, argv, 0);
}

JSValue taro_js_object_is_extensible(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  return js_object_isExtensible(ctx, JS_NULL, 1, argv, 0);
}

JSValue taro_js_object_set_prototype_of(JSContext* ctx, JSValueConst obj, JSValueConst proto) {
  JSValueConst argv[2] = {obj, proto};
  return js_object_setPrototypeOf(ctx, JS_NULL, 2, argv);
}

JSValue taro_js_object_get_prototype_of(JSContext* ctx, JSValueConst obj) {
  JSValueConst argv[1] = {obj};
  return js_object_getPrototypeOf(ctx, JS_NULL, 1, argv, 0);
}