---
navigation.title: 'Dev Containers'
title: 开发容器
description: 在开发容器中设置或打开 Nuxt 项目，以创建一致的开发环境。
---

## 设置开发容器

如果您正在启动一个新的 Nuxt 项目，并希望在开发容器中开发，可以自行添加配置。

::read-more{to="https://code.visualstudio.com/docs/devcontainers/containers" target="_blank"}
了解更多关于开发容器的信息
::

### 先决条件

- [Visual Studio Code](https://code.visualstudio.com/) 及 [Dev Containers 扩展](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 或 [Docker Engine](https://docs.docker.com/engine/)

### 创建配置

在项目根目录中创建一个 `.devcontainer/` 文件夹，并放入以下两个文件：

```json [devcontainer.json]
{
  "name": "nuxt-devcontainer",
  "build": {
    "dockerfile": "Dockerfile",
    "context": "../"
  },
  "forwardPorts": [3000],
  "portsAttributes": {
    "3000": {
      "label": "Application",
      "onAutoForward": "openPreview"
    }
  },
  "mounts": [
    "type=volume,target=${containerWorkspaceFolder}/node_modules"
  ],
  "postStartCommand": "pnpm install && pnpm dev:prepare"
}
```

```dockerfile [Dockerfile]
FROM node:lts

WORKDIR /app

RUN npm i -g corepack && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml  ./
RUN pnpm install --frozen-lockfile

COPY . .
```

此配置使用 Node.js LTS 版本，并通过 corepack 启用 pnpm。它转发端口 3000 给 Nuxt 开发服务器，并将 `node_modules` 存储在 Docker 卷中，以避免在容器重启时重新安装。

::tip
若要使用其他包管理器，请将 `corepack enable` 替换为您喜欢的管理器（例如 `npm install -g yarn`），并相应地更新 `postStartCommand`。
::

## 打开现有的开发容器

如果项目已经包含开发容器配置，可以使用以下任何方法打开它：

### 1. VS Code 提示

当您在 VS Code 中打开项目时，右下角应会看到通知：

> “在开发容器中重新打开”

点击此按钮即可在开发容器中构建并打开项目。

### 2. 命令面板

如果您关闭提示或希望手动触发它：

1. 打开命令面板（`Mac 上按 Cmd+Shift+P，Windows/Linux 上按 Ctrl+Shift+P`）
2. 搜索 **“Dev Containers: Reopen in Container”**
3. 选择它

VS Code 将构建容器并重新打开您的项目。

### 3. Dev Containers CLI

对于高级用户或 CI 工作流，可以直接使用 Dev Containers CLI：

```bash
# Install the CLI (if not already installed)
npm install -g @devcontainers/cli

# Build and open the project in a container
devcontainer up --workspace-folder .

# After making changes to .devcontainer, rebuild
devcontainer build
```

## 后续步骤

当容器运行后：

```bash
pnpm dev
```

您的 Nuxt 应用将在 <http://localhost:3000> 访问。
