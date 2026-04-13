import type { ExtensionApi, RuntimeExtension, RuntimeValue } from "../src/runtime";
import { turSafe } from "./decorators";

function isPoint(value: RuntimeValue): value is {
  kind: "object";
  typeName: string;
  fields: Map<string, RuntimeValue>;
  methods: Map<string, string>;
} {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "object" && value.typeName === "Point";
}

class MathGeoExtension {
  @turSafe
  static safeDiv(args: RuntimeValue[], api: ExtensionApi): RuntimeValue {
    if (args.length !== 2) return api.error("safe_div expects 2 args");
    const [a, b] = args;
    if ((typeof a !== "number" && typeof a !== "bigint") || (typeof b !== "number" && typeof b !== "bigint")) {
      return api.error("safe_div expects numbers or bigints");
    }
    if ((typeof b === "number" && b === 0) || (typeof b === "bigint" && b === 0n)) {
      return api.error("division by zero");
    }
    if (typeof a === "bigint" || typeof b === "bigint") return BigInt(a) / BigInt(b);
    return a / b;
  }

  @turSafe
  static panic(_args: RuntimeValue[], _api: ExtensionApi): RuntimeValue {
    throw new Error("panic from extension");
  }

  @turSafe
  static makePoint(args: RuntimeValue[], api: ExtensionApi): RuntimeValue {
    if (args.length !== 2) return api.error("make_point expects 2 args");
    const [x, y] = args;
    if (typeof x !== "number" || typeof y !== "number") {
      return api.error("make_point expects (number, number)");
    }
    return api.makeObject("Point", { x, y }, { add: "point.add", norm: "point.norm" });
  }

  @turSafe
  static pointAdd(args: RuntimeValue[], api: ExtensionApi): RuntimeValue {
    if (args.length !== 2) return api.error("point.add expects self and other");
    const [self, other] = args;
    if (!isPoint(self) || !isPoint(other)) return api.error("point.add expects Point and Point");
    const x1 = self.fields.get("x");
    const y1 = self.fields.get("y");
    const x2 = other.fields.get("x");
    const y2 = other.fields.get("y");
    if (typeof x1 !== "number" || typeof y1 !== "number" || typeof x2 !== "number" || typeof y2 !== "number") {
      return api.error("Point fields x/y must be numbers");
    }
    return api.makeObject("Point", { x: x1 + x2, y: y1 + y2 }, { add: "point.add", norm: "point.norm" });
  }

  @turSafe
  static pointNorm(args: RuntimeValue[], api: ExtensionApi): RuntimeValue {
    if (args.length !== 1) return api.error("point.norm expects self");
    const [self] = args;
    if (!isPoint(self)) return api.error("point.norm expects Point");
    const x = self.fields.get("x");
    const y = self.fields.get("y");
    if (typeof x !== "number" || typeof y !== "number") return api.error("Point fields x/y must be numbers");
    return Math.sqrt(x * x + y * y);
  }
}

const extension: RuntimeExtension = {
  functions: {
    safe_div: MathGeoExtension.safeDiv,
    panic: MathGeoExtension.panic,
    make_point: MathGeoExtension.makePoint,
    "point.add": MathGeoExtension.pointAdd,
    "point.norm": MathGeoExtension.pointNorm,
  },
};

export default extension;
