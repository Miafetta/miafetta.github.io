---
title: "Waydroid：在 Linux 上使用 Android APP"
published: 2026-05-12
description: "想在 Linux 桌面上运行 Android APP？本文以 Arch Linux 为例，记录了完整的 Waydroid 安装、配置和使用过程，助你安装一个 Android 子系统~"
image: "./cover.png"
tags: ["Waydroid", "Android"]
category: "Arch Linux"
draft: false
numbering: H2
---

在 Linux 桌面上运行 Android APP，一直是一个比较微妙的需求：有些软件没有 Linux 客户端，有些网页端功能不完整，还有些应用只能通过 Android 版本获得比较好的体验。相比传统 Android 模拟器，Waydroid 并不是完整虚拟机，而是基于 LXC 容器运行 Android 系统，能够直接使用操作系统内核（而不是模拟一个 Android 内核），因此性能开销更低，也能更自然地融入 Linux 桌面环境。

本文以 Arch Linux / EndeavourOS 为例，记录从安装 Waydroid 到实际使用过程中需要处理的一些常见问题，包括内核支持、网络代理、ARM 应用兼容、Google Play 认证、隐藏多余图标以及多窗口模式配置。

需要注意的是，Waydroid 对系统环境有一定要求，尤其依赖 Wayland、内核模块、网络配置和容器服务。不同发行版、桌面环境、代理工具的配置方式可能会有所差异，本文更偏向个人环境下的完整配置记录，可按需参考。

## 安装 Waydroid

在开始之前，请确保当前使用的显示服务器协议是 `wayland`，而不是 `X11`。使用以下命令查询：

```bash frame="terminal"
echo $XDG_SESSION_TYPE
```

如果输出是 `wayland`，则可以继续进行下一步；否则，请先切换到 Wayland 会话。以 KDE Plasma 为例，通常可以在登录界面的会话选择中切换到 `Plasma (Wayland)`。

此外，由于国内网络环境存在 DNS 污染问题，初始化 Waydroid、使用 Google 服务、下载部分组件时可能需要代理。本文以 `Clash Verge` 为例，理论上 `Clash` 系软件通用。

### 更换内核

Waydroid 不是传统意义上的 Android 模拟器，，而是基于 LXC 的 Android 容器。虚拟机通常会运行一套独立的虚拟内核，而容器则会与宿主机共享同一个 Linux 内核。

因此，Waydroid 能否正常运行，很大程度上取决于宿主机内核是否提供了 Android 容器所需的功能。

然而，Waydroid 的运行依赖于内核的 `binder` 和 `ashmem` 模块，但是标准 Arch 内核默认未开启这些特性。因此，需要切换到打好了 Waydroid 所需所有补丁的 `linux-zen` 内核。

运行如下命令以安装 `linux-zen` 内核及对应头文件：

```bash frame="terminal"
yay -S linux-zen linux-zen-headers
```

安装完成后，请更新 `GRUB` 或 `systemd-boot` 引导，并重启电脑，切入 Zen 内核。

重启后使用以下命令确认当前内核：

```bash frame="terminal"
uname -r
```

如果输出中包含 `zen`，说明已经成功切换到 `linux-zen` 内核。

### 安装 Waydroid 主程序

安装 Waydroid：

```bash frame="terminal"
yay -S waydroid
```

安装完成后，系统中会新增 Waydroid 相关命令和服务，包括：

- `waydroid`：Waydroid 的主要命令行工具。
- `waydroid-container.service`：Waydroid 容器服务。

Waydroid 的数据和系统镜像保存在 `/var/lib/waydroid/` 目录下。

### 配置防火墙

Waydroid 会创建名为 `waydroid0` 的虚拟网卡，用于宿主机和 Android 容器之间的网络通信。如果系统启用了防火墙，则需要在防火墙中配置该网卡，包括加入 `trust` 域以及开启 NAT 功能。

运行以下命令：

