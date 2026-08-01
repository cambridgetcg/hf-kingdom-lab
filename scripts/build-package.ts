#!/usr/bin/env bun

import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  rm,
} from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = join(root, "dist");

if (resolve(output) !== join(root, "dist")) {
  throw new Error("package output escaped the repository root");
}

try {
  const existing = await lstat(output);
  if (existing.isSymbolicLink()) {
    throw new Error("refusing to replace a symlinked dist directory");
  }
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
    throw error;
  }
}

await rm(output, { recursive: true, force: true });

const compiler = Bun.spawn({
  cmd: ["./node_modules/.bin/tsc", "-p", "tsconfig.build.json"],
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env },
});
if (await compiler.exited !== 0) {
  throw new Error("TypeScript package build failed");
}

await mkdir(output, { recursive: true });
await copyFile(
  join(root, "src", "mcpshield_sql.py"),
  join(output, "mcpshield_sql.py"),
);
for (const cli of ["cli.js", "flow-cli.js", "treasure-cli.js"]) {
  await chmod(join(output, cli), 0o755);
}

process.stdout.write(`${JSON.stringify({
  protocol: "hf-kingdom-package-build/v1",
  output: "dist",
  compiled_typescript: true,
  copied_python_helper: true,
  lifecycle_code_run: false,
}, null, 2)}\n`);
