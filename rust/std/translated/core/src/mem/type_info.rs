//! 用于以运行时或常量求值方式暴露类型编译时信息的 MVP。
//! 编译时类型信息。

use crate::any::TypeId;
use crate::marker::PointeeSized;
use crate::ptr::DynMetadata;
use crate::{fmt, intrinsics};

/// 编译时类型信息。
#[derive(Debug)]
#[non_exhaustive]
#[lang = "type_kind"]
#[unstable(feature = "type_info", issue = "146922")]
pub enum TypeKind {
    /// 元组。
    Tuple,
    /// 数组。
    Array,
    /// 切片。
    Slice,
    /// 动态 Trait。
    DynTrait,
    /// 结构体。
    Struct,
    /// 枚举。
    Enum,
    /// 联合类型。
    Union,
    /// 基本布尔类型。
    Bool,
    /// 基本字符类型。
    Char,
    /// 基本有符号和无符号整数类型。
    Int,
    /// 基本浮点类型。
    Float,
    /// 字符串切片类型。
    Str,
    /// 引用。
    Reference,
    /// 指针。
    Pointer,
    /// 函数指针。
    FnPtr,
    /// 永远不存在的类型。
    Never,
    /// FIXME(#146922): 添加所有常见类型
    /// 非穷尽列表
    Other,
}

/// Trait 实现的信息，可通过 [Self::get_vtable] 获取 vtable。
#[derive(Debug, PartialEq, Eq)]
#[unstable(feature = "type_info", issue = "146922")]
pub struct TraitImpl<T: PointeeSized> {
    pub(crate) vtable: DynMetadata<T>,
}

impl<T: PointeeSized> TraitImpl<T> {
    /// 获取用于类型反射映射的原始 vtable。
    pub const fn get_vtable(&self) -> DynMetadata<T> {
        self.vtable
    }
}

impl TypeId {
    /// 计算具体类型的类型信息。
    /// 该函数在编译时才能调用。
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn info(self) -> TypeKind {
        intrinsics::reflection::type_id_type_of(self)
    }
}

impl TypeKind {
    /// 返回泛型类型参数的类型信息。
    ///
    /// Note: Unlike `TypeId`s obtained via `TypeId::of`, the `Type`
    /// struct and its fields contain `TypeId`s that are not necessarily
    /// derived from types that outlive `'static`. This means that using
    /// the `TypeId`s (transitively) obtained from this function will
    /// be able to break invariants that other `TypeId` consuming crates
    /// may have assumed to hold.
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    pub const fn of<T: ?Sized>() -> Self {
        const { intrinsics::reflection::type_id::<T>().info() }
    }
}

// FIXME(reflection): get rid of the static lifetime bound on TypeId and remove this function.
/// 返回泛型类型参数的 [TypeId]。
///
/// 这与 [TypeId::of] 相同，但没有静态生命周期限制。未来将移除此功能。
/// 未来会移除。
#[must_use]
#[unstable(feature = "type_info", issue = "146922")]
#[rustc_const_unstable(feature = "type_info", issue = "146922")]
pub const fn of<T: ?Sized>() -> TypeId {
    const { intrinsics::reflection::type_id::<T>() }
}

/// 动态 Trait 的编译时类型信息。
/// FIXME(#146922): 添加超级 Trait 和泛型。
#[derive(Debug)]
#[non_exhaustive]
#[lang = "DynTrait"]
#[unstable(feature = "type_info", issue = "146922")]
pub struct DynTrait {
    /// 动态 Trait 的谓词。
    pub predicates: &'static [DynTraitPredicate],
}

/// 动态 Trait 谓词的编译时类型信息。
#[derive(Debug)]
#[non_exhaustive]
#[unstable(feature = "type_info", issue = "146922")]
pub struct DynTraitPredicate {
    /// 作为动态 Trait 类型的 Trait 类型。
    pub trait_ty: Trait,
}

/// Trait 的编译时类型信息。
#[derive(Debug)]
#[non_exhaustive]
#[unstable(feature = "type_info", issue = "146922")]
pub struct Trait {
    /// 作为动态类型的 Trait 的 TypeId。
    pub ty: TypeId,
    /// 该 Trait 是否为自动 Trait。
    pub is_auto: bool,
}

