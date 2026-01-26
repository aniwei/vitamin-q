#include "QuickJS/extension/taro_js_bytecode.h"
#include "QuickJS/quickjs.h"
#include "../core/types.h"
#include "../core/string-utils.h"
#include "../core/parser.h"
#include <cstdio>
#include <string>
#include <sstream>
#include <iomanip>


int taro_bc_get_version() {
  return BC_VERSION;
}

int taro_bc_get_binary_version(std::string input) {
  if (input.empty())
    return -1;

  const uint8_t* buf = reinterpret_cast<const uint8_t*>(input.c_str());
  return taro_bc_get_binary_version(buf, input.length());
}

int taro_bc_get_binary_version(const uint8_t* buf, size_t buf_len) {
  if (!buf || buf_len < 1) {
    return -1;
  }

  return buf[0];
}

int taro_bc_get_binary_compatible(std::string input) {
  if (input.empty())
    return -1;

  const uint8_t* buf = reinterpret_cast<const uint8_t*>(input.c_str());
  return taro_bc_get_binary_compatible(buf, input.length());
}

int taro_bc_get_binary_compatible(const uint8_t* buf, size_t buf_len) {
  return taro_bc_get_binary_version(buf, buf_len) == BC_VERSION ? 0 : -1;
}


#ifdef DUMP_BYTECODE
static void taro_dump_function_header(JSContext* ctx, JSFunctionBytecode* b, std::ostringstream& ss) {
  if (!b) return;
  char atom_buf[ATOM_GET_STR_BUF_SIZE];
  const char* str = nullptr;

  if (b->has_debug && b->debug.filename != JS_ATOM_NULL) {
    int col_num = 0;
    int line_num = 1; /* 简化：未逐条还原 pc2line */
    str = JS_AtomGetStr(ctx, atom_buf, sizeof(atom_buf), b->debug.filename);
    if (str) ss << str << ":" << line_num << ":" << col_num << ": ";
  }

  str = JS_AtomGetStr(ctx, atom_buf, sizeof(atom_buf), b->func_name);
  // 生成器函数在名称前输出一个 '*'
  ss << "function: "
    << (b->func_kind == JS_FUNC_GENERATOR ? "*" : "")
    << (str ? str : "<anon>") << "\n";

  if (b->js_mode) {
    ss << "  mode:";
    if (b->js_mode & JS_MODE_STRICT) ss << " strict";
    ss << "\n";
  }

  if (b->arg_count && b->vardefs) {
    ss << "  args:";
    for (int i = 0; i < b->arg_count; i++) {
      ss << " " << JS_AtomGetStr(ctx, atom_buf, sizeof(atom_buf), b->vardefs[i].var_name);
    }
    ss << "\n";
  }

  if (b->var_count && b->vardefs) {
    ss << "  locals:\n";
    for (int i = 0; i < b->var_count; i++) {
      JSVarDef* vd = &b->vardefs[b->arg_count + i];
      const char* kind = vd->var_kind == JS_VAR_CATCH ? "catch"
                         : (vd->var_kind == JS_VAR_FUNCTION_DECL || vd->var_kind == JS_VAR_NEW_FUNCTION_DECL) ? "function"
                         : vd->is_const   ? "const"
                         : vd->is_lexical ? "let"
                                          : "var";
      ss << std::setw(5) << i << ": " << kind << " "
         << JS_AtomGetStr(ctx, atom_buf, sizeof(atom_buf), vd->var_name);
      if (vd->scope_level) ss << " [level:" << vd->scope_level << " next:" << vd->scope_next << "]";
      ss << "\n";
    }
  }

  if (b->closure_var_count && b->closure_var) {
    ss << "  closure vars:\n";
    for (int i = 0; i < b->closure_var_count; i++) {
      JSClosureVar* cv = &b->closure_var[i];
      ss << std::setw(5) << i << ": "
         << JS_AtomGetStr(ctx, atom_buf, sizeof(atom_buf), cv->var_name) << " "
         << (cv->is_local ? "local" : "parent") << " "
         << (cv->is_arg ? "arg" : "loc") << cv->var_idx << " "
         << (cv->is_const ? "const" : (cv->is_lexical ? "let" : "var"))
         << "\n";
    }
  }

  ss << "  stack_size: " << b->stack_size << "\n";
}

