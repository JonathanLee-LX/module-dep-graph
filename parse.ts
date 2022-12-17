import { Module, parseSync } from "@swc/core";
import { Config } from ".";

export async function doParse(
  id: string,
  code: string,
  config: Config
): Promise<Module> {
  let ast: Module | null = null;

  for (let i = 0; i < config.plugins.length; i++) {
    const plugin = config.plugins[i];
    if (typeof plugin.parse === "function") {
      ast = plugin.parse(id, code);
      if (ast) {
        break;
      }
    }
  }

  return ast === null ? parseSync(code) : ast;
}
