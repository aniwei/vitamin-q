#pragma once

#include "QuickJS/common.h"

typedef int JSModuleInitFunc(JSContext* ctx, JSModuleDef* m);
typedef int JSModuleInitDataFunc(JSContext* ctx, JSModuleDef* m, void* opaque);
