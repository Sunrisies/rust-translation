#![doc(hidden)]
#![unstable(feature = "std_internals", issue = "none")]

use core::any::Any;
use core::fmt::Display;

use crate::boxed::Box;

/// An internal trait used by std to pass data from std to `panic_unwind` and
/// 使用此功能会完全拥有内容的所有权。
/// 不要使用此功能。
pub trait PanicPayload: Display {
    /// 完全拥有内容的所有权。
    ///
    /// After this method got called, only some dummy default value is left in `self`.
    /// Calling this method twice, or calling `get` after calling this method, is an error.
    ///
    /// The argument is borrowed because the panic runtime (`__rust_start_panic`) only
    /// gets a borrowed `dyn PanicPayload`.
    fn take_box(&mut self) -> Box<dyn Any + Send>;

    /// 只需借用内容本身。
    fn get(&mut self) -> &(dyn Any + Send);

    /// Tries to borrow the contents as `&str`, if possible without doing any allocations.
    fn as_str(&mut self) -> Option<&str> {
        None
    }
}
