cmake_minimum_required(VERSION 3.16.5)
project(QUICKJS_TEST LANGUAGES CXX C)

set(TD_QUICKJS_CLI ON)

include(${CMAKE_SOURCE_DIR}/../CMakeLists.txt)

add_executable(qjsc ../qjsc.c)
target_link_libraries(qjsc quickjs-libc)
target_compile_definitions(qjsc PRIVATE ${COMMON_DEFINES} ${QJS_CONFIG})

add_custom_command(
    TARGET qjsc POST_BUILD
    COMMAND ${QJSC_EXE} -c -o ${CMAKE_SOURCE_DIR}/repl.c -m ${CMAKE_SOURCE_DIR}/repl.js
)

add_executable(qjs ../qjs.c ${CMAKE_SOURCE_DIR}/repl.c)
target_link_libraries(qjs quickjs-libc)
target_compile_definitions(qjs PRIVATE ${COMMON_DEFINES})

if(CMAKE_BUILD_TYPE MATCHES Debug OR TARO_DEV)
  add_executable(run-test262 run-test262.c)
  target_link_libraries(run-test262 quickjs-libc)
  target_compile_definitions(run-test262 PRIVATE ${COMMON_DEFINES})

  # 添加测试
  enable_testing()

  # 查找 GTest
  find_package(GTest REQUIRED)
  include_directories(${GTEST_INCLUDE_DIRS})

  # 查找 GMock 库 (解决 UnorderedElementsAreMatcherImplBase 错误)
  find_library(GMOCK_LIBRARY gmock PATHS ${HOMEBREW_PREFIX}/lib)
  find_library(GMOCK_MAIN_LIBRARY gmock_main PATHS ${HOMEBREW_PREFIX}/lib)

  if(NOT GMOCK_LIBRARY)
      message(FATAL_ERROR "GMock library not found. Please install: brew install googletest")
  endif()

  # 输出 GMock 库信息
  message(STATUS "Found GMock: ${GMOCK_LIBRARY}")
  message(STATUS "Found GMock Main: ${GMOCK_MAIN_LIBRARY}")

  # 查找 glog 库
  find_package(glog REQUIRED)
  if(NOT glog_FOUND)
      find_library(GLOG_LIBRARY glog PATHS ${HOMEBREW_PREFIX}/lib)
      if(NOT GLOG_LIBRARY)
          message(FATAL_ERROR "glog library not found. Please install: brew install glog")
      endif()
      message(STATUS "Found glog: ${GLOG_LIBRARY}")
  else()
      message(STATUS "Found glog: ${glog_VERSION}")
  endif()

  list(APPEND COMMON_LINK_LIBRARIES
      ${GTEST_BOTH_LIBRARIES}
      ${GMOCK_LIBRARY}
      ${GMOCK_MAIN_LIBRARY})

  # 如果找到了 glog 通过 find_package，使用目标方式链接
  if(glog_FOUND)
      list(APPEND COMMON_LINK_LIBRARIES glog::glog)
  else()
      # 否则使用老式方式链接
      list(APPEND COMMON_LINK_LIBRARIES ${GLOG_LIBRARY})
  endif()

  add_executable(extension_test
      extension/settup.cpp
      extension/js_array-test.cpp
      extension/js_big_num-test.cpp
      extension/js_class-test.cpp
      extension/js_error-test.cpp
      extension/js_json-test.cpp
      extension/js_module-test.cpp
      extension/js_object-test.cpp
      extension/js_promise-test.cpp
      extension/js_proxy-test.cpp
      extension/js_string-test.cpp
      extension/js_symbol-test.cpp
      extension/js_type-test.cpp)
  target_link_libraries(extension_test quickjs-libc ${COMMON_LINK_LIBRARIES})
  add_test(NAME ExtensionTest_Array COMMAND extension_test --gtest_filter=TaroJSArrayTest.*)
  add_test(NAME ExtensionTest_BigInt COMMAND extension_test --gtest_filter=TaroJSBigNumTest.*)
  add_test(NAME ExtensionTest_Class COMMAND extension_test --gtest_filter=TaroJSClassTest.*)
  add_test(NAME ExtensionTest_Error COMMAND extension_test --gtest_filter=TaroJSErrorTest.*)
  add_test(NAME ExtensionTest_Json COMMAND extension_test --gtest_filter=TaroJSJsonTest.*)
  add_test(NAME ExtensionTest_Module COMMAND extension_test --gtest_filter=TaroJSModuleTest.*)
  add_test(NAME ExtensionTest_Object COMMAND extension_test --gtest_filter=TaroJSObjectTest.*)
  add_test(NAME ExtensionTest_Promise COMMAND extension_test --gtest_filter=TaroJSPromiseTest.*)
  add_test(NAME ExtensionTest_Proxy COMMAND extension_test --gtest_filter=TaroJSProxyTest.*)
  add_test(NAME ExtensionTest_String COMMAND extension_test --gtest_filter=TaroJSStringTest.*)
  add_test(NAME ExtensionTest_Symbol COMMAND extension_test --gtest_filter=TaroJSSymbolTest.*)
  add_test(NAME ExtensionTest_Type COMMAND extension_test --gtest_filter=TaroJSTypeTest.*)

  # 显示调试信息
  message(STATUS "GTEST_INCLUDE_DIRS: ${GTEST_INCLUDE_DIRS}")
  message(STATUS "GTEST_BOTH_LIBRARIES: ${GTEST_BOTH_LIBRARIES}")
  message(STATUS "HOMEBREW_PREFIX: ${HOMEBREW_PREFIX}")
endif()
