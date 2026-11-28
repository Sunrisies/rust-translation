//! 使用 Zircon 内核进行随机数据生成。
//!
//! Fuchsia 一如既往地非常出色，提供了我们所需的确切 API：
//! <https://fuchsia.dev/reference/syscalls/cprng_draw>.

#[link(name = "zircon")]
unsafe extern "C" {
    fn zx_cprng_draw(buffer: *mut u8, len: usize);
}

pub fn fill_bytes(bytes: &mut [u8]) {
    unsafe { zx_cprng_draw(bytes.as_mut_ptr(), bytes.len()) }
}
