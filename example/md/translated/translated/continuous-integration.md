# 在持续集成中运行 `mdbook`

有许多服务可供选择，比如[GitHub Actions]或[GitLab CI/CD]，这些服务可以用来自动测试和部署你的应用程序。

以下提供了一些关于如何配置您的服务以运行 mdBook 的一般指南。具体的操作说明可以在 [自动化部署] 维基页面中找到。

[GitHub Actions]: https://docs.github.com/en/actions  
[GitLab CI/CD]: https://docs.gitlab.com/ee/ci/  
[自动化部署]: https://github.com/rust-lang/mdBook/wiki/Automated-Deployment

## 安装mdBook

安装mdBook有几种不同的策略。具体的方法取决于你的需求和偏好。

### 预编译的二进制文件

或许最简单的方法就是使用 [GitHub Releases page][releases] 上提供的预编译二进制文件。  
一个简单的方法就是使用流行的 `curl` CLI 工具来下载可执行文件。

```sh
mkdir bin
curl -sSL https://github.com/rust-lang/mdBook/releases/download/{{ mdbook-version }}/mdbook-{{ mdbook-version }}-x86_64-unknown-linux-gnu.tar.gz | tar -xz --directory=bin
bin/mdbook build
```

关于这种方法的几点考虑：

* 这个过程相对较快，而且不一定需要处理缓存问题。  
* 使用这种方式不需要安装Rust。  
* 如果指定了特定的URL，则需要手动更新脚本以获取新版本。如果你希望固定使用某个版本，这或许是一个优点。不过，有些用户更喜欢在版本发布时自动获取新版本。  
* 你的系统是否依赖于GitHub的CDN服务。

[版本发布]: https://github.com/rust-lang/mdBook/releases

### 从源代码构建

从源代码构建需要安装Rust。
一些服务已经预装了Rust，但如果您的服务没有预装，则需要添加安装Rust的步骤。

在安装了Rust之后，可以使用 `cargo install` 来构建和安装mdBook。我们建议使用SemVer版本标识，这样你就能得到最新且**不可打断字**的mdBook版本。例如：

```sh
cargo install mdbook --no-default-features --features search --vers "^0.4" --locked
```

这包括几个推荐的选项：

* `--no-default-features` --- 禁用如 `mdbook serve` 所使用的 HTTP 服务器等功能，这些功能在持续集成环境中可能并不必要。这样做可以显著缩短构建时间。  
* `--features search` --- 禁用默认功能意味着您需要手动启用自己需要的功能，例如内置的 [搜索] 功能。  
* `--vers "^0.4"` --- 这将安装 `0.4` 系列的最新版本。不过，像 `0.5.0` 之后的版本不会被安装，因为这些版本可能会破坏您的构建过程。如果您已经安装了较旧的版本，Cargo 会自动升级 mdBook。  
* `--locked` --- 这将使用在 mdBook 发布时使用的依赖项。如果没有 `--locked`，则会使用所有依赖项的最新版本，这些版本可能包含一些修复程序，但也可能会（偶尔）导致构建问题。

您可能需要考虑使用缓存选项，因为构建 mdBook 的过程可能会比较慢。

[搜索]: guide/reading.md#搜索

## 运行测试

您可能希望每次推送更改或创建拉取请求时，都使用 [`mdbook test`] 来运行测试。这可以用来验证书中使用的 Rust 代码示例。

这需要安装Rust。
有些服务已经预装了Rust，但如果你的服务没有预装，就需要添加一个安装Rust的步骤。

除了确保安装了正确版本的Rust之外，除了从书籍目录中运行 `mdbook test` 之外，并没有太多需要做的事情。

您还可以考虑运行其他类型的测试，比如[mdbook-linkcheck]，它可以检查链接是否失效。另外，如果您有自己开发的样式检查工具、拼写检查器或其他测试工具，那么在持续集成过程中运行这些工具也是不错的做法。

[`mdbook test`]: cli/test.md  
[mdbook-linkcheck]: https://github.com/Michael-F-Bryan/mdbook-linkcheck#continuous-integration

## 部署

您可能希望自动部署您的书籍。有些人可能希望在每次推送更改时都进行部署，而其他人则可能只希望在特定版本发布时才进行部署。

您还需要了解如何将更改推送到您的Web服务中。例如，[GitHub Pages]只需要将输出文件提交到特定的Git分支上。其他服务可能需要使用类似SSH的工具来连接到远程服务器。

基本流程是，你需要运行 `mdbook build` 来生成输出结果，然后将文件（位于 `book` 目录中）传输到正确的位置。

那么，您可能需要考虑是否需要使您的Web服务上的任何缓存失效。

请查看[自动化部署] Wiki页面，了解各种不同服务的示例。

[GitHub Pages]: https://docs.github.com/en/pages

### 处理404错误

mdBook会自动生成一个404页面，用于处理失效的链接。默认情况下，该文件会被保存在书的根目录下，文件名为 `404.html`。一些服务，如[GitHub Pages]，会自动使用这个页面来处理失效的链接。对于其他服务，您可以考虑配置Web服务器使用这个页面，因为它可以为读者提供返回书籍的导航路径。

如果您的书籍没有部署在域名的根目录下，那么您应该设置[`output.html.site-url`]这一选项，以确保404页面能够正常显示。系统需要知道书籍的部署位置，这样才能正确加载静态文件（如CSS文件）。例如，本指南的部署地址是 <https://rust-lang.github.io/mdBook/>，而 `site-url` 这一选项的配置如下：

```toml
# book.toml
[output.html]
site-url = "/mdBook/"
```

您可以通过在您的书籍中创建一个名为 `src/404.md` 的文件来自定义 404 页面的外观。如果您想使用不同的文件名，可以将 [`output.html.input-404`] 设置为不同的文件名。

[`output.html.site-url`]: format/configuration/renderers.md#html-renderer-options
[`output.html.input-404`]: format/configuration/renderers.md#html-renderer-options