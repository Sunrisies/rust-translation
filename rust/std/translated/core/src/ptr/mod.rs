//! 通过原始指针手动管理内存。
//!
//! *[See also the pointer primitive types](pointer).*
//!
//! # 安全性
//!
//! 本模块中的许多函数以原始指针为参数，并对其进行读取或写入操作。为确保
//! 的安全性，这些指针必须在给定访问条件下是*有效的*。一个指针是否有效
//! depends on the operation it is used for (read or write), and the extent of the memory that is
//! accessed (i.e., how many bytes are read/written) -- it makes no sense to ask "is this pointer
//! valid"; one has to ask "is this pointer valid for a given access". Most functions use `*mut T`
//! and `*const T` to access only a single value, in which case the documentation omits the size and
//! implicitly assumes it to be `size_of::<T>()` bytes.
//!
//! 以下点仅涉及非零大小的内存访问。
//! * 一个指针要适合读取/写入，必要条件是它*可解引用*，但未必充分。指针的[来源]用于确定其
//!
//! * 来自哪个[分配]*；如果从指针开始的指定大小的内存范围完全位于该分配的边界内，则指针可解引用。注意
//! 在 Rust 中，每个（栈分配）变量都被视为一个独立的分配。
//! * 本模块中的函数所进行的所有访问在[原子操作]意义上都是*非原子*的，这些原子操作用于线程间同步。这意味着
//! 从不同线程对同一位置进行两次并发访问都是未定义行为，除非两次访问仅从内存读取。
//! * 将引用转换为指针后，只要底层分配仍然有效且没有使用引用（仅是原始指针）来访问相同内存，该指针就适合读取/写入。也就是说，引用访问和指针访问不能
//! 混合进行。
//!   size starting at the pointer is entirely contained within the bounds of that allocation. Note
//! 足以在 unsafe 代码中正确实现许多有用的功能。更强的保证
//! * All accesses performed by functions in this module are *non-atomic* in the sense
//! of [atomic operations] used to synchronize between threads. This means it is
//! undefined behavior to perform two concurrent accesses to the same location from different
//! threads unless both accesses only read from memory.
//! * The result of casting a reference to a pointer is valid for reads/writes for as long as the
//! underlying allocation is live and no reference (just raw pointers) is used to
//! access the same memory. That is, reference and pointer accesses cannot be
//! interleaved.
//!
//! These axioms, along with careful use of [`offset`] for pointer arithmetic,
//! are enough to correctly implement many useful things in unsafe code. Stronger guarantees
//! 将随着[别名规则]的确定而最终提供。更多
//! 信息请参见[书籍]，以及参考手册中专门讨论
//! [未定义行为][ub]的部分。
//!
//! Note that some operations such as [`read`] and [`write`][`write()`] do allow null pointers if
//! 前提是访问的总大小为零。然而，其他操作会内部将指针转换为
//! 引用。因此，“适用于读写”的一般概念不包括空指针，
//! 允许空指针的具体操作则将其作为例外情况提及。此外，
//! [`read_volatile`] and [`write_volatile`] can be used in even more situations; see their
//! 文档。
//!
//! 如果指针无法用于任何非零大小的访问，我们称其为“悬空”指针。
//! 这意味着越界指针、指向已释放内存的指针、空指针以及通过
//! [`NonNull::dangling`] are all dangling.
//!
//! ## 对齐
//!
//! 上述定义的有效原始指针不一定需要正确对齐（其中
//! "proper" alignment is defined by the pointee type, i.e., `*const T` must be
//! aligned to `align_of::<T>()`). However, most functions require their
//! 参数需要正确对齐，并会在文档中明确说明
//! 此要求。值得注意的例外情况包括
//! [`read_unaligned`] and [`write_unaligned`].
//!
//! 当函数要求正确对齐时，即使访问
//! 的大小为0，即实际上没有访问内存，它也会要求正确对齐。在这种情况下，可以考虑使用
//! [`NonNull::dangling`] in such cases.
//!
//! ## 指针到引用的转换
//!
//! When converting a pointer to a reference (e.g. via `&*ptr` or `&mut *ptr`),
//! 有几条规则必须遵守：
//!
//! * 指针必须正确对齐。
//!
//! * 它必须是非空的。
//!
//! * 它必须按上述定义“可解引用”。
//!
//! * The pointer must point to a [valid value] of type `T`.
//!
//! * 你必须遵守Rust的别名规则。具体的别名规则尚未确定，因此我们
//! 这里只给出大致概述。这些规则还取决于是创建可变引用还是共享引用。
//! 引用。
//! * 当创建可变引用时，只要该引用存在，其指向的内存
//! 就不能通过其他指针或引用访问（读取或写入），这些引用不是由该引用派生出来的。
//! * 当创建共享引用时，只要该引用存在，其指向的内存
//! ...
//!     must not get mutated (except inside `UnsafeCell`).
//!
//! 如果指针遵循所有这些规则，则被称为
//! *可转换为可变或共享引用*。
// ^ we use this term instead of saying that the produced reference must
// be valid, as the validity of a reference is easily confused for the
// validity of the thing it refers to, and while the two concepts are
// closely related, they are not identical.
//!
//! 即使结果未被使用，这些规则也适用！
//! （关于初始化的部分尚未完全确定，但在确定之前，唯一安全的做法是确保它们确实被初始化了。）
//! it is, the only safe approach is to ensure that they are indeed initialized.)
//!
//! 上述规则的一个例子是，如下面的表达式
//! as `unsafe { &*(0 as *const u8) }` is Immediate Undefined Behavior.
//!
//! [valid value]: ../../reference/behavior-considered-undefined.html#invalid-values
//!
//! ## 分配
//!
//! <a id="allocated-object"></a> <!-- keep old URLs working -->
//!
//! *分配*是指程序内存中的一部分，该部分可以被寻址，
//! 在 Rust 中，可以在其中进行指针运算。分配的示例包括堆分配、栈分配变量，
//! 静态变量和常量。某些 Rust 操作的安全前提条件——
//! statics, and consts. The safety preconditions of some Rust operations -
//! such as `offset` and field projections (`expr.field`) - are defined in
//! 它们操作的分配规则中定义的。
//!
//! 一个分配具有基础地址、大小以及一组内存地址。分配可以没有大小，但
//! addresses. It is possible for an allocation to have zero size, but
//! 这样的分配仍然具有基础地址。分配的基础地址
//! 不一定唯一。虽然目前的情况是，一个分配总是有一组完全连续的内存地址（即没有“空洞”），但无法保证未来不会改变。
//! 分配可以是可变的（常见情况）或*只读*的。
//! fully contiguous (i.e., has no "holes"), there is no guarantee that this
//! （有关例外情况，请参阅 [here][atomic-ro]）。
//!
//! An allocation can be either mutable (the common case) or *read-only*.
//! Read-only allocations are implicitly introduced by the compiler for `static` items without
//! interior mutability and for `const` items. Writing or creating a mutable reference to a
//! 只读分配只需支持 [允许的操作][atomic-ro]。
//! for read-only allocations either (see [here][atomic-ro] for exceptions).
//! Additionally, some target-specific intrinsics are not supported on read-only
//! allocations even if their memory write is masked off, such as [`_mm_maskmoveu_si128`].
//!
//! [atomic-ro]: crate::sync::atomic#atomic-accesses-to-read-only-memory
//! [`_mm_maskmoveu_si128`]: ../../core/arch/x86/fn._mm_maskmoveu_si128.html
//!
//! Allocations must behave like "normal" memory: in particular, reads must not have
//! side-effects, and writes must become visible to other threads using the usual synchronization
//! primitives.
//! Allocations must support all atomic operations that are available for the target (as
//! determined by the `target_has_atomic*` set of cfg flags).
//! Read-only allocations only have to support the operations [permitted there][atomic-ro].
//! 用于原子操作的精确指令通常无法得到保证，因此软件需要具备可移植性。
//! 软件应将所有 Rust 分配的内存放入支持所有原子操作的内存区域中。
//! 指令。
//!
//! For any allocation with `base` address, `size`, and a set of
//! `addresses`, the following are guaranteed:
//! - For all addresses `a` in `addresses`, `a` is in the range `base .. (base +
//!   size)` (note that this requires `a < base + size`, not `a <= base + size`)
//! - `base` is not equal to [`null()`] (i.e., the address with the numerical
//! value 0)
//! - `base + size <= usize::MAX`
//! - `size <= isize::MAX`
//!
//! As a consequence of these guarantees, given any address `a` within the set
//! of addresses of an allocation:
//! - It is guaranteed that `a - base` does not overflow `isize`
//! - It is guaranteed that `a - base` is non-negative
//! - It is guaranteed that, given `o = a - base` (i.e., the offset of `a` within
//!   the allocation), `base + o` will not wrap around the address space (in
//!   other words, will not overflow `usize`)
//!
//! 分配允许通过添加更多页面来增长大小，在末尾添加更多页面即可。在开头添加更多页面，或
//! directly invoking page table operations of the operating system, e.g. via `mmap`, are allowed to
//! grow by adding more pages to them at the end. Adding more pages before the beginning, or
//! # 细指针和宽指针
//! not supported. Allocations created via "compiler-recognized" operations, such as `std::alloc`
//! methods or `libc::malloc`, can never change their size, even if they use `mmap` under the hood.
//!
//! [`null()`]: null
//!
//! # 有些指针仅存储指针目标的地址，则称为 **细指针**，每个
//!
//! 指向有固定大小的类型的指针都保证是细指针。
//! 目前，宽指针的大小是细指针的两倍，
//! 不过，这一情况未来可能会改变。
//! pointer to a sized type is guaranteed to be thin.
//!
//! # 来源信息
//! 指针不仅仅是“整数”或“地址”。例如，即使你“运气好”，
//!
//! Wide pointers are commonly used when working with [`DSTs`].
//!
//! [`DSTs`]: https://doc.rust-lang.org/reference/dynamically-sized-types.html
//!
//! # Provenance
//!
//! Pointers are not *simply* an "integer" or "address". For instance, it's uncontroversial
//! to say that a Use After Free is clearly Undefined Behavior, even if you "get lucky"
//! and the freed memory gets reallocated before your read/write (in fact this is the
//! 如果这种情况没有发生，最坏情况下的 UAF 问题就会少很多！）。
//! As another example, consider that [`wrapping_offset`] is documented to "remember"
//! 原始指针所指向的分配，即使它位于
//! 该分配所占据的内存范围之外。
//! 为了合理解释这样的声明，指针必须比它们的地址更**丰富**：
//! 它们必须有**来源信息**。
//!
//! 在 Rust 中，指针值在语义上包含以下信息：
//!
//! * The **address** it points to, which can be represented by a `usize`.
//! * 它的**来源信息**，定义了它有权访问的内存。来源信息可以是
//! 缺失的，在这种情况下，指针没有权限访问任何内存。
//!
//! 来源信息的确切结构尚未明确，但指针的来源信息包含*空间*组件、*时间*组件和*可变性*组件：
//! * 空间：指针可以访问的内存地址集合。
//! * 时间：指针可以访问这些内存地址的时间段。
//!
//! * 可变性：指针是否只能读取内存，或者也可以写入内存。注意，这与其他组件相互作用，例如，一个指针可能只允许
//! 对部分地址进行修改，或仅在其最大时间段内的部分地址进行修改。
//! 当[分配]创建时，它有一个唯一的原始指针。对于分配
//! API，这实际上就是调用返回的指针，对于局部变量和静态变量，
//! 这是变量/静态变量的名称。（这是为了简洁/说明而轻微使用“指针”这一术语。）
//!
//! 分配的原始指针具有限制该指针*空间*权限的**来源信息**，以及限制其*时间*权限的
//! APIs this is literally the pointer the call returns, and for local variables and statics,
//! 从原始指针派生出的指针传递继承，
//! 包括*空间*组件、*时间*组件和*可变性*组件。
//!
//! * 空间：指针可以访问的内存地址集合。
//! * 时间：指针可以访问这些内存地址的时间段。
//! * 可变性：指针是否只能读取内存，或者也可以写入内存。注意，这与其他组件相互作用，例如，一个指针可能只允许
//! pointers transitively derived from the Original Pointer through operations like [`offset`],
//! 当[分配]创建时，它有一个唯一的原始指针。对于分配
//! API，这实际上就是调用返回的指针，对于局部变量和静态变量，
//! 这是变量/静态变量的名称。（这是为了简洁/说明而轻微使用“指针”这一术语。）
//! 缩小来源的生命周期成分。然而，没有任何操作能够*扩大*
//! 派生来源的权限：即使你知道存在更大的分配，你也无法
//! 从具有更大来源的指针中派生出指针。同样，你也不能将两个
//! contiguous provenances back into one (i.e. with a `fn merge(&[T], &[T]) -> &[T]`).
//!
//! 对某个位置的引用始终具有至少该位置所占用内存的来源。
//! 对一个切片的引用始终具有至少切片所描述的范围的来源。
//! 引用来源是否以及何时被*精确*缩小以完全适应
//! 其指向的内存，目前还无法确定。
//!
//! *共享*引用仅具有允许从内存读取的来源，
//! and never permits writes, except inside [`UnsafeCell`].
//!
//! 来源可以影响程序是否出现未定义行为：
//!
//! * 通过没有来源的指针访问内存是未定义行为。
//! 注意，指针在其来源末尾的部分实际上并不在其来源之外，它只有 0 字节可以加载/存储。零大小访问不需要任何
//! 来源，因为它们访问的是空内存范围。
//!   provenance since they access an empty range of memory.
//!
//! * It is undefined behavior to [`offset`] a pointer across a memory range that is not contained
//!   in the allocation it is derived from, or to [`offset_from`] two pointers not derived
//! 标识相关的分配。特别是，从现在被释放的东西派生的指针进行偏移总是会导致未定义行为，除非偏移量为 0。
//! 但以下做法仍然是正确的：
//!   that identifies the relevant allocation. In particular, it's always UB to offset a
//!   pointer derived from something that is now deallocated, except if the offset is 0.
//!
//! 的标记指针。一般来说，对于整数假装成指针“用于娱乐”总是正确的，只要你不使用需要其有效的操作（非零大小
//!
//! * Create a pointer without provenance from just an address (see [`without_provenance`]). Such a
//! pointer cannot be used for memory accesses (except for zero-sized accesses). This can still be
//!   useful for sentinel values like `null` *or* to represent a tagged pointer that will never be
//! dereferenceable. In general, it is always sound for an integer to pretend to be a pointer "for
//! fun" as long as you don't use operations on it which require it to be valid (non-zero-sized
//! offset, read, write, etc).
//!
//! * 在任何足够对齐且非空地址上，可以分配大小为零的内存。
//! 即适用通常的“ZST 是假的，做你想做的事”的规则。
//!
//! * [`wrapping_offset`] a pointer outside its provenance. This includes pointers
//! 没有来源的指针。特别是，这使得进行指针标记技巧变得可行。
//!
//! * 通过地址比较任意指针。指针比较忽略来源和地址
//! *是* 只是整数，所以即使指针是悬空的或来自不同的来源，也总是有一个合理的答案。
//! 请注意，如果你“幸运”地发现一个分配结束处的指针与另一个分配的起始地址相同，
//! 那么利用这一事实所做的任何操作*很可能*都是无意义的。这种
//! 无意义性的范围被两个指针仍然不允许访问对方的内存（字节）这一事实所控制，因为它们的来源不同。
//! 注意，Rust 中来源的完整定义尚未确定，因为这与尚未确定的[别名]规则有关。
//! ## 指针与整数
//!
//! Note that the full definition of provenance in Rust is not decided yet, as this interacts
//! with the as-yet undecided [aliasing] rules.
//!
//! ## 结果指针应该具有哪种来源？
//!
//! From this discussion, it becomes very clear that a `usize` *cannot* accurately represent a pointer,
//! and converting from a pointer to a `usize` is generally an operation which *only* extracts the
//! 指针类型。
//! ## 严格来源
//!
//! “严格来源”指的是一组旨在使处理来源更加明确的 API。
//!
//! Note that a pointer *can* represent a `usize` (via [`without_provenance`]), so the right type to
//! use in situations where a value is "sometimes a pointer and sometimes a bare `usize`" is a
//! 使不使用整数到指针转换的编程变得可行的关键洞察是
//!
//! ## Strict Provenance
//!
//! "Strict Provenance" refers to a set of APIs designed to make working with provenance more
//! explicit. They are intended as substitutes for casting a pointer to an integer and back.
//!
//! Entirely avoiding integer-to-pointer casts successfully side-steps the inherent ambiguity of
//! that operation. This benefits compiler optimizations, and it is pretty much a requirement for
//! using tools like [Miri] and architectures like [CHERI] that aim to detect and diagnose pointer
//! misuse.
//!
//! The key insight to making programming without integer-to-pointer casts *at all* viable is the
//! [`with_addr`] method:
//!
//! ```text
//! /// Creates a new pointer with the given address and the provenance  of `self`.
//! ///
//! /// This is similar to a `addr as *const T` cast,
//! /// but copies the provenance of `self` to the new pointer.
//! /// This avoids the inherent ambiguity of the unary cast.
//! ///
//! /// This is equivalent to using `wrapping_offset` to offset `self` to the given address,
//! /// and therefore has all the same capabilities and restrictions.
//! pub fn with_addr(self, addr: usize) -> Self;
//! ```
//!
//! 因此你仍然可以切换到地址表示方式并执行所需操作
//! 只要你能保留一个指针，就可以使用任何巧妙的技巧
//! 进入你关心的分配过程，从而“重新构建”来源信息
//! 通常这非常简单，因为你只是获取一个指针，修改地址即可
//! 然后立即转换回指针。为了使这个用例更易于使用，
//! we provide the [`map_addr`] method.
//!
//! 为了明确说明代码遵循 Strict Provenance 语义，我们还提供了
//! [`addr`] method which promises that the returned address is not part of a
//! pointer-integer-pointer roundtrip. In the future we may provide a lint for pointer<->integer
//! ### 使用 Strict Provenance
//!
//! ### 使用 Strict Provenance
//!
//! 大多数代码无需修改即可符合严格来源规则，因为唯一真正需要关注的
//! operation is casts from `usize` to a pointer. For code which *does* cast a `usize` to a pointer,
//! 更改范围取决于你的具体操作。
//!
//! In general, you just need to make sure that if you want to convert a `usize` address to a
//! 指针，然后使用该指针读写内存，你需要保留一个具有足够来源信息的指针
//! 以便能够进行读写操作。这样所有从地址到指针的转换本质上只是应用偏移量/索引操作。
//! casts from an address to a pointer are essentially just applying offsets/indexing.
//!
//! 例如：
//! represent the tagged pointer as an actual pointer and not a `usize`*. For instance:
//!
//! ```
//! // A flag we want to pack into our pointer
//! static HAS_DATA: usize = 0x1;
//! static FLAG_MASK: usize = !HAS_DATA;
//!
//! // Our value, which must have enough alignment to have spare least-significant-bits.
//! let my_precious_data: u32 = 17;
//! assert!(align_of::<u32>() > 1);
//!
//! // Create a tagged pointer
//! let ptr = &my_precious_data as *const u32;
//! let tagged = ptr.map_addr(|addr| addr | HAS_DATA);
//!
//! // Check the flag:
//! if tagged.addr() & HAS_DATA != 0 {
//!     // Untag and read the pointer
//!     let data = unsafe { *tagged.map_addr(|addr| addr & FLAG_MASK) };
//!     assert_eq!(data, 17);
//! } else {
//!     unreachable!()
//! }
//! ```
//!
//! (Yes, if you've been using [`AtomicUsize`] for pointers in concurrent datastructures, you should
//! be using [`AtomicPtr`] instead. If that messes up the way you atomically manipulate pointers,
//! 当必须从地址直接创建有效指针的情况，例如裸机代码
//!
//! Situations where a valid pointer *must* be created from just an address, such as baremetal code
//! ## Exposed Provenance
//! provenance APIs and should use [exposed provenance](#exposed-provenance).
//!
//! ## 这是设计上的决定：Strict Provenance 的目标是提供明确的规范
//!
//! As discussed above, integer-to-pointer casts are not possible with Strict Provenance APIs.
//! This is by design: the goal of Strict Provenance is to provide a clear specification that we are
//! “自信”可以明确地被形式化，并且可以经过严谨的形式化推理。
//! 目前，整数到指针的转换并没有如此清晰的规定。
//!
//! 然而，有些情况下无法避免进行整数到指针的转换，或者
//! 避免这种转换需要大规模的重构。旧版平台 API 也通常假设
//! that `usize` can capture all the information that makes up a pointer.
//! 裸机平台可能还需要“凭空”生成指针，而没有任何来源来确认其来源。
//! Rust 处理整数到指针转换的模型被称为 *Exposed Provenance*。不过，
//!
//! *Exposed Provenance* 的语义比 *Strict Provenance* 更不可靠，目前还不清楚是否能为
//! *Exposed Provenance* 定义出明确且无歧义的语义。（如果听起来不好，放心，其他提供整数到指针转换的流行语言也一样。）此外，*Exposed Provenance* 与 [Miri] 和 [CHERI] 等工具配合起来也不好用。
//! at this point it is not yet clear whether a satisfying unambiguous semantics can be defined for
//! Exposed Provenance. (If that sounds bad, be reassured that other popular languages that provide
//! integer-to-pointer casts are not faring any better.) Furthermore, Exposed Provenance will not
//! 属于 Rust 抽象机控制范围之外的内存（例如 MMIO 寄存器）总是被视为被暴露的，只要这些内存与栈、堆和静态变量等抽象机使用的内存不重叠即可。
//!
//! Exposed Provenance is provided by the [`expose_provenance`] and [`with_exposed_provenance`] methods,
//! which are equivalent to `as` casts between pointers and integers.
//! - [`expose_provenance`] is a lot like [`addr`], but additionally adds the provenance of the
//! pointer to a global list of 'exposed' provenances. (This list is purely conceptual, it exists
//! for the purpose of specifying Rust but is not materialized in actual executions, except in
//! tools like [Miri].)
//! Memory which is outside the control of the Rust abstract machine (MMIO registers, for example)
//! is always considered to be exposed, so long as this memory is disjoint from memory that will
//! be used by the abstract machine such as the stack, heap, and statics.
//! - [`with_exposed_provenance`] can be used to construct a pointer with one of these previously
//!   'exposed' provenances. [`with_exposed_provenance`] takes only `addr: usize` as arguments, so
//!   unlike in [`with_addr`] there is no indication of what the correct provenance for the returned
//! pointer is -- and that is exactly what makes integer-to-pointer casts so tricky to rigorously
//! specify! The compiler will do its best to pick the right provenance for you, but currently we
//! cannot provide any guarantees about which provenance the resulting pointer will have. Only one
//! 明确的是：如果*没有*先前被“暴露”的来源证明可以支持使用返回的指针，则程序会出现未定义行为。
//! 我们鼓励代码迁移到 [严格来源] API，从而避免需要 Exposed Provenance。
//!
//! 在可能的情况下，我们鼓励代码迁移到 [严格来源] API，从而避免需要 Exposed Provenance。
//! 最大化此类代码的占比是避免规范复杂性和使用 [CHERI] 和 [Miri] 等工具的重要方式，这些工具
//! 能极大提升对 (unsafe) Rust 代码的信任度。然而，我们承认这并非总是可能，因此提供 Exposed Provenance 作为一种明确“选择不采用”严格来源的明确定义语义的方式，以及“选择采用”不明确语义的方式。
//! 用于整数到指针的转换。
//! is not always possible, and offer Exposed Provenance as a way to explicit "opt out" of the
//! 和目的地不得重叠。
//! integer-to-pointer casts.
//!
//! [aliasing]: ../../nomicon/aliasing.html
//! [allocation]: #allocation
//! [provenance]: #provenance
//! [book]: ../../book/ch19-01-unsafe-rust.html#dereferencing-a-raw-pointer
//! [ub]: ../../reference/behavior-considered-undefined.html
//! [zst]: ../../nomicon/exotic-sizes.html#zero-sized-types-zsts
//! [atomic operations]: crate::sync::atomic
//! [`offset`]: pointer::offset
//! [`offset_from`]: pointer::offset_from
//! [`wrapping_offset`]: pointer::wrapping_offset
//! [`with_addr`]: pointer::with_addr
//! [`map_addr`]: pointer::map_addr
//! [`addr`]: pointer::addr
//! [`AtomicUsize`]: crate::sync::atomic::AtomicUsize
//! [`AtomicPtr`]: crate::sync::atomic::AtomicPtr
//! [`expose_provenance`]: pointer::expose_provenance
//! [`with_exposed_provenance`]: with_exposed_provenance
//! [Miri]: https://github.com/rust-lang/miri
//! [CHERI]: https://www.cl.cam.ac.uk/research/security/ctsrd/cheri/
//! [Strict Provenance]: #strict-provenance
//! [`UnsafeCell`]: core::cell::UnsafeCell

