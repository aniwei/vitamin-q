// ES2020 - 私有字段 (ES2022)
// 测试 # 私有字段语法

class BankAccount {
  #balance: number;
  #accountNumber: string;
  
  constructor(accountNumber: string, initialBalance: number) {
    this.#accountNumber = accountNumber;
    this.#balance = initialBalance;
  }
  
  deposit(amount: number): void {
    if (amount > 0) {
      this.#balance += amount;
    }
  }
  
  withdraw(amount: number): boolean {
    if (amount > 0 && amount <= this.#balance) {
      this.#balance -= amount;
      return true;
    }
    return false;
  }
  
  getBalance(): number {
    return this.#balance;
  }
  
  getAccountNumber(): string {
    return this.#accountNumber;
  }
  
  // 私有方法
  #validateTransaction(amount: number): boolean {
    return amount > 0 && amount <= this.#balance;
  }
  
  transfer(to: BankAccount, amount: number): boolean {
    if (this.#validateTransaction(amount)) {
      this.#balance -= amount;
      to.deposit(amount);
      return true;
    }
    return false;
  }
}

const account1 = new BankAccount("123456", 1000);
const account2 = new BankAccount("654321", 500);

console.log(account1.getBalance()); // 1000
account1.deposit(500);
console.log(account1.getBalance()); // 1500

account1.transfer(account2, 300);
console.log(account1.getBalance()); // 1200
console.log(account2.getBalance()); // 800

// 尝试直接访问私有字段会失败
// console.log(account1.#balance); // SyntaxError
