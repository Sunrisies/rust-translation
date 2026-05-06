// src/md_translation.rs

use regex::Regex;
use std::collections::HashMap;

use crate::translation; // 复用现有翻译 API

// ── MD 专用系统提示 ──
pub const SYSTEM_PROMPT_MD: &str = r#"你是一位专业的 Markdown 本地化专家，专注于 Rust 语言文档的翻译。请将用户提供的英文文本翻译为简体中文，并严格遵守以下规则：
1. 只输出翻译结果，不要添加任何额外的解释、注释或标签。
2. 保留原文中的所有换行、空格、标点风格和缩进结构。
3. **绝对不要翻译**：代码片段、变量名、函数名、路径、URL、命令行指令、文件扩展名。
4. 对于 Rust 技术名词，遵循以下约定：
   - 保留不译的：`crate`、`trait`、`match`（关键字）、`impl`、`unsafe`、`macro`；
   - 统一翻译的：`ownership` → 所有权，`lifetime` → 生命周期，`borrow checker` → 借用检查器，`closure` → 闭包，`iterator` → 迭代器，`pattern matching` → 模式匹配，`smart pointer` → 智能指针；
   - 表格中的英文说明文字（如 'Left-shift'、'Bitwise OR'）属于自然语言，应翻译为中文。
5. 所有用 «» 包围的占位符（如 `«0»`、`«42»`、`«h3»`）是系统保护标记，**必须原样保留**，不要修改、翻译或在其中添加空格或换行。
   同样，任何 `⊂PH数字⊃` 格式的标记也是保护标记，禁止改动。
6. 对于 Markdown 链接 `[text](url)` 和图片 `![alt](url)`，只翻译方括号内的显示文本，保留 URL 和全部分隔符。
7. 保持原有的 Markdown 块引用符号（每行开头的 `> ` 必须完整保留，不要删除或修改）。列表符号（-、*、1. 等）也必须原样保留。
8. 如果遇到无法确定或无法准确翻译的术语，直接保留原文。
9. **所有英文句子或段落都必须翻译成中文**，即使包含技术词汇也不能保留英文原文。
10. 仅翻译自然语言文本（普通句子、段落、标题、列表项），技术名词按上述规则处理。"#;

// ── 占位符管理器 ──
pub struct PlaceholderManager {
    map: HashMap<String, String>,
    counter: usize,
}

impl PlaceholderManager {
    pub fn new() -> Self {
        PlaceholderManager {
            map: HashMap::new(),
            counter: 0,
        }
    }