#![stable(feature = "rust1", since = "1.0.0")]
// There are many unsafe functions taking pointers that don't dereference them.
#![allow(clippy::not_unsafe_ptr_arg_deref)]

use crate::cmp::Ordering;
use crate::intrinsics::const_eval_select;
use crate::marker::{Destruct, PointeeSized};
use crate::mem::{self, MaybeUninit, SizedTypeProperties};
use crate::num::NonZero;
use crate::ops::FnPtr;
use crate::{fmt, hash, intrinsics, ub_checks};

mod metadata;
#[unstable(feature = "ptr_metadata", issue = "81513")]
pub use metadata::{DynMetadata, Pointee, Thin, from_raw_parts, from_raw_parts_mut, metadata};

mod non_null;
#[stable(feature = "nonnull", since = "1.25.0")]
pub use non_null::NonNull;

mod const_ptr;
mod mut_ptr;

// Some functions are defined here because they accidentally got made
// available in this module on stable. See <https://github.com/rust-lang/rust/issues/15702>.
// (`transmute` also falls into this category, but it cannot be wrapped due to the
// check that `T` and `U` have the same size.)

/// Copies `count * size_of::<T>()` bytes from `src` to `dst`. The source
/// 源和目的地参数交换了位置。
///
/// For regions of memory which might overlap, use [`copy`] instead.
///
/// `copy_nonoverlapping` is semantically equivalent to C's [`memcpy`], but
/// # 安全性
/// and `count` counting the number of `T`s instead of bytes.
///
/// The copy is "untyped" in the sense that data may be uninitialized or otherwise violate the
/// requirements of `T`. The initialization state is preserved exactly.
///
/// [`memcpy`]: https://en.cppreference.com/w/c/string/byte/memcpy
///
/// # Safety
///
/// Behavior is undefined if any of the following conditions are violated:
///
/// * `src` must be [valid] for reads of `count * size_of::<T>()` bytes or that number must be 0.
///
/// * `dst` must be [valid] for writes of `count * size_of::<T>()` bytes or that number must be 0.
///
/// * Both `src` and `dst` must be properly aligned.
///
/// * The region of memory beginning at `src` with a size of `count *
///   size_of::<T>()` bytes must *not* overlap with the region of memory
///   beginning at `dst` with the same size.
///
/// Like [`read`], `copy_nonoverlapping` creates a bitwise copy of `T`, regardless of
/// whether `T` is [`Copy`]. If `T` is not [`Copy`], using *both* the values
/// in the region beginning at `*src` and the region beginning at `*dst` can
/// 违反内存安全[读取所有权]。
///
/// Note that even if the effectively copied size (`count * size_of::<T>()`) is
/// `0`, the pointers must be properly aligned.
///
/// [`read`]: crate::ptr::read
/// [read-ownership]: crate::ptr::read#ownership-of-the-returned-value
/// [valid]: crate::ptr#safety
///
/// # Examples
///
/// Manually implement [`Vec::append`]:
///
/// ```
/// use std::ptr;
///
/// /// Moves all the elements of `src` into `dst`, leaving `src` empty.
/// fn append<T>(dst: &mut Vec<T>, src: &mut Vec<T>) {
///     let src_len = src.len();
///     let dst_len = dst.len();
///
///     // Ensure that `dst` has enough capacity to hold all of `src`.
///     dst.reserve(src_len);
///
///     unsafe {
///         // The call to add is always safe because `Vec` will never
///         // allocate more than `isize::MAX` bytes.
///         let dst_ptr = dst.as_mut_ptr().add(dst_len);
///         let src_ptr = src.as_ptr();
///
///         // Truncate `src` without dropping its contents. We do this first,
///         // to avoid problems in case something further down panics.
///         src.set_len(0);
///
///         // The two regions cannot overlap because mutable references do
///         // not alias, and two different vectors cannot own the same
///         // memory.
///         ptr::copy_nonoverlapping(src_ptr, dst_ptr, src_len);
///
///         // Notify `dst` that it now holds the contents of `src`.
///         dst.set_len(dst_len + src_len);
///     }
/// }
///
/// let mut a = vec!['r'];
/// let mut b = vec!['u', 's', 't'];
///
/// append(&mut a, &mut b);
///
/// assert_eq!(a, &['r', 'u', 's', 't']);
/// assert!(b.is_empty());
/// ```
///
/// [`Vec::append`]: ../../std/vec/struct.Vec.html#method.append
#[doc(alias = "memcpy")]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
#[inline(always)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_diagnostic_item = "ptr_copy_nonoverlapping"]
pub const unsafe fn copy_nonoverlapping<T>(src: *const T, dst: *mut T, count: usize) {
    ub_checks::assert_unsafe_precondition!(
        check_language_ub,
        "ptr::copy_nonoverlapping requires that both pointer arguments are aligned and non-null \
        and the specified memory ranges do not overlap",
        (
            src: *const () = src as *const (),
            dst: *mut () = dst as *mut (),
            size: usize = size_of::<T>(),
            align: usize = align_of::<T>(),
            count: usize = count,
        ) => {
            let zero_size = count == 0 || size == 0;
            ub_checks::maybe_is_aligned_and_not_null(src, align, zero_size)
                && ub_checks::maybe_is_aligned_and_not_null(dst, align, zero_size)
                && ub_checks::maybe_is_nonoverlapping(src, dst, size, count)
        }
    );

    // SAFETY: the safety contract for `copy_nonoverlapping` must be
    // upheld by the caller.
    unsafe { crate::intrinsics::copy_nonoverlapping(src, dst, count) }
}

