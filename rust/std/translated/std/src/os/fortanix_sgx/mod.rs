//! Functionality specific to the `x86_64-fortanix-unknown-sgx` target.
//!
//! 包括处理内存隔离、用户调用以及
//! SGX 指令集的相关函数。

#![deny(missing_docs)]
#![unstable(feature = "sgx_platform", issue = "56975")]

/// 通往用户调用的低级接口。更多
/// 信息请参见 [ABI 文档]。
///
/// [ABI documentation]: https://docs.rs/fortanix-sgx-abi/
pub mod usercalls {
    pub use crate::sys::abi::usercalls::*;

    /// 用于在用户空间分配内存以及复制数据的
    /// 数据在用户内存间传输的 primitives。
    pub mod alloc {
        pub use crate::sys::abi::usercalls::alloc::*;
    }

    /// 通往用户调用的低级接口及用户调用 ABI 类型定义。
    pub mod raw {
        pub use crate::sys::abi::usercalls::raw::{
            ByteBuffer, Cancel, EV_RETURNQ_NOT_EMPTY, EV_UNPARK, EV_USERCALLQ_NOT_FULL, Error,
            FD_STDERR, FD_STDIN, FD_STDOUT, Fd, FifoDescriptor, RESULT_SUCCESS, Register,
            RegisterArgument, Result, Return, ReturnValue, Tcs, USERCALL_USER_DEFINED, Usercall,
            Usercalls as UsercallNrs, WAIT_INDEFINITE, WAIT_NO, accept_stream, alloc, async_queues,
            bind_stream, close, connect_stream, do_usercall, exit, flush, free, insecure_time,
            launch_thread, read, read_alloc, send, wait, write,
        };
    }
}

/// 用于查询指针映射信息的函数。
pub mod mem {
    pub use crate::sys::abi::mem::*;
}

pub mod arch;
pub mod ffi;
pub mod io;

/// 用于查询线程相关信息的函数。
pub mod thread {
    pub use crate::sys::abi::thread::current;
}
