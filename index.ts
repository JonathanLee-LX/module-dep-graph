import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createModule, Module } from "./Module";
import { doParse } from "./parse";
import { doTransform } from "./transform";
import type { Module as SWCModule } from "@swc/core";

function ensureExist(id: string) {
  const exist = existsSync(id);
  if (!exist) throw new Error("do not existed");
}

function isBareImport(moduleName: string, config: Config) {
  return (
    /^@?[a-zA-Z]+/.test(moduleName) &&
    Object.keys(config.alias).every((k) => k !== moduleName.split("/")[0])
  );
}

export function doResolve(
  id: string,
  config: Config,
  importer: Module | null
): string {
  const { base, extensions, plugins } = config;

  let resolvedId: string | undefined | null;

  // apply plugins resolve function.
  // run plugin resolve function, and return when resovledId valid
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i];
    if (typeof plugin.resolve === "function") {
      resolvedId = plugin.resolve(id as string, config);
      if (resolvedId) return resolvedId;
    }
  }

  const matched = Object.entries(config.alias).find(
    ([k]) => k.split("/")[0] === k
  );

  if (matched) {
    id = id.replace(matched[0], matched[1]);
  }

  const isBare = isBareImport(id, config);
  if (isBare) return "@fs/" + id;

  // foo.svg?inline -> foo.svg
  id = id.replace(/\?[a-zA-Z]+/, "");

  if (id.startsWith("/")) {
    // relative from __dirname
    resolvedId = resolve(base, "." + id);
  } else if (id.startsWith(".")) {
    resolvedId = resolve(importer ? dirname(importer.path) : base, id);
  } else {
    throw new Error(`invalid id ${id}`);
  }

  try {
    const stats = statSync(resolvedId);
    if (stats.isDirectory()) {
      resolvedId = resolve(resolvedId, "./index");
    }
  } catch (error) {
    //
  }

  // relative from entry base

  let exist: boolean = existsSync(resolvedId);

  if (!exist) {
    let i = 0;
    while (i < extensions.length) {
      const ext = extensions[i];
      const guessedFilePath = resolvedId + ext;
      exist = existsSync(guessedFilePath);
      if (exist) {
        resolvedId = guessedFilePath;
        break;
      }
      i++;
    }
  }

  if (!exist)
    throw new Error(`cannot find module ${resolvedId} from file system.`);

  ensureExist(resolvedId);

  return resolvedId;
}

export function doLoad(id: string, config: Config): string {
  const { plugins } = config;

  const code = plugins
    .map((plugin) => plugin.load)
    .filter((load) => typeof load === "function")
    .reduce((lastCode, load) => {
      const newCode = load!(id, lastCode, config);
      return newCode ? newCode : lastCode;
    }, "");

  function fsLoad(id: string, lastCode: string) {
    if (lastCode) return lastCode;
    const code = readFileSync(id, "utf-8");
    return code;
  }

  return fsLoad(id, code);
}

type ModuleMap = Map<string, Module>;

interface UserPlugin {
  parse?(id: string, code: string): SWCModule | null;
  resolve?(id: string, config: Config): string | null;
  load?(id: string, code: string, config: Config): string | null;
}

export interface Config {
  base: string;
  alias: Record<string, string>;
  extensions: string[];
  plugins: UserPlugin[];
}

type UserConfig = Partial<Config>;

function deepMerge(origin: any, source: any) {
  return Object.assign(origin, source);
}

export function defineConfig(userConfig: UserConfig): Config {
  const defaultConfig: Config = {
    base: process.cwd(),
    alias: {},
    extensions: [".ts", ".js"],
    plugins: [],
  };
  return deepMerge(defaultConfig, userConfig) as Config;
}

export async function createModuleGraphFromEntry(id: string, config: Config) {
  const moduleMap: ModuleMap = new Map<string, Module>();
  await traverseCreateModule(id, null, moduleMap, config);
  return moduleMap;
}

function addDep(mod: Module, importer: Module) {
  mod.deps.add(importer);
}

async function traverseCreateModule(
  id: string,
  importer: Module | null,
  moduleMap: ModuleMap,
  config: Config
) {
  const resolvedId = doResolve(id, config, importer);

  const existedMod = moduleMap.get(resolvedId);
  if (existedMod && importer) {
    addDep(existedMod, importer);
    return;
  }

  const code = doLoad(resolvedId, config);
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