/// Copies `count * size_of::<T>()` bytes from `src` to `dst`. The source
/// and destination may overlap.
///
/// 如果源地址和目标地址永远不会重叠，
/// [`copy_nonoverlapping`] can be used instead.
///
/// `copy` is semantically equivalent to C's [`memmove`], but
/// 需要交换源地址和目标地址参数。
/// and `count` counting the number of `T`s instead of bytes.
/// Copying takes place as if the bytes were copied from `src`
/// to a temporary array and then copied from the array to `dst`.
///
/// # 安全性
/// requirements of `T`. The initialization state is preserved exactly.
///
/// [`memmove`]: https://en.cppreference.com/w/c/string/byte/memmove
///
/// # Safety
///
/// Behavior is undefined if any of the following conditions are violated:
///
/// * `src` must be [valid] for reads of `count * size_of::<T>()` bytes or that number must be 0.
///
/// * `dst` must be [valid] for writes of `count * size_of::<T>()` bytes or that number must be 0,
///   and `dst` must remain valid even when `src` is read for `count * size_of::<T>()` bytes. (This
///   means if the memory ranges overlap, the `dst` pointer must not be invalidated by `src` reads.)
///
/// * Both `src` and `dst` must be properly aligned.
///
/// Like [`read`], `copy` creates a bitwise copy of `T`, regardless of
/// whether `T` is [`Copy`]. If `T` is not [`Copy`], using both the values
/// in the region beginning at `*src` and the region beginning at `*dst` can
/// [violate memory safety][read-ownership].
///
/// Note that even if the effectively copied size (`count * size_of::<T>()`) is
/// `0`, the pointers must be properly aligned.
///
/// [`read`]: crate::ptr::read
/// [read-ownership]: crate::ptr::read#ownership-of-the-returned-value
/// [valid]: crate::ptr#safety
///
/// # 高效地从不安全的缓冲区创建 Rust 向量：
///
/// 从不安全的缓冲区高效创建 Rust 向量：
///
/// ```
/// use std::ptr;
///
/// /// # Safety
/// ///
/// /// * `ptr` must be correctly aligned for its type and non-zero.
/// /// * `ptr` must be valid for reads of `elts` contiguous elements of type `T`.
/// /// * Those elements must not be used after calling this function unless `T: Copy`.
/// # #[allow(dead_code)]
/// unsafe fn from_buf_raw<T>(ptr: *const T, elts: usize) -> Vec<T> {
///     let mut dst = Vec::with_capacity(elts);
///
///     // SAFETY: Our precondition ensures the source is aligned and valid,
///     // and `Vec::with_capacity` ensures that we have usable space to write them.
///     unsafe { ptr::copy(ptr, dst.as_mut_ptr(), elts); }
///
///     // SAFETY: We created it with this much capacity earlier,
///     // and the previous `copy` has initialized these elements.
///     unsafe { dst.set_len(elts); }
///     dst
/// }
/// ```
#[doc(alias = "memmove")]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
#[inline(always)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_diagnostic_item = "ptr_copy"]
pub const unsafe fn copy<T>(src: *const T, dst: *mut T, count: usize) {
    // SAFETY: the safety contract for `copy` must be upheld by the caller.
    unsafe {
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::copy requires that both pointer arguments are aligned and non-null",
            (
                src: *const () = src as *const (),
                dst: *mut () = dst as *mut (),
                align: usize = align_of::<T>(),
                zero_size: bool = T::IS_ZST || count == 0,
            ) =>
            ub_checks::maybe_is_aligned_and_not_null(src, align, zero_size)
                && ub_checks::maybe_is_aligned_and_not_null(dst, align, zero_size)
        );
        crate::intrinsics::copy(src, dst, count)
    }
}

/// Sets `count * size_of::<T>()` bytes of memory starting at `dst` to
/// `val`.
///
/// `write_bytes` is similar to C's [`memset`], but sets `count *
/// size_of::<T>()` bytes to `val`.
///
/// [`memset`]: https://en.cppreference.com/w/c/string/byte/memset
///
/// # 如果违反以下任何条件，行为将未定义：
///
/// 如果违反以下任何条件，行为将未定义：
///
/// * `dst` must be [valid] for writes of `count * size_of::<T>()` bytes.
///
/// * `dst` must be properly aligned.
///
/// Note that even if the effectively copied size (`count * size_of::<T>()`) is
/// `0`, the pointer must be properly aligned.
///
/// Additionally, note that changing `*dst` in this way can easily lead to undefined behavior (UB)
/// later if the written bytes are not a valid representation of some `T`. For instance, the
/// # 示例
///
/// ```rust,no_run
/// unsafe {
///     let mut value: u8 = 0;
///     let ptr: *mut bool = &mut value as *mut u8 as *mut bool;
///     let _bool = ptr.read(); // This is fine, `ptr` points to a valid `bool`.
///     ptr.write_bytes(42u8, 1); // This function itself does not cause UB...
///     let _bool = ptr.read(); // ...but it makes this operation UB! ⚠️
/// }
/// ```
///
/// [valid]: crate::ptr#safety
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// use std::ptr;
///
/// let mut vec = vec![0u32; 4];
/// unsafe {
///     let vec_ptr = vec.as_mut_ptr();
///     ptr::write_bytes(vec_ptr, 0xfe, 2);
/// }
/// assert_eq!(vec, [0xfefefefe, 0xfefefefe, 0, 0]);
/// ```
#[doc(alias = "memset")]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_ptr_write", since = "1.83.0")]
#[inline(always)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_diagnostic_item = "ptr_write_bytes"]
pub const unsafe fn write_bytes<T>(dst: *mut T, val: u8, count: usize) {
    // SAFETY: the safety contract for `write_bytes` must be upheld by the caller.
    unsafe {
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::write_bytes requires that the destination pointer is aligned and non-null",
            (
                addr: *const () = dst as *const (),
                align: usize = align_of::<T>(),
                zero_size: bool = T::IS_ZST || count == 0,
            ) => ub_checks::maybe_is_aligned_and_not_null(addr, align, zero_size)
        );
        crate::intrinsics::write_bytes(dst, val, count)
    }
}

/// 执行指向值的析构函数（如果存在）。
///
/// This is almost the same as calling [`ptr::read`] and discarding
/// the result, but has the following advantages:
// FIXME: say something more useful than "almost the same"?
// There are open questions here: `read` requires the value to be fully valid, e.g. if `T` is a
// `bool` it must be 0 or 1, if it is a reference then it must be dereferenceable. `drop_in_place`
// only requires that `*to_drop` be "valid for dropping" and we have not defined what that means. In
// Miri it currently (May 2024) requires nothing at all for types without drop glue.
///
/// * It is *required* to use `drop_in_place` to drop unsized types like
///   trait objects, because they can't be read out onto the stack and
///   dropped normally.
///
/// * It is friendlier to the optimizer to do this over [`ptr::read`] when
/// # 安全性
///   `Box`/`Rc`/`Vec`), as the compiler doesn't need to prove that it's
///   sound to elide the copy.
///
/// * It can be used to drop [pinned] data when `T` is not `repr(packed)`
///   (pinned data must not be moved before it is dropped).
///
/// Unaligned values cannot be dropped in place, they must be copied to an aligned
/// location first using [`ptr::read_unaligned`]. For packed structs, this move is
/// 手动从向量中移除最后一个元素：
/// are not dropped in-place.
///
/// [`ptr::read`]: self::read
/// [`ptr::read_unaligned`]: self::read_unaligned
/// [pinned]: crate::pin
///
/// # 创建空原始指针。
///
/// 此函数相当于对指针进行零初始化。
///
/// * `to_drop` must be [valid] for both reads and writes.
///
/// * `to_drop` must be properly aligned, even if `T` has size 0.
///
/// * `to_drop` must be nonnull, even if `T` has size 0.
///
/// * The value `to_drop` points to must be valid for dropping, which may mean
/// 生成的指针地址为 0。
/// # 示例
/// 手动从向量中移除最后一个元素：
///
/// * While `drop_in_place` is executing, the only way to access parts of
///   `to_drop` is through the `&mut self` references supplied to the
///   `Drop::drop` methods that `drop_in_place` invokes.
///
/// Additionally, if `T` is not [`Copy`], using the pointed-to value after
/// calling `drop_in_place` can cause undefined behavior. Note that `*to_drop =
/// 此函数相当于对指针进行零初始化。
/// again. [`write()`] can be used to overwrite data without causing it to be
/// dropped.
///
/// [valid]: self#safety
///
/// # Examples
///
/// Manually remove the last item from a vector:
///
/// ```
/// use std::ptr;
/// use std::rc::Rc;
///
/// let last = Rc::new(1);
/// let weak = Rc::downgrade(&last);
///
/// let mut v = vec![Rc::new(0), last];
///
/// unsafe {
///     // Get a raw pointer to the last element in `v`.
///     let ptr = &mut v[1] as *mut _;
///     // Shorten `v` to prevent the last item from being dropped. We do that first,
///     // to prevent issues if the `drop_in_place` below panics.
///     v.set_len(1);
///     // Without a call `drop_in_place`, the last item would never be dropped,
///     // and the memory it manages would be leaked.
///     ptr::drop_in_place(ptr);
/// }
///
/// assert_eq!(v, &[0.into()]);
///
/// // Ensure that the last item was dropped.
/// assert!(weak.upgrade().is_none());
/// ```
#[inline(always)]
#[stable(feature = "drop_in_place", since = "1.8.0")]
#[rustc_diagnostic_item = "ptr_drop_in_place"]
#[rustc_const_unstable(feature = "const_drop_in_place", issue = "109342")]
pub const unsafe fn drop_in_place<T: PointeeSized>(to_drop: *mut T)
where
    T: [const] Destruct,
{
    // Due to historic reasons, `drop_in_place` takes a pointer rather than a reference,
    // which results in worse codegen since we don't apply noalias/dereferenceable llvm
    // attributes to pointer arguments. To workaround this without breaking public
    // interface, `drop_in_place` calls the lang item, rather than being one directly.

    // SAFETY:
    // - compiler glue has the same safety requirements as this function
    // - the pointer must be valid as per the safety requirement of this function
    unsafe { drop_glue(&mut *to_drop) }
}

/// Helper function for `drop_in_place`. The compiler replaces this by the actual drop glue.
#[lang = "drop_glue"]
pub(crate) const unsafe fn drop_glue<T: PointeeSized>(_: &mut T)
where
    T: [const] Destruct,
{
    // Code here does not matter - this is replaced by the
    // real drop glue by the compiler.
}

/// Creates a null raw pointer.
///
/// This function is equivalent to zero-initializing the pointer:
/// `MaybeUninit::<*const T>::zeroed().assume_init()`.
/// The resulting pointer has the address 0.
///
/// # Examples
///
/// ```
/// use std::ptr;
///
/// let p: *const i32 = ptr::null();
/// assert!(p.is_null());
/// assert_eq!(p as usize, 0); // this pointer has the address 0
/// ```
#[inline(always)]
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_promotable]
#[rustc_const_stable(feature = "const_ptr_null", since = "1.24.0")]
#[rustc_diagnostic_item = "ptr_null"]
pub const fn null<T: PointeeSized + Thin>() -> *const T {
    from_raw_parts(without_provenance::<()>(0), ())
}

/// Creates a null mutable raw pointer.
///
/// This function is equivalent to zero-initializing the pointer:
/// `MaybeUninit::<*mut T>::zeroed().assume_init()`.
/// The resulting pointer has the address 0.
///
/// # 示例
///
/// ```
/// use std::ptr;
///
/// let p: *mut i32 = ptr::null_mut();
/// assert!(p.is_null());
/// assert_eq!(p as usize, 0); // this pointer has the address 0
/// ```
#[inline(always)]
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_promotable]
#[rustc_const_stable(feature = "const_ptr_null", since = "1.24.0")]
#[rustc_diagnostic_item = "ptr_null_mut"]
pub const fn null_mut<T: PointeeSized + Thin>() -> *mut T {
    from_raw_parts_mut(without_provenance_mut::<()>(0), ())
}

/// 以给定的地址创建指针，且没有 [来源][crate::ptr#provenance]。
///
/// This is equivalent to `ptr::null().with_addr(addr)`.
///
/// 没有来源的情况下，该指针与任何实际分配无关。这样的
/// 无来源指针可用于零大小内存访问（如果适当对齐），但
/// 使用无来源指针进行非零大小内存访问是未定义行为。无来源指针只是
/// little more than a `usize` address in disguise.
///
/// This is different from `addr as *const T`, which creates a pointer that picks up a previously
/// exposed provenance. See [`with_exposed_provenance`] for more details on that operation.
///
/// 这是 [严格来源][crate::ptr#strict-provenance] API。
#[inline(always)]
#[must_use]
#[stable(feature = "strict_provenance", since = "1.84.0")]
#[rustc_const_stable(feature = "strict_provenance", since = "1.84.0")]
#[rustc_diagnostic_item = "ptr_without_provenance"]
pub const fn without_provenance<T>(addr: usize) -> *const T {
    without_provenance_mut(addr)
}

/// 创建一个新的指针，该指针是悬空的，但非空且对齐良好。
///
/// 这对于初始化延迟分配的类型很有用，比如
/// `Vec::new` does.
///
/// 请注意，返回的指针地址可能
/// 是一个有效的指针地址，这意味着不得将其用作“尚未初始化”的哨兵值。
/// “尚未初始化”的哨兵值。
/// 延迟分配的类型必须通过其他方式跟踪初始化过程。
#[inline(always)]
#[must_use]
#[stable(feature = "strict_provenance", since = "1.84.0")]
#[rustc_const_stable(feature = "strict_provenance", since = "1.84.0")]
pub const fn dangling<T>() -> *const T {
    dangling_mut()
}

/// 以给定的地址创建指针，且没有 [来源][crate::ptr#provenance]。
///
/// This is equivalent to `ptr::null_mut().with_addr(addr)`.
///
/// 没有来源的情况下，该指针与任何实际分配无关。这样的
/// 无来源指针可用于零大小内存访问（如果适当对齐），但
/// 使用无来源指针进行非零大小内存访问是未定义行为。无来源指针只是
/// little more than a `usize` address in disguise.
///
/// This is different from `addr as *mut T`, which creates a pointer that picks up a previously
/// exposed provenance. See [`with_exposed_provenance_mut`] for more details on that operation.
///
/// 这是 [严格来源][crate::ptr#strict-provenance] API。
#[inline(always)]
#[must_use]
#[stable(feature = "strict_provenance", since = "1.84.0")]
#[rustc_const_stable(feature = "strict_provenance", since = "1.84.0")]
#[rustc_diagnostic_item = "ptr_without_provenance_mut"]
#[allow(integer_to_ptr_transmutes)] // Expected semantics here.
pub const fn without_provenance_mut<T>(addr: usize) -> *mut T {
    // An int-to-pointer transmute currently has exactly the intended semantics: it creates a
    // pointer without provenance. Note that this is *not* a stable guarantee about transmute
    // semantics, it relies on sysroot crates having special status.
    // SAFETY: every valid integer is also a valid pointer (as long as you don't dereference that
    // pointer).
    unsafe { mem::transmute(addr) }
}

/// 创建一个新的指针，该指针是悬空的，但非空且对齐良好。
///
/// 这对于初始化延迟分配的类型很有用，比如
/// `Vec::new` does.
///
/// 请注意，返回的指针地址可能
/// 是一个有效的指针地址，这意味着不得将其用作“尚未初始化”的哨兵值。
/// “尚未初始化”的哨兵值。
/// 延迟分配的类型必须通过其他方式跟踪初始化过程。
#[inline(always)]
#[must_use]
#[stable(feature = "strict_provenance", since = "1.84.0")]
#[rustc_const_stable(feature = "strict_provenance", since = "1.84.0")]
pub const fn dangling_mut<T>() -> *mut T {
    NonNull::dangling().as_ptr()
}

