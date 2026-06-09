---
title: "在 Linux 下配置 Surface Laptop Go"
published: 2026-04-15
description: "Surface Laptop Go 装好 Linux 后指纹不能用、屏幕滚动撕裂、休眠唤醒键盘触控板失灵？本文记录了 Arch 系发行版下 Surface Laptop Go 的硬件配置方法。"
image: "./cover.png"
tags: ["Surface", "Secure Boot"]
category: "Arch Linux"
draft: false
numbering: H2
---

最近入手了一台二手 Surface Laptop Go，作为随身携带的轻便设备使用。不过，对于这台配置并不算新的小电脑来说，预装的 Windows 系统多少显得有些臃肿，于是下定决心给它换上 Linux。

不过，虽然 Linux 内核已经能较好地支持 Surface Laptop Go 的大部分硬件功能，但仍有一些细节需要额外配置，比如指纹传感器、屏幕撕裂、休眠唤醒后的键盘与触控板响应问题等。本文将记录在 Linux 下配置 Surface Laptop Go 硬件时遇到的问题与解决方法。

## Elan 指纹传感器设置

### 指纹驱动安装

Surface Laptop Go 自带的指纹传感器来自于 ELAN，型号为 `04f3:0c5a`。不过，Linux 下常用的指纹识别库 `libfprint` 目前明确标注不支持该设备，因此需要改用适配 Surface 设备的 `libfprint` 分支。

这里使用由开发者 `xerootg` 维护的版本：

::github{repo='xerootg/libfprint'}

```bash frame="terminal"
git clone https://github.com/xerootg/libfprint-elanmoc2-slg3-git
cd libfprint-elanmoc2-slg3-git
makepkg -si
```

如果原仓库无法访问，也可以使用本人同步的克隆仓库：

::github{repo='Miafetta/libfprint'}

```text frame="none"
https://github.com/Miafetta/libfprint.git
```

然后重启 `fprintd` 服务：

```bash frame="terminal"
sudo systemctl restart fprintd
```

### 配置指纹

驱动安装完成后，还需要通过 PAM 配置让系统在认证时调用指纹识别。这里主要涉及两个场景：终端中的 `sudo` 提权，以及图形界面中由 Polkit 触发的提权认证。

1. **配置 `sudo`**

   编辑 `/etc/pam.d/sudo`：

   ```diff lang="text" frame="code"
    #%PAM-1.0
   +auth        sufficient  pam_fprintd.so max-tries=1 timeout=5
    auth        include     system-auth
    account     include     system-auth
    session     include     system-auth
   ```

2. **修复 Polkit（图形化界面提权）**

   Polkit 负责处理图形界面中的权限请求，例如系统设置、软件管理器、磁盘挂载等操作中弹出的提权认证窗口。配置完成后，这些场景也可以使用指纹完成认证。
   
   编辑 `/etc/pam.d/polkit-1`：

   ```diff lang="text" frame="code"
    #%PAM-1.0
   +auth      sufficient    pam_fprintd.so max-tries=1 timeout=5
    auth      include       system-auth
    account   include       system-auth
    password  include       system-auth
    session   include       system-auth
   ```

需要注意的是，指纹认证只是对日常提权的补充，并不能替代密码。系统登录等场景仍需要输入用户密码。

## 防止屏幕撕裂

