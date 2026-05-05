# 预处理器

预处理器只是一段代码，它在书籍加载后立即运行，在渲染之前执行，从而允许你更新和修改书籍的内容。可能的使用场景包括：

- 创建自定义辅助函数，例如 `\{{#include /path/to/file.md}}`
- 使用 LaTeX 风格的表达式 (`$$ \frac{1}{3} $$`) 并替换为相应的 MathJax 等效形式

有关使用预处理器的更多信息，请参阅[配置预处理器](../format/configuration/preprocessors.md)。

## 接入MDBook

MDBook采用了一种相当简单的机制来发现第三方插件。首先会在 `book.toml` 中添加一个新的表（例如，对于 `foo` 预处理器，则添加 `[preprocessor.foo]`），然后 `mdbook` 会尝试将 `mdbook-foo` 程序作为构建过程的一部分来调用。

一旦预处理器被定义并且构建过程开始，mdBook就会执行 `preprocessor.foo.command` 中定义的命令两次。  
第一次运行时，它会调用预处理器以确定其是否支持给定的渲染器。  
mdBook向预处理器传递了两个参数：第一个参数是字符串 `supports`，第二个参数是渲染器名称。  
如果预处理器支持给定的渲染器，它应该以状态代码 0 退出；如果不支持，则返回一个非零的退出代码。

如果预处理器支持渲染器，那么 mdbook 会再次运行它，并将 JSON 数据传递给标准输入。  
JSON 数据由一个数组组成，其中每个元素都是 `[context, book]`，而 `context` 是序列化后的对象 [`PreprocessorContext`]，而 `book` 是一个包含书籍内容的 [`Book`] 对象。

预处理器应该将[`Book`]对象的JSON格式输出到标准输出中，同时可以执行任何所需的修改。

开始使用最简单的方法就是自己实现`Preprocessor` trait（例如在 `lib.rs` 中），然后创建一个 shell 二进制文件，将输入转换为正确的 `Preprocessor` 方法。为了方便起见， `examples/` 目录中有一个[无操作预处理器示例]，可以轻松地被改编为其他预处理器。

<details>  
<summary>示例：无操作的前置处理器</summary>

```rust
// nop-preprocessors.rs

{{#include ../../../examples/nop-preprocessor.rs}}
```
</details>

## 实现预处理器的一些提示

通过将 `mdbook-preprocessor` 作为库引入，预处理器可以访问现有的用于处理书籍的基础设施。

例如，一个自定义预处理器可以使用[`parse_input()`]函数来反序列化写入到`stdin`的JSON数据。然后，`Book`中的每个章节都可以通过`Book::for_each_mut()`进行就地修改，之后再将其写入到`stdout`中，最后使用`serde_json` crate进行保存。

章节可以通过直接递归遍历章节，或者通过 `Book::for_each_mut()` 便捷方法来访问。

«`chapter.content`»只是一个字符串，恰好是Markdown格式。虽然完全可以使用正则表达式或手动进行查找和替换，但你可能希望将输入数据转换为更易于计算机处理的格式。[`mdbook-markdown`]这个库提供了mdBook所使用的[`pulldown-cmark`][pc]库，用于解析Markdown格式的数据。而[`pulldown-cmark-to-cmark`][pctc]库则可以用来将事件数据转换回Markdown文本格式。

以下代码块展示了如何去除所有Markdown格式中的强调标记，同时不会意外地破坏文档结构。

```rust
{{#rustdoc_include ../../../examples/remove-emphasis/mdbook-remove-emphasis/src/main.rs:remove_emphasis}}
```

请查看 [full example source][emphasis-example] 以获取更多详细信息。

## 使用不同的语言实现预处理器

mdBook通过stdin和stdout与预处理器进行通信，这使得在其他语言中实现这些预处理器变得非常容易。以下代码展示了如何在Python中实现一个简单的预处理器，该预处理器会修改第一章的内容。下面的示例遵循上述配置，其中 `preprocessor.foo.command` 实际上指的是一个Python脚本。

```python
import json
import sys


if __name__ == '__main__':
    if len(sys.argv) > 1: # we check if we received any argument
        if sys.argv[1] == "supports": 
            # then we are good to return an exit status code of 0, since the other argument will just be the renderer's name
            sys.exit(0)

    # load both the context and the book representations from stdin
    context, book = json.load(sys.stdin)
    # and now, we can just modify the content of the first chapter
    book['items'][0]['Chapter']['content'] = '# Hello'
    # we are done with the book's modification, we can just print it to stdout, 
    print(json.dumps(book))
```

[强调示例]: https://github.com/rust-lang/mdBook/tree/master/examples/remove-emphasis/
[PC]: https://crates.io/crates/pulldown-cmark
[PCTC]: https://crates.io/crates/pulldown-cmark-to-cmark
[一个无操作的预处理器示例]: https://github.com/rust-lang/mdBook/blob/master/examples/nop-preprocessor.rs
[`parse_input()`]: https://docs.rs/mdbook-preprocessor/latest/mdbook_preprocessor/fn.parse_input.html
[`Book::for_each_mut()`]: https://docs.rs/mdbook-preprocessor/latest/mdbook_preprocessor/book/struct.Book.html#method.for_eachMut
[`PreprocessorContext`]: https://docs.rs/mdbook-preprocessor/latest/mdbook_preprocessor/struct.PreprocessorContext.html
[`Book`]: https://docs.rs/mdbook-preprocessor/latest/mdbook_preprocessor/book/struct.Book.html
[`mdbook-markdown`]: https://docs.rs/mdbook-markdown/latest/mdbook_markdown/