#!/bin/bash

set -x

if [ ! -d bin ]; then
  ./build.sh
fi

./bin/qjs ./octane/run.js

# echo "开始验证可执行文件..."
# ./bin/qjsc -v -o ./octane.bin ./octane/run.js
# ./octane.bin
