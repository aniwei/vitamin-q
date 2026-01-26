#!/usr/bin/env tsx
import { existsSync, mkdirSync } from 'node:fs'
import fs from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

type Options = {
  emsdk?: string
  buildType?: 'Release' | 'Debug'
  reinstall?: boolean
  verbose?: boolean
  trace?: boolean
  traceLevel?: 1 | 2 | 3
}

function run(
  cmd: string, 
  args: string[], 
  opts?: { cwd?: string, env?: NodeJS.ProcessEnv, shell?: boolean, verbose?: boolean }
) {
  const { cwd, env, shell, verbose } = opts || {}

  if (verbose) {
    console.log('$', cmd, args.join(' '), cwd ? `(cwd=${cwd})` : '')
  }
  
  const r = spawnSync(cmd, args, { 
    stdio: 'inherit', 
    cwd, 
    env: { ...process.env, ...env }, 
    shell 
  })

  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`)
  }
}

function runBash(
  script: string, 
  opts?: { cwd?: string, env?: NodeJS.ProcessEnv, verbose?: boolean }
) {
  const { cwd, env, verbose } = opts || {}

  if (verbose) {
    console.log('$ bash -lc', JSON.stringify(script), cwd ? `(cwd=${cwd})` : '')
  }

  const r = spawnSync('/bin/bash', ['-lc', script], { 
    stdio: 'inherit', 
    cwd, 
    env: { ...process.env, ...env } 
  })

  if (r.status !== 0) {
    throw new Error('Shell command failed')
  }
}

function which(bin: string): string | null {
  const r = spawnSync('which', [bin], { encoding: 'utf8' })

  if (r.status === 0) {
    return (r.stdout || '').trim() || null
  }

  return null
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const opts: Options = { 
    buildType: 'Release', 
    reinstall: false, 
    verbose: false,
    trace: false,
    traceLevel: 1
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--emsdk' && args[i+1]) { 
      opts.emsdk = resolve(args[++i]) 
    } else if (a === '--debug') { 
      opts.buildType = 'Debug' 
    } else if (a === '--release') { 
      opts.buildType = 'Release' 
    } else if (a === '--reinstall') { 
      opts.reinstall = true 
    } else if (a === '--verbose' || a === '-v') { 
      opts.verbose = true 
    } else if (a === '--trace') {
      opts.trace = true
    } else if ((a === '--trace-level' || a === '--traceLevel') && args[i+1]) {
      const v = Number(args[++i])
      if (v === 1 || v === 2 || v === 3) opts.traceLevel = v
    }
  }

  return opts
}

function ensureEmsdk(opts: Options, repoRoot: string): { emsdkDir: string, envScript: string } {
  // 优先级：命令行 --emsdk > 环境变量 EMSDK > 本地 third_party/emsdk 安装
  let emsdkDir = opts.emsdk || process.env.EMSDK || ''
  
  if (emsdkDir) {
    emsdkDir = resolve(emsdkDir)
    const envScript = join(emsdkDir, 'emsdk_env.sh')
    
    if (!existsSync(envScript)) {
      throw new Error(`emsdk_env.sh not found under ${emsdkDir}`)
    }
    
    return { emsdkDir, envScript }
  }

  // 尝试从 PATH 中检测现有的 emcc/emcmake
  const emcc = which('emcc')
  const emcmake = which('emcmake')

  if (emcc && emcmake) {
    // 尝试通过 emcc 路径推断 emsdk 根目录。
    // 如果推断不出来，则允许直接使用 PATH（不 source env 脚本）。
    const guessed = process.env.EMSDK || ''

    if (guessed && existsSync(join(guessed, 'emsdk_env.sh'))) {
      return { 
        emsdkDir: resolve(guessed), 
        envScript: join(resolve(guessed), 'emsdk_env.sh') 
      }
    }

    // 直接使用 PATH（不依赖 env 脚本）
    return { emsdkDir: '', envScript: '' }
  }

  // 本地安装到 third_party/emsdk
  const thirdParty = join(repoRoot, 'third_party')
  const localEmsdk = join(thirdParty, 'emsdk')
  
  if (!existsSync(thirdParty)) {
    mkdirSync(thirdParty, { recursive: true })
  }
  
  if (!existsSync(localEmsdk)) {
    console.log('Cloning emsdk into', localEmsdk)
    run('git', ['clone', 'https://github.com/emscripten-core/emsdk.git', localEmsdk], { verbose: opts.verbose })
  }
  
  const envScript = join(localEmsdk, 'emsdk_env.sh')
  console.log('Installing/activating latest emsdk ...')
  
  runBash('./emsdk install latest', { 
    cwd: localEmsdk, 
    verbose: opts.verbose 
  })
  
  runBash('./emsdk activate latest', { 
    cwd: localEmsdk, 
    verbose: opts.verbose 
  })

  return { 
    emsdkDir: localEmsdk, 
    envScript 
  }
}

function buildWasm(opts: Options) {
  const repoRoot = resolve(process.cwd())
  const wasmRoot = resolve(repoRoot, 'third_party/QuickJS/wasm')
  const buildDir = resolve(wasmRoot, 'build')
  const outJs = resolve(wasmRoot, 'output/quickjs_wasm.js')
  const outWasm = resolve(wasmRoot, 'output/quickjs_wasm.wasm')
  const outConfig = resolve(wasmRoot, 'output/quickjs_wasm.build-config.json')

  const { emsdkDir, envScript } = ensureEmsdk(opts, repoRoot)
  if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true })

  const prefix = envScript ? `source ${envScript} && ` : ''
  // 配置
  const traceArgs: string[] = []
  const traceEnabled = Boolean(opts.trace)
  const traceLevel = traceEnabled ? (opts.traceLevel ?? 1) : 1

  // 总是显式传值，避免 CMake cache 在多次构建之间“粘住”旧值。
  traceArgs.push(`-DQTS_TRACE_ENABLED=${traceEnabled ? 1 : 0}`)
  traceArgs.push(`-DQTS_TRACE_LEVEL=${traceLevel}`)

  const categoryKeys = [
    'QTS_TRACE_EMIT',
    'QTS_TRACE_VARIABLE',
    'QTS_TRACE_CLOSURE',
    'QTS_TRACE_LABEL',
    'QTS_TRACE_STACK',
    'QTS_TRACE_PC2LINE',
    'QTS_TRACE_SCOPE',
    'QTS_TRACE_ASSIGN',
  ] as const

  for (const key of categoryKeys) {
    if (!traceEnabled) {
      traceArgs.push(`-D${key}=0`)
      continue
    }
    const v = process.env[key]
    if (v === '0' || v === '1') {
      traceArgs.push(`-D${key}=${v}`)
    }
  }

  const cmakeArgs = [
    `emcmake cmake -S ${JSON.stringify(wasmRoot)} -B ${JSON.stringify(buildDir)}`,
    `-DCMAKE_BUILD_TYPE=${opts.buildType}`,
    ...traceArgs
  ].join(' ')

  runBash(`${prefix}${cmakeArgs}`, { cwd: repoRoot, verbose: opts.verbose })
  // 构建
  runBash(`${prefix}cmake --build ${JSON.stringify(buildDir)} -j`, { cwd: repoRoot, verbose: opts.verbose })

  if (!existsSync(outJs) || !existsSync(outWasm)) {
    throw new Error(`Build completed but outputs not found: ${outJs} / ${outWasm}`)
  }

  const resolveCategory = (key: string): 0 | 1 => {
    if (!traceEnabled) return 0
    const v = process.env[key]
    if (v === '0') return 0
    if (v === '1') return 1
    return 1
  }
  const buildConfig = {
    buildType: opts.buildType,
    qtsTrace: {
      enabled: traceEnabled ? 1 : 0,
      level: traceLevel,
      categories: {
        EMIT: resolveCategory('QTS_TRACE_EMIT'),
        VARIABLE: resolveCategory('QTS_TRACE_VARIABLE'),
        CLOSURE: resolveCategory('QTS_TRACE_CLOSURE'),
        LABEL: resolveCategory('QTS_TRACE_LABEL'),
        STACK: resolveCategory('QTS_TRACE_STACK'),
        PC2LINE: resolveCategory('QTS_TRACE_PC2LINE'),
        SCOPE: resolveCategory('QTS_TRACE_SCOPE'),
        ASSIGN: resolveCategory('QTS_TRACE_ASSIGN'),
      },
    },
  }
  try {
    fs.mkdirSync(resolve(wasmRoot, 'output'), { recursive: true })
    fs.writeFileSync(outConfig, JSON.stringify(buildConfig, null, 2), 'utf8')
  } catch {
    // 尽力写入标记文件（失败也不影响主流程）
  }

  console.log('WASM build outputs ready:')
  console.log(' -', outJs)
  console.log(' -', outWasm)
  console.log(' -', outConfig)
}

function main() {
  try {
    const opts = parseArgs()
    buildWasm(opts)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Build failed:', msg)
    process.exit(1)
  }
}

if (require.main === module) main()
