import { ProgramContext } from "./generated/grammar/TurLangParser";

export type SourceLine = {
  lineNo: number;
  tokens: string[];
};

export function buildSourceLines(ctx: ProgramContext): SourceLine[] {
  const lines: SourceLine[] = [];
  for (const line of ctx.line()) {
    const tokenSeq = line.tokenSeq();
    const tokens = tokenSeq ? tokenSeq.token().map((t) => t.text) : [];
    lines.push({
      lineNo: line.start.line,
      tokens,
    });
  }
  return lines;
}