> 此处参考了 [Surface Laptop Go · linux-surface/linux-surface Wiki](https://github.com/linux-surface/linux-surface/wiki/Surface-Laptop-Go)

屏幕滚动时出现的“果冻屏”（撕裂现象）是由于屏幕面板启用了 Intel PSR（面板自动刷新）功能。虽然禁用该功能会略微增加功耗，但能消除撕裂。

编辑内核参数文件 `/etc/kernel/cmdline`，在最后面加上一个空格，然后添加：

```text frame="none"
i915.enable_psr=0
```

在终端中运行如下命令以重新生成内核镜像：

```bash frame="terminal"
sudo reinstall-kernels
```

重新启动后生效。

## 休眠唤醒后键盘/触控板无响应

> 此处参考了 [Surface Laptop Go · linux-surface/linux-surface Wiki](https://github.com/linux-surface/linux-surface/wiki/Surface-Laptop-Go)

一个不太好的解决方案是，用系统脚本在休眠唤醒时卸载并重新加载 `hid-multitouch` 驱动。

首先，添加一个脚本来重新加载 `hid-multitouch` 驱动模块，内容如下。

```bash title="reload-hid-multitouch.sh" frame="code"
#!/bin/sh
sudo modprobe -r hid-multitouch && sudo modprobe hid-multitouch
```

推荐放在 `/usr/local/bin/reload-hid-multitouch.sh`。

接着，运行以下命令将该脚本标记为可执行文件（注意修改文件路径）。

```bash frame="terminal"
sudo chmod +x /usr/local/bin/reload-hid-multitouch.sh
```

然后，在 `/etc/systemd/system/` 中新建一个文件（如 `/etc/systemd/system/reload-hid-multitouch.service`），并且添加以下内容（注意修改 `ExecStart` 的文件路径）。

```ini title="reload-hid-multitouch.service" frame="code"
[Unit]
Description=Run restart_touch.sh
#After=suspend.target
After=hibernate.target
#After=hybrid-sleep.target

[Service]
ExecStart=/usr/local/bin/reload-hid-multitouch.sh

[Install]
#WantedBy=suspend.target
WantedBy=hibernate.target
#WantedBy=hybrid-sleep.target
```

最后，运行以下命令应用更改：

```bash frame="terminal"
sudo systemctl daemon-reload
```

## 开启 Secure Boot

在安装 EndeavorOS 或者其他 Linux 发行版时，不可避免地需要关闭 UEFI 中的 Secure Boot。而这会导致开机时，在微软 Logo 上方出现一个红色横幅，中间有一个锁形提示。通过烧录本地密钥，可以重新开启 Secure Boot，从而去除该提示。

1. **安装 `sbctl`**

   ```bash frame="terminal"
   sudo pacman -S sbctl
   ```

2. **检查主板状态**

   ```bash frame="terminal"
   sudo sbctl status
   ```

   确认 `Setup Mode`为 `enabled` 或 `✗`

3. **生成加密密钥对**

   在本地生成一套独一无二的加密密钥对，执行：

   ```bash frame="terminal"
   sudo sbctl create-keys
   ```

4. **将密钥烧录入主板**

   如果只写入本地密钥，重启后可能会遭遇键盘失灵或黑屏，所以必须加上 `-m` 参数（代表 Microsoft），保留 Microsoft 密钥。

   执行烧录命令：

   ```bash frame="terminal"
   sudo sbctl enroll-keys -m
   ```

5. **扫描 EFI 分区**

   在给 Linux 内核和引导程序加上签名前，需要查看待签名文件：

   ```bash frame="terminal"
   sudo sbctl verify
   ```

   输出示例如下：

   ```shellsession frame="terminal"
   > sudo sbctl verify
   Verifying file database and EFI images in /efi...
   ✗ /efi/EFI/BOOT/BOOTX64.EFI is not signed
   ✗ /efi/EFI/systemd/systemd-bootx64.efi is not signed
   ✗ /efi/c23f66cadad7410a9287bdf9eeae522e/6.19.10-arch1-1/linux is not signed
   ```

6. **签名**

   对于第 5 步的所有文件，依次执行（注意修改文件名）：

   ```bash frame="terminal"
   sudo sbctl sign -s /efi/EFI/BOOT/BOOTX64.EFI
   sudo sbctl sign -s /efi/EFI/systemd/systemd-bootx64.efi
   sudo sbctl sign -s /efi/c23f66cadad7410a9287bdf9eeae522e/6.19.10-arch1-1/linux
   ```

   `-s`（save）参数的作用是让 `sbctl` 把这些路径永久记在数据库里。以后在终端里使用 `pacman` 更新内核或引导器时，系统底层的钩子（Hook）会自动帮你为新文件重新签名，防止因为忘签名而导致开机黑屏。

7. **校验确认**

   再做一次复查，运行：

   ```bash frame="terminal"
   sudo sbctl verify
   ```

   此时的输出应当是清一色绿色打勾（`✓ ... is signed`），输出示例如下：

   ```shellsession frame="terminal"
   > sudo sbctl verify
   Verifying file database and EFI images in /efi...
   ✓ /efi/EFI/BOOT/BOOTX64.EFI is signed
   ✓ /efi/EFI/systemd/systemd-bootx64.efi is signed
   ✓ /efi/c23f66cadad7410a9287bdf9eeae522e/6.19.10-arch1-1/linux is signed
   ```

8. **重启**

   完成以上步骤后，无需进入 UEFI 修改，重启后即可生效。
