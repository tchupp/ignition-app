const fs = require("fs");

function wasm2js(wasmBuffer) {
    const wasm = wasmBuffer.toString("base64");
    
    return `
function toUint8Array (s) {
    return (require('buffer').Buffer).from(s, 'base64')
}
    
const bytes = toUint8Array('${wasm}');
let imports = {};
imports['./ignition_core_wasm'] = require('./ignition_core_wasm');

const wasmModule = new WebAssembly.Module(bytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
module.exports = wasmInstance.exports;
    `;
}

const wasmBuffer = fs.readFileSync("crate/pkg/ignition_core_wasm_bg.wasm");
const src = wasm2js(wasmBuffer);
fs.writeFileSync("crate/pkg/ignition_core_wasm_bg.js", src);