/// 结构体、枚举和联合变体的实例化泛型的编译时类型信息。
#[derive(Debug)]
#[non_exhaustive]
#[unstable(feature = "type_info", issue = "146922")]
#[lang = "type_info_generic"]
pub enum Generic {
    /// 生命周期。
    Lifetime(Lifetime),
    /// 类型。
    Type(GenericType),
    /// 常量参数。
    Const(Const),
}

/// 泛型生命周期的编译时类型信息。
#[derive(Debug)]
#[non_exhaustive]
#[unstable(feature = "type_info", issue = "146922")]
pub struct Lifetime {
    // No additional information to provide for now.
}

/// 实例化泛型类型的编译时类型信息。
#[derive(Debug)]
#[non_exhaustive]
#[unstable(feature = "type_info", issue = "146922")]
pub struct GenericType {
    /// 类型本身。
    pub ty: TypeId,
}

/// 泛型常量参数的编译时类型信息。
#[derive(Debug)]
#[non_exhaustive]
#[unstable(feature = "type_info", issue = "146922")]
pub struct Const {
    /// 常量的类型。
    pub ty: TypeId,
}

/// 字符串切片类型的编译时类型信息。
#[derive(Debug)]
#[non_exhaustive]
#[unstable(feature = "type_info", issue = "146922")]
pub struct Str {
    // No additional information to provide for now.
}

#[derive(Debug)]
#[lang = "FnPtr"]
#[unstable(feature = "type_info", issue = "146922")]
/// 函数指针，例如 fn(u8),
pub struct FnPtr {
    is_unsafe: bool,
    abi: Abi,
    inputs: &'static [TypeId],
    output: TypeId,
    variadic: bool,
    // FIXME(splat): should these fields be private, or merged into an Option<u8/u16>?
    /// 是否使用了分拆的函数参数？
    is_splatted: bool,

    splatted_index: u8,
}

impl FnPtr {
    /// Returns the splatted function argument index, or `None` if no argument is splatted.
    ///
    /// e.g. in `fn overload(a: u8, #[rustc_splat] b: (f32, usize))` the index is 1,
    /// and it can be called as `overload(a, 1.0, 2)`.
    pub const fn splatted(&self) -> Option<u8> {
        if self.is_splatted { Some(self.splatted_index) } else { None }
    }
    /// 该函数是否为可变参数，例如 extern "C" fn add(n: usize, mut args: ...);
    pub const fn is_variadic(&self) -> bool {
        self.variadic
    }
    /// 是否表示一个 unsafe 函数。
    pub const fn is_unsafe(&self) -> bool {
        self.is_unsafe
    }
    /// 返回应用程序二进制接口。例如 extern "C"。
    pub const fn abi(&self) -> Abi {
        self.abi
    }
    /// 函数参数的类型
    pub const fn inputs(&self) -> &'static [TypeId] {
        self.inputs
    }
    /// 函数返回的变量类型列表。对于没有输出的函数
    /// specified this returns `TypeId::of<()>`.
    pub const fn output(&self) -> TypeId {
        self.output
    }
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Eq)]
#[non_exhaustive]
#[unstable(feature = "type_info", issue = "146922")]
/// [FnPtr] 的 Abi
pub enum Abi {
    /// 命名的 Abi，例如 extern "custom"、"stdcall" 等。
    Named(&'static str),

    /// 默认
    #[default]
    ExternRust,

    /// C 调用约定
    ExternC,
}

impl TypeId {
    /// Returns `true` if the type represented by this `TypeId` is an signed integer.
    ///
    /// 对于其他情况，返回 false。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// assert_eq!(const { TypeId::of::<i32>().is_signed() }, true);
    /// assert_eq!(const { TypeId::of::<u8>().is_signed() }, false);
    /// assert_eq!(const { TypeId::of::<bool>().is_signed() }, false);
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn is_signed(self) -> bool {
        intrinsics::reflection::type_id_is_signed(self)
    }

