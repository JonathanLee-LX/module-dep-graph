import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createModuleGraphFromEntry } from "..";
import { defineConfig } from "../config";
import { doLoad } from "../load";
import { createFsPlugin } from "../plugins/fs";
import { doResolve } from "../resolve";

describe("create by fs", () => {
  const config = defineConfig({
    plugins: [
      createFsPlugin({
        base: resolve(__dirname, "../fixtures"),
      }),
    ],
  });

  it("createModuleGraph", async () => {
    const graph = await createModuleGraphFromEntry("./foo.ts", config);
    expect(graph.size).toBeGreaterThan(0);
  });

  it("doResolve", async () => {
    const foo = doResolve("./foo.ts", config, null);
    expect(foo).toBe(resolve(process.cwd(), "./fixtures/foo.ts"));
  });

  it("doLoad", async () => {
    const code = doLoad(doResolve("./foo.ts", config, null) as string, config);
    expect(code).toBe(
      readFileSync(resolve(process.cwd(), "./fixtures/foo.ts"), "utf-8")
    );
  });
});
