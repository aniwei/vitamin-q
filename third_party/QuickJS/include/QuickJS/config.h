#pragma once

#ifdef _WIN32
#define _WIN32_WINNT 0x0600
#endif
// ios Debug flag
#if defined(DEBUG) || TARO_DEV
#define QUICKJS_DEBUG 1
#define QUICKJS_ENABLE_DEBUGGER 1
#else
#define QUICKJS_DEBUG 0
#endif
