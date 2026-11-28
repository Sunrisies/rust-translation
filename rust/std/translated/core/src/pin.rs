//! 将数据固定在内存中的类型。
//!
//! 有时能够依赖某个值无法被*移动*是有用的，
//! 意味着其在内存中的地址不能改变。当存在一个或多个[*指针*]指向该值时尤其有用。这种能力可以
//! 确保[指针]所指向的值（其**点值**）不会
//! 被*移动*出其内存位置。
//!
//! 1. 不会从其内存位置被*移动*。
//! 2. 更一般地说，仍会在同一内存位置保持*有效*。
//!
//! 这被称为“固定”。我们可以说满足这些保证的值已被
//! “固定”了，即它被永久地（在其生命周期结束前）绑定在其内存位置，就像被固定在销钉上一样。固定值是一个非常有用的
//! location in memory, as though pinned to a pinboard. Pinning a value is an incredibly useful
//! building block for [`unsafe`] code to be able to reason about whether a raw pointer to the
//! 对于像自引用类型和无法用完全安全的Rust实现
//! 仅通过借用检查[引用]的侵入性数据结构这样的类型来说，是实施安全接口所必需的。
//! “固定”允许我们将存在于内存中某个位置的值置于一种状态，在这种状态下
//! types and intrusive data structures which cannot currently be modeled in fully safe Rust using
//! only borrow-checked [references][reference].
//!
//! "Pinning" allows us to put a *value* which exists at some location in memory into a state where
//! safe code cannot *move* that value to a different location in memory or otherwise invalidate it
//! at its current location (unless it implements [`Unpin`], which we will
//! [talk about below][self#unpin]). Anything that wants to interact with the pinned value in a way
//! that has the potential to violate these guarantees must promise that it will not actually
//! violate them, using the [`unsafe`] keyword to mark that such a promise is upheld by the user
//! and not the compiler. In this way, we can allow other [`unsafe`] code to rely on any pointers
//! that point to the pinned value to be valid to dereference while it is pinned.
//!
//! Note that as long as you don't use [`unsafe`], it's impossible to create or misuse a pinned
//! value in a way that is unsound. See the documentation of [`Pin<Ptr>`] for more
//! information on the practicalities of how to pin a value and how to use that pinned value from a
//! user's perspective without using [`unsafe`].
//!
//! The rest of this documentation is intended to be the source of truth for users of [`Pin<Ptr>`]
//! that are implementing the [`unsafe`] pieces of an interface that relies on pinning for validity;
//! users of [`Pin<Ptr>`] in safe code do not need to read it in detail.
//!
//! 本文档包含多个部分：
//!
//! * [什么是“移动”？][what-is-moving]
//! * [什么是“固定”？][what-is-pinning]
//! * [地址敏感性，即“何时需要固定？”][address-sensitive-values]
//! * [具有地址敏感状态的类型示例][address-sensitive-examples]
//! * [自引用结构][self-ref]
//! * [侵入式双向链表][linked-list]
//! * [Subtle details and the `Drop` guarantee][subtle-details]
//!
//! # 什么是“移动”？
//! [what-is-moving]: self#what-is-moving
//!
//! 当我们说某个值被*移动*时，意味着编译器逐字节地复制该值
//! 从一个位置到另一个位置。从纯机械意义上讲，这与
//! [`Copy`]ing a value from one place in memory to another. In Rust, "move" carries with it the
//! semantics of ownership transfer from one variable to another, which is the key difference
//! between a [`Copy`] and a move. For the purposes of this module's documentation, however, when
//! 我们在斜体中写*移动*时，特指值在机械意义上被移动到内存中的新位置。
//! 所有 Rust 值都易于*移动*。这意味着值的地址在借用之间不一定稳定。编译器可以在不运行任何代码通知该值其地址已改变的情况下
//!
//! 将值移动到新地址。尽管编译器不会在没有发生语义移动的地方插入内存移动操作，但有许多地方值*可能*会被移动。例如，在进行
//! 赋值或将值传入函数时。
//! to a new address without running any code to notify that value that its address
//! has changed. Although the compiler will not insert memory *moves* where no semantic move has
//! occurred, there are many places where a value *may* be moved. For example, when doing
//! assignment or passing a value into a function.
//!
//! ```
//! #[derive(Default)]
//! struct AddrTracker(Option<usize>);
//!
//! impl AddrTracker {
//!     // If we haven't checked the addr of self yet, store the current
//!     // address. If we have, confirm that the current address is the same
//!     // as it was last time, or else panic.
//!     fn check_for_move(&mut self) {
//!         let current_addr = self as *mut Self as usize;
//!         match self.0 {
//!             None => self.0 = Some(current_addr),
//!             Some(prev_addr) => assert_eq!(prev_addr, current_addr),
//!         }
//!     }
//! }
//!
//! // Create a tracker and store the initial address
//! let mut tracker = AddrTracker::default();
//! tracker.check_for_move();
//!
//! // Here we shadow the variable. This carries a semantic move, and may therefore also
//! // come with a mechanical memory *move*
//! let mut tracker = tracker;
//!
//! // May panic!
//! // tracker.check_for_move();
//! ```
//!
//! In this sense, Rust does not guarantee that `check_for_move()` will never panic, because the
//! compiler is permitted to *move* `tracker` in many situations.
//!
//! Common smart-pointer types such as [`Box<T>`] and [`&mut T`] also allow *moving* the underlying
//! *value* they point at: you can move out of a [`Box<T>`], or you can use [`mem::replace`] to
//! move a `T` out of a [`&mut T`]. Therefore, putting a value (such as `tracker` above) behind a
//! 仅靠指针本身不足以确保其地址不会改变。
//!
//! # “pinning”是什么？
//! [what-is-pinning]: self#what-is-pinning
//!
//! 当某个值被置于一种保证其
//! 在被 pin 之后直到其
//! [`drop`] is called.
//!
//! ## 地址敏感值，也称为“需要 pinning 的情况”
//! [address-sensitive-values]: self#address-sensitive-values-aka-when-we-need-pinning
//!
//! Rust 中的大多数值完全允许按需被 *移动*。
//! 对于某些类型来说，*任何*该类型的数值都可以被
//! *moved* at-will should implement [`Unpin`], which we will discuss more [below][self#unpin].
//!
//! [`Pin`] is specifically targeted at allowing the implementation of *safe interfaces* around
//! 具有某些状态导致它们成为“地址敏感”的类型的 *安全接口* 的实现。处于这种
//! “地址敏感”状态的值不适合被按需 *移动*。这样的值必须
//! 在其生命周期的地址敏感阶段保持 *未被移动* 且有效，因为某些
//! 接口依赖于这些不变量为真，以便其实现能够正确。
//!
//! 作为一个可能成为地址敏感的类型的示例，考虑一种包含指向自身数据另一部分的指针的类型，即“自引用”类型。为了
//! contains a pointer to another piece of its own data, *i.e.* a "self-referential" type. In order
//! for such a type to be implemented soundly, the pointer which points into `self`'s data must be
//! 具有 *地址敏感* 状态的此类类型通常遵循如下生命周期：
//! point to the old address where the value was located and not into the new location of `self`,
//! thus becoming invalid. A key example of such self-referential types are the state machines
//! generated by the compiler to implement [`Future`] for `async fn`s.
//!
//! Such types that have an *address-sensitive* state usually follow a lifecycle
//! that looks something like so:
//!
//! 1. A value is created which can be freely moved around.
//!     * e.g. calling an async function which returns a state machine implementing [`Future`]
//! 2. An operation causes the value to depend on its own address not changing
//!     * e.g. calling [`poll`] for the first time on the produced [`Future`]
//! 3. Further pieces of the safe interface of the type use internal [`unsafe`] operations which
//! assume that the address of the value is stable
//!     * e.g. subsequent calls to [`poll`]
//! 4. 在值被破坏（例如释放内存）之前，它会被 *丢弃*，从而有机会
//! 通知所有指向它的指针，这些指针将会失效
//!     * e.g. [`drop`]ping the [`Future`] [^pin-drop-future]
//!
//! 有两种可能的方法可以确保 2. 和 3. 中所需的不变量不被破坏（这些
//! 适用于任何需要地址敏感性的类型，而不仅仅是自引用类型）
//!
//! 1. 让值在移动时检测并更新所有指向它的指针
//! 2. 确保值的地址不变（且内存不被重新使用）
//! 对于其他任何情况）在指向它的指针预期有效的期间
//! 进行解引用时
//!
//! 由于我们讨论过，Rust 可以在不通知值已移动的情况下移动值，因此
//! 第一个选项被排除。
//!
//! 为了实现第二个选项，我们必须以某种方式强制其关键不变量，
//! *即* 防止值被 *移动* 或其他方式破坏（你可能会注意到这
//! 听起来非常像对值进行 *固定* 的定义。有几种方法可以在 Rust 中强制这个不变量：
//! 能够强制执行这个不变量：
//!
//! 1. Offer a wholly `unsafe` API to interact with the object, thus requiring every caller to
//! 自己维护这个不变量
//! 2. 将不可移动的值存储在对象内部精心管理的指针之后
//! 中
//! 3. 利用类型系统通过提供受限的
//! 接口来编码和强制这个不变量，以便与需要这些不变量的 *任何* 对象交互
//!
//! The first option is quite obviously undesirable, as the [`unsafe`]ty of the interface will
//! 在整个与对象交互的代码中传播开来。
//!
//! 第二个选项对于某些用例来说是一个可行的解决方案，特别是
//! 对于自引用类型。在这种模式下，任何具有地址敏感状态的类型
//! would ultimately store its data in something like a [`Box<T>`], carefully manage internal
//! 访问这些数据以确保没有 *移动* 或其他破坏发生，最后
//! 提供一层安全的接口。
//!
//! 使用这种模型有一些相关的缺点。最显著的是
//! 每个单独的对象必须假设自己 *独立* 以确保
//! 确保其数据不会被*移动*或变得无效。由于不同类型的值之间没有共享的
//! 契约，一个对象无法假设其他对象与它的交互
//! 能够恰当地遵守与其数据交互相关的不变量，并且必须
//! 因此要保护它不受所有人干扰。正因为如此，对地址敏感的类型的*组合*
//! 每次向混合中添加新对象时，至少需要一层指针间接层
//! （实际上，还需要堆分配）。
//!
//! 尽管还有其他原因，但昂贵的组合问题才是关键
//! that drove Rust towards adopting a different model. It is particularly a problem
//! when one considers, for example, the implications of composing together the [`Future`]s which
//! will eventually make up an asynchronous task (including address-sensitive `async fn` state
//! machines). It is plausible that there could be many layers of [`Future`]s composed together,
//! including multiple layers of `async fn`s handling different parts of a task. It was deemed
//! unacceptable to force indirection and allocation for each layer of composition in this case.
//!
//! [`Pin<Ptr>`] is an implementation of the third option. It allows us to solve the issues
//! 关于“固定”数据的保证。
//! 当它们被丢弃时，像基于栈的侵入式链表这样的数据结构也会如此。
//!
//! [^pin-drop-future]: Futures themselves do not ever need to notify other bits of code that
//! 然而，像栈-based 侵入式链表这样的数据结构确实会被丢弃。
//!
//! ## Using [`Pin<Ptr>`] to pin values
//!
//! In order to pin a value, we wrap a *pointer to that value* (of some type `Ptr`) in a
//! [`Pin<Ptr>`]. [`Pin<Ptr>`] can wrap any pointer type, forming a promise that the **pointee**
//! 不会被*移动*或[其他方式失效][微妙细节]。
//!
//! We call such a [`Pin`]-wrapped pointer a **pinning pointer,** (or pinning reference, or pinning
//! `Box`, etc.) because its existence is the thing that is conceptually pinning the underlying
//! pointee 的位置：它是象征性的“固定销”将数据固定在固定位置
//! （在内存中）。
//!
//! Notice that the thing wrapped by [`Pin`] is not the value which we want to pin itself, but
//! rather a pointer to that value! A [`Pin<Ptr>`] does not pin the `Ptr`; instead, it pins the
//! 指针的***pointee**值*。
//!
//! ### 作为库契约的固定机制
//!
//! Pinning does not require nor make use of any compiler "magic"[^noalias], only a specific
//! contract between the [`unsafe`] parts of a library API and its users.
//!
//! It is important to stress this point as a user of the [`unsafe`] parts of the [`Pin`] API.
//! 来执行“固定”值的机制
//! [`Pin<Ptr>`] to it *does not* actually change the way the compiler behaves towards the
//! inner value! It is possible to use incorrect [`unsafe`] code to create a [`Pin<Ptr>`] to a
//! 这样即使在完全安全的代码中也会导致未定义行为。同样，使用
//! this way lead to undefined behavior even in (from that point) fully safe code. Similarly, using
//! [`unsafe`], one may get access to a bare [`&mut T`] from a [`Pin<Ptr>`] and
//! use that to invalidly *move* the pinned value out. It is the job of the user of the
//! [`unsafe`] parts of the [`Pin`] API to ensure these invariants are not violated.
//!
//! This differs from e.g. [`UnsafeCell`] which changes the semantics of a program's compiled
//! output. A [`Pin<Ptr>`] is a handle to a value which we have promised we will not move out of,
//! but Rust still considers all values themselves to be fundamentally moveable through, *e.g.*
//! assignment or [`mem::replace`].
//!
//! [^noalias]: There is a bit of nuance here that is still being decided about what the aliasing
//! semantics of `Pin<&mut T>` should be, but this is true as of today.
//!
//! ### How [`Pin`] prevents misuse in safe code
//!
//! In order to accomplish the goal of pinning the pointee value, [`Pin<Ptr>`] restricts access to
//! the wrapped `Ptr` type in safe code. Specifically, [`Pin`] disallows the ability to access
//! the wrapped pointer in ways that would allow the user to *move* the underlying pointee value or
//! otherwise re-use that memory for something else without using [`unsafe`]. For example, a
//! [`Pin<&mut T>`] makes it impossible to obtain the wrapped <code>[&mut] T</code> safely because
//! through that <code>[&mut] T</code> it would be possible to *move* the underlying value out of
//! the pointer with [`mem::replace`], etc.
//!
//! As discussed above, this promise must be upheld manually by [`unsafe`] code which interacts
//! with the [`Pin<Ptr>`] so that other [`unsafe`] code can rely on the pointee value being
//! *un-moved* and valid. Interfaces that operate on values which are in an address-sensitive state
//! accept an argument like <code>[Pin]<[&mut] T></code> or <code>[Pin]<[Box]\<T>></code> to
//! 向调用者指示此合约。
//!
//! [如下文所述][drop-guarantee]，选择在接口中使用 pinning 保证，对于某些安全 trait 的实现具有影响。
//! 对于敏感地址类型的实现也会产生相应的影响。
//! 该类型同样会受到影响。
//!
//! ## Interaction between [`Deref`] and [`Pin<Ptr>`]
//!
//! Since [`Pin<Ptr>`] can wrap any pointer type, it uses [`Deref`] and [`DerefMut`] in
//! 识别被固定指针指向的数据类型，并提供（有限的）访问权限。
//!
//! A [`Pin<Ptr>`] where [`Ptr: Deref`][Deref] is a "`Ptr`-style pinning pointer" to a pinned
//! [`Ptr::Target`][Target] – so, a <code>[Pin]<[Box]\<T>></code> is an owned, pinning pointer to a
//! pinned `T`, and a <code>[Pin]<[Rc]\<T>></code> is a reference-counted, pinning pointer to a
//! pinned `T`.
//!
//! [`Pin<Ptr>`] also uses the [`<Ptr as Deref>::Target`][Target] type information to modify the
//! 接口，以便能够与该数据交互（例如，当
//! pinning pointer points at pinned data which implements [`Unpin`], as
//! [如下文所述][self#unpin])。
//!
//! [`Pin<Ptr>`] requires that implementations of [`Deref`] and [`DerefMut`] on `Ptr` return a
//! pointer to the pinned data directly and do not *move* out of the `self` parameter during their
//! implementation of [`DerefMut::deref_mut`]. It is unsound for [`unsafe`] code to wrap pointer
//! types with such "malicious" implementations of [`Deref`]; see [`Pin<Ptr>::new_unchecked`] for
//! details.
//!
//! ## Fixing `AddrTracker`
//!
//! The guarantee of a stable address is necessary to make our `AddrTracker` example work. When
//! `check_for_move` sees a <code>[Pin]<&mut AddrTracker></code>, it can safely assume that value
//! 将存在于同一地址上，直到该值超出作用域，因此多次调用
//! *不会* 引发 panic。
//!
//! ```
//! use std::marker::PhantomPinned;
//! use std::pin::Pin;
//! use std::pin::pin;
//!
//! #[derive(Default)]
//! struct AddrTracker {
//!     prev_addr: Option<usize>,
//!     // remove auto-implemented `Unpin` bound to mark this type as having some
//!     // address-sensitive state. This is essential for our expected pinning
//!     // guarantees to work, and is discussed more below.
//!     _pin: PhantomPinned,
//! }
//!
//! impl AddrTracker {
//!     fn check_for_move(self: Pin<&mut Self>) {
//!         let current_addr = &*self as *const Self as usize;
//!         match self.prev_addr {
//!             None => {
//!                 // SAFETY: we do not move out of self
//!                 let self_data_mut = unsafe { self.get_unchecked_mut() };
//!                 self_data_mut.prev_addr = Some(current_addr);
//!             },
//!             Some(prev_addr) => assert_eq!(prev_addr, current_addr),
//!         }
//!     }
//! }
//!
//! // 1. Create the value, not yet in an address-sensitive state
//! let tracker = AddrTracker::default();
//!
//! // 2. Pin the value by putting it behind a pinning pointer, thus putting
//! // it into an address-sensitive state
//! let mut ptr_to_pinned_tracker: Pin<&mut AddrTracker> = pin!(tracker);
//! ptr_to_pinned_tracker.as_mut().check_for_move();
//!
//! // Trying to access `tracker` or pass `ptr_to_pinned_tracker` to anything that requires
//! // mutable access to a non-pinned version of it will no longer compile
//!
//! // 3. We can now assume that the tracker value will never be moved, thus
//! // this will never panic!
//! ptr_to_pinned_tracker.as_mut().check_for_move();
//! ```
//!
//! Note that this invariant is enforced by simply making it impossible to call code that would
//! 绝大多数 Rust 类型没有敏感地址状态。这些类型
//! value is through the pinning <code>[Pin]<[&mut] T></code>, which in turn restricts our access.
//!
//! ## [`Unpin`]
//!
//! The vast majority of Rust types have no address-sensitive states. These types
//! implement the [`Unpin`] auto-trait, which cancels the restrictive effects of
//! [`Pin`] when the *pointee* type `T` is [`Unpin`]. When [`T: Unpin`][Unpin],
//! <code>[Pin]<[Box]\<T>></code> functions identically to a non-pinning [`Box<T>`]; similarly,
//! <code>[Pin]<[&mut] T></code> would impose no additional restrictions above a regular
//! [`&mut T`].
//!
//! The idea of this trait is to alleviate the reduced ergonomics of APIs that require the use
//! of [`Pin`] for soundness for some types, but which also want to be used by other types that
//! don't care about pinning. The prime example of such an API is [`Future::poll`]. There are many
//! [`Future`] types that don't care about pinning. These futures can implement [`Unpin`] and
//! 
//! subset of [`Future`]s which *do* require pinning to be implemented soundly.
//!
//! Note that the interaction between a [`Pin<Ptr>`] and [`Unpin`] is through the type of the
//! **pointee** value, [`<Ptr as Deref>::Target`][Target]. Whether the `Ptr` type itself
//! implements [`Unpin`] does not affect the behavior of a [`Pin<Ptr>`]. For example, whether or not
//! [`Box`] is [`Unpin`] has no effect on the behavior of <code>[Pin]<[Box]\<T>></code>, because
//! `T` is the type of the pointee value, not [`Box`]. So, whether `T` implements [`Unpin`] is
//! the thing that will affect the behavior of the <code>[Pin]<[Box]\<T>></code>.
//!
//! Builtin types that are [`Unpin`] include all of the primitive types, like [`bool`], [`i32`],
//! and [`f32`], references (<code>[&]T</code> and <code>[&mut] T</code>), etc., as well as many
//! core and standard library types like [`Box<T>`], [`String`], and more.
//! These types are marked [`Unpin`] because they do not have an address-sensitive state like the
//! ones we discussed above. If they did have such a state, those parts of their interface would be
//! unsound without being expressed through pinning, and they would then need to not
//! implement [`Unpin`].
//!
//! The compiler is free to take the conservative stance of marking types as [`Unpin`] so long as
//! all of the types that compose its fields are also [`Unpin`]. This is because if a type
//! implements [`Unpin`], then it is unsound for that type's implementation to rely on
//! pinning-related guarantees for soundness, *even* when viewed through a "pinning" pointer! It is
//! the responsibility of the implementor of a type that relies upon pinning for soundness to
//! ensure that type is *not* marked as [`Unpin`] by adding [`PhantomPinned`] field. This is
//! exactly what we did with our `AddrTracker` example above. Without doing this, you *must not*
//! rely on pinning-related guarantees to apply to your type!
//!
//! If you really need to pin a value of a foreign or built-in type that implements [`Unpin`],
//! you'll need to create your own wrapper type around the [`Unpin`] type you want to pin and then
//! opt-out of [`Unpin`] using [`PhantomPinned`].
//!
//! Exposing access to the inner field which you want to remain pinned must then be carefully
//! 轻松地将内部值从该固定指针中移出，而这正是您想要防止的情况！通过固定指针暴露固定值的字段被称为
//! <code>[Pin]<[&mut] InnerT></code> where <code>InnerT: [Unpin]</code> would allow safe code to
//! [下面][structural-pinning]中详细讨论这一点。
//! # 地址敏感类型的示例
//! ## 自引用结构体
//! 自引用结构体是最简单的地址敏感类型。
//! 对于结构体来说，通常有用的是包含一个指向自身的指针，这
//!
//! # 允许程序高效地跟踪结构体的子部分。
//! [address-sensitive-examples]: #examples-of-address-sensitive-types
//!
//! ## A self-referential struct
//! [self-ref]: #a-self-referential-struct
//! [`Unmovable`]: #a-self-referential-struct
//!
//! Self-referential structs are the simplest kind of address-sensitive type.
//!
//! 如前所述，这种模式也被编译器生成的代码广泛使用。
//! ## 侵入式双向链表
//! Below, the `slice` field is a pointer into the `data` field, which
//! we could imagine being used to track a sliding window of `data` in parser
//! code.
//!
//! As mentioned before, this pattern is also used extensively by compiler-generated
//! [`Future`]s.
//!
//! ```rust
//! use std::pin::Pin;
//! use std::marker::PhantomPinned;
//! use std::ptr::NonNull;
//!
//! /// This is a self-referential struct because `self.slice` points into `self.data`.
//! struct Unmovable {
//!     /// Backing buffer.
//!     data: [u8; 64],
//!     /// Points at `self.data` which we know is itself non-null. Raw pointer because we can't do
//!     /// this with a normal reference.
//!     slice: NonNull<[u8]>,
//!     /// Suppress `Unpin` so that this cannot be moved out of a `Pin` once constructed.
//!     _pin: PhantomPinned,
//! }
//!
//! impl Unmovable {
//!     /// Creates a new `Unmovable`.
//!     ///
//!     /// To ensure the data doesn't move we place it on the heap behind a pinning Box.
//!     /// Note that the data is pinned, but the `Pin<Box<Self>>` which is pinning it can
//!     /// itself still be moved. This is important because it means we can return the pinning
//!     /// pointer from the function, which is itself a kind of move!
//!     fn new() -> Pin<Box<Self>> {
//!         let res = Unmovable {
//!             data: [0; 64],
//!             // We only create the pointer once the data is in place
//!             // otherwise it will have already moved before we even started.
//!             slice: NonNull::from(&[]),
//!             _pin: PhantomPinned,
//!         };
//!         // First we put the data in a box, which will be its final resting place
//!         let mut boxed = Box::new(res);
//!
//!         // Then we make the slice field point to the proper part of that boxed data.
//!         // From now on we need to make sure we don't move the boxed data.
//!         boxed.slice = NonNull::from(&boxed.data);
//!
//!         // To do that, we pin the data in place by pointing to it with a pinning
//!         // (`Pin`-wrapped) pointer.
//!         //
//!         // `Box::into_pin` makes existing `Box` pin the data in-place without moving it,
//!         // so we can safely do this now *after* inserting the slice pointer above, but we have
//!         // to take care that we haven't performed any other semantic moves of `res` in between.
//!         let pin = Box::into_pin(boxed);
//!
//!         // Now we can return the pinned (through a pinning Box) data
//!         pin
//!     }
//! }
//!
//! let unmovable: Pin<Box<Unmovable>> = Unmovable::new();
//!
//! // The inner pointee `Unmovable` struct will now never be allowed to move.
//! // Meanwhile, we are free to move the pointer around.
//! # #[allow(unused_mut)]
//! let mut still_unmoved = unmovable;
//! assert_eq!(still_unmoved.slice, NonNull::from(&still_unmoved.data));
//!
//! // We cannot mutably dereference a `Pin<Ptr>` unless the pointee is `Unpin` or we use unsafe.
//! // Since our type doesn't implement `Unpin`, this will fail to compile.
//! // let mut new_unmoved = Unmovable::new();
//! // std::mem::swap(&mut *still_unmoved, &mut *new_unmoved);
//! ```
//!
//! ## An intrusive, doubly-linked list
//! [linked-list]: #an-intrusive-doubly-linked-list
//!
//! In an intrusive doubly-linked list, the collection itself does not own the memory in which
//! each of its elements is stored. Instead, each client is free to allocate space for elements it
//! adds to the list in whichever manner it likes, including on the stack! Elements can be stored
//! in a stack frame shorter-lived than the collection, provided they are removed from the list
//! before that frame goes out of scope.
//!
//! To make such an intrusive data structure work, every element stores pointers to its predecessor
//! and successor within its own data, rather than having the list structure itself managing those
//! 指针。正是出于这个原因，该结构属于“侵入式”设计：元素在更大结构中的存储方式会“干扰”元素的实现细节。
//! 类型本身！
//! type itself!
//!
//! 使用这种侵入式模式时，元素只有在被固定后才能被添加。如果我们考虑向这样的列表中添加非固定值所带来的后果，就会明白：
//! documentation, but we will discuss how [`Pin`] can help to do so.
//!
//! 指向下一个和前一个元素的指针，我们必须确保没有任何东西使这些指针失效（这些指针指向我们并不拥有的数据）。
//! about the consequences of adding non-pinned values to such a list, this becomes clear:
//!
//! 被销毁之前从列表中移除，否则指向它的指针又会变得无效。
//! which are stored in the elements ahead and behind it. Thus, in order to soundly dereference
//! 失效，从而破坏数据结构。
//! nothing has invalidated those pointers (which point to data that we do not own).
//!
//! Moreover, the [`Drop`][Drop] implementation of each element must in some way notify its
//! 固定的目的不仅仅是防止值被移动，更主要是能够依赖被固定的值在内存中的特定位置保持有效。
//! 为此，固定一个值会添加一个额外的不变性要求，以便使用被固定的数据保持有效，这比非固定同类型值保持有效的要求更多。
//!
//! Crucially, this means we have to be able to rely on [`drop`] always being called before an
//! 这里有一些我们尚未详细讨论的微妙之处。这个不变性。
//! calling [`drop`], the pointers to it stored in its neighboring elements would
//! become invalid, which would break the data structure.
//!
//! Therefore, pinning data also comes with [the "`Drop` guarantee"][drop-guarantee].
//!
//! # Subtle details and the `Drop` guarantee
//! [subtle-details]: self#subtle-details-and-the-drop-guarantee
//! [drop-guarantee]: self#subtle-details-and-the-drop-guarantee
//!
//! The purpose of pinning is not *just* to prevent a value from being *moved*, but more
//! generally to be able to rely on the pinned value *remaining valid **at a specific place*** in
//! memory.
//!
//! To do so, pinning a value adds an *additional* invariant that must be upheld in order for use
//! of the pinned data to be valid, on top of the ones that must be upheld for a non-pinned value
//! of the same type to be valid:
//!
//! From the moment a value is pinned by constructing a [`Pin`]ning pointer to it, that value
//! must *remain, **valid***, at that same address in memory, *until its [`drop`] handler is
//! called.*
//!
//! There is some subtlety to this which we have not yet talked about in detail. The invariant
//! 上述描述意味着，是的，
//!
//! 1. 值不得从内存位置被移动出去
//!
//! 但它也意味着，
//!
//! 2. 存储该值的内存位置不得被破坏或重新使用
//!    during the lifespan of the pinned value until its [`drop`] returns or panics
//!
//! 这一点很微妙，但对于实现侵入式数据结构来说是必要的。
//!
//! ## `Drop` guarantee
//!
//! 必须有一种方式让固定值通知任何依赖其固定状态的代码
//! 即将被销毁。这样，依赖代码就可以从数据结构中移除
//! 固定值的地址，或者改变其行为
//! 知道它不再可以依赖该值位于被固定的位置。
//!
//! Thus, in any situation where we may want to overwrite a pinned value, that value's [`drop`] must
//! be called beforehand (unless the pinned value implements [`Unpin`], in which case we can ignore
//! all of [`Pin`]'s guarantees, as usual).
//!
//! The most common storage-reuse situations occur when a value on the stack is destroyed as part
//! of a function return and when heap storage is freed. In both cases, [`drop`] gets run for us
//! by Rust when using standard safe code. However, for manual heap allocations or otherwise
//! custom-allocated storage, [`unsafe`] code must make sure to call [`ptr::drop_in_place`] before
//! deallocating and re-using said storage.
//!
//! In addition, storage "re-use"/invalidation can happen even if no storage is (de-)allocated.
//! For example, if we had an [`Option`] which contained a `Some(v)` where `v` is pinned, then `v`
//! would be invalidated by setting that option to `None`.
//!
//! Similarly, if a [`Vec`] was used to store pinned values and [`Vec::set_len`] was used to
//! 如果这些项被固定，这将导致 *未定义行为*。
//! 这两种情况都有些人为，但重要的是要记住，被固定的数据
//!
//! Both of these cases are somewhat contrived, but it is crucial to remember that [`Pin`]ned data
//! *must* be [`drop`]ped before it is invalidated; not just to prevent memory leaks, but as a
//! matter of soundness. As a corollary, the following code can *never* be made safe:
//!
//! ```rust
//! # use std::mem::ManuallyDrop;
//! # use std::pin::Pin;
//! # struct Type;
//! // Pin something inside a `ManuallyDrop`. This is fine on its own.
//! let mut pin: Pin<Box<ManuallyDrop<Type>>> = Box::pin(ManuallyDrop::new(Type));
//!
//! // However, creating a pinning mutable reference to the type *inside*
//! // the `ManuallyDrop` is not!
//! let inner: Pin<&mut Type> = unsafe {
//!     Pin::map_unchecked_mut(pin.as_mut(), |x| &mut **x)
//! };
//! ```
//!
//! Because [`mem::ManuallyDrop`] inhibits the destructor of `Type`, it won't get run when the
//! <code>[Box]<[ManuallyDrop]\<Type>></code> is dropped, thus violating the drop guarantee of the
//! <code>[Pin]<[&mut] Type>></code>.
//!
//! Of course, *leaking* memory in such a way that its underlying storage will never get invalidated
//! or re-used is still fine: [`mem::forget`]ing a [`Box<T>`] prevents its storage from ever getting
//! re-used, so the [`drop`] guarantee is still satisfied.
//!
//! # 实现地址敏感类型。
//!
//! 本节详细介绍了实现自定义
//! address-sensitive types, which are different from merely using [`Pin<Ptr>`] in a generic
//! 。
//!
//! ## Implementing [`Drop`] for types with address-sensitive states
//! [drop-impl]: self#implementing-drop-for-types-with-address-sensitive-states
//!
//! The [`drop`] function takes [`&mut self`], but this is called *even if that `self` has been
//! pinned*! Implementing [`Drop`] for a type with address-sensitive states requires some care, because if `self` was
//! indeed in an address-sensitive state before [`drop`] was called, it is as if the compiler
//! automatically called [`Pin::get_unchecked_mut`].
//!
//! 这在纯安全代码中永远不会引起问题，因为创建固定指针指向
//! a type which has address-sensitive states (and thus does not implement `Unpin`) requires `unsafe`,
//! 但值得注意的是，选择利用固定相关的保证
//! 来证明你的类型在实现中的有效性会对该类型的
//! [`Drop`][Drop] implementation as well: if an element of your type could have been pinned,
//! you must treat [`Drop`][Drop] as implicitly taking <code>self: [Pin]<[&mut] Self></code>.
//!
//! You should implement [`Drop`] as follows:
//!
//! ```rust,no_run
//! # use std::pin::Pin;
//! # struct Type;
//! impl Drop for Type {
//!     fn drop(&mut self) {
//!         // `new_unchecked` is okay because we know this value is never used
//!         // again after being dropped.
//!         inner_drop(unsafe { Pin::new_unchecked(self)});
//!         fn inner_drop(this: Pin<&mut Type>) {
//!             // Actual drop code goes here.
//!         }
//!     }
//! }
//! ```
//!
//! The function `inner_drop` has the signature that [`drop`] *should* have in this situation.
//! This makes sure that you do not accidentally use `self`/`this` in a way that is in conflict
//! 。
//!
//! Moreover, if your type is [`#[repr(packed)]`][packed], the compiler will automatically
//! 移动字段以便释放它们。甚至对于恰好足够对齐的字段也是如此。因此，你不能
//! that for fields that happen to be sufficiently aligned. As a consequence, you cannot use
//! pinning with a [`#[repr(packed)]`][packed] type.
//!
//! ### Implementing [`Drop`] for pointer types which will be used as [`Pin`]ning pointers
//!
//! It should further be noted that creating a pinning pointer of some type `Ptr` *also* carries
//! with it implications on the way that `Ptr` type must implement [`Drop`]
//! (as well as [`Deref`] and [`DerefMut`])! When implementing a pointer type that may be used as
//! 固定指针的指针类型时，你必须采取上述相同的措施，避免将其 *移动* 出去或
//! otherwise invalidate the pointee during [`Drop`], [`Deref`], or [`DerefMut`]
//! 实现无效。
//!
//! ## “赋值”固定数据
//!
//! Although in general it is not valid to swap data or assign through a [`Pin<Ptr>`] for the same
//! 针对正在被修改的具体数据结构需求进行特殊处理时，这是可行的
//! 例如，赋值函数必须知道如何更新所有对固定地址的引用（以及满足该类型有效性的其他任何必要不变量）。对于
//! modified. For example, the assigning function must know how to update all uses of the pinned
//! 即使我们不能让编译器自动执行赋值，也可以为可能需要这种功能的类型编写
//! [`Unmovable`] (from the example above), we could write an assignment function like so:
//!
//! ```
//! # use std::pin::Pin;
//! # use std::marker::PhantomPinned;
//! # use std::ptr::NonNull;
//! # struct Unmovable {
//! #     data: [u8; 64],
//! #     slice: NonNull<[u8]>,
//! #     _pin: PhantomPinned,
//! # }
//! #
//! impl Unmovable {
//!     // Copies the contents of `src` into `self`, fixing up the self-pointer
//!     // in the process.
//!     fn assign(self: Pin<&mut Self>, src: Pin<&mut Self>) {
//!         unsafe {
//!             let unpinned_self = Pin::into_inner_unchecked(self);
//!             let unpinned_src = Pin::into_inner_unchecked(src);
//!             *unpinned_self = Self {
//!                 data: unpinned_src.data,
//!                 slice: NonNull::from(&mut []),
//!                 _pin: PhantomPinned,
//!             };
//!
//!             let data_ptr = unpinned_src.data.as_ptr() as *const u8;
//!             let slice_ptr = unpinned_src.slice.as_ptr() as *const u8;
//!             let offset = slice_ptr.offset_from(data_ptr) as usize;
//!             let len = unpinned_src.slice.as_ptr().len();
//!
//!             unpinned_self.slice = NonNull::from(&mut unpinned_self.data[offset..offset+len]);
//!         }
//!     }
//! }
//! ```
//!
//! Even though we can't have the compiler do the assignment for us, it's possible to write
//! such specialized functions for types that might need it.
//!
//! Note that it _is_ possible to assign generically through a [`Pin<Ptr>`] by way of [`Pin::set()`].
//! This does not violate any guarantees, since it will run [`drop`] on the pointee value before
//! assigning the new value. Thus, the [`drop`] implementation still has a chance to perform the
//! 借用：
//! value is overwritten.
//!
//! ## Projections and Structural Pinning
//! [structural-pinning]: self#projections-and-structural-pinning
//!
//! With ordinary structs, it is natural that we want to add *projection* methods that allow
//! 同样适用于共享引用，但我们将以可变的
//! 引用作为更常见的案例进行说明）
//!
//! ```
//! # struct Field;
//! struct Struct {
//!     field: Field,
//!     // ...
//! }
//!
//! impl Struct {
//!     fn field(&mut self) -> &mut Field { &mut self.field }
//! }
//! ```
//!
//! When working with address-sensitive types, it's not obvious what the signature of these
//! functions should be. If `field` takes <code>self: [Pin]<[&mut Struct][&mut]></code>, should it
//! return [`&mut Field`] or <code>[Pin]<[`&mut Field`]></code>? This question also arises with
//! `enum`s and wrapper types like [`Vec<T>`], [`Box<T>`], and [`RefCell<T>`]. (This question
//! applies just as well to shared references, but we'll examine the more common case of mutable
//! references for illustration)
//!
//! It turns out that it's up to the author of `Struct` to decide which type the "projection"
//! 应当产生。不过选择必须*一致*：如果一个 pin 被投射到某个字段中
//! 则很可能在其他地方也不会被暴露，除非该 pin 被投射到其他地方
//! pin。
//!
//! 作为数据结构的作者，你可以决定每个字段是否进行结构式 pinning
//! “传播”到该字段或不会传播。传播的结构式 pinning 也被称为“结构式 pinning”
//! 因为它遵循类型的结构。
//!
//! This choice depends on what guarantees you need from the field for your [`unsafe`] code to work.
//! 如果该字段本身对地址敏感，或者参与父结构的地址
//! 敏感性，则需要进行结构式 pinning。
//!
//! A useful test is if [`unsafe`] code that consumes <code>[Pin]\<[&mut Struct][&mut]></code>
//! 还需要注意该字段本身的地址，这可能是该字段
//! 进行了结构式 pinning 的证据。不幸的是，没有绝对固定的规则。
//!
//! ### Choosing pinning *not to be* structural for `field`...
//!
//! 虽然违反直觉，但这通常是更简单的选择：如果你不暴露一个
//! <code>[Pin]<[&mut] Field></code>, you do not need to be careful about other code
//! 从该字段中移出，你只需确保永远不要创建对该字段的
//! 引用。当然这也意味着，如果你决定某个字段没有
//! have structural pinning, you must not write [`unsafe`] code that assumes (invalidly) that the
//! field *is* structurally pinned!
//!
//! 没有结构式 pinning 的字段可能有一个投影方法将
//! <code>[Pin]<[&mut] Struct></code> into [`&mut Field`]:
//!
//! ```rust,no_run
//! # use std::pin::Pin;
//! # type Field = i32;
//! # struct Struct { field: Field }
//! impl Struct {
//!     fn field(self: Pin<&mut Self>) -> &mut Field {
//!         // This is okay because `field` is never considered pinned, therefore we do not
//!         // need to uphold any pinning guarantees for this field in particular. Of course,
//!         // we must not elsewhere assume this field *is* pinned if we choose to expose
//!         // such a method!
//!         unsafe { &mut self.get_unchecked_mut().field }
//!     }
//! }
//! ```
//!
//! You may also in this situation <code>impl [Unpin] for Struct {}</code> *even if* the type of
//! `field` is not [`Unpin`]. Since we have explicitly chosen not to care about pinning guarantees
//! for `field`, the way `field`'s type interacts with pinning is no longer relevant in the
//! context of its use in `Struct`.
//!
//! ### Choosing pinning *to be* structural for `field`...
//!
//! The other option is to decide that pinning is "structural" for `field`,
//! 意味着如果结构体进行了 pinning，则字段也进行了 pinning。
//!
//! This allows writing a projection that creates a <code>[Pin]<[`&mut Field`]></code>, thus
//! 证明该字段被 pinning：
//!
//! ```rust,no_run
//! # use std::pin::Pin;
//! # type Field = i32;
//! # struct Struct { field: Field }
//! impl Struct {
//!     fn field(self: Pin<&mut Self>) -> Pin<&mut Field> {
//!         // This is okay because `field` is pinned when `self` is.
//!         unsafe { self.map_unchecked_mut(|s| &mut s.field) }
//!     }
//! }
//! ```
//!
//! 结构式 pinning 有一些额外的要求：
//!
//! 1.  *Structural [`Unpin`].* A struct can be [`Unpin`] only if all of its
//!     structurally-pinned fields are, too. This is [`Unpin`]'s behavior by default.
//! 然而，作为库作者，你的责任是不编写类似这样的代码：
//!     <code>impl\<T> [Unpin] for Struct\<T> {}</code> and then offer a method that provides
//!     structural pinning to an inner field of `T`, which may not be [`Unpin`]! (Adding *any*
//!     projection operation requires unsafe code, so the fact that [`Unpin`] is a safe trait does
//! 违反“只有在使用时才需要担心这些事情”的原则。
//!     [`unsafe`])
//!
//! 2.  *Pinned Destruction.* As discussed [above][drop-impl], [`drop`] takes
//!     [`&mut self`], but the struct (and hence its fields) might have been pinned
//!     before. The destructor must be written as if its argument was
//!     <code>self: [Pin]\<[`&mut Self`]></code>, instead.
//!
//!     As a consequence, the struct *must not* be [`#[repr(packed)]`][packed].
//!
//! 3. *结构式销毁通知*。你必须遵守
//!     [`Drop` guarantee][drop-guarantee]: once your struct is pinned, the struct's storage cannot
//! 在不调用结构固定字段的析构函数的情况下被重新使用。
//!
//!     This can be tricky, as witnessed by [`VecDeque<T>`]: the destructor of [`VecDeque<T>`]
//!     can fail to call [`drop`] on all elements if one of the destructors panics. This violates
//!     the [`Drop` guarantee][drop-guarantee], because it can lead to elements being deallocated
//! 而析构函数未被调用。
//!
//!     [`VecDeque<T>`] has no pinning projections, so its destructor is sound. If it wanted
//! 提供这样的结构固定，其析构函数需要在任何析构函数发生 panic 时终止进程。
//! 4. 你不得提供任何可能导致数据从
//!
//! 结构字段中*移动*出来的操作，当你的类型被固定时。例如，如果结构体包含一个
//!     the structural fields when your type is pinned. For example, if the struct contains an
//!     [`Option<T>`] and there is a [`take`][Option::take]-like operation with type
//!     <code>fn([Pin]<[&mut Struct\<T>][&mut]>) -> [`Option<T>`]</code>,
//!     then that operation can be used to move a `T` out of a pinned `Struct<T>` – which
//! 对于更复杂的从固定类型中移动数据的例子，
//!
//!     For a more complex example of moving data out of a pinned type,
//!     imagine if [`RefCell<T>`] had a method
//!     <code>fn get_pin_mut(self: [Pin]<[`&mut Self`]>) -> [Pin]<[`&mut T`]></code>.
//! 那么我们可以执行以下操作：
//!     ```compile_fail
//!     fn exploit_ref_cell<T>(mut rc: Pin<&mut RefCell<T>>) {
//!         // Here we get pinned access to the `T`.
//!         let _: Pin<&mut T> = rc.as_mut().get_pin_mut();
//!
//!         // And here we have `&mut T` to the same data.
//!         let shared: &RefCell<T> = rc.into_ref().get_ref();
//!         let mut borrow = shared.borrow_mut();
//!         let content = &mut *borrow;
//!     }
//!     ```
//! 这是灾难性的：意味着我们可以首先固定内容
//!     [`RefCell<T>`] (using <code>[RefCell]::get_pin_mut</code>) and then move that
//! 
//!
//! ### 结构固定示例
//!
//! For a type like [`Vec<T>`], both possibilities (structural pinning or not) make
//! sense. A [`Vec<T>`] with structural pinning could have `get_pin`/`get_pin_mut`
//! methods to get pinning references to elements. However, it could *not* allow calling
//! [`pop`][Vec::pop] on a pinned [`Vec<T>`] because that would move the (structurally
//! pinned) contents! Nor could it allow [`push`][Vec::push], which might reallocate and thus also
//! move the contents.
//!
//! A [`Vec<T>`] without structural pinning could
//! <code>impl\<T> [Unpin] for [`Vec<T>`]</code>, because the contents are never pinned
//! and the [`Vec<T>`] itself is fine with being moved as well.
//! At that point pinning just has no effect on the vector at all.
//!
//! 。对指针类型这样做是有意义的，因为移动
//! and thus they do not offer pinning projections. This is why <code>[`Box<T>`]: [Unpin]</code>
//! holds for all `T`. It makes sense to do this for pointer types, because moving the
//! [`Box<T>`] does not actually move the `T`: the [`Box<T>`] can be freely
//! movable (aka [`Unpin`]) even if the `T` is not. In fact, even <code>[Pin]<[`Box<T>`]></code> and
//! <code>[Pin]<[`&mut T`]></code> are always [`Unpin`] themselves, for the same reason:
//! their contents (the `T`) are pinned, but the pointers themselves can be moved without moving
//! the pinned data. For both [`Box<T>`] and <code>[Pin]<[`Box<T>`]></code>,
//! whether the content is pinned is entirely independent of whether the
//! pointer is pinned, meaning pinning is *not* structural.
//!
//! When implementing a [`Future`] combinator, you will usually need structural pinning
//! for the nested futures, as you need to get pinning ([`Pin`]-wrapped) references to them to
//! call [`poll`]. But if your combinator contains any other data that does not need to be pinned,
//! you can make those fields not structural and hence freely access them with a
//! mutable reference even when you just have <code>[Pin]<[`&mut Self`]></code>
//! (such as in your own [`poll`] implementation).
//!
//! [`&mut T`]: &mut
//! [`&mut self`]: &mut
//! [`&mut Self`]: &mut
//! [`&mut Field`]: &mut
//! [Deref]: crate::ops::Deref "ops::Deref"
//! [`Deref`]: crate::ops::Deref "ops::Deref"
//! [Target]: crate::ops::Deref::Target "ops::Deref::Target"
//! [`DerefMut`]: crate::ops::DerefMut "ops::DerefMut"
//! [`mem::swap`]: crate::mem::swap "mem::swap"
//! [`mem::forget`]: crate::mem::forget "mem::forget"
//! [ManuallyDrop]: crate::mem::ManuallyDrop "ManuallyDrop"
//! [RefCell]: crate::cell::RefCell "cell::RefCell"
//! [`drop`]: Drop::drop
//! [`ptr::write`]: crate::ptr::write "ptr::write"
//! [`Future`]: crate::future::Future "future::Future"
//! [drop-impl]: #drop-implementation
//! [drop-guarantee]: #drop-guarantee
//! [`poll`]: crate::future::Future::poll "future::Future::poll"
//! [&]: reference "shared reference"
//! [&mut]: reference "mutable reference"
//! [`unsafe`]: ../../std/keyword.unsafe.html "keyword unsafe"
//! [packed]: https://doc.rust-lang.org/nomicon/other-reprs.html#reprpacked
//! [`std::alloc`]: ../../std/alloc/index.html
//! [`Box<T>`]: ../../std/boxed/struct.Box.html
//! [Box]: ../../std/boxed/struct.Box.html "Box"
//! [`Box`]: ../../std/boxed/struct.Box.html "Box"
//! [`Rc<T>`]: ../../std/rc/struct.Rc.html
//! [Rc]: ../../std/rc/struct.Rc.html "rc::Rc"
//! [`Vec<T>`]: ../../std/vec/struct.Vec.html
//! [Vec]: ../../std/vec/struct.Vec.html "Vec"
//! [`Vec`]: ../../std/vec/struct.Vec.html "Vec"
//! [`Vec::set_len`]: ../../std/vec/struct.Vec.html#method.set_len "Vec::set_len"
//! [Vec::pop]: ../../std/vec/struct.Vec.html#method.pop "Vec::pop"
//! [Vec::push]: ../../std/vec/struct.Vec.html#method.push "Vec::push"
//! [`Vec::set_len`]: ../../std/vec/struct.Vec.html#method.set_len
//! [`VecDeque<T>`]: ../../std/collections/struct.VecDeque.html
//! [VecDeque]: ../../std/collections/struct.VecDeque.html "collections::VecDeque"
//! [`String`]: ../../std/string/struct.String.html "String"

