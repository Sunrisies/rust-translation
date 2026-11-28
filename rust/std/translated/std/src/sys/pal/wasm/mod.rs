//! Wasm/web 平台的系统绑定
//!
//! 此模块包含针对特定平台的抽象层实现，用于
//! Wasm 的操作系统级功能。请注意，这不是 emscripten 或 wasi wasm 的版本，因此没有运行时支持。
//! 所以这里没有运行时机制。
//!
//! 这一切都极其实验性，目前并不适用于
//! 广泛/生产环境使用，仍然属于实验阶段。这一情况
//! 可能会随时间变化。
//!
//! 目前这里的所有函数基本上都是立即返回错误的占位函数。希望通过可移植性检查工具，能够真正
//! 移除这些函数，如果在为 Wasm 编译时，只需省略标准库的部分内容。这样就能将原本必然是运行时错误的错误转化为编译时错误！
//! remove all this and just omit parts of the standard library if we're
//! compiling for wasm. That way it's a compile time error for something that's
//! guaranteed to be a runtime error!

#![deny(unsafe_op_in_unsafe_fn)]

#[path = "../unsupported/common.rs"]
#[deny(unsafe_op_in_unsafe_fn)]
mod common;
pub use common::*;
