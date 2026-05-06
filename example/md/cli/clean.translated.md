# 清洁命令

“clean”命令用于删除生成的书籍文件以及其他构建产物。

```bash
mdbook clean
```

#### 指定一个目录

````bash
mdbook clean
```` 命令可以接受一个目录作为参数，用作书籍的根目录，而不是当前的工作目录。

```bash
mdbook clean path/to/book
```

#### `--dest-dir`

`--dest-dir` (`-d`) 这个选项允许你覆盖书籍的输出目录。该目录将会被此命令删除。相对路径是相对于当前目录进行解释的。如果未指定，则默认使用 `book.toml` 中的 `build.build-dir` 键的值，或者使用 `./book` 的值。

```bash
mdbook clean --dest-dir=path/to/book
```

```bash
mdbook clean
```可以表示绝对值，也可以表示相对值。