#![stable(feature = "pin", since = "1.33.0")]

use crate::hash::{Hash, Hasher};
use crate::ops::{CoerceUnsized, Deref, DerefMut, DerefPure, DispatchFromDyn, LegacyReceiver};
#[allow(unused_imports)]
use crate::{
    cell::{RefCell, UnsafeCell},
    future::Future,
    marker::PhantomPinned,
    mem, ptr,
};
use crate::{cmp, fmt};

mod unsafe_pinned;

#[unstable(feature = "unsafe_pinned", issue = "125735")]
pub use self::unsafe_pinned::UnsafePinned;

/// 一个将被指向的值固定位置的指针
///
/// [`Pin`] is a wrapper around some kind of pointer `Ptr` which makes that pointer "pin" its
/// 被指向值的位置，从而防止该指针所引用的值在内存中被移动或破坏
/// or otherwise invalidated at that place in memory unless it implements [`Unpin`].
///
/// *See the [`pin` module] documentation for a more thorough exploration of pinning.*
///
/// ## Pinning values with [`Pin<Ptr>`]
///
/// In order to pin a value, we wrap a *pointer to that value* (of some type `Ptr`) in a
/// [`Pin<Ptr>`]. [`Pin<Ptr>`] can wrap any pointer type, forming a promise that the **pointee**
/// 不会被 *移动* 或 [其他方式破坏][subtle-details]。如果被指向值的类型
/// implements [`Unpin`], we are free to disregard these requirements entirely and can wrap any
/// pointer to that value in [`Pin`] directly via [`Pin::new`]. If the pointee value's type does
/// not implement [`Unpin`], then Rust will not let us use the [`Pin::new`] function directly and
/// we'll need to construct a [`Pin`]-wrapped pointer in one of the more specialized manners
/// 来使用它
///
/// We call such a [`Pin`]-wrapped pointer a **pinning pointer** (or pinning ref, or pinning
/// [`Box`], etc.) because its existence is the thing that is pinning the underlying pointee in
/// 位置
///
/// It is important to stress that the thing in the [`Pin`] is not the value which we want to pin
/// itself, but rather a pointer to that value! A [`Pin<Ptr>`] does not pin the `Ptr` but rather
/// 指针的 ***被指向值***。
///
/// 需要固定相关保证以确保正确性的最常见类型集合是
/// compiler-generated state machines that implement [`Future`] for the return value of
/// `async fn`s. These compiler-generated [`Future`]s may contain self-referential pointers, one
/// of the most common use cases for [`Pin`]. More details on this point are provided in the
/// [`pin` module] docs, but suffice it to say they require the guarantees provided by pinning to
/// be implemented soundly.
///
/// This requirement for the implementation of `async fn`s means that the [`Future`] trait
/// requires all calls to [`poll`] to use a <code>self: [Pin]\<&mut Self></code> parameter instead
/// of the usual `&mut self`. Therefore, when manually polling a future, you will need to pin it
/// 首先。
///
/// You may notice that `async fn`-sourced [`Future`]s are only a small percentage of all
/// [`Future`]s that exist, yet we had to modify the signature of [`poll`] for all [`Future`]s
/// to accommodate them. This is unfortunate, but there is a way that the language attempts to
/// alleviate the extra friction that this API choice incurs: the [`Unpin`] trait.
///
/// 绝大多数 Rust 类型没有理由关心被固定。这些
/// types implement the [`Unpin`] trait, which entirely opts all values of that type out of
/// pinning-related guarantees. For values of these types, pinning a value by pointing to it with a
/// [`Pin<Ptr>`] will have no actual effect.
///
/// The reason this distinction exists is exactly to allow APIs like [`Future::poll`] to take a
/// [`Pin<Ptr>`] as an argument for all types while only forcing [`Future`] types that actually
/// care about pinning guarantees pay the ergonomics cost. For the majority of [`Future`] types
/// that don't have a reason to care about being pinned and therefore implement [`Unpin`], the
/// <code>[Pin]\<&mut Self></code> will act exactly like a regular `&mut Self`, allowing direct
/// access to the underlying value. Only types that *don't* implement [`Unpin`] will be restricted.
///
/// ### Pinning a value of a type that implements [`Unpin`]
///
/// If the type of the value you need to "pin" implements [`Unpin`], you can trivially wrap any
/// pointer to that value in a [`Pin`] by calling [`Pin::new`].
///
/// ```
/// use std::pin::Pin;
///
/// // Create a value of a type that implements `Unpin`
/// let mut unpin_future = std::future::ready(5);
///
/// // Pin it by creating a pinning mutable reference to it (ready to be `poll`ed!)
/// let my_pinned_unpin_future: Pin<&mut _> = Pin::new(&mut unpin_future);
/// ```
///
/// ### Pinning a value inside a [`Box`]
///
/// The simplest and most flexible way to pin a value that does not implement [`Unpin`] is to put
/// that value inside a [`Box`] and then turn that [`Box`] into a "pinning [`Box`]" by wrapping it
/// in a [`Pin`]. You can do both of these in a single step using [`Box::pin`]. Let's see an
/// example of using this flow to pin a [`Future`] returned from calling an `async fn`, a common
/// use case as described above.
///
/// ```
/// use std::pin::Pin;
///
/// async fn add_one(x: u32) -> u32 {
///     x + 1
/// }
///
/// // Call the async function to get a future back
/// let fut = add_one(42);
///
/// // Pin the future inside a pinning box
/// let pinned_fut: Pin<Box<_>> = Box::pin(fut);
/// ```
///
/// If you have a value which is already boxed, for example a [`Box<dyn Future>`][Box], you can pin
/// that value in-place at its current memory address using [`Box::into_pin`].
///
/// ```
/// use std::pin::Pin;
/// use std::future::Future;
///
/// async fn add_one(x: u32) -> u32 {
///     x + 1
/// }
///
/// fn boxed_add_one(x: u32) -> Box<dyn Future<Output = u32>> {
///     Box::new(add_one(x))
/// }
///
/// let boxed_fut = boxed_add_one(42);
///
/// // Pin the future inside the existing box
/// let pinned_fut: Pin<Box<_>> = Box::into_pin(boxed_fut);
/// ```
///
/// There are similar pinning methods offered on the other standard library smart pointer types
/// as well, like [`Rc`] and [`Arc`].
///
/// ### Pinning a value on the stack using [`pin!`]
///
/// There are some situations where it is desirable or even required (for example, in a `#[no_std]`
/// context where you don't have access to the standard library or allocation in general) to
/// pin a value which does not implement [`Unpin`] to its location on the stack. Doing so is
/// possible using the [`pin!`] macro. See its documentation for more.
///
/// ## Layout and ABI
///
/// [`Pin<Ptr>`] is guaranteed to have the same memory layout and ABI[^noalias] as `Ptr`.
///
/// [^noalias]: There is a bit of nuance here that is still being decided about whether the
/// aliasing semantics of `Pin<&mut T>` should be different than `&mut T`, but this is true as of
/// today.
///
/// [`pin!`]: crate::pin::pin "pin!"
/// [`Future`]: crate::future::Future "Future"
/// [`poll`]: crate::future::Future::poll "Future::poll"
/// [`Future::poll`]: crate::future::Future::poll "Future::poll"
/// [`pin` module]: self "pin module"
/// [`Rc`]: ../../std/rc/struct.Rc.html "Rc"
/// [`Arc`]: ../../std/sync/struct.Arc.html "Arc"
/// [Box]: ../../std/boxed/struct.Box.html "Box"
/// [`Box`]: ../../std/boxed/struct.Box.html "Box"
/// [`Box::pin`]: ../../std/boxed/struct.Box.html#method.pin "Box::pin"
/// [`Box::into_pin`]: ../../std/boxed/struct.Box.html#method.into_pin "Box::into_pin"
/// [subtle-details]: self#subtle-details-and-the-drop-guarantee "pin subtle details"
/// [`unsafe`]: ../../std/keyword.unsafe.html "keyword unsafe"
//
// Note: the `Clone` derive below is sound because either `Ptr: PinSafePointer`
// or the pointee is `Unpin`.
#[stable(feature = "pin", since = "1.33.0")]
#[lang = "pin"]
#[fundamental]
#[repr(transparent)]
#[rustc_pub_transparent]
#[derive(Copy, Clone)]
pub struct Pin<Ptr> {
    pointer: Ptr,
}

