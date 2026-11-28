#[doc(attribute = "must_use")]
//
/// 当某个值被忽略时，会发出警告。
///
/// The `must_use` attribute applies to values where simply creating or returning them is
/// often not enough. If a value marked with `#[must_use]` is produced and then ignored, the
/// compiler warns through the [`unused_must_use`] lint.
///
/// This is most common on types that represent an important state or outcome. For example,
/// [`Result`] is marked `#[must_use]` because ignoring an error value can hide a failed operation.
/// In the following example, the returned [`Result`] is the only sign that writing the message
/// might have failed:
///
/// ```
/// # #![allow(unused_must_use)]
/// fn write_message() -> std::io::Result<()> {
///     // Write the message...
///     Ok(())
/// }
///
/// write_message();
/// ```
///
/// Ignoring that [`Result`] triggers this warning:
///
/// ```text
/// warning: unused `Result` that must be used
///   = note: this `Result` may be an `Err` variant, which should be handled
///   = note: `#[warn(unused_must_use)]` (part of `#[warn(unused)]`) on by default
/// help: use `let _ = ...` to ignore the resulting value
/// ```
///
/// Future values are also `#[must_use]`: creating a future does not run it, so ignoring one often
/// means the intended asynchronous work never happens.
///
/// You can also place `#[must_use]` on a function, method, or trait declaration. On a function or
/// 该属性可以包含一条说明调用者应如何处理该值的消息：
///
/// ```
/// # #![allow(unused_must_use)]
/// #[must_use]
/// fn make_token() -> String {
///     String::from("token")
/// }
///
/// // Ignoring this call's return value triggers `unused_must_use`.
/// make_token();
/// ```
///
/// On a trait, the warning applies when a function returns an opaque type (`impl Trait`) or trait
/// object (`dyn Trait`) whose bounds include that trait. This is how futures warn if you create one
/// but never poll or await it, since an `async fn` returns an opaque type implementing [`Future`].
///
/// The attribute can include a message explaining what the caller should do with the value:
///
/// ```
/// # #![allow(dead_code)]
/// #[must_use = "call `.finish()` to complete the operation"]
/// fn start_operation() -> Operation {
///     Operation
/// }
///
/// struct Operation;
/// ```
///
/// If intentionally ignoring the value is correct, bind it to `_` or call [`drop`]:
///
/// ```
/// # #[must_use]
/// # fn make_token() -> String {
/// #     String::from("token")
/// # }
/// let _ = make_token();
/// drop(make_token());
/// ```
///
/// The attribute is a warning tool, not a type-system rule. Code can still explicitly discard a
/// `#[must_use]` value, and the compiler does not require callers to inspect or otherwise act on
/// 这主要用于在开发过程中防止检查警告或错误。
///
/// For more information, see the Reference on [the `must_use` attribute].
///
/// [`unused_must_use`]: ../rustc/lints/listing/warn-by-default.html#unused-must-use
/// [the `must_use` attribute]: ../reference/attributes/diagnostics.html#the-must_use-attribute
const _: () = ();

#[doc(attribute = "allow")]
//
/// The `allow` attribute suppresses lint diagnostics that would otherwise produce
/// warnings or errors. It can be used on any lint or lint group (except those
/// set to [`forbid`]).
///
/// ```
/// #[allow(dead_code)]
/// fn unused_function() {
///     // ...
/// }
///
/// fn main() {
///   // `unused_function` does not generate a compiler warning.
/// }
/// ```
///
/// Without `#[allow(dead_code)]`, the example above would emit:
///
/// ```text
/// warning: function `unused_function` is never used
///  --> main.rs:1:4
///   |
/// 1 | fn unused_function() {
///   |    ^^^^^^^^^^^^^^^
///   |
///   = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default
///
///   warning: 1 warning emitted
/// ```
///
/// Multiple lints can be set to `allow` at once with commas:
///
/// ```
/// #[allow(unused_variables, unused_mut)]
/// fn main() {
///     let mut x: u32 = 42;
/// }
/// ```
///
/// This is mostly used to prevent lint warnings or errors while still under development.
///
/// It cannot override a lint that has been set to [`forbid`].
///
/// It's also important to consider that overusing `allow` could make code harder to maintain
/// and possibly hide issues. To mitigate this issue, using the `expect` attribute is preferred.
///
/// `allow` can be overridden by [`warn`], [`deny`], and [`forbid`].
///
/// The lint checks supported by rustc can be found via `rustc -W help`,
/// along with their default settings and are documented in [the `rustc` book].
///
/// [the `rustc` book]: ../rustc/lints/listing/index.html
///
/// For more information, see the Reference on [the `allow` attribute].
///
/// [the `allow` attribute]: ../reference/attributes/diagnostics.html#lint-check-attributes
/// [`forbid`]: ./attribute.forbid.html
/// [`warn`]: ./attribute.warn.html
/// [`deny`]: ./attribute.deny.html
const _: () = ();

