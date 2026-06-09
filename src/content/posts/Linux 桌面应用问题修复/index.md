---
title: "Linux 桌面应用问题修复"
published: 2026-05-07
description: "Linux 桌面应用无法唤起输入法、图标大小不统一，启动的应用图标模糊？本文整理了 KDE/Arch 环境下桌面应用常见问题的修复方法，专治各种桌面应用~"
image: "./cover.png"
tags: ["KDE", "Fcitx5", "Linux 美化"]
category: "Arch Linux"
draft: false
numbering: H2
---

## 解决输入法问题

在 KDE、Arch Linux 等环境中，部分桌面应用可能无法正常唤起中文输入法。比较常见的情况是：系统中已经安装并启用了 Fcitx5，但某些 Electron、Qt、GTK 或 Wine/Lutris 启动的应用仍然不能输入中文。

可以先通过配置全局环境变量解决大部分问题。编辑 `/etc/environment`，添加：

```ini frame="code"
XMODIFIERS=@im=fcitx
GTK_IM_MODULE=fcitx
SDL_IM_MODULE=fcitx
```

其中：

- `XMODIFIERS`：用于 X11 程序识别输入法框架。
- `GTK_IM_MODULE`：用于 GTK 应用调用 Fcitx5。
- `SDL_IM_MODULE`：用于部分 SDL 应用或游戏调用 Fcitx5。

保存后重新登录或者重启系统，使环境变量生效。

对于仍无法使用输入法的应用，转到目录 `/usr/share/applications/`，编辑应用的 `.desktop` 文件，在 `Exec=` 后直接添加：

```bash frame="none" wrap
env XMODIFIERS=@im=fcitx QT_IM_MODULE=fcitx 
```

以微信为例：

```ini frame="code" wrap
Exec=/opt/wechat/wechat %U
```

修改为：

```ini ins="env XMODIFIERS=@im=fcitx QT_IM_MODULE=fcitx " frame="code" wrap
Exec=env XMODIFIERS=@im=fcitx QT_IM_MODULE=fcitx /opt/wechat/wechat %U
```

## 解决应用图标大小问题

使用 WhiteSur图标主题时，有些第三方应用图标与主题风格不一致。即使手动替换了图标，也因为图标画布尺寸、留白比例或圆角风格不同，导致桌面、启动器或 Dock 中的图标看起来有大有小，不够美观。

可以使用 `ImageMagick` 给图标增加透明留白，或者调整图标尺寸，让它在视觉上更接近当前图标主题。

1. 安装 `ImageMagick`：

   ```bash frame="terminal"
   yay -S imagemagick
   ```

2. 进入应用图标所在目录，执行以下命令：

   ```bash frame="terminal"
   magick app_icon.png -gravity center -background transparent -extent 114% app_icon_padded.png
   ```

   其中：

   - `app_icon.png` 是原图标文件。
   - `app_icon_padded.png` 是处理后的新图标文件。
   - `-extent 114%` 表示在原图标四周增加透明留白，使图标视觉上变小。
   - `-gravity center` 表示保持原图标居中。
   - `-background transparent` 表示新增区域使用透明背景。

   如果图标仍然偏大，可以将 `114%` 调整为 `120%`、`128%` 等；如果图标偏小，则可以适当降低比例。

3. 在 `/usr/share/applications/` 目录中编辑应用的 `.desktop` 文件，添加或修改行 `Icon=` 为新图标目录。


> 获取 App 图标的方法可以参考：[6 种方法，教你在 iOS 和 macOS 上获取 App 图标](https://sspai.com/post/40682)。
>
> 下面是已经调整好尺寸和留白的几枚图标，可按需下载使用。
>
> | 应用 | 图标 | 下载 | 应用 | 图标 | 下载 |
> | :-: | :-: | :-: | :-: | :-: | :-: |
> | 明日方舟 | ![明日方舟](./media/arknights-app-icon.png) | <a href="/downloads/linux-desktop-app-icons/arknights-app.png" download>下载</a> | 鹰角启动器 | ![鹰角启动器](./media/hypergragh-launcher-app-icon.png) | <a href="/downloads/linux-desktop-app-icons/hypergragh-launcher-app.png" download>下载</a> |
> | QQ | ![QQ](./media/qq-app-icon.png) | <a href="/downloads/linux-desktop-app-icons/qq-app.png" download>下载</a> | 微信 | ![微信](./media/wechat-app-icon.png) | <a href="/downloads/linux-desktop-app-icons/wechat-app.png" download>下载</a> |
> | 邮箱 | ![邮箱](./media/mail-app-icon.png) | <a href="/downloads/linux-desktop-app-icons/mail-app.png" download>下载</a> | UU 远程 | ![UU 远程](./media/uuremote-app-icon.png) | <a href="/downloads/linux-desktop-app-icons/uuremote-app.png" download>下载</a> |

## 使用 Lutris 启动的应用图标模糊

在使用 Lutris 启动应用时，即使已经更换高清图标，任务栏或 Dock 中显示的应用图标仍然模糊。还有一种常见情况是，已经在 Dock 中固定了高清图标的快捷方式，但启动应用后又出现了另一个模糊图标。

这是因为**窗口真实的类名**与**快捷方式里登记的类名**对不上。Plasma KDE 会根据窗口的 `WM_CLASS` 或桌面文件名，将正在运行的窗口与 `.desktop` 快捷方式进行匹配。如果匹配失败，系统就会把它当成另一个新应用，从而显示默认的模糊图标，或者在 Dock 中生成重复图标。

下面以**明日方舟**为例说明处理方法。

1. 打开 KDE 的窗口规则设置：`系统设置 -> 窗口管理 -> 窗口规则`

2. 新增一条规则，设置如下：

   - 窗口匹配：

     - 窗口类（应用程序）：子串匹配 - `steam_app_default`

     - 窗口标题：子串匹配 - `明日方舟`

   - 外观和修正：
     - 桌面文件名：强制 - `Arknights`

   如果没有看到“桌面文件名”这一项，可以在“添加属性”中搜索并添加。

   这里的 `Arknights` 可以替换为任意名称，但后续 `.desktop` 文件中的 `StartupWMClass` 需要与它保持一致。

3. 打开 Lutris，创建应用的桌面快捷方式。

4. 将快捷方式复制到目录 `/usr/share/applications/`（注意修改快捷方式名称）：

   ```bash frame="terminal"
   sudo cp ~/桌面/application.desktop /usr/share/applications/Arknights.desktop
   ```

   也可以放到当前用户的应用目录中：

   ```bash frame="terminal"
   cp ~/桌面/application.desktop ~/.local/share/applications/Arknights.desktop
   ```

   如果只给当前用户使用，更推荐放在当前用户的应用目录 `~/.local/share/applications/` 中。

5. 然后编辑复制后的快捷方式，添加或修改 `StartupWMClass`：

   ```ini frame="code"
   StartupWMClass=Arknights
   ```

   这里的 `Arknights` 必须与第 2 步中设置的“桌面文件名”一致。

6. 最后修改快捷方式权限（注意修改快捷方式名称）：

   ```bash frame="terminal"
   sudo chmod +rw+r+r arknights.desktop
   ```

完成后，再从应用启动器或桌面图标中启动该应用，此时 Dock 或任务栏中的图标应该会与快捷方式正确合并，并显示为指定的高清图标。