// The following implementations aren't derived in order to avoid soundness
// issues. `&self.pointer` should not be accessible to untrusted trait
// implementations.
//
// See <https://internals.rust-lang.org/t/unsoundness-in-pin/11311/73> and the
// `PinSafePointer` trait for more details.

#[stable(feature = "pin_trait_impls", since = "1.41.0")]
impl<Ptr: Deref, Q: Deref> PartialEq<Pin<Q>> for Pin<Ptr>
where
    Ptr::Target: PartialEq<Q::Target>,
{
    fn eq(&self, other: &Pin<Q>) -> bool {
        Ptr::Target::eq(self, other)
    }

    fn ne(&self, other: &Pin<Q>) -> bool {
        Ptr::Target::ne(self, other)
    }
}

#[stable(feature = "pin_trait_impls", since = "1.41.0")]
impl<Ptr: Deref<Target: Eq>> Eq for Pin<Ptr> {}

#[stable(feature = "pin_trait_impls", since = "1.41.0")]
impl<Ptr: Deref, Q: Deref> PartialOrd<Pin<Q>> for Pin<Ptr>
where
    Ptr::Target: PartialOrd<Q::Target>,
{
    fn partial_cmp(&self, other: &Pin<Q>) -> Option<cmp::Ordering> {
        Ptr::Target::partial_cmp(self, other)
    }

    fn lt(&self, other: &Pin<Q>) -> bool {
        Ptr::Target::lt(self, other)
    }

    fn le(&self, other: &Pin<Q>) -> bool {
        Ptr::Target::le(self, other)
    }

    fn gt(&self, other: &Pin<Q>) -> bool {
        Ptr::Target::gt(self, other)
    }

    fn ge(&self, other: &Pin<Q>) -> bool {
        Ptr::Target::ge(self, other)
    }
}