#[doc(attribute = "cfg")]
//
/// 用于条件编译。
///
/// The `cfg` attribute allows compiling an item under specific conditions, otherwise it
/// 取决于你针对的平台，在编译过程中只有其中一个函数会被考虑。
///
/// ```
/// // Only compiles this function for Linux.
/// #[cfg(target_os = "linux")]
/// fn platform_specific() {
///     println!("Running on Linux");
/// }
///
/// // Only compiles this function if not for Linux.
/// #[cfg(not(target_os = "linux"))]
/// fn platform_specific() {
///     println!("Running on something else");
/// }
/// ```
///
/// 根据你所针对的平台，这两个函数中只有一个会在编译时被考虑。
/// during the compilation.
///
/// Conditions can also be combined with `all(...)`, `any(...)`, and `not(...)`:
///
/// * `all`: True if all given predicates are true.
/// * `any`: True if at least one of the given predicates is true.
/// * `not`: True if the predicate is false and false if the predicate is true.
///
/// ```
/// #[cfg(all(unix, target_pointer_width = "64"))]
/// fn unix_64bit() {
///     // ...
/// }
/// ```
///
/// If you want to use this mechanism in an [`if`] condition in your code, you
/// can use the [`cfg!`] macro. To conditionally apply an attribute,
/// see [`cfg_attr`].
///
/// For more information, see the Reference on [the `cfg` attribute].
///
/// [`cfg_attr`]: ./attribute.cfg_attr.html
/// [the `cfg` attribute]: ../reference/conditional-compilation.html#the-cfg-attribute
/// [`if`]: ./keyword.if.html
const _: () = ();

#[doc(attribute = "crate_name")]
//
/// Specifies the name of the crate.
///
/// Written as an inner attribute at the top of the crate root, `crate_name` is used
/// to specify the name of a crate.
///
/// ```
/// #![crate_name = "my_crate"]
/// ```
///
/// The crate name must not be empty, and must only contain [Unicode alphanumeric] or
/// `_` (U+005F) characters.
///
/// Note that the specified name must match the name given by the `--crate-name` flag.
///
/// ```text
/// error: `--crate-name` and `#[crate_name]` are required to match, but `cli_name` != `attr_name`
///  --> main.rs:1:17
///   |
/// 1 | #![crate_name = "attr_name"]
///   |                 ^^^^^^^^^^^
/// ```
///
/// In a Cargo project the crate name is always passed as `--crate-name`, derived from the target
/// name (`[lib] name` or `[[bin]] name` if set, otherwise `[package] name` for libraries and the
/// primary binary, or the source file name for other binaries). The `crate_name` attribute is
/// therefore redundant here: it adds nothing, and if it is present it must match Cargo's name,
/// otherwise `rustc` reports an error.
///
/// For more information, see the Reference on [the `crate_name` attribute].
///
/// [Unicode alphanumeric]: ../std/primitive.char.html#method.is_alphanumeric
/// [the `crate_name` attribute]: ../reference/crates-and-source-files.html#the-crate_name-attribute
const _: () = ();

#[doc(attribute = "crate_type")]
//
/// Specifies the type of a crate.
///
/// Written as an inner attribute at the top of the crate root, `crate_type` is used
/// to specify the type of a crate.
///
/// ```
/// #![crate_type = "lib"]
/// ```
///
/// The specified crate type must be a known crate type (for the list of valid crate types, see [Linkage]),
/// otherwise `rustc` reports an error:
///
/// ```text
/// error: invalid `crate_type` value
///  --> typo.rs:1:17
///   |
/// 1 | #![crate_type = "dyllib"]
///   |                 ^^^^^^^^ help: did you mean: `"dylib"`
///   |
///   = note: `#[deny(unknown_crate_types)]` on by default
/// ```
///
/// In one session of compilation, the compiler can generate multiple artifacts through the use of
/// either command line flags or the `crate_type` attribute. Note that the output artifacts are stackable in
/// the sense that if multiple are specified, then the compiler will produce each form of output without
/// 需要重新编译。
///
/// For example, if a crate has the following `crate_type` attributes:
///
/// ```
/// #![crate_type = "staticlib"]
/// #![crate_type = "dylib"]
/// ```
///
/// 那么编译器将同时构建静态库和动态库。
///
/// If the flag `--test` is passed, the `crate_type` attributes will be ignored, and the crate will be built
/// 测试框架。
///
/// For `[lib]`/`[[bin]]` targets Cargo passes `--crate-type` derived from the target (`[lib] crate-type`, `[[bin]]`);
/// test/bench targets are compiled with `--test`. In all these cases the attribute is ignored.
///
/// Note that the `bin` type and `proc-macro` type cannot be mixed with any other crate type,
/// otherwise `rustc` reports an error:
///
/// ```text
/// error: cannot mix `bin` crate type with others
/// ```
///
/// ```text
/// error: cannot mix `proc-macro` crate type with others
/// ```
///
/// In general, crate type `bin` and crate type `lib` should be sufficient for all compilation needs, and
/// 其他选项仅在需要更精细控制 crate 输出格式时可用。
/// 有关更多信息，请参阅 [Linkage] 中的参考文档。
///
/// For more information, see the Reference on [Linkage].
///
/// [Linkage]: ../reference/linkage.html
const _: () = ();