    /// When called on a `TypeId` representing an array or slice this returns the type of each
    /// element otherwise this returns `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// assert_eq!(const { TypeId::of::<[u32; 16]>().element_ty() }, Some(TypeId::of::<u32>()));
    /// assert_eq!(const { TypeId::of::<u8>().element_ty() }, None); // not an array or slice
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn element_ty(self) -> Option<TypeId> {
        intrinsics::reflection::type_id_element_ty(self)
    }

    /// Given a `TypeId` that represents a dyn trait returns an
    /// [`DynTrait`]. When called on something else this returns `None`.
    ///
    /// # 示例
    ///
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    /// use std::fmt::Debug;
    ///
    /// #[derive(Debug)]
    /// struct A;
    ///
    /// const {
    ///     let dyn_id = TypeId::of::<dyn Debug + Send>();
    ///     let predicates = dyn_id.dyn_trait().unwrap().predicates;
    ///
    ///     let debug_ty = predicates[0].trait_ty.ty;
    ///     let send_ty = predicates[1].trait_ty.ty;
    ///
    ///     let type_id = TypeId::of::<A>();
    ///
    ///     assert!(type_id.trait_info_of_trait_type_id(debug_ty).is_some());
    ///     assert!(type_id.trait_info_of_trait_type_id(send_ty).is_none());
    /// }
    /// ```
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn dyn_trait(self) -> Option<DynTrait> {
        intrinsics::reflection::type_id_dyn_trait(self)
    }

    /// When called on a `TypeId` representing an array this returns the length of the array in
    /// 在所有其他情况下，返回零。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// assert_eq!(const { TypeId::of::<[u32; 16]>().array_len() }, 16);
    /// assert_eq!(const { TypeId::of::<u8>().array_len() }, 0); // not an array
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn array_len(self) -> usize {
        intrinsics::reflection::type_id_array_len(self)
    }

    /// Returns the size of the type represented by this `TypeId`. `None` if it is unsized.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// assert_eq!(const { TypeId::of::<u32>().size() }, Some(4));
    /// assert_eq!(const { TypeId::of::<[u8; 16]>().size() }, Some(16));
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn size(self) -> Option<usize> {
        intrinsics::reflection::type_id_size_of(self)
    }

    /// Returns the number of variants of the type represented by this `TypeId`.
    ///
    /// 对于枚举，这是变体数量。对于结构体和联合，总是 1。
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// assert_eq!(const { TypeId::of::<Option<()>>().variants() }, 2);
    ///
    /// struct Unit;
    /// struct Point {
    ///     x: u32,
    ///     y: u32,
    /// }
    /// assert_eq!(const { TypeId::of::<Unit>().variants() }, 1);
    /// assert_eq!(const { TypeId::of::<Point>().variants() }, 1);
    /// assert_eq!(const { TypeId::of::<(f32, f32)>().variants() }, 1);
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn variants(self) -> usize {
        intrinsics::reflection::type_id_variants(self)
    }