#[stable(feature = "pin_trait_impls", since = "1.41.0")]
impl<Ptr: Deref<Target: Ord>> Ord for Pin<Ptr> {
    fn cmp(&self, other: &Self) -> cmp::Ordering {
        Ptr::Target::cmp(self, other)
    }
}

#[stable(feature = "pin_trait_impls", since = "1.41.0")]
impl<Ptr: Deref<Target: Hash>> Hash for Pin<Ptr> {
    fn hash<H: Hasher>(&self, state: &mut H) {
        Ptr::Target::hash(self, state);
    }
}

impl<Ptr: Deref<Target: Unpin>> Pin<Ptr> {
    /// Constructs a new `Pin<Ptr>` around a pointer to some data of a type that
    /// implements [`Unpin`].
    ///
    /// Unlike `Pin::new_unchecked`, this method is safe because the pointer
    /// `Ptr` dereferences to an [`Unpin`] type, which cancels the pinning guarantees.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::pin::Pin;
    ///
    /// let mut val: u8 = 5;
    ///
    /// // Since `val` doesn't care about being moved, we can safely create a "facade" `Pin`
    /// // which will allow `val` to participate in `Pin`-bound apis  without checking that
    /// // pinning guarantees are actually upheld.
    /// let mut pinned: Pin<&mut u8> = Pin::new(&mut val);
    /// ```
    #[inline(always)]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    #[stable(feature = "pin", since = "1.33.0")]
    pub const fn new(pointer: Ptr) -> Pin<Ptr> {
        // SAFETY: the value pointed to is `Unpin`, and so has no requirements
        // around pinning.
        unsafe { Pin::new_unchecked(pointer) }
    }

