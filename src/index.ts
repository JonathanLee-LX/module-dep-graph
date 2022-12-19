import { createModule, Module, ModuleMap } from "./Module";
import { doParse } from "./parse";
import { doTransform } from "./transform";
import { doResolve } from "./resolve";
import { doLoad } from "./load";
import { addDep } from "./helpers";
import { Config } from "./config";

export { defineConfig } from "./config";
export type { Config } from "./config";

export type { Module, ModuleMap } from "./Module";

export async function createModuleGraphFromEntry(id: string, config: Config) {
  const moduleMap: ModuleMap = new Map<string, Module>();
  await traverseCreateModule(id, null, moduleMap, config);
  return moduleMap;
}

export const create = createModuleGraphFromEntry;

async function traverseCreateModule(
  id: string,
  importer: Module | null,
  moduleMap: ModuleMap,
  config: Config
) {
  const resolvedId = doResolve(id, config, importer) as string;
  if (!resolvedId) {
    return;
  }

  const existedMod = moduleMap.get(resolvedId);
  if (existedMod && importer) {
    addDep(existedMod, importer);
    return;
  }

  let code: string | null | undefined = null;
  try {
    code = doLoad(resolvedId, config);
  } catch (error) {
    // log error
    // console.error(error);
  }

  if (!code) {
    return;
  }

  const transformedCode = doTransform(code);
  let ast: any;
  try {
    ast = await doParse(resolvedId, transformedCode, config);
    if (!ast) return;
  } catch (error) {
    debugger;
  }

  const mod = createModule(code, ast, resolvedId);

  moduleMap.set(resolvedId, mod);

  if (mod && importer) {
    addDep(mod, importer);
  }

  for (let i = 0; i < mod.ast.body.length; i++) {
    const bodyItem = mod.ast.body[i];
    if (
      bodyItem.type === "ImportDeclaration" ||
      bodyItem.type === "ExportNamedDeclaration"
    ) {
      const importItemId = bodyItem.source?.value;
      if (!importItemId) continue;
      await traverseCreateModule(importItemId, mod, moduleMap, config);
    }
  }
}
