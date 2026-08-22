import { register } from "node:module";

register(new URL("./node-source-loader.mjs", import.meta.url), import.meta.url);
