#!/bin/sh
set -eu
npm run build
cp src/art.json dist/artworks.json
mkdir -p build
./node_modules/.bin/ares-package dist -o build