#[doc(attribute = "deny")]
//
/// 当 lint 检查失败时，会发出错误并阻止编译完成。
/// 这适用于执行规则或防止某些模式：
///
/// ```compile_fail
/// #[deny(unused)]
/// fn foo() {
///     let x = 42; // Emits an error because x is unused.
/// }
/// ```
///
/// `deny` can be overridden by [`allow`], [`warn`], and [`forbid`]:
///
/// ```
/// #![deny(unused)]
///
/// #[allow(unused)] // We override the `deny` for this function.
/// fn foo() {
///     let x = 42; // No lint emitted even though `x` is unused.
/// }
/// ```
///
/// Multiple lints can also be set to `deny` at once:
///
/// ```compile_fail
/// #![deny(unused_imports, unused_variables)]
/// use std::collections::*;
///
/// fn main() {
///     let mut x = 10;
/// }
/// ```
///
/// The lint checks supported by rustc can be found via `rustc -W help`,
/// along with their default settings and are documented in [the `rustc` book].
///
/// [the `rustc` book]: ../rustc/lints/listing/index.html
///
/// For more information, see the Reference on [the `deny` attribute].
///
/// [the `deny` attribute]: ../reference/attributes/diagnostics.html#lint-check-attributes
/// [`forbid`]: ./attribute.forbid.html
/// [`allow`]: ./attribute.allow.html
/// [`warn`]: ./attribute.warn.html
/// [`deny`]: ./attribute.deny.html
const _: () = ();

#[doc(attribute = "forbid")]
//
/// 当 lint 检查失败时，会发出错误并阻止编译完成。
///
/// A lint set to `forbid` cannot be overridden by [`allow`] or [`warn`].
/// Attempting either will result in a compilation error. Writing `#[deny(...)]` on the same lint inside a
/// `forbid` scope is permitted, but has no effect; the lint remains at the `forbid` level.
///
/// 这适用于执行不应被放宽的严格政策。
/// 代码库中的任何位置。例如：
///
/// ```
/// #![forbid(unsafe_code)]
///
/// // This would cause a compilation error if uncommented:
/// // #[allow(unsafe_code)] // error: cannot override `forbid`
/// ```
///
/// Multiple lints can be set to `forbid` at once:
///
/// ```
/// #![forbid(unsafe_code, unused)]
/// ```
///
/// The lint checks supported by rustc can be found via `rustc -W help`,
/// along with their default settings and are documented in [the `rustc` book].
///
/// [the `rustc` book]: ../rustc/lints/listing/index.html
///
/// For more information, see the Reference on [the `forbid` attribute].
///
/// [the `forbid` attribute]: ../reference/attributes/diagnostics.html#lint-check-attributes
/// [`allow`]: ./attribute.allow.html
/// [`warn`]: ./attribute.warn.html
const _: () = ();

#[doc(attribute = "deprecated")]
//
/// 当使用具有此属性的项时，在编译过程中会发出警告。
/// `since` and `note` are optional fields giving more detail about why the item is deprecated.
///
/// * `since`: the version since when the item is deprecated.
/// * `note`: the reason why an item is deprecated.
///
/// 示例：
///
/// ```
/// #[deprecated(since = "1.0.0", note = "Use bar instead")]
/// struct Foo;
/// struct Bar;
/// ```
///
/// The `deprecated` attribute helps developers transition away from old code by providing warnings
/// when deprecated items are used. Note that during `Cargo` builds, warnings on dependencies get
/// 默认静默处理，因此除非你构建该依赖项，否则可能看不到弃用警告。
/// 直接如此。
///
/// For more information, see the Reference on [the `deprecated` attribute].
///
/// [the `deprecated` attribute]: ../reference/attributes/diagnostics.html#the-deprecated-attribute
const _: () = ();

