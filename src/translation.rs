use crate::log_info;
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::Instant;
// ── 全局配置 ──
const SERVER_URL: &str = "http://localhost:12323/v1/chat/completions";
pub const MAX_NEW_TOKENS: u32 = 1024;
pub const REQUEST_TIMEOUT_SECS: u64 = 300;
pub const MAX_RETRIES: u32 = 2;

// ── 系统提示（JS 专用） ──
pub const SYSTEM_PROMPT_JS: &str = r#"你是一个 JavaScript 文档注释翻译引擎。你的任务是将 JSDoc 注释和普通注释中的英文描述翻译为简体中文。
严格遵守以下规则：
1. **只翻译自然语言描述**，绝对不要翻译或修改代码。
2. 保留所有以 `@` 开头的标签（如 @param, @type, @returns, @example 等）及其后面的花括号类型、参数名原样保留。
3. 保留所有 `{@link ...}` 形式的链接标签，原样输出。
4. 保留注释中的 HTML 标签（如 <p>, <code> 等），不要翻译或修改它们。
5. 保留所有代码示例（通常缩进 4 个空格或由反引号包围的代码块），原样输出。
6. 所有 «» 包围的占位符（如 «0»、«h3»）是系统保护标记，必须原样保留。任何 ⊂PH数字⊃ 格式的标记也是保护标记，禁止改动。
7. 输出时保持原描述的换行和缩进风格。不要添加额外的星号或注释符号。
8. 所有英文描述必须翻译成中文，但技术术语（如函数名、变量名）应酌情保留。
9. 只返回翻译后的文本，不要添加任何解释或额外内容。"#;

// 默认通用系统提示（MD，如需要可扩展）
const SYSTEM_PROMPT_MD: &str = "你是一位专业的 Markdown 本地化专家..."; // 按需填入原始 MD 提示

// ── 调试容器 ──
pub static DEBUG_SAMPLES: LazyLock<Mutex<Vec<serde_json::Value>>> =
    LazyLock::new(|| Mutex::new(Vec::new()));
pub static DEBUG_ENABLED: LazyLock<Mutex<bool>> = LazyLock::new(|| Mutex::new(false));

