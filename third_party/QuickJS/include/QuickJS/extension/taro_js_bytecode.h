#pragma once

#include <cstdint>
#include <string>

#ifdef CONFIG_BIGNUM
#define BC_VERSION 0x45
#else
#define BC_VERSION 5
#endif

typedef enum BCTagEnum {
  BC_TAG_NULL = 1,
  BC_TAG_UNDEFINED,
  BC_TAG_BOOL_FALSE,
  BC_TAG_BOOL_TRUE,
  BC_TAG_INT32,
  BC_TAG_FLOAT64,
  BC_TAG_STRING,
  BC_TAG_OBJECT,
  BC_TAG_ARRAY,
  BC_TAG_BIG_INT,
  BC_TAG_TEMPLATE_OBJECT,
  BC_TAG_FUNCTION_BYTECODE,
  BC_TAG_MODULE,
  BC_TAG_TYPED_ARRAY,
  BC_TAG_ARRAY_BUFFER,
  BC_TAG_SHARED_ARRAY_BUFFER,
  BC_TAG_DATE,
  BC_TAG_OBJECT_VALUE,
  BC_TAG_OBJECT_REFERENCE,
} BCTagEnum;

int taro_bc_get_version();

#ifdef __cplusplus
int taro_bc_get_binary_version(std::string input);
int taro_bc_get_binary_version(const uint8_t* buf, size_t buf_len);

int taro_bc_get_binary_compatible(std::string input);
int taro_bc_get_binary_compatible(const uint8_t* buf, size_t buf_len);

#ifdef DUMP_BYTECODE
// Return a human-readable disassembly text for the given QuickJS bytecode buffer.
std::string taro_js_dump_function_bytecode_bin(const uint8_t* buf, size_t buf_len);
#endif // DUMP_BYTECODE
#endif // __cplusplus
