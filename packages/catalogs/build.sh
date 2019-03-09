#!/usr/bin/env bash

set -e

wasm-pack --verbose build crate --target nodejs --mode no-install
mv crate/pkg/ignition_catalogs_wasm_bg.js crate/pkg/ignition_catalogs_wasm_bg.bak.js
node ./wasm-bindgen.shim.js