#[doc(attribute = "warn")]
//
/// 在编译时，当 lint 检查失败时会发出警告。
///
/// Unlike [`deny`] or [`forbid`], `warn` does not produce a hard error: the compilation
/// continues, but the compiler emits a warning message. `warn` can be overridden by [`allow`],
/// [`deny`], and [`forbid`].
///
/// Example:
///
/// ```compile_fail
/// #![allow(unused)]
///
/// #[warn(unused)] // We override the allowed `unused` lint.
/// fn foo() {
///     // This lint warns by default even without #[warn(unused)] being explicitly set
///     let x = 42; // warning: unused variable `x`
/// }
/// ```
///
///
/// Many lints, including `unused`, are already set to `warn` by default so this attribute is
/// mainly useful for lints that are normally [`allow`] by default.
///
/// Multiple lints can be set to `warn` at once:
///
/// ```compile_fail
/// #[warn(unused_mut, unused_variables)]
/// fn main() {
///     let mut x = 42;
/// }
/// ```
///
/// The lint checks supported by rustc can be found via `rustc -W help`,
/// along with their default settings and are documented in [the `rustc` book].
///
/// [the `rustc` book]: ../rustc/lints/listing/index.html
///
/// For more information, see the Reference on [the `warn` attribute].
///
/// [the `warn` attribute]: ../reference/attributes/diagnostics.html#lint-check-attributes
/// [`allow`]: ./attribute.allow.html
/// [`deny`]: ./attribute.deny.html
/// [`forbid`]: ./attribute.forbid.html
const _: () = ();

#[doc(attribute = "no_std")]
//
/// 防止自动链接标准库。
///
/// Written as an inner attribute at the top of the crate root, the `no_std` attribute stops
/// the compiler from linking [`std`] into the crate, and only links [`core`].
///
/// The attribute also swaps which prelude gets inserted, with the [`core`] prelude replacing
/// the [`std`] prelude. Items like [`Option`], [`Result`], and the primitive types remain
/// available from [`core`] without any imports needed:
///
/// ```rust,ignore (no_std)
/// #![no_std]
///
/// fn halve(x: u32) -> Option<u32> {
///     if x % 2 == 0 { Some(x / 2) } else { None }
/// }
/// ```
///
/// Anything that requires heap memory allocations is not part of [`core`]. Linking the [`alloc`]
/// crate 可以用来包含这些类型：
///
/// ```rust,ignore (no_std + needs a global allocator to link)
/// #![no_std]
///
/// extern crate alloc;
///
/// use alloc::vec::Vec;
/// ```
///
/// A `no_std` binary also removes the startup routine and default panic handler `std`
/// normally provides. It must define its own `#[panic_handler]`, and typically its own
/// entry point by additionally using `#![no_main]`:
///
/// ```rust,ignore (no_std + needs more than no_main alone to link)
/// #![no_std]
/// #![no_main]
///
/// use core::panic::PanicInfo;
///
/// #[panic_handler]
/// fn on_panic(_info: &PanicInfo) -> ! {
///     loop {}
/// }
/// ```
///
/// For more information, see the Reference on [the `no_std` attribute].
///
/// [`std`]: ../std/index.html
/// [`core`]: ../core/index.html
/// [`alloc`]: ../alloc/index.html
/// [`Option`]: option::Option
/// [`Result`]: result::Result
/// [the `no_std` attribute]: ../reference/names/preludes.html#the-no_std-attribute
const _: () = ();

#[doc(attribute = "no_main")]
/// Prevents emitting the `main` entrypoint symbol.
///
/// Written as an inner attribute at the top of the crate root, the `no_main` attribute prevents
/// 编译器生成程序的标准 Rust 入口点，由你自行决定。
/// 当其他对象被链接到程序中并定义入口点时，这非常有用。
/// or when you want to define the platform's `main` symbol yourself.
///
/// If you define an entry point symbol that is suitable for your target, it must also be exported
/// under an unmangled name using the [`no_mangle` attribute]:
///
/// ```no_run
/// #![no_main]
///
/// use std::ffi::{c_char, c_int};
///
/// #[unsafe(no_mangle)]
/// pub extern "C" fn main(_argc: c_int, _argv: *const *const c_char) -> c_int {
///     println!("Hello world!");
///     0
/// }
/// ```
///
/// Unlike `no_std`, the `no_main` attribute does not prevent the compiler from generating
/// 指定类型的 [表示方式]。
///
/// [ABI]: https://en.wikipedia.org/wiki/Application_binary_interface
/// [`no_mangle` attribute]: ../reference/abi.html#the-no_mangle-attribute
const _: () = ();

