//! std::fs::remove_dir_all 在 Windows 上的实现。
//!
//! 这需要解决两个问题：
//!
//! - 必须不能让程序误删父目录之外的文件（参见 CVE-2022-21658）。
//!   the parent directory (see CVE-2022-21658).
//! - It should not fail if many threads or processes call `remove_dir_all`
//!   on the same path.
//!
//! The first is handled by using the low-level `NtOpenFile` API to open a file
//! 在这两种事件之间的期间，文件处于一种不稳定的状态，它仍然存在于文件系统中，但任何试图打开它的尝试都会因错误而失败。
//!
//! 我们在这里使用的缓解措施包括：
//! - 在尝试打开文件时，我们将 ERROR_DELETE_PENDING 视为成功的删除操作。
//! - 如果在我们尝试删除父目录时文件尚未从文件系统中移除，我们会尝试等待它完成删除。
//! 不过我们无法无限等待，因此经过一定次数的重试后，我们会放弃并返回错误。
//! 简而言之，我们无法保证在竞争情况下操作总是能成功，但我们会尽力确保它应该能够成功。
//!
//! 我们使用的缓解措施如下：
//!
//! - 当尝试打开文件时，我们将 ERROR_DELETE_PENDING 视为成功的删除操作。
//! - 如果在我们尝试删除父目录时文件仍未从文件系统中移除，我们会尝试等待它完成删除。
//! - 我们无法无限等待，因此经过一定次数的重试后，我们会放弃并返回错误。
//! 这本质上是一个围绕 raw NtOpenFile 调用的包装器。
//!   We can't wait indefinitely though so after some number of spins, we give
//!   up and return an error.
//!
//! In short, we can't guarantee this will always succeed in the event of a
//! race but we do make a best effort such that it *should* do so.

use core::ptr;
use core::sync::atomic::{Atomic, AtomicU32, Ordering};

use super::{AsRawHandle, DirBuff, File, FromRawHandle};
use crate::sys::c;
use crate::sys::pal::api::{UnicodeStrRef, WinError, unicode_str};
use crate::thread;

// The maximum number of times to spin when waiting for deletes to complete.
const MAX_RETRIES: usize = 50;

/// A wrapper around a raw NtOpenFile call.
///
/// This isn't completely safe because `OBJECT_ATTRIBUTES` contains raw pointers.
unsafe fn nt_open_file(
    access: u32,
    object_attribute: &c::OBJECT_ATTRIBUTES,
    share: u32,
    options: u32,
) -> Result<File, WinError> {
    unsafe {
        let mut handle = ptr::null_mut();
        let mut io_status = c::IO_STATUS_BLOCK::PENDING;
        let status =
            c::NtOpenFile(&mut handle, access, object_attribute, &mut io_status, share, options);
        if c::nt_success(status) {
            Ok(File::from_raw_handle(handle))
        } else {
            // Convert an NTSTATUS to the more familiar Win32 error code (aka "DosError")
            let win_error = if status == c::STATUS_DELETE_PENDING {
                // We make a special exception for `STATUS_DELETE_PENDING` because
                // otherwise this will be mapped to `ERROR_ACCESS_DENIED` which is
                // very unhelpful because that can also mean a permission error.
                WinError::DELETE_PENDING
            } else {
                WinError::new(c::RtlNtStatusToDosError(status))
            };
            Err(win_error)
        }
    }
}

