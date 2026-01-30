#!/usr/bin/env node
/**
 * Hishcore Test Suite Runner
 *
 * A decorated test runner that wraps Jest with nice formatting.
 *
 * Usage:
 *   node .claude/tests/run-all.js           # Run all tests
 *   node .claude/tests/run-all.js --coverage # Run with coverage
 *   node .claude/tests/run-all.js lib/      # Run specific path
 */

const { execSync, spawnSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../..");

// Parse arguments
const args = process.argv.slice(2);
const withCoverage = args.includes("--coverage");
const testPath = args.find((arg) => !arg.startsWith("--")) || "";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

function printHeader() {
  console.log();
  console.log(
    c("cyan", "╔══════════════════════════════════════════════════════════╗")
  );
  console.log(
    c("cyan", "║") +
      c("bright", "              Hishcore - Test Suite                    ") +
      c("cyan", "║")
  );
  console.log(
    c("cyan", "║") +
      c("dim", "         Expo + React Native + Supabase                  ") +
      c("cyan", "║")
  );
  console.log(
    c("cyan", "╚══════════════════════════════════════════════════════════╝")
  );
  console.log();
}

function printSection(title) {
  console.log();
  console.log(c("magenta", `━━━ ${title} ━━━`));
  console.log();
}

function printResults(passed, failed, duration) {
  const total = passed + failed;
  const status = failed > 0 ? "red" : "green";

  console.log();
  console.log(
    c("cyan", "╔══════════════════════════════════════════════════════════╗")
  );
  console.log(
    c("cyan", "║") +
      c("bright", "                    Test Results                       ") +
      c("cyan", "║")
  );
  console.log(
    c("cyan", "╠══════════════════════════════════════════════════════════╣")
  );
  console.log(
    c("cyan", "║") +
      `  Total Tests: ${String(total).padStart(4)}                                      ` +
      c("cyan", "║")
  );
  console.log(
    c("cyan", "║") +
      `  ${c("green", "Passed")}:      ${String(passed).padStart(4)}  ${c("green", "OK")}                                   ` +
      c("cyan", "║")
  );
  console.log(
    c("cyan", "║") +
      `  ${failed > 0 ? c("red", "Failed") : "Failed"}:      ${String(failed).padStart(4)}  ${failed > 0 ? c("red", "FAIL") : "  "}                                 ` +
      c("cyan", "║")
  );
  if (duration) {
    console.log(
      c("cyan", "║") +
        `  Duration:   ${duration.padStart(5)}                                      ` +
        c("cyan", "║")
    );
  }
  console.log(
    c("cyan", "╚══════════════════════════════════════════════════════════╝")
  );
  console.log();
}

function printCoverageHeader() {
  console.log();
  console.log(
    c(
      "yellow",
      "╔══════════════════════════════════════════════════════════╗"
    )
  );
  console.log(
    c("yellow", "║") +
      c("bright", "                  Coverage Report                       ") +
      c("yellow", "║")
  );
  console.log(
    c(
      "yellow",
      "╚══════════════════════════════════════════════════════════╝"
    )
  );
}

function parseJestOutput(output) {
  // Jest format: "Tests:       31 passed, 31 total" or "Tests:       2 failed, 29 passed, 31 total"
  const testsLine = output.match(/Tests:\s+(.+)/);
  let passed = 0;
  let failed = 0;

  if (testsLine) {
    const passedMatch = testsLine[1].match(/(\d+)\s+passed/);
    const failedMatch = testsLine[1].match(/(\d+)\s+failed/);
    if (passedMatch) passed = parseInt(passedMatch[1], 10);
    if (failedMatch) failed = parseInt(failedMatch[1], 10);
  }

  // Time format: "Time:        1.619 s" or "Time:        1.619s"
  const timeMatch = output.match(/Time:\s+([\d.]+)\s*s/);
  const duration = timeMatch ? `${timeMatch[1]}s` : null;

  return { passed, failed, duration };
}

function runTests() {
  printHeader();

  const jestArgs = ["test", "--"];
  if (withCoverage) {
    jestArgs.push("--coverage");
  }
  if (testPath) {
    jestArgs.push(testPath);
  }

  printSection(
    withCoverage ? "Running Tests with Coverage" : "Running All Tests"
  );

  if (testPath) {
    console.log(c("dim", `  Filter: ${testPath}`));
    console.log();
  }

  // Build jest arguments
  const jestArgsArray = withCoverage ? ["jest", "--coverage"] : ["jest"];
  if (testPath) {
    jestArgsArray.push(testPath);
  }

  // Run Jest using spawnSync for better output capture
  const result = spawnSync("npx", jestArgsArray, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: true,
  });

  const output = (result.stdout || "") + (result.stderr || "");
  const exitCode = result.status || 0;

  // Print the Jest output
  console.log(output);

  const { passed, failed, duration } = parseJestOutput(output);

  // Check if it's just coverage threshold failure (all tests passed)
  const thresholdFailed = output.includes("coverage threshold");
  const actualFailed = thresholdFailed && failed === 0 ? 0 : failed;

  if (withCoverage) {
    printCoverageHeader();

    // Extract coverage summary
    const stmtMatch = output.match(/Statements\s+:\s+([\d.]+)%/);
    const branchMatch = output.match(/Branches\s+:\s+([\d.]+)%/);
    const funcMatch = output.match(/Functions\s+:\s+([\d.]+)%/);
    const lineMatch = output.match(/Lines\s+:\s+([\d.]+)%/);

    if (stmtMatch) {
      console.log();
      console.log(c("dim", "  Coverage Summary:"));
      console.log(`    Statements: ${stmtMatch[1]}%`);
      console.log(`    Branches:   ${branchMatch ? branchMatch[1] : "N/A"}%`);
      console.log(`    Functions:  ${funcMatch ? funcMatch[1] : "N/A"}%`);
      console.log(`    Lines:      ${lineMatch ? lineMatch[1] : "N/A"}%`);
    }

    if (thresholdFailed) {
      console.log();
      console.log(
        c("yellow", "  Warning: Coverage thresholds not met (target: 80%)")
      );
    }
  }

  printResults(passed, actualFailed, duration);
  process.exit(exitCode);
}

// Run
runTests();
