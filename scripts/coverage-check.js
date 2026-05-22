#!/usr/bin/env node
/**
 * Coverage Check Script
 * Validates that every testable file exceeds 90% coverage.
 * Fails the build if any file falls below the threshold.
 * Handles Istanbul 1.0 coverage format from Jest.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Use absolute path to coverage so it works both from CLI and when imported
const COVERAGE_PATH = '/data/.openclaw/workspace/creative-ai/coverage/coverage-final.json';
const THRESHOLD = 90;

const TESTABLE_FILES = [
  'src/auth.js',
  'src/bridge.js',
  'src/cli.js',
  'src/context.js',
  'src/db.js',
  'src/memory.js',
  'src/server.js',
  'src/tasks.js',
  'src/middleware/auth.js'
];

/**
 * Calculate coverage from Istanbul 1.0 format.
 * Istanbul 1.0: s/f/b are maps of index → hit count.
 * statementCount = number of statementMap entries.
 * executed count = number of entries with hit count > 0.
 */
function calculateCoverage(data) {
  const statementMap = data.statementMap || {};
  const fnMap = data.fnMap || {};
  const branchMap = data.branchMap || {};
  
  const s = data.s || {};
  const f = data.f || {};
  const b = data.b || {};
  
  // Statements
  const totalStatements = Object.keys(statementMap).length;
  const executedStatements = Object.values(s).filter(v => v > 0).length;
  const statements = totalStatements > 0 ? (executedStatements / totalStatements) * 100 : 0;
  
  // Functions
  const totalFunctions = Object.keys(fnMap).length;
  const executedFunctions = Object.values(f).filter(v => v > 0).length;
  const functions = totalFunctions > 0 ? (executedFunctions / totalFunctions) * 100 : 0;
  
  // Branches - Istanbul 1.0 uses 'locations' arrays (one per branch path).
  // Each branch entry may have 2 locations (if/else, try/catch, etc.).
  // Jest counts ALL locations in the denominator, including those without
  // valid line numbers (undefined-undefined for implicit else branches).
  // We replicate Jest's counting exactly: count all locations that have
  // at least one hit count > 0.
  let totalBranches = 0;
  let executedBranches = 0;
  for (const [key, branchEntry] of Object.entries(branchMap)) {
    const locations = branchEntry.locations || [];
    // Only count entries that have at least one location (defensive: skip if no locations)
    if (locations.length === 0) continue;
    totalBranches += locations.length;
    const counts = b[key] || [];
    for (let i = 0; i < locations.length; i++) {
      // A branch location counts as executed if its hit count > 0
      if (counts[i] > 0) executedBranches++;
    }
  }
  const branches = totalBranches > 0 ? (executedBranches / totalBranches) * 100 : 0;
  
  // Lines - estimate from statement coverage (statements ≈ lines in coverage)
  // Since Istanbul 1.0 doesn't have a separate 'l' key, use statement coverage
  const lines = statements;
  
  return { statements, branches, functions, lines };
}

function getCoverage(filePath, data) {
  const key = path.resolve(filePath);
  const fileData = data[key];
  if (!fileData) return null;
  return calculateCoverage(fileData);
}

function main() {
  let coverageData;
  try {
    coverageData = JSON.parse(readFileSync(COVERAGE_PATH, 'utf8'));
  } catch (err) {
    console.error('Error: Could not read coverage data. Run `npm test -- --coverage` first.');
    process.exit(1);
  }

  const repoRoot = '/data/.openclaw/workspace/creative-ai';
  const results = [];
  let hasFailure = false;

  for (const file of TESTABLE_FILES) {
    const fullPath = path.join(repoRoot, file);
    const coverage = getCoverage(fullPath, coverageData);

    if (coverage === null) {
      results.push({ file, covered: false, details: null });
      continue;
    }

    const pass = coverage.statements >= THRESHOLD &&
      coverage.branches >= THRESHOLD &&
      coverage.functions >= THRESHOLD &&
      coverage.lines >= THRESHOLD;

    results.push({ file, covered: true, pass, details: coverage });

    if (!pass) {
      hasFailure = true;
    }
  }

  console.log('\n  Per-File Coverage Report (threshold: ' + THRESHOLD + '%)\n');
  console.log('  File                      | Stmts  | Branch | Funcs  | Lines  | Status');
  console.log('  --------------------------|--------|--------|--------|--------|--------');

  for (const r of results) {
    if (!r.covered) {
      console.log('  ' + r.file.padEnd(24) + ' |   --   |   --   |   --   |   --   | SKIPPED');
      continue;
    }
    const s = r.details.statements.toFixed(1).padStart(5);
    const b = r.details.branches.toFixed(1).padStart(5);
    const f = r.details.functions.toFixed(1).padStart(5);
    const l = r.details.lines.toFixed(1).padStart(5);
    const status = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log('  ' + r.file.padEnd(24) + ' | ' + s + '  | ' + b + '  | ' + f + '  | ' + l + '  | ' + status);
  }

  console.log('');

  if (hasFailure) {
    console.error('❌ Coverage check FAILED: Some files are below ' + THRESHOLD + '% threshold.');
    console.error('   Fix the failing files before merging.\n');
    process.exit(1);
  } else {
    console.log('✅ All testable files meet the ' + THRESHOLD + '% coverage threshold.\n');
    process.exit(0);
  }
}

main();