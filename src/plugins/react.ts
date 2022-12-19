import { parseSync } from "@swc/core";
import { UserPlugin } from "../config";

export function createReactPlugin(): UserPlugin {
  return {
    name: "react",
    parse(id, code) {
      return parseSync(code, {
        jsx: true,
        syntax: "ecmascript",
      });
    },
  };
}