    /// Unwraps this `Pin<Ptr>`, returning the underlying pointer.
    ///
    /// Doing this operation safely requires that the data pointed at by this pinning pointer
    /// implements [`Unpin`] so that we can ignore the pinning invariants when unwrapping it.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::pin::Pin;
    ///
    /// let mut val: u8 = 5;
    /// let pinned: Pin<&mut u8> = Pin::new(&mut val);
    ///
    /// // Unwrap the pin to get the underlying mutable reference to the value. We can do
    /// // this because `val` doesn't care about being moved, so the `Pin` was just
    /// // a "facade" anyway.
    /// let r = Pin::into_inner(pinned);
    /// assert_eq!(*r, 5);
    /// ```
    #[inline(always)]
    #[rustc_allow_const_fn_unstable(const_precise_live_drops)]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    #[stable(feature = "pin_into_inner", since = "1.39.0")]
    pub const fn into_inner(pin: Pin<Ptr>) -> Ptr {
        pin.pointer
    }
}

impl<Ptr: Deref> Pin<Ptr> {
    /// Constructs a new `Pin<Ptr>` around a reference to some data of a type that
    /// may or may not implement [`Unpin`].
    ///
    /// If `pointer` dereferences to an [`Unpin`] type, [`Pin::new`] should be used
    /// instead.
    ///
    /// # Safety
    ///
    /// This constructor is unsafe because we cannot guarantee that the data
    /// pointed to by `pointer` is pinned. At its core, pinning a value means making the
    /// guarantee that the value's data will not be moved nor have its storage invalidated until
    /// it gets dropped. For a more thorough explanation of pinning, see the [`pin` module docs].
    ///
    /// If the caller that is constructing this `Pin<Ptr>` does not ensure that the data `Ptr`
    /// points to is pinned, that is a violation of the API contract and may lead to undefined
    /// behavior in later (even safe) operations.
    ///
    /// By using this method, you are also making a promise about several trait
    /// implementations of `Ptr` itself, if they exist. Most importantly, they
    /// must not move out of their `self` arguments: `Pin::as_mut` and
    /// `Pin::as_ref` will call `DerefMut::deref_mut` and `Deref::deref` *on the
    /// pointer type `Ptr`* and expect these methods to uphold the pinning
    /// invariants. These requirements are specified in more detail on the
    /// [`PinSafePointer`] trait, and `Ptr` must abide by the safety
    /// 要求。
    ///
    /// Moreover, by calling this method you promise that the reference `Ptr`
    /// 不会被再次移动出去；特别是，它
    /// must not be possible to obtain a `&mut Ptr::Target` and then
    /// move out of that reference (using, for example [`mem::swap`]).
    ///
    /// For example, calling `Pin::new_unchecked` on an `&'a mut T` is unsafe because
    /// while you are able to pin it for the given lifetime `'a`, you have no control
    /// over whether it is kept pinned once `'a` ends, and therefore cannot uphold the
    /// 一旦固定，值将一直保持固定直到被丢弃的承诺：
    ///
    /// ```
    /// use std::mem;
    /// use std::pin::Pin;
    ///
    /// fn move_pinned_ref<T>(mut a: T, mut b: T) {
    ///     unsafe {
    ///         let p: Pin<&mut T> = Pin::new_unchecked(&mut a);
    ///         // This should mean the pointee `a` can never move again.
    ///     }
    ///     mem::swap(&mut a, &mut b); // Potential UB down the road ⚠️
    ///     // The address of `a` changed to `b`'s stack slot, so `a` got moved even
    ///     // though we have previously pinned it! We have violated the pinning API contract.
    /// }
    /// ```
    /// 一旦固定，值必须保持固定直到被丢弃（除非其类型实现了
    /// `Unpin`). Because `Pin<&mut T>` does not own the value, dropping the `Pin` will not drop
    /// the value and will not end the pinning contract. So moving the value after dropping the
    /// `Pin<&mut T>` is still a violation of the API contract.
    ///
    /// Similarly, calling `Pin::new_unchecked` on an `Rc<T>` is unsafe because there could be
    /// <## Pinning of closure captures
    /// ```
    /// use std::rc::Rc;
    /// use std::pin::Pin;
    ///
    /// fn move_pinned_rc<T>(mut x: Rc<T>) {
    ///     // This should mean the pointee can never move again.
    ///     let pin = unsafe { Pin::new_unchecked(Rc::clone(&x)) };
    ///     {
    ///         let p: Pin<&T> = pin.as_ref();
    ///         // ...
    ///     }
    ///     drop(pin);
    ///
    ///     let content = Rc::get_mut(&mut x).unwrap(); // Potential UB down the road ⚠️
    ///     // Now, if `x` was the only reference, we have a mutable reference to
    ///     // data that we pinned above, which we could use to move it as we have
    ///     // seen in the previous example. We have violated the pinning API contract.
    /// }
    /// ```
    ///
    /// ## Pinning of closure captures
    ///
    /// Particular care is required when using `Pin::new_unchecked` in a closure:
    /// `Pin::new_unchecked(&mut var)` where `var` is a by-value (moved) closure capture
    /// 此闭包捕获的方式都遵守固定规则。
    /// 当将闭包传递给其他 API 时，API 可能随时移动闭包，因此
    /// ```
    /// use std::pin::Pin;
    /// use std::task::Context;
    /// use std::future::Future;
    ///
    /// fn move_pinned_closure(mut x: impl Future, cx: &mut Context<'_>) {
    ///     // Create a closure that moves `x`, and then internally uses it in a pinned way.
    ///     let mut closure = move || unsafe {
    ///         let _ignore = Pin::new_unchecked(&mut x).poll(cx);
    ///     };
    ///     // Call the closure, so the future can assume it has been pinned.
    ///     closure();
    ///     // Move the closure somewhere else. This also moves `x`!
    ///     let mut moved = closure;
    ///     // Calling it again means we polled the future from two different locations,
    ///     // violating the pinning API contract.
    ///     moved(); // Potential UB ⚠️
    /// }
    /// ```
    /// When passing a closure to another API, it might be moving the closure any time, so
    /// `Pin::new_unchecked` on closure captures may only be used if the API explicitly documents
    /// <## Pinning of closure captures
    ///
    /// 更好的替代方法是避免所有麻烦，在外部函数中完成固定操作
    /// instead (here using the [`pin!`][crate::pin::pin] macro):
    /// ```
    /// use std::pin::pin;
    /// use std::task::Context;
    /// use std::future::Future;
    ///
    /// fn move_pinned_closure(mut x: impl Future, cx: &mut Context<'_>) {
    ///     let mut x = pin!(x);
    ///     // Create a closure that captures `x: Pin<&mut _>`, which is safe to move.
    ///     let mut closure = move || {
    ///         let _ignore = x.as_mut().poll(cx);
    ///     };
    ///     // Call the closure, so the future can assume it has been pinned.
    ///     closure();
    ///     // Move the closure somewhere else.
    ///     let mut moved = closure;
    ///     // Calling it again here is fine (except that we might be polling a future that already
    ///     // returned `Poll::Ready`, but that is a separate problem).
    ///     moved();
    /// }
    /// ```
    ///
    /// [`mem::swap`]: crate::mem::swap
    /// [`pin` module docs]: self
    #[lang = "new_unchecked"]
    #[inline(always)]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    #[stable(feature = "pin", since = "1.33.0")]
    pub const unsafe fn new_unchecked(pointer: Ptr) -> Pin<Ptr> {
        Pin { pointer }
    }

