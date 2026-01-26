set(QUICKJS_LIB_SOURCES
    cutils.c
    dtoa.c
    libregexp.c
    libunicode.c
    core/string-utils.c
    core/function.c
    core/memory.c
    core/bytecode.cpp
    core/object.c
    core/exception.c
    core/gc.c
    core/malloc.c
    core/shape.c
    core/parser.c
    core/convertion.c
    core/runtime.c
    core/module.c
    core/builtins/js-array.c
    core/builtins/js-async-function.c
    core/builtins/js-async-generator.c
    core/builtins/js-atomics.c
    core/builtins/js-big-num.c
    core/builtins/js-boolean.c
    core/builtins/js-date.c
    core/builtins/js-function.c
    core/builtins/js-generator.c
    core/builtins/js-json.c
    core/builtins/js-map.c
    core/builtins/js-math.c
    core/builtins/js-number.c
    core/builtins/js-object.c
    core/builtins/js-closures.c
    core/builtins/js-operator.c
    core/builtins/js-promise.c
    core/builtins/js-proxy.c
    core/builtins/js-reflect.c
    core/builtins/js-regexp.c
    core/builtins/js-string.c
    core/builtins/js-symbol.c
    core/builtins/js-typed-array.c
    core/builtins/js-weak-ref.c
    core/ic.cpp
    extension/common.cpp
    extension/taro_js_array.cpp
    extension/taro_js_big_num.cpp
    extension/taro_js_bytecode.cpp
    extension/taro_js_class.cpp
    extension/taro_js_error.cpp
    extension/taro_js_json.cpp
    extension/taro_js_module.cpp
    extension/taro_js_object.cpp
    extension/taro_js_promise.cpp
    extension/taro_js_proxy.cpp
    extension/taro_js_string.cpp
    extension/taro_js_symbol.cpp
    extension/taro_js_type.cpp
    extension/taro_js_runtime.cpp
    extension/taro_js_function.cpp
)
if(CMAKE_BUILD_TYPE MATCHES Debug OR TARO_DEV)
    list(APPEND QUICKJS_LIB_SOURCES extension/debugger.cpp)
    if(TARO_DEV)
        add_compile_options(${COMPILE_FLAGS} -DDUMP_LEAKS -DANDROID_PRINT)
    endif()
endif()
add_library(quickjs ${QUICKJS_LIB_SOURCES})

set(COMPILE_FLAGS ${COMPILE_FLAGS} -O3)

add_compile_options(${COMPILE_FLAGS})
target_compile_definitions(quickjs PRIVATE ${COMMON_DEFINES})
