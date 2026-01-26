#!/bin/bash

set -e  # 发生错误时退出脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

run_tidy=false

# 判断是否运行 Tidy
for arg in "$@"; do
  case $arg in
    -t|--run-tidy)
      run_tidy=true
      shift # 移除已处理的参数
      ;;
  esac
done

# 打印带颜色的消息
print_info() {
  echo -e "${BLUE}[INFO] $1${NC}"
}

print_success() {
  echo -e "${GREEN}[SUCCESS] $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}[WARNING] $1${NC}"
}

print_error() {
  echo -e "${RED}[ERROR] $1${NC}"
}

# 确保在tests目录中运行
if [ ! -f "CMakeLists.txt" ]; then
  print_error "请在tests目录中运行此脚本"
  exit 1
fi

# 检测操作系统
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS_TYPE="macOS"
  if [[ $(uname -m) == 'arm64' ]]; then
    ARCH="arm64"
    HOMEBREW_PREFIX="/opt/homebrew"
  else
    ARCH="x86_64"
    HOMEBREW_PREFIX="/usr/local"
  fi
else
  OS_TYPE="Linux"
  ARCH=$(uname -m)
  HOMEBREW_PREFIX="/home/linuxbrew/.linuxbrew"
fi

print_info "检测到的系统: $OS_TYPE ($ARCH)"
print_info "Homebrew 路径: $HOMEBREW_PREFIX"

# 检查依赖
check_dependencies() {
  print_info "检查依赖..."

  # 检查 CMake
  if ! command -v cmake &> /dev/null; then
    print_error "未找到 CMake。请安装: brew install cmake"
    exit 1
  fi

  print_success "依赖检查通过"
}

# 清理旧的构建目录
cleanup_build() {
  if [ -d "build" ]; then
    print_info "清理旧的构建目录..."
    rm -rf build
  fi
}

# 创建构建目录
create_build_dir() {
  print_info "创建构建目录..."
  mkdir -p build
  cd build
}

# 配置 CMake
configure_cmake() {
  print_info "配置 CMake..."

  # CMake 选项
  local cmake_opts=(
    "-Wno-dev"
  )

  if [ "$run_tidy" = true ]; then
    cmake_opts+=("-DCMAKE_EXPORT_COMPILE_COMMANDS=ON")
  fi

  # 在 macOS 上设置 GTEST_ROOT
  if [[ "$OS_TYPE" == "macOS" ]]; then
    cmake_opts+=("-DGTEST_ROOT=$HOMEBREW_PREFIX")
    cmake_opts+=("-DCMAKE_PREFIX_PATH=$HOMEBREW_PREFIX")
  fi

  cmake_opts+=("-DCMAKE_BUILD_TYPE=Debug") # Release
  # 打印 CMake 命令
  print_info "运行: cmake ${cmake_opts[*]} .."

  # 运行 CMake
  cmake "${cmake_opts[@]}" ..

  if [ $? -eq 0 ]; then
    if [ "$run_tidy" = true ]; then
      run-clang-tidy -p ./ > tidy.txt
    fi
  fi
}

# 构建项目
build_project() {
  print_info "构建项目..."

  # 确定 CPU 核心数
  if [[ "$OS_TYPE" == "macOS" ]]; then
    CPUS=$(sysctl -n hw.ncpu)
  else
    CPUS=$(nproc)
  fi

  print_info "使用 $CPUS 个核心进行构建"

  # 构建
  cmake --build . -- -j$CPUS
}

# 运行测试
run_tests() {
  print_info "运行测试..."
  CTEST_OUTPUT_ON_FAILURE=1 ctest
}

# 查看链接库
show_linkage() {
  print_info "检查链接库..."

  # 在 macOS 上使用 otool
  if [[ "$OS_TYPE" == "macOS" ]]; then
    if [ -f "url_test" ]; then
      print_info "url_test 链接的库:"
      otool -L url_test | grep -v "url_test:" | sed 's/^[[:space:]]*/\t/'
    fi
  # 在 Linux 上使用 ldd
  else
    if [ -f "url_test" ]; then
      print_info "url_test 链接的库:"
      ldd url_test | sed 's/^/\t/'
    fi
  fi
}

# 添加安装依赖的函数
install_dependencies_macos() {
  print_info "安装 macOS 依赖..."

  # 确保 Homebrew 已安装
  if ! command -v brew &> /dev/null; then
    print_error "未找到 Homebrew。请先安装 Homebrew: https://brew.sh/"
    exit 1
  fi

  # 安装依赖
  brew install cmake folly googletest glog gflags double-conversion fmt libevent boost

  print_success "依赖安装完成"
}

# 主函数
main() {
  # 处理命令行参数
  if [ "$1" == "--install-deps" ]; then
    if [[ "$OS_TYPE" == "macOS" ]]; then
      install_dependencies_macos
    else
      print_error "自动安装依赖仅支持 macOS。请手动安装依赖。"
      exit 1
    fi
  fi

  # 检查依赖
  check_dependencies

  # 清理和创建构建目录
  cleanup_build
  create_build_dir

  # 配置和构建
  configure_cmake
  build_project

  # 检查链接库
  show_linkage

  # 运行测试
  run_tests

  cd ..
  print_success "构建完成。"
}

# 运行主函数
main "$@"