```bash frame="terminal"
sudo firewall-cmd --zone=trusted --add-interface=waydroid0 --permanent
sudo firewall-cmd --add-masquerade --permanent
sudo firewall-cmd --reload
```

如果你使用的不是 `firewalld`，而是 `ufw`、`iptables` 或其他，需要根据实际情况放行 `waydroid0` 并配置转发。

### 配置默认 DNS

通常，Linux 发行版采用 `systemd-resolved` 来管理 DNS，会将本机 DNS 设为 `127.0.0.53`。

这个地址对宿主机来说是可用的，但 Waydroid 是运行在容器中的，如果 Waydroid 继承了这个设置，它在容器内无法找到这个本地服务，导致网络解析失败。

因此，在初始化 Waydroid 前，需要先配置默认 DNS（这里是 `8.8.8.8`，也可以自行修改）：

```bash frame="terminal" wrap
sudo mkdir -p /var/lib/waydroid
echo "persist.waydroid.network.dns_server=8.8.8.8" | sudo tee -a /var/lib/waydroid/waydroid_base.prop
```

### 初始化 Waydroid 容器

开始前，先在 `Clash Verge` 中开启 TUN 模式，并且开启系统代理，这样可以提高初始化阶段下载镜像、连接 Google 服务时的成功率。

然后，清理之前的安装残余（如果存在）：

```bash frame="terminal"
sudo rm -rf /usr/share/waydroid-extra/images/
sudo rm -rf /var/lib/waydroid/*
```

现在，进行在线初始化，安装带有 Google 服务的版本（若要安装不带 Google 服务的版本，请将 `GAPPS` 替换为 `VANILLA`）：

```bash frame="terminal"
sudo waydroid init -s GAPPS -f
```

等待一段时间后，控制台会输出 `Done`，说明初始化完成。此时，请关闭代理中的 TUN 模式，防止 `waydroid0` 虚拟网卡的内网路由发生错乱。

### 注入全局代理

开始前，先在 `Clash Verge` 中允许“局域网连接”，并且开启系统代理。

然后，查看 `waydroid0` 给物理机分配的 IP 地址：

```bash frame="terminal"
ip -4 addr show waydroid0
```

通常情况下，这个地址会是 `192.168.240.1`，后续均以此为例，否则请自行替换为当前真正的 IP 地址。

然后，启动 Waydroid 容器和会话：

```bash frame="terminal"
sudo systemctl start waydroid-container
waydroid session start &
```

等待一段时间后，控制台会输出 `[xx:xx:xx] Android with user 0 is ready`，然后运行以下命令，配置全局代理（注意需要将 `7890` 替换为 `Clash Verge` 等代理软件的混合代理端口）：

```bash frame="terminal"
sudo waydroid shell settings put global http_proxy 192.168.240.1:7890
```

*注意：如果未来需要关闭 Waydroid 的代理，执行 `sudo waydroid shell settings put global http_proxy :0` 即可清除代理配置。*

然后，可以运行如下命令测试配置结果：

```bash frame="terminal"
sudo waydroid shell -- sh -c "https_proxy=http://192.168.240.1:10808 curl -I https://www.google.com"
```

如果输出 `HTTP/1.1 200 Connection established` 或类似滋养，说明当前代理配置成功。

或者，你也可以打开 Waydroid 中的浏览器等应用，打开 `www.google.com` 等网站，查看当前代理是否配置成功。

### 安装 ARM 兼容层

在 `X86_64` 机器上，Waydroid 默认更适合运行 x86 或 x86_64 架构的 Android 应用。但现实中，很多 Android APP 只提供 `arm64-v8a` 或 `armeabi-v7a` 架构版本，因此可能会出现应用无法安装、无法启动或启动后闪退的问题。

为了解决这个问题，可以安装 ARM 兼容层。这里使用 `waydroid_script` 安装 Intel Houdini：

