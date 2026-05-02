use regex::Regex;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

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
    if text.trim().is_empty() {
        return text.to_owned();
    }

    // 1. 保护占位符 «0» / «h3» 等
    let ph_pattern = Regex::new(r"«(h?\d+)»").unwrap();
    let mut temp_map: HashMap<String, String> = HashMap::new();
    let mut counter = 0;

    let protected_text = ph_pattern
        .replace_all(text, |caps: &regex::Captures| {
            let key = format!("⊂PH{}⊃", counter);
            temp_map.insert(key.clone(), caps[0].to_owned());
            counter += 1;
            key
        })
        .into_owned();

    // 2. 构建请求
    let system_prompt = custom_system_prompt.unwrap_or(SYSTEM_PROMPT_MD);
    let user_message = format!("请翻译以下内容为简体中文：\n{}", protected_text);

    let payload = serde_json::json!({
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_message }
        ],
        "max_tokens": max_tokens,
        "temperature": temperature
    });

    // 3. 发送 HTTP 请求（带重试）
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .unwrap();

    let mut raw_content: Option<String> = None;
    let mut last_error = String::new();

    for attempt in 0..=MAX_RETRIES {
        let response = client
            .post(SERVER_URL)
            .json(&payload)
            .send()
            .and_then(|r| r.error_for_status());

        match response {
            Ok(resp) => match resp.json::<serde_json::Value>() {
                Ok(data) => {
                    if let Some(choices) = data["choices"].as_array() {
                        if let Some(msg) = choices[0]["message"]["content"].as_str() {
                            raw_content = Some(msg.trim().to_owned());
                            if verbose {
                                let usage = &data["usage"];
                                eprintln!(
                                    "    输入 tokens: {}, 输出 tokens: {}",
                                    usage
                                        .get("prompt_tokens")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0),
                                    usage
                                        .get("completion_tokens")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0)
                                );
                            }
                            break;
                        }
                    }
                    last_error = "Response missing choices".into();
                }
                Err(e) => last_error = format!("JSON parse error: {}", e),
            },
            Err(e) => last_error = format!("HTTP error: {}", e),
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
            // 记录调试信息
            if let Ok(debug) = DEBUG_ENABLED.lock() {
                if *debug {
                    if let Ok(mut samples) = DEBUG_SAMPLES.lock() {
                        samples.push(serde_json::json!({
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
                }
            }
            return text.to_owned();
        }
    };

    // 4. 恢复临时标记
    let mut content = raw.clone();
    for (key, orig_ph) in &temp_map {
        if content.contains(key.as_str()) {
            content = content.replace(key.as_str(), orig_ph);
        } else {
            // 尝试恢复丢失的标记
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

    // 清除残留的临时标记
    let leftover_re = Regex::new(r"⊂\s*PH\s*\d+\s*⊃?").unwrap();
    content = leftover_re.replace_all(&content, "").into_owned();

    // 5. 重试检查（仅当温度低时检查）
    if temperature < 0.1 && needs_retry(&content, text) {
        for attempt in 1..=MAX_RETRIES {
            eprintln!("    ⚠ 检测到未翻译内容，重试 ({}/{})", attempt, MAX_RETRIES);
            // 提高温度重新翻译
            let retry_temp = temperature + 0.2;
            let retry_text = translate_text(
                text,
                verbose,
                max_tokens,
                file_label,
                para_idx,
                chunk_idx,
                retry_temp,
                custom_system_prompt,
            );
            if !needs_retry(&retry_text, text) {
                return retry_text;
            }
        }
    }

    // 6. 保存调试样本
    if let Ok(debug) = DEBUG_ENABLED.lock() {
        if *debug {
            if let Ok(mut samples) = DEBUG_SAMPLES.lock() {
                samples.push(serde_json::json!({
                    "file": file_label,
                    "paragraph_index": para_idx,
                    "chunk_index": chunk_idx,
                    "protected_text": protected_text,
                    "translated_raw": raw,
                    "translated_final": content,
                    "original_text_preview": &text[..std::cmp::min(200, text.len())]
                }));
            }
        }
    }

    content
}

/// 检查翻译结果是否仍需重试（英文单词占比 > 30%）
fn needs_retry(translated: &str, original: &str) -> bool {
    // 剔除占位符
    let placeholder_re = Regex::new(r"«h?\d+»|⊂PH\d+⊃").unwrap();
    let clean_trans = placeholder_re.replace_all(translated, "").trim().to_owned();
    let clean_orig = placeholder_re.replace_all(original, "").trim().to_owned();

    // 英文单词计数
    let eng_count = |s: &str| -> usize {
        let eng_re = Regex::new(r"\b[a-zA-Z]{2,}\b").unwrap();
        eng_re.find_iter(s).count()
    };
    let total_words = |s: &str| -> usize { s.split_whitespace().count() };

    let eng_tr = eng_count(&clean_trans);
    let total_tr = total_words(&clean_trans);
    if total_tr == 0 {
        return false;
    }

    let eng_or = eng_count(&clean_orig);
    let total_or = total_words(&clean_orig).max(1);
    if eng_or as f64 / (total_or as f64) < 0.5 {
        return false;
    }

    (eng_tr as f64 / total_tr as f64) > 0.3
}
