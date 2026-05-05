# 为开发者提供信息

虽然 `mdbook` 主要被用作命令行工具，但你也可以直接导入底层库，并使用这些库来管理书籍。它还拥有相当灵活的插件机制，允许你创建自己的自定义工具和客户端（通常称为*后端*），如果你需要对书籍进行一些分析或将其以不同的格式呈现的话。

*面向开发者的*章节旨在向您展示`mdbook`的更高级用法。

开发者可以有两种主要方式来参与这本书的构建过程：

- [Preprocessors](preprocessors.md)
- [Alternative Backends](backends.md)

## 构建过程

渲染一个书籍项目的过程包括几个步骤。

1. 加载书籍
   - 解析 `book.toml`，如果不存在，则回退到默认的 `Config`
   - 将书籍章节加载到内存中
   - 确定应使用哪些预处理程序/后端

2. 对于每个后端：
   1. 运行所有预处理程序
   2. 调用后端来渲染处理后的结果

## 将 `mdbook` 作为库使用

`mdbook`二进制只是一个包装层，用于封装底层的mdBook crate，将其功能暴露为命令行程序。如果你想以编程方式控制mdBook，可以使用[`mdbook-driver`] crate。这个 crate可以用来添加自己的功能或修改构建过程。

要了解如何使用 `mdbook-driver` 这个 crate，最简单的方法就是查看[API文档]。顶层的文档解释了如何使用[`MDBook`]类型来加载和构建书籍，而[config]模块则对配置系统进行了详细的说明。

[`MDBook`]: https://docs.rs/mdbook-driver/latest/mdbook_driver/struct.MDBook.html  
[API文档]: https://docs.rs/mdbook-driver/latest/mdbook_driver/  
[配置文档]: https://docs.rs/mdbook-driver/latest/mdbook_driver/config/index.html