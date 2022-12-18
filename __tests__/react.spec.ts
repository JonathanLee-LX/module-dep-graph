import { createModuleGraphFromEntry } from "..";
import { Config, defineConfig } from "../config";
import { createReactPlugin } from "../plugins/react";
import { VirtualFileTree, createVirtualFsPlugin } from "../plugins/virtualFs";

describe("simple react app", () => {
  let baseConfig: Config;

  beforeEach(() => {
    baseConfig = defineConfig({
      plugins: [],
    });
  });

  it("simple react project", async () => {
    const vFileTree: VirtualFileTree = {
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

    baseConfig.plugins.push(createVirtualFsPlugin(vFileTree));
    baseConfig.plugins.push(createReactPlugin());

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
});
