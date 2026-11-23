<a id="attributes.debugger"></a>
# 调试器属性

<a id="attributes.debugger.intro"></a> 以下 [属性] 用于增强使用 GDB 或 WinDbg 等第三方调试器的调试体验。

<!-- template:attributes -->
<a id="attributes.debugger.debugger_visualizer"></a>
## `debugger_visualizer` 属性

<a id="attributes.debugger.debugger_visualizer.intro"></a> *`debugger_visualizer` [属性][attributes]* 可用于将调试器可视化文件嵌入到调试信息中。这可改善在显示数值时的调试器体验。

> [!EXAMPLE]
> <!-- ignore: requires external files-->
> ```rust,ignore
> #![debugger_visualizer(natvis_file = "Example.natvis")]
> #![debugger_visualizer(gdb_script_file = "example.py")]
> ```

<a id="attributes.debugger.debugger_visualizer.syntax"></a> `debugger_visualizer` 属性使用 [MetaListNameValueStr] 语法来指定其输入。必须指定以下键之一：

- [`natvis_file`][attributes.debugger.debugger_visualizer.natvis] - [`gdb_script_file"][attributes.debugger.debugger_visualizer.gdb]

<a id="attributes.debugger.debugger_visualizer.allowed-positions"></a> `debugger_visualizer` 属性只能应用于 [模块] 或 crate 根目录。

<a id="attributes.debugger.debugger_visualizer.duplicates"></a> `debugger_visualizer` 属性可以在一个表单中多次使用。所有指定的可视化文件都会被加载。

<a id="attributes.debugger.debugger_visualizer.natvis"></a>
### 使用 `debugger_visualizer` 与 Natvis

<a id="attributes.debugger.debugger_visualizer.natvis.intro"></a> Natvis 是一个基于 XML的框架，用于 Microsoft 调试器（如 Visual Studio 和 WinDbg），它使用声明性规则来定制类型的显示方式。有关 Natvis 格式的详细信息，请参阅 Microsoft 的 [Natvis 文档]。

<a id="attributes.debugger.debugger_visualizer.natvis.msvc"></a> 此属性仅支持在 `-windows-msvc` 目标上嵌入 Natvis 文件。

<a id="attributes.debugger.debugger_visualizer.natvis.path"></a> Natvis 文件的路径通过 `natvis_file` 键指定，该路径相对于源文件。

> [!EXAMPLE]
> <!-- ignore: requires external files and msvc -->
> ```rust ignore
> #![debugger_visualizer(natvis_file = "Rectangle.natvis")]
>
> struct FancyRect {
>     x: f32,
>     y: f32,
>     dx: f32,
>     dy: f32,
> }
>
> fn main() {
>     let fancy_rect = FancyRect { x: 10.0, y: 10.0, dx: 5.0, dy: 5.0 };
>     println!("set breakpoint here");
> }
> ```
>
> `Rectangle.natvis` contains:
>
> ```xml
> <?xml version="1.0" encoding="utf-8"?>
> <AutoVisualizer xmlns="http://schemas.microsoft.com/vstudio/debugger/natvis/2010">
>     <Type Name="foo::FancyRect">
>       <DisplayString>({x},{y}) + ({dx}, {dy})</DisplayString>
>       <Expand>
>         <Synthetic Name="LowerLeft">
>           <DisplayString>({x}, {y})</DisplayString>
>         </Synthetic>
>         <Synthetic Name="UpperLeft">
>           <DisplayString>({x}, {y + dy})</DisplayString>
>         </Synthetic>
>         <Synthetic Name="UpperRight">
>           <DisplayString>({x + dx}, {y + dy})</DisplayString>
>         </Synthetic>
>         <Synthetic Name="LowerRight">
>           <DisplayString>({x + dx}, {y})</DisplayString>
>         </Synthetic>
>       </Expand>
>     </Type>
> </AutoVisualizer>
> ```
>
> When viewed under WinDbg, the `fancy_rect` variable would be shown as follows:
>
> ```text
> > Variables:
>   > fancy_rect: (10.0, 10.0) + (5.0, 5.0)
>     > LowerLeft: (10.0, 10.0)
>     > UpperLeft: (10.0, 15.0)
>     > UpperRight: (15.0, 15.0)
>     > LowerRight: (15.0, 10.0)
> ```

<a id="attributes.debugger.debugger_visualizer.gdb"></a>
### 使用 `debugger_visualizer` 与 GDB

<a id="attributes.debugger.debugger_visualizer.gdb.pretty"></a> GDB 支持使用一种名为 *pretty printer* 的结构化 Python 脚本，该脚本描述了在调试器视图中如何可视化类型。有关 pretty printer 的详细信息，请参阅 GDB 的 [pretty printing 文档]。

> [!NOTE]
> Embedded pretty printers are not automatically loaded when debugging a binary under GDB.
>
> There are two ways to enable auto-loading embedded pretty printers:
>
> 1. Launch GDB with extra arguments to explicitly add a directory or binary to the auto-load safe path: `gdb -iex "add-auto-load-safe-path safe-path path/to/binary" path/to/binary` For more information, see GDB's [auto-loading documentation].
> 1. Create a file named `gdbinit` under `$HOME/.config/gdb` (you may need to create the directory if it doesn't already exist). Add the following line to that file: `add-auto-load-safe-path path/to/binary`.

<a id="attributes.debugger.debugger_visualizer.gdb.path"></a> 这些脚本通过 `gdb_script_file` 键嵌入，该键是相对于源文件的路径。

> [!EXAMPLE]
> <!-- ignore: requires external files -->
> ```rust ignore
> #![debugger_visualizer(gdb_script_file = "printer.py")]
>
> struct Person {
>     name: String,
>     age: i32,
> }
>
> fn main() {
>     let bob = Person { name: String::from("Bob"), age: 10 };
>     println!("set breakpoint here");
> }
> ```
>
> `printer.py` contains:
>
> ```python
> import gdb
>
> class PersonPrinter:
>     "Print a Person"
>
>     def __init__(self, val):
>         self.val = val
>         self.name = val["name"]
>         self.age = int(val["age"])
>
>     def to_string(self):
>         return "{} is {} years old.".format(self.name, self.age)
>
> def lookup(val):
>     lookup_tag = val.type.tag
>     if lookup_tag is None:
>         return None
>     if "foo::Person" == lookup_tag:
>         return PersonPrinter(val)
>
>     return None
>
> gdb.current_objfile().pretty_printers.append(lookup)
> ```
>
> When the crate's debug executable is passed into GDB[^rust-gdb], `print bob` will display:
>
> ```text
> "Bob" is 10 years old.
> ```
>
> [^rust-gdb]: Note: This assumes you are using the `rust-gdb` script which configures pretty-printers for standard library types like `String`.


<!-- template:attributes -->
<a id="attributes.debugger.collapse_debuginfo"></a>
## `collapse_debuginfo` 属性

<a id="attributes.debugger.collapse_debuginfo.intro"></a> *`collapse_debuginfo` [属性]* 控制在生成调用该宏的调试信息时，来自宏定义의代码位置是否被折叠为与宏调用点相关的单一位置。

> [!EXAMPLE]
> ```rust
> #[collapse_debuginfo(yes)]
> macro_rules! example {
>     () => {
>         println!("hello!");
>     };
> }
> ```
>
> When using a debugger, invoking the `example` macro may appear as though it is calling a function. That is, when you step to the invocation site, it may show the macro invocation rather than the expanded code.

<!-- TODO: I think it would be nice to extend this to explain a little more about why this is useful, and the kinds of scenarios where you would want one vs the other. See https://github.com/rust-lang/rfcs/pull/2117 for some guidance. -->

<a id="attributes.debugger.collapse_debuginfo.syntax"></a> `collapse_debuginfo` 属性的语法如下：

```grammar,attributes
@root CollapseDebuginfoAttribute -> `collapse_debuginfo` `(` CollapseDebuginfoOption `)`

CollapseDebuginfoOption ->
      `yes`
    | `no`
    | `external`
```

<a id="attributes.debugger.collapse_debuginfo.allowed-positions"></a> `collapse_debuginfo` 属性只能应用于 [`macro_rules` 定义]。

<a id="attributes.debugger.collapse_debuginfo.duplicates"></a> `collapse_debuginfo` 属性在宏上只能使用一次。

<a id="attributes.debugger.collapse_debuginfo.options"></a> `collapse_debuginfo` 属性接受以下选项：

- `#[collapse_debuginfo(yes)]` --- 调试信息中的代码位置被折叠。 - `#[collapse_debuginfo(no)]` --- 调试信息中的代码位置不被折叠。 - `#[collapse_debuginfo(external)]` --- 只有当宏来自不同的 crate 时，调试信息中的代码位置才会被折叠。

<a id="attributes.debugger.collapse_debuginfo.default"></a> 对于没有此属性的宏，除非它们是内置宏，否则其默认行为为 `external`。对于内置宏，默认值为 `yes`。

> [!NOTE]
> `rustc` has a [`-C collapse-macro-debuginfo`] CLI option to override both the default behavior and the values of any `#[collapse_debuginfo]` attributes.

[auto-loading documentation]: https://sourceware.org/gdb/onlinedocs/gdb/Auto_002dloading-safe-path.html
[attributes]: ../attributes.md
[Natvis documentation]: https://docs.microsoft.com/en-us/visualstudio/debugger/create-custom-views-of-native-objects
[pretty printing documentation]: https://sourceware.org/gdb/onlinedocs/gdb/Pretty-Printing.html
[`-C collapse-macro-debuginfo`]: ../../rustc/codegen-options/index.html#collapse-macro-debuginfo
[`macro_rules` definition]: ../macros-by-example.md
[attribute]: ../attributes.md
[module]: ../items/modules.md
