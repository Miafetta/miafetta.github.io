---
title: "Scoop：Windows 命令行软件包管理器"
published: 2026-08-06
description: "厌倦了四处寻找安装包和反复点击安装向导？不如试试 Scoop 吧！"
image: "./cover.jpg"
tags: ["软件包管理", "Windows", "Scoop", "PowerShell"]
category: "指南"
draft: false
numbering: H2
---

说到在不同系统上安装软件，提起 Linux，便让人想到功能丰富的 `apt`，以及简洁强大的 `pacman`；提起 macOS，则会想到规范统一的 App Store，以及极客味十足的 Homebrew；提起 Windows……算了，还是不提起了。在 Windows 下，`.exe` 安装程序简直就是混沌与邪恶的化身：肆意添加的注册表和 PATH、混乱的安装目录、四处分散的数据文件，让软件安装容易卸载难。

然而~~面对天灾，我们并非无计可施~~，如今的 Windows 也有了 Microsoft Store、`winget`、Chocolatey 和 Scoop 等软件分发方式。而 Scoop 是其中的佼佼者，它让 Windows 上的软件安装像在 Linux 中使用包管理器一样简单。

## 什么是 Scoop

Scoop 是运行在 Windows 平台上的命令行软件（包）管理工具，只需一行命令即可完成软件（包）的下载、安装、卸载、更新等操作，更多信息可参阅 [Scoop](https://scoop.sh/)。

Scoop 尤其适合管理便携式软件，也就是通常所说的“绿色软件”。这类软件通常无需安装，较少修改系统配置，可以很方便地在不同设备间迁移。当然，Scoop 也可以管理非便携式软件：它可以根据软件清单，管理软件及其相关文件、用户数据、系统配置和环境变量，并完成软件的安装、更新与卸载。

具体来说，Scoop 有着以下几个优点：

- 默认将软件安装到用户目录，多数情况下无须管理员权限，也不会频繁触发 UAC 提示；
- 支持静默安装，无需手动操作向导式安装程序；
- 统一管理软件的命令入口和相关环境变量，减少环境变量污染；
- 卸载软件时会清理程序文件和相关配置，减少软件卸载残留；
- 自动安装依赖，并完成相应的配置步骤，安装完成后就能直接运行。

## Scoop 的管理逻辑

Scoop 的软件管理逻辑，是先划定一个根目录（通常为 `~/scoop`），再尽可能把软件及其数据纳入统一的目录结构中。软件本体放在 `apps` 目录，需要跨版本保留的数据放在 `persist` 目录。程序与数据相互分离，更新时替换程序文件，同时保留用户数据；卸载时清理程序文件，并可根据需要一并清除持久化数据。

对于命令入口和环境变量，Scoop 也会按照软件清单进行统一配置，使安装后的软件可以直接在终端中运行，而无须用户手动修改 `PATH`。软件所需的快捷方式、注册表项及其他系统设置，也可以通过清单中预先定义的安装和卸载步骤进行处理。

不过，这套目录结构和管理方式并不能完全约束所有软件的行为。实际使用中，一些软件仍会按照自身的设计，将配置和用户数据写入 `AppData` 等系统目录，或者自行修改注册表及其他系统设置。这些内容能否被 Scoop 正确管理，取决于软件本身的行为以及软件清单提供的支持。

## 安装与配置 Scoop

> [!NOTE]
>
> 这一部分参考了 Scoop 的 GitHub 页面 [ScoopInstaller/Install: 📥 Next-generation Scoop (un)installer](https://github.com/ScoopInstaller/Install#scoop-uninstaller)。

安装前，请确保当前使用的是 `Windows PowerShell 5.1` 或 `PowerShell 7`，推荐选择 `PowerShell 7`。

> [!TIP]
>
> - `Windows PowerShell 5.1` 是 Windows 自带的系统组件，主要用于兼容既有的 Windows 管理体系；
>   - 如果当前使用的是 Windows 10 或 Windows 11，则无需额外安装；
>   - 使用较旧的 Windows 系统时，可以通过运行 `$PSVersionTable.PSVersion` 检查版本，并根据需要安装 [Windows Management Framework 5.1](https://www.microsoft.com/en-us/download/details.aspx?id=54616)。
> - `PowerShell 7` 是基于现代 `.NET` 并支持跨平台的新一代 PowerShell，适合日常命令行操作、脚本编写、软件开发和跨平台自动化。它需要单独安装，并且可以与 Windows PowerShell 5.1 并存。详情请参考 [PowerShell](https://aka.ms/powershell)。

### （可选）修改安装目录

Scoop 默认安装到 `C:\Users\<用户名>\scoop`，也可以自行修改安装位置。

注意替换下列命令中的 `<安装目录>` 为实际安装位置，例如 `D:\Applications\Scoop`：

```powershell frame="terminal" wrap
$env:SCOOP='<安装目录>'
[Environment]::SetEnvironmentVariable('SCOOP', $env:SCOOP, 'User')
```

执行以下命令，如果输出正确路径，则配置正确：
```powershell frame="terminal"
$env:SCOOP
```

### 安装 Scoop

以非管理员模式打开一个 PowerShell 终端，然后运行：

```powershell frame="terminal" wrap
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

看到如下提示，则说明安装成功：

```shellsession frame="terminal"
Scoop was installed successfully!
Type 'scoop help' for instructions.
```

> [!TIP]
>
> 如果在安装时遇到网络问题，请使用代理，并临时设置当前 PowerShell 会话的代理环境变量，注意将 `<ip>` 和 `<port>` 替换为代理服务器的地址和端口：
>
> ```powershell frame="terminal"
> $env:HTTP_PROXY = 'http://<ip>:<port>'
> $env:HTTPS_PROXY = 'http://<ip>:<port>'
> ```
>
> 安装完成后可以删除临时变量：
>
> ```powershell frame="terminal"
> Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue
> Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
> ```

### 配置软件仓库

与 `apt`、`pacman` 等包管理器类似，Scoop 通过软件仓库获取软件的安装清单。在 Scoop 中，这类仓库称为 Bucket。

![Bucket in Minecraft](./media/Bucket.png)

<p align="center"><em>没错，这就是一个 Bucket。</em></p>

Bucket 通常不直接提供软件安装包，而是给出一系列 JSON 格式的软件清单，称为 Manifest。Manifest 中包括软件的版本、下载地址、校验值、依赖关系，以及必要的安装、卸载和配置步骤等信息。

#### 添加官方 Bucket

Scoop 安装完成后默认仅启用 `main` Bucket，主要收录常用的命令行工具和开发工具，如果需要的软件不在 `main` 中，则需要额外添加 Bucket。

添加 Bucket 时需要 `git` 的支持，如果还没有安装 `git`，可以使用如下命令安装：

```powershell frame="terminal"
scoop install git
```

对于希望通过 Scoop 安装桌面应用的普通用户，建议添加 `extras`：

```powershell frame="terminal"
scoop bucket add extras
```

如果需要安装软件的旧版本、测试版本或其他可选版本，还可以添加 `versions`：

```powershell frame="terminal"
scoop bucket add versions
```

除了 `extras`  和 `versions`，常见的 Bucket 还包括：

|                            Bucket                            | 主要内容                                       |
| :----------------------------------------------------------: | ---------------------------------------------- |
|       [`main`](https://github.com/ScoopInstaller/Main)       | 默认仓库，主要收录常用的命令行工具和开发工具   |
|     [`extras`](https://github.com/ScoopInstaller/Extras)     | 不符合 `main` 收录标准的应用，包括大量桌面软件 |
|   [`versions`](https://github.com/ScoopInstaller/Versions)   | 软件的旧版本、测试版本及其他可选版本           |
|       [`java`](https://github.com/ScoopInstaller/Java)       | Java 开发工具包、运行环境及相关工具            |
|        [`php`](https://github.com/ScoopInstaller/PHP)        | 不同版本的 PHP 及相关工具                      |
|      [`games`](https://github.com/ScoopInstaller/Games)      | 免费、开源游戏及游戏相关工具                   |
| [`nerd-fonts`](https://github.com/ScoopInstaller/Nerd-Fonts) | Nerd Fonts 字体                                |
|    [`nirsoft`](https://github.com/ScoopInstaller/Nirsoft)    | NirSoft 提供的 Windows 实用工具                |
| [`nonportable`](https://github.com/ScoopInstaller/Nonportable) | 非便携式软件，安装时可能需要管理员权限         |

添加这些 Bucket 时，只需指定名称。例如：

```powershell frame="terminal"
scoop bucket add java
scoop bucket add nerd-fonts
```

#### 添加第三方 Bucket

Scoop 也支持添加由社区或个人维护的第三方 Bucket，添加时需要同时提供仓库名称和 Git 地址。

> [!IMPORTANT]
>
> 第三方 Bucket 中的软件清单可能包含安装、卸载或配置脚本。添加前应确认仓库来源可信，必要时检查相应 Manifest 的下载地址及执行内容。

例如，`dorado` 收录了不少适合中国用户的软件，由 chawyehsu 维护。

::github{repo="chawyehsu/dorado"}

可以使用如下命令添加：

```powershell frame="terminal" wrap
scoop bucket add dorado https://github.com/chawyehsu/dorado
```

如果对 Scoop 的实现和使用方式感兴趣，也可以阅读 chawyehsu 的文章：[再谈谈 Scoop 这个 Windows 下的软件包管理器](https://chawyehsu.com/blog/talk-about-scoop-the-package-manager-for-windows-again)。

### （可选）加速网络访问

如果 Scoop 更新 Bucket 或下载软件时速度较慢，可以根据具体情况配置代理、使用国内 Bucket 镜像，或者启用 Aria2。

> [!WARNING]
>
> 代理、国内镜像和 Aria2 解决的问题并不完全相同：
>
> - 代理可以改善 Scoop、Git 及软件下载地址的整体访问情况；
> - Bucket 镜像主要加速软件清单的获取与更新，不一定能加速软件安装包的下载；
> - Aria2 主要通过并发连接提升文件下载速度，实际效果取决于下载服务器及网络环境。
>
> 第三方镜像可能存在同步延迟，使用前请确认镜像来源可信。

#### 配置代理服务

在 PowerShell 或命令提示符中运行以下命令，注意将 `<ip>` 和 `<port>` 替换为代理服务器的地址和端口：

```powershell frame="terminal"
scoop config proxy <ip>:<port>
```

例如，某代理软件在本机监听 `7890` 端口，可以配置为：

```powershell frame="terminal"
scoop config proxy 127.0.0.1:7890
```

不再需要代理时，可以将其删除：

```powershell frame="terminal"
scoop config rm proxy
```

#### 使用国内 Bucket 镜像

如果添加或更新 Bucket 的速度较慢，可以改用国内 Bucket 镜像，下面以南京大学开源软件镜像站为例。

> [!NOTE]
>
> 以下示例假设已经添加了 `main`、`extras` 和 `versions`；如果某个 Bucket 尚未添加，请跳过对应命令。

首先，删除需要替换的 `main`、`extras` 和 `versions` Bucket：

```powershell frame="terminal"
scoop bucket rm main
scoop bucket rm extras
scoop bucket rm versions
```

然后使用原来的名称重新添加相应镜像：

```powershell frame="terminal" wrap
scoop bucket add main https://mirror.nju.edu.cn/git/scoop-main.git
scoop bucket add extras https://mirror.nju.edu.cn/git/scoop-extras.git
scoop bucket add versions https://mirror.nju.edu.cn/git/scoop-versions.git
```

最后更新 Scoop 和已添加的 Bucket：

```powershell frame="terminal"
scoop update
```

可以通过以下命令检查 Bucket 的名称及地址：

```powershell frame="terminal"
scoop bucket list
```

如果需要恢复为上游仓库，可以删除镜像 Bucket，然后重新添加：

```powershell frame="terminal"
scoop bucket rm main
scoop bucket rm extras
scoop bucket rm versions
scoop bucket add main
scoop bucket add extras
scoop bucket add versions
scoop update
```

#### 启用 Aria2 加速

Aria2 是一款支持分段和并发连接的下载工具。在下载服务器允许的情况下，它可以提高大文件的下载速度。

首先，安装 Aria2：

```powershell frame="terminal"
scoop install aria2
```

然后启用 Aria2 加速：

```powershell frame="terminal"
scoop config aria2-enabled true
```

还可以根据网络状况调整相关参数：

```powershell frame="terminal"
scoop config aria2-retry-wait 2
scoop config aria2-split 5
scoop config aria2-max-connection-per-server 5
scoop config aria2-min-split-size 4M
```

这些配置分别表示：

|              配置项               | 作用                               |
| :-------------------------------: | ---------------------------------- |
|        `aria2-retry-wait`         | 下载失败后的重试等待时间，单位为秒 |
|           `aria2-split`           | 单个文件的最大分段数               |
| `aria2-max-connection-per-server` | 到单个服务器的最大连接数           |
|      `aria2-min-split-size`       | 触发文件分段的最小文件大小         |

Aria2 并非连接数越多越快。过多的并发连接可能受到服务器限制，甚至导致下载失败。

如果启用后出现兼容性问题，可以将其关闭：

```powershell frame="terminal"
scoop config aria2-enabled false
```

## 开始使用 Scoop

Scoop 的使用非常简单，命令的基本结构是：

```powershell frame="terminal"
scoop <操作> [对象]
```

其中，“操作”表示需要执行的命令，“对象”通常是软件名称。例如，安装 Git：

```powershell frame="terminal"
scoop install git
```

可以运行以下命令查看 Scoop 提供的全部操作：

```powershell frame="terminal"
scoop help
```

输出如下所示：

```shellsession frame="terminal" wrap=false
Usage: scoop <command> [<args>]

Available commands are listed below.

Type 'scoop help <command>' to get more help for a specific command.

Command    Summary
-------    -------
alias      Manage scoop aliases
bucket     Manage Scoop buckets
cache      Show or clear the download cache
cat        Show content of specified manifest.
checkup    Check for potential problems
cleanup    Cleanup apps by removing old versions
config     Get or set configuration values
create     Create a custom app manifest
depends    List dependencies for an app, in the order they'll be installed
download   Download apps in the cache folder and verify hashes
export     Exports installed apps, buckets (and optionally configs) in JSON format
help       Show help for a command
hold       Hold an app to disable updates
home       Opens the app homepage
import     Imports apps, buckets and configs from a Scoopfile in JSON format
info       Display information about an app
install    Install apps
list       List installed apps
prefix     Returns the path to the specified app
reset      Reset an app to resolve conflicts
search     Search available apps
shim       Manipulate Scoop shims
status     Show status and check for new app versions
unhold     Unhold an app to enable updates
uninstall  Uninstall an app
update     Update apps, or Scoop itself
virustotal Look for app's hash or url on virustotal.com
which      Locate a shim/executable (similar to 'which' on Linux)
```

如果需要了解某项操作的具体用法，可以在命令后指定操作名称：

```powershell frame="terminal"
scoop help install
scoop help update
```

### 搜索和查看软件

安装软件前，可以先进行搜索，确认软件是否已经被当前添加的 Bucket 收录，并查看其准确名称：

```powershell frame="terminal"
scoop search <软件名>
```

例如：

```powershell frame="terminal"
scoop search firefox
```

查看软件的版本、来源、主页等信息：

```powershell frame="terminal"
scoop info firefox
```

在浏览器中打开软件主页：

```powershell frame="terminal"
scoop home firefox
```

### 安装软件

使用 `install` 命令安装软件：

```powershell frame="terminal"
scoop install firefox
```

Scoop 支持在一条命令中指定多个软件，并依次进行安装：

```powershell frame="terminal"
scoop install git 7zip
```

Git 用于添加和更新 Bucket。如果准备添加 `extras` 等 Bucket，建议先安装 Git：

```powershell frame="terminal"
scoop install git
```

如果不同 Bucket 中存在同名软件，可以在软件名前指定 Bucket：

```powershell frame="terminal"
scoop install extras/firefox
```

### 查看已安装的软件

使用以下命令查看由 Scoop 管理的软件：

```powershell frame="terminal"
scoop list
```

检查 Scoop、Bucket 和已安装软件是否存在可用更新：

```powershell frame="terminal"
scoop status
```

### 更新软件

更新 Scoop 本身及已添加的 Bucket：

```powershell frame="terminal"
scoop update
```

更新某个已经安装的软件：

```powershell frame="terminal"
scoop update firefox
```

更新所有已安装的软件：

```powershell frame="terminal"
scoop update *
```

> [!NOTE]
>
> `scoop update` 本身主要用于更新 Scoop 及 Bucket 中的软件清单，并不会更新所有已经安装的软件。
>
> 如果要更新所有软件，请使用 `scoop update *`。

### 暂停和恢复更新

如果希望某个软件暂时保持当前版本，可以使用 `hold` 将其锁定：

```powershell frame="terminal"
scoop hold <软件名>
```

例如：

```powershell frame="terminal"
scoop hold python
```

需要恢复更新时，使用 `unhold`：

```powershell frame="terminal"
scoop unhold python
```

### 卸载软件

使用 `uninstall` 命令卸载软件：

```powershell frame="terminal"
scoop uninstall firefox
```

Scoop 通常会保留软件在 `persist` 目录中的持久化数据，以便重新安装后继续使用。如果需要同时删除这些数据，可以添加 `--purge` 参数：

```powershell frame="terminal"
scoop uninstall firefox --purge
```

使用 `--purge` 前应确认其中没有需要保留的配置或用户数据。

### 清理旧版本和下载缓存

Scoop 更新软件后，旧版本的程序文件可能仍然保留。可以使用以下命令清理所有软件的旧版本：

```powershell frame="terminal"
scoop cleanup *
```

清理已经下载的软件安装包缓存：

```powershell frame="terminal"
scoop cache rm *
```

### 常用命令归纳

| 命令                       | 作用                 |
| -------------------------- | -------------------- |
| `scoop search <软件名>`    | 搜索软件             |
| `scoop info <软件名>`      | 查看软件信息         |
| `scoop install <软件名>`   | 安装软件             |
| `scoop list`               | 查看已安装的软件     |
| `scoop status`             | 检查软件更新         |
| `scoop update`             | 更新 Scoop 和 Bucket |
| `scoop update *`           | 更新所有已安装的软件 |
| `scoop hold <软件名>`      | 锁定软件版本         |
| `scoop unhold <软件名>`    | 解除版本锁定         |
| `scoop uninstall <软件名>` | 卸载软件             |
| `scoop cleanup *`          | 清理所有软件的旧版本 |
| `scoop cache rm *`         | 清理下载缓存         |

## 结语

Scoop 并不能彻底改变 Windows 软件生态，也无法保证所有软件都遵循便携、无残留的管理方式。软件最终会将数据保存在哪里、是否修改注册表和系统设置，仍然取决于软件自身的设计以及 Manifest 提供的支持。

但 Scoop 至少为 Windows 提供了一套相对统一的软件管理方式：用相同的命令完成搜索、安装、更新和卸载；将程序文件集中存放，并尽可能统一管理用户数据、命令入口和环境变量。对于经常重装系统、配置开发环境，或者只是厌倦了反复点击安装向导的用户来说，这已经足以显著改善软件管理体验。

所以，下次再说到各个系统上安装软件时，Linux 有 `apt` 和 `pacman`，macOS 有 Homebrew，而 Windows……这次不必“算了”，至少我们可以提起 Scoop。
