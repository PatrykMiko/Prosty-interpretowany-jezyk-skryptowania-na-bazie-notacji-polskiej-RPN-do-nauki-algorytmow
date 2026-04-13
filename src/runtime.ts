import { CommandExprNode, ExprNode, ProgramNode, StatementNode } from "./ast";

type StackObj = { kind: "stack"; data: RuntimeValue[] };
type QueueObj = { kind: "queue"; data: RuntimeValue[] };
type ArrayObj = { kind: "array"; data: RuntimeValue[] };
type DictObj = { kind: "dict"; data: Map<string, RuntimeValue> };
type ErrorValue = { kind: "error"; message: string };
type UserFunction = {
  kind: "function";
  name: string;
  params: string[];
  body: StatementNode[];
  closure: Scope;
};
type ObjectValue = {
  kind: "object";
  typeName: string;
  fields: Map<string, RuntimeValue>;
  methods: Map<string, string>;
};

export type RuntimeValue =
  | number
  | string
  | boolean
  | null
  | bigint
  | StackObj
  | QueueObj
  | ArrayObj
  | DictObj
  | ErrorValue
  | UserFunction
  | ObjectValue;

export type RuntimeIO = {
  write: (text: string) => void;
  read: () => string;
};

export type ExtensionApi = {
  error: (message: string) => ErrorValue;
  makeObject: (typeName: string, fields?: Record<string, RuntimeValue>, methods?: Record<string, string>) => ObjectValue;
  typeOf: (value: RuntimeValue) => string;
};

export type ExtensionFunction = (args: RuntimeValue[], api: ExtensionApi) => RuntimeValue;

export type RuntimeExtension = {
  functions: Record<string, ExtensionFunction>;
};

class ReturnSignal {
  constructor(readonly value: RuntimeValue) {}
}

class Scope {
  private readonly values = new Map<string, RuntimeValue>();

  constructor(private readonly parent: Scope | null) {}

  define(name: string, value: RuntimeValue): void {
    this.values.set(name, value);
  }

