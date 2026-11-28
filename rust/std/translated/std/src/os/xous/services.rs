use core::sync::atomic::{Atomic, AtomicU32, Ordering};

use crate::os::xous::ffi::Connection;

mod dns;
pub(crate) use dns::*;

mod log;
pub(crate) use log::*;

mod net;
pub(crate) use net::*;

mod systime;
pub(crate) use systime::*;

mod ticktimer;
pub(crate) use ticktimer::*;

mod ns {
    const NAME_MAX_LENGTH: usize = 64;
    use crate::os::xous::ffi::{Connection, lend_mut};
    // By making this repr(C), the layout of this struct becomes well-defined
    // and no longer shifts around.
    // By marking it as `align(4096)` we define that it will be page-aligned,
    // meaning it can be sent between processes. We make sure to pad out the
    // entire struct so that memory isn't leaked to the name server.
    #[repr(C, align(4096))]
    struct ConnectRequest {
        data: [u8; 4096],
    }

    impl ConnectRequest {
        pub fn new(name: &str) -> Self {
            let mut cr = ConnectRequest { data: [0u8; 4096] };
            let name_bytes = name.as_bytes();

            // Copy the string into our backing store.
            for (&src_byte, dest_byte) in name_bytes.iter().zip(&mut cr.data[0..NAME_MAX_LENGTH]) {
                *dest_byte = src_byte;
            }

            // Set the string length to the length of the passed-in String,
            // or the maximum possible length. Which ever is smaller.
            for (&src_byte, dest_byte) in (name.len().min(NAME_MAX_LENGTH) as u32)
                .to_le_bytes()
                .iter()
                .zip(&mut cr.data[NAME_MAX_LENGTH..])
            {
                *dest_byte = src_byte;
            }
            cr
        }
    }

    pub fn connect_with_name_impl(name: &str, blocking: bool) -> Option<Connection> {
        let mut request = ConnectRequest::new(name);
        let opcode = if blocking {
            6 /* BlockingConnect */
        } else {
            7 /* TryConnect */
        };
        let cid = if blocking { super::name_server() } else { super::try_name_server()? };

        lend_mut(cid, opcode, &mut request.data, 0, name.len().min(NAME_MAX_LENGTH))
            .expect("unable to perform lookup");

        // Read the result code back from the nameserver
        let result = u32::from_le_bytes(request.data[0..4].try_into().unwrap());
        if result == 0 {
            // If the result was successful, then the CID is stored in the next 4 bytes
            Some(u32::from_le_bytes(request.data[4..8].try_into().unwrap()).into())
        } else {
            None
        }
    }

    pub fn connect_with_name(name: &str) -> Option<Connection> {
        connect_with_name_impl(name, true)
    }

    pub fn try_connect_with_name(name: &str) -> Option<Connection> {
        connect_with_name_impl(name, false)
    }
}

/// 尝试按名称连接服务器。如果服务器不存在，这将
/// 阻塞直到服务器被创建。
///
/// 请注意，这与按地址连接服务器不同。服务器
/// 地址总是16字节长，而服务器名称可以是任意长度
/// 字符串，长度可达64字节。
#[stable(feature = "rust1", since = "1.0.0")]
pub fn connect(name: &str) -> Option<Connection> {
    ns::connect_with_name(name)
}

/// 尝试按名称连接服务器。如果服务器不存在，这将
/// immediately return `None`.
///
/// 请注意，这与按地址连接服务器不同。服务器
/// 地址总是16字节长，而服务器名称可以是任意长度
/// 字符串。
#[stable(feature = "rust1", since = "1.0.0")]
pub fn try_connect(name: &str) -> Option<Connection> {
    ns::try_connect_with_name(name)
}

static NAME_SERVER_CONNECTION: Atomic<u32> = AtomicU32::new(0);

/// Returns a `Connection` to the name server. If the name server has not been started,
/// then this call will block until the name server has been started. The `Connection`
/// 将在进程中的所有连接之间共享，因此多次调用此函数
/// 是安全的。
pub(crate) fn name_server() -> Connection {
    let cid = NAME_SERVER_CONNECTION.load(Ordering::Relaxed);
    if cid != 0 {
        return cid.into();
    }

    let cid = crate::os::xous::ffi::connect("xous-name-server".try_into().unwrap()).unwrap();
    NAME_SERVER_CONNECTION.store(cid.into(), Ordering::Relaxed);
    cid
}

fn try_name_server() -> Option<Connection> {
    let cid = NAME_SERVER_CONNECTION.load(Ordering::Relaxed);
    if cid != 0 {
        return Some(cid.into());
    }

    if let Ok(Some(cid)) = crate::os::xous::ffi::try_connect("xous-name-server".try_into().unwrap())
    {
        NAME_SERVER_CONNECTION.store(cid.into(), Ordering::Relaxed);
        Some(cid)
    } else {
        None
    }
}
