mod translation;
use regex::Regex;
use serde::Serialize;
use std::{
    fs,
    io::{self, BufWriter, Write},
    path::{Path, PathBuf},
    sync::{Arc, Condvar, Mutex},
    time::{Instant, SystemTime},
};

// ── 全局日志文件 ──
static LOG_FILE: std::sync::LazyLock<Mutex<Option<BufWriter<fs::File>>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

pub(crate) fn log_info(msg: &str) {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap();
    let ts = format!("[{}.{:03}]", now.as_secs(), now.subsec_millis());
    let line = format!("{} {}", ts, msg);
    eprintln!("{}", line);
    if let Ok(mut guard) = LOG_FILE.lock() {
        if let Some(ref mut writer) = *guard {
            let _ = writeln!(writer, "{}", line);
            let _ = writer.flush();
        }
    }
}
/// 简单的信号量实现，用于限制并发线程数
struct Semaphore {
    permits: Mutex<usize>,
    cv: Condvar,
}

impl Semaphore {
    fn new(max: usize) -> Self {
        Semaphore {
            permits: Mutex::new(max),
            cv: Condvar::new(),
        }
    }

    fn acquire(&self) {
        let mut permits = self.permits.lock().unwrap();
        while *permits == 0 {
            permits = self.cv.wait(permits).unwrap();
        }
        *permits -= 1;
    }

    fn release(&self) {
        let mut permits = self.permits.lock().unwrap();
        *permits += 1;
        self.cv.notify_one();
    }
}
// ── 注释结构体（提取用） ──
#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum CommentKind {
    Line,
    Block,
}

#[derive(Debug, Clone, Serialize)]
pub struct Comment {
    pub kind: CommentKind,
    pub raw: String,
    pub start: usize,
    pub end: usize,
}

