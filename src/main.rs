mod translation;
use serde::Serialize;
use std::{fmt, fs, path::Path};
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

// ── 演示用法 ──
fn main() {
    let file_path = "./example/example1.js";
    let source = fs::read_to_string(file_path).expect("无法读取文件");

    let comments = extract_comments(&source);

    // 1. 将提取的注释详情写入 JSON 文件（便于查看或批量翻译）
    let comments_json = serde_json::to_string_pretty(&comments).unwrap_or_else(|_| "[]".into());
    let comments_file = Path::new(file_path).with_extension("comments.json");
    fs::write(&comments_file, comments_json).expect("无法写入注释 JSON");
    println!("注释信息已保存至: {:?}", comments_file);
    // ── 翻译注释（区分 Block 和 Line） ──
    let translated: Vec<String> = comments
        .iter()
        .enumerate()
        .map(|(idx, c)| {
            if c.raw.trim().is_empty() {
                return c.raw.clone();
            }

            match c.kind {
                CommentKind::Line => {
                    // 单行注释：去掉 // 后翻译，再组装
                    let inner = c.raw.trim_start_matches("//").trim();
                    if inner.is_empty() {
                        return c.raw.clone();
                    }
                    let trans = translation::translate_text(
                        inner,
                        true,
                        1024,
                        file_path,
                        idx,
                        0,
                        0.0,
                        Some(translation::SYSTEM_PROMPT_JS),
                    );
                    format!("// {}", trans)
                }
                CommentKind::Block => {
                    // 多行注释：按行解析，保护 JSDoc 标签
                    translate_block_comment(&c.raw, file_path, idx)
                }
            }
        })
        .collect();
    // 3. 替换回源码
    let new_source = replace_comments(&source, &translated);

    // 4. 写入翻译后的 JS 文件
    let output_path = Path::new(file_path).with_extension("translated.js");
    fs::write(&output_path, new_source).expect("无法写入翻译后的文件");
    println!("翻译后的文件已保存至: {:?}", output_path);
}

/// 精确翻译多行注释：保留所有缩进、* 前缀、空行、JSDoc 标签结构
fn translate_block_comment(raw: &str, file_label: &str, comment_idx: usize) -> String {
    let lines: Vec<&str> = raw.lines().collect();
    if lines.len() <= 2 {
        // 极短注释（例如单行 /* xxx */），按整体处理
        let inner = &raw[2..raw.len() - 2]; // 去掉开头 /* 和结尾 */
        let trans = translation::translate_text(
            inner.trim(),
            false,
            1024,
            file_label,
            comment_idx,
            0,
            0.0,
            Some(translation::SYSTEM_PROMPT_JS),
        );
        return format!("/* {} */", trans);
    }

    let mut rebuilt: Vec<String> = Vec::new();

    // 正则：匹配一行注释的三个部分 —— 前导空白 + 星号及紧接的空格 + 剩余内容
    let line_re = regex::Regex::new(r"^(\s*\*\s?)(.*)$").unwrap();

    for line in lines {
        if let Some(caps) = line_re.captures(line) {
            let prefix = caps.get(1).map(|m| m.as_str()).unwrap_or("* "); // 如 "   * " 或 " *"
            let content = caps.get(2).map(|m| m.as_str()).unwrap_or("");

            // 如果是纯星号行或内容为空，保留原样
            if content.trim().is_empty() {
                rebuilt.push(line.to_owned());
                continue;
            }

            // 检查是否为 JSDoc 标签行（以 @ 开头，可能含 {type} 和 name）
            if let Some(stripped) = content.trim().strip_prefix('@') {
                // 解析标签：@tagname {type} [name] description
                let tag_re =
                    regex::Regex::new(r"^(\w+)(\s+\{[^}]*\})?(\s+\[?[^\s\]]*\]?)?(?:\s+(.*))?")
                        .unwrap();
                if let Some(tag_caps) = tag_re.captures(stripped) {
                    let tag = tag_caps.get(1).map(|m| m.as_str()).unwrap_or("");
                    let type_part = tag_caps.get(2).map(|m| m.as_str()).unwrap_or("");
                    let name_part = tag_caps.get(3).map(|m| m.as_str()).unwrap_or("");
                    let desc = tag_caps.get(4).map(|m| m.as_str()).unwrap_or("");

                    if desc.is_empty() {
                        // 无描述：原样保留整行
                        rebuilt.push(line.to_owned());
                    } else {
                        // 只翻译描述部分
                        let trans_desc = translation::translate_text(
                            desc,
                            false,
                            1024,
                            file_label,
                            comment_idx,
                            0,
                            0.0,
                            Some(translation::SYSTEM_PROMPT_JS),
                        );
                        // 重新组装：@tag {type} name 翻译的描述
                        let new_content =
                            format!("@{}{}{} {}", tag, type_part, name_part, trans_desc);
                        // 注意：前缀保持不变，因此缩进完整保留
                        rebuilt.push(format!("{}{}", prefix, new_content));
                    }
                } else {
                    // 无法解析的标签行，保留原样
                    rebuilt.push(line.to_owned());
                }
            } else {
                // 普通文本行：整行翻译（保留前缀）
                let trans = translation::translate_text(
                    content,
                    false,
                    1024,
                    file_label,
                    comment_idx,
                    0,
                    0.0,
                    Some(translation::SYSTEM_PROMPT_JS),
                );
                rebuilt.push(format!("{}{}", prefix, trans));
            }
        } else {
            // 首行或尾行（/** 或 */），直接保留
            rebuilt.push(line.to_owned());
        }
    }

    rebuilt.join("\n")
}