/// 将地址转换回指针，并获取之前“暴露”的
/// [来源][crate::ptr#provenance]。
///
/// This is fully equivalent to `addr as *const T`. The provenance of the returned pointer is that
/// 来自之前通过传递而暴露的 *某个* 指针
/// [`expose_provenance`][pointer::expose_provenance], or a `ptr as usize` cast. In addition, memory
/// 位于 Rust 抽象机无法控制的范围内（例如 MMIO 寄存器）是
/// 只要该内存与抽象机使用的内存（如栈、堆和静态数据）不重叠，就认为可以通过暴露的出处访问
/// 这种内存始终被视为可访问的
///
/// 具体选择哪个出处并未明确说明。编译器会尽力为你选择“正确”的出处（无论那是什么），但目前我们无法提供任何
/// 关于生成的指针将具有哪种出处的保证——因此也
/// 没有明确的规范说明生成的指针可以访问哪种内存
/// 如果之前没有合理的出处证明生成指针的使用方式，程序就会出现未定义行为。特别是，别名规则仍然适用：
///
/// 由于别名访问导致无效的指针和引用无法再使用，即使它们之前被暴露过！
/// 由于固有的模糊性，这种操作可能不被帮助你遵循 Rust 内存模型的工具支持。建议尽可能使用 [严格
/// pointers and references that have been invalidated due to aliasing accesses cannot be used
/// 在大多数平台上，这将生成一个与地址具有相同字节值的值。需要向指针中存储额外信息的平台可能不支持此操作，
///
/// 由于固有的模糊性，这种操作可能不被帮助你遵循 Rust 内存模型的工具支持。建议尽可能使用 [严格
/// stay conformant with the Rust memory model. It is recommended to use [Strict
/// Provenance][self#strict-provenance] APIs such as [`with_addr`][pointer::with_addr] wherever
/// 在可能的情况下使用。
///
/// 在大多数平台上，这将生成一个与地址具有相同字节值的值。某些平台
/// 需要向指针中存储额外信息的平台可能不支持此操作，
/// 因为通常无法 *计算* 生成指针必须选择的出处
/// 这种操作是 [暴露出处][crate::ptr#exposed-provenance] API。
///
/// 将地址转换回可修改的指针，并获取之前被暴露的某种出处
#[must_use]
#[inline(always)]
#[stable(feature = "exposed_provenance", since = "1.84.0")]
#[rustc_const_stable(feature = "const_exposed_provenance", since = "1.91.0")]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[allow(implicit_provenance_casts)] // this *is* the explicit provenance API one should use instead
pub const fn with_exposed_provenance<T>(addr: usize) -> *const T {
    addr as *const T
}

/// [出处][crate::ptr#provenance]。
/// [provenance][crate::ptr#provenance].
///
/// This is fully equivalent to `addr as *mut T`. The provenance of the returned pointer is that
/// of *some* pointer that was previously exposed by passing it to
/// [`expose_provenance`][pointer::expose_provenance], or a `ptr as usize` cast. In addition, memory
/// 只要该内存与抽象机使用的内存不重叠，就认为可以通过暴露的出处访问
/// always considered to be accessible with an exposed provenance, so long as this memory is disjoint
/// 来自抽象机器使用的内存，例如栈、堆和静态内存。
///
/// 被选中的确切来源并未明确指定。编译器会尽力选择
/// “正确”的来源（无论那是什么），但目前我们无法提供任何
/// 关于所得指针将具有何种来源的保证——因此存在
/// 对于所得指针可以访问哪些内存没有明确的规范。
///
/// 如果之前没有“暴露”的来源能够证明返回指针的使用方式，程序就会产生未定义行为。特别是，别名规则仍然适用：
/// 由于别名访问导致无效的指针和引用不能再使用，
/// 即使它们已被暴露，也不能再使用！
/// 由于其固有的模糊性，此操作可能不被帮助您
///
/// 保持符合 Rust 内存模型的工具所支持。建议尽可能使用 [严格
/// stay conformant with the Rust memory model. It is recommended to use [Strict
/// Provenance][self#strict-provenance] APIs such as [`with_addr`][pointer::with_addr] wherever
/// 在大多数平台上，这将产生与地址相同字节的值。需要
///
/// 在指针中存储额外信息的平台可能不支持此操作，
/// 因为通常无法实际 *计算* 所得指针必须选择的来源。
/// 
/// pointer has to pick up.
///
/// 这是一个 [暴露的来源][crate::ptr#exposed-provenance] API。
#[must_use]
#[inline(always)]
#[stable(feature = "exposed_provenance", since = "1.84.0")]
#[rustc_const_stable(feature = "const_exposed_provenance", since = "1.91.0")]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[allow(implicit_provenance_casts)] // this *is* the explicit provenance API one should use instead
pub const fn with_exposed_provenance_mut<T>(addr: usize) -> *mut T {
    addr as *mut T
}

/// 将引用转换为原始指针。
///
/// For `r: &T`, `from_ref(r)` is equivalent to `r as *const T` (except for the caveat noted below),
/// 但更安全，因为它永远不会悄悄改变类型或可变性，特别是在代码被重构时。
/// 调用者必须确保被指向的对象比该函数返回的指针的寿命长，否则它会变成悬空指针。
///
/// 调用者还必须确保指针（非传递性）所指向的内存永远不会
/// will end up dangling.
///
/// The caller must also ensure that the memory the pointer (non-transitively) points to is never
/// written to (except inside an `UnsafeCell`) using this pointer or any pointer derived from it. If
/// you need to mutate the pointee, use [`from_mut`]. Specifically, to turn a mutable reference `m:
/// &mut T` into `*const T`, prefer `from_mut(m).cast_const()` to obtain a pointer that can later be
/// used for mutation.
///
/// ## Interaction with lifetime extension
///
/// Note that this has subtle interactions with the rules for lifetime extension of temporaries in
/// 尾部表达式。这段代码是有效的，尽管其用法不太直观：
/// ```rust
/// # type T = i32;
/// # fn foo() -> T { 42 }
/// // The temporary holding the return value of `foo` has its lifetime extended,
/// // because the surrounding expression involves no function call.
/// let p = &foo() as *const T;
/// unsafe { p.read() };
/// ```
/// Naively replacing the cast with `from_ref` is not valid:
/// ```rust,no_run
/// # use std::ptr;
/// # type T = i32;
/// # fn foo() -> T { 42 }
/// // The temporary holding the return value of `foo` does *not* have its lifetime extended,
/// // because the surrounding expression involves a function call.
/// let p = ptr::from_ref(&foo());
/// unsafe { p.read() }; // UB! Reading from a dangling pointer ⚠️
/// ```
/// 编写此代码的推荐方式是避免依赖生命周期扩展：
/// 当涉及原始指针时：
/// ```rust
/// # use std::ptr;
/// # type T = i32;
/// # fn foo() -> T { 42 }
/// let x = foo();
/// let p = ptr::from_ref(&x);
/// unsafe { p.read() };
/// ```
#[inline(always)]
#[must_use]
#[stable(feature = "ptr_from_ref", since = "1.76.0")]
#[rustc_const_stable(feature = "ptr_from_ref", since = "1.76.0")]
#[lint::never_returns_null_ptr]
#[rustc_diagnostic_item = "ptr_from_ref"]
pub const fn from_ref<T: PointeeSized>(r: &T) -> *const T {
    r
}

/// 将可变引用转换为原始指针。
///
/// For `r: &mut T`, `from_mut(r)` is equivalent to `r as *mut T` (except for the caveat noted
/// below), but is a bit safer since it will never silently change type or mutability, in particular
/// 如果代码进行了重构。
///
/// 调用者必须确保被指向的对象的生命周期长于该函数返回的指针，否则它会变成悬空指针。
/// 将会变成悬空指针。
///
/// ## 与生命周期扩展的互动
///
/// 请注意，这与尾部表达式中临时变量的生命周期扩展规则存在微妙的交互：
/// 尾部表达式。这段代码是有效的，尽管其用法不太直观：
/// ```rust
/// # type T = i32;
/// # fn foo() -> T { 42 }
/// // The temporary holding the return value of `foo` has its lifetime extended,
/// // because the surrounding expression involves no function call.
/// let p = &mut foo() as *mut T;
/// unsafe { p.write(T::default()) };
/// ```
/// Naively replacing the cast with `from_mut` is not valid:
/// ```rust,no_run
/// # use std::ptr;
/// # type T = i32;
/// # fn foo() -> T { 42 }
/// // The temporary holding the return value of `foo` does *not* have its lifetime extended,
/// // because the surrounding expression involves a function call.
/// let p = ptr::from_mut(&mut foo());
/// unsafe { p.write(T::default()) }; // UB! Writing to a dangling pointer ⚠️
/// ```
/// 编写此代码的推荐方式是避免依赖生命周期扩展：
/// 当涉及原始指针时：
/// ```rust
/// # use std::ptr;
/// # type T = i32;
/// # fn foo() -> T { 42 }
/// let mut x = foo();
/// let p = ptr::from_mut(&mut x);
/// unsafe { p.write(T::default()) };
/// ```
#[inline(always)]
#[must_use]
#[stable(feature = "ptr_from_ref", since = "1.76.0")]
#[rustc_const_stable(feature = "ptr_from_ref", since = "1.76.0")]
#[lint::never_returns_null_ptr]
pub const fn from_mut<T: PointeeSized>(r: &mut T) -> *mut T {
    r
}

/// 从指针和长度生成一个原始切片。
///
/// The `len` argument is the number of **elements**, not the number of bytes.
///
/// 此函数本身是安全的，但实际使用其返回值是不安全的。
/// See the documentation of [`slice::from_raw_parts`] for slice safety requirements.
///
/// [`slice::from_raw_parts`]: crate::slice::from_raw_parts
///
/// # 示例
///
/// ```rust
/// use std::ptr;
///
/// // create a slice pointer when starting out with a pointer to the first element
/// let x = [5, 6, 7];
/// let raw_pointer = x.as_ptr();
/// let slice = ptr::slice_from_raw_parts(raw_pointer, 3);
/// assert_eq!(unsafe { &*slice }[2], 7);
/// ```
///
/// 在解引用原始切片之前，必须确保指针有效且不为空。
/// 原始切片。切片引用绝不能包含空指针，即使它是空的也是如此。
///
/// ```rust,should_panic
/// use std::ptr;
/// let danger: *const [u8] = ptr::slice_from_raw_parts(ptr::null(), 0);
/// unsafe {
///     danger.as_ref().expect("references must not be null");
/// }
/// ```
#[inline]
#[stable(feature = "slice_from_raw_parts", since = "1.42.0")]
#[rustc_const_stable(feature = "const_slice_from_raw_parts", since = "1.64.0")]
#[rustc_diagnostic_item = "ptr_slice_from_raw_parts"]
pub const fn slice_from_raw_parts<T>(data: *const T, len: usize) -> *const [T] {
    from_raw_parts(data, len)
}

/// 从指针和长度生成一个原始可变切片。
///
/// The `len` argument is the number of **elements**, not the number of bytes.
///
/// Performs the same functionality as [`slice_from_raw_parts`], except that a
/// 一个原始可变切片，而不是原始不可变切片。
///
/// 此函数本身是安全的，但实际使用其返回值是不安全的。
/// See the documentation of [`slice::from_raw_parts_mut`] for slice safety requirements.
///
/// [`slice::from_raw_parts_mut`]: crate::slice::from_raw_parts_mut
///
/// # 示例
///
/// ```rust
/// use std::ptr;
///
/// let x = &mut [5, 6, 7];
/// let raw_pointer = x.as_mut_ptr();
/// let slice = ptr::slice_from_raw_parts_mut(raw_pointer, 3);
///
/// unsafe {
///     (*slice)[2] = 99; // assign a value at an index in the slice
/// };
///
/// assert_eq!(unsafe { &*slice }[2], 99);
/// ```
///
/// 在解引用原始切片之前，必须确保指针有效且不为空。
/// 原始切片。切片引用绝不能包含空指针，即使它是空的也是如此。
///
/// ```rust,should_panic
/// use std::ptr;
/// let danger: *mut [u8] = ptr::slice_from_raw_parts_mut(ptr::null_mut(), 0);
/// unsafe {
///     danger.as_mut().expect("references must not be null");
/// }
/// ```
#[inline]
#[stable(feature = "slice_from_raw_parts", since = "1.42.0")]
#[rustc_const_stable(feature = "const_slice_from_raw_parts_mut", since = "1.83.0")]
#[rustc_diagnostic_item = "ptr_slice_from_raw_parts_mut"]
pub const fn slice_from_raw_parts_mut<T>(data: *mut T, len: usize) -> *mut [T] {
    from_raw_parts_mut(data, len)
}

/// 交换同一类型的两个可变位置的值，而不进行
/// 任何初始化操作。
///
/// 但对于以下特殊情况，此函数的语义上等同于
/// equivalent to [`mem::swap`]:
///
/// * It operates on raw pointers instead of references. When references are
///   available, [`mem::swap`] should be preferred.
///
/// * 两个指针对应的值可能会重叠。如果值确实重叠，则
///   overlapping region of memory from `x` will be used. This is demonstrated
///   in the second example below.
///
/// * 该操作是“未类型化”的，意味着数据可能未初始化或违反
///   the requirements of `T`. The initialization state is preserved exactly.
///
/// # 安全性
///
/// 如果满足以下任何条件，行为将未定义：
///
/// * Both `x` and `y` must be [valid] for both reads and writes. They must remain valid even when the
/// 其他指针被修改，它们也必须保持有效。（这意味着如果内存范围重叠，两个指针不得
/// 相互受到别名限制。）
///
/// * Both `x` and `y` must be properly aligned.
///
/// Note that even if `T` has size `0`, the pointers must be properly aligned.
///
/// [valid]: self#safety
///
/// # 示例
///
/// 交换两个不重叠的区域：
///
/// ```
/// use std::ptr;
///
/// let mut array = [0, 1, 2, 3];
///
/// let (x, y) = array.split_at_mut(2);
/// let x = x.as_mut_ptr().cast::<[u32; 2]>(); // this is `array[0..2]`
/// let y = y.as_mut_ptr().cast::<[u32; 2]>(); // this is `array[2..4]`
///
/// unsafe {
///     ptr::swap(x, y);
///     assert_eq!([2, 3, 0, 1], array);
/// }
/// ```
///
/// 交换两个重叠的区域：
///
/// ```
/// use std::ptr;
///
/// let mut array: [i32; 4] = [0, 1, 2, 3];
///
/// let array_ptr: *mut i32 = array.as_mut_ptr();
///
/// let x = array_ptr as *mut [i32; 3]; // this is `array[0..3]`
/// let y = unsafe { array_ptr.add(1) } as *mut [i32; 3]; // this is `array[1..4]`
///
/// unsafe {
///     ptr::swap(x, y);
///     // The indices `1..3` of the slice overlap between `x` and `y`.
///     // Reasonable results would be for to them be `[2, 3]`, so that indices `0..3` are
///     // `[1, 2, 3]` (matching `y` before the `swap`); or for them to be `[0, 1]`
///     // so that indices `1..4` are `[0, 1, 2]` (matching `x` before the `swap`).
///     // This implementation is defined to make the latter choice.
///     assert_eq!([1, 0, 1, 2], array);
/// }
/// ```
#[inline(always)]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_swap", since = "1.85.0")]
#[rustc_diagnostic_item = "ptr_swap"]
pub const unsafe fn swap<T>(x: *mut T, y: *mut T) {
    // Give ourselves some scratch space to work with.
    // We do not have to worry about drops: `MaybeUninit` does nothing when dropped.
    let mut tmp = MaybeUninit::<T>::uninit();

    // Perform the swap
    // SAFETY: the caller must guarantee that `x` and `y` are
    // valid for writes and properly aligned. `tmp` cannot be
    // overlapping either `x` or `y` because `tmp` was just allocated
    // on the stack as a separate allocation.
    unsafe {
        copy_nonoverlapping(x, tmp.as_mut_ptr(), 1);
        copy(y, x, 1); // `x` and `y` may overlap
        copy_nonoverlapping(tmp.as_ptr(), y, 1);
    }
}

