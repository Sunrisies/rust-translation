# 团队

所有为 Clippy 贡献的人共同构成了该项目。协作与讨论是每个开源项目的核心要素。Clippy 的层级结构非常扁平，各团队主要拥有对代码仓库的额外访问权限。

本文档概述了新成员加入流程、职责以及团队成员的访问权限。

本章中提到的所有常规活动均记录在 [日历仓库] 中。日历文件也可下载：[Clippy.ics]

## Everyone

包括您在内，任何人都可以参与讨论并以其他方式贡献，例如提交 Pull Request。

您还拥有一些分类权，可以通过 `@rustbot` 添加标签并认领问题。请参阅 [使用 @rustbot 标记问题]。

每个人的一条规则是保持健康的工作与生活平衡。当需要时，请休息一下。

## Clippy-贡献者

这是一组定期为 Clippy 做出贡献的人，旨在协助分类工作。

### Duties

该团队的存在是为了让普通成员更容易进行贡献。它不承担任何必须完成的任务。不过，我们希望鼓励该团队的成员参与分类工作，这可能包括：

1. **标记问题**

    对于 `good first issue` 标签的问题，使用 `@rustbot` 订阅该问题并帮助感兴趣的人也是一个好方法，如果他们在评论中提问的话。

2. **关闭重复或已解决的问题**

    当您手动关闭一个问题时，添加简短的说明以解释原因通常是个好主意。

3. **在两周不活动后发送提醒**

    我们努力保持问题分配和 Pull Request 的更新状态。两周后，向拖延者发送友好的提醒是一个好的做法。

    如果作者忙碌或希望放弃某个 PR，您可以使用 `I-inactive-closed` 标签关闭该 PR。如果审查者忙碌，可以将 PR 重新分配给其他人。

    查看 <https://triage.rust-lang.org/triage/rust-lang/rust-Clippy> 以监控 Pull Request。

虽然不属于他们的职责，但鼓励贡献者审查 Pull Request 并在 Zulip 上提供帮助。团队始终感谢这些帮助！

### Membership

如果您已经为 Clippy 贡献了一段时间，我们可能会询问您是否希望加入这个团队。该团队的成员也欢迎推荐他们认为适合加入此小组的人选。

对于该小组而言，没有直接的入职流程。您可以继续从事现有的工作。如果愿意，可以请求有人为您提供指导，可以在 Zulip 上的 Clippy 频道中或通过私信联系项目经理。

如果您在 Clippy 上已不活跃超过三个月，我们可能会将您移入校友群。您随时都可以回来参与。

## Clippy 团队

[Clippy 团队](https://www.rust-lang.org/governance/teams/dev-tools#team-Clippy)负责维护 Clippy。

### Duties

1. **及时回复 PR**

    如果您目前没有时间进行审查，完全没问题。您可以通过评论 `r? clippy` 将 PR 分配给其他成员。

2. **需要休息时请休息**

    您非常宝贵！没有您的参与，Clippy 也不会如此优秀。所以当您需要的时候，可以提前休息一下以恢复精力。

3. **在 Zulip 上及时回应**

    这意味着要在合理的时间内回复，一两天内回复即可。

    如果您回答 Zulip 上的讨论帖并参与我们每两周一次的 Clippy 会议也是很好的。会议日期记录在 [日历仓库] 中。
    

4. **将 Clippy 与 rust-lang/rust 仓库同步**

    这项工作通常由 @flip1995 每两周完成一次。

5. **更新 changelog**

    每次发布都需要在六周后更新 changelog。

### Membership

如果您已经活跃了一段时间，我们可能会联系您，询问您是否愿意参与审查工作，并最终加入 Clippy 团队。

在入职过程中，你会被分配一些拉取请求进行审查。你还将有一位活跃的团队成员作为导师，通过 Zulip 私信保持联系，提供建议和反馈。如果你有任何问题，随时可以提问，这是学习的最佳方式。完成审查后，你可以联系你的导师进行全面审查，并共同将 PR 批准为 r+。

当导师确信你能独立处理审查工作时，他会组织一次非正式的投票，以正式将你加入团队。通常这种投票会获得全票通过。一旦确认你仍然有兴趣加入，你就会被添加到团队中。入职阶段通常需要几周到几个月的时间。

如果你在 Clippy 上处于不活跃状态超过三个月，我们可能会把你移入校友组。欢迎你随时回来。



### 最终评论期 (FCPs)

团队成员可以通过 [`lint-nominated`] 标签或 `@rustbot label +lint-nominated` 方式提名 lints（或其他重大变更）。TriageBot 会在 Zulip 中打开一个讨论线程，其余成员会进行讨论。

虽然任何人都可以对 FCP 投票并提出担忧，即使是非成员也鼓励这样做，但只有团队投票才计入 FCP 的解决情况。

----

FCP 只有在满足以下条件时才能关闭：

1. 有 2 名团队成员接受该 FCP（包括发起者）。2. 经过 1 到 2 周的宽限期。3. 所有担忧都已解决。

如果 FCP 变得过时或未能获得必要的投票来关闭，它也可以被提名在会议中讨论。

[calendar repository]: https://github.com/rust-lang/calendar/blob/main/clippy.toml
[clippy.ics]: https://rust-lang.github.io/calendar/clippy.ics
[labeling with @rustbot]: https://forge.rust-lang.org/triagebot/labeling.html
[`lint-nominated`]: https://github.com/rust-lang/rust-clippy/pulls?q=sort%3Aupdated-desc+is%3Apr+state%3Aopen+label%3Alint-nominated