    /// Gets a shared reference to the pinned value this [`Pin`] points to.
    ///
    /// This is a generic method to go from `&Pin<Pointer<T>>` to `Pin<&T>`.
    /// It is safe because, as part of the contract of `Pin::new_unchecked`,
    /// the pointee cannot move after `Pin<Pointer<T>>` got created.
    /// "Malicious" implementations of `Pointer::Deref` are likewise
    /// ruled out by the contract of `Pin::new_unchecked`.
    #[stable(feature = "pin", since = "1.33.0")]
    #[inline(always)]
    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    pub const fn as_ref(&self) -> Pin<&Ptr::Target>
    where
        Ptr: [const] Deref,
    {
        // SAFETY: see documentation on this function
        unsafe { Pin::new_unchecked(&*self.pointer) }
    }
}

// These methods being in a `Ptr: DerefMut` impl block concerns semver stability.
// Currently, calling e.g. `.set()` on a `Pin<&T>` sees that `Ptr: DerefMut`
// doesn't hold, and goes to check for a `.set()` method on `T`. But, if the
// `where Ptr: DerefMut` bound is moved to the method, rustc sees the impl block
// as a valid candidate, and doesn't go on to check other candidates when it
// sees that the bound on the method.
impl<Ptr: DerefMut> Pin<Ptr> {
    /// Gets a mutable reference to the pinned value this `Pin<Ptr>` points to.
    ///
    /// This is a generic method to go from `&mut Pin<Pointer<T>>` to `Pin<&mut T>`.
    /// It is safe because, as part of the contract of `Pin::new_unchecked`,
    /// the pointee cannot move after `Pin<Pointer<T>>` got created.
    /// "Malicious" implementations of `Pointer::DerefMut` are likewise
    /// ruled out by the contract of `Pin::new_unchecked`.
    ///
    /// 当多次调用消耗所有权类型的函数时，此方法非常有用。
    /// 固定指针。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::pin::Pin;
    ///
    /// # struct Type {}
    /// impl Type {
    ///     fn method(self: Pin<&mut Self>) {
    ///         // do something
    ///     }
    ///
    ///     fn call_method_twice(mut self: Pin<&mut Self>) {
    ///         // `method` consumes `self`, so reborrow the `Pin<&mut Self>` via `as_mut`.
    ///         self.as_mut().method();
    ///         self.as_mut().method();
    ///     }
    /// }
    /// ```
    #[stable(feature = "pin", since = "1.33.0")]
    #[inline(always)]
    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    pub const fn as_mut(&mut self) -> Pin<&mut Ptr::Target>
    where
        Ptr: [const] DerefMut,
    {
        // SAFETY: see documentation on this function
        unsafe { Pin::new_unchecked(&mut *self.pointer) }
    }

    /// Gets `Pin<&mut T>` to the underlying pinned value from this nested `Pin`-pointer.
    ///
    /// This is a generic method to go from `Pin<&mut Pin<Pointer<T>>>` to `Pin<&mut T>`. It is
    /// safe because the existence of a `Pin<Pointer<T>>` ensures that the pointee, `T`, cannot
    /// move in the future, and this method does not enable the pointee to move. "Malicious"
    /// implementations of `Ptr::DerefMut` are likewise ruled out by the contract of
    /// `Pin::new_unchecked`.
    #[stable(feature = "pin_deref_mut", since = "1.84.0")]
    #[must_use = "`self` will be dropped if the result is not used"]
    #[inline(always)]
    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    pub const fn as_deref_mut(self: Pin<&mut Self>) -> Pin<&mut Ptr::Target>
    where
        Ptr: [const] DerefMut,
    {
        // SAFETY: What we're asserting here is that going from
        //
        //     Pin<&mut Pin<Ptr>>
        //
        // to
        //
        //     Pin<&mut Ptr::Target>
        //
        // is safe.
        //
        // We need to ensure that two things hold for that to be the case:
        //
        // 1) Once we give out a `Pin<&mut Ptr::Target>`, a `&mut Ptr::Target` will not be given out.
        // 2) By giving out a `Pin<&mut Ptr::Target>`, we do not risk violating
        // `Pin<&mut Pin<Ptr>>`
        //
        // The existence of `Pin<Ptr>` is sufficient to guarantee #1: since we already have a
        // `Pin<Ptr>`, it must already uphold the pinning guarantees, which must mean that
        // `Pin<&mut Ptr::Target>` does as well, since `Pin::as_mut` is safe. We do not have to rely
        // on the fact that `Ptr` is _also_ pinned.
        //
        // For #2, we need to ensure that code given a `Pin<&mut Ptr::Target>` cannot cause the
        // `Pin<Ptr>` to move? That is not possible, since `Pin<&mut Ptr::Target>` no longer retains
        // any access to the `Ptr` itself, much less the `Pin<Ptr>`.
        unsafe { self.get_unchecked_mut() }.as_mut()
    }

    /// Assigns a new value to the memory location pointed to by the `Pin<Ptr>`.
    ///
    /// This overwrites pinned data, but that is okay: the original pinned value's destructor gets
    /// # 示例
    /// no pinning invariant is violated. See [the `pin` module documentation][subtle-details]
    /// # 示例
    ///
    /// # Example
    ///
    /// ```
    /// use std::pin::Pin;
    ///
    /// let mut val: u8 = 5;
    /// let mut pinned: Pin<&mut u8> = Pin::new(&mut val);
    /// println!("{}", pinned); // 5
    /// pinned.set(10);
    /// println!("{}", pinned); // 10
    /// ```
    ///
    /// [subtle-details]: self#subtle-details-and-the-drop-guarantee
    #[stable(feature = "pin", since = "1.33.0")]
    #[inline(always)]
    pub fn set(&mut self, value: Ptr::Target)
    where
        Ptr::Target: Sized,
    {
        *(self.pointer) = value;
    }
}

impl<Ptr: Deref> Pin<Ptr> {
    /// Unwraps this `Pin<Ptr>`, returning the underlying `Ptr`.
    ///
    /// # 安全性
    ///
    /// This function is unsafe. You must guarantee that you will continue to
    /// treat the pointer `Ptr` as pinned after you call this function, so that
    /// the invariants on the `Pin` type can be upheld. If the code using the
    /// resulting `Ptr` does not continue to maintain the pinning invariants that
    /// 通过映射内部值构建新的切片。
    /// later (safe) operations.
    ///
    /// Note that you must be able to guarantee that the data pointed to by `Ptr`
    /// will be treated as pinned all the way until its `drop` handler is complete!
    ///
    /// *For more information, see the [`pin` module docs][self]*
    ///
    /// If the underlying data is [`Unpin`], [`Pin::into_inner`] should be used
    /// instead.
    #[inline(always)]
    #[rustc_allow_const_fn_unstable(const_precise_live_drops)]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    #[stable(feature = "pin_into_inner", since = "1.39.0")]
    pub const unsafe fn into_inner_unchecked(pin: Pin<Ptr>) -> Ptr {
        pin.pointer
    }
}

impl<'a, T: ?Sized> Pin<&'a T> {
    /// Constructs a new pin by mapping the interior value.
    ///
    /// For example, if you wanted to get a `Pin` of a field of something,
    /// you could use this to get access to that field in one line of code.
    /// However, there are several gotchas with these "pinning projections";
    /// see the [`pin` module] documentation for further details on that topic.
    ///
    /// # Safety
    ///
    /// This function is unsafe. You must guarantee that the data you return
    /// will not move so long as the argument value does not move (for example,
    /// 因为它是该值的字段之一，同时你也必须这样做。
    /// 不会从你接收的参数中移出到内部函数。
    ///
    /// [`pin` module]: self#projections-and-structural-pinning
    #[stable(feature = "pin", since = "1.33.0")]
    pub unsafe fn map_unchecked<U, F>(self, func: F) -> Pin<&'a U>
    where
        U: ?Sized,
        F: FnOnce(&T) -> &U,
    {
        let pointer = self.pointer;
        let new_pointer = func(pointer);

        // SAFETY: the safety contract for `new_unchecked` must be
        // upheld by the caller.
        unsafe { Pin::new_unchecked(new_pointer) }
    }

    /// 从 pin 中获取共享引用。
    ///
    /// 这是安全的，因为无法将共享引用移出。
    /// 看起来内部可变性存在问题：实际上，
    /// it *is* possible to move a `T` out of a `&RefCell<T>`. However, this is
    /// not a problem as long as there does not also exist a `Pin<&T>` pointing
    /// to the inner `T` inside the `RefCell`, and `RefCell<T>` does not let you get a
    /// `Pin<&T>` pointer to its contents. See the discussion on ["pinning projections"]
    /// 了解详情。
    ///
    /// Note: `Pin` also implements `Deref` to the target, which can be used
    /// to access the inner value. However, `Deref` only provides a reference
    /// that lives for as long as the borrow of the `Pin`, not the lifetime of
    /// the reference contained in the `Pin`. This method allows turning the `Pin` into a reference
    /// with the same lifetime as the reference it wraps.
    ///
    /// ["pinning projections"]: self#projections-and-structural-pinning
    #[inline(always)]
    #[must_use]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    #[stable(feature = "pin", since = "1.33.0")]
    pub const fn get_ref(self) -> &'a T {
        self.pointer
    }
}

