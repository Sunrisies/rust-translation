//! This module contains a canonical definition of the `cabi_realloc` function
//! 用于组件模型。
//!
//! 组件模型用于表示内存中数据类型的标准 ABI 就利用了此函数，例如在处理列表和字符串时。
//! makes use of this function when transferring lists and strings, for example.
//! This function behaves like C's `realloc` but also takes alignment into
//! 关于标准 ABI 的更多信息可参阅...
//!
//! 请注意，此函数的名称在当前的标准 ABI 中并未标准化，而是“组件化过程”的一种约定，
//! 当核心 WASM 模块被转换为组件时便使用此名称。
//! 此外，这不是此函数唯一的定义方式，因此它被定义为“弱”符号。这意味着如果存在其他定义，它们可以覆盖它。
//!
//! More information about the canonical ABI can be found at
//! <https://github.com/WebAssembly/component-model/blob/main/design/mvp/CanonicalABI.md>
//!
//! Note that the name of this function is not standardized in the canonical ABI
//! at this time. Instead it's a convention of the "componentization process"
//! where a core wasm module is converted to a component to use this name.
//! Additionally this is not the only possible definition of this function, so
//! this is defined as a "weak" symbol. This means that other definitions are
//! allowed to overwrite it if they are present in a compilation.

use crate::alloc::{self, Layout};
use crate::ptr;

#[used]
static FORCE_CODEGEN_OF_CABI_REALLOC: unsafe extern "C" fn(
    *mut u8,
    usize,
    usize,
    usize,
) -> *mut u8 = cabi_realloc;

#[linkage = "weak"]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn cabi_realloc(
    old_ptr: *mut u8,
    old_len: usize,
    align: usize,
    new_len: usize,
) -> *mut u8 {
    let layout;
    let ptr = if old_len == 0 {
        if new_len == 0 {
            return ptr::without_provenance_mut(align);
        }
        layout = Layout::from_size_align_unchecked(new_len, align);
        alloc::alloc(layout)
    } else {
        debug_assert_ne!(new_len, 0, "non-zero old_len requires non-zero new_len!");
        layout = Layout::from_size_align_unchecked(old_len, align);
        alloc::realloc(old_ptr, layout, new_len)
    };
    if ptr.is_null() {
        // Print a nice message in debug mode, but in release mode don't
        // pull in so many dependencies related to printing so just emit an
        // `unreachable` instruction.
        if cfg!(debug_assertions) {
            alloc::handle_alloc_error(layout);
        } else {
            super::abort_internal();
        }
    }
    return ptr;
}
