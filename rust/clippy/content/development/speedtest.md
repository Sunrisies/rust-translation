# Speedtest `SPEEDTEST` 是我们用来测量代码lint性能的工具，其工作原理是多次执行相同的测试。

它有助于评估当前 lint 的变化情况，并判断性能是否发生了显著变化。`SPEEDTEST` 通过 `SPEEDTEST`（以及 `SPEEDTEST_*`）环境变量来访问。

## 检查 Speedtest

要对某个 lint（例如 `allow_attributes`）进行简单的速度测试，请使用以下命令。

```sh
$ SPEEDTEST=ui TESTNAME="allow_attributes" cargo uitest
```

这将对所有名称以 `allow_attributes` 开头的 `ui` 测试（`SPEEDTEST=ui`）进行测试。默认情况下，`SPEEDTEST` 会遍历您的测试 1000 次。但您可以通过 `SPEEDTEST_ITERATIONS` 参数来更改此数值。

```sh
$ SPEEDTEST=toml SPEEDTEST_ITERATIONS=100 TESTNAME="semicolon_block" cargo uitest
```
