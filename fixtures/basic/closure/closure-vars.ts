
function testClosure() {
    let a = 1;
    let b = 2;
    const c = 3;
    var d = 4;

    function inner() {
        console.log(a);
        console.log(b);
        console.log(c);
        console.log(d);
        a++;
        b = 10;
        d = 20;
    }
    inner();
}
testClosure();
