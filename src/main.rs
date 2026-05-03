mod translation;
use regex::Regex;
use serde::Serialize;
use std::{
    fmt, fs, io,
    path::{Path, PathBuf},
};
use translation::MAX_NEW_TOKENS;
/// 表示一个注释
#[derive(Debug, Clone, Serialize)]
pub struct Comment {
    /// 注释类型
    pub kind: CommentKind,
    /// 注释原文（含 // 或 /* ... */ 标记）
    pub raw: String,
    /// 注释在源码中的起始字节偏移
    pub start: usize,
    /// 注释在源码中的结束字节偏移
    pub end: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum CommentKind {
    Line,  // //
    Block, // /* */
}

/// 扫描 JS/TS 源码，返回所有注释（按出现顺序）
pub fn extract_comments(source: &str) -> Vec<Comment> {
    let chars: Vec<char> = source.chars().collect();
    let char_count = chars.len();
    let mut comments = Vec::new();
    let mut i = 0;
    let mut expect_regex = true; // 初始视为可接受正则

    while i < char_count {
        let ch = chars[i];

        // 更新 expect_regex：
        // 遇到这些字符时，下一个 / 可能是正则开始
        match ch {
            '(' | '[' | '{' | ',' | ';' | ':' | '!' | '~' | '?' | '=' | '<' | '>' | '&' | '|'
            | '+' | '-' | '*' | '%' | '^' => {
                expect_regex = true;
            }
            // 标识符、数字、字符串、右括号等之后，/ 是除法
            c if c.is_alphanumeric()
                || c == '_'
                || c == '$'
                || c == ')'
                || c == ']'
                || c == '}'
                || c == '\''
                || c == '"'
                || c == '`' =>
            {
                expect_regex = false;
            }
            _ => {} // 空白等不改变状态
        }

        // 检测单行注释 //
        if ch == '/' && i + 1 < char_count && chars[i + 1] == '/' {
            // 确认不是除法（除号后面不能紧跟 /）
            let start = byte_offset(source, i);
            let mut j = i + 2;
            while j < char_count && chars[j] != '\n' {
                j += 1;
            }
            let end = byte_offset(source, j);
            let raw = source[start..end].to_owned();
            comments.push(Comment {
                kind: CommentKind::Line,
                raw,
                start,
                end,
            });
            i = j;
            expect_regex = true; // 注释后可以出现正则
            continue;
        }

        // 检测多行注释 /*
        if ch == '/' && i + 1 < char_count && chars[i + 1] == '*' {
            let start = byte_offset(source, i);
            let mut j = i + 2;
            let mut depth = 1;
            while j < char_count - 1 {
                if chars[j] == '*' && chars[j + 1] == '/' {
                    depth -= 1;
                    if depth == 0 {
                        j += 2; // 跳过 */
                        break;
                    }
                    j += 2;
                } else if chars[j] == '/' && chars[j + 1] == '*' {
                    depth += 1; // 支持嵌套（可选，JS 标准无嵌套，这里简单处理）
                    j += 2;
                } else {
                    j += 1;
                }
            }
            let end = byte_offset(source, j);
            let raw = source[start..end].to_owned();
            comments.push(Comment {
                kind: CommentKind::Block,
                raw,
                start,
                end,
            });
            i = j;
            expect_regex = true;
            continue;
        }

        // 处理字符串字面量
        if ch == '\'' || ch == '"' || ch == '`' {
            let quote = ch;
            let start = i;
            i += 1;
            while i < char_count {
                let c = chars[i];
                if c == '\\' {
                    i += 2; // 跳过转义
                } else if c == quote {
                    i += 1;
                    break;
                } else {
                    i += 1;
                }
            }
            // 字符串结束后，/ 不视为正则开始（因后缀已有标识符性质）
            expect_regex = false;
            continue;
        }

        // 处理正则字面量
        if ch == '/' && expect_regex && !is_division_following(&chars, i) {
            // 进入正则
            let start = i;
            i += 1;
            let mut in_char_class = false;
            while i < char_count {
                let c = chars[i];
                if c == '\\' {
                    i += 2; // 跳过转义
                } else if c == '[' {
                    in_char_class = true;
                    i += 1;
                } else if c == ']' {
                    in_char_class = false;
                    i += 1;
                } else if c == '/' && !in_char_class {
                    i += 1; // 结束
                    break;
                } else {
                    i += 1;
                }
            }
            // 正则后可跟标志位
            while i < char_count && chars[i].is_alphabetic() {
                i += 1;
            }
            // 正则结束后，/ 是除法
            expect_regex = false;
            continue;
        }

        // 其他字符，跳过
        i += 1;
    }
    comments
}

/// 辅助：判断当前位置的 / 是否可能是除法（即后面不能是换行、空格、* 等）
fn is_division_following(chars: &[char], pos: usize) -> bool {
    if pos + 1 >= chars.len() {
        return false;
    }
    let next = chars[pos + 1];
    // 若紧跟 =、空白、换行、注释开始等，不太可能是除法（可能为正则）
    // 但实际上 / 后面如果跟着 * 或 / 我们已经在前面处理为注释了，
    // 所以这里只需简单判断：如果后面是空白或换行，当作正则（不太准确，但影响不大）
    // 严谨判断：除号右边必须是表达式开始，通常是数字、变量、括号等。
    // 为简化，我们只检测明显不是除号的情况，如后面是空格、换行、*、/
    matches!(next, ' ' | '\t' | '\n' | '\r' | '*' | '/')
}

/// 字符索引 → 字节偏移
fn byte_offset(source: &str, char_index: usize) -> usize {
    source
        .char_indices()
        .nth(char_index)
        .map(|(i, _)| i)
        .unwrap_or(source.len())
}

/// 把翻译后的注释按顺序替换回源码
pub fn replace_comments(source: &str, translated: &[String]) -> String {
    let comments = extract_comments(source);
    assert_eq!(
        comments.len(),
        translated.len(),
        "注释数量与翻译列表数量不一致"
    );

    let mut result = String::with_capacity(source.len());
    let mut last_end = 0;
    for (comment, new_raw) in comments.iter().zip(translated.iter()) {
        result.push_str(&source[last_end..comment.start]);
        result.push_str(new_raw);
        last_end = comment.end;
    }
    result.push_str(&source[last_end..]);
    result
}

fn main() -> io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let program = args[0].clone();

