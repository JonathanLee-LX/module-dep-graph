import { Config } from "./config";

export function doLoad(id: string, config: Config): string | undefined | null {
  const { plugins } = config;
  let code: string | null = null;

  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i];

    if (typeof plugin.load === "function") {
      code = plugin.load(id, config);
      if (code === null) {
        continue;
      }
      return code;
    }
  }

  if (!code) {
    throw new Error(`cannot load module ${id} source.`);
  }
}