#[doc(attribute = "repr")]
/// Specifies the [representation] of a type.
///
/// Written as an outer attribute on a `struct`, `enum` or `union`, `repr` controls how the
/// type is laid out in memory. This is needed when passing types across an [FFI] boundary
/// or whenever you rely on a specific layout.
///
/// 可用的表示方式包括：
///
/// * [`Rust`] (the default): the layout is unspecified and may change between compilations.
/// * [`C`]: the layout follows the rules of the C language for the target platform.
/// * The [primitive representations] (`u8`, `i32`, `usize`, ...): set the discriminant
///   type of an enum.
/// * [`transparent`]: the type has the same layout and ABI as its only non-zero-sized field.
///
/// The `align(N)` and `packed(N)` modifiers raise or lower the alignment of a type, respectively.
/// `N` must be a power of two no greater than 2<sup>29</sup>. The two modifiers cannot be
/// applied to the same type, and references to fields of a `packed` type cannot be created,
/// 因为它们可能未对齐。
///
/// # 示例
///
/// ```
/// #[repr(C, align(16))]
/// struct Foo {
///     first: u32,
///     second: u32,
///     third: u32,
/// }
///
/// assert_eq!(align_of::<Foo>(), 16);
/// // 12 bytes of fields, rounded up to a multiple of the alignment.
/// assert_eq!(size_of::<Foo>(), 16);
/// ```
///
/// ```
/// #[repr(C, packed(2))]
/// struct Foo {
///     first: u32,
///     second: u32,
///     third: u32,
/// }
///
/// assert_eq!(align_of::<Foo>(), 2);
/// assert_eq!(size_of::<Foo>(), 12);
/// ```
///
/// ```
/// #[repr(C)]
/// struct Foo<T> {
///     item: T,
/// }
/// ```
///
/// `Foo` is laid out according to the C rules and is guaranteed to be 16-byte aligned.
///
/// 表示方式是类型定义的一个属性，因此它
/// parameters: below, `Foo<u8>` and `Foo<u64>` both use the `C` representation. Their actual
/// layouts still differ, because they depend on `T`.
///
/// [representation]: ../reference/type-layout.html#representations
/// [`Rust`]: ../reference/type-layout.html#the-rust-representation
/// [`C`]: ../reference/type-layout.html#the-c-representation
/// [primitive representations]: ../reference/type-layout.html#primitive-representations
/// [`transparent`]: ../reference/type-layout.html#the-transparent-representation
/// [FFI]: https://en.wikipedia.org/wiki/Foreign_function_interface
const _: () = ();

#[doc(attribute = "inline")]
//
/// 建议编译器在函数调用处内联该函数。
///
/// 内联将调用替换为被调用函数的副本，从而消除
/// overhead of the call. The `inline` attribute is only a hint: the compiler may ignore it, and
/// 当认为值得时，编译器会自行内联函数。错误的内联选择会使程序变大或变慢。
/// 真正重要的内联发生在 crate 边界之间。非泛型函数则不会
///
/// Where it does matter is inlining across crate boundaries. A non-generic function is not
/// 通常被内联到另一个 crate 中，因为调用方 crate 只依赖其签名进行编译。
/// signature. Marking it `#[inline]` makes the body available to other crates so they can inline
/// 它也是如此：
///
/// ```rust
/// # #![allow(dead_code)]
/// #[inline]
/// pub fn square(x: i32) -> i32 {
///     x * x
/// }
/// ```
///
/// 泛型函数不需要此属性。它们在每个使用它们的 crate 中被实例化，因此
/// 其体部分已可供内联使用。
///
/// 该属性适用于函数，并有三种形式：
///
/// - `#[inline]` suggests inlining the function.
/// - `#[inline(always)]` suggests inlining it at every call site.
/// - `#[inline(never)]` suggests never inlining it.
///
/// You should almost never need `#[inline(always)]`: prefer to let the compiler decide unless
/// profiling shows a small, hot function that benefits from it. `#[inline(never)]` is useful to
/// 避免很少使用的路径很有用，例如只报告错误的函数，将其从调用者中隔离出来。
///
/// For more information, see the Reference on [the `inline` attribute].
///
/// [the `inline` attribute]: ../reference/attributes/codegen.html#the-inline-attribute
const _: () = ();

#[doc(attribute = "cold")]
//
/// 向编译器提示该函数不太可能被调用。
///
/// Marking a function `#[cold]` tells the compiler that calls to it are rare, so it can
/// 针对该函数未被调用的常见情况进行优化。这只是一个提示：编译器可能会忽略它，且不会改变函数的行为。
/// 它通常用于处理罕见情况的函数，例如错误或 panic 路径：
///
/// It is typically used on functions that handle uncommon cases, such as error or panic paths:
///
/// ```rust
/// # #![allow(dead_code)]
/// fn check(value: i32) {
///     if value < 0 {
///         report_error("value must be non-negative");
///     }
///     // ... the common case continues here ...
/// }
///
/// #[cold]
/// fn report_error(message: &str) {
///     eprintln!("error: {message}");
/// }
/// ```
///
/// For more information, see the Reference on [the `cold` attribute].
///
/// [the `cold` attribute]: ../reference/attributes/codegen.html#the-cold-attribute
const _: () = ();