    // 解析参数（极简版，不引入 clap）
    let mut positional = Vec::new();
    let mut verbose = false;
    let mut force = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--verbose" | "-v" => verbose = true,
            "--force" | "-f" => force = true,
            "--help" | "-h" => {
                print_usage(&program);
                return Ok(());
            }
            _ => {
                if args[i].starts_with('-') {
                    eprintln!("未知选项: {}", args[i]);
                    print_usage(&program);
                    std::process::exit(1);
                } else {
                    positional.push(args[i].clone());
                }
            }
        }
        i += 1;
    }

    if positional.is_empty() {
        print_usage(&program);
        std::process::exit(1);
    }

    let input_path = PathBuf::from(&positional[0]);
    if !input_path.exists() {
        eprintln!("错误：输入路径不存在: {}", input_path.display());
        std::process::exit(1);
    }

    // 确定输出路径
    let (single_file, output_path) = if input_path.is_file() {
        // 单文件模式
        let default_output = input_path.with_extension("translated.js");
        let out = if positional.len() > 1 {
            PathBuf::from(&positional[1])
        } else {
            default_output
        };
        (true, out)
    } else if input_path.is_dir() {
        // 目录模式
        let out = if positional.len() > 1 {
            PathBuf::from(&positional[1])
        } else {
            input_path.join("translated")
        };
        (false, out)
    } else {
        eprintln!("错误：输入路径既不是文件也不是目录");
        std::process::exit(1);
    };

    // 开始翻译
    if single_file {
        process_file(&input_path, &output_path, verbose, force)?;
        println!("翻译完成: {}", output_path.display());
    } else {
        // 收集所有 JS/TS 文件
        let extensions = ["js", "ts", "jsx", "tsx"];
        let mut files = Vec::new();
        collect_files(&input_path, &extensions, &mut files)?;

        if files.is_empty() {
            eprintln!("未找到任何 JavaScript/TypeScript 文件");
            return Ok(());
        }

        println!("找到 {} 个文件待翻译", files.len());
        if verbose {
            println!("输出目录: {}", output_path.display());
        }

        let input_base = input_path.canonicalize()?;
        let output_base = output_path
            .canonicalize()
            .unwrap_or_else(|_| output_path.clone());

        for file in &files {
            // 计算相对路径，保持目录结构
            let rel = file.strip_prefix(&input_base).unwrap_or(file);
            let out_file = output_base.join(rel);

            if let Err(e) = process_file(file, &out_file, verbose, force) {
                eprintln!("  [错误] {}: {}", file.display(), e);
            }
        }

        println!("翻译完成，输出目录: {}", output_base.display());
    }

    Ok(())
}

