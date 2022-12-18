import { createModule, Module, ModuleMap } from "./Module";
import { doParse } from "./parse";
import { doTransform } from "./transform";
import { doResolve } from "./resolve";
import { doLoad } from "./load";
import { addDep } from "./helpers";
import { Config } from "./config";

export async function createModuleGraphFromEntry(id: string, config: Config) {
  const moduleMap: ModuleMap = new Map<string, Module>();
  await traverseCreateModule(id, null, moduleMap, config);
  return moduleMap;
}

async function traverseCreateModule(
  id: string,
  importer: Module | null,
  moduleMap: ModuleMap,
  config: Config
) {
  const resolvedId = doResolve(id, config, importer) as string;

  const existedMod = moduleMap.get(resolvedId);
  if (existedMod && importer) {
    addDep(existedMod, importer);
    return;
  }

  const code = doLoad(resolvedId, config) as string;
  const transformedCode = doTransform(code);
  const ast = await doParse(resolvedId, transformedCode, config);
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
