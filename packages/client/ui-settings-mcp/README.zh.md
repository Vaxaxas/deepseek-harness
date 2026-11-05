---
description: "Web 客户端插件页上的 MCP 服务器与工具管理设置页：配置、启用/停用、测试探测、重启与查看 MCP 服务器及工具。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-mcp

[English](README.md) | 中文

## 概述

打开侧边栏的**插件**面板并在内置插件配置分组中选择**MCP 服务器与工具**（或从“设置-插件”中的 **MCP** 标签页访问），即可查看、添加、配置、测试、重启并监控 Model Context Protocol (MCP) 服务器及其已发现的工具。页面展示每台服务器的实时连接状态，通过 Remote 订阅状态更新流，允许在线测试（探测）以发现工具定义，支持启用和停用服务器实例，并通过 Settings ConfigEditor 安全持久化服务器配置。

## 目录

- [使用本包](#use-this-package)
- [了解实现细节](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

内置插件配置中的 **MCP 服务器与工具** 卡片打开管理界面。每台服务器显示为带状态感知卡片，展示其连接状态、传输方式（`stdio` 或 `streamable-http`）、来源（`用户配置` 或 `插件注册`）以及工具数量：

- **服务器状态**：已连接、连接中、重连中（包含尝试次数与退避信息）、等待凭据、连接失败（包含诊断错误文本）或已停用。
- **启用/停用切换**：一键开启或关闭已配置的服务器。停用将卸载子实例并从智能体运行时撤回所有已暴露的工具。
- **测试连接（探测）**：通过 Remote（`mcpManager.probe`）测试服务器握手与工具发现，不影响运行中的实例，显示响应耗时与已发现工具名称。
- **重新连接**：立即重置连接与重连预算（`mcpManager.restart`）。
- **添加/编辑服务器**：打开模态对话框配置服务器名称、传输方式、可执行命令、参数、工作目录、环境变量、端点 URL、HTTP 请求头和超时参数。相关值支持 `${credential:REF}` 模板，避免敏感凭据进入配置文件。
- **删除服务器**：在确认后删除已配置的服务器。

-----

<a id="understand-the-implementation"></a>
## 了解实现细节

<details>
<summary>实现内部细节——点击展开</summary>

宿主半侧是一个空的 `apply`，只为让本包占一条 Loader 行，客户端模块系统据此送出浏览器半侧。浏览器半侧通过 `ctx.configForms.get` 绑定 `mcp-manager`（或 `mcp`）命名空间，并通过 `ctx.remote.mcpManager.watch()` 管理实时服务器视图。添加、修改或删除服务器通过 `ConfigForm.mutate()` 对 `servers.<name>` 执行带修订栅栏的原子突变。当宿主协调 volatile 配置时，`dsh-mcp-manager` 挂载或重建实例并广播状态更新。页面在宿主服务管理器命名空间期间注册进插件页的 `plugins.item` slot 与设置的 `settings.plugins.tab` slot。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [ui-plugin-manager](../ui-plugin-manager/README.zh.md)——承载内置插件条目的插件面板。
- [mcp-manager](../../mcp/mcp-manager/README.zh.md)——宿主侧服务器管理器服务。
- [mcp-client](../../mcp/mcp-client/README.zh.md)——逐服务器客户端连接与工具适配器。
- [ui-settings](../ui-settings/README.zh.md)——客户端配置表单与设置镜像。

-----

<a id="model-experience"></a>
## 模型体验

无，本包为浏览器端设置界面，不注册面向模型的上下文或工具。

#### KV Cache 效应

无；本包既不组装也不发送提供商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 由已安装插件直接注册的服务器在设置中保持只读，其配置由贡献该服务器的插件管理。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
