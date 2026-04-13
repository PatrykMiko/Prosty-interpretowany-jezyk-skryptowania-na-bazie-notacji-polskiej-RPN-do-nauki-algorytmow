import { ExprNode, ProgramNode, StatementNode } from "./ast";
import { SourceLine } from "./ast-builder";

type CommandSpec = {
  minArgs: number;
  maxArgs: number | null;
};

const SPECS = new Map<string, CommandSpec>([
  ["add", { minArgs: 2, maxArgs: 2 }],
  ["sub", { minArgs: 2, maxArgs: 2 }],
  ["mul", { minArgs: 2, maxArgs: 2 }],
  ["div", { minArgs: 2, maxArgs: 2 }],
  ["mod", { minArgs: 2, maxArgs: 2 }],
  ["neg", { minArgs: 1, maxArgs: 1 }],
  ["eq", { minArgs: 2, maxArgs: 2 }],
  ["neq", { minArgs: 2, maxArgs: 2 }],
  ["lt", { minArgs: 2, maxArgs: 2 }],
  ["le", { minArgs: 2, maxArgs: 2 }],
  ["gt", { minArgs: 2, maxArgs: 2 }],
  ["ge", { minArgs: 2, maxArgs: 2 }],
  ["and", { minArgs: 2, maxArgs: 2 }],
  ["or", { minArgs: 2, maxArgs: 2 }],
  ["not", { minArgs: 1, maxArgs: 1 }],
  ["set", { minArgs: 2, maxArgs: 2 }],
  ["type", { minArgs: 1, maxArgs: 1 }],
  ["error", { minArgs: 1, maxArgs: 1 }],
  ["iserror", { minArgs: 1, maxArgs: 1 }],
  ["errmsg", { minArgs: 1, maxArgs: 1 }],
  ["print", { minArgs: 1, maxArgs: null }],
  ["println", { minArgs: 0, maxArgs: null }],
  ["read", { minArgs: 0, maxArgs: 0 }],
  ["return", { minArgs: 0, maxArgs: 1 }],
  ["bigint", { minArgs: 1, maxArgs: 1 }],
  ["stack", { minArgs: 0, maxArgs: 0 }],
  ["queue", { minArgs: 0, maxArgs: 0 }],
  ["array", { minArgs: 0, maxArgs: 0 }],
  ["dict", { minArgs: 0, maxArgs: 0 }],
  ["push", { minArgs: 2, maxArgs: 2 }],
  ["pop", { minArgs: 1, maxArgs: 1 }],
  ["peek", { minArgs: 1, maxArgs: 1 }],
  ["enqueue", { minArgs: 2, maxArgs: 2 }],
  ["dequeue", { minArgs: 1, maxArgs: 1 }],
  ["size", { minArgs: 1, maxArgs: 1 }],
  ["isempty", { minArgs: 1, maxArgs: 1 }],
  ["aget", { minArgs: 2, maxArgs: 2 }],
  ["aset", { minArgs: 3, maxArgs: 3 }],
  ["ainsert", { minArgs: 3, maxArgs: 3 }],
  ["aremove", { minArgs: 2, maxArgs: 2 }],
  ["dset", { minArgs: 3, maxArgs: 3 }],
  ["dget", { minArgs: 2, maxArgs: 2 }],
  ["dhas", { minArgs: 2, maxArgs: 2 }],
  ["ddelete", { minArgs: 2, maxArgs: 2 }],
  ["keys", { minArgs: 1, maxArgs: 1 }],
  ["values", { minArgs: 1, maxArgs: 1 }],
  ["len", { minArgs: 1, maxArgs: 1 }],
  ["int", { minArgs: 1, maxArgs: 1 }],
  ["float", { minArgs: 1, maxArgs: 1 }],
  ["str", { minArgs: 1, maxArgs: 1 }],
  ["bool", { minArgs: 1, maxArgs: 1 }],
]);

type TokenStream = {
  tokens: string[];
  at: number;
  lineNo: number;
};

function parseLiteral(token: string): ExprNode {
  if (token.startsWith("$")) return { type: "variable", name: token.slice(1) };
  if (token === "true") return { type: "literal", value: true };
  if (token === "false") return { type: "literal", value: false };
  if (token === "null") return { type: "literal", value: null };
  if (token.startsWith('"')) {
    return { type: "literal", value: JSON.parse(token) as string };
  }
  const n = Number(token);
  if (!Number.isNaN(n) && token.trim() !== "") {
    return { type: "literal", value: n };
  }
  return { type: "literal", value: token };
}

