import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Config, UserPlugin } from "../config";
import { ensureExist } from "../helpers";
import { Module } from "../Module";

export interface FsPluginOptions {
  /**
   *
   * default: '.'
   */
  base?: string;
  /**
   * default: {}
   */
  alias?: Record<string, string>;
  /**
   * default: [".js", ".ts", ".jsx", ".tsx"]
   */
  extensions?: string[];
}

export function createFsPlugin(options: FsPluginOptions): UserPlugin {
  const {
    base = ".",
    extensions = [".js", ".ts", ".jsx", ".tsx"],
    alias = {},
  } = options;

  function isBareImport(moduleName: string) {
    const { alias = {} } = options;

    return (
      /^@?[a-zA-Z]+/.test(moduleName) &&
      Object.keys(alias).every((k) => k !== moduleName.split("/")[0])
    );
  }

  return {
    name: "fs",
    load(id: string) {
      if (id.startsWith("@fs")) return null;
      const code = readFileSync(id, "utf-8");
      return code;
    },
    resolve(id: string, config: Config, importer: Module | null) {
      const isBare = isBareImport(id);
      if (isBare) return "@fs/" + id;

      let resolvedId: string;

      const matched = Object.entries(alias).find(
        ([k]) => k.split("/")[0] === k
      );

      if (matched) {
        id = id.replace(matched[0], matched[1]);
      }

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
    },
  };
}
