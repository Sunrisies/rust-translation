<a id="vis"></a>
# 可见性与隐私

<a id="vis.syntax"></a> 
```grammar,items
Visibility ->
      `pub`
    | `pub` `(` `crate` `)`
    | `pub` `(` `self` `)`
    | `pub` `(` `super` `)`
    | `pub` `(` `in` SimplePath `)`
```

<a id="vis.intro"></a> 这两个术语经常可以互换使用，它们试图回答的问题是“该元素能否在当前位置被使用？”

<a id="vis.name-hierarchy"></a> Rust 的名称解析基于全局的命名空间层次结构进行。该层次结构中的每一层都可以被视为一个元素。这些元素包括上述提到的内容，也包含外部 crate。声明或定义一个新的模块可以视为在定义位置向该层次结构中插入一个新节点。

<a id="vis.privacy"></a> 为了控制接口是否可以在不同模块之间使用，Rust 会对每个元素的使用进行检查，以确定是否允许使用。此时就会生成隐私警告，或者显示为“你使用了另一个模块的私有元素，但未被允许使用”。

<a id="vis.default"></a> 默认情况下，所有内容都是*私有的*，但有两种例外：在 `pub` trait 中的关联元素默认为公开；在 `pub` 枚举 中的枚举变体也默认为公开。当某个元素被声明为 `pub` 时，就可以认为它可以被外部访问。例如：

```rust
# fn main() {}
// Declare a private struct
struct Foo;

// Declare a public struct with a private field
pub struct Bar {
    field: i32,
}

// Declare a public enum with two public variants
pub enum State {
    PubliclyAccessibleState,
    PubliclyAccessibleState2,
}
```

<a id="vis.access"></a> 根据元素是公开还是私有的概念，Rust 允许在两种情况下访问元素：

1. 如果某个元素是公开的，那么可以从某个模块 `m` 外部访问它，前提是你可以从 `m` 访问到该元素的所有祖先模块。你也可以通过重新导出来命名该元素。详见下文。2. 如果某个元素是私有的，则只有当前模块及其子模块可以访问它。

这两种情况对于创建暴露公共 API 但隐藏内部实现细节的模块层次结构非常有效。为了帮助说明，以下是几个用例及其具体含义：

* 库开发者需要将其功能暴露给依赖其库的 crate。根据第一种情况，这意味着任何可以在外部使用的元素必须从根节点到目标元素都必须是 `pub` 的。链中的私有元素将禁止外部访问。

* 一个 crate 需要一个全局可用的“辅助模块”供自身使用，但不希望将该辅助模块作为公共 API 暴露出来。为此，crate 层次结构的根节点会有一个私有模块，而该模块内部则包含“公共 API”。由于整个 crate 都是根节点的后代，因此所有本地 crate 可以通过第二种情况访问这个私有模块。

* 在为某个模块编写单元测试时，通常的做法是让待测试模块的直接子模块命名为 `mod test`。该模块可以通过第二种情况访问父模块中的任何项目，这意味着内部实现细节也可以从子模块无缝地进行测试。

在第二种情况下，提到私有项“可以被”当前模块及其后代访问，但访问项的确切含义取决于该项的具体类型。

<a id="vis.use"></a> 访问一个模块意味着查看其内部内容（以导入更多项目）。另一方面，访问一个函数则意味着调用该函数。此外，路径表达式和导入语句也被视为访问一项的方式，因为只有当目标位于当前可见范围内时，导入/表达式才有效。

以下是上述三种情况的一个示例程序：

```rust
// This module is private, meaning that no external crate can access this
// module. Because it is private at the root of this current crate, however, any
// module in the crate may access any publicly visible item in this module.
mod crate_helper_module {

    // This function can be used by anything in the current crate
    pub fn crate_helper() {}

    // This function *cannot* be used by anything else in the crate. It is not
    // publicly visible outside of the `crate_helper_module`, so only this
    // current module and its descendants may access it.
    fn implementation_detail() {}
}

// This function is "public to the root" meaning that it's available to external
// crates linking against this one.
pub fn public_api() {}

// Similarly to 'public_api', this module is public so external crates may look
// inside of it.
pub mod submodule {
    use crate::crate_helper_module;

    pub fn my_method() {
        // Any item in the local crate may invoke the helper module's public
        // interface through a combination of the two rules above.
        crate_helper_module::crate_helper();
    }

    // This function is hidden to any module which is not a descendant of
    // `submodule`
    fn my_implementation() {}

    #[cfg(test)]
    mod test {

        #[test]
        fn test_my_implementation() {
            // Because this module is a descendant of `submodule`, it's allowed
            // to access private items inside of `submodule` without a privacy
            // violation.
            super::my_implementation();
        }
    }
}

# fn main() {}
```