// ─── 注释提取（完整实现） ───
pub fn extract_comments(source: &str) -> Vec<Comment> {
    let chars: Vec<char> = source.chars().collect();
    let char_count = chars.len();
    let mut comments = Vec::new();
    let mut i = 0;
    let mut expect_regex = true;

    while i < char_count {
        let ch = chars[i];

        match ch {
            '(' | '[' | '{' | ',' | ';' | ':' | '!' | '~' | '?' | '=' | '<' | '>' | '&' | '|'
            | '+' | '-' | '*' | '%' | '^' => {
                expect_regex = true;
            }
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
            _ => {}
        }

        // 单行注释 //
        if ch == '/' && i + 1 < char_count && chars[i + 1] == '/' {
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
            expect_regex = true;
            continue;
        }

        // 多行注释 /* */
        if ch == '/' && i + 1 < char_count && chars[i + 1] == '*' {
            let start = byte_offset(source, i);
            let mut j = i + 2;
            let mut depth = 1;
            while j < char_count - 1 {
                if chars[j] == '*' && chars[j + 1] == '/' {
                    depth -= 1;
                    if depth == 0 {
                        j += 2;
                        break;
                    }
                    j += 2;
                } else if chars[j] == '/' && chars[j + 1] == '*' {
                    depth += 1;
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

        // 字符串字面量
        if ch == '\'' || ch == '"' || ch == '`' {
            let quote = ch;
            i += 1;
            while i < char_count {
                if chars[i] == '\\' {
                    i += 2;
                } else if chars[i] == quote {
                    i += 1;
                    break;
                } else {
                    i += 1;
                }
            }
            expect_regex = false;
            continue;
        }

        // 正则字面量
        if ch == '/' && expect_regex && !is_division_following(&chars, i) {
            i += 1;
            let mut in_char_class = false;
            while i < char_count {
                if chars[i] == '\\' {
                    i += 2;
                } else if chars[i] == '[' {
                    in_char_class = true;
                    i += 1;
                } else if chars[i] == ']' {
                    in_char_class = false;
                    i += 1;
                } else if chars[i] == '/' && !in_char_class {
                    i += 1;
                    break;
                } else {
                    i += 1;
                }
            }
            while i < char_count && chars[i].is_alphabetic() {
                i += 1;
            }
            expect_regex = false;
            continue;
        }

        i += 1;
    }
    comments
}

fn is_division_following(chars: &[char], pos: usize) -> bool {
    pos + 1 < chars.len() && matches!(chars[pos + 1], ' ' | '\t' | '\n' | '\r' | '*' | '/')
}

fn byte_offset(source: &str, char_index: usize) -> usize {
    source
        .char_indices()
        .nth(char_index)
        .map(|(i, _)| i)
        .unwrap_or(source.len())
}

pub fn replace_comments(source: &str, translated: &[String]) -> String {
    let comments = extract_comments(source);
    assert_eq!(comments.len(), translated.len());

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

// ─── 多行注释翻译（保留星号前缀与缩进） ───
fn translate_block_comment(raw: &str, file_label: &str, comment_idx: usize) -> String {
    let lines: Vec<&str> = raw.lines().collect();
    if lines.len() <= 2 {
        let inner = &raw[2..raw.len() - 2];
        if translation::should_skip(inner) {
            return raw.to_owned();
        }
        let trans = translation::translate_text(
            inner.trim(),
            true,
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
                            true,
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
                if translation::should_skip(content) {
                    rebuilt.push(format!("{}{}", prefix, content));
                } else {
                    let trans = translation::translate_text(
                        content,
                        true,
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
            rebuilt.push(line.to_owned());
        }
    }
    rebuilt.join("\n")
}

// ─── 单文件处理 ───
fn process_file(
    input_path: &Path,
    output_path: &Path,
    verbose: bool,
    force: bool,
) -> io::Result<()> {
    let t_file_start = Instant::now();
    if !force && output_path.exists() && output_path.metadata()?.len() > 0 {
        log_info(&format!("  [跳过] {} 已存在", output_path.display()));
        return Ok(());
    }

    let source = fs::read_to_string(input_path)?;
    let comments = extract_comments(&source);
    let total_comments = comments.len();
    log_info(&format!(
        "  [处理] {} ({} 条注释)",
        input_path.display(),
        comments.len()
    ));

    let translated: Vec<String> = comments
        .iter()
        .enumerate()
        .map(|(idx, c)| {
            if total_comments > 1 {
                log_info(&format!("    注释 {}/{} ...", idx + 1, total_comments));
            }
            match c.kind {
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
            }
        })
        .collect();

    let new_source = replace_comments(&source, &translated);

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, new_source)?;
    let file_ms = t_file_start.elapsed().as_millis();
    log_info(&format!(
        "  [文件完成] {}，总耗时 {}ms",
        input_path.display(),
        file_ms
    ));
    Ok(())
}

// ─── 收集文件 ───
fn collect_files(
    base: &Path, // 输入目录的绝对路径
    dir: &Path,
    extensions: &[&str],
    files: &mut Vec<PathBuf>,
) -> io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_files(base, &path, extensions, files)?;
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if extensions.contains(&ext) {
                // 存储绝对路径，后续可轻松获取相对路径
                if let Ok(abs) = path.canonicalize() {
                    files.push(abs);
                } else {
                    files.push(path); // fallback
                }
            }
        }
    }
    Ok(())
}

fn print_usage(program: &str) {
    eprintln!("用法:");
    eprintln!("  {} <input> [output] [选项]", program);
    eprintln!();
    eprintln!("参数:");
    eprintln!("  <input>     输入文件或目录");
    eprintln!("  [output]    输出文件或目录（默认为 <input>/translated 或添加后缀）");
    eprintln!();
    eprintln!("选项:");
    eprintln!("  --verbose, -v  显示详细进度");
    eprintln!("  --force, -f    强制覆盖已有翻译文件");
    eprintln!("  --log <file>   将日志写入指定文件");
    eprintln!("  --help, -h     显示此帮助");
    eprintln!("  --jobs <N>, -j <N>  并发处理文件数 (默认: CPU核心数)");
}

fn main() -> io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let program = args[0].clone();

    let mut positional = Vec::new();
    let mut verbose = false;
    let mut force = false;
    let mut log_path: Option<PathBuf> = None;
    let mut concurrency: usize = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--verbose" | "-v" => verbose = true,
            "--force" | "-f" => force = true,
            "--log" => {
                i += 1;
                if i < args.len() {
                    log_path = Some(PathBuf::from(&args[i]));
                } else {
                    eprintln!("错误: --log 需要指定文件路径");
                    std::process::exit(1);
                }
            }
            "--help" | "-h" => {
                print_usage(&program);
                return Ok(());
            }
            "--jobs" | "-j" => {
                i += 1;
                if i < args.len() {
                    concurrency = args[i].parse().expect("--jobs 需要数字");
                } else {
                    eprintln!("错误: --jobs 需要指定数字");
                    std::process::exit(1);
                }
            }
            other => {
                if other.starts_with('-') {
                    eprintln!("未知选项: {}", other);
                    print_usage(&program);
                    std::process::exit(1);
                } else {
                    positional.push(other.to_string());
                }
            }
        }
        i += 1;
    }

    if positional.is_empty() {
        print_usage(&program);
        std::process::exit(1);
    }

    // 初始化日志文件
    if let Some(ref path) = log_path {
        let file = fs::File::create(path).expect("无法创建日志文件");
        let writer = BufWriter::new(file);
        *LOG_FILE.lock().unwrap() = Some(writer);
        log_info(&format!("日志开始，文件: {}", path.display()));
    }

    let input_path = PathBuf::from(&positional[0]);
    if !input_path.exists() {
        log_info(&format!("错误：输入路径不存在: {}", input_path.display()));
        std::process::exit(1);
    }

    let (single_file, output_path) = if input_path.is_file() {
        let default_output = input_path.with_extension("translated.js");
        let out = if positional.len() > 1 {
            PathBuf::from(&positional[1])
        } else {
            default_output
        };
        (true, out)
    } else if input_path.is_dir() {
        let out = if positional.len() > 1 {
            PathBuf::from(&positional[1])
        } else {
            input_path.join("translated")
        };
        (false, out)
    } else {
        log_info("错误：输入路径既不是文件也不是目录");
        std::process::exit(1);
    };
    // 开始时间
    let start_time = Instant::now();
    if single_file {
        process_file(&input_path, &output_path, verbose, force)?;
        log_info(&format!("翻译完成: {}", output_path.display()));
    } else {
        let extensions = ["js", "ts", "jsx", "tsx"];
        let input_base = input_path.canonicalize()?;
        let mut files = Vec::new();
        collect_files(&input_base, &input_base, &extensions, &mut files)?;

        if files.is_empty() {
            log_info("未找到任何 JavaScript/TypeScript 文件");
            return Ok(());
        }

        log_info(&format!("找到 {} 个文件待翻译", files.len()));
        if verbose {
            log_info(&format!("输出目录: {}", output_path.display()));
        }

        let input_base = input_path.canonicalize()?;
        let output_base = output_path
            .canonicalize()
            .unwrap_or_else(|_| output_path.clone());

        let sem = Arc::new(Semaphore::new(concurrency));
        let completed_counter = Arc::new(Mutex::new(0usize));
        let total_files = files.len();
        let mut handles = Vec::new();

        for file in files {
            let sem = Arc::clone(&sem);
            let completed_counter = Arc::clone(&completed_counter);
            let out_file = output_base.join(file.strip_prefix(&input_base).unwrap_or(&file));
            let verbose = verbose;
            let force = force;

            handles.push(std::thread::spawn(move || {
                sem.acquire();
                // 处理文件（内部会打印 [处理] 和 [完成]）
                let result = process_file(&file, &out_file, verbose, force);
                // 递增完成计数并报告进度
                let mut completed = completed_counter.lock().unwrap();
                *completed += 1;
                log_info(&format!(
                    "文件 {}/{} 完成: {}",
                    *completed,
                    total_files,
                    out_file.display()
                ));
                sem.release();
                result
            }));
        }

        // 等待所有线程结束，并捕捉可能的 panic
        for handle in handles {
            if let Err(e) = handle.join() {
                log_info(&format!("线程异常: {:?}", e));
            }
        }
        log_info(&format!("翻译完成，输出目录: {}", output_base.display()));
        // 结束时间
        let end_time = Instant::now();
        let duration = end_time - start_time;
        log_info(&format!("翻译完成，耗时: {:?}", duration));
    }

    // 确保日志文件被刷新
    if let Ok(mut guard) = LOG_FILE.lock() {
        if let Some(ref mut writer) = *guard {
            let _ = writer.flush();
        }
    }

    Ok(())
}
