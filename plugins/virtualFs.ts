import { UserPlugin } from "../config";

export type VirtualFileTree = {
  [id: string]: {
    source: string;
  };
};

export function createVirtualFsPlugin(vFileTree: VirtualFileTree): UserPlugin {
  return {
    name: "vFs",
    resolve(id) {
      return id;
    },
    load(id) {
      const source = vFileTree[id].source;
      if (!source) throw new Error(`cannot find module ${id}.`);
      return source;
    },
  };
}