```bash frame="terminal"
# 下载脚本
git clone https://github.com/casualsnek/waydroid_script
cd waydroid_script

# 创建Python虚拟环境
python3 -m venv venv
source venv/bin/activate

# 在虚拟环境中安装依赖
pip install -r requirements.txt

# 安装对Intel兼容性更好的Intel Houdini
sudo venv/bin/python3 main.py install libhoudini
```

完成后，运行 `deactivate` 退出虚拟环境，然后重启 Waydroid 会话：

```bash frame="terminal"
waydroid session stop
waydroid session start &
```

安装兼容层后，Waydroid 就可以运行更多只提供 ARM 架构的 Android APP 了。不过，兼容层并不能保证所有应用都能完美运行，尤其是依赖反作弊、强设备校验、特殊图形接口或厂商框架的应用，仍然可能出现异常。

### （可选）进行 Google Play 保护认证

如果安装的是 `GAPPS` 版本，首次打开 Google Play 时，可能会提示设备未通过 Play 保护认证。这是由于容器未在 Google 进行认证，目前无法使用 Google Play Store 等 Google 服务。

为了解决这一问题，可以手动提交 Android ID 进行注册。

运行如下命令获取 Android ID：

```bash frame="terminal" wrap
sudo waydroid shell sqlite3 /data/data/com.google.android.gsf/databases/gservices.db "select * from main where name = 'android_id';"
```

