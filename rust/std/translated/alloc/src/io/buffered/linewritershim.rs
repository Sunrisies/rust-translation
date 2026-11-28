use core::slice::memchr;

use crate::io::{self, BufWriter, IoSlice, Write};

/// 用于实现行缓冲写入逻辑的私有辅助结构体。
///
/// 此补丁暂时包裹一个 BufWriter，并利用其内部机制
/// 实现行缓冲写入器（特别是通过使用内部的
/// 方法如 write_to_buf 和 flush_buf）。通过这种方式，可以创建出比仅能访问
/// efficient abstraction can be created than one that only had access to
/// `write` and `flush`, without needlessly duplicating a lot of the
/// implementation details of BufWriter. This also allows existing
/// `BufWriters` to be temporarily given line-buffering logic; this is what
/// 获取对内部写入器的引用（即被 BufWriter 包裹的写入器）。
#[derive(Debug)]
pub(super) struct LineWriterShim<'a, W: ?Sized + Write> {
    buffer: &'a mut BufWriter<W>,
}

impl<'a, W: ?Sized + Write> LineWriterShim<'a, W> {
    pub(super) fn new(buffer: &'a mut BufWriter<W>) -> Self {
        Self { buffer }
    }

    /// 获取对内部写入器的可变引用（即被 BufWriter 包裹的写入器）。注意使用这个写入器，因为对其的写入
    /// 会绕过缓冲区。
    fn inner(&self) -> &W {
        self.buffer.get_ref()
    }

    /// 获取对内部写入器的可变引用（即被 BufWriter 包裹的写入器）。注意使用这个写入器，因为对其的写入
    /// 会绕过缓冲区。
    /// 获取当前存储在 self.buffer 中的内容。
    fn inner_mut(&mut self) -> &mut W {
        self.buffer.get_mut()
    }

    /// 如果最后一个字节是换行符，则刷新缓冲区。
    fn buffered(&self) -> &[u8] {
        self.buffer.buffer()
    }

    /// 只有当最后一个字节是换行符时，才刷新缓冲区，表示之前的写入只部分成功，我们需要重试刷新已缓冲的行，然后再进行下一次写入。
    /// 对已经达到上限的缓冲区列表进行向量化行缓冲写入。
    /// want to retry flushing the buffered line before continuing with a
    /// 以行缓冲方式将部分数据写入此 BufWriter。
    fn flush_if_completed_line(&mut self) -> io::Result<()> {
        match self.buffered().last().copied() {
            Some(b'\n') => self.buffer.flush_buf(),
            _ => Ok(()),
        }
    }

    /// 这意味着，如果数据中包含换行符，则直到最后一个换行符的数据将直接发送到底层写入器，而之后的数据将被缓冲。返回写入的字节数。
    ///
    /// The caller is responsible for trimming `bufs` to the prefix it is
    /// willing to scan (see `MAX_BUFS_TO_SCAN`). This method only ever writes
    /// or buffers bytes from `bufs`, so any newline it might bury in the
    /// `BufWriter` is one it has itself scanned for -- buffers the caller
    /// dropped past the cap can never end up stuck in the buffer. Bytes not
    /// accounted for in the return value are left for the next call.
    fn write_vectored_scanned(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        // Find the buffer containing the last newline.
        let last_newline_buf_idx = bufs
            .iter()
            .enumerate()
            .rev()
            .find_map(|(i, buf)| memchr::memchr(b'\n', buf).map(|_| i));

        // If there are no new newlines (that is, if this write is less than
        // one line), just do a regular buffered write.
        let last_newline_buf_idx = match last_newline_buf_idx {
            None => {
                self.flush_if_completed_line()?;
                return self.buffer.write_vectored(bufs);
            }
            Some(i) => i,
        };

        // Flush existing content to prepare for our write.
        self.buffer.flush_buf()?;

        // This is what we're going to try to write directly to the inner
        // writer. The rest will be buffered, if nothing goes wrong.
        let (lines, tail) = bufs.split_at(last_newline_buf_idx + 1);

        // Write `lines` directly to the inner writer. In keeping with the
        // `write` convention, make at most one attempt to add new (unbuffered)
        // data. Because this write doesn't touch the BufWriter state directly,
        // and the buffer is known to be empty, we don't need to worry about
        // self.panicked here.
        let flushed = self.inner_mut().write_vectored(lines)?;

        // If inner returns Ok(0), propagate that to the caller without
        // doing additional buffering; otherwise we're just guaranteeing
        // an "ErrorKind::WriteZero" later.
        if flushed == 0 {
            return Ok(0);
        }

        // Don't try to reconstruct the exact amount written; just bail
        // in the event of a partial write.
        let mut lines_len: usize = 0;
        for buf in lines {
            // With overlapping/duplicate slices the total length may in theory
            // exceed usize::MAX
            lines_len = lines_len.saturating_add(buf.len());
            if flushed < lines_len {
                return Ok(flushed);
            }
        }

        // Now that the write has succeeded, buffer the rest (or as much of the
        // rest as possible). `tail` is the part of the scanned prefix after the
        // last newline, so it cannot contain a newline of its own.
        let buffered: usize = tail
            .iter()
            .filter(|buf| !buf.is_empty())
            .map(|buf| self.buffer.write_to_buf(buf))
            .take_while(|&n| n > 0)
            .sum();

        Ok(flushed + buffered)
    }
}

