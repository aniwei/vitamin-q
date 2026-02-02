cmake_minimum_required(VERSION 3.22.1)
project(quickjs_bytecode)

set(CMAKE_CXX_STANDARD 20)

file(GLOB SOURCES
    *.cpp
    *.h
)

add_subdirectory(${CMAKE_CURRENT_LIST_DIR}/../
    ${CMAKE_BINARY_DIR}/quickjs-build)
include_directories(${CMAKE_CURRENT_LIST_DIR}/../include)
set(LIBRARY_OUTPUT_PATH ${PROJECT_SOURCE_DIR}/lib)
set(EXECUTABLE_OUTPUT_PATH ${PROJECT_SOURCE_DIR}/output)

add_executable(quickjs_wasm ${SOURCES})
set_target_properties(quickjs_wasm PROPERTIES OUTPUT_NAME "quickjs_wasm")

target_link_options(quickjs_wasm PRIVATE
    -sEXPORT_NAME=QuickJSBytecode
    -sMODULARIZE=1
    -sEXPORT_ES6=0
    -sWASM=1
    -sENVIRONMENT=node
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=268435456
    -sASSERTIONS=1
    -sNO_DISABLE_EXCEPTION_CATCHING
    -sMALLOC=emmalloc
    --bind
    --no-entry
)

target_link_libraries(quickjs_wasm PRIVATE quickjs-libc)

# Ensure dump bytecode utilities are compiled
target_compile_definitions(quickjs PRIVATE DUMP_BYTECODE=1)
target_compile_definitions(quickjs_wasm PRIVATE DUMP_BYTECODE=1)

# ───────────────────────────── DWARF debug options ─────────────────────────────
set(QJS_DEBUG_DWARF "0" CACHE STRING "Enable DWARF debug info (0/1)")
set_property(CACHE QJS_DEBUG_DWARF PROPERTY STRINGS "0" "1")

set(QJS_SEPARATE_DWARF "0" CACHE STRING "Enable separate DWARF output (0/1)")
set_property(CACHE QJS_SEPARATE_DWARF PROPERTY STRINGS "0" "1")

set(QJS_SEPARATE_DWARF_URL "quickjs_wasm.debug.wasm" CACHE STRING "Separate DWARF URL")

set(QJS_FNO_INLINE "0" CACHE STRING "Disable inlining for debug (0/1)")
set_property(CACHE QJS_FNO_INLINE PROPERTY STRINGS "0" "1")

if(QJS_DEBUG_DWARF STREQUAL "1")
    target_compile_options(quickjs PRIVATE -g)
    target_compile_options(quickjs_wasm PRIVATE -g)
    target_link_options(quickjs_wasm PRIVATE -g)
endif()

if(QJS_SEPARATE_DWARF STREQUAL "1")
    target_compile_options(quickjs PRIVATE -gseparate-dwarf)
    target_compile_options(quickjs_wasm PRIVATE -gseparate-dwarf)
    target_link_options(quickjs_wasm PRIVATE -gseparate-dwarf -sSEPARATE_DWARF_URL=${QJS_SEPARATE_DWARF_URL})
endif()

if(QJS_FNO_INLINE STREQUAL "1")
    target_compile_options(quickjs PRIVATE -fno-inline)
    target_compile_options(quickjs_wasm PRIVATE -fno-inline)
endif()

# ─────────────────────────── QTS tracing (optional) ───────────────────────────
# These are intended for debugging/verification only. Default is disabled.
# Use numeric 0/1 to avoid toolchain differences with ON/OFF.
set(QTS_TRACE_ENABLED "0" CACHE STRING "Enable QTS trace logs (0/1)")
set_property(CACHE QTS_TRACE_ENABLED PROPERTY STRINGS "0" "1")

set(QTS_TRACE_LEVEL "1" CACHE STRING "QTS trace verbosity level (1..3)")
set_property(CACHE QTS_TRACE_LEVEL PROPERTY STRINGS "1" "2" "3")

set(QTS_TRACE_EMIT "" CACHE STRING "Override QTS_TRACE_EMIT (empty=default, else 0/1)")
set(QTS_TRACE_VARIABLE "" CACHE STRING "Override QTS_TRACE_VARIABLE (empty=default, else 0/1)")
set(QTS_TRACE_CLOSURE "" CACHE STRING "Override QTS_TRACE_CLOSURE (empty=default, else 0/1)")
set(QTS_TRACE_LABEL "" CACHE STRING "Override QTS_TRACE_LABEL (empty=default, else 0/1)")
set(QTS_TRACE_STACK "" CACHE STRING "Override QTS_TRACE_STACK (empty=default, else 0/1)")
set(QTS_TRACE_PC2LINE "" CACHE STRING "Override QTS_TRACE_PC2LINE (empty=default, else 0/1)")
set(QTS_TRACE_SCOPE "" CACHE STRING "Override QTS_TRACE_SCOPE (empty=default, else 0/1)")
set(QTS_TRACE_ASSIGN "" CACHE STRING "Override QTS_TRACE_ASSIGN (empty=default, else 0/1)")

set(_QTS_TRACE_DEFS
        QTS_TRACE_ENABLED=${QTS_TRACE_ENABLED}
        QTS_TRACE_LEVEL=${QTS_TRACE_LEVEL}
)

foreach(_k IN ITEMS EMIT VARIABLE CLOSURE LABEL STACK PC2LINE SCOPE ASSIGN)
    if(NOT "${QTS_TRACE_${_k}}" STREQUAL "")
        list(APPEND _QTS_TRACE_DEFS QTS_TRACE_${_k}=${QTS_TRACE_${_k}})
    endif()
endforeach()

target_compile_definitions(quickjs PRIVATE ${_QTS_TRACE_DEFS})
target_compile_definitions(quickjs_wasm PRIVATE ${_QTS_TRACE_DEFS})
