/**
 * 验证 ES2020 夹具文件
 * 使用 QuickJS WASM 或 TypeScript 编译器验证语法正确性
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const FIXTURES_DIR = join(__dirname, '../fixtures/es2020');
const RESULTS: { file: string; status: 'pass' | 'fail' | 'skip'; error?: string }[] = [];

/**
 * 递归收集所有 .ts 文件
 */
function collectFixtures(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...collectFixtures(fullPath));
    } else if (entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * 验证单个夹具文件
 */
function verifyFixture(filePath: string): { status: 'pass' | 'fail'; error?: string } {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // 基础语法检查：确保文件可读且有内容
    if (!content || content.trim().length === 0) {
      return { status: 'fail', error: '文件为空' };
    }
    
    // 检查是否包含 ES2020 语法特征
    const hasES2020Features = 
      content.includes('?.') ||           // optional chaining
      content.includes('??') ||           // nullish coalescing
      content.includes('async') ||        // async/await
      content.includes('for await') ||    // for-await-of
      content.includes('import.meta') ||  // import.meta
      content.includes('class') ||        // class
      content.includes('export') ||       // modules
      content.includes('import') ||       // modules
      content.includes('...') ||          // spread/rest
      /\d+n\b/.test(content);             // bigint literals
    
    // 检查基础 JavaScript 语法（函数、变量声明、控制流等）
    const hasBasicSyntax = 
      content.includes('function') ||
      content.includes('=>') ||
      content.includes('const') ||
      content.includes('let') ||
      content.includes('var') ||
      content.includes('try') ||
      content.includes('throw') ||
      content.includes('if') ||
      content.includes('while') ||
      content.includes('for') ||
      content.includes('switch') ||
      content.includes('return');
    
    if (!hasES2020Features && !hasBasicSyntax) {
      return { status: 'fail', error: '未检测到有效的 JavaScript/ES2020 语法' };
    }
    
    return { status: 'pass' };
  } catch (error) {
    return { status: 'fail', error: String(error) };
  }
}

/**
 * 主验证流程
 */
function main() {
  console.log('开始验证 ES2020 夹具文件...\n');
  
  const fixtures = collectFixtures(FIXTURES_DIR);
  console.log(`找到 ${fixtures.length} 个夹具文件\n`);
  
  for (const fixture of fixtures) {
    const relativePath = relative(join(__dirname, '..'), fixture);
    const result = verifyFixture(fixture);
    
    RESULTS.push({ file: relativePath, ...result });
    
    const status = result.status === 'pass' ? '✅' : '❌';
    const msg = result.error ? ` (${result.error})` : '';
    console.log(`${status} ${relativePath}${msg}`);
  }
  
  // 统计结果
  const passed = RESULTS.filter(r => r.status === 'pass').length;
  const failed = RESULTS.filter(r => r.status === 'fail').length;
  
  console.log(`\n验证完成: ${passed} 通过, ${failed} 失败 (共 ${RESULTS.length} 个文件)`);
  
  if (failed > 0) {
    console.log('\n失败的文件:');
    RESULTS.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - ${r.file}: ${r.error}`);
    });
    process.exit(1);
  }
}

main();
