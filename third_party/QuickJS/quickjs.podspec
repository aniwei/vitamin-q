# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

source = { :git => "https://github.com/facebook/react-native.git" }
source[:commit] = `git rev-parse HEAD`.strip if system("git rev-parse --git-dir > /dev/null 2>&1")

Pod::Spec.new do |s|
  s.name                   = "QuickJS"
  s.version                = "2024.01.13"
  s.summary                = "Hermes engine for React Native"
  s.homepage               = "https://reactnative.dev/"
  s.license                = ""
  s.author                 = "Meta Platforms, Inc. and its affiliates"
  s.platforms              = { :ios => "12.2" }
  s.source                 = source
  s.source_files           = "{src,include}/**/*.{cpp,c,h}"
  s.public_header_files    = "include/**/*.h"
  s.header_mappings_dir    = "include"

  quickjs_version = '\\"2025-04-26\\"'
  common_flags = "-DQUICKJS_VERSION=#{quickjs_version} -DENABLE_MI_MALLOC=OFF -DMI_OVERRIDE=OFF -DMI_BUILD_SHARED=OFF -DMI_BUILD_OBJECT=OFF -DMI_BUILD_TESTS=OFF"

  s.pod_target_xcconfig = {
    "USE_HEADERMAP" => "NO",
    "OTHER_CFLAGS[config=Debug]" => "#{common_flags} -DDUMP_LEAKS",
    "OTHER_CFLAGS[config=Release]" => common_flags,
    "OTHER_CFLAGS[config=Dev]" => "#{common_flags} -DDUMP_LEAKS",
    'GCC_PREPROCESSOR_DEFINITIONS[config=Debug]' => '$(inherited) TARO_DEV=1',
    'GCC_PREPROCESSOR_DEFINITIONS[config=Dev]' => '$(inherited) TARO_DEV=1',
    'GCC_PREPROCESSOR_DEFINITIONS[config=Release]' => '$(inherited) NDEBUG=1 NS_BLOCK_ASSERTIONS=1',
  }
#  s.dependency "mimalloc"
  s.dependency "curl"
end