    // FIXME(reflection): make the errors nicer. This is a wider problem,
    // TypeId::fields has nice errors in the docs but those are not the ones shown
    // by rustc.
    /// Returns the variant representing type at the given index of the type represented by this `TypeId`. Use it to
    /// 获取枚举变体的名称或检查其是否非穷尽。
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// enum Enum {
    ///     Unit,
    ///     Tuple(u32, u64),
    ///     #[non_exhaustive]
    ///     Struct { x: u32, y: u32, z: String },
    /// }
    /// assert_eq!(const { TypeId::of::<Enum>().variant(1).name() }, "Tuple");
    /// assert_eq!(const { TypeId::of::<Enum>().variant(2).name() }, "Struct");
    ///
    /// assert_eq!(const { TypeId::of::<Enum>().variant(1).non_exhaustive() }, false);
    /// assert_eq!(const { TypeId::of::<Enum>().variant(2).non_exhaustive() }, true);
    /// ```
    ///
    /// 变体索引指的是类型中变体的源顺序索引。
    ///
    /// Variant indexes are always `0..variant_count`, regardless of any custom discriminants that may have been defined.
    ///
    /// ```
    /// enum Enum {
    ///     Foo,  // variant index == 0
    ///     Bar,  // variant index == 1
    /// }
    /// ```
    ///
    /// 对结构体中的 TypeId 调用变体将被视为编译时错误。对于枚举的越界索引也是如此。
    /// 对于枚举的越界索引同样视为编译时错误。
    ///
    /// ```compile_fail,E0080
    /// # #![feature(type_info)]
    /// # use std::any::TypeId;
    /// #
    /// # struct Point {
    /// #     x: u32,
    /// #     y: u32,
    /// # }
    /// # enum Enum {
    /// #     Unit,
    /// #     Tuple(u32, u64),
    /// #     Struct { x: u32, y: u32, z: String },
    /// # }
    /// const {
    ///     _ = TypeId::of::<Point>().variant(0); // error: cannot get the variant of a struct
    ///     _ = TypeId::of::<Enum>().variant(10); // error: indexing out of bounds: the len is 3 but the index is 10
    /// }
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn variant(self, variant_index: usize) -> VariantId {
        intrinsics::reflection::type_id_fields(self, variant_index);
        VariantId { base: self, variant: variant_index }
    }

    /// Returns the number of fields at the given `variant_index` of the type represented by this `TypeId`.
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// assert_eq!(const { TypeId::of::<u32>().fields(0) }, 0);
    ///
    /// struct Point {
    ///     x: u32,
    ///     y: u32,
    /// }
    /// assert_eq!(const { TypeId::of::<Point>().fields(0) }, 2);
    ///
    /// enum Enum {
    ///     Unit,
    ///     Tuple(u32, u64),
    ///     Struct { x: u32, y: u32, z: String },
    /// }
    /// assert_eq!(const { TypeId::of::<Enum>().fields(0) }, 0);
    /// assert_eq!(const { TypeId::of::<Enum>().fields(1) }, 2);
    /// assert_eq!(const { TypeId::of::<Enum>().fields(2) }, 3);
    /// ```
    ///
    /// 变体索引指的是类型中变体的源顺序索引。
    ///
    /// For enums, these are always `0..variant_count`, regardless of any custom discriminants that may have been defined.
    /// `struct`s, `tuples`, and `unions`s are considered to have a single variant with variant index zero.
    ///
    /// ```
    /// enum Number {
    ///     Seven = 7, // variant index == 0
    ///     Six = 6,   // variant index == 1
    /// }
    /// ```
    ///
    /// 越界索引将被视为编译时错误。
    ///
    /// ```compile_fail,E0080
    /// # #![feature(type_info)]
    /// # use std::any::TypeId;
    /// #
    /// # struct Point {
    /// #     x: u32,
    /// #     y: u32,
    /// # }
    /// # enum Enum {
    /// #     Unit,
    /// #     Tuple(u32, u64),
    /// #     Struct { x: u32, y: u32, z: String },
    /// # }
    /// const {
    ///     _ = TypeId::of::<Point>().fields(10); // error: indexing out of bounds: the len is 2 but the index is 10
    ///     _ = TypeId::of::<Enum>().fields(10); // error: indexing out of bounds: the len is 3 but the index is 10
    /// }
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    // FIXME(type_info): Add enum variant pattern types and use them to represent individual variants
    // Then add a `variant` method to get a wrapper around such a pattern type (similar to the FRT
    // type we have) and add methods on that. It's the only way to really sensibly represent
    // things like `non_exhaustive` which can be applied to variants as well.
    pub fn fields(self, variant_index: usize) -> usize {
        intrinsics::reflection::type_id_fields(self, variant_index)
    }

