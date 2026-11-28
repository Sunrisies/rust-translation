// implements the unary operator "op &T"
// based on "op T" where T is expected to be `Copy`able
macro_rules! forward_ref_unop {
    (impl $imp:ident, $method:ident for $t:ty, $(#[$attr:meta])+) => {
        $(#[$attr])+
        const impl $imp for &$t {
            type Output = <$t as $imp>::Output;

            #[inline]
            fn $method(self) -> <$t as $imp>::Output {
                $imp::$method(*self)
            }
        }
    }
}

// implements binary operators "&T op U", "T op &U", "&T op &U"
// based on "T op U" where T and U are expected to be `Copy`able
macro_rules! forward_ref_binop {
    (impl $imp:ident, $method:ident for $t:ty, $u:ty, $(#[$attr:meta])+) => {
        $(#[$attr])+
        const impl $imp<$u> for &$t {
            type Output = <$t as $imp<$u>>::Output;

            #[inline]
            #[track_caller]
            fn $method(self, other: $u) -> <$t as $imp<$u>>::Output {
                $imp::$method(*self, other)
            }
        }

        $(#[$attr])+
        const impl $imp<&$u> for $t {
            type Output = <$t as $imp<$u>>::Output;

            #[inline]
            #[track_caller]
            fn $method(self, other: &$u) -> <$t as $imp<$u>>::Output {
                $imp::$method(self, *other)
            }
        }

        $(#[$attr])+
        const impl $imp<&$u> for &$t {
            type Output = <$t as $imp<$u>>::Output;

            #[inline]
            #[track_caller]
            fn $method(self, other: &$u) -> <$t as $imp<$u>>::Output {
                $imp::$method(*self, *other)
            }
        }
    }
}

// implements "T op= &U", based on "T op= U"
// where U is expected to be `Copy`able
macro_rules! forward_ref_op_assign {
    (impl $imp:ident, $method:ident for $t:ty, $u:ty, $(#[$attr:meta])+) => {
        $(#[$attr])+
        const impl $imp<&$u> for $t {
            #[inline]
            #[track_caller]
            fn $method(&mut self, other: &$u) {
                $imp::$method(self, *other);
            }
        }
    }
}

/// 创建一个与闭包类型类似但具有名称的零大小类型。
macro_rules! impl_fn_for_zst {
    ($(
        $( #[$attr: meta] )*
        $vis:vis struct $Name: ident impl$( <$( $lifetime : lifetime ),+> )? Fn =
            |$( $arg: ident: $ArgTy: ty ),*| -> $ReturnTy: ty
            $body: block;
    )+) => {
        $(
            $( #[$attr] )*
            $vis struct $Name;

            impl $( <$( $lifetime ),+> )? Fn<($( $ArgTy, )*)> for $Name {
                #[inline]
                extern "rust-call" fn call(&self, ($( $arg, )*): ($( $ArgTy, )*)) -> $ReturnTy {
                    $body
                }
            }

            impl $( <$( $lifetime ),+> )? FnMut<($( $ArgTy, )*)> for $Name {
                #[inline]
                extern "rust-call" fn call_mut(
                    &mut self,
                    ($( $arg, )*): ($( $ArgTy, )*)
                ) -> $ReturnTy {
                    Fn::call(&*self, ($( $arg, )*))
                }
            }

            impl $( <$( $lifetime ),+> )? FnOnce<($( $ArgTy, )*)> for $Name {
                type Output = $ReturnTy;

                #[inline]
                extern "rust-call" fn call_once(self, ($( $arg, )*): ($( $ArgTy, )*)) -> $ReturnTy {
                    Fn::call(&self, ($( $arg, )*))
                }
            }
        )+
    }
}

/// 永久不稳定。仅用于内部 rustc 测试。请勿使用。
#[rustc_builtin_macro(test_binder_constraints)]
#[unstable(feature = "test_binder_constraints", issue = "none")]
#[macro_export]
macro_rules! test_binder_constraints {
    ($($arg:tt)*) => {
        /* compiler built-in */
    };
}
