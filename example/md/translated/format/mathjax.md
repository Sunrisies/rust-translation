# MathJax支持

mdBook 提供了可选的数学方程支持，可以通过 [MathJax](https://www.mathjax.org/) 来实现。

要启用 MathJax，你需要在 `output.html` 部分的 `book.toml` 中添加 `mathjax-support` 键。

```toml
[output.html]
mathjax-support = true
```

**注意：** MathJax 常用的分隔符目前尚未被支持。目前无法使用 `$$ ... $$` 作为分隔符，而 `\[ ... \]` 这种分隔符需要额外的反斜杠才能正常工作。希望这一限制能够尽快被解除。

**注意：** 当在 MathJax 块中使用双反斜杠时（例如在 `\begin{cases} \frac 1 2 \\ \frac 3 4 \end{cases}` 这样的命令中），需要再添加两个反斜杠（例如 `\begin{cases} \frac 1 2 \\\\ \frac 3 4
> \end{cases}`）。

### 内联方程
内联方程用 `\\(` 和 `\\)` 来标识。例如，要渲染以下内联方程 \\( \int x dx = \frac{x^2}{2} + C \\)，你可以这样写：
```
\\( \int x dx = \frac{x^2}{2} + C \\)
```

### 块方程
块方程由 `\\[` 和 `\\]` 来界定。以下是方程的渲染方式：

\\[ \mu = \frac{1}{N} \sum_{i=0} x_i \\]

你会这样写：

```bash
\\[ \mu = \frac{1}{N} \sum_{i=0} x_i \\]
```
