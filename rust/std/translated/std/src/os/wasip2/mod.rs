//! Platform-specific extensions to `std` for Preview 2 of the WebAssembly System Interface (WASI).
//!
//! 当前该模块为空，但随着 wasi-libc 对 WASI 预览版 2 的支持稳定化，后续会逐步填充内容。

#![forbid(unsafe_op_in_unsafe_fn)]
#![unstable(feature = "wasip2", issue = "none")]
#![doc(cfg(all(target_os = "wasi", target_env = "p2")))]