为了让 Rust 程序通过隐私检查，所有路径都必须符合上述两条规则。这包括所有的使用声明、表达式、类型等。

<a id="vis.scoped"></a>
## `pub(in path)`、`pub(crate)`、`pub(super)` 和 `pub(self)`

<a id="vis.scoped.intro"></a> 除了公共和私有之外，Rust 允许用户将某项声明为仅在特定范围内可见。`pub` 限制的规则如下：

<a id="vis.scoped.in"></a> - `pub(in path)` 使该项在提供的 `path` 中可见。`path` 必须是一个简单的路径，该路径能够解析到被声明可见性的项的祖先模块。`path` 中的每个标识符都必须直接指向一个模块（而不是由 `use` 语句引入的名称）。

<a id="vis.scoped.crate"></a> - `pub(crate)` 使项目在当前 crate 内可见。

<a id="vis.scoped.super"></a> - `pub(super)` 使项目对父模块可见。这等同于 `pub(in super)`。

<a id="vis.scoped.self"></a> - `pub(self)` 使项目在当前模块中可见。这等同于 `pub(in self)` 或完全不使用 `pub`。

<a id="vis.scoped.edition2018"></a> > [!EDITION-2018] > 从 2018 版开始，`pub(in path)` 的路径必须以 `crate`、`self` 或 `super` 开头。2015 版也可以使用以 `::` 开头的路径或 crate 根目录中的模块。

以下是一个示例：

```rust,edition2015
pub mod outer_mod {
    pub mod inner_mod {
        // This function is visible within `outer_mod`
        pub(in crate::outer_mod) fn outer_mod_visible_fn() {}
        // Same as above, this is only valid in the 2015 edition.
        pub(in outer_mod) fn outer_mod_visible_fn_2015() {}

        // This function is visible to the entire crate
        pub(crate) fn crate_visible_fn() {}

        // This function is visible within `outer_mod`
        pub(super) fn super_mod_visible_fn() {
            // This function is visible since we're in the same `mod`
            inner_mod_visible_fn();
        }

        // This function is visible only within `inner_mod`,
        // which is the same as leaving it private.
        pub(self) fn inner_mod_visible_fn() {}
    }
    pub fn foo() {
        inner_mod::outer_mod_visible_fn();
        inner_mod::crate_visible_fn();
        inner_mod::super_mod_visible_fn();

        // This function is no longer visible since we're outside of `inner_mod`
        // Error! `inner_mod_visible_fn` is private
        //inner_mod::inner_mod_visible_fn();
    }
}

fn bar() {
    // This function is still visible since we're in the same crate
    outer_mod::inner_mod::crate_visible_fn();

    // This function is no longer visible since we're outside of `outer_mod`
    // Error! `super_mod_visible_fn` is private
    //outer_mod::inner_mod::super_mod_visible_fn();

    // This function is no longer visible since we're outside of `outer_mod`
    // Error! `outer_mod_visible_fn` is private
    //outer_mod::inner_mod::outer_mod_visible_fn();

    outer_mod::foo();
}

fn main() { bar() }
```

> [!NOTE] > 这种语法只是对项目的可见性增加了限制，并不保证项目在指定作用域的所有部分中都是可见的。要访问某个项目，其所有父项目在当前作用域内也必须可见。

<a id="vis.reexports"></a>
## 重新导出与可见性

<a id="vis.reexports.intro"></a> Rust 允许通过 `pub use` 指令公开重新导出项目。由于这是一个公共指令，因此该项目可以通过上述规则在当前模块中使用。本质上，它允许对重新导出的项目进行公开访问。例如，以下程序是有效的：

```rust
pub use self::implementation::api;

mod implementation {
    pub mod api {
        pub fn f() {}
    }
}

# fn main() {}
```

这意味着任何引用 `implementation::api::f` 的外部 crate 都会遇到隐私违规，而路径 `api::f` 则被允许。

<a id="vis.reexports.private-item"></a> 在重新导出私有项目时，可以认为是通过重新导出短接了“隐私链”，而不是像通常那样通过命名空间层次结构传递。