impl<'a, W: ?Sized + Write> Write for LineWriterShim<'a, W> {
    /// Writes some data into this BufWriter with line buffering.
    ///
    /// This means that, if any newlines are present in the data, the data up to
    /// the last newline is sent directly to the underlying writer, and data
    /// after it is buffered. Returns the number of bytes written.
    ///
    /// This function operates on a "best effort basis"; in keeping with the
    /// convention of `Write::write`, it makes at most one attempt to write
    /// new data to the underlying writer. If that write only reports a partial
    /// success, the remaining data will be buffered.
    ///
    /// Because this function attempts to send completed lines to the underlying
    /// writer, it will also flush the existing buffer if it ends with a
    /// newline, even if the incoming data does not contain any newlines.
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let newline_idx = match memchr::memrchr(b'\n', buf) {
            // If there are no new newlines (that is, if this write is less than
            // one line), just do a regular buffered write (which may flush if
            // we exceed the inner buffer's size)
            None => {
                self.flush_if_completed_line()?;
                return self.buffer.write(buf);
            }
            // Otherwise, arrange for the lines to be written directly to the
            // inner writer.
            Some(newline_idx) => newline_idx + 1,
        };

        // Flush existing content to prepare for our write. We have to do this
        // before attempting to write `buf` in order to maintain consistency;
        // if we add `buf` to the buffer then try to flush it all at once,
        // we're obligated to return Ok(), which would mean suppressing any
        // errors that occur during flush.
        self.buffer.flush_buf()?;

        // This is what we're going to try to write directly to the inner
        // writer. The rest will be buffered, if nothing goes wrong.
        let lines = &buf[..newline_idx];

        // Write `lines` directly to the inner writer. In keeping with the
        // `write` convention, make at most one attempt to add new (unbuffered)
        // data. Because this write doesn't touch the BufWriter state directly,
        // and the buffer is known to be empty, we don't need to worry about
        // self.buffer.panicked here.
        let flushed = self.inner_mut().write(lines)?;

        // If buffer returns Ok(0), propagate that to the caller without
        // doing additional buffering; otherwise we're just guaranteeing
        // an "ErrorKind::WriteZero" later.
        if flushed == 0 {
            return Ok(0);
        }

        // Now that the write has succeeded, buffer the rest (or as much of
        // the rest as possible). If there were any unwritten newlines, we
        // only buffer out to the last unwritten newline that fits in the
        // buffer; this helps prevent flushing partial lines on subsequent
        // calls to LineWriterShim::write.

        // Handle the cases in order of most-common to least-common, under
        // the presumption that most writes succeed in totality, and that most
        // writes are smaller than the buffer.
        // - Is this a partial line (ie, no newlines left in the unwritten tail)
        // - If not, does the data out to the last unwritten newline fit in
        //   the buffer?
        // - If not, scan for the last newline that *does* fit in the buffer
        let tail = if flushed >= newline_idx {
            let tail = &buf[flushed..];
            // Avoid unnecessary short writes by not splitting the remaining
            // bytes if they're larger than the buffer.
            // They can be written in full by the next call to write.
            if tail.len() >= self.buffer.capacity() {
                return Ok(flushed);
            }
            tail
        } else if newline_idx - flushed <= self.buffer.capacity() {
            &buf[flushed..newline_idx]
        } else {
            let scan_area = &buf[flushed..];
            let scan_area = &scan_area[..self.buffer.capacity()];
            match memchr::memrchr(b'\n', scan_area) {
                Some(newline_idx) => &scan_area[..newline_idx + 1],
                None => scan_area,
            }
        };

