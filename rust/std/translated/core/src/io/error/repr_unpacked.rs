//! 这是一种相当简单的解包错误表示方式，用于
//! 非 64 位目标平台，因为打包的 64 位表示形式在此无法使用，且
//! 也不会带来任何好处。

use super::{Custom, CustomOwner, ErrorData, ErrorKind, RawOsError, SimpleMessage};

type Inner = ErrorData<CustomOwner>;

pub(super) struct Repr(Inner);

impl Repr {
    #[inline]
    pub(super) fn new_custom(b: CustomOwner) -> Self {
        Self(Inner::Custom(b))
    }
    #[inline]
    pub(super) fn new_os(code: RawOsError) -> Self {
        Self(Inner::Os(code))
    }
    #[inline]
    pub(super) fn new_simple(kind: ErrorKind) -> Self {
        Self(Inner::Simple(kind))
    }
    #[inline]
    pub(super) const fn new_simple_message(m: &'static SimpleMessage) -> Self {
        Self(Inner::SimpleMessage(m))
    }
    #[inline]
    pub(super) fn into_data(self) -> ErrorData<CustomOwner> {
        self.0
    }
    #[inline]
    pub(super) fn data(&self) -> ErrorData<&Custom> {
        match &self.0 {
            Inner::Os(c) => ErrorData::Os(*c),
            Inner::Simple(k) => ErrorData::Simple(*k),
            Inner::SimpleMessage(m) => ErrorData::SimpleMessage(*m),
            Inner::Custom(m) => ErrorData::Custom(m.custom_ref()),
        }
    }
    #[inline]
    pub(super) fn data_mut(&mut self) -> ErrorData<&mut Custom> {
        match &mut self.0 {
            Inner::Os(c) => ErrorData::Os(*c),
            Inner::Simple(k) => ErrorData::Simple(*k),
            Inner::SimpleMessage(m) => ErrorData::SimpleMessage(*m),
            Inner::Custom(m) => ErrorData::Custom(m.custom_mut()),
        }
    }
}
