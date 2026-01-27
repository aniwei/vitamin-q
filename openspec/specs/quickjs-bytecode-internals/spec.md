# quickjs-bytecode-internals Specification

## Purpose
TBD - created by archiving change document-quickjs-bytecode-internals. Update Purpose after archive.
## Requirements
### Requirement: Source Code Architecture Documentation

The system SHALL provide a comprehensive architecture document that describes QuickJS's compilation and execution pipeline, including core module relationships and data flow.

#### Scenario: Developer understands module dependencies
- **WHEN** a developer reads `docs/quickjs/architecture.md`
- **THEN** they can identify how `parser.c`, `function.c`, `bytecode.cpp`, `module.c`, and `runtime.c` interact
- **AND** they understand the data flow from source code to bytecode execution

#### Scenario: Developer locates key data structures
- **WHEN** a developer needs to understand `JSContext`, `JSRuntime`, or `JSFunctionDef`
- **THEN** they can find definitions and explanations in the architecture document

---

### Requirement: Parser Internals Documentation

The system SHALL provide detailed documentation of the parser implementation in `parser.c`, covering lexical analysis, syntax analysis, and the 45+ `js_parse_*` functions.

#### Scenario: Developer understands tokenization
- **WHEN** a developer reads `docs/quickjs/parser-internals.md`
- **THEN** they understand how `next_token` processes source code into tokens
- **AND** they can identify all token types handled by the lexer

#### Scenario: Developer traces expression parsing
- **WHEN** a developer wants to understand how `a + b * c` is parsed
- **THEN** they can follow the call chain from `js_parse_expr` through `js_parse_unary` and operator precedence handling

#### Scenario: Developer understands function parsing
- **WHEN** a developer needs to understand function declaration parsing
- **THEN** they can find complete documentation of `js_parse_function_decl2` including parameter handling, default values, and body parsing

---

### Requirement: Bytecode Emission Documentation

The system SHALL provide documentation of all bytecode emission functions (`emit_*`), operand encoding formats, constant pool management, and label system.

#### Scenario: Developer understands opcode emission
- **WHEN** a developer reads `docs/quickjs/bytecode-emission.md`
- **THEN** they understand how `emit_op`, `emit_u8`, `emit_u16`, `emit_u32` work
- **AND** they can trace how specific JavaScript constructs translate to bytecode

#### Scenario: Developer understands constant pool
- **WHEN** a developer needs to understand constant handling
- **THEN** they can find documentation of `cpool_add` and `emit_push_const`
- **AND** they understand how literals are stored and referenced

#### Scenario: Developer understands label system
- **WHEN** a developer needs to implement control flow compilation
- **THEN** they can find documentation of `new_label`, `emit_label`, `emit_goto`
- **AND** they understand forward reference resolution

---

### Requirement: Scope Resolution Documentation

The system SHALL provide documentation of variable resolution (`resolve_variables`), label resolution (`resolve_labels`), closure capture, and scope chain management.

#### Scenario: Developer understands variable resolution
- **WHEN** a developer reads `docs/quickjs/scope-resolution.md`
- **THEN** they understand the complete `resolve_variables` algorithm
- **AND** they can trace how local, closure, and global variables are resolved

#### Scenario: Developer understands closure capture
- **WHEN** a developer needs to implement closure variable handling
- **THEN** they can find documentation of `add_closure_var` and closure variable representation
- **AND** they understand the two-phase resolution process

---

### Requirement: Bytecode Optimization Documentation

The system SHALL provide documentation of bytecode optimization passes including peephole optimization, dead code elimination, and constant folding.

#### Scenario: Developer understands peephole optimization
- **WHEN** a developer reads `docs/quickjs/bytecode-optimization.md`
- **THEN** they understand what optimizations are applied to the bytecode
- **AND** they can identify optimization opportunities in generated code

---

### Requirement: Bytecode Execution Documentation

The system SHALL provide documentation of the bytecode interpreter (`JS_CallInternal`), opcode dispatch mechanism, stack frame management, and exception handling.

#### Scenario: Developer understands interpreter loop
- **WHEN** a developer reads `docs/quickjs/bytecode-execution.md`
- **THEN** they understand the main execution loop in `JS_CallInternal`
- **AND** they can trace how each opcode is dispatched and executed

#### Scenario: Developer understands exception handling
- **WHEN** a developer needs to understand try/catch/finally execution
- **THEN** they can find documentation of exception propagation and handler resolution
- **AND** they understand the exception stack implementation

