#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

function stripDoubleDash(args) {
  if (args[0] === '--') return args.slice(1);
  return args;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runJest(args) {
  return spawnSync('pnpm', ['exec', 'jest', ...args], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
  });
}

const mode = process.argv[2];
const rawArgs = stripDoubleDash(process.argv.slice(3));

if (!mode) {
  fail('Usage: node scripts/run-jest.cjs <file|case|live-file|live-case> [args...]');
}

if (mode === 'file' || mode === 'live-file') {
  if (rawArgs.length === 0) {
    fail('Pass at least one test file path, e.g. pnpm test:file -- apps/playground/src/telegram.menu.live.spec.ts');
  }

  const jestArgs = ['--runInBand'];
  if (mode === 'live-file') {
    jestArgs.push('-c', 'jest.live.config.cjs');
  }
  jestArgs.push(...rawArgs);

  const result = runJest(jestArgs);
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
} else if (mode === 'case' || mode === 'live-case') {
  if (rawArgs.length === 0) {
    fail('Pass test name pattern, e.g. pnpm test:case -- "navigates menu"');
  }

  const pattern = rawArgs.join(' ').trim();

  if (mode === 'live-case') {
    console.log('[run-jest] searching in live suite...');
    const liveResult = runJest([
      '--runInBand',
      '-c',
      'jest.live.config.cjs',
      '--testNamePattern',
      pattern,
    ]);

    if (liveResult.error) {
      console.error(liveResult.error);
      process.exit(1);
    }

    process.exit(liveResult.status ?? 1);
  }

  console.log('[run-jest] searching in unit suite...');
  const unitResult = runJest(['--runInBand', '--testNamePattern', pattern]);
  if (unitResult.error) {
    console.error(unitResult.error);
    process.exit(1);
  }

  console.log('[run-jest] searching in live suite...');
  const liveResult = runJest([
    '--runInBand',
    '-c',
    'jest.live.config.cjs',
    '--testNamePattern',
    pattern,
  ]);
  if (liveResult.error) {
    console.error(liveResult.error);
    process.exit(1);
  }

  const unitCode = unitResult.status ?? 1;
  const liveCode = liveResult.status ?? 1;
  process.exit(unitCode !== 0 ? unitCode : liveCode);
} else {
  fail(`Unknown mode: ${mode}`);
}
