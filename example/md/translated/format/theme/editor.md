# 编辑器

除了提供可运行的代码演示区之外，mdBook还可选地进行代码编辑功能。为了启用可编辑的代码块，需要在***book.toml***文件中添加以下内容：

```toml
[output.html.playground]
editable = true
```

在启用可编辑代码块后，需要在代码块中添加 `editable` 属性，这样才能使其可编辑：

~~~markdown
```rust,editable
fn main() {
    let number = 5;
    print!("{}", number);
}
```
~~~

以上操作将生成一个可编辑的游乐场：

```rust,editable
fn main() {
    let number = 5;
    print!("{}", number);
}
```

请注意在可编辑的游乐场中新增的 `Undo Changes` 按钮。

## 自定义编辑器

默认情况下，编辑器是[Ace](https://ace.c9.io/)编辑器。但是，如果需要，可以通过指定不同的文件夹来覆盖此默认设置。

```toml
[output.html.playground]
editable = true
editor = "/path/to/editor"
```

请注意，为了使编辑器的更改能够正确生效，需要覆盖 `theme` 文件夹中的 `book.js`，因为它与默认的 Ace 编辑器存在某些关联。