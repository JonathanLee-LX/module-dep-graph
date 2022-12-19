import { existsSync } from "node:fs";
import { Config } from "./config";
import { Module } from "./Module";

export function ensureExist(id: string) {
  const exist = existsSync(id);
  if (!exist) throw new Error("do not existed");
}

export function addDep(mod: Module, importer: Module) {
  mod.deps.add(importer);
}

export function deepMerge(origin: any, source: any) {
  return Object.assign(origin, source);
}
