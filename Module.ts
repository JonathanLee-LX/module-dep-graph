import type { Module as AST } from "@swc/core";

export class Module {
  public deps: Set<Module>;

  constructor(public path: string, public code: string, public ast: AST) {
    this.deps = new Set();
  }
}

export function createModule(code: string, ast: AST, id: string): Module {
  return new Module(id, code, ast);
}

export type ModuleMap = Map<string, Module>;