    /// Returns the field representing type at the given index of the type represented by this `TypeId`.
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// struct Point {
    ///     x: u32,
    ///     y: u32,
    /// }
    /// assert_eq!(const { TypeId::of::<Point>().field(0, 0).type_id() }, TypeId::of::<u32>());
    /// assert_eq!(const { TypeId::of::<Point>().field(0, 1).type_id() }, TypeId::of::<u32>());
    ///
    /// enum Enum {
    ///     Unit,
    ///     Tuple(u32, u64),
    ///     Struct { x: u32, y: u32, z: String },
    /// }
    /// assert_eq!(const { TypeId::of::<Enum>().field(1, 0).type_id() }, TypeId::of::<u32>());
    /// assert_eq!(const { TypeId::of::<Enum>().field(2, 2).type_id() }, TypeId::of::<String>());
    /// ```
    ///
    /// 变体索引和字段索引指的是类型中变体的源顺序索引。
    /// 分别是变体中字段的源顺序索引。
    ///
    /// For enums, variant indexes are always `0..variant_count`, regardless of any custom discriminants that may have been defined.
    /// `struct`s, `tuples`, and `unions`s are considered to have a single variant with variant index zero.
    ///
    /// As for field indexes, they may not be the same as the layout order for `repr(Rust)` types, but they are for `repr(C)` types.
    ///
    /// ```
    /// enum Enum {
    ///     Foo,  // variant index == 0
    ///     Bar { // variant index == 1
    ///         a: (), // field index == 0 in `Bar`
    ///         b: (), // field index == 1 in `Bar`
    ///     }
    /// }
    /// ```
    ///
    /// 越界索引将被视为编译时错误。
    ///
    /// ```compile_fail,E0080
    /// # #![feature(type_info)]
    /// # use std::any::TypeId;
    /// #
    /// # struct Point {
    /// #     x: u32,
    /// #     y: u32,
    /// # }
    /// # enum Enum {
    /// #     Unit,
    /// #     Tuple(u32, u64),
    /// #     Struct { x: u32, y: u32, z: String },
    /// # }
    /// const {
    ///     _ = TypeId::of::<Point>().field(0, 10); // error: indexing out of bounds: the len is 2 but the index is 10
    ///     _ = TypeId::of::<Enum>().field(2, 10); // error: indexing out of bounds: the len is 3 but the index is 10
    /// }
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn field(self, variant_index: usize, field_index: usize) -> FieldId {
        FieldId {
            frt_type_id: intrinsics::reflection::type_id_field_representing_type(
                self,
                variant_index,
                field_index,
            ),
        }
    }

    /// Returns whether a type is marked with `#[non_exhaustive]`.
    /// Returns `false` for everything but adts.
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn non_exhaustive(self) -> bool {
        intrinsics::reflection::type_id_non_exhaustive(self)
    }

    /// 返回该类型的泛型参数列表。
    /// 对于没有泛型的类型，返回空切片。
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn generics(self) -> &'static [Generic] {
        intrinsics::reflection::type_id_generics(self)
    }

    /// Given a `TypeId` that represents a pointer this returns the `TypeId`
    /// 当用于其他对象时，它返回
    /// 无。
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// assert_eq!(
    ///     const { TypeId::of::<&i32>().points_to() },
    ///     const { Some(TypeId::of::<i32>()) },
    /// );
    ///
    /// assert_eq!(
    ///     const { TypeId::of::<*const i32>().points_to() },
    ///     const { Some(TypeId::of::<i32>()) },
    /// );
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn points_to(self) -> Option<TypeId> {
        intrinsics::reflection::type_id_points_to(self)
    }

    /// Given a `TypeId` that represents a pointer returns whether that pointer is mutable.
    /// When called on anything else this returns `false`.
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// assert!(const { TypeId::of::<&mut i32>().points_mutably() });
    /// assert!(const { !TypeId::of::<&i32>().points_mutably() });
    ///
    /// assert!(!const { TypeId::of::<*const i32>().points_mutably() });
    /// assert!(const { TypeId::of::<*mut i32>().points_mutably() });
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn points_mutably(self) -> bool {
        intrinsics::reflection::type_id_points_mutably(self)
    }