#### Scenario: Developer understands generator execution
- **WHEN** a developer needs to understand generator/async function execution
- **THEN** they can find documentation of generator state machine and yield/await handling

---

### Requirement: Module System Documentation

The system SHALL provide documentation of ES Module loading, import/export handling, and circular dependency resolution.

#### Scenario: Developer understands module execution
- **WHEN** a developer reads `docs/quickjs/module-system.md`
- **THEN** they understand `js_execute_sync_module` and `js_execute_async_module`
- **AND** they can trace the module loading and linking process

---

### Requirement: Builtins Documentation

The system SHALL provide documentation of the 24 built-in object implementations, native function binding mechanism, and type system.

#### Scenario: Developer understands native binding
- **WHEN** a developer reads `docs/quickjs/builtins.md`
- **THEN** they understand how native C functions are exposed to JavaScript
- **AND** they can identify the implementation location of any built-in method

---

### Requirement: Opcode Reference Documentation

The system SHALL provide a complete reference of all 254 opcodes with semantics, stack effects, operand formats, and usage examples.

#### Scenario: Developer looks up specific opcode
- **WHEN** a developer needs to understand `OP_get_field` or `OP_call_method`
- **THEN** they can find it in `docs/quickjs/opcode-reference.md`
- **AND** they see stack effect, operand format, and example usage

#### Scenario: Developer finds opcodes by category
- **WHEN** a developer needs all control flow opcodes
- **THEN** they can find them grouped under "Control Flow" category
- **AND** each opcode has consistent documentation format

---

### Requirement: ES2020+ Syntax Mapping Documentation

The system SHALL provide documentation mapping modern JavaScript syntax (async/await, generators, optional chaining, etc.) to their bytecode representations.

#### Scenario: Developer understands async/await compilation
- **WHEN** a developer reads `docs/quickjs/es2020-mapping.md`
- **THEN** they understand how async functions are compiled to state machines
- **AND** they can trace the bytecode generated for `await` expressions

#### Scenario: Developer understands optional chaining
- **WHEN** a developer needs to compile `a?.b?.c`
- **THEN** they can find the bytecode pattern for optional chaining
- **AND** they understand the short-circuit evaluation implementation

---

### Requirement: Complete Syntax-to-Bytecode Mapping with Flowcharts and Examples

The system SHALL provide comprehensive documentation for ALL JavaScript syntax constructs, showing the complete bytecode generation process with flowcharts and executable examples.

#### Scenario: Developer understands expression bytecode generation
- **WHEN** a developer reads `docs/quickjs/syntax-to-bytecode/expressions.md`
- **THEN** they find documentation for all expression types (literals, operators, calls, etc.)
- **AND** each expression includes a flowchart showing the parsing-to-emission process
- **AND** each expression includes a JavaScript example with corresponding bytecode output

#### Scenario: Developer understands statement bytecode generation
- **WHEN** a developer reads `docs/quickjs/syntax-to-bytecode/statements.md`
- **THEN** they find documentation for all statement types (if, for, while, try-catch, etc.)
- **AND** each statement includes a flowchart showing control flow bytecode generation
- **AND** each statement includes a JavaScript example with corresponding bytecode output

#### Scenario: Developer understands function bytecode generation
- **WHEN** a developer reads `docs/quickjs/syntax-to-bytecode/functions.md`
- **THEN** they find documentation for all function types (regular, arrow, async, generator)
- **AND** each function type includes a flowchart showing parameter handling and body compilation
- **AND** each function type includes a JavaScript example with corresponding bytecode output

#### Scenario: Developer understands class bytecode generation
- **WHEN** a developer reads `docs/quickjs/syntax-to-bytecode/classes.md`
- **THEN** they find documentation for class features (constructor, methods, fields, inheritance)
- **AND** each class feature includes a flowchart showing the bytecode generation process
- **AND** each class feature includes a JavaScript example with corresponding bytecode output

#### Scenario: Developer understands module bytecode generation
- **WHEN** a developer reads `docs/quickjs/syntax-to-bytecode/modules.md`
- **THEN** they find documentation for import/export statements
- **AND** each module feature includes a flowchart and JavaScript example

#### Scenario: Developer understands destructuring bytecode generation
- **WHEN** a developer reads `docs/quickjs/syntax-to-bytecode/destructuring.md`
- **THEN** they find documentation for array and object destructuring patterns
- **AND** each pattern includes a flowchart showing the element extraction process
- **AND** each pattern includes a JavaScript example with corresponding bytecode output