/// Swaps `count * size_of::<T>()` bytes between the two regions of memory
/// beginning at `x` and `y`. The two regions must *not* overlap.
///
/// 该操作是“未类型化”的，意味着数据可能未初始化或违反
/// requirements of `T`. The initialization state is preserved exactly.
///
/// # 安全性
///
/// 如果满足以下任何条件，行为将未定义：
///
/// * Both `x` and `y` must be [valid] for both reads and writes of `count *
///   size_of::<T>()` bytes.
///
/// * Both `x` and `y` must be properly aligned.
///
/// * The region of memory beginning at `x` with a size of `count *
///   size_of::<T>()` bytes must *not* overlap with the region of memory
///   beginning at `y` with the same size.
///
/// Note that even if the effectively copied size (`count * size_of::<T>()`) is `0`,
/// 指针也必须正确对齐。
///
/// [valid]: self#safety
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// use std::ptr;
///
/// let mut x = [1, 2, 3, 4];
/// let mut y = [7, 8, 9];
///
/// unsafe {
///     ptr::swap_nonoverlapping(x.as_mut_ptr(), y.as_mut_ptr(), 2);
/// }
///
/// assert_eq!(x, [7, 8, 3, 4]);
/// assert_eq!(y, [1, 2, 9]);
/// ```
#[inline]
#[stable(feature = "swap_nonoverlapping", since = "1.27.0")]
#[rustc_const_stable(feature = "const_swap_nonoverlapping", since = "1.88.0")]
#[rustc_diagnostic_item = "ptr_swap_nonoverlapping"]
#[rustc_allow_const_fn_unstable(const_eval_select)] // both implementations behave the same
#[track_caller]
pub const unsafe fn swap_nonoverlapping<T>(x: *mut T, y: *mut T, count: usize) {
    ub_checks::assert_unsafe_precondition!(
        check_library_ub,
        "ptr::swap_nonoverlapping requires that both pointer arguments are aligned and non-null \
        and the specified memory ranges do not overlap",
        (
            x: *mut () = x as *mut (),
            y: *mut () = y as *mut (),
            size: usize = size_of::<T>(),
            align: usize = align_of::<T>(),
            count: usize = count,
        ) => {
            let zero_size = size == 0 || count == 0;
            ub_checks::maybe_is_aligned_and_not_null(x, align, zero_size)
                && ub_checks::maybe_is_aligned_and_not_null(y, align, zero_size)
                && ub_checks::maybe_is_nonoverlapping(x, y, size, count)
        }
    );

    const_eval_select!(
        @capture[T] { x: *mut T, y: *mut T, count: usize }:
        if const {
            // At compile-time we don't need all the special code below.
            // SAFETY: Same preconditions as this function
            unsafe { swap_nonoverlapping_const(x, y, count) }
        } else {
            // Going though a slice here helps codegen know the size fits in `isize`
            let slice = slice_from_raw_parts_mut(x, count);
            // SAFETY: This is all readable from the pointer, meaning it's one
            // allocation, and thus cannot be more than isize::MAX bytes.
            let bytes = unsafe { mem::size_of_val_raw::<[T]>(slice) };
            if let Some(bytes) = NonZero::new(bytes) {
                // SAFETY: These are the same ranges, just expressed in a different
                // type, so they're still non-overlapping.
                unsafe { swap_nonoverlapping_bytes(x.cast(), y.cast(), bytes) };
            }
        }
    )
}

/// Same behavior and safety conditions as [`swap_nonoverlapping`]
#[inline]
const unsafe fn swap_nonoverlapping_const<T>(x: *mut T, y: *mut T, count: usize) {
    let mut i = 0;
    while i < count {
        // SAFETY: By precondition, `i` is in-bounds because it's below `n`
        let x = unsafe { x.add(i) };
        // SAFETY: By precondition, `i` is in-bounds because it's below `n`
        // and it's distinct from `x` since the ranges are non-overlapping
        let y = unsafe { y.add(i) };

        // SAFETY: we're only ever given pointers that are valid to read/write,
        // including being aligned, and nothing here panics so it's drop-safe.
        unsafe {
            // Note that it's critical that these use `copy_nonoverlapping`,
            // rather than `read`/`write`, to avoid #134713 if T has padding.
            let mut temp = MaybeUninit::<T>::uninit();
            copy_nonoverlapping(x, temp.as_mut_ptr(), 1);
            copy_nonoverlapping(y, x, 1);
            copy_nonoverlapping(temp.as_ptr(), y, 1);
        }

        i += 1;
    }
}

// Don't let MIR inline this, because we really want it to keep its noalias metadata
#[rustc_no_mir_inline]
#[inline]
fn swap_chunk<const N: usize>(x: &mut MaybeUninit<[u8; N]>, y: &mut MaybeUninit<[u8; N]>) {
    let a = *x;
    let b = *y;
    *x = b;
    *y = a;
}

#[inline]
unsafe fn swap_nonoverlapping_bytes(x: *mut u8, y: *mut u8, bytes: NonZero<usize>) {
    // Same as `swap_nonoverlapping::<[u8; N]>`.
    unsafe fn swap_nonoverlapping_chunks<const N: usize>(
        x: *mut MaybeUninit<[u8; N]>,
        y: *mut MaybeUninit<[u8; N]>,
        chunks: NonZero<usize>,
    ) {
        let chunks = chunks.get();
        for i in 0..chunks {
            // SAFETY: i is in [0, chunks) so the adds and dereferences are in-bounds.
            unsafe { swap_chunk(&mut *x.add(i), &mut *y.add(i)) };
        }
    }

    // Same as `swap_nonoverlapping_bytes`, but accepts at most 1+2+4=7 bytes
    #[inline]
    unsafe fn swap_nonoverlapping_short(x: *mut u8, y: *mut u8, bytes: NonZero<usize>) {
        // Tail handling for auto-vectorized code sometimes has element-at-a-time behaviour,
        // see <https://github.com/rust-lang/rust/issues/134946>.
        // By swapping as different sizes, rather than as a loop over bytes,
        // we make sure not to end up with, say, seven byte-at-a-time copies.

        let bytes = bytes.get();
        let mut i = 0;
        macro_rules! swap_prefix {
            ($($n:literal)+) => {$(
                if (bytes & $n) != 0 {
                    // SAFETY: `i` can only have the same bits set as those in bytes,
                    // so these `add`s are in-bounds of `bytes`.  But the bit for
                    // `$n` hasn't been set yet, so the `$n` bytes that `swap_chunk`
                    // will read and write are within the usable range.
                    unsafe { swap_chunk::<$n>(&mut*x.add(i).cast(), &mut*y.add(i).cast()) };
                    i |= $n;
                }
            )+};
        }
        swap_prefix!(4 2 1);
        debug_assert_eq!(i, bytes);
    }

    const CHUNK_SIZE: usize = size_of::<*const ()>();
    let bytes = bytes.get();

    let chunks = bytes / CHUNK_SIZE;
    let tail = bytes % CHUNK_SIZE;
    if let Some(chunks) = NonZero::new(chunks) {
        // SAFETY: this is bytes/CHUNK_SIZE*CHUNK_SIZE bytes, which is <= bytes,
        // so it's within the range of our non-overlapping bytes.
        unsafe { swap_nonoverlapping_chunks::<CHUNK_SIZE>(x.cast(), y.cast(), chunks) };
    }
    if let Some(tail) = NonZero::new(tail) {
        const { assert!(CHUNK_SIZE <= 8) };
        let delta = chunks * CHUNK_SIZE;
        // SAFETY: the tail length is below CHUNK SIZE because of the remainder,
        // and CHUNK_SIZE is at most 8 by the const assert, so tail <= 7
        unsafe { swap_nonoverlapping_short(x.add(delta), y.add(delta), tail) };
    }
}

/// Moves `src` into the pointed `dst`, returning the previous `dst` value.
///
/// 两个值都不会被丢弃。
///
/// This function is semantically equivalent to [`mem::replace`] except that it
/// 使用原始指针而不是引用进行操作。当引用可用时，
/// available, [`mem::replace`] should be preferred.
///
/// # 安全性
///
/// 如果满足以下任何条件，行为将未定义：
///
/// * `dst` must be [valid] for both reads and writes or `T` must be a ZST.
///
/// * `dst` must be properly aligned.
///
/// * `dst` must point to a properly initialized value of type `T`.
///
/// Note that even if `T` has size `0`, the pointer must be properly aligned.
///
/// [valid]: self#safety
///
/// # 示例
///
/// ```
/// use std::ptr;
///
/// let mut rust = vec!['b', 'u', 's', 't'];
///
/// // `mem::replace` would have the same effect without requiring the unsafe
/// // block.
/// let b = unsafe {
///     ptr::replace(&mut rust[0], 'r')
/// };
///
/// assert_eq!(b, 'b');
/// assert_eq!(rust, &['r', 'u', 's', 't']);
/// ```
#[inline(always)]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_replace", since = "1.83.0")]
#[rustc_diagnostic_item = "ptr_replace"]
#[track_caller]
pub const unsafe fn replace<T>(dst: *mut T, src: T) -> T {
    // SAFETY: the caller must guarantee that `dst` is valid to be
    // cast to a mutable reference (valid for writes, aligned, initialized),
    // and cannot overlap `src` since `dst` must point to a distinct
    // allocation. We are excluding null (with a ZST check) before creating a reference.
    unsafe {
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::replace requires that the pointer argument is aligned and non-null",
            (
                addr: *const () = dst as *const (),
                align: usize = align_of::<T>(),
                is_zst: bool = T::IS_ZST,
            ) => ub_checks::maybe_is_aligned_and_not_null(addr, align, is_zst)
        );
        if T::IS_ZST {
            // If `T` is a ZST, `dst` is allowed to be null. However, we also don't have to actually
            // do anything since there isn't actually any data to be copied anyway. All values of
            // type `T` are bit-identical, so we can just return `src` here.
            return src;
        }
        mem::replace(&mut *dst, src)
    }
}

/// Reads the value from `src` without moving it. This leaves the
/// memory in `src` unchanged.
///
/// # 安全性
///
/// 如果违反以下任何条件，行为将未定义：
///
/// * `src` must be [valid] for reads or `T` must be a ZST.
///
/// * `src` must be properly aligned. Use [`read_unaligned`] if this is not the
/// 情况。
///
/// * `src` must point to a properly initialized value of type `T`.
///
/// Note that even if `T` has size `0`, the pointer must be properly aligned.
///
/// Care must be taken around [ownership of the returned value](#ownership-of-the-returned-value).
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// let x = 12;
/// let y = &x as *const i32;
///
/// unsafe {
///     assert_eq!(std::ptr::read(y), 12);
/// }
/// ```
///
/// Manually implement [`mem::swap`]:
///
/// ```
/// use std::ptr;
///
/// fn swap<T>(a: &mut T, b: &mut T) {
///     unsafe {
///         // Create a bitwise copy of the value at `a` in `tmp`.
///         let tmp = ptr::read(a);
///
///         // Exiting at this point (either by explicitly returning or by
///         // calling a function which panics) would cause the value in `tmp` to
///         // be dropped while the same value is still referenced by `a`. This
///         // could trigger undefined behavior if `T` is not `Copy`.
///
///         // Create a bitwise copy of the value at `b` in `a`.
///         // This is safe because mutable references cannot alias.
///         ptr::copy_nonoverlapping(b, a, 1);
///
///         // As above, exiting here could trigger undefined behavior because
///         // the same value is referenced by `a` and `b`.
///
///         // Move `tmp` into `b`.
///         ptr::write(b, tmp);
///
///         // `tmp` has been moved (`write` takes ownership of its second argument),
///         // so nothing is dropped implicitly here.
///     }
/// }
///
/// let mut foo = "foo".to_owned();
/// let mut bar = "bar".to_owned();
///
/// swap(&mut foo, &mut bar);
///
/// assert_eq!(foo, "bar");
/// assert_eq!(bar, "foo");
/// ```
///
/// ## 返回值的所有权
///
/// `read` creates a bitwise copy of `T`, regardless of whether `T` is [`Copy`].
/// If `T` is not [`Copy`], using both the returned value and the value at
/// `*src` can violate memory safety. Note that assigning to `*src` counts as a
/// use because it will attempt to drop the value at `*src`.
///
/// [`write()`] can be used to overwrite data without causing it to be dropped.
///
/// ```
/// use std::ptr;
///
/// let mut s = String::from("foo");
/// unsafe {
///     // `s2` now points to the same underlying memory as `s`.
///     let mut s2: String = ptr::read(&s);
///
///     assert_eq!(s2, "foo");
///
///     // Assigning to `s2` causes its original value to be dropped. Beyond
///     // this point, `s` must no longer be used, as the underlying memory has
///     // been freed.
///     s2 = String::default();
///     assert_eq!(s2, "");
///
///     // Assigning to `s` would cause the old value to be dropped again,
///     // resulting in undefined behavior.
///     // s = String::from("bar"); // ERROR
///
///     // `ptr::write` can be used to overwrite a value without dropping it.
///     ptr::write(&mut s, String::from("bar"));
/// }
///
/// assert_eq!(s, "bar");
/// ```
///
/// [valid]: self#safety
#[inline(always)]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_ptr_read", since = "1.71.0")]
#[track_caller]
#[rustc_diagnostic_item = "ptr_read"]
pub const unsafe fn read<T>(src: *const T) -> T {
    // It would be semantically correct to implement this via `copy_nonoverlapping`
    // and `MaybeUninit`, as was done before PR #109035. Calling `assume_init`
    // provides enough information to know that this is a typed operation.

    // However, as of March 2023 the compiler was not capable of taking advantage
    // of that information. Thus, the implementation here switched to an intrinsic,
    // which lowers to `_0 = *src` in MIR, to address a few issues:
    //
    // - Using `MaybeUninit::assume_init` after a `copy_nonoverlapping` was not
    //   turning the untyped copy into a typed load. As such, the generated
    //   `load` in LLVM didn't get various metadata, such as `!range` (#73258),
    //   `!nonnull`, and `!noundef`, resulting in poorer optimization.
    // - Going through the extra local resulted in multiple extra copies, even
    //   in optimized MIR.  (Ignoring StorageLive/Dead, the intrinsic is one
    //   MIR statement, while the previous implementation was eight.)  LLVM
    //   could sometimes optimize them away, but because `read` is at the core
    //   of so many things, not having them in the first place improves what we
    //   hand off to the backend.  For example, `mem::replace::<Big>` previously
    //   emitted 4 `alloca` and 6 `memcpy`s, but is now 1 `alloc` and 3 `memcpy`s.
    // - In general, this approach keeps us from getting any more bugs (like
    //   #106369) that boil down to "`read(p)` is worse than `*p`", as this
    //   makes them look identical to the backend (or other MIR consumers).
    //
    // Future enhancements to MIR optimizations might well allow this to return
    // to the previous implementation, rather than using an intrinsic.

    // SAFETY: the caller must guarantee that `src` is valid for reads.
    unsafe {
        #[cfg(debug_assertions)] // Too expensive to always enable (for now?)
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::read requires that the pointer argument is aligned and non-null",
            (
                addr: *const () = src as *const (),
                align: usize = align_of::<T>(),
                is_zst: bool = T::IS_ZST,
            ) => ub_checks::maybe_is_aligned_and_not_null(addr, align, is_zst)
        );
        crate::intrinsics::read_via_copy(src)
    }
}

