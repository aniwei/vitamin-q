#pragma once

#include <time.h>

#include "QuickJS/common.h"
#include "QuickJS/config.h"
#include "QuickJS/extension/common.h"

#if QUICKJS_ENABLE_DEBUGGER

#ifdef __cplusplus
extern "C" {
#endif

#define JS_DEBUGGER_STEP 1
#define JS_DEBUGGER_STEP_IN 2
#define JS_DEBUGGER_STEP_OUT 3
#define JS_DEBUGGER_STEP_CONTINUE 4
typedef int (
    *InterruptCallFun)(JSContext* context, void* udata, int timeout_ms);
typedef int (*NotifyEventFun)(
    JSContext* context,
    const char* command,
    int len,
    void* udata);
struct DebuggerSuspendedState;

typedef struct JSDebuggerLocation {
  JSAtom filename;
  int line;
  int column;
} JSDebuggerLocation;

typedef struct JSDebuggerInfo {
  // JSContext that is used to for the JSON transport and debugger state.
  JSContext* ctx;
  JSContext* debugging_ctx;

  int attempted_connect;
  int attempted_wait;
  int peek_ticks;
  int should_peek;
  char* message_buffer;
  int message_buffer_length;
  int is_debugging;
  int is_paused;

  // size_t (*transport_read)(void *udata, char* buffer, size_t length);
  // size_t (*transport_write)(void *udata, const char* buffer, size_t length);
  // size_t (*transport_peek)(void *udata);
  // void (*transport_close)(JSRuntime* rt, void *udata);
  void* transport_udata;
  InterruptCallFun interrupt_call;
  NotifyEventFun notify_fun;

  JSValue breakpoints;
  int exception_breakpoint;
  uint32_t breakpoints_dirty_counter;
  int stepping;
  JSDebuggerLocation step_over;
  int step_depth;
  int next_breakpoint_id;
  uint8_t* cur_pc;
  struct DebuggerSuspendedState* suspend_state;
} JSDebuggerInfo;

void js_debugger_new_context(JSContext* ctx);

void js_debugger_free_context(JSContext* ctx);

void js_debugger_check(JSContext* ctx, uint8_t* pc, int debugger_flag);

void js_debugger_report_load_event(JSContext* ctx, const char* filename);

void js_debugger_exception(JSContext* ctx);

void js_debugger_free(JSRuntime* rt, JSDebuggerInfo* info);

void js_debugger_terminal(JSContext* ctx);

void js_debugger_attach(
    JSContext* ctx,
    size_t (*transport_read)(void* udata, char* buffer, size_t length),
    size_t (*transport_write)(void* udata, const char* buffer, size_t length),
    size_t (*transport_peek)(void* udata),
    void (*transport_close)(JSRuntime* rt, void* udata),
    void* udata);
void js_debugger_connect(JSContext* ctx, const char* address);
int js_debugger_set_mode(JSContext* ctx, int mode, const char* address);
void js_debugger_wait_connection(JSContext* ctx, const char* address);
int js_debugger_is_transport_connected(JSRuntime* rt);

JSValue js_debugger_file_breakpoints(JSContext* ctx, const char* path);
void js_debugger_cooperate(JSContext* ctx);

// begin internal api functions
// these functions all require access to quickjs internal structures.

JSDebuggerInfo* js_debugger_info(JSRuntime* rt);

// this may be able to be done with an Error backtrace,
// but would be clunky and require stack string parsing.
uint32_t js_debugger_stack_depth(JSContext* ctx);
JSValue js_debugger_build_backtrace(JSContext* ctx, const uint8_t* cur_pc);
JSValue js_debugger_build_backtrace0(JSContext* ctx, const uint8_t* cur_pc, const char* reason);
JSValue js_debugger_build_backtrace1(JSContext* ctx, const uint8_t* cur_pc);
JSDebuggerLocation js_debugger_current_location(
    JSContext* ctx,
    const uint8_t* cur_pc);

// checks to see if a breakpoint exists on the current pc.
// calls back into js_debugger_file_breakpoints.
int js_debugger_check_breakpoint(
    JSContext* ctx,
    uint32_t current_dirty,
    const uint8_t* cur_pc);

int js_debugger_local_variables_count(JSContext* ctx, int stack_index);
int js_debugger_closure_variables_count(JSContext* ctx, int stack_index);
int js_debugger_local_variables_get(
    JSContext* ctx,
    int stack_index,
    int index,
    JSAtom* name,
    JSValue* value);
int js_debugger_closure_variables_get(
    JSContext* ctx,
    int stack_index,
    int index,
    JSAtom* name,
    JSValue* value);

JSValue js_debugger_local_variables(JSContext* ctx, int stack_index);
JSValue js_debugger_closure_variables(JSContext* ctx, int stack_index);

// evaluates an expression at any stack frame. JS_Evaluate* only evaluates at
// the top frame.
JSValue
js_debugger_evaluate(JSContext* ctx, int stack_index, JSValue expression);

int js_handle_debugger_messages(
    JSContext* ctx,
    const char* req_body,
    int req_len,
    char** rsp_body,
    int* rsp_len);

int js_debugger_add_breakpoint(
    JSContext* ctx,
    const char* path,
    int line,
    int column,
    int breakpoint_id);

void js_debugger_remove_breakpoint(JSContext* ctx, int breakpoint_id);

void js_debugger_remove_breakpoint_by_path(
    JSContext* ctx,
    const char* path,
    int breakpoint_id);

JSValue js_debugger_get_breakpoint(JSContext* ctx, char* path, int break_id);

int js_debugger_attach_funs(
    JSContext* ctx,
    InterruptCallFun aysnc_call,
    NotifyEventFun event_call,
    void* udata);

void frameobj_to_str(int32_t frame_id, int32_t obj_id, char* str);

void js_debugger_clear_all_breakpoints(JSContext* ctx);

#ifdef __cplusplus
}
#endif
#endif
