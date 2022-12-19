import { createModuleGraphFromEntry } from "..";
import { defineConfig, Config } from "../src/config";
import {
  VirtualFileTree,
  createVirtualFsPlugin,
} from "../src/plugins/virtualFs";
import { createVuePlugin } from "../src/plugins/vue";

describe("vue project", () => {
  let baseConfig: Config;

  beforeEach(() => {
    baseConfig = defineConfig();
  });

  it("simple vue project", async () => {
    const VUE_PROJECT: VirtualFileTree = {
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

    baseConfig.plugins.push(createVirtualFsPlugin(VUE_PROJECT));

    // add vue plugin
    baseConfig.plugins.push(createVuePlugin());

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
});
