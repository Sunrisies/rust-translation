//! 可扩展向量编译器的内建特性。
//!
//! In this module, a "vector" is any `#[rustc_scalable_vector]`-annotated type.

/// 创建一个由两个向量组成的元组。
///
/// `SVecTup` must be a scalable vector tuple (`#[rustc_scalable_vector]`) and `SVec` must be a
/// scalable vector (`#[rustc_scalable_vector(N)]`). `SVecTup` must be a tuple of vectors of
/// type `SVec`.
///
/// Corresponds to Clang's `__builtin_sve_svcreate2*` builtins.
#[rustc_nounwind]
#[rustc_intrinsic]
pub unsafe fn sve_tuple_create2<SVec, SVecTup>(x0: SVec, x1: SVec) -> SVecTup;

/// 创建一个由三个向量组成的元组。
///
/// `SVecTup` must be a scalable vector tuple (`#[rustc_scalable_vector]`) and `SVec` must be a
/// scalable vector (`#[rustc_scalable_vector(N)]`). `SVecTup` must be a tuple of vectors of
/// type `SVec`.
///
/// Corresponds to Clang's `__builtin_sve_svcreate3*` builtins.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn sve_tuple_create3<SVec, SVecTup>(x0: SVec, x1: SVec, x2: SVec) -> SVecTup;

/// 创建一个由四个向量组成的元组。
///
/// `SVecTup` must be a scalable vector tuple (`#[rustc_scalable_vector]`) and `SVec` must be a
/// scalable vector (`#[rustc_scalable_vector(N)]`). `SVecTup` must be a tuple of vectors of
/// type `SVec`.
///
/// Corresponds to Clang's `__builtin_sve_svcreate4*` builtins.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn sve_tuple_create4<SVec, SVecTup>(x0: SVec, x1: SVec, x2: SVec, x3: SVec) -> SVecTup;

/// 从向量元组中获取一个向量。
///
/// `SVecTup` must be a scalable vector tuple (`#[rustc_scalable_vector]`) and `SVec` must be a
/// scalable vector (`#[rustc_scalable_vector(N)]`). `SVecTup` must be a tuple of vectors of
/// type `SVec`.
///
/// Corresponds to Clang's `__builtin_sve_svget*` builtins.
///
/// # 安全性
///
/// `IDX` must be in-bounds of the tuple.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn sve_tuple_get<SVecTup, SVec, const IDX: i32>(tuple: SVecTup) -> SVec;

/// 修改向量元组中的一个向量。
///
/// `SVecTup` must be a scalable vector tuple (`#[rustc_scalable_vector]`) and `SVec` must be a
/// scalable vector (`#[rustc_scalable_vector(N)]`). `SVecTup` must be a tuple of vectors of
/// type `SVec`.
///
/// Corresponds to Clang's `__builtin_sve_svset*` builtins.
///
/// # 安全性
///
/// `IDX` must be in-bounds of the tuple.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn sve_tuple_set<SVecTup, SVec, const IDX: i32>(tuple: SVecTup, x: SVec) -> SVecTup;
