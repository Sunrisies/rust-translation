#### `--watcher`

有多种后端用于判断文件是否发生了变化。

* `poll`（默认设置）——通过每秒钟扫描文件系统来检测文件的修改情况。  
* `native`——利用原生操作系统功能在文件发生变化时接收通知。这种方式的开销可能较小，但可靠性不如基于 `poll` 的监控器。更多相关信息请参阅以下Issue：[#383](https://github.com/rust-lang/mdBook/issues/383)、[#1441](https://github.com/rust-lang/mdBook/issues/1441)、[#1707](https://github.com/rust-lang/mdBook/issues/1707)、[#2035](https://github.com/rust-lang/mdBook/issues/2035)、[#2102](https://github.com/rust-lang/mdBook/issues/2102)