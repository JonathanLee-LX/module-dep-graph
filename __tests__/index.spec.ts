import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createModuleGraphFromEntry,
  defineConfig,
  doLoad,
  doResolve,
} from "..";

const config = defineConfig({
  base: resolve(__dirname, "../fixtures"),
});

it("createModuleGraph", async () => {
  const graph = await createModuleGraphFromEntry("./foo.ts", config);
  expect(graph.size).toBeGreaterThan(0);
  expect(graph).toMatchSnapshot();
});

it("doResolve", async () => {
  const foo = doResolve("./foo.ts", config, null);
  expect(foo).toBe(resolve(process.cwd(), "./fixtures/foo.ts"));
});

it("doLoad", async () => {
  const code = doLoad(doResolve("./foo.ts", config, null), config);
  expect(code).toBe(
    readFileSync(resolve(process.cwd(), "./fixtures/foo.ts"), "utf-8")
  );
});