#### Scenario: Developer traces parser function to bytecode
- **WHEN** a developer examines any syntax-to-bytecode documentation
- **THEN** they find source code references to the relevant `js_parse_*` function in `parser.c`
- **AND** they can trace the exact emission calls that generate each opcode

---

### Requirement: ES2020 Complete Coverage Example with Flowcharts

The system SHALL provide a comprehensive single-file JavaScript example that covers ALL ES2020+ syntax features, with detailed compilation flowcharts showing the complete bytecode generation process.

#### Scenario: Developer studies complete ES2020 compilation flow
- **WHEN** a developer reads `docs/quickjs/es2020-complete-example.md`
- **THEN** they find a complete JavaScript file (~100-150 lines) covering all ES2020 features
- **AND** the example includes optional chaining, nullish coalescing, BigInt, private fields, static fields, dynamic import, logical assignment operators, and other ES2020+ features
- **AND** the code is executable and well-commented

#### Scenario: Developer understands overall compilation pipeline
- **WHEN** a developer views the overall compilation flowchart
- **THEN** they see the complete pipeline from module parsing to final bytecode
- **AND** the flowchart shows Phase 1 (parsing + emission), Phase 2 (resolve_variables), Phase 3 (resolve_labels + optimization)
- **AND** they can identify where each ES2020 feature is processed

#### Scenario: Developer studies ES2020 feature bytecode generation
- **WHEN** a developer wants to understand how optional chaining (`?.`) is compiled
- **THEN** they find a dedicated flowchart showing the parsing and bytecode emission process
- **AND** they see the intermediate temporary opcodes and their runtime transformations
- **AND** they see the final bytecode sequence with annotations

