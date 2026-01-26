function short() {
  var v0 = 0;
  var v1 = 1;
  var v2 = 2;
  var v3 = 3;
  var v4 = 4;
  
  function inner() {
    v0++;
    v1++;
    v2++;
    v3++;
    v4++;
  }
  inner();
}
short();
