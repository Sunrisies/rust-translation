<a id="items.mod"></a>
# 模块

<a id="items.mod.syntax"></a> 
```grammar,items
Module ->
      `unsafe`? `mod` IDENTIFIER `;`
    | `unsafe`? `mod` IDENTIFIER `{`
        InnerAttribute*
        Item*
      `}`
```

<a id="items.mod.intro"></a> 模块是包含零个或多个 [items] 的容器。

<a id="items.mod.def"></a> _模块项_ 是一个被大括号包围、命名且以 `mod` 关键字开头的模块。模块项将一个新的命名模块引入构成 crate 的模块树中。

<a id="items.mod.nesting"></a> 模块可以任意嵌套。

一个模块的示例：

```rust
mod math {
    type Complex = (f64, f64);
    fn sin(f: f64) -> f64 {
        /* ... */
#       unimplemented!();
    }
    fn cos(f: f64) -> f64 {
        /* ... */
#       unimplemented!();
    }
    fn tan(f: f64) -> f64 {
        /* ... */
#       unimplemented!();
    }
}
```

<a id="items.mod.namespace"></a> 模块在其所在的 [类型命名空间] 中被定义。

<a id="items.mod.multiple-items"></a> 在模块内的同一命名空间中定义多个同名项是错误的。有关限制和遮蔽行为的更多细节，请参阅 [scope 章节]。

<a id="items.mod.不安全"></a> `unsafe` 关键字在语法上允许出现在 `mod` 关键字之前，但在语义层面会被拒绝。这允许宏使用这种语法并利用 `unsafe` 关键字，之后再将它从标记流中移除。

<a id="items.mod.outlined"></a>
## 模块源文件名

<a id="items.mod.outlined.intro"></a> 没有主体的模块是从外部文件加载的。当模块没有 `path` 属性时，文件的路径与逻辑 [模块路径] 相同。

<a id="items.mod.outlined.search"></a> 祖先模块路径组件是目录，而模块的内容则保存在以模块名加上 `.rs` 扩展名的文件中。例如，以下模块结构可以具有相应的文件系统结构：

模块路径 | 文件系统路径 | 文件内容
------------------------- | ---------------  | -------------
`crate` | `lib.rs` | `mod util;` `crate::util` | `util.rs` | `mod config;` `crate::util::config` | `util/config.rs` |

<a id="items.mod.outlined.search-mod"></a> 模块文件名也可以是该模块的目录名，其内容保存在该目录下的 `mod.rs` 文件中。上述示例也可以表示为 `crate::util` 的内容在 `util/mod.rs` 文件中。同时拥有 `util.rs` 和 `util/mod.rs` 是不允许的。

> [!NOTE] > 在 `rustc` 1.30 之前，使用 `mod.rs` 文件是加载具有嵌套子模块的模块的方式。建议采用新的命名规范，因为这样更一致，并且可以避免项目中出现大量名为 `mod.rs` 的文件。

<a id="items.mod.outlined.path"></a>
### `path` 属性

<a id="items.mod.outlined.path.intro"></a> 用于加载外部文件模块的目录和文件可以通过 `path` 属性进行配置。

<a id="items.mod.outlined.path.search"></a> 对于不在内联模块块中的模块的 `path` 属性，文件路径相对于源文件所在的目录。例如，以下代码片段将使用根据其位置显示的路径：

<!-- ignore: requires external files -->
```rust,ignore
#[path = "foo.rs"]
mod c;
```

源文件 | `c` 的文件位置 | `c` 的模块路径
-------------- | ------------------- | ----------------------
`src/a/b.rs` | `src/a/foo.rs` | `crate::a::b::c` `src/a/mod.rs` | `src/a/foo.rs` | `crate::a::c`

<a id="items.mod.outlined.path.search-nested"></a> 对于内联模块块中的 `path` 属性，文件路径的相对位置取决于 `path` 属性所在的源文件类型。 "mod-rs" 源文件是根模块（如 `lib.rs` 或 `main.rs`）和名为 `mod.rs` 的模块。 "non-mod-rs" 源文件是所有其他模块文件。在 mod-rs 文件中，内联模块块内的 `path` 属性路径相对于包含内联模块组件的 mod-rs 目录。对于 non-mod-rs 文件，情况相同，只是路径以非-mod-rs 模块的名称作为目录开始。例如，以下代码片段将使用根据其位置显示的路径：

<!-- ignore: requires external files -->
```rust,ignore
mod inline {
    #[path = "other.rs"]
    mod inner;
}
```

源文件 | `inner` 的文件位置 | `inner` 的模块路径
-------------- | --------------------------| ----------------------------
`src/a/b.rs` | `src/a/b/inline/other.rs` | `crate::a::b::inline::inner` `src/a/mod.rs` | `src/a/inline/other.rs` | `crate::a::inline::inner`

以下是组合内联模块和嵌套模块上 `path` 属性规则的一个示例（适用于 mod-rs 和非-mod-rs 文件）：

<!-- ignore: requires external files -->
```rust,ignore
#[path = "thread_files"]
mod thread {
    // Load the `local_data` module from `thread_files/tls.rs` relative to
    // this source file's directory.
    #[path = "tls.rs"]
    mod local_data;
}
```

<a id="items.mod.attributes"></a>
## 模块上的属性

<a id="items.mod.attributes.intro"></a> 模块与所有项一样，接受外部属性。它们也接受内部属性：对于具有主体的模块，在 `{` 之后；或者在源文件开头，在可选的 BOM 和 shebang 之后。

<a id="items.mod.attributes.supported"></a> 对模块有意义的内置属性包括 [`cfg`]、 [`deprecated`]、 [`doc`]、[lint 检查属性]、 [`path`] 和 [`no_implicit_prelude`]。模块还接受宏属性。

[`cfg`]: ../conditional-compilation.md
[`deprecated`]: ../attributes/diagnostics.md#the-deprecated-attribute
[`doc`]: ../../rustdoc/the-doc-attribute.html
[`no_implicit_prelude`]: ../names/preludes.md#the-no_implicit_prelude-attribute
[`path`]: #the-path-attribute
[attribute]: ../attributes.md
[items]: ../items.md
[module path]: ../paths.md
[scopes chapter]: ../names/scopes.md
[the lint check attributes]: ../attributes/diagnostics.md#lint-check-attributes
[type namespace]: ../names/namespaces.md
