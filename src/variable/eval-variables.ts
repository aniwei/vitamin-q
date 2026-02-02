export interface EvalVariableState {
  hasEval: boolean
  evalRetIdx: number
}

/**
 * eval 变量处理。
 *
 * @source QuickJS/src/core/parser.c:7350-7405
 * @see set_eval_ret_undefined
 */
export const createEvalState = (): EvalVariableState => ({
  hasEval: false,
  evalRetIdx: -1,
})

export const markEvalCalled = (state: EvalVariableState) => {
  state.hasEval = true
}

export const setEvalRetIndex = (state: EvalVariableState, index: number) => {
  state.evalRetIdx = index
}