/// Reads the value from `src` without moving it. This leaves the
/// memory in `src` unchanged.
///
/// Unlike [`read`], `read_unaligned` works with unaligned pointers.
///
/// # 安全性
///
/// 如果违反以下任何条件，行为将未定义：
///
/// * `src` must be [valid] for reads.
///
/// * `src` must point to a properly initialized value of type `T`.
///
/// Like [`read`], `read_unaligned` creates a bitwise copy of `T`, regardless of
/// whether `T` is [`Copy`]. If `T` is not [`Copy`], using both the returned
/// value and the value at `*src` can [violate memory safety][read-ownership].
///
/// [read-ownership]: read#ownership-of-the-returned-value
/// [valid]: self#safety
///
/// ## On `packed` structs
///
/// Attempting to create a raw pointer to an `unaligned` struct field with
/// an expression such as `&packed.unaligned as *const FieldType` creates an
/// 中间未对齐引用，然后才转换为原始指针。
/// 该引用是临时且立即转换的，这并不重要，
/// 因为编译器始终期望引用正确对齐。
/// As a result, using `&packed.unaligned as *const FieldType` causes immediate
/// *未定义行为*。
///
/// Instead you must use the `&raw const` syntax to create the pointer.
/// 你可以将该构造的指针与该函数一起使用。
///
/// An example of what not to do and how this relates to `read_unaligned` is:
///
/// ```
/// #[repr(packed, C)]
/// struct Packed {
///     _padding: u8,
///     unaligned: u32,
/// }
///
/// let packed = Packed {
///     _padding: 0x00,
///     unaligned: 0x01020304,
/// };
///
/// // Take the address of a 32-bit integer which is not aligned.
/// // In contrast to `&packed.unaligned as *const _`, this has no undefined behavior.
/// let unaligned = &raw const packed.unaligned;
///
/// let v = unsafe { std::ptr::read_unaligned(unaligned) };
/// assert_eq!(v, 0x01020304);
/// ```
///
/// Accessing unaligned fields directly with e.g. `packed.unaligned` is safe however.
///
/// # 示例
///
/// Read a `usize` value from a byte buffer:
///
/// ```
/// fn read_usize(x: &[u8]) -> usize {
///     assert!(x.len() >= size_of::<usize>());
///
///     let ptr = x.as_ptr() as *const usize;
///
///     unsafe { ptr.read_unaligned() }
/// }
/// ```
#[inline(always)]
#[stable(feature = "ptr_unaligned", since = "1.17.0")]
#[rustc_const_stable(feature = "const_ptr_read", since = "1.71.0")]
#[track_caller]
#[rustc_diagnostic_item = "ptr_read_unaligned"]
pub const unsafe fn read_unaligned<T>(src: *const T) -> T {
    // Always true thanks to the repr, but to demonstrate
    const {
        assert!(mem::offset_of!(Unaligned::<T>, 0) == 0);
        assert!(size_of::<T>() == size_of::<Unaligned<T>>());
    }

    let src = src.cast::<Unaligned<T>>();
    // SAFETY: the caller must guarantee that `src` is valid for reads.
    // Reading it as `Unaligned<T>` instead of `T` reads those same bytes because
    // it's the same size (thus zero offset), but with alignment 1 instead.
    //
    // Similarly, because it's the same bytes it's sound to transmute from the
    // `Unaligned<T>` to `T`.  Transmute is a value-based (not a place-based)
    // operation that doesn't care about alignment.
    unsafe {
        let unaligned = read(src);
        // Can't just destructure because that's not allowed in const fn
        mem::transmute_neo(unaligned)
    }
}

/// 用给定值覆盖内存位置，而不读取或
/// 丢弃旧值。
///
/// `write` does not drop the contents of `dst`. This is safe, but it could leak
/// 分配或资源，因此应注意不要覆盖
/// 应该被丢弃的对象。
///
/// Additionally, it does not drop `src`. Semantically, `src` is moved into the
/// location pointed to by `dst`.
///
/// 这适用于初始化未初始化的内存，或覆盖
/// memory that has previously been [`read`] from.
///
/// # 安全性
///
/// 如果违反以下任何条件，行为将未定义：
///
/// * `dst` must be [valid] for writes or `T` must be a ZST.
///
/// * `dst` must be properly aligned. Use [`write_unaligned`] if this is not the
/// 情况。
///
/// Note that even if `T` has size `0`, the pointer must be properly aligned.
///
/// [valid]: self#safety
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// let mut x = 0;
/// let y = &mut x as *mut i32;
/// let z = 12;
///
/// unsafe {
///     std::ptr::write(y, z);
///     assert_eq!(std::ptr::read(y), 12);
/// }
/// ```
///
/// Manually implement [`mem::swap`]:
///
/// ```
/// use std::ptr;
///
/// fn swap<T>(a: &mut T, b: &mut T) {
///     unsafe {
///         // Create a bitwise copy of the value at `a` in `tmp`.
///         let tmp = ptr::read(a);
///
///         // Exiting at this point (either by explicitly returning or by
///         // calling a function which panics) would cause the value in `tmp` to
///         // be dropped while the same value is still referenced by `a`. This
///         // could trigger undefined behavior if `T` is not `Copy`.
///
///         // Create a bitwise copy of the value at `b` in `a`.
///         // This is safe because mutable references cannot alias.
///         ptr::copy_nonoverlapping(b, a, 1);
///
///         // As above, exiting here could trigger undefined behavior because
///         // the same value is referenced by `a` and `b`.
///
///         // Move `tmp` into `b`.
///         ptr::write(b, tmp);
///
///         // `tmp` has been moved (`write` takes ownership of its second argument),
///         // so nothing is dropped implicitly here.
///     }
/// }
///
/// let mut foo = "foo".to_owned();
/// let mut bar = "bar".to_owned();
///
/// swap(&mut foo, &mut bar);
///
/// assert_eq!(foo, "bar");
/// assert_eq!(bar, "foo");
/// ```
#[inline(always)]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_ptr_write", since = "1.83.0")]
#[rustc_diagnostic_item = "ptr_write"]
#[track_caller]
pub const unsafe fn write<T>(dst: *mut T, src: T) {
    // Semantically, it would be fine for this to be implemented as a
    // `copy_nonoverlapping` and appropriate drop suppression of `src`.

    // However, implementing via that currently produces more MIR than is ideal.
    // Using an intrinsic keeps it down to just the simple `*dst = move src` in
    // MIR (11 statements shorter, at the time of writing), and also allows
    // `src` to stay an SSA value in codegen_ssa, rather than a memory one.

    // SAFETY: the caller must guarantee that `dst` is valid for writes.
    // `dst` cannot overlap `src` because the caller has mutable access
    // to `dst` while `src` is owned by this function.
    unsafe {
        #[cfg(debug_assertions)] // Too expensive to always enable (for now?)
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::write requires that the pointer argument is aligned and non-null",
            (
                addr: *mut () = dst as *mut (),
                align: usize = align_of::<T>(),
                is_zst: bool = T::IS_ZST,
            ) => ub_checks::maybe_is_aligned_and_not_null(addr, align, is_zst)
        );
        intrinsics::write_via_move(dst, src)
    }
}

/// 用给定值覆盖内存位置，而不读取或
/// 丢弃旧值。
///
/// Unlike [`write()`], the pointer may be unaligned.
///
/// `write_unaligned` does not drop the contents of `dst`. This is safe, but it
/// 泄露分配或资源，因此应注意不要覆盖
/// 应该被丢弃的对象。
///
/// Additionally, it does not drop `src`. Semantically, `src` is moved into the
/// location pointed to by `dst`.
///
/// 这适用于初始化未初始化的内存，或覆盖
/// memory that has previously been read with [`read_unaligned`].
///
/// # 安全性
///
/// 如果违反以下任何条件，行为将未定义：
///
/// * `dst` must be [valid] for writes.
///
/// [valid]: self#safety
///
/// ## On `packed` structs
///
/// Attempting to create a raw pointer to an `unaligned` struct field with
/// an expression such as `&packed.unaligned as *const FieldType` creates an
/// 中间未对齐引用，然后才转换为原始指针。
/// 该引用是临时的且立即转换，这并不重要，
/// 因为编译器总是期望引用正确对齐。
/// As a result, using `&packed.unaligned as *const FieldType` causes immediate
/// *未定义行为*。
///
/// Instead, you must use the `&raw mut` syntax to create the pointer.
/// 您可以将该构造的指针与该函数一起使用。
///
/// An example of how to do it and how this relates to `write_unaligned` is:
///
/// ```
/// #[repr(packed, C)]
/// struct Packed {
///     _padding: u8,
///     unaligned: u32,
/// }
///
/// let mut packed: Packed = unsafe { std::mem::zeroed() };
///
/// // Take the address of a 32-bit integer which is not aligned.
/// // In contrast to `&packed.unaligned as *mut _`, this has no undefined behavior.
/// let unaligned = &raw mut packed.unaligned;
///
/// unsafe { std::ptr::write_unaligned(unaligned, 42) };
///
/// assert_eq!({packed.unaligned}, 42); // `{...}` forces copying the field instead of creating a reference.
/// ```
///
/// Accessing unaligned fields directly with e.g. `packed.unaligned` is safe however
/// (as can be seen in the `assert_eq!` above).
///
/// # 示例
///
/// Write a `usize` value to a byte buffer:
///
/// ```
/// fn write_usize(x: &mut [u8], val: usize) {
///     assert!(x.len() >= size_of::<usize>());
///
///     let ptr = x.as_mut_ptr() as *mut usize;
///
///     unsafe { ptr.write_unaligned(val) }
/// }
/// ```
#[inline(always)]
#[stable(feature = "ptr_unaligned", since = "1.17.0")]
#[rustc_const_stable(feature = "const_ptr_write", since = "1.83.0")]
#[rustc_diagnostic_item = "ptr_write_unaligned"]
#[track_caller]
pub const unsafe fn write_unaligned<T>(dst: *mut T, src: T) {
    // Always true thanks to the repr, but to demonstrate
    const {
        assert!(mem::offset_of!(Unaligned::<T>, 0) == 0);
        assert!(size_of::<T>() == size_of::<Unaligned<T>>());
    }

    let dst = dst.cast::<Unaligned<T>>();
    let src = Unaligned(src);
    // SAFETY: the caller must guarantee that `dst` is valid for writes.
    // Writing it as `Unaligned<T>` instead of `T` writes those same bytes because
    // it's the same size (thus zero offset), but with alignment 1 instead.
    unsafe { write(dst, src) }
}

/// Performs a volatile read of the value from `src` without moving it.
///
/// volatile 操作旨在作用于 I/O 内存。因此，它们被视为外部可观察事件（类似于系统调用，但透明度较低），并且保证不会被编译器忽略或与其他外部可观察事件混淆。考虑到这一点，有
/// 两种使用情况需要区分：
/// - 当 volatile 操作用于 [分配] 内的内存时，其行为与
/// are two cases of usage that need to be distinguished:
///
/// 所有常见的内存访问规则都适用（包括来源信息）。特别是，就像在 C 语言中一样，操作是否为 volatile 与多线程并发访问无关。在这方面，volatile 访问与非原子访问行为相同。
///   [`read`], except for the additional guarantee that it won't be elided or reordered across
/// 操作语义，不能用作通用内存。
///   access memory and not e.g. be lowered to reusing data from a previous read. Other than that,
/// 这必须立即终止进程。它也可能引起其他副作用，但那些
/// like in C, whether an operation is volatile has no bearing whatsoever on questions involving
/// concurrent accesses from multiple threads. Volatile accesses behave exactly like non-atomic
/// accesses in that regard.
///
/// - Volatile operations, however, may also be used to access memory that is _outside_ of any Rust
/// allocation. In this use-case, the pointer does *not* have to be [valid] for reads. This is
/// typically used for CPU and peripheral registers that must be accessed via an I/O memory
/// mapping, most commonly at fixed addresses reserved by the hardware. These often have special
/// semantics associated to their manipulation, and cannot be used as general purpose memory.
///   Here, any address value is possible, including 0 and [`usize::MAX`], so long as the semantics
/// of such a read are well-defined by the target hardware. The provenance of the pointer is
///   irrelevant, and it can be created with [`without_provenance`]. The access is allowed to trap,
/// which must immediately abort the process. It can also cause other side-effects, but those
/// 不得以任何方式影响 Rust 分配的内存。此访问仍不被视为有效。
/// [atomic]，因此无法用于线程间同步。
///
/// 注意，当 T 是零大小类型时，易失性内存操作是无操作（noop），可能被忽略。
///
/// 在 const 计算期间调用时，其行为类似于常规读取。特别是，此类
/// 读取必须始终遵循上述两种情况中的第一种。
///
/// [allocation]: crate::ptr#allocated-object
/// [atomic]: crate::sync::atomic#memory-model-for-atomic-accesses
///
/// # 加载拆分
///
/// 该函数执行的具体硬件加载情况通常取决于目标平台。
///
/// For a simple scalar, such as when `T` is a thin pointer, this will typically be one load assuming
/// 你的目标支持恰好该大小的加载且具有对齐时，通常只会进行一次加载。
///
/// 对于其他情况，将以某种未指定方式拆分为多次加载。
/// This can happen even for scalars: notably, on many targets loading a `u128` will still need to be split,
/// 尽管是“一个”标量。在许多目标上加载大于指针的大小将需要拆分。
/// 在所有当前目标上，大于 64 字节的加载都需要拆分。
/// 任何不是2的幂次大小的加载几乎肯定也需要拆分。
///
/// 拆分方式没有稳定性保证。它可能在任何时候发生变化。
///
/// # 安全性
///
/// Like [`read`], `read_volatile` creates a bitwise copy of `T`, regardless of whether `T` is
/// [`Copy`]. If `T` is not [`Copy`], using both the returned value and the value at `*src` can
/// [violate memory safety][read-ownership]. However, storing non-[`Copy`] types in volatile memory
/// 几乎肯定是错误的。
///
/// 如果违反以下任何条件，行为未定义：
///
/// * `src` must be either [valid] for reads, or `T` must be a ZST, or `src` must point to memory
/// 位于所有 Rust 分配之外，从该内存读取不会导致
/// Rust 分配内的内存被修改。
///
/// * `src` must be properly aligned.
///
/// * Reading from `src` must produce a properly initialized value of type `T`.
///
/// Note that even if `T` has size `0`, the pointer must be properly aligned.
///
/// [valid]: self#safety
/// [read-ownership]: read#ownership-of-the-returned-value
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// let x = 12;
/// let y = &x as *const i32;
///
/// unsafe {
///     assert_eq!(std::ptr::read_volatile(y), 12);
/// }
/// ```
#[inline(always)]
#[stable(feature = "volatile", since = "1.9.0")]
#[rustc_const_unstable(feature = "const_volatile", issue = "159094")]
#[track_caller]
#[rustc_diagnostic_item = "ptr_read_volatile"]
pub const unsafe fn read_volatile<T>(src: *const T) -> T {
    // SAFETY: the caller must uphold the safety contract for `volatile_load`.
    unsafe {
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::read_volatile requires that the pointer argument is aligned",
            (
                addr: *const () = src as *const (),
                align: usize = align_of::<T>(),
            ) => ub_checks::maybe_is_aligned(addr, align)
        );
        intrinsics::volatile_load(src)
    }
}

