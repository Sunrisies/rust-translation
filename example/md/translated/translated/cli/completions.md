# 补全命令

Completions命令用于为一些常见的shell生成自动补全功能。这意味着，当您在shell中输入`mdbook`时，可以按下shell的自动补全键（通常是Tab键），系统可能会显示可用的选项，或者完成部分输入。

首先，需要为你的shell安装这些补全工具：

```bash
# bash
mdbook completions bash > ~/.local/share/bash-completion/completions/mdbook
# oh-my-zsh
mdbook completions zsh > ~/.oh-my-zsh/completions/_mdbook
autoload -U compinit && compinit
```

该命令会为给定的shell环境打印出补全脚本。如需查看支持的shell列表，请运行 `mdbook completions --help`。

放置补全信息的位置取决于你使用的shell以及你的操作系统。如需更多信息，请查阅你所使用的shell的相关文档，了解如何正确地放置脚本。