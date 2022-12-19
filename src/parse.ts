import { Module, parseSync } from "@swc/core";
import { Config } from "./config";

export async function doParse(
  id: string,
  code: string,
  config: Config
): Promise<Module | null> {
  let ast: Module | null = null;

  for (let i = 0; i < config.plugins.length; i++) {
    const plugin = config.plugins[i];
    if (typeof plugin.parse === "function") {
      try {
        ast = plugin.parse(id, code);
        if (ast) {
          // break;
          return ast;
        }
      } catch (error) {
        console.error("parse id " + id + " failed");
        // throw error;
        return null;
      }
    }
  }

  const isTS = id.endsWith(".ts");
  const isTSX = id.endsWith(".tsx");
  const isJSX = id.endsWith(".jsx");

  try {
    ast =
      ast === null
        ? parseSync(code, {
            syntax: isTS ? "typescript" : "ecmascript",
            decorators: true,
            dynamicImport: true,
            tsx: isTSX,
            jsx: isJSX,
          })
        : ast;
    return ast;
  } catch (error) {
    console.error("parse id " + id + " failed");
    // throw error;
    return null;
  }
}
