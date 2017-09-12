#!/bin/sh

rm -rf dist es5 test

node_modules/.bin/tsc -p . -t esnext --outDir dist
node_modules/.bin/tsc -p . -t es5 --outDir es5

cp -r test.in test
node_modules/.bin/tsc -p ./tsconfig-test.json