impl<'a, T: ?Sized> Pin<&'a mut T> {
    /// Converts this `Pin<&mut T>` into a `Pin<&T>` with the same lifetime.
    #[inline(always)]
    #[must_use = "`self` will be dropped if the result is not used"]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    #[stable(feature = "pin", since = "1.33.0")]
    pub const fn into_ref(self) -> Pin<&'a T> {
        Pin { pointer: self.pointer }
    }

    /// Gets a mutable reference to the data inside of this `Pin`.
    ///
    /// This requires that the data inside this `Pin` is `Unpin`.
    ///
    /// Note: `Pin` also implements `DerefMut` to the data, which can be used
    /// to access the inner value. However, `DerefMut` only provides a reference
    /// that lives for as long as the borrow of the `Pin`, not the lifetime of
    /// the `Pin` itself. This method allows turning the `Pin` into a reference
    /// with the same lifetime as the original `Pin`.
    #[inline(always)]
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "pin", since = "1.33.0")]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    pub const fn get_mut(self) -> &'a mut T
    where
        T: Unpin,
    {
        self.pointer
    }

    /// Gets a mutable reference to the data inside of this `Pin`.
    ///
    /// # Safety
    ///
    /// 此函数是不安全的。你必须确保调用此函数时永远不会将
    /// the data out of the mutable reference you receive when you call this
    /// function, so that the invariants on the `Pin` type can be upheld.
    ///
    /// If the underlying data is `Unpin`, `Pin::get_mut` should be used
    /// 通过映射内部值来构建新的 pin。
    #[inline(always)]
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "pin", since = "1.33.0")]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    pub const unsafe fn get_unchecked_mut(self) -> &'a mut T {
        self.pointer
    }

    /// Constructs a new pin by mapping the interior value.
    ///
    /// For example, if you wanted to get a `Pin` of a field of something,
    /// 然而，这些“pinning projections”存在几个问题；
    /// However, there are several gotchas with these "pinning projections";
    /// see the [`pin` module] documentation for further details on that topic.
    ///
    /// # 此函数是不安全的。你必须确保返回的数据不会移出可变的引用。
    ///
    /// This function is unsafe. You must guarantee that the data you return
    /// 不会移动，只要参数值不移动（例如，
    /// 因为它是该值的字段之一），同时你也
    /// 不会将接收的参数移出到内部函数。
    ///
    /// [`pin` module]: self#projections-and-structural-pinning
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "pin", since = "1.33.0")]
    pub unsafe fn map_unchecked_mut<U, F>(self, func: F) -> Pin<&'a mut U>
    where
        U: ?Sized,
        F: FnOnce(&mut T) -> &mut U,
    {
        // SAFETY: the caller is responsible for not moving the
        // value out of this reference.
        let pointer = unsafe { Pin::get_unchecked_mut(self) };
        let new_pointer = func(pointer);
        // SAFETY: as the value of `this` is guaranteed to not have
        // been moved out, this call to `new_unchecked` is safe.
        unsafe { Pin::new_unchecked(new_pointer) }
    }
}

impl<T: ?Sized> Pin<&'static T> {
    /// Gets a pinning reference from a `&'static` reference.
    ///
    /// This is safe because `T` is borrowed immutably for the `'static` lifetime, which
    /// 永远不会结束。
    #[stable(feature = "pin_static_ref", since = "1.61.0")]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    pub const fn static_ref(r: &'static T) -> Pin<&'static T> {
        // SAFETY: The 'static borrow guarantees the data will not be
        // moved/invalidated until it gets dropped (which is never).
        unsafe { Pin::new_unchecked(r) }
    }
}

impl<T: ?Sized> Pin<&'static mut T> {
    /// 从静态可变引用获得一个固定可变引用。
    ///
    /// This is safe because `T` is borrowed for the `'static` lifetime, which
    /// 永远不会结束。
    #[stable(feature = "pin_static_ref", since = "1.61.0")]
    #[rustc_const_stable(feature = "const_pin", since = "1.84.0")]
    pub const fn static_mut(r: &'static mut T) -> Pin<&'static mut T> {
        // SAFETY: The 'static borrow guarantees the data will not be
        // moved/invalidated until it gets dropped (which is never).
        unsafe { Pin::new_unchecked(r) }
    }
}

#[stable(feature = "pin", since = "1.33.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<Ptr: [const] Deref> Deref for Pin<Ptr> {
    type Target = Ptr::Target;
    fn deref(&self) -> &Ptr::Target {
        Pin::get_ref(Pin::as_ref(self))
    }
}

mod helper {
    /// Helper that prevents downstream crates from implementing `DerefMut` for `Pin`.
    ///
    /// The `Pin` type implements the unsafe trait `PinSafePointer`, which essentially requires
    /// that the type does not have a malicious `Deref` or `DerefMut` impl. However, without this
    /// helper module, downstream crates are able to write `impl DerefMut for Pin<LocalType>` as
    /// long as it does not overlap with the impl provided by stdlib. This is because `Pin` is
    /// `#[fundamental]`, so stdlib promises to never implement traits for `Pin` that it does not
    /// implement today.
    ///
    /// However, this is problematic. Downstream crates could implement `DerefMut` for
    /// `Pin<&LocalType>`, and they could do so maliciously. To prevent this, the implementation for
    /// `Pin` delegates to this helper module. Since `helper::Pin` is not `#[fundamental]`, the
    /// orphan rules assume that stdlib might implement `helper::DerefMut` for `helper::Pin<&_>` in
    /// the future. Because of this, downstream crates can no longer provide an implementation of
    /// `DerefMut` for `Pin<&_>`, as it might overlap with a trait impl that, according to the
    /// orphan rules, the stdlib could introduce without a breaking change in a future release.
    ///
    /// See <https://github.com/rust-lang/rust/issues/85099> for the issue this fixes.
    #[repr(transparent)]
    #[unstable(feature = "pin_derefmut_internals", issue = "none")]
    #[allow(missing_debug_implementations)]
    pub struct PinHelper<Ptr> {
        pointer: Ptr,
    }

    #[unstable(feature = "pin_derefmut_internals", issue = "none")]
    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    #[rustc_diagnostic_item = "PinDerefMutHelper"]
    pub const trait PinDerefMutHelper {
        type Target: ?Sized;
        fn deref_mut(&mut self) -> &mut Self::Target;
    }

    #[unstable(feature = "pin_derefmut_internals", issue = "none")]
    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    const impl<Ptr: [const] super::DerefMut> PinDerefMutHelper for PinHelper<Ptr>
    where
        Ptr::Target: crate::marker::Unpin,
    {
        type Target = Ptr::Target;

        #[inline(always)]
        fn deref_mut(&mut self) -> &mut Ptr::Target {
            &mut self.pointer
        }
    }
}

#[stable(feature = "pin", since = "1.33.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
#[cfg(not(doc))]
const impl<Ptr> DerefMut for Pin<Ptr>
where
    Ptr: [const] Deref,
    helper::PinHelper<Ptr>: [const] helper::PinDerefMutHelper<Target = Self::Target>,
{
    #[inline]
    fn deref_mut(&mut self) -> &mut Ptr::Target {
        // SAFETY: Pin and PinHelper have the same layout, so this is equivalent to
        // `&mut self.pointer` which is safe because `Target: Unpin`.
        helper::PinDerefMutHelper::deref_mut(unsafe {
            &mut *(self as *mut Pin<Ptr> as *mut helper::PinHelper<Ptr>)
        })
    }
}

/// The `Target` type is restricted to `Unpin` types as it's not safe to obtain a mutable reference
/// to a pinned value.
///
/// For soundness reasons, implementations of `DerefMut` for `Pin<T>` are rejected even when `T` is
/// a local type not covered by this impl block. (Since `Pin` is [fundamental], such implementations
/// would normally be possible.)
///
/// [fundamental]: ../../reference/items/implementations.html#r-items.impl.trait.fundamental
#[stable(feature = "pin", since = "1.33.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
#[cfg(doc)]
const impl<Ptr> DerefMut for Pin<Ptr>
where
    Ptr: [const] DerefMut,
    <Ptr as Deref>::Target: Unpin,
{
    fn deref_mut(&mut self) -> &mut Ptr::Target {
        Pin::get_mut(Pin::as_mut(self))
    }
}

#[unstable(feature = "deref_pure_trait", issue = "87121")]
unsafe impl<Ptr: DerefPure> DerefPure for Pin<Ptr> {}

#[unstable(feature = "legacy_receiver_trait", issue = "none")]
impl<Ptr: LegacyReceiver> LegacyReceiver for Pin<Ptr> {}

// The following implementations allow untrusted trait implementations to access
// `&self.pointer`, which is only sound because these traits are mentioned in
// the safety requirements of `PinSafePointer`.

#[stable(feature = "pin", since = "1.33.0")]
impl<Ptr: fmt::Debug> fmt::Debug for Pin<Ptr> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.pointer, f)
    }
}

#[stable(feature = "pin", since = "1.33.0")]
impl<Ptr: fmt::Display> fmt::Display for Pin<Ptr> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.pointer, f)
    }
}

#[stable(feature = "pin", since = "1.33.0")]
impl<Ptr: fmt::Pointer> fmt::Pointer for Pin<Ptr> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Pointer::fmt(&self.pointer, f)
    }
}

// Note: this means that any impl of `CoerceUnsized` that allows coercing from
// a type that impls `Deref<Target=impl !Unpin>` to a type that impls
// `Deref<Target=Unpin>` is unsound. Any such impl would probably be unsound
// for other reasons, though, so we just need to take care not to allow such
// impls to land in std.
#[stable(feature = "pin", since = "1.33.0")]
impl<Ptr, U> CoerceUnsized<Pin<U>> for Pin<Ptr>
where
    Ptr: CoerceUnsized<U> + PinSafePointer,
    U: PinSafePointer,
{
}

#[stable(feature = "pin", since = "1.33.0")]
impl<Ptr, U> DispatchFromDyn<Pin<U>> for Pin<Ptr>
where
    Ptr: DispatchFromDyn<U> + PinSafePointer,
    U: PinSafePointer,
{
}

#[unstable(feature = "pin_coerce_unsized_trait", issue = "150112")]
/// Trait that indicates that this is a pointer that does not misbehave when
/// combined with [`Pin`].
///
/// Note that for backwards compatibility reasons, it is possible to create a
/// [`Pin<P>`] for pointer types `P` that do not implement this trait. However,
/// this can only be done safely if `<P as Deref>::Target` implements `Unpin`,
/// 这意味着固定指针没有任何效果。
///
/// # 安全性
///
/// 实现此 trait 的类型不得提供“恶意”的实现形式，
/// of any safe traits used by [`Pin`].
///
/// ## 指针必须始终指向同一个对象
///
/// Calls to [`deref`]/[`deref_mut`] on the same `Pin<P>` instance must always
/// 指向同一个对象。也就是说，这些方法返回的地址
/// 不得改变。即使指针类型被移动，也是如此。
///
/// 这些强制转换也必须不改变底层具体类型。这里，
/// trait 对象的具体类型是 vtable 对应的类型。
/// 切片的具体类型是一个包含相同元素类型的数组，其长度由元数据指定。有大小的类型的具体类型就是
/// 该类型本身。
/// type itself.
///
/// As an example, after unsizing coercing a pinned pointer, `deref_mut` must
/// not return a `#[repr(transparent)]` wrapper around the value it referenced
/// ## 指针不得移动其目标值
///
/// ## The pointer must not move its pointee
///
/// The [`deref_mut`] method and the pointer type's destructor are called with a
/// `&mut self` receiver, but they must behave as-if it was a `self: Pin<&mut
/// Self>` receiver. That is, they must not move out of the underlying value.
///
/// As an example, `deref_mut` must not invoke `swap` on the inner value.
///
/// ## Shared access to the pointer
///
/// If this pointer type uses `&P` references as evidence that this value is not
/// pinned, then it must not treat the `&self` argument passed to [`Clone`] or
/// the formatting traits ([`fmt::Debug`], [`fmt::Display`], [`fmt::Pointer`])
/// as such evidence.
///
/// As an example, given a `Pin<Arc<T>>` there is no way to obtain an `&Arc<T>`
/// (note that `Deref` just gives a `&T`). Because of this, the [`Arc`] type can
/// assume that an `&Arc<T>` value can only exist if the `T` is not pinned,
/// which justifies the soundness of the [`Arc::get_mut`] method.
///
/// ## Cloning pinned pointers
///
/// When a [`Pin<P>`] is cloned, the `P` pointer value returned by `clone` is
/// passed to [`Pin::new_unchecked`]. The implementation of [`Clone`] must
/// return a value such that this is sound.
///
/// For example, when a `Pin<&T>` is cloned, the resulting `&T` points at the
/// same value. The value is known to be pinned since a `Pin<&T>` to it exists,
/// so it is safe to wrap the `&T` returned by `clone` in `Pin`.
///
/// [`deref`]: Deref::deref
/// [`deref_mut`]: DerefMut::deref_mut
/// [`clone`]: Clone::clone
/// [`Arc`]: ../../std/sync/struct.Arc.html "Arc"
/// [`Arc::get_mut`]: ../../std/sync/struct.Arc.html#method.get_mut "Arc::get_mut"
pub unsafe trait PinSafePointer: Deref + Sized {}

// A pointer can only be pin safe if it does not implement certain safe traits
// maliciously. Since `&T` is fundamental, downstream crates may be able to
// implement those traits for `&LocalType`, so we must carefully check that
// this is not a problem for each trait.
//
// The `&T` type always implements [`Deref`] and [`Clone`], so despite being
// fundamental, downstream crates cannot implement these traits for
// `&LocalType`.
//
// The `&T` type has a negative blanket implementations for [`DerefMut`], so
// downstream crates cannot implement `DerefMut` for `&LocalType`.
//
// Conversely, downstream crates are able to implement `Debug` and `Display` for
// `&LocalType` as long as `LocalType` does not implement said trait. However,
// the existence of an `&&T` cannot be treated as evidence that the `T` is not
// pinned, so this is not problematic.
#[stable(feature = "pin", since = "1.33.0")]
unsafe impl<'a, T: ?Sized> PinSafePointer for &'a T {}

