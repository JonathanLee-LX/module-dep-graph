import {
  init,
  parse as _parse,
  ImportSpecifier,
  ExportSpecifier,
} from "es-module-lexer";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

class Module {
  public deps: Set<Module>;

  constructor(
    public imports: readonly ImportSpecifier[],
    public exports: readonly ExportSpecifier[],
    public path: string
  ) {
    this.deps = new Set();
  }
}

function ensureExist(id) {
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

  const isBare = isBareImport(id, config);
  if (isBare) return "@fs/" + id;

  // foo.svg?inline -> foo.svg
  id = id.replace(/\?[a-zA-Z]+/, "");

  const matched = Object.entries(config.alias).find(
    ([k]) => k.split("/")[0] === k
  );

  if (matched) {
    id = id.replace(matched[0], matched[1]);
  }

  let resolvedId: string = id;

  //   apply plugins resolve function.
  resolvedId = plugins
    .map((plugin) => plugin.resolve)
    .filter((resolve) => typeof resolve === "function")
    .reduce((lastId: string, resolve) => {
      const newId = resolve!(lastId, config);
      return newId ? newId : lastId;
    }, resolvedId);

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
  const code = readFileSync(id, "utf-8");
  return plugins
    .map((plugin) => plugin.load)
    .filter((load) => typeof load === "function")
    .reduce((lastCode, load) => {
      const newCode = load!(id, lastCode, config);
      return newCode ? newCode : lastCode;
    }, code);
}

type ModuleMap = Map<string, Module>;

interface UserPlugin {
  resolve?(id: string, config: Config): string | null;
  load?(id: string, code: string, config: Config): string | null;
}

interface Config {
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
  await init;

  const existedMod = moduleMap.get(id);
  if (existedMod && importer) {
    addDep(existedMod, importer);
    return;
  }

  const resolvedId = doResolve(id, config, importer);
  const code = doLoad(resolvedId, config);
  const mod = createModule(code, resolvedId);

  if (importer) {
    addDep(mod, importer);
  }

  moduleMap.set(resolvedId, mod);

  for (let i = 0; i < mod.imports.length; i++) {
    const importItem = mod.imports[i];
    const importItemId = importItem.n;
    if (!importItemId) continue;
    traverseCreateModule(importItemId, mod, moduleMap, config);
  }
}

function createModule(code: string, id: string): Module {
  const [imports, exports] = _parse(code);
  return new Module(imports, exports, id);
}