    /// Given a `TypeId` that represents a function pointer returns an
    /// [`FnPtr`]. When called on something else this returns `None`.
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    /// use std::mem::type_info::{Abi, FnPtr};
    ///
    /// const F: FnPtr = TypeId::of::<fn(u8, u16) -> usize>()
    ///     .function_ptr()
    ///     .expect("TypeId of a function ptr");
    ///
    /// assert!(F.inputs() == [TypeId::of::<u8>(), TypeId::of::<u16>()]);
    /// assert!(F.output() == TypeId::of::<usize>());
    /// assert!(F.abi() == Abi::default());
    /// ```
    /// ```
    /// #![feature(type_info)]
    /// # use std::any::TypeId;
    /// # use std::mem::type_info::{Abi, FnPtr};
    /// #
    /// const F: FnPtr = TypeId::of::<unsafe fn()>()
    ///     .function_ptr()
    ///     .expect("TypeId of a function ptr");
    ///
    /// assert!(F.inputs() == []);
    /// assert!(F.output() == TypeId::of::<()>());
    /// assert!(F.abi() == Abi::default());
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn function_ptr(self) -> Option<FnPtr> {
        intrinsics::reflection::type_id_function_ptr(self)
    }

    /// Given given a `TypeId`, which represents a structure, enum or union returns a list of attributes.
    /// Only the attributes of tools marked as `reflect` are returned, all other attributes are excluded.
    /// 属性以字符串形式呈现。
    ///
    /// ```
    /// #![feature(type_info)]
    /// #![feature(register_tool)]
    /// #![register_tool(foo(reflect))]
    /// # use std::any::TypeId;
    ///
    /// #[foo::a(1, false)]
    /// #[foo::bar=123]
    /// struct A;
    ///
    /// assert_eq!(const { TypeId::of::<A>().reflected_attrs() }, ["#[foo::a(1, false)]", "#[foo::bar = 123]"]);
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn reflected_attrs(self) -> &'static [&'static str] {
        intrinsics::reflection::type_id_reflected_attrs(self)
    }

    /// Returns the raw documentation attributes when given a `TypeId` which represents a structure, enumeration or union.
    /// ```
    /// #![feature(type_info)]
    /// # use std::any::TypeId;
    ///
    /// #[doc = "first"]
    /// /** second
    /// *  third
    /// */
    /// struct A;
    ///
    /// assert_eq!(const { TypeId::of::<A>().docs() }, ["first", " second\n*  third\n"]);
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn docs(self) -> &'static [&'static str] {
        intrinsics::reflection::type_id_docs(self)
    }
}

/// 表示类型 ID 的变体。表示枚举的变体。
#[derive(Copy, PartialOrd, Ord, Hash)]
#[derive_const(Clone, PartialEq, Eq)]
#[unstable(feature = "type_info", issue = "146922")]
pub struct VariantId {
    base: TypeId,
    variant: usize,
}

#[unstable(feature = "type_info", issue = "146922")]
impl fmt::Debug for VariantId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Variant({:#034x}-{})", self.base.as_u128(), self.variant)
    }
}

impl VariantId {
    /// 返回变体的名称。
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// enum Enum {
    ///     Unit,
    ///     Tuple(bool),
    ///     Struct { a: bool },
    /// }
    /// assert_eq!(
    ///     const { TypeId::of::<Enum>().variant(1).name() },
    ///     "Tuple",
    /// );
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn name(self) -> &'static str {
        intrinsics::reflection::type_id_variant_name(self.base, self.variant)
    }

    /// Returns the raw documentation attributes when given a `VariantId`.
    /// ```
    /// #![feature(type_info)]
    /// # use std::any::TypeId;
    ///
    /// enum A {
    ///     #[doc = "first"]
    ///     /** second
    ///      * third*/
    ///     B,
    ///     C,
    /// }
    ///
    /// assert_eq!(const { TypeId::of::<A>().variant(0).docs() }, ["first", " second\n     * third"]);
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn docs(self) -> &'static [&'static str] {
        intrinsics::reflection::type_id_variant_docs(self.base, self.variant)
    }

    /// Returns whether this variant is marked with `#[non_exhaustive]`.
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn non_exhaustive(self) -> bool {
        intrinsics::reflection::type_id_variant_non_exhaustive(self.base, self.variant)
    }

    /// Given given a `VariantId` returns a list of attributes.
    /// Only the attributes of tools marked as `reflect` are returned, all other attributes are excluded.
    /// 属性以字符串形式呈现。
    ///
    /// ```
    /// #![feature(type_info)]
    /// #![feature(register_tool)]
    /// #![register_tool(foo(reflect))]
    /// # use std::any::TypeId;
    ///
    /// enum A {
    ///     #[foo::a(1, false)]
    ///     #[foo::bar=123]
    ///     VarA,
    ///     VarB,
    /// }
    ///
    /// assert_eq!(const { TypeId::of::<A>().variant(0).reflected_attrs() }, &["#[foo::a(1, false)]", "#[foo::bar = 123]"]);
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn reflected_attrs(self) -> &'static [&'static str] {
        intrinsics::reflection::type_id_variant_reflected_attrs(self.base, self.variant)
    }
}