  get(name: string): RuntimeValue {
    if (this.values.has(name)) return this.values.get(name)!;
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined variable '${name}'`);
  }

  set(name: string, value: RuntimeValue): void {
    if (this.values.has(name)) {
      this.values.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    this.values.set(name, value);
  }
}

function isError(value: RuntimeValue): value is ErrorValue {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "error";
}

function err(message: string): ErrorValue {
  return { kind: "error", message };
}

function isObject(value: RuntimeValue): value is StackObj | QueueObj | ArrayObj | DictObj | ObjectValue {
  return typeof value === "object" && value !== null && "kind" in value && (
    value.kind === "stack" ||
    value.kind === "queue" ||
    value.kind === "array" ||
    value.kind === "dict" ||
    value.kind === "object"
  );
}

function typeOfValue(value: RuntimeValue): string {
  if (value === null) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "bigint") return "bigint";
  if (typeof value === "object" && value !== null && "kind" in value) {
    if (value.kind === "object") return `object:${value.typeName}`;
    return value.kind;
  }
  return "unknown";
}

function asNumber(value: RuntimeValue): number | ErrorValue {
  if (typeof value !== "number") return err(`Expected number, got '${typeOfValue(value)}'`);
  return value;
}

function asInt(value: RuntimeValue): number | ErrorValue {
  const n = asNumber(value);
  if (isError(n)) return n;
  if (!Number.isInteger(n)) return err(`Expected integer, got '${n}'`);
  return n;
}

function asBigInt(value: RuntimeValue): bigint | ErrorValue {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      return err(`Cannot convert '${value}' to bigint`);
    }
  }
  return err(`Cannot convert '${typeOfValue(value)}' to bigint`);
}

function toBool(value: RuntimeValue): boolean {
  if (isError(value)) return false;
  return !!value;
}

function hasError(values: RuntimeValue[]): ErrorValue | null {
  for (const v of values) {
    if (isError(v)) return v;
  }
  return null;
}

function exceptionMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function stringify(value: RuntimeValue): string {
  if (value === null) return "null";
  if (typeof value === "bigint") return `${value}n`;
  if (isError(value)) return `error(${value.message})`;
  if (typeof value === "object" && value !== null && "kind" in value) {
    if (value.kind === "dict") {
      const body = [...value.data.entries()].map(([k, v]) => `${k}: ${stringify(v)}`).join(", ");
      return `{${body}}`;
    }
    if (value.kind === "object") {
      const body = [...value.fields.entries()].map(([k, v]) => `${k}: ${stringify(v)}`).join(", ");
      return `${value.typeName}{${body}}`;
    }
    if (value.kind === "function") {
      return `<fn ${value.name}>`;
    }
    return `[${value.data.map(stringify).join(", ")}]`;
  }
  return String(value);
}

function isRuntimeValue(value: unknown): value is RuntimeValue {
  if (value === null) return true;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || typeof value === "bigint") return true;
  if (!value || typeof value !== "object") return false;
  if (!("kind" in value)) return false;
  const kind = (value as { kind: unknown }).kind;
  if (kind === "error") {
    return typeof (value as { message?: unknown }).message === "string";
  }
  if (kind === "stack" || kind === "queue" || kind === "array") {
    const data = (value as { data?: unknown }).data;
    return Array.isArray(data) && data.every((x) => isRuntimeValue(x));
  }
  if (kind === "dict") {
    const data = (value as { data?: unknown }).data;
    if (!(data instanceof Map)) return false;
    for (const [k, v] of data.entries()) {
      if (typeof k !== "string" || !isRuntimeValue(v)) return false;
    }
    return true;
  }
  if (kind === "object") {
    const v = value as { typeName?: unknown; fields?: unknown; methods?: unknown };
    if (typeof v.typeName !== "string") return false;
    if (!(v.fields instanceof Map) || !(v.methods instanceof Map)) return false;
    for (const [k, fieldValue] of v.fields.entries()) {
      if (typeof k !== "string" || !isRuntimeValue(fieldValue)) return false;
    }
    for (const [k, methodName] of v.methods.entries()) {
      if (typeof k !== "string" || typeof methodName !== "string") return false;
    }
    return true;
  }
  if (kind === "function") return true;
  return false;
}

export class Runtime {
  private readonly global = new Scope(null);
  private readonly io: RuntimeIO;
  private readonly extensionFunctions = new Map<string, ExtensionFunction>();

  constructor(io: RuntimeIO, extensions: RuntimeExtension[] = []) {
    this.io = io;
    for (const ext of extensions) {
      for (const [name, fn] of Object.entries(ext.functions ?? {})) {
        this.extensionFunctions.set(name, fn);
      }
    }
  }

  run(program: ProgramNode): RuntimeValue {
    try {
      this.execBlock(program.statements, this.global);
      return null;
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    }
  }

  private extensionApi(): ExtensionApi {
    return {
      error: err,
      makeObject: (typeName, fields = {}, methods = {}) => ({
        kind: "object",
        typeName,
        fields: new Map<string, RuntimeValue>(Object.entries(fields)),
        methods: new Map<string, string>(Object.entries(methods)),
      }),
      typeOf: typeOfValue,
    };
  }

  private execBlock(statements: StatementNode[], scope: Scope): void {
    for (const stmt of statements) {
      this.execStatement(stmt, scope);
    }
  }

  private execStatement(stmt: StatementNode, scope: Scope): void {
    if (stmt.type === "exprStmt") {
      this.evalExpr(stmt.expr, scope);
      return;
    }
    if (stmt.type === "while") {
      while (toBool(this.evalExpr(stmt.condition, scope))) {
        this.execBlock(stmt.body, scope);
      }
      return;
    }
    if (stmt.type === "if") {
      if (toBool(this.evalExpr(stmt.condition, scope))) {
        this.execBlock(stmt.thenBody, scope);
      } else if (stmt.elseBody) {
        this.execBlock(stmt.elseBody, scope);
      }
      return;
    }
    if (stmt.type === "fn") {
      const fn: UserFunction = {
        kind: "function",
        name: stmt.name,
        params: stmt.params,
        body: stmt.body,
        closure: scope,
      };
      scope.set(stmt.name, fn);
      return;
    }
  }

  private evalExpr(expr: ExprNode, scope: Scope): RuntimeValue {
    if (expr.type === "literal") return expr.value as RuntimeValue;
    if (expr.type === "variable") return scope.get(expr.name);
    return this.evalCommand(expr, scope);
  }

  private evalCommand(expr: CommandExprNode, scope: Scope): RuntimeValue {
    const arg = (idx: number): RuntimeValue => this.evalExpr(expr.args[idx], scope);
    const args = (): RuntimeValue[] => expr.args.map((a) => this.evalExpr(a, scope));

    switch (expr.name) {
      case "type":
        return typeOfValue(arg(0));
      case "error":
        return err(String(arg(0)));
      case "iserror":
        return isError(arg(0));
      case "errmsg": {
        const e = arg(0);
        return isError(e) ? e.message : err("errmsg expects error value");
      }
      case "add": {
        const a = arg(0);
        const b = arg(1);
        if (isError(a)) return a;
        if (isError(b)) return b;
        if (typeof a === "number" && typeof b === "number") return a + b;
        if (typeof a === "bigint" || typeof b === "bigint") {
          const ai = asBigInt(a);
          if (isError(ai)) return ai;
          const bi = asBigInt(b);
          if (isError(bi)) return bi;
          return ai + bi;
        }
        if (typeof a === "string" || typeof b === "string") return stringify(a) + stringify(b);
        if (typeof a === "object" && a && "kind" in a && a.kind === "array" &&
            typeof b === "object" && b && "kind" in b && b.kind === "array") {
          return { kind: "array", data: [...a.data, ...b.data] };
        }
        return err(`Unsupported add(${typeOfValue(a)}, ${typeOfValue(b)})`);
      }
      case "sub":
      case "mul":
      case "div":
      case "mod": {
        const a = arg(0);
        const b = arg(1);
        if (isError(a)) return a;
        if (isError(b)) return b;
        const op = expr.name;
        if (typeof a === "number" && typeof b === "number") {
          if ((op === "div" || op === "mod") && b === 0) return err("Division by zero");
          if (op === "sub") return a - b;
          if (op === "mul") return a * b;
          if (op === "div") return a / b;
          return a % b;
        }
        const ai = asBigInt(a);
        if (isError(ai)) return ai;
        const bi = asBigInt(b);
        if (isError(bi)) return bi;
        if ((op === "div" || op === "mod") && bi === 0n) return err("Division by zero");
        if (op === "sub") return ai - bi;
        if (op === "mul") return ai * bi;
        if (op === "div") return ai / bi;
        return ai % bi;
      }
      case "neg": {
        const v = arg(0);
        if (isError(v)) return v;
        if (typeof v === "number") return -v;
        if (typeof v === "bigint") return -v;
        return err(`neg expects number or bigint, got '${typeOfValue(v)}'`);
      }
      case "eq":
        return arg(0) === arg(1);
      case "neq":
        return arg(0) !== arg(1);
      case "lt":
      case "le":
      case "gt":
      case "ge": {
        const a = arg(0);
        const b = arg(1);
        if (isError(a)) return a;
        if (isError(b)) return b;
        if (typeof a === "string" && typeof b === "string") {
          if (expr.name === "lt") return a < b;
          if (expr.name === "le") return a <= b;
          if (expr.name === "gt") return a > b;
          return a >= b;
        }
        if (typeof a === "number" && typeof b === "number") {
          if (expr.name === "lt") return a < b;
          if (expr.name === "le") return a <= b;
          if (expr.name === "gt") return a > b;
          return a >= b;
        }
        const ai = asBigInt(a);
        if (isError(ai)) return ai;
        const bi = asBigInt(b);
        if (isError(bi)) return bi;
        if (expr.name === "lt") return ai < bi;
        if (expr.name === "le") return ai <= bi;
        if (expr.name === "gt") return ai > bi;
        return ai >= bi;
      }
      case "and": {
        const a = arg(0);
        if (isError(a)) return a;
        if (!toBool(a)) return false;
        return toBool(arg(1));
      }
      case "or": {
        const a = arg(0);
        if (isError(a)) return a;
        if (toBool(a)) return true;
        return toBool(arg(1));
      }
      case "not": {
        const v = arg(0);
        if (isError(v)) return v;
        return !toBool(v);
      }
      case "print": {
        this.io.write(args().map(stringify).join(" "));
        return null;
      }
      case "println": {
        this.io.write(args().map(stringify).join(" ") + "\n");
        return null;
      }
      case "read":
        return this.io.read();
      case "return": {
        const value = expr.args.length ? arg(0) : null;
        throw new ReturnSignal(value);
      }
      case "set": {
        const value = arg(1);
        this.assignTarget(expr.args[0], value, scope);
        return null;
      }
      case "int": {
        const v = arg(0);
        if (isError(v)) return v;
        if (typeof v === "bigint") return Number(v);
        const n = Number(v);
        if (Number.isNaN(n)) return err(`Cannot convert '${String(v)}' to int`);
        return Math.trunc(n);
      }
      case "float": {
        const v = arg(0);
        if (isError(v)) return v;
        if (typeof v === "bigint") return Number(v);
        const n = Number(v);
        if (Number.isNaN(n)) return err(`Cannot convert '${String(v)}' to float`);
        return n;
      }
      case "bigint": {
        const v = arg(0);
        if (isError(v)) return v;
        return asBigInt(v);
      }
      case "str":
        return stringify(arg(0));
      case "bool":
        return toBool(arg(0));
      case "stack":
        return { kind: "stack", data: [] };
      case "queue":
        return { kind: "queue", data: [] };
      case "array":
        return { kind: "array", data: [] };
      case "dict":
        return { kind: "dict", data: new Map<string, RuntimeValue>() };
      case "push": {
        const obj = arg(0);
        const value = arg(1);
        if (isError(obj)) return obj;
        if (!isObject(obj) || (obj.kind !== "stack" && obj.kind !== "array")) return err("push expects stack or array");
        obj.data.push(value);
        return null;
      }
      case "pop": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || (obj.kind !== "stack" && obj.kind !== "array")) return err("pop expects stack or array");
        return obj.data.pop() ?? null;
      }
      case "peek": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || (obj.kind !== "stack" && obj.kind !== "queue")) return err("peek expects stack or queue");
        if (obj.kind === "stack") return obj.data.length ? obj.data[obj.data.length - 1] : null;
        return obj.data.length ? obj.data[0] : null;
      }
      case "enqueue": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || obj.kind !== "queue") return err("enqueue expects queue");
        obj.data.push(arg(1));
        return null;
      }
      case "dequeue": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || obj.kind !== "queue") return err("dequeue expects queue");
        return obj.data.shift() ?? null;
      }
      case "size": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj)) return err("size expects object");
        if (obj.kind === "dict") return obj.data.size;
        if (obj.kind === "object") return obj.fields.size;
        return obj.data.length;
      }
      case "isempty": {
        const size = this.evalCommand({ type: "command", name: "size", args: [expr.args[0]] }, scope);
        if (isError(size)) return size;
        const n = asInt(size);
        if (isError(n)) return n;
        return n === 0;
      }
      case "aget": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        const idx = asInt(arg(1));
        if (isError(idx)) return idx;
        if (!isObject(obj) || (obj.kind !== "array" && obj.kind !== "stack" && obj.kind !== "queue")) return err("aget expects array/stack/queue");
        if (idx < 0 || idx >= obj.data.length) return err(`Index ${idx} out of bounds`);
        return obj.data[idx];
      }
      case "aset": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        const idx = asInt(arg(1));
        if (isError(idx)) return idx;
        const value = arg(2);
        if (!isObject(obj) || (obj.kind !== "array" && obj.kind !== "stack" && obj.kind !== "queue")) return err("aset expects array/stack/queue");
        if (idx < 0 || idx >= obj.data.length) return err(`Index ${idx} out of bounds`);
        obj.data[idx] = value;
        return null;
      }
      case "ainsert": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        const idx = asInt(arg(1));
        if (isError(idx)) return idx;
        if (!isObject(obj) || obj.kind !== "array") return err("ainsert expects array");
        if (idx < 0 || idx > obj.data.length) return err(`Index ${idx} out of bounds`);
        obj.data.splice(idx, 0, arg(2));
        return null;
      }
      case "aremove": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        const idx = asInt(arg(1));
        if (isError(idx)) return idx;
        if (!isObject(obj) || obj.kind !== "array") return err("aremove expects array");
        if (idx < 0 || idx >= obj.data.length) return err(`Index ${idx} out of bounds`);
        return obj.data.splice(idx, 1)[0];
      }
      case "dset": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || obj.kind !== "dict") return err("dset expects dict");
        obj.data.set(String(arg(1)), arg(2));
        return null;
      }
      case "dget": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || obj.kind !== "dict") return err("dget expects dict");
        return obj.data.get(String(arg(1))) ?? null;
      }
      case "dhas": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || obj.kind !== "dict") return err("dhas expects dict");
        return obj.data.has(String(arg(1)));
      }
      case "ddelete": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || obj.kind !== "dict") return err("ddelete expects dict");
        return obj.data.delete(String(arg(1)));
      }
      case "keys": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || obj.kind !== "dict") return err("keys expects dict");
        return { kind: "array", data: [...obj.data.keys()] };
      }
      case "values": {
        const obj = arg(0);
        if (isError(obj)) return obj;
        if (!isObject(obj) || obj.kind !== "dict") return err("values expects dict");
        return { kind: "array", data: [...obj.data.values()] };
      }
      case "len": {
        const v = arg(0);
        if (isError(v)) return v;
        if (typeof v === "string") return v.length;
        if (isObject(v)) {
          if (v.kind === "dict") return v.data.size;
          if (v.kind === "object") return v.fields.size;
          return v.data.length;
        }
        return err("len supports string/object");
      }
      case "call":
        return this.callFunction(expr, scope);
      case "extcall":
        return this.callExtension(expr, scope);
      case "invoke":
        return this.invokeObject(expr, scope);
      default:
        throw new Error(`Unsupported command '${expr.name}'`);
    }
  }

  private assignTarget(targetExpr: ExprNode, value: RuntimeValue, scope: Scope): void {
    if (targetExpr.type !== "variable") {
      throw new Error("set target must be a variable, e.g. set $x 10");
    }
    scope.define(targetExpr.name, value);
  }

  private callFunction(callExpr: CommandExprNode, scope: Scope): RuntimeValue {
    const fnName = String(this.evalExpr(callExpr.args[0], scope));
    const argc = asInt(this.evalExpr(callExpr.args[1], scope));
    if (isError(argc)) return argc;
    if (callExpr.args.length !== argc + 2) return err(`call '${fnName}' expected ${argc} expression args`);
    const fnValue = scope.get(fnName);
    if (!fnValue || typeof fnValue !== "object" || !("kind" in fnValue) || fnValue.kind !== "function") {
      return err(`'${fnName}' is not a function`);
    }
    const fn = fnValue as UserFunction;
    if (fn.params.length !== argc) return err(`Function '${fnName}' expects ${fn.params.length} args, got ${argc}`);
    const fnScope = new Scope(fn.closure);
    for (let i = 0; i < argc; i++) {
      fnScope.define(fn.params[i], this.evalExpr(callExpr.args[i + 2], scope));
    }
    try {
      this.execBlock(fn.body, fnScope);
      return null;
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    }
  }

  private callExtension(expr: CommandExprNode, scope: Scope): RuntimeValue {
    const fnName = String(this.evalExpr(expr.args[0], scope));
    const argc = asInt(this.evalExpr(expr.args[1], scope));
    if (isError(argc)) return argc;
    if (expr.args.length !== argc + 2) return err(`extcall '${fnName}' expected ${argc} expression args`);
    const fn = this.extensionFunctions.get(fnName);
    if (!fn) return err(`Extension function '${fnName}' not found`);
    const values: RuntimeValue[] = [];
    for (let i = 0; i < argc; i++) values.push(this.evalExpr(expr.args[i + 2], scope));
    const preErr = hasError(values);
    if (preErr) return preErr;
    let out: RuntimeValue;
    try {
      out = fn(values, this.extensionApi());
    } catch (e) {
      return err(`Extension function '${fnName}' threw: ${exceptionMessage(e)}`);
    }
    if (!isRuntimeValue(out)) {
      return err(`Extension function '${fnName}' returned invalid runtime value`);
    }
    return out;
  }

  private invokeObject(expr: CommandExprNode, scope: Scope): RuntimeValue {
    const obj = this.evalExpr(expr.args[0], scope);
    if (isError(obj)) return obj;
    if (!obj || typeof obj !== "object" || !("kind" in obj) || obj.kind !== "object") {
      return err("invoke expects object value");
    }
    const method = String(this.evalExpr(expr.args[1], scope));
    const argc = asInt(this.evalExpr(expr.args[2], scope));
    if (isError(argc)) return argc;
    if (expr.args.length !== argc + 3) return err(`invoke '${method}' expected ${argc} expression args`);
    const fnName = obj.methods.get(method);
    if (!fnName) return err(`Method '${method}' not found on ${obj.typeName}`);
    const fn = this.extensionFunctions.get(fnName);
    if (!fn) return err(`Extension function '${fnName}' not found`);
    const args: RuntimeValue[] = [obj];
    for (let i = 0; i < argc; i++) args.push(this.evalExpr(expr.args[i + 3], scope));
    const preErr = hasError(args);
    if (preErr) return preErr;
    let out: RuntimeValue;
    try {
      out = fn(args, this.extensionApi());
    } catch (e) {
      return err(`Method '${method}' threw: ${exceptionMessage(e)}`);
    }
    if (!isRuntimeValue(out)) return err(`Method '${method}' returned invalid runtime value`);
    return out;
  }
}
