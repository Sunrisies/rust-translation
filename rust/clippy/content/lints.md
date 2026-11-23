# Clippy 的lint 检查

Clippy 提供了许多额外的 lint 检查，帮助用户编写更正确且符合 Rust 风格的代码。所有 lint 检查的完整列表可以根据类别、lint 级别或关键词进行筛选，详情请参阅 [Clippy lint 文档]。

本章详细介绍了不同的 lint 类别，它们提供何种类型的 lint 检查，以及当遇到该类别中的 lint 时应该采取什么措施。有关示例，请查看 [Clippy lint 文档] 并按类别筛选。关于这些类别的概述，请参阅 [介绍](index.md)。

不同的 lint 组是在 [Clippy 1.0 RFC]中定义的。

## Correctness

`clippy::correctness` 组是 Clippy 中唯一的 lint 组，其 lint 检查默认被拒绝并在触发时中止编译。这是有原因的：如果你看到 `correctness` lint，意味着你的代码明显错误或无用，你应该尝试修复它。

该类别中的 lint 经过精心挑选，不应出现误报。因此不建议仅通过 `#[allow]` 来允许这些 lint。

## Suspicious

`clippy::suspicious` 组与 `correctness` lint 类似，包含针对真正存在问题的代码触发的 lint，这些问题需要修复。与 `correctness` lint 不同，`clippy::suspicious` 中的代码可能是故意这样编写的。

仍然建议修复由该组 lint 触发的代码，而不是通过 `#[allow]` 来允许这些 lint。如果你故意编写了冒犯 lint 的代码，应该具体且局部地通过 `#[allow]` 允许该 lint，并说明为什么该代码按当前形式是正确的。

## Complexity

`clippy::complexity` 组提供一些 lint 检查，建议你如何简化代码。它主要关注那些可以通过更短、更易读的方式编写同时保持语义的代码。

如果你看到 `complexity` lint，通常意味着你可以删除或替换某些代码，并且建议这样做。然而，如果出于表达性需求需要更复杂的代码，建议逐例允许 `complexity` lint 检查。

## Perf

`clippy::perf` 组提供了关于如何提升代码性能的建议。这些检查主要针对那些编译器无法简单优化的代码，必须采用稍微不同的写法才能让优化器更容易工作。

Perf 检查通常很容易应用，建议进行应用。

## Style

`clippy::style` 组主要关注编写符合语言习惯的代码。由于风格具有主观性，这是 Clippy 中默认带有警告且意见最鲜明的检查组。

如果你看到风格检查，应用这些建议通常会使代码更具可读性并更符合语言习惯。但由于我们知道这种检查具有主观性，你可以随意在代码中添加 `#[allow]` 标签，或者完全不同意所建议的风格时，在整个 crate 上使用 `#![allow]` 来禁用该检查。

## Pedantic

`clippy::pedantic` 组让 Clippy 更加“苛求”。你可以在你的 crate 的 `lib.rs`/`main.rs` 中通过 `#![warn(clippy::pedantic)]` 启用整个组。这个检查组适用于希望对代码进行深度检查的高级用户。

> [!NOTE] > 与其启用整个组（就像 Clippy 本身那样），你可能更想从 pedantic 组中挑选特定的检查项来使用。

如果你启用这个组，预计需要在代码中大量使用 `#[allow]` 属性。该组中的检查旨在确保严格性，有时故意设置假阳性以避免假阴性。

## Restriction

`clippy::restriction` 组包含那些会限制你使用 Rust 语言某些部分的检查。不建议启用整个组，而是应该挑选对你的代码库和用例有用的检查项。

> [!NOTE] > 如果 Clippy 在你的代码中发现 `#![warn(clippy::restriction)]` 属性，它会发出警告！

该组中的检查会在某种程度上限制你。如果你为你的 crate 启用限制检查，建议同时修复由该检查触发的问题。不过，这些检查设计上非常严格，你可能需要在某些特殊情况下使用 `#[allow]` 来允许它们，并附上解释性的注释。

## Cargo

`clippy::cargo` 组提供了关于如何优化 `Cargo.toml` 文件的建议。如果你打算发布你的 crate，并且不确定 `Cargo.toml` 中是否包含了所有有用的信息，这可能会特别有趣。

## Nursery

`clippy::nursery` 组包含有缺陷或需要更多优化的 lint 规则。不建议启用整个组，而是应该挑选对代码库和用例有用的特定 lint 规则。

## Deprecated

`clippy::deprecated` 是空的 lint 规则，其存在是为了确保在 lint 被废弃后 `#[allow(lintname)]` 仍然可以编译。废弃操作通过移除这些 lint 的功能并将其标记为废弃来“删除”它们，这可能会导致进一步的警告，但不会导致编译器错误。

[Clippy lint documentation]: https://rust-lang.github.io/rust-clippy/
[Clippy 1.0 RFC]: https://github.com/rust-lang/rfcs/blob/main/text/2476-clippy-uno.md#lint-audit-and-categories
