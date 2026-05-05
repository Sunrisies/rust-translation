# mdBook特定功能

## 隐藏代码行

在mdBook中有一个功能，可以通过在代码行前加上特定的前缀来隐藏这些代码行。

在Rust语言中，你可以在行首加上 `# `（即`#`后面跟着一个空格），以此来隐藏该行内容 [like you would with Rustdoc][rustdoc-hide]。  
如果需要取消这种隐藏效果，可以使用 `##`，此时该行将不再被隐藏，而应该显示原始字符串 `# `（更多细节请参考 [Rustdoc's docs][rustdoc-hide]）。

[rustdoc-hide]: https://doc.rust-lang.org/stable/rustdoc/write-documentation/documentation-tests.html#hiding-portions-of-the-example

```bash
# fn main() {
    let x = 5;
    let y = 6;

    println!("{}", x + y);
# }
```

将显示为

```rust
# fn main() {
    let x = 5;
    let y = 6;

    println!("{}", x + y);
# }
```

当您将鼠标指针悬停在代码块上时，会看到一个眼球图标（<i class="fa fa-eye"></i>），该图标可以切换隐藏线的显示状态。

默认情况下，此功能仅适用于带有 `rust` 注释的代码示例。不过，您可以通过在 `book.toml` 中添加新的隐藏行前缀来为其他语言定义自定义前缀，该前缀应包含语言名称和前缀字符：

```toml
[output.html.code.hidelines]
python = "~"
```

该前缀会隐藏所有以给定前缀开头的行。使用上面所示的Python前缀，这样：

```bash
~hidden()
nothidden():
~    hidden()
    ~hidden()
    nothidden()
```

将显示为

```python
~hidden()
nothidden():
~    hidden()
    ~hidden()
    nothidden()
```

这种行为可以通过使用不同的前缀在本地进行覆盖。其效果与上述情况相同。

~~~markdown
```python,hidelines=!!!
!!!hidden()
nothidden():
!!!    hidden()
    !!!hidden()
    nothidden()
```
~~~

## Rust 游乐场

Rust 语言的代码块会自动生成一个播放按钮（<i class="fas fa-play"></i>），点击该按钮可以执行代码并查看输出结果，输出结果会显示在代码块下方。
这一功能是通过将代码发送到[Rust Playground]来实现的。

```rust
println!("Hello, World!");
```

如果没有 `main` 函数，那么代码会自动被包裹在一个函数内部。

如果您希望禁用某个代码块的播放按钮，可以在该代码块中包含 `noplayground` 选项，如下所示：

~~~markdown
```rust,noplayground
let mut name = String::new();
std::io::stdin().read_line(&mut name).expect("failed to read line");
println!("Hello {}!", name);
```
~~~

或者，如果您希望禁用书中所有代码块的播放按钮，您可以像这样将配置写入 `book.toml` 中。

```toml
[output.html.playground]
runnable = false
```

## Rust 代码块属性

在 Rust 代码块中，可以通过逗号、空格或制表符分隔的方式添加额外的属性，这些属性应紧跟在语言术语之后。例如：

~~~markdown
```rust,ignore
# This example won't be tested.
panic!("oops!");
```
~~~

在使用[`mdbook test`]来测试Rust示例时，这些特性尤为重要。这些特性与[rustdoc属性]相同，但有一些额外的功能：

* `editable` --- 启用[编辑器]。  
* `noplayground` --- 移除播放按钮，但仍会进行测试。  
* `mdbook-runnable` --- 强制显示播放按钮。  
   此功能应与 `ignore` 属性结合使用，用于那些不应进行测试但希望让读者能够运行的示例。  
* `ignore` --- 不会进行测试，也不会显示播放按钮，但会以 Rust 语法形式高亮显示。  
* `should_panic` --- 执行此代码时会导致 panic 错误。  
* `no_run` --- 在测试时代码会被编译，但实际上不会运行。  
   播放按钮同样不会显示。  
* `compile_fail` --- 此代码应该无法编译。  
* `edition2015`, `edition2018`, `edition2021`, `edition2024` --- 强制使用特定的 Rust 版本。  
    请参阅 [`rust.edition`] 以全局设置此选项。

[`mdbook test`]: ../cli/test.md  
[rustdoc 属性]: https://doc.rust-lang.org/rustdoc/documentation-tests.html#attributes  
[编辑器]: theme/editor.md  
[`rust.edition`]: configuration/general.md#rust-options

## 包含文件

使用以下语法，您可以将文件包含到您的书中：

```hbs
\{{#include file.rs}}
```

文件的路径必须是相对于当前源文件而言的。

mdBook会将包含的文件解释为Markdown格式。由于`include`命令通常用于插入代码片段和示例，因此你通常会用 ```` ``` ```` to display the file contents without
interpreting them.

````hbs
```
\{{#include file.rs}}
```
````

## Including portions of a file
Often you only need a specific part of the file, e.g. relevant lines for an
example. We support four different modes of partial includes:

```hbs
\{{#include file.rs:2}}
\{{#include file.rs::10}}
\{{#include file.rs:2:}}
\{{#include file.rs:2:10}}
```

The first command only includes the second line from file `file.rs`. The second
command includes all lines up to line 10, i.e. the lines from 11 till the end of
the file are omitted. The third command includes all lines from line 2, i.e. the
first line is omitted. The last command includes the excerpt of `file.rs`
consisting of lines 2 to 10.

To avoid breaking your book when modifying included files, you can also
include a specific section using anchors instead of line numbers.
An anchor is a pair of matching lines. The line beginning an anchor must
match the regex `ANCHOR:\s*[\w_-]+` and similarly the ending line must match
the regex `ANCHOR_END:\s*[\w_-]+`. This allows you to put anchors in
any kind of commented line.

Consider the following file to include:
```rs
/* ANCHOR: all */

// ANCHOR: component
struct Paddle {
    hello: f32,
}
// ANCHOR_END: component

////////// ANCHOR: system
impl System for MySystem { ... }
////////// ANCHOR_END: system

/* ANCHOR_END: all */
```

Then in the book, all you have to do is:
````hbs 来包裹这个命令。以下是一个组件：```rust,no_run,noplayground
\{{#include file.rs:component}}
```

以下是简体中文翻译：

这是一个系统：
```rust,no_run,noplayground
\{{#include file.rs:system}}
```

这是完整的文件。
```rust,no_run,noplayground
\{{#include file.rs:all}}
```
````

Lines containing anchor patterns inside the included anchor are ignored.

## Including a file but initially hiding all except specified lines

The `rustdoc_include` helper is for including code from external Rust files that contain complete
examples, but only initially showing particular lines specified with line numbers or anchors in the
same way as with `include`.

The lines not in the line number range or between the anchors will still be included, but they will
be prefaced with `#`. This way, a reader can expand the snippet to see the complete example, and
Rustdoc will use the complete example when you run `mdbook test`.

For example, consider a file named `file.rs` that contains this Rust program:

```rust
fn main() {
    let x = add_one(2);
    assert_eq!(x, 3);
}

fn add_one(num: i32) -> i32 {
    num + 1
}
```

We can include a snippet that initially shows only line 2 by using this syntax:

````hbs
To call the `add_one` function, we pass it an `i32` and bind the returned value to `x`:

```rust
\{{#rustdoc_include file.rs:2}}
```
````

This would have the same effect as if we had manually inserted the code and hidden all but line 2
using `#`:

````hbs
要调用 `add_one` 函数，我们需要传递一个 `i32` 参数，并将返回的值绑定到 `x` 变量上：

```rust
# fn main() {
    let x = add_one(2);
#     assert_eq!(x, 3);
# }
#
# fn add_one(num: i32) -> i32 {
#     num + 1
# }
```  
````

That is, it looks like this (click the "expand" icon to see the rest of the file):

```rust  
# fn main() {  
#     let x = add_one(2);  
#     assert_eq!(x, 3);  
# }  
#  
# fn add_one(num: i32) -> i32 {  
#         num + 1  
#     }  
```

## Inserting runnable Rust files

With the following syntax, you can insert runnable Rust files into your book:

```hbs  
\{{#playground file.rs}}  
```

The path to the Rust file has to be relative from the current source file.

When play is clicked, the code snippet will be sent to the [Rust Playground] to be
compiled and run. The result is sent back and displayed directly underneath the
code.

Here is what a rendered code snippet looks like:

{{#playground example.rs}}

Any additional values passed after the filename will be included as attributes of the code block.
For example `\{{#playground example.rs editable}}` will create the code block like the following:

~~~markdown
```rust,可编辑  
# example.rs 的内容在此处。  
```
~~~

And the `editable` attribute will enable the [editor] as described at [Rust code block attributes](#rust-code-block-attributes).

[Rust Playground]: https://play.rust-lang.org/

## Controlling page \<title\>

A chapter can set a \<title\> that is different from its entry in the table of
contents (sidebar) by including a `\{{#title ...}}` near the top of the page.

```hbs  
\{{#title 我的标题}}  
```

## HTML classes provided by mdBook

<img class="right" src="images/rust-logo-blk.svg" alt="The Rust logo">

### `class="left"` and `"right"`

These classes are provided by default, for inline HTML to float images.

```html  
<img class="right" src="images/rust-logo-blk.svg" alt="The Rust logo">  
```

### `class="hidden"`

HTML tags with class `hidden` will not be shown.

```html  
<div class="hidden">这不会被显示。</div>  
```

<div class="hidden">This will not be seen.</div>

## Font-Awesome icons

mdBook includes a copy of version 6 of [Font Awesome Free's](https://fontawesome.com)
MIT-licensed SVG files. It emulates the `<i>` syntax, but converts the results
to inline SVG. Only the regular, solid, and brands icons are included; paid
features like the light icons are not.

For example, given this HTML syntax:

```hbs  
结果如下所示： <i class="fa-solid fa-print"></i>

翻译结果为： <i class="fa-solid fa-print"></i>

请查看 [免费图标集](https://fontawesome.com/v6/search)，以获取可用的图标。