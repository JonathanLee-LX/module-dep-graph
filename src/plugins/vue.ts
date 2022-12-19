import { Module, parseSync } from "@swc/core";
import { compileScript, parse as vueParse } from "@vue/compiler-sfc";
import { UserPlugin } from "../config";

export function createVuePlugin(): UserPlugin {
  return {
    name: "vue",
    parse(id: string, code: string): Module | null {
      if (!id.endsWith(".vue")) return null;

      const { descriptor, errors } = vueParse(code);

      // print error if has
      errors.forEach((error) => console.error(error.message));

      // for <script> tag not exist.
      if (!descriptor.script && !descriptor.scriptSetup) {
        return parseSync("export default {}");
      }

      const { content } = compileScript(descriptor, {
        id: id,
      });
      return parseSync(content);
    },
  };
}
