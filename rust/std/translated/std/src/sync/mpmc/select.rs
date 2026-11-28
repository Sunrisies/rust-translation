/// 在阻塞操作期间初始化的临时数据，随后被消耗掉。
/// `read` or `write`.
///
/// 每个字段包含与特定通道类型相关的数据。
#[derive(Debug, Default)]
pub(crate) struct Token {
    pub(crate) array: super::array::ArrayToken,
    pub(crate) list: super::list::ListToken,
    #[allow(dead_code)]
    pub(crate) zero: super::zero::ZeroToken,
}

/// 特定线程在特定通道上对操作的识别符。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Operation(usize);

impl Operation {
    /// 从可修改引用创建操作识别符。
    ///
    /// 此函数本质上只是将引用的地址转换为数字。
    /// 该引用应指向特定线程和操作专用的变量。
    /// 该引用在阻塞操作的整个持续时间内都有效。
    #[inline]
    pub(crate) fn hook<T>(r: &mut T) -> Operation {
        let val = (r as *mut T).addr();
        // Make sure that the pointer address doesn't equal the numerical representation of
        // `Selected::{Waiting, Aborted, Disconnected}`.
        assert!(val > 2);
        Operation(val)
    }
}

/// 阻塞操作的当前状态。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Selected {
    /// 仍在等待操作完成。
    Waiting,

    /// 尝试阻塞当前线程的操作已中止。
    Aborted,

    /// 由于通道断开，操作变得可执行。
    Disconnected,

    /// 由于可以发送或接收消息，操作变得可执行。
    Operation(Operation),
}

impl From<usize> for Selected {
    #[inline]
    fn from(val: usize) -> Selected {
        match val {
            0 => Selected::Waiting,
            1 => Selected::Aborted,
            2 => Selected::Disconnected,
            oper => Selected::Operation(Operation(oper)),
        }
    }
}

impl Into<usize> for Selected {
    #[inline]
    fn into(self) -> usize {
        match self {
            Selected::Waiting => 0,
            Selected::Aborted => 1,
            Selected::Disconnected => 2,
            Selected::Operation(Operation(val)) => val,
        }
    }
}
