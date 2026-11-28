//! Random data from `/dev/urandom`
//!
//! Before `getentropy` was standardized in 2024, UNIX didn't have a standardized
//! 获取随机数据的方式，因此系统只是遵循了
//! Linux and exposed random devices at `/dev/random` and `/dev/urandom`. Thus,
//! for the few systems that support neither `arc4random_buf` nor `getentropy`
//! 目前，我们仍然只是从文件中读取数据。

use crate::fs::File;
use crate::io::Read;
use crate::sync::OnceLock;

static DEVICE: OnceLock<File> = OnceLock::new();

pub fn fill_bytes(bytes: &mut [u8]) {
    DEVICE
        .get_or_try_init(|| File::open("/dev/urandom"))
        .and_then(|mut dev| dev.read_exact(bytes))
        .expect("failed to generate random data");
}