/// 对内存位置执行易失性写入操作，并传入给定值，而不读取或丢弃
/// 旧值。
///
/// 易失性操作旨在作用于 I/O 内存。因此，它们在外部看来是有效的
/// 可观察事件（就像系统调用一样），并且编译器保证不会忽略或重新排序这些事件。
/// 考虑到这一点，存在两种需要区分的使用情况：
/// usage that need to be distinguished:
///
/// 将实际访问内存，而不是例如被降级为寄存器访问。除此之外，所有关于内存访问的常规规则都适用（包括来源信息）。特别是，就像在C语言中一样，
///   [`write`][write()], except for the additional guarantee that it won't be elided or reordered
/// - 然而，易失性操作也可以用于访问_不在_任何Rust分配范围内的内存。在这种使用场景中，指针不必对写入操作是[有效的]。这通常用于必须通过I/O内存映射访问的CPU和外围寄存器，最常见的是硬件预留的固定地址。这些地址通常具有特殊的
/// 操作语义，不能用作通用内存。
///   usual rules for memory accesses apply (including provenance). In particular, just like in C,
/// 引发panic，这必须立即终止进程。它也可能引起其他副作用，但这些不应以任何方式影响Rust分配的内存。这种访问仍不被视为
/// 原子操作，因此不能用于线程间同步。
///   that regard.
///
/// - Volatile operations, however, may also be used to access memory that is _outside_ of any Rust
/// allocation. In this use-case, the pointer does *not* have to be [valid] for writes. This is
/// typically used for CPU and peripheral registers that must be accessed via an I/O memory
/// mapping, most commonly at fixed addresses reserved by the hardware. These often have special
/// semantics associated to their manipulation, and cannot be used as general purpose memory.
///   Here, any address value is possible, including 0 and [`usize::MAX`], so long as the semantics
/// of such a write are well-defined by the target hardware. The provenance of the pointer is
///   irrelevant, and it can be created with [`without_provenance_mut`]. The access is allowed to
/// trap, which must immediately abort the process. It can also cause other side-effects, but
/// those must not affect Rust-allocated memory in any way. This access is still not considered
/// [atomic], and as such it cannot be used for inter-thread synchronization.
///
/// Note that volatile memory operations on zero-sized types (e.g., if a zero-sized type is passed
/// to `write_volatile`) are noops and may be ignored.
///
/// `write_volatile` does not drop the contents of `dst`. This is safe, but it could leak
/// allocations or resources, so care should be taken not to overwrite an object that should be
/// dropped when operating on Rust memory. Additionally, it does not drop `src`. Semantically, `src`
/// is moved into the location pointed to by `dst`.
///
/// 在常量计算期间调用时，其行为类似于普通的写入操作。
/// 读取操作必须遵循上述两种情况中的第一种。
///
/// [allocation]: crate::ptr#allocated-object
/// [atomic]: crate::sync::atomic#memory-model-for-atomic-accesses
///
/// # 存储拆分
///
/// 该函数执行的具体硬件存储方式通常取决于目标平台。
///
/// For a simple scalar, such as when `T` is a thin pointer, this will typically be one store assuming
/// 你的目标平台支持恰好如此大小和对齐的存储。
///
/// 对于其他情况，它会以某种未指定的方式被拆分为多次存储。
/// This can happen even for scalars: notably, on many targets storing a `u128` will still need to be split,
/// 尽管它是“一个”标量类型。在许多目标平台上，存储大于指针大小的数据也需要被拆分。
/// 在所有当前目标平台上，大于 64 字节的存储都需要被拆分。
/// 任何非2的幂次大小的存储几乎肯定也需要被拆分。
///
/// 拆分的具体方式没有稳定性保证。它可能在任何时候发生变化。
///
/// # 安全性
///
/// 如果满足以下任何条件，行为将未定义：
///
/// * `dst` must be either [valid] for writes, or `T` must be a ZST, or `dst` must point to memory
/// 位于所有 Rust 分配之外，并且对该内存的写入不会修改 Rust 分配中的任何内容。
///   Rust allocation to be modified.
///
/// * `dst` must be properly aligned.
///
/// Note that even if `T` has size `0`, the pointer must be properly aligned.
///
/// [valid]: self#safety
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// let mut x = 0;
/// let y = &mut x as *mut i32;
/// let z = 12;
///
/// unsafe {
///     std::ptr::write_volatile(y, z);
///     assert_eq!(std::ptr::read_volatile(y), 12);
/// }
/// ```
#[inline(always)]
#[stable(feature = "volatile", since = "1.9.0")]
#[rustc_const_unstable(feature = "const_volatile", issue = "159094")]
#[rustc_diagnostic_item = "ptr_write_volatile"]
#[track_caller]
pub const unsafe fn write_volatile<T>(dst: *mut T, src: T) {
    // SAFETY: the caller must uphold the safety contract for `volatile_store`.
    unsafe {
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::write_volatile requires that the pointer argument is aligned",
            (
                addr: *mut () = dst as *mut (),
                align: usize = align_of::<T>(),
            ) => ub_checks::maybe_is_aligned(addr, align)
        );
        intrinsics::volatile_store(dst, src);
    }
}

/// 计算增加指针对齐度的元素偏移量。
///
/// Calculate an element-offset (not byte-offset) that when added to a given pointer `p`, increases `p`'s alignment to at least the given alignment `a`.
///
/// # 安全性
/// `a` must be a power of two.
///
/// # 备注
/// 此实现经过精心设计，以避免 panic。如果此处发生 panic，则属于未定义行为。
/// The only real change that can be made here is change of `INV_TABLE_MOD_16` and associated
/// constants.
///
/// If we ever decide to make it possible to call the intrinsic with `a` that is not a
/// power-of-two, it will probably be more prudent to just change to a naive implementation rather
/// than trying to adapt this to accommodate that change.
///
/// Any questions go to @nagisa.
#[allow(ptr_to_integer_transmute_in_consts)]
pub(crate) unsafe fn align_offset<T: Sized>(p: *const T, a: usize) -> usize {
    // FIXME(#75598): Direct use of these intrinsics improves codegen significantly at opt-level <=
    // 1, where the method versions of these operations are not inlined.
    use intrinsics::{
        assume, cttz_nonzero, exact_div, mul_with_overflow, unchecked_rem, unchecked_shl,
        unchecked_shr, unchecked_sub, wrapping_add, wrapping_mul, wrapping_sub,
    };

    /// Calculate multiplicative modular inverse of `x` modulo `m`.
    ///
    /// This implementation is tailored for `align_offset` and has following preconditions:
    ///
    /// * `m` is a power-of-two;
    /// * `x < m`; (if `x ≥ m`, pass in `x % m` instead)
    ///
    /// 此函数的实现绝不能引发 panic。
    #[inline]
    const unsafe fn mod_inv(x: usize, m: usize) -> usize {
        /// 模2⁴ = 16的乘法模逆表。
        ///
        /// 注意，此表中不包含不存在逆元的数值（即对于
        /// `0⁻¹ mod 16`, `2⁻¹ mod 16`, etc.)
        const INV_TABLE_MOD_16: [u8; 8] = [1, 11, 13, 7, 9, 3, 5, 15];
        /// Modulo for which the `INV_TABLE_MOD_16` is intended.
        const INV_TABLE_MOD: usize = 16;

        // SAFETY: `m` is required to be a power-of-two, hence non-zero.
        let m_minus_one = unsafe { unchecked_sub(m, 1) };
        let mut inverse = INV_TABLE_MOD_16[(x & (INV_TABLE_MOD - 1)) >> 1] as usize;
        let mut mod_gate = INV_TABLE_MOD;
        // We iterate "up" using the following formula:
        //
        // $$ xy ≡ 1 (mod 2ⁿ) → xy (2 - xy) ≡ 1 (mod 2²ⁿ) $$
        //
        // This application needs to be applied at least until `2²ⁿ ≥ m`, at which point we can
        // finally reduce the computation to our desired `m` by taking `inverse mod m`.
        //
        // This computation is `O(log log m)`, which is to say, that on 64-bit machines this loop
        // will always finish in at most 4 iterations.
        loop {
            // y = y * (2 - xy) mod n
            //
            // Note, that we use wrapping operations here intentionally – the original formula
            // uses e.g., subtraction `mod n`. It is entirely fine to do them `mod
            // usize::MAX` instead, because we take the result `mod n` at the end
            // anyway.
            if mod_gate >= m {
                break;
            }
            inverse = wrapping_mul(inverse, wrapping_sub(2usize, wrapping_mul(x, inverse)));
            let (new_gate, overflow) = mul_with_overflow(mod_gate, mod_gate);
            if overflow {
                break;
            }
            mod_gate = new_gate;
        }
        inverse & m_minus_one
    }

    let stride = size_of::<T>();

    let addr: usize = p.addr();

    // SAFETY: `a` is a power-of-two, therefore non-zero.
    let a_minus_one = unsafe { unchecked_sub(a, 1) };

    if stride == 0 {
        // SPECIAL_CASE: handle 0-sized types. No matter how many times we step, the address will
        // stay the same, so no offset will be able to align the pointer unless it is already
        // aligned. This branch _will_ be optimized out as `stride` is known at compile-time.
        let p_mod_a = addr & a_minus_one;
        return if p_mod_a == 0 { 0 } else { usize::MAX };
    }

    // SAFETY: `stride == 0` case has been handled by the special case above.
    let a_mod_stride = unsafe { unchecked_rem(a, stride) };
    if a_mod_stride == 0 {
        // SPECIAL_CASE: In cases where the `a` is divisible by `stride`, byte offset to align a
        // pointer can be computed more simply through `-p (mod a)`. In the off-chance the byte
        // offset is not a multiple of `stride`, the input pointer was misaligned and no pointer
        // offset will be able to produce a `p` aligned to the specified `a`.
        //
        // The naive `-p (mod a)` equation inhibits LLVM's ability to select instructions
        // like `lea`. We compute `(round_up_to_next_alignment(p, a) - p)` instead. This
        // redistributes operations around the load-bearing, but pessimizing `and` instruction
        // sufficiently for LLVM to be able to utilize the various optimizations it knows about.
        //
        // LLVM handles the branch here particularly nicely. If this branch needs to be evaluated
        // at runtime, it will produce a mask `if addr_mod_stride == 0 { 0 } else { usize::MAX }`
        // in a branch-free way and then bitwise-OR it with whatever result the `-p mod a`
        // computation produces.

        let aligned_address = wrapping_add(addr, a_minus_one) & wrapping_sub(0, a);
        let byte_offset = wrapping_sub(aligned_address, addr);
        // FIXME: Remove the assume after <https://github.com/llvm/llvm-project/issues/62502>
        // SAFETY: Masking by `-a` can only affect the low bits, and thus cannot have reduced
        // the value by more than `a-1`, so even though the intermediate values might have
        // wrapped, the byte_offset is always in `[0, a)`.
        unsafe { assume(byte_offset < a) };

        // SAFETY: `stride == 0` case has been handled by the special case above.
        let addr_mod_stride = unsafe { unchecked_rem(addr, stride) };

        return if addr_mod_stride == 0 {
            // SAFETY: `stride` is non-zero. This is guaranteed to divide exactly as well, because
            // addr has been verified to be aligned to the original type’s alignment requirements.
            unsafe { exact_div(byte_offset, stride) }
        } else {
            usize::MAX
        };
    }

    // GENERAL_CASE: From here on we’re handling the very general case where `addr` may be
    // misaligned, there isn’t an obvious relationship between `stride` and `a` that we can take an
    // advantage of, etc. This case produces machine code that isn’t particularly high quality,
    // compared to the special cases above. The code produced here is still within the realm of
    // miracles, given the situations this case has to deal with.

    // SAFETY: a is power-of-two hence non-zero. stride == 0 case is handled above.
    // FIXME(const-hack) replace with min
    let gcdpow = unsafe {
        let x = cttz_nonzero(stride);
        let y = cttz_nonzero(a);
        if x < y { x } else { y }
    };
    // SAFETY: gcdpow has an upper-bound that’s at most the number of bits in a `usize`.
    let gcd = unsafe { unchecked_shl(1usize, gcdpow) };
    // SAFETY: gcd is always greater or equal to 1.
    if addr & unsafe { unchecked_sub(gcd, 1) } == 0 {
        // This branch solves for the following linear congruence equation:
        //
        // ` p + so = 0 mod a `
        //
        // `p` here is the pointer value, `s` - stride of `T`, `o` offset in `T`s, and `a` - the
        // requested alignment.
        //
        // With `g = gcd(a, s)`, and the above condition asserting that `p` is also divisible by
        // `g`, we can denote `a' = a/g`, `s' = s/g`, `p' = p/g`, then this becomes equivalent to:
        //
        // ` p' + s'o = 0 mod a' `
        // ` o = (a' - (p' mod a')) * (s'^-1 mod a') `
        //
        // The first term is "the relative alignment of `p` to `a`" (divided by the `g`), the
        // second term is "how does incrementing `p` by `s` bytes change the relative alignment of
        // `p`" (again divided by `g`). Division by `g` is necessary to make the inverse well
        // formed if `a` and `s` are not co-prime.
        //
        // Furthermore, the result produced by this solution is not "minimal", so it is necessary
        // to take the result `o mod lcm(s, a)`. This `lcm(s, a)` is the same as `a'`.

        // SAFETY: `gcdpow` has an upper-bound not greater than the number of trailing 0-bits in
        // `a`.
        let a2 = unsafe { unchecked_shr(a, gcdpow) };
        // SAFETY: `a2` is non-zero. Shifting `a` by `gcdpow` cannot shift out any of the set bits
        // in `a` (of which it has exactly one).
        let a2minus1 = unsafe { unchecked_sub(a2, 1) };
        // SAFETY: `gcdpow` has an upper-bound not greater than the number of trailing 0-bits in
        // `a`.
        let s2 = unsafe { unchecked_shr(stride & a_minus_one, gcdpow) };
        // SAFETY: `gcdpow` has an upper-bound not greater than the number of trailing 0-bits in
        // `a`. Furthermore, the subtraction cannot overflow, because `a2 = a >> gcdpow` will
        // always be strictly greater than `(p % a) >> gcdpow`.
        let minusp2 = unsafe { unchecked_sub(a2, unchecked_shr(addr & a_minus_one, gcdpow)) };
        // SAFETY: `a2` is a power-of-two, as proven above. `s2` is strictly less than `a2`
        // because `(s % a) >> gcdpow` is strictly less than `a >> gcdpow`.
        return wrapping_mul(minusp2, unsafe { mod_inv(s2, a2) }) & a2minus1;
    }

    // Cannot be aligned at all.
    usize::MAX
}