function parseExpr(stream: TokenStream): ExprNode {
  if (stream.at >= stream.tokens.length) {
    throw new Error(`Line ${stream.lineNo}: unexpected end of expression`);
  }

  const token = stream.tokens[stream.at++];
  if (!SPECS.has(token) && token !== "call" && token !== "extcall" && token !== "invoke") {
    return parseLiteral(token);
  }

  if (token === "call") {
    if (stream.at + 1 >= stream.tokens.length) {
      throw new Error(`Line ${stream.lineNo}: call requires function name and arg count`);
    }
    const fnToken = stream.tokens[stream.at++];
    const argcToken = stream.tokens[stream.at++];
    const argc = Number(argcToken);
    if (!Number.isInteger(argc) || argc < 0) {
      throw new Error(`Line ${stream.lineNo}: call arg count must be a non-negative integer`);
    }
    const args: ExprNode[] = [{ type: "literal", value: fnToken }, { type: "literal", value: argc }];
    for (let i = 0; i < argc; i++) {
      args.push(parseExpr(stream));
    }
    return { type: "command", name: "call", args };
  }

  if (token === "extcall") {
    if (stream.at + 1 >= stream.tokens.length) {
      throw new Error(`Line ${stream.lineNo}: extcall requires function name and arg count`);
    }
    const fnToken = stream.tokens[stream.at++];
    const argcToken = stream.tokens[stream.at++];
    const argc = Number(argcToken);
    if (!Number.isInteger(argc) || argc < 0) {
      throw new Error(`Line ${stream.lineNo}: extcall arg count must be a non-negative integer`);
    }
    const args: ExprNode[] = [{ type: "literal", value: fnToken }, { type: "literal", value: argc }];
    for (let i = 0; i < argc; i++) {
      args.push(parseExpr(stream));
    }
    return { type: "command", name: "extcall", args };
  }

  if (token === "invoke") {
    if (stream.at + 2 >= stream.tokens.length) {
      throw new Error(`Line ${stream.lineNo}: invoke requires object, method name and arg count`);
    }
    const objectExpr = parseExpr(stream);
    const methodToken = stream.tokens[stream.at++];
    const argcToken = stream.tokens[stream.at++];
    const argc = Number(argcToken);
    if (!Number.isInteger(argc) || argc < 0) {
      throw new Error(`Line ${stream.lineNo}: invoke arg count must be a non-negative integer`);
    }
    const args: ExprNode[] = [objectExpr, { type: "literal", value: methodToken }, { type: "literal", value: argc }];
    for (let i = 0; i < argc; i++) {
      args.push(parseExpr(stream));
    }
    return { type: "command", name: "invoke", args };
  }

  const spec = SPECS.get(token);
  if (!spec) {
    throw new Error(`Line ${stream.lineNo}: unknown command '${token}'`);
  }

  const args: ExprNode[] = [];
  if (spec.maxArgs === null) {
    while (stream.at < stream.tokens.length) {
      args.push(parseExpr(stream));
    }
    if (args.length < spec.minArgs) {
      throw new Error(`Line ${stream.lineNo}: command ${token} needs at least ${spec.minArgs} args`);
    }
  } else {
    for (let i = 0; i < spec.maxArgs; i++) {
      if (stream.at >= stream.tokens.length) {
        if (i < spec.minArgs) {
          throw new Error(`Line ${stream.lineNo}: command ${token} expects ${spec.minArgs} args`);
        }
        break;
      }
      args.push(parseExpr(stream));
    }
  }

  return { type: "command", name: token, args };
}

function parseExprLine(tokens: string[], lineNo: number): ExprNode {
  const stream: TokenStream = { tokens, at: 0, lineNo };
  const expr = parseExpr(stream);
  if (stream.at !== stream.tokens.length) {
    throw new Error(`Line ${lineNo}: unexpected token '${tokens[stream.at]}'`);
  }
  return expr;
}

class BlockParser {
  constructor(private readonly lines: SourceLine[]) {}

  parseProgram(): ProgramNode {
    const [statements, idx] = this.parseStatements(0, false);
    if (idx !== this.lines.length) {
      throw new Error(`Line ${this.lines[idx].lineNo}: unexpected trailing block token`);
    }
    return { type: "program", statements };
  }

  private parseStatements(start: number, stopAtBrace: boolean): [StatementNode[], number] {
    const out: StatementNode[] = [];
    let i = start;
    while (i < this.lines.length) {
      const { tokens, lineNo } = this.lines[i];
      if (tokens.length === 0) {
        i++;
        continue;
      }

      if (tokens.length === 1 && tokens[0] === "}") {
        if (!stopAtBrace) {
          throw new Error(`Line ${lineNo}: unexpected '}'`);
        }
        return [out, i + 1];
      }

      if (tokens[tokens.length - 1] === "{") {
        const head = tokens[0];
        if (head === "while") {
          const condition = parseExprLine(tokens.slice(1, -1), lineNo);
          const [body, next] = this.parseStatements(i + 1, true);
          out.push({ type: "while", condition, body });
          i = next;
          continue;
        }
        if (head === "if") {
          const condition = parseExprLine(tokens.slice(1, -1), lineNo);
          const [thenBody, nextThen] = this.parseStatements(i + 1, true);
          let elseBody: StatementNode[] | null = null;
          let next = nextThen;
          if (next < this.lines.length) {
            const elseLine = this.lines[next];
            if (elseLine.tokens.length === 2 && elseLine.tokens[0] === "else" && elseLine.tokens[1] === "{") {
              const [parsedElse, nextElse] = this.parseStatements(next + 1, true);
              elseBody = parsedElse;
              next = nextElse;
            }
          }
          out.push({ type: "if", condition, thenBody, elseBody });
          i = next;
          continue;
        }
        if (head === "fn") {
          if (tokens.length < 3) {
            throw new Error(`Line ${lineNo}: fn requires name and body`);
          }
          const name = tokens[1];
          const params = tokens.slice(2, -1);
          const [body, next] = this.parseStatements(i + 1, true);
          out.push({ type: "fn", name, params, body });
          i = next;
          continue;
        }
        throw new Error(`Line ${lineNo}: unsupported block opener '${tokens.join(" ")}'`);
      }

      const expr = parseExprLine(tokens, lineNo);
      out.push({ type: "exprStmt", expr });
      i++;
    }

    if (stopAtBrace) {
      throw new Error("Missing closing '}'");
    }
    return [out, i];
  }
}

export function compileSourceLines(lines: SourceLine[]): ProgramNode {
  return new BlockParser(lines).parseProgram();
}
