#!/bin/sh

set -e

OUTDIR=$1
shift
TSCONFIG=$1
shift

node_modules/.bin/rimraf $OUTDIR
mkdir $OUTDIR
node_modules/.bin/tsc -p $TSCONFIG --outDir $OUTDIR $@
