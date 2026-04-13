import { CharStreams, CommonTokenStream } from "antlr4ts";
import { ANTLRErrorListener } from "antlr4ts/ANTLRErrorListener";
import { RecognitionException } from "antlr4ts/RecognitionException";
import { Recognizer } from "antlr4ts/Recognizer";
import { Token } from "antlr4ts/Token";
import { buildSourceLines } from "./ast-builder";
import { ProgramNode } from "./ast";
import { compileSourceLines } from "./compiler";
import { TurLangLexer } from "./generated/grammar/TurLangLexer";
import { TurLangParser } from "./generated/grammar/TurLangParser";

function createThrowingErrorListener(sourceName: string): ANTLRErrorListener<Token | number> {
  return {
    syntaxError(
      _recognizer: Recognizer<Token | number, any>,
      _offendingSymbol: Token | number | undefined,
      line: number,
      charPositionInLine: number,
      msg: string,
      _e: RecognitionException | undefined
    ): void {
      throw new Error(`${sourceName}:${line}:${charPositionInLine} ${msg}`);
    },
  };
}

export function parseSource(source: string, sourceName = "<input>"): ProgramNode {
  const input = CharStreams.fromString(source);
  const lexer = new TurLangLexer(input);
  lexer.removeErrorListeners();
  lexer.addErrorListener(createThrowingErrorListener(sourceName) as ANTLRErrorListener<number>);

  const tokenStream = new CommonTokenStream(lexer);
  const parser = new TurLangParser(tokenStream);
  parser.removeErrorListeners();
  parser.addErrorListener(createThrowingErrorListener(sourceName) as ANTLRErrorListener<Token>);

  const tree = parser.program();
  const lines = buildSourceLines(tree);
  return compileSourceLines(lines);
}
