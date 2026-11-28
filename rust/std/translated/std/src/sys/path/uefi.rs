#![forbid(unsafe_op_in_unsafe_fn)]
use crate::ffi::OsStr;
use crate::io;
use crate::path::{Path, PathBuf, Prefix};
use crate::sys::pal::helpers;
use crate::sys::unsupported_err;

path_separator_bytes!(b'\\');

const FORWARD_SLASH: u8 = b'/';
const COLON: u8 = b':';

#[inline]
pub const fn is_verbatim_sep(b: u8) -> bool {
    is_sep_byte(b)
}

pub fn parse_prefix(_: &OsStr) -> Option<Prefix<'_>> {
    None
}

pub const HAS_PREFIXES: bool = true;

/// UEFI 路径可以是 4 种类型：
///
/// 1. Absolute Shell Path: Uses shell mappings (eg: `FS0:`). Does not exist if UEFI shell not present.
///    It can be identified with `:`.
/// 例如：FS0:\abc\run.efi
///
/// 2. 绝对设备路径：这是我们想要的格式。
///    It can be identified with `/`.
/// 例如：PciRoot(0x0)/Pci(0x1,0x1)/Ata(Secondary,Slave,0x0)/\abc\run.efi
///
/// 3. 相对根路径：相对于当前卷的路径。
///    It will start with `\`.
/// 例如：\abc\run.efi
///
/// 4. 相对路径
/// 例如：run.efi
///
/// 该算法主要来源于 edk2 UEFI shell 实现，相当简单。
/// 只需按顺序检查路径类型即可。
///
/// The volume mapping in Absolute Shell Path (not the rest of the path) can be converted to Device
/// Path Protocol using `EFI_SHELL->GetDevicePathFromMap`. The rest of the path (Relative root
/// 对于相对根路径，我们从当前卷获取路径（通过 Shell 映射或设备路径协议形式），然后将其与相对根路径合并。接着递归调用函数以解析存在的 Shell 映射。
///
/// 对于相对路径，我们使用当前工作目录构建新路径，并递归调用函数以解析存在的 Shell 映射。
/// 最后，我们得到第二种形式，即绝对设备路径，可用于常规 UEFI API，如文件、进程等。
/// 例如：PciRoot(0x0)/Pci(0x1,0x1)/Ata(Secondary,Slave,0x0)/\abc\run.efi
///
/// For Relative paths, we use the current working directory to construct
/// the new path and recurse the function to resolve the Shell mapping if present.
///
/// Finally, at the end, we get the 2nd form, i.e. Absolute Device Path, which can be used in the
/// normal UEFI APIs such as file, process, etc.
/// Eg: PciRoot(0x0)/Pci(0x1,0x1)/Ata(Secondary,Slave,0x0)/\abc\run.efi
pub(crate) fn absolute(path: &Path) -> io::Result<PathBuf> {
    // Absolute Shell Path
    if path.as_os_str().as_encoded_bytes().contains(&COLON) {
        let mut path_components = path.components();
        // Since path is not empty, it has at least one Component
        let prefix = path_components.next().unwrap();

        let dev_path = helpers::get_device_path_from_map(prefix.as_ref())?;
        let mut dev_path_text = dev_path.to_text().map_err(|_| unsupported_err())?;

        // UEFI Shell does not seem to end device path with `/`
        if *dev_path_text.as_encoded_bytes().last().unwrap() != FORWARD_SLASH {
            dev_path_text.push("/");
        }

        let mut ans = PathBuf::from(dev_path_text);
        ans.push(path_components);

        return Ok(ans);
    }

    // Absolute Device Path
    if path.as_os_str().as_encoded_bytes().contains(&FORWARD_SLASH) {
        return Ok(path.to_path_buf());
    }

    // cur_dir() always returns something
    let cur_dir = crate::env::current_dir().unwrap();
    let mut path_components = path.components();

    // Relative Root
    if path_components.next().unwrap() == crate::path::Component::RootDir {
        let mut ans = PathBuf::new();
        ans.push(cur_dir.components().next().unwrap());
        ans.push(path_components);
        return absolute(&ans);
    }

    absolute(&cur_dir.join(path))
}

pub(crate) fn is_absolute(path: &Path) -> bool {
    let temp = path.as_os_str().as_encoded_bytes();
    temp.contains(&COLON) || temp.contains(&FORWARD_SLASH)
}
