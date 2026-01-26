cmake_minimum_required(VERSION 3.16.5)
project(QUICKJS)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(TD_QUICKJS_CLI    "Build TD QUICKJS CLI"   OFF)
option(ENABLE_MI_MALLOC  "Use mimalloc allocator" OFF)

if(ENABLE_MI_MALLOC)
  set(MI_OVERRIDE           OFF CACHE BOOL "" FORCE)
  set(MI_BUILD_SHARED       OFF CACHE BOOL "" FORCE)
  set(MI_BUILD_OBJECT       OFF CACHE BOOL "" FORCE)
  set(MI_BUILD_TESTS        OFF CACHE BOOL "" FORCE)
  set(MI_XMALLOC            ON  CACHE BOOL "" FORCE)
  set(MI_OPT_ARCH           OFF CACHE BOOL "" FORCE)
  set(MI_NO_OPT_ARCH        ON  CACHE BOOL "" FORCE)
  set(MI_LOCAL_DYNAMIC_TLS  ON  CACHE BOOL "" FORCE)

  add_definitions(-DENABLE_MI_MALLOC)

  # include(FetchContent)
  # FetchContent_Declare(
  #   MIMALLOC
  #   GIT_REPOSITORY git@github.com:microsoft/mimalloc.git
  #   GIT_TAG        v1.9.3
  # )
  # FetchContent_Populate(MIMALLOC)
  set(MIMALLOC_SOURCE_DIR ${CMAKE_CURRENT_LIST_DIR}/../mimalloc)
endif()

# add_definitions(-DENABLE_MEMORY_INTENSIVE_MODE)

include(CheckIPOSupported)
check_ipo_supported(RESULT supported OUTPUT error)
if(supported)
  set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)
endif()

set(EXECUTABLE_OUTPUT_PATH ${PROJECT_SOURCE_DIR}/bin)
if(TD_QUICKJS_CLI)
  set(LIBRARY_OUTPUT_PATH ${PROJECT_SOURCE_DIR}/lib)
endif()

include_directories(${CMAKE_CURRENT_LIST_DIR}/include)
if(ENABLE_MI_MALLOC)
  include_directories(${MIMALLOC_SOURCE_DIR}/include)
endif()

set(COMPILE_FLAGS -Wall -MMD -Wno-unused-command-line-argument)

if(CMAKE_BUILD_TYPE MATCHES Debug OR TARO_DEV)
  set(MI_ASAN ON)
  list(APPEND COMPILE_FLAGS -DTARO_DEV=1)

  if(TD_QUICKJS_CLI)
    list(APPEND COMPILE_FLAGS -g -fsanitize=address)
    list(APPEND CMAKE_C_FLAGS            -fsanitize=address)
    list(APPEND CMAKE_CXX_FLAGS          -fsanitize=address)
    list(APPEND CMAKE_EXE_LINKER_FLAGS   -fsanitize=address)
  endif()
else()
  list(APPEND COMPILE_FLAGS -O3)
endif()

add_compile_options(${COMPILE_FLAGS})

# ────────────────────────── 平台链接库 ────────────────────────────────
if(TD_QUICKJS_CLI)
  if(UNIX)
    set(LINK_LIBRARIES m pthread dl)
  elseif(WIN32)
    set(LINK_LIBRARIES m pthread)
  endif()
endif()

set(QJSC_CONFIG -DCONFIG_PREFIX="/usr/local" -DCONFIG_LTO)
set(QJSC_EXE "${EXECUTABLE_OUTPUT_PATH}/qjsc")

if(UNIX OR WIN32)
  set(QJS_CONFIG ${QJSC_CONFIG} -DCONFIG_CC="gcc")
else()
  set(QJS_CONFIG ${QJSC_CONFIG} -DCONFIG_CC="clang")
endif()

if(WIN32)
  set(QJSC_EXE "${QJSC_EXE}.exe")
endif()

file(READ "${CMAKE_CURRENT_LIST_DIR}/VERSION" QUICKJS_VERSION)
string(STRIP "${QUICKJS_VERSION}" QUICKJS_VERSION)

set(COMMON_DEFINES QUICKJS_VERSION="${QUICKJS_VERSION}" _GNU_SOURCE)
# if(TD_QUICKJS_CLI)
#   list(APPEND COMMON_DEFINES CONFIG_BIGNUM)
# endif()

add_subdirectory(${CMAKE_CURRENT_LIST_DIR}/src
                 ${CMAKE_BINARY_DIR}/quickjs-src)

if(ENABLE_MI_MALLOC)
  add_subdirectory(${MIMALLOC_SOURCE_DIR}
                   ${CMAKE_BINARY_DIR}/mimalloc-build)
  target_compile_options(mimalloc-static PRIVATE -Wno-unused-function)
  list(APPEND LINK_LIBRARIES mimalloc-static)
endif()

# ─────────────────────────── quickjs-libc ────────────────────────────
add_library(quickjs-libc STATIC
            ${CMAKE_CURRENT_LIST_DIR}/src/quickjs-libc.c)

target_link_libraries(quickjs-libc
                      quickjs
                      ${LINK_LIBRARIES})

target_compile_definitions(quickjs-libc PRIVATE ${COMMON_DEFINES})