/// 核心翻译函数
pub fn translate_text(
    text: &str,
    verbose: bool,
    max_tokens: u32,
    file_label: &str,
    para_idx: usize,
    chunk_idx: usize,
    temperature: f32,
    custom_system_prompt: Option<&str>,
) -> String {
    let t_start = Instant::now();
    if text.trim().is_empty() || should_skip(text) {
        return text.to_owned();
    }

    // 0. 保护内联 JSDoc 标签（如 {@link ...}, {@code ...}）
    let inline_tag_re = Regex::new(r"\{@(?:link|code|linkcode|linkplain)\s+[^}]*\}").unwrap();
    let mut inline_tag_map: HashMap<String, String> = HashMap::new();
    let mut inline_counter = 0;
    let protected_inline = inline_tag_re
        .replace_all(text, |caps: &regex::Captures| {
            let key = format!("⊂INLINE{}⊃", inline_counter);
            inline_tag_map.insert(key.clone(), caps[0].to_owned());
            inline_counter += 1;
            key
        })
        .into_owned();

    // 1. 保护普通占位符 «0» / «h3» 等
    let ph_pattern = Regex::new(r"«(h?\d+)»").unwrap();
    let mut temp_map: HashMap<String, String> = HashMap::new();
    let mut counter = 0;
    let protected_text = ph_pattern
        .replace_all(&protected_inline, |caps: &regex::Captures| {
            let key = format!("⊂PH{}⊃", counter);
            temp_map.insert(key.clone(), caps[0].to_owned());
            counter += 1;
            key
        })
        .into_owned();

    // 2. 构建 payload
    let system_prompt = custom_system_prompt.unwrap_or(SYSTEM_PROMPT_JS);
    let payload = serde_json::json!({
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": format!("请翻译以下内容为简体中文：\n{}", protected_text)}
        ],
        "max_tokens": max_tokens,
        "temperature": temperature
    });
    // HTTP 请求计时
    let t_req_start = Instant::now();
    // 3. HTTP 请求（带重试）
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .expect("构建 HTTP 客户端失败");
    let t_req_end = Instant::now();
    let req_ms = t_req_end.duration_since(t_req_start).as_millis();
    let mut raw_content: Option<String> = None;
    let mut last_error = String::new();
    let mut prompt_tokens = 0u64;
    let mut completion_tokens = 0u64;
    for attempt in 0..=MAX_RETRIES {
        match client.post(SERVER_URL).json(&payload).send() {
            Ok(resp) => match resp.error_for_status() {
                Ok(resp) => match resp.json::<serde_json::Value>() {
                    Ok(data) => {
                        if let Some(choices) = data["choices"].as_array() {
                            if let Some(msg) = choices[0]["message"]["content"].as_str() {
                                raw_content = Some(msg.trim().to_owned());
                                if verbose {
                                    let usage = &data["usage"];
                                    prompt_tokens = usage
                                        .get("prompt_tokens")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0);
                                    completion_tokens = usage
                                        .get("completion_tokens")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0);
                                    log_info(&format!(
                                        "    输入 tokens: {}, 输出 tokens: {}",
                                        prompt_tokens, completion_tokens
                                    ));
                                }
                                break;
                            }
                        }
                        last_error = "响应缺少 choices".into();
                    }
                    Err(e) => last_error = format!("JSON 解析错误: {}", e),
                },
                Err(e) => last_error = format!("HTTP 状态错误: {}", e),
            },
            Err(e) => last_error = format!("请求错误: {}", e),
        }
        if attempt < MAX_RETRIES {
            eprintln!(
                "    ⚠ 翻译请求失败 (尝试 {}/{}): {}",
                attempt + 1,
                MAX_RETRIES,
                last_error
            );
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    }

    let raw = match raw_content {
        Some(r) => r,
        None => {
            eprintln!("  [翻译失败] {} – 保留原文", last_error);
            if *DEBUG_ENABLED.lock().unwrap() {
                DEBUG_SAMPLES.lock().unwrap().push(serde_json::json!({
                    "file": file_label,
                    "paragraph_index": para_idx,
                    "chunk_index": chunk_idx,
                    "protected_text": protected_text,
                    "translated_raw": null,
                    "translated_final": text,
                    "original_text_preview": &text[..std::cmp::min(200, text.len())],
                    "error": last_error
                }));
            }
            return text.to_owned();
        }
    };

    // 4. 恢复占位符：先 inline 标签，再普通占位符
    let mut content = raw.clone();
    for (key, orig) in &inline_tag_map {
        content = content.replace(key.as_str(), orig);
    }
    for (key, orig_ph) in &temp_map {
        if content.contains(key.as_str()) {
            content = content.replace(key.as_str(), orig_ph);
        } else {
            let n: String = key
                .chars()
                .skip_while(|c| !c.is_ascii_digit())
                .take_while(|c| c.is_ascii_digit())
                .collect();
            let variants = [
                format!("⊂PH{}⊃", n),
                format!("⊂PH{}", n),
                format!("PH{}⊃", n),
                format!("⊂PH{} ", n),
            ];
            for var in &variants {
                if content.contains(var) {
                    content = content.replace(var, orig_ph);
                    break;
                }
            }
        }
    }
    // 清除任何残留的临时标记
    let leftover_re = Regex::new(r"⊂\s*PH\s*\d+\s*⊃?").unwrap();
    content = leftover_re.replace_all(&content, "").into_owned();

    // 5. 重试检查（如果翻译结果仍含大量英文单词）
    if temperature < 0.1 && needs_retry(&content, text) {
        for attempt in 1..=MAX_RETRIES {
            eprintln!("    ⚠ 检测到未翻译内容，重试 ({}/{})", attempt, MAX_RETRIES);
            let retry_text = translate_text(
                text,
                verbose,
                max_tokens,
                file_label,
                para_idx,
                chunk_idx,
                temperature + 0.2,
                custom_system_prompt,
            );
            if !needs_retry(&retry_text, text) {
                return retry_text;
            }
        }
    }

    // 6. 记录调试信息
    if *DEBUG_ENABLED.lock().unwrap() {
        DEBUG_SAMPLES.lock().unwrap().push(serde_json::json!({
            "file": file_label,
            "paragraph_index": para_idx,
            "chunk_index": chunk_idx,
            "protected_text": protected_text,
            "translated_raw": raw,
            "translated_final": content,
            "original_text_preview": &text[..std::cmp::min(200, text.len())]
        }));
    }
    let total_ms = t_start.elapsed().as_millis();
    log_info(&format!(
        "    翻译耗时: 总计{}ms (网络{}ms), tokens: {}→{}",
        total_ms, req_ms, prompt_tokens, completion_tokens
    ));

    content
}
/// 改进版重试判断：忽略不可见字符差异，排除标识符，避免误判
fn needs_retry(translated: &str, original: &str) -> bool {
    // 如果翻译结果中包含至少3个中文字符，说明已有实质性翻译，不再重试
    let chinese_chars = translated
        .chars()
        .filter(|c| ('\u{4e00}'..='\u{9fa5}').contains(c))
        .count();
    if chinese_chars >= 3 {
        return false;
    }

    let normalize = |s: &str| -> String {
        let re = Regex::new(r"«h?\d+»|⊂PH\d+⊃|⊂INLINE\d+⊃|\s+").unwrap();
        re.replace_all(s, " ").trim().to_owned()
    };
    let norm_orig = normalize(original);
    let norm_trans = normalize(translated);

    if norm_orig == norm_trans {
        return false;
    }

    let is_identifier = |word: &str| -> bool {
        word.len() > 1
            && word
                .chars()
                .all(|c| c.is_uppercase() || c == '_' || c.is_numeric())
    };

    let eng_words = |s: &str| -> usize {
        Regex::new(r"\b[a-zA-Z]{2,}\b")
            .unwrap()
            .find_iter(s)
            .filter(|m| !is_identifier(m.as_str()))
            .count()
    };

    let eng_trans = eng_words(&norm_trans);
    let total_trans = norm_trans.split_whitespace().count();
    if total_trans == 0 {
        return false;
    }
    let eng_orig = eng_words(&norm_orig);
    let total_orig = norm_orig.split_whitespace().count().max(1);
    if eng_orig as f64 / (total_orig as f64) < 0.5 {
        return false;
    }
    (eng_trans as f64 / total_trans as f64) > 0.3
}

/// 判断文本是否应该跳过翻译（如纯代码、纯符号、无英文的自然语言等）
static SKIP_PLACEHOLDER_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"«h?\d+»|⊂PH\d+⊃|⊂INLINE\d+⊃").unwrap());
static NATURAL_WORD_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"\b(the|is|are|a|an|this|that|it|you|not|for|with|from|and|or|in|on|of|to)\b"#)
        .unwrap()
});
static HAS_ALPHA_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"[a-zA-Z]{2,}").unwrap());

pub fn should_skip(text: &str) -> bool {
    let cleaned = SKIP_PLACEHOLDER_RE.replace_all(text, "");
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        return true;
    }
    if (trimmed.contains('(') && trimmed.contains(')'))
        || trimmed.contains('=')
        || trimmed.contains(';')
    {
        if !NATURAL_WORD_RE.is_match(trimmed) {
            return true;
        }
    }
    if !trimmed.contains(' ') {
        return true;
    }
    if !HAS_ALPHA_RE.is_match(trimmed) {
        return true;
    }
    false
}
