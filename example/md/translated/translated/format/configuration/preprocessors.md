# 配置预处理器

预处理器是可以在原始Markdown源被发送到渲染器之前对其进行修改的扩展程序。

以下预处理程序是内置的，并且默认包含在内：

- `links`：展开章节中的 `{{ #playground }}`、 `{{ #include }}` 和 `{{ #rustdoc_include }}` 处理栏，将文件内容包含进来。更多详情请参见 [包含文件]。
- `index`：将所有名为 `README.md` 的章节文件转换为 `index.md` 格式。也就是说，所有的 `README.md` 将被转换为索引文件 `index.html`，从而出现在渲染后的书籍中。

内置的预处理器可以通过[`build.use-default-preprocessors`]配置选项来禁用。

社区已经开发了几款预处理器。  
如需查看可用预处理器的列表，请参考[第三方插件]维基页面。

有关如何创建新的预处理器的信息，请参阅[开发者预处理器]章节。

[包含文件]: ../mdbook.md#including-files  
[`build.use-default-preprocessors`]: general.md#build-options  
[第三方插件]: https://github.com/rust-lang/mdBook/wiki/Third-party-plugins  
[开发者用预处理工具]: ../../for_developers/preprocessors.md

## 自定义预处理器配置

可以通过在 `book.toml` 中包含名为 `preprocessor` 的预处理器表来添加预处理器。例如，如果你有一个名为 `mdbook-example` 的预处理器，那么你可以这样包含它：

```toml
[preprocessor.example]
```

根据此表格，mdBook将执行 `mdbook-example` 预处理器。

此表可以包含特定于预处理器的一些键值对。例如，如果我们的示例预处理器需要一些额外的配置选项：

```toml
[preprocessor.example]
some-extra-feature = true
```

## 将预处理器依赖项锁定到特定渲染器

您可以通过将两者绑定在一起，来明确指定预处理器应该为渲染器运行。

```toml
[preprocessor.example]
renderers = ["html"]  # example preprocessor only runs with the HTML renderer
```

## 请输入您自己的命令

默认情况下，当您在 `book.toml` 文件中添加一张 `[preprocessor.foo]` 表格时，`mdbook` 会尝试调用 `mdbook-foo` 可执行文件。如果您想使用不同的程序名称或传递命令行参数，可以通过添加 `command` 字段来覆盖此行为。

```toml
[preprocessor.random]
command = "python random.py"
```

### 可选的前置处理器

如果您启用了未安装的前置处理器，默认行为是引发错误。可以通过将该前置处理器标记为可选来更改此行为。

```toml
[preprocessor.example]
optional = true
```

这将错误降级为警告。

## 需要一定的顺序

预处理器的运行顺序可以通过 `before` 和 `after` 字段来控制。例如，假设您希望您的 `linenos` 预处理器处理那些可能包含 `{{#include}}`d 的行；那么您希望它在内置的 `links` 预处理器之后运行，您可以使用 `before` 或 `after` 字段来实现这一需求。

```toml
[preprocessor.linenos]
after = [ "links" ]
```

or

```toml
[preprocessor.links]
before = [ "linenos" ]
```

当然，也可以在同一个配置文件中同时指定上述两项内容，尽管这样做有些多余。

通过 `before` 和 `after` 指定相同优先级的预处理器，将按照名称进行排序。  
任何会导致无限循环的情况都会被检测出来，并引发错误。