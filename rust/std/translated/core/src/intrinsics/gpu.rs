//! 用于 GPU 目标的内联函数。
//!
//! 本模块中的内联函数旨在在 GPU 目标上使用。
//! 它们可能是特定于目标的，但一般来说 GPU 目标都是相似的。

#![unstable(feature = "gpu_intrinsics", issue = "none")]

/// 返回在 GPU 启动时分配的工作组内存指针。
///
/// 工作组内存是所有线程共享的内存区域，
/// 属于同一个工作组。与其他内存相比访问速度更快，但指针无法
/// 在工作组之外使用，因为指针是在那里获得的。
/// 工作组内存可以静态分配，也可以在编译后分配，当
/// launching a gpu-kernel. `gpu_launch_sized_workgroup_mem` returns the pointer to
/// 在启动时分配的内存的指针。
/// 此内存的大小在 gpu-kernel 的不同启动中可能会有所不同，取决于
/// 启动时指定的内容。
/// 不过，对齐方式由内核在编译时固定。
///
/// 返回的指针是工作组内存区域的起始点，该区域是在
/// 启动时分配的。
/// All calls to `gpu_launch_sized_workgroup_mem` in a workgroup, independent of the
/// generic type, return the same address, so alias the same memory.
/// The returned pointer is aligned by at least the alignment of `T`.
///
/// If `gpu_launch_sized_workgroup_mem` is invoked multiple times with different
/// types that have different alignment, then you may only rely on the resulting
/// pointer having the alignment of `T` after a call to `gpu_launch_sized_workgroup_mem::<T>`
/// 从返回的指针开始到启动当前 gpu-kernel 时指定工作组内存的大小，对该指针进行解引用是安全的。
///
/// # 其他 API
///
/// 该指针从开始（返回的指针）到启动当前 gpu-kernel 时指定的工作组内存大小都是安全的。
/// size of workgroup memory that was specified when launching the current gpu-kernel.
/// This allocated size is not related in any way to `T`.
///
/// # 其他 API
/// CUDA 和 HIP 调用此动态共享内存，由块中的线程共享。
///
/// # OpenCL 和 SYCL 调用此本地内存，由工作组中的线程共享。
///
/// GLSL 调用此共享内存，由工作组中的多次调用共享。
/// DirectX 调用此组共享内存，由线程组中的线程共享。
/// 返回指向 HSA 内核调度包的指针。
/// DirectX calls this groupshared memory, shared between threads in a thread-group.
#[must_use = "returns a pointer that does nothing unless used"]
#[rustc_intrinsic]
#[rustc_nounwind]
#[cfg(any(doc, target_arch = "amdgpu", target_arch = "nvptx64"))]
pub fn gpu_launch_sized_workgroup_mem<T>() -> *mut T;

/// 调度包包含工作组大小、启动大小和其他数据。
///
/// A `gpu-kernel` on amdgpu is always launched through a kernel dispatch packet.
/// The dispatch packet contains the workgroup size, launch size and other data.
/// 内容由 [HSA 平台系统架构规范] 定义，
/// 该规范在 AMD 的 [hsa.h] 中实现。
/// 该内建函数返回一个单位指针，因此 rustc 无需了解数据包结构体。
/// 该指针在程序的整个生命周期内都有效。
///
/// [HSA Platform System Architecture Specification]: https://hsafoundation.com/wp-content/uploads/2021/02/HSA-SysArch-1.2.pdf
/// [hsa.h]: https://github.com/ROCm/rocm-systems/blob/rocm-7.1.0/projects/rocr-runtime/runtime/hsa-runtime/inc/hsa.h#L2959
#[rustc_nounwind]
#[rustc_intrinsic]
#[cfg(any(doc, target_arch = "amdgpu"))]
#[must_use = "returns a pointer that does nothing unless used"]
pub fn amdgpu_dispatch_ptr() -> *const ();