命令会输出格式为 `android_id|xxxxxxxxxxxxxxxxxxx` 的字符，复制 19 位 ID，然后前往「[设备注册](https://www.google.com/android/uncertified)」，登陆 Google 账号并提交该 ID。

完成后，重启 Waydroid 会话生效：

```bash frame="terminal"
waydroid session stop
waydroid session start &
```

### （可选） 隐藏不需要的系统图标

Waydroid 会将 Android 应用生成对应的 `.desktop` 文件，并显示在 Linux 应用启动器中。安装 `GAPPS` 后，系统中可能会出现很多不常用的 Android 系统应用图标，例如通讯录、日历、相机、浏览器等。

如果希望应用菜单更干净，可以通过修改 `.desktop` 文件，为不需要显示的应用添加：

```ini frame="code"
NoDisplay=true
```

Waydroid 的应用快捷方式通常位于 `~/.local/share/applications/` 并以 `waydroid.` 开头。

1. 首先，查询当前已安装的应用列表：

   ```bash frame="terminal"
   waydroid app list
   ```

2. 创建一个脚本文件（假设路径在 `~/waydroid_icon_hiding.sh`）：

   ```bash frame="terminal"
   touch ~/waydroid_icon_hiding.sh
   ```

   然后编辑脚本文件，根据自己的需要增删 `hide_apps` 中的包名：

   ```bash title="waydroid_icon_hiding.sh" frame="code" showLineNumbers
   # 需要隐藏的应用包名
   hide_apps=(
     "com.google.android.googlequicksearchbox" # Google
     "com.android.documentsui"                 # 文件
     "com.google.android.apps.messaging"       # 信息
     "com.android.vending"                     # Google Play 商店
     "org.lineageos.recorder"                  # 录音机
   # "com.netease.uuremote"                    # UU远程
     "com.google.android.contacts"             # 通讯录
     "com.android.gallery3d"                   # 图库
   # "io.github.huskydg.magisk"                # Magisk Delta
     "org.lineageos.jelly"                     # 浏览器
     "org.lineageos.eleven"                    # 音乐
     "org.lineageos.etar"                      # 日历
     "org.lineageos.aperture"                  # 相机
     "com.android.settings"                    # 设置
     "com.android.calculator2"                 # 计算器
     "com.android.deskclock"                   # 时钟
     "com.google.android.apps.restore"         # Android Switch
   )
   
   for app in "${hide_apps[@]}"; do
     file="$HOME/.local/share/applications/waydroid.${app}.desktop"
     if [ -f "$file" ]; then
       # 1. 恢复文件写权限
       chmod u+w "$file"
       
       # 2. 清理旧的错位属性
       sed -i '/NoDisplay=true/d' "$file"
       
       # 3. 把 NoDisplay=true 挂在 [Desktop Entry] 的下一行
       sed -i '/^\[Desktop Entry\]/a NoDisplay=true' "$file"
       
       # 4. 剥夺所有用户的写权限，防止 Waydroid 重启时覆盖
       chmod a-w "$file"
       echo "✅ 已成功隐藏并锁定: $app $app"
     else
       echo "⚠️ 未找到文件 (可能已被隐藏或未生成): $app"
     fi
   done
   
   # 5.刷新 KDE Plasma 的组件缓存
   kbuildsycoca6 --noincremental
   echo "🎉 缓存刷新完成，指定的图标已从 KDE 菜单中彻底移除。"
   ```

   这里通过 `chmod a-w` 移除写权限，是为了尽量避免 Waydroid 重启后重新覆盖 `.desktop` 文件。如果之后想恢复某个图标，可以先使用如下命令恢复写权限：

   ```bash frame="terminal"
   chmod u+w ~/.local/share/applications/waydroid.<应用包名>.desktop
   ```

   然后删除对应文件中的 `NoDisplay=true`。

   当然，你也可以点击<a href="/downloads/bash-scripts/waydroid_icon_hiding.sh" download>这里</a>进行下载。

3. 保存并退出后，赋予可执行权限：

   ```bash frame="terminal"
   sudo chmod +x ~/waydroid_icon_hiding.sh
   ```

4. 然后运行脚本：

   ```bash frame="terminal"
   ~/waydroid_icon_hiding.sh
   ```

### （可选）开启多窗口模式

Waydroid 应用默认以全屏模式启动，而多窗口模式能绕过 Android 自带的 SurfaceFlinger（画面合成器），直接让物理机的 Wayland 合成器接管每一个 APP 的窗口渲染，从而可以像使用原生 Linux 应用一样使用 Android APP。

运行以下命令开启多窗口模式：

```bash frame="terminal"
waydroid prop set persist.waydroid.multi_windows true
```

重启 Waydroid 会话后生效：

```bash frame="terminal"
waydroid session stop
waydroid session start &
```

如果想关闭多窗口模式，可以执行：

```bash frame="terminal"
waydroid prop set persist.waydroid.multi_windows false
```

然后再次重启 Waydroid 会话。

## 开始使用

完成以上配置后，Waydroid 就可以作为一个“运行在 Linux 桌面里的 Android 环境”来使用了。日常使用主要包括：启动 Waydroid、安装 APK、从应用菜单启动 APP、管理已安装应用，以及在出现问题时重启容器或会话。

### 启动 Waydroid

Waydroid 由两部分组成：

- `waydroid-container`：后台容器服务，负责运行 Android 系统。
- `waydroid session`：当前用户的图形会话，负责让 Android 应用显示到桌面中。

手动启动容器服务：

```bash frame="terminal"
sudo systemctl start waydroid-container
```

启动当前用户会话：

```bash frame="terminal"
waydroid session start &
```

如果希望开机后自动启动 Waydroid 容器，可以启用 systemd 服务：

```bash frame="terminal"
sudo systemctl enable --now waydroid-container
```

### 打开 Waydroid 主界面

启动完整 Android 界面：

```bash frame="terminal"
waydroid show-full-ui
```

这会打开类似一个 Android 平板的完整界面。

### 安装 APK

安装本地 APK 文件时，使用如下命令：

```bash frame="terminal"
waydroid app install /path/to/your/app
```

下载 APK 时，请优先选择当前设备架构对应的版本。对于 x86_64 机器，推荐优先级如下：

1. 优先寻找 `x86_64` 或 `x86` 版本的 APK
2. 其次选择 64 位 ARM (`arm64-v8a`)
3. 避免使用 32 位 ARM (`armeabi-v7a`)

### 安装 XAPK / APKM / APKS

有些应用商店下载到的不是单个 `.apk`，而是 `.xapk`、`.apkm` 或 `.apks` 文件。这类文件通常包含主 APK、配置 APK、语言包、架构包等拆分安装包，不能直接用普通 APK 安装命令安装。

处理方法有两种：

1. 使用支持拆分包安装的 Android 安装器，例如 APKMirror Installer、SAI 等。
2. 解压文件后，手动安装其中的 APK 组合。

如果使用 SAI，可以先安装 SAI 的 APK，然后在 Waydroid 中打开 SAI，再选择 `.apks` / `.apkm` 文件进行安装。

如果是 `.xapk` 文件，可以尝试将其后缀改为 `.zip` 后解压，查看里面是否包含 `.apk` 文件和 `Android/obb` 数据目录，有时还需要手动放置 OBB 数据。

### 查看已安装应用

查看 Waydroid 中已安装的应用：

```bash frame="terminal"
waydroid app list
```

输出中会显示应用名称和包名，在卸载应用、隐藏图标、手动启动应用时会用到。

### 启动指定应用

如果知道应用包名，可以通过命令启动：

```bash frame="terminal"
waydroid app launch <包名>
```

例如：

```bash frame="terminal"
waydroid app launch com.tencent.mm
```

但更常用的方式还是直接从 KDE / GNOME 的应用菜单中搜索应用名称启动。

### 卸载应用

卸载指定应用：

```bash frame="terminal"
waydroid app remove <包名>
```

例如：

```bash frame="terminal"
waydroid app remove com.example.app
```

也可以进入 Waydroid 的 Android 设置，在应用管理中卸载。

### 传输文件

Waydroid 和宿主机之间的文件互通方式比较直接。Waydroid 的用户数据位于：

```text frame="none"
~/.local/share/waydroid/data/
```

Android 用户目录对应：

```text frame="none"
~/.local/share/waydroid/data/media/0/
```

例如，Android 的下载目录对应于：

```text frame="none"
~/.local/share/waydroid/data/media/0/Download/
```

可以将文件复制到该目录，然后在 Waydroid 内部的文件管理器或应用中访问。

### 重启 Waydroid

如果遇到应用打不开、网络异常、窗口不显示等问题，可以先重启 Waydroid 会话：

```bash frame="terminal"
waydroid session stop
waydroid session start &
```

如果问题仍然存在，可以重启容器服务：

```bash frame="terminal"
sudo systemctl restart waydroid-container
```

然后再次启动会话：

```bash frame="terminal"
waydroid session start &
```

### 常用命令整理

日常使用中的常用命令如下：

```bash frame="terminal"
# 启动容器服务
sudo systemctl start waydroid-container

# 启动 Waydroid 用户会话
waydroid session start &

# 打开完整 Android 界面
waydroid show-full-ui

# 安装 APK
waydroid app install /path/to/app.apk

# 查看应用列表
waydroid app list

# 启动应用
waydroid app launch 包名

# 卸载应用
waydroid app remove 包名

# 停止 Waydroid 会话
waydroid session stop

# 重启容器服务
sudo systemctl restart waydroid-container
```

## 使用建议

Waydroid 更适合运行工具类、阅读类、网盘类、聊天类等 Android APP。对于依赖硬件加速、设备指纹、厂商服务、反作弊系统或 DRM 校验的应用，兼容性一般较差。

如果某个 APP 无法运行，可以优先检查以下几点：

- APK 架构是否合适，是否需要 ARM 兼容层。
- Waydroid 网络是否正常，是否需要配置代理。
- 是否缺少 Google 服务或 Play 保护认证。
- 是否需要授予存储、通知、定位等 Android 权限。
- 是否可以换用较旧版本或非 Google Play 渠道版本。

配置完成后，Waydroid 的整体体验已经接近“在 Linux 上运行一个轻量 Android 子系统”。对于偶尔需要 Android APP 的 Linux 桌面用户来说，它是一个相当实用的方案。

