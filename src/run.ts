import { readFileSync, readSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseSource } from "./parser";
import { Runtime, RuntimeExtension } from "./runtime";

function usage(): never {
  console.error("Usage: bun run src/run.ts [--ext path/to/ext.ts] <source-file.tur>");
  process.exit(1);
}

const args = process.argv.slice(2);
const extPaths: string[] = [];
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ext") {
    if (i + 1 >= args.length) usage();
    extPaths.push(args[++i]);
    continue;
  }
  positional.push(args[i]);
}
if (positional.length !== 1) usage();

const sourcePath = positional[0];
const source = await Bun.file(sourcePath).text().catch((err) => {
  throw new Error(`Cannot read '${sourcePath}': ${String(err)}`);
});

const ast = parseSource(source, sourcePath);
const pipedLines =
  process.stdin.isTTY
    ? null
    : readFileSync(0, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.length > 0);
let pipedPtr = 0;

const extensions: RuntimeExtension[] = [];
for (const extPath of extPaths) {
  const abs = resolve(extPath);
  const mod = await import(pathToFileURL(abs).href);
  const ext = (mod.default ?? mod.extension) as RuntimeExtension | undefined;
  if (!ext || typeof ext !== "object" || !("functions" in ext)) {
    throw new Error(`Invalid extension module '${extPath}'`);
  }
  extensions.push(ext);
}

const runtime = new Runtime({
  write: (text) => process.stdout.write(text),
  read: () => {
    if (pipedLines) {
      return pipedPtr < pipedLines.length ? pipedLines[pipedPtr++] : "";
    }
    const buf = Buffer.alloc(4096);
    const n = readSync(0, buf, 0, buf.length, null);
    return buf.subarray(0, n).toString("utf-8").trim();
  },
}, extensions);

try {
  runtime.run(ast);
} catch (err) {
  console.error(`Runtime error: ${(err as Error).message}`);
  process.exit(1);
}
