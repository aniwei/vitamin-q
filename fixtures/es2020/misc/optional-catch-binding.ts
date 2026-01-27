// ES2020 - 可选 catch 绑定
// Optional Catch Binding (ES2019/ES2020)

// 传统方式 - 带有绑定的 catch
try {
  JSON.parse("invalid json");
} catch (error) {
  console.log("Parse error:", error);
}

// 可选 catch 绑定 - 不使用错误参数
try {
  // 尝试做一些可能失败的事情
  JSON.parse("{ invalid }");
} catch {
  // 只关心是否失败，不关心具体错误
  console.log("Failed to parse JSON");
}

// 实际用例：feature detection
function hasFeature(): boolean {
  try {
    // 检测特性是否存在
    eval("class A { #private; }");
    return true;
  } catch {
    return false;
  }
}

console.log("Has private fields:", hasFeature());

// 用于清理操作
function safeDelete(obj: any, key: string): void {
  try {
    delete obj[key];
  } catch {
    // 删除失败也无所谓
  }
}

// 嵌套 try-catch
function riskyOperation(): number {
  try {
    try {
      throw new Error("Inner error");
    } catch {
      console.log("Inner catch");
      throw new Error("Rethrown");
    }
  } catch {
    console.log("Outer catch");
    return -1;
  }
  return 0;
}

console.log(riskyOperation());

// 与 finally 结合
function withFinally(): string {
  try {
    throw new Error("Test");
  } catch {
    return "caught";
  } finally {
    console.log("finally executed");
  }
}

console.log(withFinally());

// 异步函数中的可选 catch 绑定
async function asyncOptionalCatch(): Promise<void> {
  try {
    await Promise.reject("rejected");
  } catch {
    console.log("Promise was rejected");
  }
}

asyncOptionalCatch();
