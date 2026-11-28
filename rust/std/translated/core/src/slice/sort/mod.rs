//! 此模块及其包含的子模块包含了高效且稳健的排序实现代码。
//! implementations, as well as the domain adjacent implementation of `select_nth_unstable`.

pub mod stable;
pub mod unstable;

pub(crate) mod select;
pub(crate) mod shared;
