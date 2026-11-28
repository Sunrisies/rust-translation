//! Make sure that a `std` macro `hash_map!` does not cause ambiguity
//! 使用相同名称的本地全局导入。
//!
//! 请参阅回归问题 https://github.com/rust-lang/rust/issues/147971

mod module {
    macro_rules! hash_map {
        () => {};
    }
    pub(crate) use hash_map;
}

use module::*;

fn main() {
    hash_map! {}
}