#### Scenario: Developer studies private field compilation
- **WHEN** a developer needs to understand class private fields (#field) compilation
- **THEN** they find a detailed flowchart of `js_parse_class` handling private declarations
- **AND** they see how `scope_get_private_field` is resolved in Phase 2
- **AND** they understand the runtime brand checking mechanism

#### Scenario: Developer studies dynamic import compilation
- **WHEN** a developer needs to understand `import()` expression compilation
- **THEN** they find a flowchart showing how dynamic import is parsed and emitted
- **AND** they see the `OP_import` opcode and its runtime behavior
- **AND** they understand the Promise-based module loading mechanism

#### Scenario: Developer traces execution path
- **WHEN** a developer wants to understand how the compiled bytecode executes
- **THEN** they find documentation of the runtime execution flow
- **AND** they can trace key opcode handling in `JS_CallInternal`

---

### Requirement: Bytecode Generation Function Analysis with Flowcharts

The system SHALL provide comprehensive documentation of ALL functions involved in bytecode generation and optimization, including implementation logic flowcharts and exact line number references.

#### Scenario: Developer understands parsing function implementation
- **WHEN** a developer reads `docs/quickjs/bytecode-functions/parsing-functions.md`
- **THEN** they find documentation for all 20+ `js_parse_*` functions
- **AND** each function includes signature, line number, purpose, implementation flowchart
- **AND** each function shows its call relationships with other parsing functions

#### Scenario: Developer understands emit function implementation
- **WHEN** a developer reads `docs/quickjs/bytecode-functions/emit-functions.md`
- **THEN** they find documentation for all 15+ `emit_*` functions
- **AND** each function includes signature, line number (e.g., `emit_op` at L1796)
- **AND** each function includes implementation flowchart and usage scenarios

#### Scenario: Developer understands scope function implementation
- **WHEN** a developer reads `docs/quickjs/bytecode-functions/scope-functions.md`
- **THEN** they find documentation for scope management functions (`push_scope`, `pop_scope`, `add_var`, etc.)
- **AND** each function includes line numbers and implementation flowcharts

#### Scenario: Developer deeply understands resolve_variables
- **WHEN** a developer reads the `resolve_variables` (L10495) documentation
- **THEN** they find a complete implementation flowchart (~650 lines analyzed)
- **AND** they see how each temporary opcode (`scope_*`) is transformed
- **AND** key branch points are annotated with line numbers

#### Scenario: Developer deeply understands resolve_labels
- **WHEN** a developer reads the `resolve_labels` (L11139) documentation
- **THEN** they find a complete implementation flowchart (~1400 lines analyzed)
- **AND** they see peephole optimization implementation with line references
- **AND** they see short opcode conversion logic with line references

#### Scenario: Developer traces function call relationships
- **WHEN** a developer reads `docs/quickjs/bytecode-functions/function-call-graph.md`
- **THEN** they find a complete function call graph (Mermaid)
- **AND** they can trace from main entry to bytecode generation
- **AND** they see expression parsing chain, statement parsing chain, and emit chain

---

### Requirement: Complete ES2020 Syntax Fixtures

The system SHALL provide comprehensive fixture files covering ALL ES2020+ syntax features in the `fixtures/es2020/` directory, with each fixture demonstrating a single syntax point.

#### Scenario: Developer finds class-related fixtures
- **WHEN** a developer looks in `fixtures/es2020/classes/`
- **THEN** they find fixtures for basic class, inheritance, private fields, private methods, static fields, static methods, static blocks, and accessors
- **AND** each fixture is focused on a single class feature

#### Scenario: Developer finds generator fixtures
- **WHEN** a developer looks in `fixtures/es2020/generators/`
- **THEN** they find fixtures for basic generators, yield, yield*, generator return, and async generators
- **AND** each fixture demonstrates the generator feature in isolation

#### Scenario: Developer finds ES2020-specific fixtures
- **WHEN** a developer looks in `fixtures/es2020/es2020-specific/`
- **THEN** they find fixtures for optional catch binding, logical assignment (??=, ||=, &&=), dynamic import, import.meta, export * as ns, and other ES2020 features
- **AND** each fixture is compilable by QuickJS

#### Scenario: Developer verifies fixture completeness
- **WHEN** a developer reviews the fixtures directory
- **THEN** they find fixtures covering all ES2020 syntax features
- **AND** empty directories (classes/, generators/, literals/) are populated
- **AND** existing files are extended with additional edge cases

---

### Requirement: Temporary vs Runtime Opcode Classification Documentation

The system SHALL provide a comprehensive classification of all opcodes into temporary (compiler-only) and runtime categories, with detailed explanations of each opcode's purpose and lifecycle.

#### Scenario: Developer distinguishes temporary from runtime opcodes
- **WHEN** a developer reads `docs/quickjs/opcode-categories.md`
- **THEN** they understand the difference between `DEF` (runtime) and `def` (temporary) macros
- **AND** they can identify which opcodes are removed during compilation phases

#### Scenario: Developer understands temporary opcode lifecycle
- **WHEN** a developer needs to understand `scope_get_var` or `enter_scope`
- **THEN** they can find documentation explaining these are Phase 1/2 temporary opcodes
- **AND** they understand what runtime opcodes they transform into

#### Scenario: Developer looks up specific runtime opcode purpose
- **WHEN** a developer needs to understand `OP_get_loc`, `OP_call_method`, or `OP_await`
- **THEN** they can find detailed explanation of its purpose, stack effect, and typical usage
- **AND** they see which JavaScript construct generates this opcode

#### Scenario: Developer understands short opcode optimizations
- **WHEN** a developer needs to understand `push_0`, `get_loc0`, or `call0`
- **THEN** they can find documentation explaining these are size-optimized variants
- **AND** they understand the `SHORT_OPCODES` conditional compilation

---

### Requirement: Opcode Macro Generation System Documentation

The system SHALL provide documentation of the DEF/def macro system used to generate opcode enums, info arrays, and runtime dispatch tables.

#### Scenario: Developer understands DEF macro structure
- **WHEN** a developer reads `docs/quickjs/opcode-macro-system.md`
- **THEN** they understand the `DEF(id, size, n_pop, n_push, f)` parameter meanings
- **AND** they can explain how size, stack effects, and format are encoded

#### Scenario: Developer understands compile-time macro expansion
- **WHEN** a developer needs to add a new opcode
- **THEN** they can find documentation of the multiple `#include "quickjs-opcode.h"` technique
- **AND** they understand how `opcode_info[]` and `enum OPCodeEnum` are generated

#### Scenario: Developer understands runtime dispatch table generation
- **WHEN** a developer reads about bytecode execution dispatch
- **THEN** they understand how `dispatch_table[256]` is generated from opcode definitions
- **AND** they can trace how `CASE(OP_xxx)` labels are created via macro expansion

#### Scenario: Developer understands direct threading optimization
- **WHEN** a developer needs to understand interpreter performance
- **THEN** they can find documentation of computed goto (Direct Threading) vs switch dispatch
- **AND** they understand the `DIRECT_DISPATCH` compilation option