    pub fn protect(&mut self, content: String) -> String {
        let ph = format!("«{}»", self.counter);
        self.map.insert(ph.clone(), content);
        self.counter += 1;
        ph
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    // 恢复占位符，支持模糊匹配（防止 LLM 修改格式）
    pub fn restore(&self, text: &str) -> String {
        // 预处理：将常见的错误符号修复为正确的«»
        let fixed = text
            .replace('⊂', "«")
            .replace('⊃', "»")
            .replace('《', "«") // 有时双书名号也会出现
            .replace('》', "»");

        let mut result = fixed;
        // 按编号从大到小替换
        let mut keys: Vec<(usize, String)> = self
            .map
            .keys()
            .map(|k| {
                let num = k
                    .trim_start_matches('«')
                    .trim_end_matches('»')
                    .parse::<usize>()
                    .unwrap_or(0);
                (num, k.clone())
            })
            .collect();
        keys.sort_by_key(|(num, _)| *num);
        keys.reverse();

        for (_, ph) in keys {
            let orig = &self.map[&ph];
            if result.contains(&ph) {
                result = result.replace(&ph, orig);
            } else {
                // 额外尝试：ph 本身可能已被修复，但编号数字前后可能有多余空格
                let n_str = ph.trim_start_matches('«').trim_end_matches('»');
                let loose_re = Regex::new(&format!(r"«\s*{}\s*»", regex::escape(n_str))).unwrap();
                if let Some(m) = loose_re.find(&result) {
                    result = result.replace(m.as_str(), orig);
                } else {
                    // 最终回退：若仍找不到，记录警告并移除残留占位符
                    log_info(&format!("    ⚠ 占位符 {} 未能恢复，已从输出中移除", ph));
                }
            }
        }

        // 清除仍残留的任何正确格式占位符（安全措施）
        let leftover_re = Regex::new(r"«\s*\d+\s*»").unwrap();
        result = leftover_re.replace_all(&result, "").to_string();
        result
    }
}

// ── 工具函数：判断表格行 ──
fn is_table_line(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.starts_with('|') && trimmed.matches('|').count() >= 2
}

fn is_table_separator(line: &str) -> bool {
    let trimmed = line.trim();
    if !trimmed.starts_with('|') || !trimmed.ends_with('|') {
        return false;
    }
    // 格式：| --- | :---: | 等
    let re = Regex::new(r"^(\|[\s\-:]+)+\|$").unwrap();
    re.is_match(trimmed)
}

// ── 整篇 Markdown 保护 ──
pub fn protect_markdown(md: &str) -> (String, PlaceholderManager, PlaceholderManager) {
    let mut regular_ph = PlaceholderManager::new();
    let mut table_ph = PlaceholderManager::new();

    let mut text = md.to_owned();

    // 1) 保护 HTML 注释
    let html_comment_re = Regex::new(r"<!--[\s\S]*?-->").unwrap();
    text = html_comment_re
        .replace_all(&text, |caps: &regex::Captures| {
            regular_ph.protect(caps[0].to_owned())
        })
        .to_string();

    // 2) 保护代码块 (``` ... ```)
    let code_block_re = Regex::new(r"```[\s\S]*?```").unwrap();
    text = code_block_re
        .replace_all(&text, |caps: &regex::Captures| {
            regular_ph.protect(caps[0].to_owned())
        })
        .to_string();

    // 3) 保护行内代码 (`...`)
    let inline_code_re = Regex::new(r"`[^`]+`").unwrap();
    text = inline_code_re
        .replace_all(&text, |caps: &regex::Captures| {
            regular_ph.protect(caps[0].to_owned())
        })
        .to_string();

    // 4) 保护 HTML 标签
    let html_tag_re = Regex::new(r"<[^>]+>").unwrap();
    text = html_tag_re
        .replace_all(&text, |caps: &regex::Captures| {
            regular_ph.protect(caps[0].to_owned())
        })
        .to_string();

    // 5) 保护链接定义 [id]: url
    let link_def_re = Regex::new(r"^\[[^]]+\]:\s*\S.*(?:\n[ \t]+.*)*").unwrap();
    text = link_def_re
        .replace_all(&text, |caps: &regex::Captures| {
            regular_ph.protect(caps[0].to_owned())
        })
        .to_string();

    // 6) 保护链接使用 [text][id] 或 [text](url)（这里只保护引用式 [text][id]）
    let link_use_re = Regex::new(r"\[([^\[\]]+)\]\[([^\[\]]*)\]").unwrap();
    text = link_use_re
        .replace_all(&text, |caps: &regex::Captures| {
            regular_ph.protect(caps[0].to_owned())
        })
        .to_string();

    // 7) 保护表格（整个表格作为一个单元，避免分块截断）
    let table_re =
        Regex::new(r"(?:^\|.+\|[ \t]*\n)+^\|[\s\-:|]+\|[ \t]*\n(?:^\|.+\|[ \t]*\n?)+").unwrap();
    text = table_re
        .replace_all(&text, |caps: &regex::Captures| {
            table_ph.protect(caps[0].to_owned())
        })
        .to_string();

    (text, regular_ph, table_ph)
}

/// 将长段落按句子分割，尽量在句子边界断开，同时确保不超过 max_len
fn split_paragraph_sentences(paragraph: &str, max_len: usize) -> Vec<String> {
    let sentence_re = Regex::new(r"(?<=[。！？;.!\n])").unwrap();
    let raw: Vec<&str> = sentence_re.split(paragraph).collect();
    let mut chunks = Vec::new();
    let mut cur = String::new();
    for s in raw {
        if cur.len() + s.len() > max_len && !cur.is_empty() {
            chunks.push(cur.trim().to_owned());
            cur = s.to_owned();
        } else {
            cur.push_str(s);
        }
    }
    if !cur.trim().is_empty() {
        chunks.push(cur.trim().to_owned());
    }
    chunks
}
// ── 分块（段落级 + 句子级） ──
fn split_by_sentences(paragraph: &str, max_len: usize) -> Vec<String> {
    let sentence_re = Regex::new(r"(?<=[。！？;.!\n])").unwrap();
    let raw: Vec<&str> = sentence_re.split(paragraph).collect();
    let mut chunks = Vec::new();
    let mut cur = String::new();
    for s in raw {
        if cur.len() + s.len() > max_len && !cur.is_empty() {
            chunks.push(cur.trim().to_owned());
            cur = s.to_owned();
        } else {
            cur.push_str(s);
        }
    }
    if !cur.trim().is_empty() {
        chunks.push(cur.trim().to_owned());
    }
    chunks
}
fn chunk_markdown(text: &str, max_len: usize) -> Vec<String> {
    // 按双换行分段
    let parts: Vec<&str> = text.split("\n\n").collect();
    let mut chunks = Vec::new();
    for para in parts {
        let para = para.trim();
        if para.is_empty() {
            continue;
        }
        if para.len() <= max_len {
            chunks.push(para.to_owned());
        } else {
            let sub = split_by_sentences(para, max_len);
            chunks.extend(sub);
        }
    }
    chunks
}

/// 段落级分块（表格感知）。源码已被保护，故占位符较长，max_len 为字符数限制
fn chunk_by_paragraphs(text: &str, max_len: usize) -> Vec<String> {
    // 按双换行分割段落
    let paragraph_re = Regex::new(r"\n\s*\n").unwrap();
    let raw_paras: Vec<&str> = paragraph_re.split(text).collect();
    let mut chunks = Vec::new();
    let mut current = String::new();

    for para in &raw_paras {
        let para_text = *para;
        if para_text.trim().is_empty() {
            continue;
        }
        // 如果是表格（已被替换为占位符，但此处已保护，所以不会出现表格内容，但保留逻辑）
        if current.is_empty() && para_text.len() <= max_len {
            chunks.push(para_text.to_owned());
            continue;
        }

        if current.len() + para_text.len() + 2 > max_len {
            // +2 for \n\n
            if !current.is_empty() {
                chunks.push(current.trim().to_owned());
                current.clear();
            }
            if para_text.len() > max_len {
                // 再按句子分割
                let sub_chunks = split_paragraph_sentences(para_text, max_len);
                for sub in sub_chunks {
                    chunks.push(sub);
                }
            } else {
                current = para_text.to_owned();
            }
        } else {
            if !current.is_empty() {
                current.push_str("\n\n");
            }
            current.push_str(para_text);
        }
    }
    if !current.trim().is_empty() {
        chunks.push(current.trim().to_owned());
    }
    chunks
}

/// 判断段落是否为纯占位符
fn is_pure_placeholder(para: &str) -> bool {
    let re = Regex::new(r"«\d+»|⊂PH\d+⊃").unwrap();
    let cleaned = re.replace_all(para, "").trim().to_string();
    cleaned.is_empty()
}

// ── 表格翻译 ──
pub fn translate_markdown_table(table_text: &str) -> String {
    // 表格被整体保护，但翻译时我们需要将其按批次翻译
    // 注意：这里的 table_text 是原始表格，被保护后替换为占位符，但恢复时调用此函数翻译原始表格
    let lines: Vec<&str> = table_text.lines().collect();
    if lines.len() < 2 {
        return translate_long_text(table_text);
    }

    // 分离表前文本和表格主体
    let mut pre_lines = Vec::new();
    let mut table_start = 0;
    for (idx, line) in lines.iter().enumerate() {
        if is_table_line(line) {
            table_start = idx;
            break;
        }
        pre_lines.push(line.to_owned());
    }
    let table_body: Vec<String> = lines[table_start..].iter().map(|&s| s.to_owned()).collect();

    if table_body.len() < 2 {
        return translate_long_text(table_text);
    }

    // 寻找分隔行
    let sep_idx = table_body.iter().position(|line| is_table_separator(line));
    let sep_idx = match sep_idx {
        Some(i) => i,
        None => return translate_long_text(table_text),
    };

    // 保护表格中的 HTML 标签为临时占位符
    let mut html_ph = PlaceholderManager::new();
    let tag_re = Regex::new(r"<[^>]+>").unwrap();
    let protected_body: String = table_body.join("\n");
    let protected_body = tag_re.replace_all(&protected_body, |caps: &regex::Captures| {
        html_ph.protect(caps[0].to_owned())
    });

    let prot_lines: Vec<&str> = protected_body.lines().collect();
    let header_block = &prot_lines[..=sep_idx].join("\n");
    let data_rows = &prot_lines[sep_idx + 1..];

    // 分批发送，每批不超过 MAX_CHUNK_CHARS
    let max_chunk = 2500; // 与 Python 保持一致
    let mut batches = Vec::new();
    let mut cur = header_block.clone();
    for row in data_rows {
        if cur.len() + row.len() + 1 > max_chunk && cur != *header_block {
            batches.push(cur);
            cur = format!("{}\n{}", header_block, row);
        } else {
            cur = format!("{}\n{}", cur, row);
        }
    }
    if !cur.trim().is_empty() {
        batches.push(cur);
    }
    if batches.is_empty() {
        batches.push(protected_body.to_string());
    }

    // 翻译每个批次
    let translated_batches: Vec<String> = batches
        .iter()
        .enumerate()
        .map(|(i, batch)| {
            let trans = translation::translate_text(
                batch,
                true,
                4096, // TABLE_MAX_TOKENS
                "table",
                i,
                0,
                0.0,
                Some(SYSTEM_PROMPT_MD),
            );
            trans
        })
        .collect();

    // 合并批次：后续批次跳过表头行
    let mut combined = translated_batches[0].clone();
    for bat in &translated_batches[1..] {
        let blines: Vec<&str> = bat.lines().collect();
        if let Some(sep_pos) = blines.iter().position(|&l| is_table_separator(l)) {
            if sep_pos + 1 < blines.len() {
                let rest = &blines[sep_pos + 1..].join("\n");
                if !rest.trim().is_empty() {
                    combined.push_str("\n");
                    combined.push_str(rest);
                }
            }
        }
    }

    // 恢复 HTML 标签
    let mut final_table = html_ph.restore(&combined);

    // 翻译表前文本
    let mut translated_pre: Vec<String> = Vec::new();
    for line in &pre_lines {
        if line.trim().is_empty() {
            translated_pre.push(line.to_string());
        } else {
            translated_pre.push(translate_long_text(line));
        }
    }

    if translated_pre.is_empty() {
        final_table
    } else {
        format!("{}\n\n{}", translated_pre.join("\n"), final_table)
    }
}

/// 长文本翻译入口：分块后翻译
pub fn translate_long_text(text: &str) -> String {
    let chunks = chunk_markdown(text, 2500);
    if chunks.is_empty() {
        return String::new();
    }
    if chunks.len() == 1 && !is_pure_placeholder(&chunks[0]) {
        return translate_with_retry(&chunks[0]);
    }

    let mut translated = Vec::new();
    for chunk in &chunks {
        if is_pure_placeholder(chunk) {
            translated.push(chunk.clone());
        } else {
            translated.push(translate_with_retry(chunk));
        }
    }
    translated.join("\n\n")
}

fn translate_with_retry(text: &str) -> String {
    let mut result = translation::translate_text(
        text,
        true,
        1024, // MAX_NEW_TOKENS
        "md",
        0,
        0,
        0.0,
        Some(SYSTEM_PROMPT_MD),
    );
    if needs_retry_md(&result, text) {
        for _ in 0..2 {
            // MAX_RETRIES = 2
            result = translation::translate_text(
                text,
                true,
                1024,
                "md",
                0,
                0,
                0.2,
                Some(SYSTEM_PROMPT_MD),
            );
            if !needs_retry_md(&result, text) {
                break;
            }
        }
    }
    result
}

fn needs_retry_md(translated: &str, original: &str) -> bool {
    // 与 JS 版本类似，但这里简化：如果结果中英文字母占比 > 30% 则重试
    let clean_trans = Regex::new(r"«h?\d+»|⊂PH\d+⊃")
        .unwrap()
        .replace_all(translated, "")
        .trim()
        .to_owned();
    let clean_orig = Regex::new(r"«h?\d+»|⊂PH\d+⊃")
        .unwrap()
        .replace_all(original, "")
        .trim()
        .to_owned();

    let eng_count = |s: &str| -> usize {
        Regex::new(r"\b[a-zA-Z]{2,}\b")
            .unwrap()
            .find_iter(s)
            .count()
    };
    let total_words = |s: &str| -> usize { s.split_whitespace().count() };

    let eng_trans = eng_count(&clean_trans);
    let total_trans = total_words(&clean_trans);
    if total_trans == 0 || clean_trans.len() < 5 {
        return false;
    }
    let eng_orig = eng_count(&clean_orig);
    let total_orig = total_words(&clean_orig).max(1);
    if eng_orig as f64 / (total_orig as f64) < 0.5 {
        return false;
    }
    (eng_trans as f64 / total_trans as f64) > 0.3
}

/// 转换 <Listing> 为 Markdown 标准格式
pub fn convert_listing_to_markdown(text: &str) -> String {
    let re = Regex::new(
        r#"<Listing\s+number="(?P<num>[^"]*)"\s+file-name="(?P<file>[^"]*)"\s+caption="(?P<cap>[^"]*)"\s*>\s*(?P<body>[\s\S]*?)</Listing>"#
    ).unwrap();
    re.replace_all(text, |caps: &regex::Captures| {
        let num = caps.name("num").map_or("", |m| m.as_str());
        let file = caps.name("file").map_or("", |m| m.as_str());
        let cap = caps.name("cap").map_or("", |m| m.as_str());
        let body = caps.name("body").map_or("", |m| m.as_str()).trim();
        format!("**Listing {}:** *{}* — {}\n\n{}", num, file, cap, body)
    })
    .to_string()
}

/// 处理 Markdown 文件的主函数
pub fn translate_markdown_file(md_src: &str) -> String {
    // 1. 转换 <Listing>
    let converted = convert_listing_to_markdown(md_src);

    // 2. 保护阶段
    let (protected, regular_phs, table_phs) = protect_markdown(&converted);
    log_info(&format!(
        "  保护: {} 个普通占位符, {} 个表格占位符",
        regular_phs.len(),
        table_phs.len()
    ));

    // 3. 段落翻译
    let paragraphs = protected.split("\n\n");
    let mut translated_paras = Vec::new();
    for para in paragraphs {
        if para.trim().is_empty() || is_pure_placeholder(para) {
            translated_paras.push(para.to_owned());
        } else {
            translated_paras.push(translate_long_text(para));
        }
    }
    let mut translated = translated_paras.join("\n\n");

    // 4. 恢复表格占位符（需要翻译原始表格）
    let table_ph_list: Vec<(String, String)> = table_phs.map.into_iter().collect();
    for (ph, orig_table) in &table_ph_list {
        let trans_table = translate_markdown_table(orig_table);
        translated = translated.replace(ph, &trans_table);
    }

    // 5. 恢复普通占位符
    let final_text = regular_phs.restore(&translated);
    final_text
}

// 引入 log_info（来自 crate::log_info）
use crate::log_info;
