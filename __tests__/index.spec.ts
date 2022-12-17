import { Module, parseSync } from "@swc/core";
import { parse as vueParse } from "@vue/compiler-sfc";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Config,
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

let baseConfig: Config;

let moduleMap: { [id: string]: { source: string } } = {};

beforeEach(() => {
  baseConfig = defineConfig({
    base: ".",
    alias: {},
    extensions: [],
    plugins: [
      {
        resolve(id, config) {
          return id;
        },
        load(id, code, config) {
          try {
            const source = moduleMap[id].source;
            return source;
          } catch (error) {
            //
            return "";
          }
        },
      },
    ],
  });
});

it("simple js", async () => {
  moduleMap = {
    foo: {
      source: `
      import bar from 'bar'
      import { baz } from 'baz'
      console.log("bar: " + bar)
      console.log("baz: " + baz)
    `,
    },
    bar: {
      source: `
      export const bar = 'bar'
    `,
    },
    baz: {
      source: `
      import bar from 'bar'
      export function baz() {
      }
    `,
    },
  };

  const graph = await createModuleGraphFromEntry("foo", baseConfig);

  const fooMod = graph.get("foo");
  const barMod = graph.get("bar");
  const bazMod = graph.get("baz");
  expect(fooMod?.deps.size).toBe(0);
  expect(barMod?.deps.size).toBe(2);
  expect(barMod?.deps.has(fooMod!)).toBe(true);
  expect(barMod?.deps.has(bazMod!)).toBe(true);
});

it("loop import", async () => {
  moduleMap = {
    foo: {
      source: `
        import { bar } from 'bar'
        export const foo = 'foo'
      `,
    },
    bar: {
      source: `
        import { foo } from 'foo'
        export const bar = 'bar'
      `,
    },
  };

  const graph = await createModuleGraphFromEntry("foo", baseConfig);

  const foo = graph.get("foo");
  const bar = graph.get("bar");

  expect(foo?.deps.has(bar!)).toBe(true);
  expect(bar?.deps.has(foo!)).toBe(true);
});

it("simple vue project", async () => {
  // add vue plugin
  baseConfig.plugins.push({
    parse(id, code): Module | null {
      if (!id.endsWith(".vue")) return null;

      const {
        descriptor: { script, scriptSetup, styles, template },
        errors,
      } = vueParse(code);

      let ast: Module | null = null;

      if (script?.content) {
        ast = parseSync(script?.content);
      }

      if (scriptSetup?.content) {
        const scriptSetupAST = parseSync(scriptSetup.content);

        if (ast && ast.body) {
          ast.body.push(...scriptSetupAST.body);
        } else {
          ast = scriptSetupAST;
        }
      }

      if (ast === null) {
        //  for only template code vue component
        ast = parseSync("export default {}");
      }

      return ast;
    },
  });

  moduleMap = {
    ["App.vue"]: {
      source: `
        <template>
          <Helloworld></Helloworld>
          <span>{{count}}</span>
        </template>
        <script>
          import { ref } from 'vue'
          import Helloworld from 'Helloworld.vue'

          export default {
            name: 'App',
            setup() {
              const count = ref(0)
            }
          }
        </script>
      `,
    },
    ["main.js"]: {
      source: `
        import App from 'App.vue'
        import { createApp } from 'vue'

        createApp(App).mount('#app')
        console.log(router)
      `,
    },
    ["Helloworld.vue"]: {
      source: `
        <template>
          <span>hello-world</span>
        </template>
        <script>
          import { ref } from 'vue'
        </script>
      `,
    },
    ["vue"]: {
      source: `
        export function createApp() {}
      `,
    },
  };

  const graph = await createModuleGraphFromEntry("main.js", baseConfig);

  expect(graph).toBeDefined();

  const main = graph.get("main.js");
  const app = graph.get("App.vue");
  const helloworld = graph.get("Helloworld.vue");
  const vue = graph.get("vue");

  expect(main?.deps.size).toBe(0);
  expect(app?.deps.has(main!)).toBe(true);
  expect(helloworld?.deps.has(app!)).toBe(true);
  expect(vue?.deps.has(main!)).toBe(true);
  expect(vue?.deps.has(app!)).toBe(true);

  const notExist = graph.get("not-exist");
  expect(notExist).toBeUndefined();
});
