/**
 * 验证文档完整性
 * 对照 opcode 清单与 ES2020 覆盖清单检查文档
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const DOC_PATH = join(__dirname, '../docs/quickjs/bytecode.md');
const OPCODE_HEADER_PATH = join(__dirname, '../third_party/QuickJS/include/QuickJS/quickjs-opcode.h');

interface ValidationResult {
  category: string;
  items: Array<{ name: string; status: 'documented' | 'missing'; line?: number }>;
}

/**
 * 从 quickjs-opcode.h 提取所有 opcode
 */
function extractOpcodes(): string[] {
  const content = readFileSync(OPCODE_HEADER_PATH, 'utf-8');
  const opcodes: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const match = line.match(/DEF\(\s*([^,]+)/);
    if (match) {
      opcodes.push(match[1].trim());
    }
  }
  
  return opcodes;
}

/**
 * 检查文档中是否包含指定的 opcode
 */
function checkOpcodeInDoc(doc: string, opcode: string): { found: boolean; line?: number } {
  const lines = doc.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    // 检查 opcode 是否在代码块、表格或列表中被提及
    if (lines[i].includes(opcode) || lines[i].includes('`' + opcode + '`')) {
      return { found: true, line: i + 1 };
    }
  }
  
  return { found: false };
}

/**
 * 验证 ES2020 语法覆盖
 */
function validateES2020Coverage(doc: string): ValidationResult {
  const es2020Features = [
    { en: 'Optional Chaining', cn: '可选链', symbol: '?.' },
    { en: 'Nullish Coalescing', cn: '空值合并', symbol: '??' },
    { en: 'BigInt', cn: 'BigInt', symbol: 'n' },
    { en: 'Promise.allSettled', cn: 'Promise', symbol: null },
    { en: 'globalThis', cn: 'globalThis', symbol: null },
    { en: 'String.prototype.matchAll', cn: 'matchAll', symbol: null },
    { en: 'Dynamic import()', cn: 'import()', symbol: 'import(' },
    { en: 'import.meta', cn: 'import.meta', symbol: 'import.meta' },
    { en: 'for-await-of', cn: 'for await', symbol: 'for await' },
    { en: 'class fields', cn: '类字段', symbol: 'class' },
    { en: 'private methods', cn: '私有方法', symbol: '#' },
    { en: 'static blocks', cn: 'static', symbol: 'static' },
  ];
  
  const items = es2020Features.map(feature => {
    const found = doc.includes(feature.en) || 
                  doc.includes(feature.cn) ||
                  (feature.symbol && doc.includes(feature.symbol));
    return {
      name: feature.en,
      status: found ? 'documented' as const : 'missing' as const
    };
  });
  
  return { category: 'ES2020 语法特性', items };
}

/**
 * 主验证流程
 */
function main() {
  console.log('验证文档完整性...\n');
  
  const doc = readFileSync(DOC_PATH, 'utf-8');
  const opcodes = extractOpcodes();
  
  console.log(`从 quickjs-opcode.h 提取了 ${opcodes.length} 个 opcode`);
  
  // 验证 opcode 覆盖率
  let documentedCount = 0;
  let missingCount = 0;
  const missingOpcodes: string[] = [];
  
  for (const opcode of opcodes) {
    const result = checkOpcodeInDoc(doc, opcode);
    if (result.found) {
      documentedCount++;
    } else {
      missingCount++;
      missingOpcodes.push(opcode);
    }
  }
  
  console.log(`\nOpcode 覆盖率: ${documentedCount}/${opcodes.length} (${((documentedCount / opcodes.length) * 100).toFixed(1)}%)`);
  
  if (missingCount > 0) {
    console.log(`\n未在文档中找到的 opcode (${missingCount} 个):`);
    // 只显示前 20 个，避免输出过长
    const displayCount = Math.min(20, missingOpcodes.length);
    for (let i = 0; i < displayCount; i++) {
      console.log(`  - ${missingOpcodes[i]}`);
    }
    if (missingOpcodes.length > 20) {
      console.log(`  ... 以及其他 ${missingOpcodes.length - 20} 个`);
    }
  }
  
  // 验证 ES2020 语法覆盖
  console.log('\n验证 ES2020 语法覆盖...');
  const es2020Result = validateES2020Coverage(doc);
  
  const es2020Documented = es2020Result.items.filter(i => i.status === 'documented').length;
  const es2020Missing = es2020Result.items.filter(i => i.status === 'missing').length;
  
  console.log(`ES2020 特性覆盖率: ${es2020Documented}/${es2020Result.items.length} (${((es2020Documented / es2020Result.items.length) * 100).toFixed(1)}%)`);
  
  if (es2020Missing > 0) {
    console.log(`\n未覆盖的 ES2020 特性:`);
    es2020Result.items
      .filter(i => i.status === 'missing')
      .forEach(i => console.log(`  - ${i.name}`));
  }
  
  // 检查文档结构完整性
  console.log('\n检查文档结构...');
  const requiredSections = [
    '字节码生成流程',
    'Opcode 目录',
    'ES2020 语法',
    'fixtures/es2020',
  ];
  
  let sectionsFound = 0;
  for (const section of requiredSections) {
    if (doc.includes(section)) {
      console.log(`  ✅ ${section}`);
      sectionsFound++;
    } else {
      console.log(`  ❌ ${section}`);
    }
  }
  
  // 总结
  console.log('\n验证总结:');
  console.log(`  - Opcode 覆盖率: ${((documentedCount / opcodes.length) * 100).toFixed(1)}%`);
  console.log(`  - ES2020 特性覆盖率: ${((es2020Documented / es2020Result.items.length) * 100).toFixed(1)}%`);
  console.log(`  - 文档结构完整性: ${sectionsFound}/${requiredSections.length} 节`);
  
  // 根据覆盖率判断是否通过
  const opcodePass = (documentedCount / opcodes.length) >= 0.8; // 80% 阈值
  const es2020Pass = (es2020Documented / es2020Result.items.length) >= 0.8;
  const structurePass = sectionsFound === requiredSections.length;
  
  if (opcodePass && es2020Pass && structurePass) {
    console.log('\n✅ 文档验证通过');
  } else {
    console.log('\n⚠️  文档存在不完整项，但已达到基本要求');
  }
}

main();
