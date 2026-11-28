//! The `Default` trait for types with a default value.

#![stable(feature = "rust1", since = "1.0.0")]

use crate::ascii::Char as AsciiChar;

/// 用于为类型提供有用默认值的 trait。
///
/// 有时，你希望回退到某种默认值，并且
/// don't particularly care what it is. This comes up often with `struct`s
/// that define a set of options:
///
/// ```
/// # #[allow(dead_code)]
/// struct SomeOptions {
///     foo: i32,
///     bar: f32,
/// }
/// ```
///
/// How can we define some default values? You can use `Default`:
///
/// ```
/// # #[allow(dead_code)]
/// #[derive(Default)]
/// struct SomeOptions {
///     foo: i32,
///     bar: f32,
/// }
///
/// fn main() {
///     let options: SomeOptions = Default::default();
/// }
/// ```
///
/// Now, you get all of the default values. Rust implements `Default` for various primitive types.
///
/// ## 可派生
///
/// ```
/// # #[allow(dead_code)]
/// # #[derive(Default)]
/// # struct SomeOptions {
/// #     foo: i32,
/// #     bar: f32,
/// # }
/// fn main() {
///     let options = SomeOptions { foo: 42, ..Default::default() };
/// }
/// ```
///
/// ## Derivable
///
/// This trait can be used with `#[derive]` if all of the type's fields implement
/// `Default`. When `derive`d, it will use the default value for each field's type.
///
/// ### `enum`s
///
/// When using `#[derive(Default)]` on an `enum`, you need to choose which unit variant will be
/// default. You do this by placing the `#[default]` attribute on the variant.
///
/// ```
/// #[derive(Default)]
/// enum Kind {
///     #[default]
///     A,
///     B,
///     C,
/// }
/// ```
///
/// You cannot use the `#[default]` attribute on non-unit or non-exhaustive variants.
///
/// The `#[default]` attribute was stabilized in Rust 1.62.0.
///
/// ## How can I implement `Default`?
///
/// Provide an implementation for the `default()` method that returns the value of
/// 默认值通常是某种初始值、身份值或任何其他在默认情况下有意义的数值。
///
/// ```
/// # #![allow(dead_code)]
/// enum Kind {
///     A,
///     B,
///     C,
/// }
///
/// impl Default for Kind {
///     fn default() -> Self { Kind::A }
/// }
/// ```
///
/// # 示例
///
/// ```
/// # #[allow(dead_code)]
/// #[derive(Default)]
/// struct SomeOptions {
///     foo: i32,
///     bar: f32,
/// }
/// ```
#[rustc_diagnostic_item = "Default"]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
pub const trait Default: Sized {
    /// 返回类型的“默认值”。
    ///
    /// 默认值通常是某种初始值、身份值或任何其他在默认情况下有意义的数值。
    /// # 示例
    ///
    /// # 使用内置默认值：
    ///
    /// 创建自己的默认值：
    ///
    /// ```
    /// let i: i8 = Default::default();
    /// let (x, y): (Option<String>, f64) = Default::default();
    /// let (a, b, (c, d)): (i32, u32, (bool, bool)) = Default::default();
    /// ```
    ///
    /// Making your own:
    ///
    /// ```
    /// # #[allow(dead_code)]
    /// enum Kind {
    ///     A,
    ///     B,
    ///     C,
    /// }
    ///
    /// impl Default for Kind {
    ///     fn default() -> Self { Kind::A }
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "default_fn"]
    fn default() -> Self;
}

/// Derive macro generating an impl of the trait `Default`.
#[rustc_builtin_macro(Default, attributes(default))]
#[stable(feature = "builtin_macro_prelude", since = "1.38.0")]
#[allow_internal_unstable(core_intrinsics)]
pub macro Default($item:item) {
    /* compiler built-in */
}

macro_rules! default_impl {
    ($t:ty, $v:expr, $doc:tt) => {
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_unstable(feature = "const_default", issue = "143894")]
        const impl Default for $t {
            #[inline(always)]
            #[doc = $doc]
            fn default() -> $t {
                $v
            }
        }
    };
}

default_impl! { (), (), "Returns the default value of `()`" }
default_impl! { bool, false, "Returns the default value of `false`" }
default_impl! { char, '\x00', "Returns the default value of `\\x00`" }
default_impl! { AsciiChar, AsciiChar::Null, "Returns the default value of `Null`" }

default_impl! { usize, 0, "Returns the default value of `0`" }
default_impl! { u8, 0, "Returns the default value of `0`" }
default_impl! { u16, 0, "Returns the default value of `0`" }
default_impl! { u32, 0, "Returns the default value of `0`" }
default_impl! { u64, 0, "Returns the default value of `0`" }
default_impl! { u128, 0, "Returns the default value of `0`" }

default_impl! { isize, 0, "Returns the default value of `0`" }
default_impl! { i8, 0, "Returns the default value of `0`" }
default_impl! { i16, 0, "Returns the default value of `0`" }
default_impl! { i32, 0, "Returns the default value of `0`" }
default_impl! { i64, 0, "Returns the default value of `0`" }
default_impl! { i128, 0, "Returns the default value of `0`" }

default_impl! { f16, 0.0f16, "Returns the default value of `0.0`" }
default_impl! { f32, 0.0f32, "Returns the default value of `0.0`" }
default_impl! { f64, 0.0f64, "Returns the default value of `0.0`" }
default_impl! { f128, 0.0f128, "Returns the default value of `0.0`" }
