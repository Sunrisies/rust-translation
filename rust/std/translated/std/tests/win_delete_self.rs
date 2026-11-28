#![cfg(windows)]

/// 在 Windows 上尝试删除正在运行的二进制文件应会返回错误。
#[test]
#[cfg_attr(skip_unsupported_miri_tests, ignore)] // `remove_file` does not work in Miri on Windows
fn win_delete_self() {
    let path = std::env::current_exe().unwrap();
    assert!(std::fs::remove_file(path).is_err());
}