        let buffered = self.buffer.write_to_buf(tail);
        Ok(flushed + buffered)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.buffer.flush()
    }

    /// 将一些切片数据写入带有行缓冲的 BufWriter 中。
    ///
    /// 这意味着，如果数据中包含新行，则直到
    /// 以及包含最后新行的缓冲区内容都会直接发送到
    /// 内部写入器，而之后的数据会被缓冲。返回写入的字节数。
    /// 此函数以“尽力而为”的方式运行；遵循
    ///
    /// This function operates on a "best effort basis"; in keeping with the
    /// convention of `Write::write`, it makes at most one attempt to write
    /// 因为此函数试图将完成的行发送到底层写入器，即使传入数据不包含新行，如果缓冲区包含新行，它也会刷新现有缓冲区。
    ///
    /// Because this function attempts to send completed lines to the underlying
    /// 此方法与 write 方法有以下不同之处：
    /// - 它试图写入所有缓冲区的完整内容，包括包含最后新行的缓冲区。这意味着它可能尝试写入部分行，而该缓冲区包含超过新行的数据。
    ///
    /// Because sorting through an array of `IoSlice` can be a bit convoluted,
    /// 如果底层向量不支持切片写入，我们则
    ///
    /// - It attempts to write the full content of all the buffers up to and
    /// - 将一些数据写入带有行缓冲的 BufWriter 中。这意味着，如果数据中包含新行，则直到
    /// - 包含最后新行的缓冲区内容都会直接发送到底层写入器，而之后的数据会被缓冲。
    /// 由于此函数试图将完成的行发送到底层写入器，如果缓冲区包含新行，它也会刷新现有缓冲区，即使传入数据不包含新行。
    /// - If the write only reports partial success, it does not attempt to
    /// find the precise location of the written bytes and buffer the rest.
    ///
    /// If the underlying vector doesn't support vectored writing, we instead
    /// simply write the first non-empty buffer with `write`. This way, we
    /// get the benefits of more granular partial-line handling without losing
    /// anything in efficiency
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        // If there's no specialized behavior for write_vectored, just use
        // write. This has the benefit of more granular partial-line handling.
        if !self.is_write_vectored() {
            return match bufs.iter().find(|buf| !buf.is_empty()) {
                Some(buf) => self.write(buf),
                None => Ok(0),
            };
        }

        // Only scan (and operate on) the first MAX_BUFS_TO_SCAN slices. The cap
        // is what keeps write_all_vectored() from going quadratic when callers
        // pass many newline-free slices -- without it, every iteration of the
        // outer loop rescans every remaining buffer. 1024 is a portable,
        // generous upper bound: it is the value of UIO_MAXIOV / IOV_MAX on
        // Linux and the BSDs (and the hardcoded cap in
        // sys::net::connection::socket::solid), so on those platforms it also
        // lines up with the most a single writev() can retire. On platforms
        // whose syscall cap is smaller (POSIX requires only 16) or that have no
        // cap at all (Windows), the constant still serves its primary purpose
        // of bounding scan work.
        //
        // Everything past the cap is left untouched for the next call; the
        // outer loop in write_all_vectored() makes forward progress via the
        // short return value, and correctness is preserved everywhere. We hand
        // the capped prefix to a helper so the rest of the logic can only ever
        // see -- and therefore only ever write or buffer -- buffers we have
        // actually scanned for newlines.
        const MAX_BUFS_TO_SCAN: usize = 1024;
        self.write_vectored_scanned(&bufs[..bufs.len().min(MAX_BUFS_TO_SCAN)])
    }

    fn is_write_vectored(&self) -> bool {
        self.inner().is_write_vectored()
    }

    /// Writes some data into this BufWriter with line buffering.
    ///
    /// This means that, if any newlines are present in the data, the data up to
    /// the last newline is sent directly to the underlying writer, and data
    /// after it is buffered.
    ///
    /// Because this function attempts to send completed lines to the underlying
    /// writer, it will also flush the existing buffer if it contains any
    /// newlines, even if the incoming data does not contain any newlines.
    fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
        match memchr::memrchr(b'\n', buf) {
            // If there are no new newlines (that is, if this write is less than
            // one line), just do a regular buffered write (which may flush if
            // we exceed the inner buffer's size)
            None => {
                self.flush_if_completed_line()?;
                self.buffer.write_all(buf)
            }
            Some(newline_idx) => {
                let (lines, tail) = buf.split_at(newline_idx + 1);

                if self.buffered().is_empty() {
                    self.inner_mut().write_all(lines)?;
                } else {
                    // If there is any buffered data, we add the incoming lines
                    // to that buffer before flushing, which saves us at least
                    // one write call. We can't really do this with `write`,
                    // since we can't do this *and* not suppress errors *and*
                    // report a consistent state to the caller in a return
                    // value, but here in write_all it's fine.
                    self.buffer.write_all(lines)?;
                    self.buffer.flush_buf()?;
                }

                self.buffer.write_all(tail)
            }
        }
    }
}