#[doc(attribute = "track_caller")]
//
/// Make a function report the location of its caller instead of its own.
///
/// When a function panics, the panic message normally points at the line inside that function
/// where the panic happened. `#[track_caller]` changes that: it lets the function see the
/// [`Location`] it was called from, so the panic (and any direct use of [`Location::caller`])
/// points at the call site instead. The standard library uses this on methods like
/// [`Option::unwrap`], so a failed `unwrap` blames the line that called it rather than a line
/// inside the standard library.
///
/// ```rust,should_panic
/// #[track_caller]
/// fn assert_even(n: i32) {
///     assert!(n % 2 == 0, "{n} is not even");
/// }
///
/// // The panic blames this line, not the `assert!` inside `assert_even`.
/// assert_even(3);
/// ```
///
/// The attribute applies to functions with the default `"Rust"` ABI, other than `fn main`.
///
/// For more information, see the Reference on [the `track_caller` attribute].
///
/// [`Location`]: panic::Location
/// [`Location::caller`]: panic::Location::caller
/// [`Option::unwrap`]: Option::unwrap
/// [the `track_caller` attribute]: ../reference/attributes/codegen.html#the-track_caller-attribute
const _: () = ();

#[doc(attribute = "proc_macro")]
//
/// Defines a function-like procedural macro.
///
/// Applied to a `pub` function at the root of a proc-macro crate, `proc_macro` makes that function usable as a macro invoked as
/// `foo!(...)` in other crates. The function receives the tokens written inside the invocation as a [`TokenStream`] and returns
/// the [`TokenStream`] that replaces the invocation:
///
/// ```rust, ignore (requires depending on the proc-macro crate)
/// # extern crate proc_macro;
/// use proc_macro::TokenStream;
///
/// #[proc_macro]
/// pub fn foo(input: TokenStream) -> TokenStream {
///    "fn answer() -> u32 { 67 }".parse().unwrap()
/// }
/// ```
///
/// 该宏只能从其他 crate 调用，而不能从定义它的 crate 调用：
///
/// ```rust,ignore (requires depending on the proc-macro crate)
/// use my_macro_crate::foo;
///
/// // Expands to `fn answer() -> u32 { 67 }`.
/// foo!();
///
/// fn main() {
///    println!("{}", answer()); // Prints 67
/// }
/// ```
///
/// The attribute is only usable with crates of the `proc-macro` crate type, which is set in the crate's `Cargo.toml`
/// with `proc-macro = true` in the `[lib]` section. Using it anywhere else is a compilation error:
///
/// ```text
///error: the `#[proc_macro]` attribute is only usable with crates of the `proc-macro` crate type
/// --> src/lib.rs:4:1
///  |
/// 4| #[proc_macro]
///  | ^^^^^^^^^^^^
/// ```
///
/// For more information, see the Reference on [function-like procedural macros] and the [`proc_macro`] crate documentation.
///
/// [`TokenStream`]: ../proc_macro/struct.TokenStream.html
/// [function-like procedural macros]: ../reference/procedural-macros.html#the-proc_macro-attribute
/// [`proc_macro`]: ../proc_macro/index.html
const _: () = ();

#[doc(attribute = "link_section")]
//
/// 将函数或静态成员放在特定的对象文件部分中。
///
/// The `link_section` attribute specifies the section of the generated object file where a
/// 函数或静态成员。部分名称及其含义取决于目标环境。
///
/// ```rust,no_run
/// # #[cfg(target_os = "linux")] {
/// #[unsafe(link_section = ".example_section")]
/// pub static VALUE: u32 = 42;
/// # }
/// ```
///
/// 错误地将代码或数据放在某个部分中可能会违反目标环境、链接器或运行时的要求。例如，将可变数据放在只读部分中可能导致
/// linker, or runtime. For example, placing mutable data in a read-only section may result in
/// undefined behavior. For this reason, `link_section` is an unsafe attribute.
///
/// Starting with the 2024 edition, the attribute must be written using the `unsafe(...)` syntax.
/// Earlier editions also permit `#[link_section = "..."]`.
///
/// For more information, see the Reference on [the `link_section` attribute].
///
/// [the `link_section` attribute]: ../reference/abi.html#the-link_section-attribute
const _: () = ();

