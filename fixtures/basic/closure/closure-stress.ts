function stress() {
  let l0 = 0;
  let l1 = 1;
  let l2 = 2;
  let l3 = 3;
  let l4 = 4;
  var v0 = 10;
  var v1 = 11;
  var v2 = 12;
  var v3 = 13;
  var v4 = 14;
  
  function inner() {
    // Lexical (checked) - should use OP_get_var_ref_check (long)
    l0++;
    l1++;
    l2++;
    l3++;
    l4++;
    
    // Var (unchecked) - should use OP_get_var_ref0-3 (short) for first 4, then OP_get_var_ref (long)
    v0++;
    v1++;
    v2++;
    v3++;
    v4++;
  }
  inner();
}
stress();