/// 精确翻译多行注释：保留所有缩进、* 前缀、空行、JSDoc 标签结构
fn translate_block_comment(raw: &str, file_label: &str, comment_idx: usize) -> String {
    let lines: Vec<&str> = raw.lines().collect();
    if lines.len() <= 2 {
        let inner = &raw[2..raw.len() - 2];
        if translation::should_skip(inner) {
            return raw.to_owned();
        }
        let trans = translation::translate_text(
            inner.trim(),
            false,
            translation::MAX_NEW_TOKENS,
            file_label,
            comment_idx,
            0,
            0.0,
            Some(translation::SYSTEM_PROMPT_JS),
        );
        return format!("/* {} */", trans);
    }

    let mut rebuilt: Vec<String> = Vec::new();
    let line_re = Regex::new(r"^(\s*\*\s?)(.*)$").unwrap();

    for line in lines {
        if let Some(caps) = line_re.captures(line) {
            let prefix = caps.get(1).map(|m| m.as_str()).unwrap_or("* ");
            let content = caps.get(2).map(|m| m.as_str()).unwrap_or("");

            if content.trim().is_empty() {
                rebuilt.push(line.to_owned());
                continue;
            }

            // JSDoc 标签行（以 @ 开头）
            if let Some(stripped) = content.trim().strip_prefix('@') {
                let tag_re =
                    Regex::new(r"^(\w+)(\s+\{[^}]*\})?(\s+\[?[^\s\]]*\]?)?(?:\s+(.*))?").unwrap();
                if let Some(tag_caps) = tag_re.captures(stripped) {
                    let tag = tag_caps.get(1).map(|m| m.as_str()).unwrap_or("");
                    let type_part = tag_caps.get(2).map(|m| m.as_str()).unwrap_or("");
                    let name_part = tag_caps.get(3).map(|m| m.as_str()).unwrap_or("");
                    let desc = tag_caps.get(4).map(|m| m.as_str()).unwrap_or("");

                    if desc.is_empty() || translation::should_skip(desc) {
                        rebuilt.push(line.to_owned());
                    } else {
                        let trans_desc = translation::translate_text(
                            desc,
                            false,
                            translation::MAX_NEW_TOKENS,
                            file_label,
                            comment_idx,
                            0,
                            0.0,
                            Some(translation::SYSTEM_PROMPT_JS),
                        );
                        let new_content =
                            format!("@{}{}{} {}", tag, type_part, name_part, trans_desc);
                        rebuilt.push(format!("{}{}", prefix, new_content));
                    }
                } else {
                    rebuilt.push(line.to_owned());
                }
            } else {
                // 普通文本行
                if translation::should_skip(content) {
                    rebuilt.push(format!("{}{}", prefix, content));
                } else {
                    let trans = translation::translate_text(
                        content,
                        false,
                        translation::MAX_NEW_TOKENS,
                        file_label,
                        comment_idx,
                        0,
                        0.0,
                        Some(translation::SYSTEM_PROMPT_JS),
                    );
                    rebuilt.push(format!("{}{}", prefix, trans));
                }
            }
        } else {
            // 首行或尾行（/** 或 */）
            rebuilt.push(line.to_owned());
        }
    }
    rebuilt.join("\n")
}
// ─── 打印使用说明 ───
fn print_usage(program: &str) {
    eprintln!("用法:");
    eprintln!("  {} <input> [output] [选项]", program);
    eprintln!("");
    eprintln!("参数:");
    eprintln!("  <input>     输入文件或目录");
    eprintln!("  [output]    输出文件或目录（默认为 <input>/translated 或添加后缀）");
    eprintln!("");
    eprintln!("选项:");
    eprintln!("  --verbose, -v  显示详细进度");
    eprintln!("  --force, -f    强制覆盖已有翻译文件");
    eprintln!("  --help, -h     显示此帮助");
}
// ─── 递归收集指定扩展名的文件 ───
fn collect_files(dir: &Path, extensions: &[&str], files: &mut Vec<PathBuf>) -> io::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_files(&path, extensions, files)?;
        } else {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if extensions.contains(&ext) {
                    files.push(path);
                }
            }
        }
    }
    Ok(())
}

// ─── 单个文件处理逻辑 ───
fn process_file(
    input_path: &Path,
    output_path: &Path,
    verbose: bool,
    force: bool,
) -> io::Result<()> {
    if !force && output_path.exists() && output_path.metadata()?.len() > 0 {
        if verbose {
            eprintln!("  [跳过] {} 已存在", output_path.display());
        }
        return Ok(());
    }

    let source = fs::read_to_string(input_path)?;
    let comments = extract_comments(&source);

    if verbose {
        eprintln!(
            "  [处理] {} ({} 条注释)",
            input_path.display(),
            comments.len()
        );
    }

    // 翻译每条注释
    let translated: Vec<String> = comments
        .iter()
        .enumerate()
        .map(|(idx, c)| match c.kind {
            CommentKind::Line => {
                let inner = c.raw.trim_start_matches("//").trim();
                if inner.is_empty() || translation::should_skip(inner) {
                    c.raw.clone()
                } else {
                    let trans = translation::translate_text(
                        inner,
                        verbose,
                        translation::MAX_NEW_TOKENS,
                        &input_path.display().to_string(),
                        idx,
                        0,
                        0.0,
                        Some(translation::SYSTEM_PROMPT_JS),
                    );
                    format!("// {}", trans)
                }
            }
            CommentKind::Block => {
                translate_block_comment(&c.raw, &input_path.display().to_string(), idx)
            }
        })
        .collect();

    let new_source = replace_comments(&source, &translated);

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, new_source)?;

    if verbose {
        eprintln!("  [完成] -> {}", output_path.display());
    }
    Ok(())
}