#[doc(attribute = "non_exhaustive")]
//
/// 表示类型将来可能添加更多字段或变体。
///
/// Placing `#[non_exhaustive]` on a struct or enum tells code in other crates not to assume
/// 定义是完整的。这允许库添加新字段或变体而不会破坏现有代码。
/// 
///
/// 在枚举中，定义外的代码在匹配时必须包含通配符分支：
///
/// ```rust,ignore (cross-crate effect only)
/// // in crate `errors`:
/// #[non_exhaustive]
/// pub enum ConnectionError {
///     Refused,
///     Timeout,
/// }
///
/// // in another crate:
/// use errors::ConnectionError;
///
/// match error {
///     ConnectionError::Refused => println!("connection refused"),
///     ConnectionError::Timeout => println!("timed out"),
///     _ => println!("other error"), // required because of #[non_exhaustive]
/// }
/// ```
///
/// 在结构体中，定义外的代码不能使用结构体字面量语法构造实例：
/// 
///
/// ```rust,ignore (cross-crate effect only)
/// // in crate `config`:
/// #[non_exhaustive]
/// pub struct Config {
///     pub width: u32,
///     pub height: u32,
/// }
///
/// // in another crate:
/// use config::Config;
///
/// let c = Config { width: 800, height: 600 }; // ERROR: cannot construct
/// ```
///
/// 在定义 crate 内，穷尽匹配和直接构造仍然允许。
///
/// For more information, see the Reference on [the `non_exhaustive` attribute].
///
/// [the `non_exhaustive` attribute]: ../reference/attributes/type_system.html#the-non_exhaustive-attribute
const _: () = ();

#[doc(attribute = "automatically_derived")]
//
/// The `automatically_derived` attribute is used to indicate that an `impl` block is automatically
/// 它没有直接效果，但可能被工具和诊断lint（如 [Clippy]）用来自动检测这些自动生成的实现。
/// 示例：
///
/// Example:
///
/// ```rust
/// // Given #[derive(Clone)] on struct Example, the derive macro may produce:
/// #[automatically_derived]
/// impl ::core::clone::Clone for Example {
///     fn clone(&self) -> Self { Example }
/// }
/// # struct Example;
/// ```
///
/// The attribute may only be applied to an `impl` block.
///
/// Because code generated by a macro becomes part of the source code representation of the crate
/// that calls the macro, diagnostic lints for the expanded macro will be emitted in the caller's
/// 在本地工作空间中生成的警告会被 Cargo 抑制，而依赖项构建时则不会。这可能不太理想，因此宏的编写者可以使用
/// are suppressed by Cargo). This may be undesirable, so the author of the macro can use the
/// `automatically_derived` attribute to hint to tools that the generated code is not written by the
/// caller (and that tools should not render warnings for it).
///
/// For example, this `impl` block lacks `#[automatically_derived]`:
///
/// ```rust
/// // Suppose this impl block is the output of a derive macro
/// impl ::core::cmp::PartialEq for Example {
///     fn eq(&self, other: &Self) -> bool { true }
///     fn ne(&self, other: &Self) -> bool { !(self == other) }
/// }
/// # struct Example;
/// ```
///
/// 在上面的示例中，Clippy 会发出以下警告：
///
/// ```text
/// warning: re-implementing `PartialEq::ne` is unnecessary
///  --> src/lib.rs:7:9
///   |
/// 4 |         fn ne(&self, other: &Self) -> bool { !(self == other) }
///   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
///   |
///   = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.98.0/index.html#partialeq_ne_impl
///   = note: `#[warn(clippy::partialeq_ne_impl)]` on by default
/// ```
///
/// However, if the derive macro were written so that it outputs `#[automatically_derived]` on the
/// `impl` block, as below, then Clippy will not emit the above `partialeq_ne_impl` lint:
///
/// ```rust
/// // Suppose this impl block is the output of a derive macro
/// #[automatically_derived]
/// impl ::core::cmp::PartialEq for Example {
///     fn eq(&self, other: &Self) -> bool { true }
///     fn ne(&self, other: &Self) -> bool { !(self == other) }
/// }
/// # struct Example;
/// ```
///
/// The `automatically_derived` attribute should be preferred over the [`allow`] attribute for
/// suppressing unintended user-facing diagnostics in automatically generated code.
///
/// For more information, see the Reference on [the `automatically_derived` attribute].
///
/// [`allow`]: ./attribute.allow.html
/// [derive macro]: ./attr.derive.html
/// [Clippy]: https://github.com/rust-lang/rust-clippy
/// [the `automatically_derived` attribute]: ../reference/attributes/derive.html#the-automatically_derived-attribute
const _: () = ();

