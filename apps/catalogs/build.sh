#!/usr/bin/env bash

set -e

# Path to this plugin
GRPC_TOOLS_NODE=`which grpc_tools_node_protoc_plugin`

# Directory to write generated code to (.js and .d.ts files)
OUT_DIR="./generated"

# Clear then make the output directory
mkdir -p ${OUT_DIR}

grpc_tools_node_protoc \
    -I_proto \
    --js_out=import_style=commonjs,binary:${OUT_DIR} \
    --ts_out="${OUT_DIR}" \
    --grpc_out=${OUT_DIR} \
    --plugin=protoc-gen-grpc=${GRPC_TOOLS_NODE} \
    catalogs.proto
