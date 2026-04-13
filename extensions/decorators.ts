import type { ExtensionApi, RuntimeValue } from "../src/runtime";

type ExtFn = (args: RuntimeValue[], api: ExtensionApi) => RuntimeValue;

export function turSafe(
  _target: unknown,
  _propertyKey: string,
  descriptor: PropertyDescriptor
): void {
  const original = descriptor.value as ExtFn;
  descriptor.value = function wrapped(args: RuntimeValue[], api: ExtensionApi): RuntimeValue {
    try {
      return original.call(this, args, api);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return api.error(message);
    }
  };
}
