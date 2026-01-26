#include "QuickJS/extension/taro_js_function.h"
#include "QuickJS/quickjs.h"

#include "../core/builtins/js-function.h"
#include "../core/common.h"


JSValue taro_js_function_to_string(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  return js_function_toString(ctx, this_val, argc, argv);
}

JSValue taro_js_function_call(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  return js_function_call(ctx, this_val, argc, argv);
}

JSValue taro_js_function_apply(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic) {
  return js_function_apply(ctx, this_val, argc, argv, magic);
}

JSValue taro_js_function_bind(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  return js_function_bind(ctx, this_val, argc, argv);
}

JSValue taro_js_function_has_instance(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  return js_function_hasInstance(ctx, this_val, argc, argv);
}

JSValue taro_js_function_filename(
    JSContext* ctx,
    JSValueConst this_val) {
  return js_function_proto_fileName(ctx, this_val);
}

JSValue taro_js_function_line_number(
    JSContext* ctx,
    JSValueConst this_val) {
  return js_function_proto_lineNumber(ctx, this_val, 0);
}

JSValue taro_js_function_column_number(
    JSContext* ctx,
    JSValueConst this_val) {
  return js_function_proto_lineNumber(ctx, this_val, 1);
}
