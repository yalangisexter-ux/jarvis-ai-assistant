import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const candidates = [
  resolve('node_modules/onnxruntime-web/dist'),
  resolve('node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist'),
]
const source = candidates.find((path) => existsSync(path))
if (!source) {
  throw new Error('onnxruntime-web/dist was not found; cannot prepare fully local WASM runtime assets.')
}

const destination = resolve('public/wasm')
mkdirSync(destination, { recursive: true })
const assets = readdirSync(source).filter((name) => /^ort-.*\.(wasm|mjs|js)$/.test(name))
if (!assets.some((name) => name.endsWith('.wasm'))) {
  throw new Error('No ONNX Runtime WASM binaries were found.')
}
for (const asset of assets) {
  cpSync(resolve(source, asset), resolve(destination, asset))
}
console.log(`Prepared ${assets.length} local ONNX Runtime assets in public/wasm.`)