/// 表示类型 ID 的字段。表示结构体、元组或枚举变体的字段。
#[derive(Copy, PartialOrd, Ord, Hash)]
#[derive_const(Clone, PartialEq, Eq)]
#[unstable(feature = "type_info", issue = "146922")]
pub struct FieldId {
    frt_type_id: TypeId,
}

#[unstable(feature = "type_info", issue = "146922")]
impl fmt::Debug for FieldId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "FieldId({:#034x})", self.frt_type_id.as_u128())
    }
}

impl FieldId {
    /// Returns the `TypeId` of the actual field type.
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// struct Point {
    ///     x: u32,
    ///     y: u32,
    /// }
    /// assert_eq!(
    ///     const { TypeId::of::<Point>().field(0, 0).type_id() },
    ///     TypeId::of::<u32>()
    /// );
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn type_id(self) -> TypeId {
        intrinsics::field_representing_type_actual_type_id(self.frt_type_id)
    }

    /// 返回字段的名称。
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// struct Point {
    ///     x: u32,
    ///     y: u32,
    /// }
    /// assert_eq!(
    ///     const { TypeId::of::<Point>().field(0, 0).name() },
    ///     "x",
    /// );
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn name(self) -> &'static str {
        intrinsics::field_representing_type_name(self.frt_type_id)
    }

    /// Returns the raw documentation attributes when given a `FieldId`.
    /// ```
    /// #![feature(type_info)]
    /// # use std::any::TypeId;
    ///
    /// struct A {
    ///     #[doc = "first"]
    ///     /// second
    ///     first: u8,
    /// }
    ///
    /// assert_eq!(const { TypeId::of::<A>().field(0, 0).docs() }, ["first", " second"]);
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn docs(self) -> &'static [&'static str] {
        intrinsics::reflection::type_id_docs(self.frt_type_id)
    }

    /// 返回字段相对于其包含类型的偏移量。
    ///
    /// ```
    /// #![feature(type_info)]
    /// use std::any::TypeId;
    ///
    /// #[repr(C)]
    /// struct Point {
    ///     x: u32,
    ///     y: u32,
    /// }
    /// assert_eq!(
    ///     const { TypeId::of::<Point>().field(0, 1).offset() },
    ///     4,
    /// );
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn offset(self) -> usize {
        intrinsics::field_representing_type_offset(self.frt_type_id)
    }

    /// Given given a `FieldId` returns a list of attributes.
    /// Only the attributes of tools marked as `reflect` are returned, all other attributes are excluded.
    /// 属性以字符串形式呈现。
    ///
    /// ```
    /// #![feature(type_info)]
    /// #![feature(register_tool)]
    /// #![register_tool(foo(reflect))]
    /// # use std::any::TypeId;
    ///
    /// struct A {
    ///     #[foo::a(1, false)]
    ///     #[foo::bar=123]
    ///     first: u8,
    /// }
    ///
    /// assert_eq!(const { TypeId::of::<A>().field(0, 0).reflected_attrs() }, &["#[foo::a(1, false)]", "#[foo::bar = 123]"]);
    /// ```
    #[unstable(feature = "type_info", issue = "146922")]
    #[rustc_const_unstable(feature = "type_info", issue = "146922")]
    #[rustc_comptime]
    pub fn reflected_attrs(self) -> &'static [&'static str] {
        intrinsics::reflection::type_id_reflected_attrs(self.frt_type_id)
    }
}
