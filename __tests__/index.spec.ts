import { Module, parseSync } from "@swc/core";
import { compileScript, parse as vueParse } from "@vue/compiler-sfc";
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

const VUE_PROJECT = {
  ["App.vue"]: {
    source: `
        <template>
          <Helloworld></Helloworld>
          <span>{{count}}</span>
        </template>
        <script>
          export default {
            name: 'App',
          }
        </script>
        <script setup>
          import { ref } from 'vue'
          import Helloworld from 'Helloworld.vue'
          const count = ref(0)
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
      `,
  },
  ["vue"]: {
    source: `
        export function createApp() {}
      `,
  },
};

it("simple vue project", async () => {
  // add vue plugin
  baseConfig.plugins.push({
    parse(id, code): Module | null {
      if (!id.endsWith(".vue")) return null;

      const { descriptor, errors } = vueParse(code);

      // print error if has
      errors.forEach((error) => console.error(error.message));

      // for <script> tag not exist.
      if (!descriptor.script && !descriptor.scriptSetup) {
        return parseSync("export default {}");
      }

      const { content } = compileScript(descriptor, {
        id: Math.random().toString(),
      });
      return parseSync(content);
    },
  });

  moduleMap = VUE_PROJECT;

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
  expect(vue?.deps.has(helloworld!)).toBe(false);

  const notExist = graph.get("not-exist");
  expect(notExist).toBeUndefined();
});

it("simple react project", async () => {
  moduleMap = {
    "index.js": {
      source: `
        import React from 'react'
        import { render } from 'react-dom'
        import App from 'App.js'

        render('<App />', '#app')
      `,
    },
    "App.js": {
      source: `
        import React, { useState } from 'react'
        import HelloWorld from 'HelloWorld'

        export default function App() {
          const [count, setCount] = useState(0)
          return (
            <>
              <HelloWorld></HelloWorld>
              <span>{count}</span>
              <button onClick={() => setCount(count + 1)}>inc</button>
            </>
          )
        }
      `,
    },
    HelloWorld: {
      source: `
        import React from 'react'

        export default function HelloWorld() {
          return (
            <p>
              HelloWorld
            </p>
          )
        }
      `,
    },
    react: {
      source: `
        const React = {}

        export default React

        export const useState = (val) => {
          let _val = val
          return [_val, (newVal) => _val = newVal]
        }
      `,
    },
    ["react-dom"]: {
      source: `
        export const render = (jsx, el) => {}
      `,
    },
  };

  baseConfig.plugins.push({
    parse(id, code) {
      return parseSync(code, {
        jsx: true,
        syntax: "ecmascript",
      });
    },
  });

  const graph = await createModuleGraphFromEntry("index.js", baseConfig);

  const app = graph.get("App.js");
  const index = graph.get("index.js");
  const hello = graph.get("HelloWorld");
  const reactDom = graph.get("react-dom");
  const react = graph.get("react");

  expect(graph.size).toBeGreaterThan(0);
  expect(hello?.deps.has(app!)).toBeTruthy();
  expect(reactDom?.deps.has(index!)).toBeTruthy();
  expect(react?.deps.has(hello!)).toBeTruthy();
  expect(react?.deps.has(app!)).toBeTruthy();
});
