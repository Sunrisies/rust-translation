<a id="memory"></a>
# 内存模型

<a id="memory.intro"></a> > [!WARNING] > Rust 的内存模型尚不完整且尚未完全确定。

<a id="memory.bytes"></a>
## 字节

<a id="memory.bytes.intro"></a> Rust 中最基本的记忆单元是字节。

> [!NOTE] > 虽然通常将字节转换为硬件字节，但 Rust 使用一种“抽象”的字节概念，这种概念可以区分硬件中不存在的情况，例如未初始化状态或存储指针的一部分。这些差异会影响程序是否产生未定义行为，因此它们对编译后的 Rust 程序的运行方式仍有实际影响。

<a id="memory.bytes.contents"></a> 每个字节可能具有以下值之一：

<a id="memory.bytes.init"></a> * 一个已初始化的字节，包含 `u8` 值及可选的 [来源][std::ptr#provenance]，

<a id="memory.bytes.uninit"></a> * 一个未初始化的字节。

> [!NOTE] > 上述列表尚未被保证是完整的。
