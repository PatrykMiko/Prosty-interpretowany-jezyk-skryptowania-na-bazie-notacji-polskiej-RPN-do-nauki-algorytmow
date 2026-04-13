import { parseSource } from "./parser";

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: bun run src/parse.ts [-d|--dump] <source-file.tur>");
  process.exit(1);
}

const dump = args.includes("-d") || args.includes("--dump");
const sourcePath = args[args.length - 1];

const source = await Bun.file(sourcePath).text().catch((err) => {
  throw new Error(`Cannot read '${sourcePath}': ${String(err)}`);
});

try {
  const ast = parseSource(source, sourcePath);
  const serialized = JSON.stringify(ast, null, 2);
  if (dump) {
    await Bun.write(`${sourcePath}-ast.json`, serialized);
    console.log(`AST dumped to ${sourcePath}-ast.json`);
  } else {
    console.log(serialized);
  }
} catch (err) {
  console.error(`Parse error: ${(err as Error).message}`);
  process.exit(1);
}
