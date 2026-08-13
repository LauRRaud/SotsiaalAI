import { register } from "node:module"

register(new URL("./document-rag-live-loader.mjs", import.meta.url), import.meta.url)
