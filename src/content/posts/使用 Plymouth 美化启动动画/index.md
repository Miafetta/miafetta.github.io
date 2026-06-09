---
title: "使用 Plymouth 美化启动动画"
published: 2026-05-13
description: "受够了开机时满屏滚动的启动日志？本文教你在 Arch Linux/EndeavourOS 上配置 Plymouth、隐藏 systemd-boot 菜单，打造更干净的静默启动体验~"
image: "./cover.png"
tags: ["Plymouth", "systemd-boot", "Linux 美化"]
category: "Arch Linux"
draft: false
numbering: H2
---

> 本文适用于使用 `systemd-boot` 作为引导器，并通过 `dracut` 生成 `initramfs` 的系统。如果你使用的是 `GRUB`、`mkinitcpio` 或其他启动方案，配置文件和重新生成镜像的命令会有所不同。

默认情况下，在启动 Arch Linux 时屏幕上会依次显示：

- systemd-boot 引导菜单
- 内核日志
- udev 探测信息
- systemd 启动状态
- 短暂闪烁的文本光标

如果希望启动过程更接近 Windows，可以通过隐藏引导菜单、启用 Plymouth 动画、减少日志输出来实现更干净的开机画面。

## 隐藏引导菜单

编辑 `systemd-boot` 的配置文件 `/efi/loader/loader.conf`，将 `timeout 5` 修改为 `timeout 0`。这样开机时会直接进入默认启动项，不再显示引导菜单。

之后，在开机进入引导阶段时连续按 `Space` 空格键，依然可以强制唤出引导菜单。

## 安装 Plymouth

Plymouth 可以在系统启动早期显示图形化启动动画，并遮挡大部分启动日志。

使用如下命令可以安装 Plymouth：

```bash frame="terminal"
yay -S plymouth
```

## 添加 Plymouth 到 dracut

Plymouth 需要被加入 `initramfs`，才能在根文件系统挂载前正常显示，而 EndevourOS 默认使用  `dracut` 生成 `initramfs`。

> [!NOTE]
>
> `initramfs` 是 Linux 启动过程中的一个关键组件，它是一个临时的初始根文件系统，用于在内核完全启动之前加载必要的驱动程序和其他系统组件。

新建 `dracut` 配置文件：

```bash frame="terminal"
nano /etc/dracut.conf.d/plymouth.conf
```

然后写入：

```text title="plymouth.conf" frame="code"
add_dracutmodules+=" plymouth "
```

这一步会让 dracut 在生成 initramfs 时加入 Plymouth 相关模块。

## 注入静默启动参数

编辑内核参数文件 `/etc/kernel/cmdline`，在最后面加上一个空格，然后添加：

```text frame="none"
quiet splash loglevel=3
```

各参数含义如下：

- `quiet`：减少内核启动时输出的信息。
- `splash`：启用 Plymouth 启动画面。
- `loglevel=3`：只显示错误及更严重级别的内核日志，隐藏普通提示和警告信息。

修改后请再次确认 `/etc/kernel/cmdline` 文件内只有一行。

## 设置 Plymouth 主题

使用如下命令可以查看所有可用主题：

```bash frame="terminal"
plymouth-set-default-theme --list
```

将动画主题指定为带有 OEM Logo 的极简主题 `bgrt`：

```bash frame="terminal"
sudo plymouth-set-default-theme bgrt
```

`bgrt` 是 Plymouth 自带的极简主题，代表 **B**oot **G**raphics **R**esource **T**able（启动图形资源表），是 UEFI 规范的一部分。Plymouth 通过读取 BGRT 来使用主板固件提供的 OEM Logo，并在下方显示加载动画。

如果想立即查看当前主题效果，可以运行：

```bash frame="terminal"
sudo plymouthd
sudo plymouth --show-splash
```

如果想要退出预览，你需要盲打：

```bash frame="terminal"
sudo plymouth --quit
```

## （可选）删除 Arch Linux 水印

`bgrt` 主题下，屏幕最下方会出现 Arch Linux 水印，可以通过以下命令删除该水印：

```bash frame="terminal" wrap
sudo mv /usr/share/plymouth/themes/spinner/watermark.png /usr/share/plymouth/themes/spinner/watermark.png.bak
```

如果之后想恢复水印：

```bash frame="terminal" wrap
sudo mv /usr/share/plymouth/themes/spinner/watermark.png.bak /usr/share/plymouth/themes/spinner/watermark.png
```

需要注意，Plymouth 软件包更新后，这个文件可能会被恢复。如果水印再次出现，需要重新执行上述操作。

## （可选）禁止其余开机日志输出

如果仍然能看到少量 udev、systemd 或光标输出，可以编辑内核参数文件 `/etc/kernel/cmdline`，在最后面加上一个空格，然后添加：

```text frame="none" wrap
rd.udev.log_priority=3 vt.global_cursor_default=0 systemd.show_status=false rd.systemd.show_status=false
```

参数说明：

- `rd.udev.log_priority=3`：禁止输出 dracut 阶段硬件探测器（udev）的探测信息。
- `vt.global_cursor_default=0`：禁止输出屏幕左上角闪烁的文本下划线光标（`_`）。
- `systemd.show_status=false`：禁止 systemd 在屏幕上打印绿色的 `[ OK ]` 或红色的 `[ FAILED ]` 启动日志。
- `rd.systemd.show_status=false`：禁止系统在挂载根目录前的极早期阶段打印任何 systemd 日志。

## 重新生成内核镜像

修改 dracut 配置或内核参数后，需要重新生成内核镜像，否则更改不会生效。

在终端中运行：

```bash frame="terminal"
sudo reinstall-kernels
```

该命令会重新安装当前内核并触发相关 hook，生成新的 `initramfs` 和启动项。完成后重启系统即可查看效果。

如果你的系统没有 `reinstall-kernels` 命令，可以改用 `dracut` 手动生成：

```bash frame="terminal"
sudo dracut --force
```

## 故障排查

如果重启后没有显示 Plymouth 动画，可以检查以下几点：

- 是否已经安装 `plymouth`。
- `/etc/dracut.conf.d/plymouth.conf` 是否正确写入 `add_dracutmodules+=" plymouth "`。
- `/etc/kernel/cmdline` 中是否包含 `splash`。
- 修改后是否执行过 `sudo reinstall-kernels` 或重新生成 initramfs。
- 当前启动方式是否确实使用了 dracut 生成的 initramfs。

如果启动卡住或无法看到错误信息，可以在 `systemd-boot` 菜单中临时编辑启动项，删除 `quiet splash systemd.show_status=false rd.systemd.show_status=false` 等参数，以便查看详细日志。
