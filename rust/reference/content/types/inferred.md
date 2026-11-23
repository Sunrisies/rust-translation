<a id="type.inferred"></a>
# 推断类型

<a id="type.inferred.syntax"></a> 
```grammar,types
InferredType -> `_`
```

<a id="type.inferred.intro"></a> 推断类型是指让编译器根据可用的上下文信息来推断出类型。

> [!EXAMPLE]
> The inferred type is often used in generic arguments:
>
> ```rust
> let x: Vec<_> = (0..10).collect();
> ```

<a id="type.inferred.constraint"></a> 无法在项目签名中使用该推断类型。

<!--
  还有什么需要说明的吗？我所知道的唯一文档是 https://rustc-dev-guide.rust-lang.org/type-inference.html。应该对类型推断有更全面的讨论。 -->