/// 比较原始指针是否相等。
///
/// This is the same as using the `==` operator, but less generic:
/// the arguments have to be `*const T` raw pointers,
/// not anything that implements `PartialEq`.
///
/// This can be used to compare `&T` references (which coerce to `*const T` implicitly)
/// 通过地址进行比较，而非比较它们指向的值
/// (which is what the `PartialEq for &T` implementation does).
///
/// 当比较宽指针时，地址和元数据都需进行相等性测试。
/// However, note that comparing trait object pointers (`*const dyn Trait`) is unreliable: pointers
/// （因为相同的vtables可以在一个代码生成单元内去重）。
/// # 示例
/// 切片也通过长度进行比较（fat pointers）：
///
/// # 比较两个指针的 *地址* 是否相等，
///
/// ```
/// use std::ptr;
///
/// let five = 5;
/// let other_five = 5;
/// let five_ref = &five;
/// let same_five_ref = &five;
/// let other_five_ref = &other_five;
///
/// assert!(five_ref == same_five_ref);
/// assert!(ptr::eq(five_ref, same_five_ref));
///
/// assert!(five_ref == other_five_ref);
/// assert!(!ptr::eq(five_ref, other_five_ref));
/// ```
///
/// Slices are also compared by their length (fat pointers):
///
/// ```
/// let a = [1, 2, 3];
/// assert!(std::ptr::eq(&a[..3], &a[..3]));
/// assert!(!std::ptr::eq(&a[..2], &a[..3]));
/// assert!(!std::ptr::eq(&a[0..2], &a[1..3]));
/// ```
#[stable(feature = "ptr_eq", since = "1.17.0")]
#[inline(always)]
#[must_use = "pointer comparison produces a value"]
#[rustc_diagnostic_item = "ptr_eq"]
#[allow(ambiguous_wide_pointer_comparisons)] // it's actually clear here
pub fn eq<T: PointeeSized>(a: *const T, b: *const T) -> bool {
    a == b
}

/// 如果参数是相同类型的薄指针，
/// ignoring any metadata in [wide](core::ptr#thin-and-wide-pointers) pointers.
///
/// # 示例
/// then this is the same as [`eq`].
///
/// # Examples
///
/// ```
/// use std::ptr;
///
/// let whole: &[i32; 3] = &[1, 2, 3];
/// let first: &i32 = &whole[0];
///
/// assert!(ptr::addr_eq(whole, first));
/// assert!(!ptr::eq::<dyn std::fmt::Debug>(whole, first));
/// ```
#[stable(feature = "ptr_addr_eq", since = "1.76.0")]
#[inline(always)]
#[must_use = "pointer comparison produces a value"]
pub fn addr_eq<T: PointeeSized, U: PointeeSized>(p: *const T, q: *const U) -> bool {
    (p as *const ()) == (q as *const ())
}

/// 令人惊讶的函数指针比较语义。
///
/// This is the same as `f == g`, but using this function makes clear that the potentially
/// “身份”；特别是这种比较：
///
/// There are **basically no guarantees** about how functions are compiled as they have no intrinsic
/// 只要它们编译成相同的机器码即可。
///
/// * May return `true` unexpectedly, even in cases where functions are not logically equivalent,
/// 换句话说，比较相等的函数可能具有不同的行为！即使
///
///   For example, the following program is likely (but not guaranteed) to print `(true, true)`
/// when compiled with optimization:
///
///   ```
///   use std::hint::assert_unchecked;
///
///   let f: fn(i32) -> i32 = |x| x;
///   let g: fn(u32) -> u32 = |x| x + 0;  // different type, different body
///   let h: unsafe fn(i32) -> i32 = |x| unsafe { assert_unchecked(x != 0); x };  // different unsafe preconditions
///   // These three functions are allowed but not guaranteed to compare equal.
///   dbg!(std::ptr::fn_addr_eq(f, g), std::ptr::fn_addr_eq(f, h));
///   ```
///
/// In other words, functions that compare equal can have different behavior! Even if
///   `fn_addr_eq(f, h)` is true, it is still undefined behavior to call `h(0)`, while `f(0)` is
/// 可以安全调用。
///
/// 其原因是函数指针具有 [provenance][crate::ptr#provenance]。
/// 如果函数具有相同的汇编代码并合并，它们的 provenance 决定了将调用哪个版本。
///   the function will be called. `f` and `h` therefore end up with the same address but different
///   provenance, and `fn_addr_eq` only compares the address.
///
/// * May return `false` in any case.
///
/// 这种情况在泛型函数中尤为常见，但任何函数都可能发生。
/// （从实现角度来看，这是可能的，因为编译器有时可能会多次处理函数， 导致重复的机器代码。）
///   processed more than once by the compiler, resulting in duplicate machine code.)
///
/// These limitations imply that comparing function pointers (via this function or via `==`) is only
/// useful in extremely niche circumstances. For instance, if a library maintains a set of
/// 这永远不会引入未定义行为，因为它只是跳过执行部分已注册的回调。
/// spuriously skipped), then it can be legitimate to deduplicate callbacks based on `fn_addr_eq`.
/// This can never introduce undefined behavior because it only skips executing some of the
/// registered callbacks.
#[stable(feature = "ptr_fn_addr_eq", since = "1.85.0")]
#[inline(always)]
#[must_use = "function pointer comparison produces a value"]
pub fn fn_addr_eq<T: FnPtr, U: FnPtr>(f: T, g: U) -> bool {
    f.addr() == g.addr()
}

/// # 示例
///
/// This can be used to hash a `&T` reference (which coerces to `*const T` implicitly)
/// by its address rather than the value it points to
/// (which is what the `Hash for &T` implementation does).
///
/// # 示例
///
/// ```
/// use std::hash::{DefaultHasher, Hash, Hasher};
/// use std::ptr;
///
/// let five = 5;
/// let five_ref = &five;
///
/// let mut hasher = DefaultHasher::new();
/// ptr::hash(five_ref, &mut hasher);
/// let actual = hasher.finish();
///
/// let mut hasher = DefaultHasher::new();
/// (five_ref as *const i32).hash(&mut hasher);
/// let expected = hasher.finish();
///
/// assert_eq!(actual, expected);
/// ```
#[stable(feature = "ptr_hash", since = "1.35.0")]
pub fn hash<T: PointeeSized, S: hash::Hasher>(hashee: *const T, into: &mut S) {
    use crate::hash::Hash;
    hashee.hash(into);
}

#[stable(feature = "fnptr_impls", since = "1.4.0")]
#[diagnostic::on_const(
    message = "pointers cannot be reliably compared during const eval",
    note = "see issue #53020 <https://github.com/rust-lang/rust/issues/53020> for more information"
)]
impl<F: FnPtr> PartialEq for F {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        self.addr() == other.addr()
    }
}
#[stable(feature = "fnptr_impls", since = "1.4.0")]
#[diagnostic::on_const(
    message = "pointers cannot be reliably compared during const eval",
    note = "see issue #53020 <https://github.com/rust-lang/rust/issues/53020> for more information"
)]
impl<F: FnPtr> Eq for F {}

#[stable(feature = "fnptr_impls", since = "1.4.0")]
#[diagnostic::on_const(
    message = "pointers cannot be reliably compared during const eval",
    note = "see issue #53020 <https://github.com/rust-lang/rust/issues/53020> for more information"
)]
impl<F: FnPtr> PartialOrd for F {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.addr().partial_cmp(&other.addr())
    }
}
#[stable(feature = "fnptr_impls", since = "1.4.0")]
#[diagnostic::on_const(
    message = "pointers cannot be reliably compared during const eval",
    note = "see issue #53020 <https://github.com/rust-lang/rust/issues/53020> for more information"
)]
impl<F: FnPtr> Ord for F {
    #[inline]
    fn cmp(&self, other: &Self) -> Ordering {
        self.addr().cmp(&other.addr())
    }
}

#[stable(feature = "fnptr_impls", since = "1.4.0")]
impl<F: FnPtr> hash::Hash for F {
    fn hash<HH: hash::Hasher>(&self, state: &mut HH) {
        state.write_usize(self.addr())
    }
}

#[stable(feature = "fnptr_impls", since = "1.4.0")]
impl<F: FnPtr> fmt::Pointer for F {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::pointer_fmt_inner(self.addr(), f)
    }
}

#[stable(feature = "fnptr_impls", since = "1.4.0")]
impl<F: FnPtr> fmt::Debug for F {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::pointer_fmt_inner(self.addr(), f)
    }
}

/// Creates a `const` raw pointer to a place, without creating an intermediate reference.
///
/// `addr_of!(expr)` is equivalent to `&raw const expr`. The macro is *soft-deprecated*;
/// use `&raw const` instead.
///
/// It is still an open question under which conditions writing through an `addr_of!`-created
/// pointer is permitted. If the place `expr` evaluates to is based on a raw pointer, then the
/// result of `addr_of!` inherits all permissions from that raw pointer. However, if the place is
/// based on a reference, local variable, or `static`, then until all details are decided, the same
/// rules as for shared references apply: it is UB to write through a pointer created with this
/// operation, except for bytes located inside an `UnsafeCell`. Use `&raw mut` (or [`addr_of_mut`])
/// to create a raw pointer that definitely permits mutation.
///
/// Creating a reference with `&`/`&mut` is only allowed if the pointer is properly aligned
/// 并指向已初始化数据。如果不符合这些要求，则应使用原始指针。
/// raw pointers should be used instead. However, `&expr as *const _` creates a reference
/// 在将其转换为原始指针之前，该引用遵循与所有其他引用相同的规则
/// 此宏可以在*不*创建引用的情况下创建原始指针
/// 首先创建引用。
///
/// See [`addr_of_mut`] for how to create a pointer to uninitialized data.
/// Doing that with `addr_of` would not make much sense since one could only
/// # 安全性
///
/// # Safety
///
/// The `expr` in `addr_of!(expr)` is evaluated as a place expression, but never loads from the
/// place or requires the place to be dereferenceable. This means that `addr_of!((*ptr).field)`
/// still requires the projection to `field` to be in-bounds, using the same rules as [`offset`].
/// However, `addr_of!(*ptr)` is defined behavior even if `ptr` is null, dangling, or misaligned.
///
/// Note that `Deref`/`Index` coercions (and their mutable counterparts) are applied inside
/// `addr_of!` like everywhere else, in which case a reference is created to call `Deref::deref` or
/// `Index::index`, respectively. The statements above only apply when no such coercions are
/// **正确用法：创建指向未对齐数据的指针**
///
/// [`offset`]: pointer::offset
///
/// # **错误用法：越界字段投影**
///
/// **Correct usage: Creating a pointer to unaligned data**
///
/// ```
/// use std::ptr;
///
/// #[repr(packed)]
/// struct Packed {
///     f1: u8,
///     f2: u16,
/// }
///
/// let packed = Packed { f1: 1, f2: 2 };
/// // `&packed.f2` would create an unaligned reference, and thus be Undefined Behavior!
/// let raw_f2 = ptr::addr_of!(packed.f2);
/// assert_eq!(unsafe { raw_f2.read_unaligned() }, 2);
/// ```
///
/// 但指针在 4 个字节的分配边界之外，
///
/// ```rust,no_run
/// use std::ptr;
///
/// #[repr(C)]
/// struct MyStruct {
///     field1: i32,
///     field2: i32,
/// }
///
/// let ptr: *const MyStruct = ptr::null();
/// let fieldptr = unsafe { ptr::addr_of!((*ptr).field2) }; // Undefined Behavior ⚠️
/// ```
///
/// The field projection `.field2` would offset the pointer by 4 bytes,
/// but the pointer is not in-bounds of an allocation for 4 bytes,
/// so this offset is Undefined Behavior.
/// See the [`offset`] docs for a full list of requirements for inbounds pointer arithmetic; the
/// same requirements apply to field projections, even inside `addr_of!`. (In particular, it makes
/// no difference whether the pointer is null or dangling.)
#[stable(feature = "raw_ref_macros", since = "1.51.0")]
#[rustc_macro_transparency = "semiopaque"]
pub macro addr_of($place:expr) {
    &raw const $place
}

/// Creates a `mut` raw pointer to a place, without creating an intermediate reference.
///
/// `addr_of_mut!(expr)` is equivalent to `&raw mut expr`. The macro is *soft-deprecated*;
/// use `&raw mut` instead.
///
/// Creating a reference with `&`/`&mut` is only allowed if the pointer is properly aligned
/// and points to initialized data. For cases where those requirements do not hold,
/// raw pointers should be used instead. However, `&mut expr as *mut _` creates a reference
/// before casting it to a raw pointer, and that reference is subject to the same rules
/// as all other references. This macro can create a raw pointer *without* creating
/// 首先是一个引用。
///
/// # 安全性
///
/// The `expr` in `addr_of_mut!(expr)` is evaluated as a place expression, but never loads from the
/// place or requires the place to be dereferenceable. This means that `addr_of_mut!((*ptr).field)`
/// still requires the projection to `field` to be in-bounds, using the same rules as [`offset`].
/// However, `addr_of_mut!(*ptr)` is defined behavior even if `ptr` is null, dangling, or misaligned.
///
/// Note that `Deref`/`Index` coercions (and their mutable counterparts) are applied inside
/// `addr_of_mut!` like everywhere else, in which case a reference is created to call `Deref::deref`
/// or `Index::index`, respectively. The statements above only apply when no such coercions are
/// 时生效。
///
/// [`offset`]: pointer::offset
///
/// # 示例
///
/// **正确用法：创建指向未对齐数据的指针**
///
/// ```
/// use std::ptr;
///
/// #[repr(packed)]
/// struct Packed {
///     f1: u8,
///     f2: u16,
/// }
///
/// let mut packed = Packed { f1: 1, f2: 2 };
/// // `&mut packed.f2` would create an unaligned reference, and thus be Undefined Behavior!
/// let raw_f2 = ptr::addr_of_mut!(packed.f2);
/// unsafe { raw_f2.write_unaligned(42); }
/// assert_eq!({packed.f2}, 42); // `{...}` forces copying the field instead of creating a reference.
/// ```
///
/// **正确用法：创建指向未初始化数据的指针**
///
/// ```rust
/// use std::{ptr, mem::MaybeUninit};
///
/// struct Demo {
///     field: bool,
/// }
///
/// let mut uninit = MaybeUninit::<Demo>::uninit();
/// // `&uninit.as_mut().field` would create a reference to an uninitialized `bool`,
/// // and thus be Undefined Behavior!
/// let f1_ptr = unsafe { ptr::addr_of_mut!((*uninit.as_mut_ptr()).field) };
/// unsafe { f1_ptr.write(true); }
/// let init = unsafe { uninit.assume_init() };
/// ```
///
/// **错误用法：超出边界的字段投影**
///
/// ```rust,no_run
/// use std::ptr;
///
/// #[repr(C)]
/// struct MyStruct {
///     field1: i32,
///     field2: i32,
/// }
///
/// let ptr: *mut MyStruct = ptr::null_mut();
/// let fieldptr = unsafe { ptr::addr_of_mut!((*ptr).field2) }; // Undefined Behavior ⚠️
/// ```
///
/// The field projection `.field2` would offset the pointer by 4 bytes,
/// 但指针在 4 个字节的分配边界之外，
/// 因此这种偏移属于未定义行为。
/// See the [`offset`] docs for a full list of requirements for inbounds pointer arithmetic; the
/// same requirements apply to field projections, even inside `addr_of_mut!`. (In particular, it
/// 指针为 null 或悬空并无区别。
#[stable(feature = "raw_ref_macros", since = "1.51.0")]
#[rustc_macro_transparency = "semiopaque"]
pub macro addr_of_mut($place:expr) {
    &raw mut $place
}

/// Used in [`read_unaligned`] and [`write_unaligned`] to load and store `T`
/// with alignment 1 rather than its usual `align_of::<T>()` alignment.
#[repr(Rust, packed)]
struct Unaligned<T>(T);
