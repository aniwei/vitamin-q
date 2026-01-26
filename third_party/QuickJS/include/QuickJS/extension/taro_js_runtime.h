#pragma once

#include "QuickJS/common.h"

#ifdef __cplusplus
typedef struct JSCFunctionListEntry JSCFunctionListEntry;
void taro_js_set_property_function_list(
    JSContext* ctx,
    JSValueConst obj,
    const JSCFunctionListEntry* tab,
    int len);

JSAtom taro_js_find_atom(
    JSContext* ctx,
    const char* name);

JSValue taro_js_get_this(JSContext* ctx, JSValueConst thisVal);

int taro_js_ref_count(JSValueConst val);

#endif