static void taro_dump_opcodes(JSContext* ctx, JSFunctionBytecode* b, std::ostringstream& ss) {
  // 近似版：参考 opcode_info/short_opcode_info 与 fmt 解码立即数
  const uint8_t* bc = b->byte_code_buf;
  int len = b->byte_code_len;
  int pc = 0;
  while (pc < len) {
    uint8_t op = bc[pc];
    const JSOpCode* oi = &short_opcode_info(op);
    if (oi->size == 0) break; // unknown
    ss << std::setw(4) << pc << " ";
#ifdef DUMP_BYTECODE
    ss << oi->name;
#else
    ss << "OP_" << int(op);
#endif
    // 粗略按 fmt 打印立即数（覆盖常见几类）
    switch (oi->fmt) {
      case OP_FMT_u8: {
        if (pc + 1 < len) { ss << "  " << std::dec << int(bc[pc+1]); }
        break;
      }
      case OP_FMT_i8: {
        if (pc + 1 < len) { int8_t v = (int8_t)bc[pc+1]; ss << "  " << int(v); }
        break;
      }
      case OP_FMT_u16: {
        if (pc + 2 < len) { uint16_t v = bc[pc+1] | (bc[pc+2] << 8); ss << "  " << v; }
        break;
      }
      case OP_FMT_i16: {
        if (pc + 2 < len) { int16_t v = bc[pc+1] | (bc[pc+2] << 8); ss << "  " << v; }
        break;
      }
      case OP_FMT_i32: {
        if (pc + 4 < len) { int32_t v = bc[pc+1] | (bc[pc+2] << 8) | (bc[pc+3] << 16) | (bc[pc+4] << 24); ss << "  " << v; }
        break;
      }
      case OP_FMT_atom: {
        if (pc + 4 < len) {
          uint32_t a = bc[pc+1] | (bc[pc+2] << 8) | (bc[pc+3] << 16) | (bc[pc+4] << 24);
          char atom_buf[ATOM_GET_STR_BUF_SIZE];
          const char* aname = JS_AtomGetStr(ctx, atom_buf, sizeof(atom_buf), (JSAtom)a);
          ss << "  atom=" << a;
          if (aname) ss << " (" << aname << ")";
        }
        break;
      }
      case OP_FMT_atom_u8: {
        if (pc + 5 < len) {
          uint32_t a = bc[pc+1] | (bc[pc+2] << 8) | (bc[pc+3] << 16) | (bc[pc+4] << 24);
          uint8_t f = bc[pc+5];
          char atom_buf[ATOM_GET_STR_BUF_SIZE];
          const char* aname = JS_AtomGetStr(ctx, atom_buf, sizeof(atom_buf), (JSAtom)a);
          ss << "  atom=" << a;
          if (aname) ss << " (" << aname << ")";
          ss << " flags=" << int(f);
        }
        break;
      }
      case OP_FMT_label: {
        if (pc + 4 < len) { int32_t rel = bc[pc+1] | (bc[pc+2] << 8) | (bc[pc+3] << 16) | (bc[pc+4] << 24); ss << "  offset=" << rel; }
        break;
      }
      case OP_FMT_label8: {
        if (pc + 1 < len) { int8_t rel = (int8_t)bc[pc+1]; ss << "  offset=" << int(rel); }
        break;
      }
      default:
        break;
    }
    ss << "\n";
    pc += oi->size;
  }
}

static void taro_dump_function_bytecode(JSContext* ctx, JSFunctionBytecode* b, std::ostringstream& ss) {
  taro_dump_function_header(ctx, b, ss);
  ss << "  opcodes (" << b->byte_code_len << " bytes):\n";
  taro_dump_opcodes(ctx, b, ss);
}

static void taro_dump_value(JSContext* ctx, JSValueConst obj, std::ostringstream& ss) {
  int tag = JS_VALUE_GET_TAG(obj);
  if (tag == JS_TAG_FUNCTION_BYTECODE) {
    JSFunctionBytecode* b = (JSFunctionBytecode*)JS_VALUE_GET_PTR(obj);
    if (b) taro_dump_function_bytecode(ctx, b, ss);
    ss << "TTT";
    return;
  }
  if (tag == JS_TAG_MODULE) {
    JSModuleDef* m = (JSModuleDef*)JS_VALUE_GET_PTR(obj);
    if (!m) return;
    JSValue func_obj = m->func_obj;
    int ftag = JS_VALUE_GET_TAG(func_obj);
    if (ftag == JS_TAG_FUNCTION_BYTECODE) {
      JSFunctionBytecode* b = (JSFunctionBytecode*)JS_VALUE_GET_PTR(func_obj);
      if (b) taro_dump_function_bytecode(ctx, b, ss);
      return;
    }
    if (ftag == JS_TAG_OBJECT) {
      JSObject* o = JS_VALUE_GET_OBJ(func_obj);
      if (!o) return;
      JSFunctionBytecode* b = o->u.func.function_bytecode;
      if (b) taro_dump_function_bytecode(ctx, b, ss);
      return;
    }
    /* fallback: nothing to dump */
  }
}

std::string taro_js_dump_function_bytecode_bin(const uint8_t* buf, size_t buf_len) {
  if (!buf || buf_len == 0) return std::string();

  JSRuntime* rt = JS_NewRuntime();
  if (!rt) return std::string();
  JSContext* ctx = JS_NewContext(rt);
  if (!ctx) { JS_FreeRuntime(rt); return std::string(); }

  JSValue obj = JS_ReadObject(ctx, buf, buf_len, JS_READ_OBJ_BYTECODE);
  if (JS_VALUE_GET_TAG(obj) == JS_TAG_EXCEPTION) {
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    return std::string();
  }

  std::ostringstream ss;
  taro_dump_value(ctx, obj, ss);

  JS_FreeValue(ctx, obj);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);
  return ss.str();
}
#endif // DUMP_BYTECODE