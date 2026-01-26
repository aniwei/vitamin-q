class Calculator {
    value;
    constructor(val) {
        this.value = val;
    }
    add(n) {
        this.value += n;
        return this.value;
    }
    static create(val) {
        return new Calculator(val);
    }
}
