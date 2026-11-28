#[derive(Copy, Clone)]
pub(crate) struct EscapeOptions {
    /// 生成 '\'。
    pub escape_single_quote: bool,
    /// 生成 '\'。
    pub escape_double_quote: bool,
    /// 对于非 ASCII 字符，请使用 \x 进行转义，而 ASCII 字符则使用 \u 而不是 \u。
    /// 控制字符。
    pub escape_nonascii: bool,
}

pub(crate) fn escape_bytes(bytes: &[u8], opt: EscapeOptions) -> String {
    let mut repr = String::new();

    if opt.escape_nonascii {
        for &byte in bytes {
            escape_single_byte(byte, opt, &mut repr);
        }
    } else {
        for chunk in bytes.utf8_chunks() {
            for ch in chunk.valid().chars() {
                escape_single_char(ch, opt, &mut repr);
            }
            for &byte in chunk.invalid() {
                escape_single_byte(byte, opt, &mut repr);
            }
        }
    }

    repr
}

fn escape_single_byte(byte: u8, opt: EscapeOptions, repr: &mut String) {
    if byte == b'\0' {
        repr.push_str("\\0");
    } else if (byte == b'\'' && !opt.escape_single_quote)
        || (byte == b'"' && !opt.escape_double_quote)
    {
        repr.push(byte as char);
    } else {
        // Escapes \t, \r, \n, \\, \', \", and uses \x## for non-ASCII and
        // for ASCII control characters.
        repr.extend(byte.escape_ascii().map(char::from));
    }
}

fn escape_single_char(ch: char, opt: EscapeOptions, repr: &mut String) {
    if (ch == '\'' && !opt.escape_single_quote) || (ch == '"' && !opt.escape_double_quote) {
        repr.push(ch);
    } else {
        // Escapes \0, \t, \r, \n, \\, \', \", and uses \u{...} for
        // non-printable characters and for Grapheme_Extend characters, which
        // includes things like U+0300 "Combining Grave Accent".
        repr.extend(ch.escape_debug());
    }
}
