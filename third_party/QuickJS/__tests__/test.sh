#!/bin/bash

set -x

if [ ! -d bin ]; then
./build.sh
fi

if [ ! -d test262 ]; then
git clone git@github.com:tc39/test262.git test262 --depth 1
cd test262
patch -p1 < ../test262.patch
cd ..
fi

touch test262_errors.txt
./bin/run-test262 -m -c test262.conf -a -t -e test262_errors.txt
