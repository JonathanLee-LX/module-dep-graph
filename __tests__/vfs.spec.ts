import { createModuleGraphFromEntry } from "..";
import { defineConfig, Config } from "../config";
import { VirtualFileTree, createVirtualFsPlugin } from "../plugins/virtualFs";

describe("create by virtual fs", () => {
  let baseConfig: Config;

  beforeEach(() => {
    baseConfig = defineConfig();
  });

  it("simple js", async () => {
    const vFileTree: VirtualFileTree = {
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

    baseConfig.plugins.push(createVirtualFsPlugin(vFileTree));

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
    const vFileTree: VirtualFileTree = {
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

    baseConfig.plugins.push(createVirtualFsPlugin(vFileTree));

    const graph = await createModuleGraphFromEntry("foo", baseConfig);

    const foo = graph.get("foo");
    const bar = graph.get("bar");

    expect(foo?.deps.has(bar!)).toBe(true);
    expect(bar?.deps.has(foo!)).toBe(true);
  });
});
