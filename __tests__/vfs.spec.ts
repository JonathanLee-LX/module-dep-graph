import { createModuleGraphFromEntry } from "..";
import { defineConfig, Config } from "../src/config";
import {
  VirtualFileTree,
  createVirtualFsPlugin,
} from "../src/plugins/virtualFs";

describe("create by virtual fs", () => {
  let baseConfig: Config;

  beforeEach(() => {
    baseConfig = defineConfig();
  });

  it("simple js", async () => {
    const vFileTree: VirtualFileTree = {
      ["foo.js"]: {
        source: `
      import bar from 'bar.js'
      import { baz } from 'baz.js'
      console.log("bar: " + bar)
      console.log("baz: " + baz)
    `,
      },
      ["bar.js"]: {
        source: `
      export const bar = 'bar'
    `,
      },
      ["baz.js"]: {
        source: `
      import bar from 'bar.js'
      export function baz() {
      }
    `,
      },
    };

    baseConfig.plugins.push(createVirtualFsPlugin(vFileTree));

    const graph = await createModuleGraphFromEntry("foo.js", baseConfig);

    const fooMod = graph.get("foo.js");
    const barMod = graph.get("bar.js");
    const bazMod = graph.get("baz.js");
    expect(fooMod?.deps.size).toBe(0);
    expect(barMod?.deps.size).toBe(2);
    expect(barMod?.deps.has(fooMod!)).toBe(true);
    expect(barMod?.deps.has(bazMod!)).toBe(true);
  });

  it("loop import", async () => {
    const vFileTree: VirtualFileTree = {
      ["foo.js"]: {
        source: `
        import { bar } from 'bar.js'
        export const foo = 'foo'
      `,
      },
      ["bar.js"]: {
        source: `
        import { foo } from 'foo.js'
        export const bar = 'bar'
      `,
      },
    };

    baseConfig.plugins.push(createVirtualFsPlugin(vFileTree));

    const graph = await createModuleGraphFromEntry("foo.js", baseConfig);

    const foo = graph.get("foo.js");
    const bar = graph.get("bar.js");

    expect(foo?.deps.has(bar!)).toBe(true);
    expect(bar?.deps.has(foo!)).toBe(true);
  });
});