// A pointer can only be pin safe if it does not implement certain safe traits
// maliciously. Since `&mut T` is fundamental, downstream crates may be able to
// implement those traits for `&mut LocalType`, so we must carefully check that
// this is not a problem for each trait.
//
// The `&mut T` type always implements [`Deref`] and [`DerefMut`], so despite
// being fundamental, downstream crates cannot implement these traits for `&mut
// LocalType`.
//
// The `&mut T` type has a negative blanket implementations for [`Clone`], so
// downstream crates cannot implement `Clone` for `&mut LocalType`.
//
// Conversely, downstream crates are able to implement `Debug` and `Display`
// for `&mut LocalType` as long as `LocalType` does not implement said trait.
// However, the existence of an `&&mut T` cannot be treated as evidence that the
// `T` is not pinned, so this is not problematic.
#[stable(feature = "pin", since = "1.33.0")]
unsafe impl<'a, T: ?Sized> PinSafePointer for &'a mut T {}

// A pointer can only be pin safe if it does not implement certain safe traits
// maliciously. `Pin` implements these traits by forwarding to `P`, which also
// asserts that these implementations are not malicious, so the implementations
// provided by `core` are ok. However, since `Pin<T>` is fundamental,
// downstream crates may be able to implement those traits for `Pin<LocalType>`
// directly, so we must carefully check that if a downstream crate can
// implement these traits for `Pin<LocalType>`, then this does not lead to any
// problems for the `Pin<Pin<LocalType>>` type.
//
// The `Pin<P>` type only implements `Deref` when `P: Deref`, so downstream
// crates can implement `Deref` for `Pin<LocalType>` in cases where `LocalType:
// !Deref`. However, as `Deref` is a super-trait for `PinSafePointer`, we do
// not assert that `Pin<P>` is pin safe in that scenario.
//
// The `Pin<P>` type only implements `DerefMut` when `P: DerefMut` and
// `P::Target: Unpin`, so normally downstream crates would be able to provide
// an implementation of `DerefMut` for `Pin<LocalType>` when `LocalType` does
// not satisfy those conditions. However, a special hack is used to prevent
// such downstream implementations, so this is not a problem. See
// [#145608](https://github.com/rust-lang/rust/pull/145608) for details.
//
// Conversely, downstream crates are able to implement `Clone`, `Debug` and
// `Display` for `Pin<LocalType>` as long as `LocalType` does not implement
// said trait. However, the existence of an `&Pin<P>` cannot be treated as
// evidence that the value is not pinned, so this is not problematic.
//
// Furthermore, in the case of `Clone`, cloning a `Pin<Pin<P>>` will utilize
// `Pin::new_unchecked` to convert from `Pin<P>` to `Pin<Pin<P>>`. However,
// given that the implementation of `Clone` returned a `Pin<P>`, we know that
// the target value is pinned, so this conversion is okay even if `Clone` was
// implemented for `Pin<P>` by a downstream crate.
#[stable(feature = "pin", since = "1.33.0")]
unsafe impl<P: PinSafePointer> PinSafePointer for Pin<P> {}

/// Constructs a <code>[Pin]<[&mut] T></code>, by pinning a `value: T` locally.
///
/// Unlike [`Box::pin`], this does not create a new heap allocation. As explained
/// 元素仍可能位于堆上。
///
/// 此宏执行的局部固定通常被称为“栈”固定。
/// Outside of `async` contexts locals do indeed get stored on the stack. In
/// `async` functions or blocks however, any locals crossing an `.await` point
/// are part of the state captured by the `Future`, and will use the storage of
/// 该存储可以位于堆上或栈上。因此，
/// “局部固定”是更准确的术语。
///
/// If the type of the given value does not implement [`Unpin`], then this macro
/// 以防止移动的方式将值固定在内存中。另一方面，
/// if the type does implement [`Unpin`], <code>[Pin]<[&mut] T></code> behaves
/// like <code>[&mut] T</code>, and operations such as
/// [`mem::replace()`][crate::mem::replace] or [`mem::take()`](crate::mem::take)
/// 将允许值被移动。
/// See [the `Unpin` section of the `pin` module][self#unpin] for details.
///
/// ## 示例
///
/// ### 基本用法
///
/// ```rust
/// # use core::marker::PhantomPinned as Foo;
/// use core::pin::{pin, Pin};
///
/// fn stuff(foo: Pin<&mut Foo>) {
///     // …
///     # let _ = foo;
/// }
///
/// let pinned_foo = pin!(Foo { /* … */ });
/// stuff(pinned_foo);
/// // or, directly:
/// stuff(pin!(Foo { /* … */ }));
/// ```
///
/// ### Manually polling a `Future` (without `Unpin` bounds)
///
/// ```rust
/// use std::{
///     future::Future,
///     pin::pin,
///     task::{Context, Poll},
///     thread,
/// };
/// # use std::{sync::Arc, task::Wake, thread::Thread};
///
/// # /// A waker that wakes up the current thread when called.
/// # struct ThreadWaker(Thread);
/// #
/// # impl Wake for ThreadWaker {
/// #     fn wake(self: Arc<Self>) {
/// #         self.0.unpark();
/// #     }
/// # }
/// #
/// /// Runs a future to completion.
/// fn block_on<Fut: Future>(fut: Fut) -> Fut::Output {
///     let waker_that_unparks_thread = // …
///         # Arc::new(ThreadWaker(thread::current())).into();
///     let mut cx = Context::from_waker(&waker_that_unparks_thread);
///     // Pin the future so it can be polled.
///     let mut pinned_fut = pin!(fut);
///     loop {
///         match pinned_fut.as_mut().poll(&mut cx) {
///             Poll::Pending => thread::park(),
///             Poll::Ready(res) => return res,
///         }
///     }
/// }
/// #
/// # assert_eq!(42, block_on(async { 42 }));
/// ```
///
/// ### With `Coroutine`s
///
/// ```rust
/// #![feature(coroutines)]
/// #![feature(coroutine_trait)]
/// use core::{
///     ops::{Coroutine, CoroutineState},
///     pin::pin,
/// };
///
/// fn coroutine_fn() -> impl Coroutine<Yield = usize, Return = ()> /* not Unpin */ {
///  // Allow coroutine to be self-referential (not `Unpin`)
///  // vvvvvv        so that locals can cross yield points.
///     #[coroutine] static || {
///         let foo = String::from("foo");
///         let foo_ref = &foo; // ------+
///         yield 0;                  // | <- crosses yield point!
///         println!("{foo_ref}"); // <--+
///         yield foo.len();
///     }
/// }
///
/// fn main() {
///     let mut coroutine = pin!(coroutine_fn());
///     match coroutine.as_mut().resume(()) {
///         CoroutineState::Yielded(0) => {},
///         _ => unreachable!(),
///     }
///     match coroutine.as_mut().resume(()) {
///         CoroutineState::Yielded(3) => {},
///         _ => unreachable!(),
///     }
///     match coroutine.resume(()) {
///         CoroutineState::Yielded(_) => unreachable!(),
///         CoroutineState::Complete(()) => {},
///     }
/// }
/// ```
///
/// ## 备注
///
/// Precisely because a value is pinned to local storage, the resulting <code>[Pin]<[&mut] T></code>
/// 引用最终会借用与该块相关的局部变量：无法脱离它。
///
/// 例如，以下代码无法编译：
///
/// ```rust,compile_fail
/// use core::pin::{pin, Pin};
/// # use core::{marker::PhantomPinned as Foo, mem::drop as stuff};
///
/// let x: Pin<&mut Foo> = {
///     let x: Pin<&mut Foo> = pin!(Foo { /* … */ });
///     x
/// }; // <- Foo is dropped
/// stuff(x); // Error: use of dropped value
/// ```
///
/// <details><summary>Error message</summary>
///
/// ```console
/// error[E0716]: temporary value dropped while borrowed
///   --> src/main.rs:9:28
///    |
/// 8  | let x: Pin<&mut Foo> = {
///    |     - borrow later stored here
/// 9  |     let x: Pin<&mut Foo> = pin!(Foo { /* … */ });
///    |                            ^^^^^^^^^^^^^^^^^^^^^ creates a temporary value which is freed while still in use
/// 10 |     x
/// 11 | }; // <- Foo is dropped
///    | - temporary value is freed at the end of this statement
///    |
///    = note: consider using a `let` binding to create a longer lived value
/// ```
///
/// </details>
///
/// This makes [`pin!`] **unsuitable to pin values when intending to _return_ them**. Instead, the
/// 期望将值_未固定_地传递下去，直到被消耗的那一刻，
/// where it is then useful and even sensible to pin the value locally using [`pin!`].
///
/// If you really need to return a pinned value, consider using [`Box::pin`] instead.
///
/// On the other hand, local pinning using [`pin!`] is likely to be cheaper than
/// pinning into a fresh heap allocation using [`Box::pin`]. Moreover, by virtue of not
/// requiring an allocator, [`pin!`] is the main non-`unsafe` `#![no_std]`-compatible [`Pin`]
/// 构造函数。
///
/// [`Box::pin`]: ../../std/boxed/struct.Box.html#method.pin
#[stable(feature = "pin_macro", since = "1.68.0")]
#[rustc_macro_transparency = "semiopaque"]
#[allow_internal_unstable(pin_macro_internals, super_let)]
#[rustc_diagnostic_item = "pin_macro"]
// `super` gets removed by rustfmt
#[rustfmt::skip]
#[diagnostic::opaque]
pub macro pin($value:expr $(,)?) {
    {
        super let mut pinned: $crate::pin::PinMacroHelper<_> = $crate::pin::PinMacroHelper { value: $value };

        // SAFETY: The value is pinned: it is the local above which cannot be named outside this macro.
        //
        // In order to make sure that the above local is passed to the below function call
        // without any coercions in between, we wrap the user-provided value in the
        // `PinMacroHelper` type, which we know doesn't implement `DerefMut`. Without such
        // a wrapper, a user might cause a deref coercion on `&mut pinned`, causing the
        // `Pin::new_unchecked` call to pin the wrong thing, which is unsound.
        // See <https://github.com/rust-lang/rust/issues/153438>.
        //
        // To verify that there are no problematic coercions in the below line, we enumerate
        // the list of all possible kinds of coercions that currently exist in the language,
        // and verify that they can't be used to coerce a `&mut PinMacroHelper<T>` into a
        // `&mut PinMacroHelper<U>` (as enforced by the above type annotation on `pinned`,
        // and the type signature of `pin_new_unchecked_in_helper`), where `T` and `U` are
        // different types:
        //
        // * Subtype coercions: `&mut` is invariant over the type being referenced, so subtype
        //   coercion can only change the lifetime of the `&mut` reference itself, which poses
        //   no problems.
        // * Coercions that change the kind of references/pointers: We have the following kinds
        //   of coercions, none of which can produce a `&mut`: `&mut`-to-`&`, `*mut`-to-`*const`,
        //   `&`-to-`*const`, `&mut`-to-`*mut`.
        // * Deref coercions: Does not apply here, since `PinMacroHelper` does not implement
        //   `Deref` or `DerefMut`. And since `PinMacroHelper` is not a fundamental type, users
        //   cannot add any such implementations to the type.
        // * Unsize coercions: Does not apply here, since unsize coercions can only produce a
        //   reference/pointer to an unsized type, and `PinMacroHelper` is always `Sized`.
        // * Coercions from function items or non-capturing closures to function pointers:
        //   Does not apply here. `&mut _` is not a function item or closure.
        // * Never-to-any coercions: If this coercion applies, then we're in unreachable code,
        //   so whatever we do can't possibly cause unsoundness.
        //
        // Furthermore, if we ever add more kinds of coercions to the language, it seems
        // extremely unlikely that user code would be allowed to define new coercions
        // on a stdlib-defined type such as `PinMacroHelper`.
        //
        // I have not verified whether it is possible to cause a coercion in the `let`
        // statement above, before assigning to the `pinned` variable. However, even if
        // such a coercion were possible, it would not affect the soundness of the macro,
        // since the soundness argument only relies on the type of `pinned` being
        // `PinMacroHelper<_>`, which is enforced by the type annotation.
        unsafe { $crate::pin::pin_new_unchecked_in_helper(&mut pinned) }
    }
}

/// Helper for `pin!` to enforce its type signature.
/// See <https://github.com/rust-lang/rust/issues/153438>.
#[unstable(feature = "pin_macro_internals", issue = "none")]
#[doc(hidden)]
#[expect(missing_debug_implementations, reason = "this type is only used by the `pin!` macro")]
#[rustc_diagnostic_item = "PinMacroHelper"]
pub struct PinMacroHelper<T> {
    pub value: T,
}

/// Helper for `pin!` to enforce its type signature.
/// See <https://github.com/rust-lang/rust/issues/153438>.
///
/// # 安全性
/// 调用此函数具有与调用相同的安全性要求
/// `Pin::new_unchecked` on `&mut pinned.value`
#[unstable(feature = "pin_macro_internals", issue = "none")]
#[doc(hidden)]
#[inline]
pub const unsafe fn pin_new_unchecked_in_helper<'a, T>(
    pinned: &'a mut PinMacroHelper<T>,
) -> Pin<&'a mut T> {
    // SAFETY: Ensured by the caller.
    unsafe { Pin::new_unchecked(&mut pinned.value) }
}
