#!/usr/bin/env bun

import { createHash } from "node:crypto";
import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";

interface PackFile {
  path: string;
  size: number;
}

interface PackReport {
  name: string;
  version: string;
  filename: string;
  size: number;
  files: PackFile[];
}

const EXPECTED_NAME = "@agenttool/hf-kingdom-lab";
const EXPECTED_VERSION = "0.1.0";
const MAX_TARBALL_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 160;
const ALLOWED_ROOT_FILES = new Set([
  "LICENSE",
  "NOTICE",
  "README.md",
  "RIGHTS.md",
  "SECURITY.md",
  "kingdom.yaml",
  "package.json",
  "pyproject.toml",
  "uv.lock",
]);
const ALLOWED_DIRECTORIES = ["data/", "dist/", "docs/"];

const root = resolve(import.meta.dir, "..");
const releaseDirectory = await parseReleaseDirectory(Bun.argv.slice(2));
const workspace = await mkdtemp(join(tmpdir(), "hf-kingdom-package-"));
const packDirectory = join(workspace, "pack");
const installDirectory = join(workspace, "install");

try {
  const packageJson = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  ) as { name?: unknown; version?: unknown; private?: unknown };
  if (
    packageJson.name !== EXPECTED_NAME
    || packageJson.version !== EXPECTED_VERSION
    || packageJson.private !== undefined
  ) {
    throw new Error("package identity must remain public @agenttool/hf-kingdom-lab@0.1.0");
  }

  await mkdir(packDirectory, { recursive: true });
  const packed = await run([
    "npm",
    "pack",
    "--ignore-scripts",
    "--json",
    "--pack-destination",
    packDirectory,
  ], root, true);
  const decoded = JSON.parse(packed.stdout) as PackReport[];
  if (decoded.length !== 1 || !decoded[0]) {
    throw new Error("npm pack must produce exactly one artifact");
  }
  const report = decoded[0];
  if (
    report.name !== EXPECTED_NAME
    || report.version !== EXPECTED_VERSION
    || report.filename !== "agenttool-hf-kingdom-lab-0.1.0.tgz"
    || !Number.isInteger(report.size)
    || report.size < 1
    || report.size > MAX_TARBALL_BYTES
    || !Array.isArray(report.files)
    || report.files.length < 1
    || report.files.length > MAX_FILES
  ) {
    throw new Error("packed artifact identity or file/byte boundary drifted");
  }
  const packedPaths = new Set<string>();
  for (const file of report.files) {
    assertAllowedPath(file.path);
    if (packedPaths.has(file.path)) {
      throw new Error(`duplicate file in npm artifact: ${file.path}`);
    }
    packedPaths.add(file.path);
    if (!Number.isInteger(file.size) || file.size < 0) {
      throw new Error(`invalid packed file size: ${file.path}`);
    }
  }
  for (const required of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/flow-cli.js",
    "data/datadecide-ledger.v1.json",
    "data/dpi-provenance-contract.v1.json",
    "data/flow-lenses.v1.json",
    "LICENSE",
    "NOTICE",
  ]) {
    if (!report.files.some((file) => file.path === required)) {
      throw new Error(`packed artifact omitted required file: ${required}`);
    }
  }

  const tarball = join(packDirectory, basename(report.filename));
  const tarballStat = await lstat(tarball);
  if (!tarballStat.isFile() || tarballStat.isSymbolicLink()) {
    throw new Error("npm pack output must be one regular file");
  }
  const tarballBytes = await readFile(tarball);
  if (tarballBytes.byteLength !== report.size) {
    throw new Error("npm pack report size disagreed with the retained tarball");
  }
  const sha256 = createHash("sha256").update(tarballBytes).digest("hex");

  await run([
    "npm",
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--prefix",
    installDirectory,
    tarball,
  ], root);
  const installedTransformers = join(
    installDirectory,
    "node_modules",
    "@huggingface",
    "transformers",
  );
  if (await pathExists(installedTransformers)) {
    throw new Error("npm artifact must not install the deferred Transformers runtime");
  }
  await run([
    "bun",
    "--eval",
    [
      `import("${EXPECTED_NAME}").then(async (m) => {`,
      `if (typeof m.assertDataDecideLedger !== "function") process.exit(1);`,
      `if (typeof m.assertDpiProvenanceContract !== "function") process.exit(1);`,
      `if (typeof m.assertFlowLensCatalogue !== "function") process.exit(1);`,
      `if ((await m.loadFlowLensCatalogue()).entries.length !== 10) process.exit(1);`,
      `});`,
    ].join(""),
  ], installDirectory);
  for (const [binary, args] of [
    ["hfkl", ["--help"]],
    ["hfkl-flow", ["list"]],
    ["hfkl-flow", ["trace", "amaai-lab/MERP"]],
    ["hfkl-treasures", ["list"]],
  ] as const) {
    await run([join(installDirectory, "node_modules", ".bin", binary), ...args], installDirectory);
  }

  const verification = {
    protocol: "hf-kingdom-package-verification/v1",
    package: `${EXPECTED_NAME}@${EXPECTED_VERSION}`,
    filename: basename(tarball),
    bytes: tarballBytes.byteLength,
    sha256,
    files: report.files.length,
    installed_with_lifecycle_scripts: false,
    smoke_runtime: "bun",
    semantic_runtime_installed: false,
  } as const;
  const receipt = `${JSON.stringify(verification, null, 2)}\n`;

  if (releaseDirectory) {
    await writeFile(
      join(releaseDirectory, verification.filename),
      tarballBytes,
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(
      join(releaseDirectory, "receipt.json"),
      receipt,
      { flag: "wx", mode: 0o600 },
    );
  }

  process.stdout.write(receipt);
} finally {
  await rm(workspace, { recursive: true, force: true });
}

async function parseReleaseDirectory(args: string[]): Promise<string | undefined> {
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== "--release-dir" || !args[1]) {
    throw new Error("usage: verify-package.ts [--release-dir ABSOLUTE_EMPTY_DIRECTORY]");
  }
  if (!isAbsolute(args[1]) || args[1].length > 4_096 || args[1].includes("\0")) {
    throw new TypeError("release directory must be a bounded absolute path");
  }
  const directory = resolve(args[1]);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("release directory must be a real directory");
  }
  if (await realpath(directory) !== directory) {
    throw new Error("release directory must not contain symbolic-link ancestors");
  }
  if ((await readdir(directory)).length !== 0) {
    throw new Error("release directory must be empty");
  }
  return directory;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function assertAllowedPath(path: string): void {
  if (
    path.length === 0
    || path.startsWith("/")
    || path.includes("\\")
    || path.split("/").includes("..")
  ) {
    throw new Error(`unsafe packed path: ${path}`);
  }
  if (
    !ALLOWED_ROOT_FILES.has(path)
    && !ALLOWED_DIRECTORIES.some((prefix) => path.startsWith(prefix))
  ) {
    throw new Error(`unexpected file in npm artifact: ${path}`);
  }
}

async function run(
  cmd: string[],
  cwd: string,
  capture = false,
): Promise<{ stdout: string }> {
  const child = Bun.spawn({
    cmd,
    cwd,
    env: { ...process.env },
    stdout: capture ? "pipe" : "ignore",
    stderr: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    capture ? new Response(child.stdout).text() : Promise.resolve(""),
  ]);
  if (exitCode !== 0) {
    throw new Error(`${cmd[0]} failed (${exitCode}): ${stderr.trim().slice(-1_000)}`);
  }
  return { stdout };
}
