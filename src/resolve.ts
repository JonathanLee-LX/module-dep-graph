import { Module } from "./Module";
import { Config } from "./config";

export function doResolve(
  id: string,
  config: Config,
  importer: Module | null
): string | undefined {
  const { plugins } = config;

  let resolvedId: string | undefined | null;

  // apply plugins resolve function.
  // run plugin resolve function, and return when resovledId valid
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i];
    if (typeof plugin.resolve === "function") {
      resolvedId = plugin.resolve(id as string, config, importer);
      if (resolvedId) return resolvedId;
    }
  }
  // cannot resovle id
  throw new Error("cannot resolve id, please add plugin.resolve function.");
}
