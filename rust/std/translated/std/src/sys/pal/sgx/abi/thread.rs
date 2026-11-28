use fortanix_sgx_abi::Tcs;

/// 获取当前线程的 ID。该 ID 在
/// enclave 中所有正在运行的线程之间是唯一的，并且保证在
/// 线程的生命周期内保持不变。更具体地说，对于 SGX，ID 与 TCS 地址之间存在一一对应关系。
/// is a one-to-one correspondence of the ID to the address of the TCS.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub fn current() -> Tcs {
    unsafe extern "C" {
        fn get_tcs_addr() -> *mut u8;
    }
    let addr = unsafe { get_tcs_addr() };
    match Tcs::new(addr) {
        Some(tcs) => tcs,
        None => rtabort!("TCS must not be placed at address zero (this is a linker error)"),
    }
}