#[doc(attribute = "cfg_attr")]
//
/// The `cfg_attr` attribute is used to conditionally apply one or more attributes to an item.
///
/// 示例：
///
/// ```rust
/// // The struct derives `Debug` when the `debug_impls` feature is enabled.
/// #[cfg_attr(feature = "debug_impls", derive(Debug))]
/// struct X;
/// ```
///
/// 可以通过逗号分隔多个属性来应用它们：
///
/// ```rust
/// #[cfg_attr(feature = "nightly", allow(dead_code), deny(unused_variables))]
/// // This function only gets the `allow(dead_code)` and `deny(unused_variables)` attributes when
/// // `feature = "nightly"` is active.
/// fn nightly_only_function() {
///     let x = 42;
/// }
/// ```
///
/// For complex conditions, you can combine `all(...)`, `any(...)`, and `not(...)`.
///
/// * `all`: True if all given predicates are true.
/// * `any`: True if at least one of the given predicates is true.
/// * `not`: True if the predicate is false.
///
/// ```rust
/// #[cfg_attr(
///     all(feature = "system", feature = "disk"),
///     doc = "These docs only show up if both `system`, and `disk` are enabled.",
/// )]
/// mod my_module {
///     // ...
/// }
/// ```
///
/// For more information, see the Reference on [the `cfg_attr` attribute].
///
/// [`cfg`]: ./attribute.cfg.html
/// [the `cfg_attr` attribute]: ../reference/conditional-compilation.html#the-cfg_attr-attribute
const _: () = ();

#[doc(attribute = "windows_subsystem")]
//
/// The `windows_subsystem` attribute is used to specify the subsystem for a Windows application.
///
/// 示例：
///
/// ```rust
/// #![windows_subsystem = "windows"]
///
/// fn main() {}
/// ```
///
/// 接受的值为“console”（默认）和“windows”。
///
/// The `windows_subsystem` attribute may only be applied to the crate root.
///
/// Only the first use of `windows_subsystem` has effect.
///
/// The `windows_subsystem` attribute is ignored on non-Windows targets and non-bin crate types.
/// 如果从现有的控制台运行“console”进程，则它会附加到该控制台；
/// 否则将创建一个新的控制台。
/// “windows”子系统会独立于任何现有的“console”运行。
///
/// [Reference](../reference/runtime.html#the-windows_subsystem-attribute)
const _: () = ();

#[doc(attribute = "recursion_limit")]
//
/// 设置递归编译时操作的最大深度。
///
/// 编译器在执行可能无限扩展的操作时限制其递归深度，
/// 例如宏展开和自动引用。
/// `recursion_limit` attribute raises that limit. It applies to the whole crate and is
/// 值是一个包含新限制的字符串。默认值为 128。
///
/// ```
/// #![recursion_limit = "256"]
///
/// // Macros may now expand up to 256 levels deep.
/// ```
///
/// 此限制仅影响编译时递归。它不会改变递归深度。
///
/// This limit affects only compile-time recursion. It does not change how deeply
/// 递归代码可以在运行时执行。
///
/// 当编译时操作递归深度超过限制时，编译会失败。
/// 例如，这个宏会无限自扩展，因此总是会触及限制。
///
/// ```compile_fail
/// macro_rules! a {
///     () => { a!(); };
/// }
///
/// a!();
/// ```
///
/// 这会产生一个错误，帮助信息会提示如何提高限制值。
///
/// ```text
/// error: recursion limit reached while expanding `a!`
///  --> src/main.rs:2:13
///   |
/// 2 |     () => { a!(); };
///   |             ^^^^
/// ...
/// 5 | a!();
///   | ---- in this macro invocation
///   |
///   = help: consider increasing the recursion limit by adding a `#![recursion_limit = "256"]`
///           attribute to your crate
/// ```
///
/// 自动引用也有类似的限制。
///
/// ```compile_fail
/// #![recursion_limit = "1"]
///
/// // Error: two recursive steps are needed to auto-dereference `&&&1` to `&u8`.
/// let f = |_: &u8| {};
/// f(&&&1);
/// ```
///
/// Reaching the limit is most common in code that nests many macros, such as code expanded
/// by `derive` macros or deeply nested `async` code. Raising the limit is safe, but very
/// 可能是代码递归深度超过了预期。
/// still overflow the compiler's own stack. Increase the limit in measured steps rather
/// than jumping to a very large number. If the limit is reached without an obvious cause,
/// the code may be more deeply recursive than intended.
///
/// For more information, see the Reference on [the `recursion_limit` attribute].
///
/// [the `recursion_limit` attribute]: ../reference/attributes/limits.html#the-recursion_limit-attribute
const _: () = ();