/// Open the file `path` in the directory `parent`, requesting the given `access` rights.
/// `options` will be OR'd with `FILE_OPEN_REPARSE_POINT`.
fn open_link_no_reparse(
    parent: &File,
    path: UnicodeStrRef<'_>,
    access: u32,
    options: u32,
) -> Result<Option<File>, WinError> {
    // This is implemented using the lower level `NtOpenFile` function as
    // unfortunately opening a file relative to a parent is not supported by
    // win32 functions.
    //
    // See https://learn.microsoft.com/windows/win32/api/winternl/nf-winternl-ntopenfile

    // The `OBJ_DONT_REPARSE` attribute ensures that we haven't been
    // tricked into following a symlink. However, it may not be available in
    // earlier versions of Windows.
    static ATTRIBUTES: Atomic<u32> = AtomicU32::new(c::OBJ_DONT_REPARSE);

    let result = unsafe {
        let mut object = c::OBJECT_ATTRIBUTES {
            ObjectName: path.as_ptr().cast_mut(),
            RootDirectory: parent.as_raw_handle(),
            Attributes: ATTRIBUTES.load(Ordering::Relaxed),
            ..c::OBJECT_ATTRIBUTES::with_length()
        };
        let share = c::FILE_SHARE_DELETE | c::FILE_SHARE_READ | c::FILE_SHARE_WRITE;
        let options = c::FILE_OPEN_REPARSE_POINT | options;
        let result = nt_open_file(access, &object, share, options);

        // Retry without OBJ_DONT_REPARSE if it's not supported.
        if matches!(result, Err(WinError::INVALID_PARAMETER))
            && ATTRIBUTES.load(Ordering::Relaxed) == c::OBJ_DONT_REPARSE
        {
            ATTRIBUTES.store(0, Ordering::Relaxed);
            object.Attributes = 0;
            nt_open_file(access, &object, share, options)
        } else {
            result
        }
    };

    // Ignore not found errors
    match result {
        Ok(f) => Ok(Some(f)),
        Err(
            WinError::FILE_NOT_FOUND
            | WinError::PATH_NOT_FOUND
            | WinError::BAD_NETPATH
            | WinError::BAD_NET_NAME
            // `DELETE_PENDING` means something else is already trying to delete it
            // so we assume that will eventually succeed.
            | WinError::DELETE_PENDING,
        ) => Ok(None),
        Err(e) => Err(e),
    }
}

fn open_dir(parent: &File, name: UnicodeStrRef<'_>) -> Result<Option<File>, WinError> {
    // Open the directory for synchronous directory listing.
    open_link_no_reparse(
        parent,
        name,
        c::SYNCHRONIZE | c::FILE_LIST_DIRECTORY,
        // "_IO_NONALERT" means that a synchronous call won't be interrupted.
        c::FILE_SYNCHRONOUS_IO_NONALERT,
    )
}

fn delete(parent: &File, name: UnicodeStrRef<'_>) -> Result<(), WinError> {
    // Note that the `delete` function consumes the opened file to ensure it's
    // dropped immediately. See module comments for why this is important.
    match open_link_no_reparse(parent, name, c::DELETE, 0) {
        Ok(Some(f)) => f.delete(),
        Ok(None) => Ok(()),
        Err(e) => Err(e),
    }
}

/// A simple retry loop that keeps running `f` while it fails with the given
/// error code or until `MAX_RETRIES` is reached.
fn retry<T: PartialEq>(
    mut f: impl FnMut() -> Result<T, WinError>,
    ignore: WinError,
) -> Result<T, WinError> {
    let mut i = MAX_RETRIES;
    loop {
        i -= 1;
        if i == 0 {
            return f();
        } else {
            let result = f();
            if result != Err(ignore) {
                return result;
            }
        }
        thread::yield_now();
    }
}

pub fn remove_dir_all_iterative(dir: File) -> Result<(), WinError> {
    let mut buffer = DirBuff::new();
    let mut dirlist = vec![dir];

    while let Some(dir) = dirlist.pop() {
        let restart = false; // we never have to restart, we iterate every directory only once
        let more_data = dir.fill_dir_buff(&mut buffer, restart)?;
        if !more_data {
            // This directory is done!
            // Attempt to delete, retrying on not empty errors because we may
            // need to wait some time for files to be removed from the filesystem.
            let name = unicode_str!("");
            retry(|| delete(&dir, name), WinError::DIR_NOT_EMPTY)?;
            continue;
        }

        // There is more data, so we have to re-insert `dir` so it gets visited again. We need to
        // push it first so that it gets visited after any subdirs that we push below. We also need
        // to still access it during the `for` loop so remember where we put it.
        let dir_idx = dirlist.len();
        dirlist.push(dir);
        // To avoid indexing `dirlist` each time through the loop, we use a reference that we
        // re-compute whenever the borrow got invalidated.
        let mut dir = &dirlist[dir_idx];

        for (name, is_directory) in buffer.iter() {
            let name = unicode_str!(&name);
            if is_directory {
                let Some(subdir) = open_dir(dir, name)? else { continue };
                dirlist.push(subdir);
                // We need to re-create the borrow.
                dir = &dirlist[dir_idx]
            } else {
                // Attempt to delete, retrying on sharing violation errors as these
                // can often be very temporary. E.g. if something takes just a
                // bit longer than expected to release a file handle.
                retry(|| delete(dir, name), WinError::SHARING_VIOLATION)?;
            }
        }
    }
    Ok(())
}
