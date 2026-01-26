#pragma once

#include <glog/logging.h>
#include <gmock/gmock.h>
#include <gtest/gtest.h>

#include "QuickJS/quickjs.h"

extern JSRuntime* rt;
extern JSContext* ctx;

// 帮助函数：运行JS表达式并返回结果
JSValue EvalJS(JSContext* ctx, const char* expr);

JSValue EvalJS(const char* expr);

// 帮助函数：将JSValue转换为int
int32_t JSToInt32(JSContext* ctx, JSValue val);

int32_t JSToInt32(JSValue val);

// 帮助函数：将JSValue转换为bool
bool JSToBool(JSContext* ctx, JSValue val);

bool JSToBool(JSValue val);

// 辅助函数 - 获取JS字符串的内容
std::string JSToString(JSContext* ctx, JSValueConst value);

std::string JSToString(JSValueConst value);

// 帮助函数：检查数组内容是否相等
bool CompareArrays(JSValue arr1, JSValue arr2);

// 辅助函数 - 测试JS数组长度和内容
void CheckJSArray(JSValueConst array, const std::vector<std::string>& expected);

void js_print_exception(JSContext* ctx, JSValueConst exception_val);
