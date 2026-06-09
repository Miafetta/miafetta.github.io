---
title: "树莓派 Type-C 一线通配置指南"
published: 2026-05-20
description: "想用一根 Type-C 数据线同时解决树莓派供电和网络连接？本文记录了在 Raspberry Pi 4B 上启用 USB Gadget 模式，并通过虚拟网卡实现与 iPad 或 PC 直连通信的方法。"
image: "./cover.jpg"
tags: ["Raspberry Pi", "USB Gadget"]
category: 指南
draft: false
numbering: H2
---

树莓派 4B 的 Type-C 接口通常用于供电，但在启用 USB Gadget 模式后，它也可以在接收供电的同时，模拟成一张 USB 虚拟网卡。这样一来，只需要一根 Type-C 数据线，就能同时完成供电和网络通信。

> [!NOTE]
>
> 这里需要使用支持数据传输的 Type-C 数据线。部分充电线只有供电能力，无法建立 USB 网络连接。

这种用法很适合没有路由器、没有网线，或者只想临时直连调试树莓派的场景。例如，可以把树莓派直接连接到 iPad、Mac、Windows PC 或 Linux 电脑上，然后通过虚拟网卡访问 SSH、Web 服务或其他局域网服务。

本文以 Raspberry Pi 4B 为例，记录通过 USB Gadget 模式启用 Type-C 一线通的方法。

配置完成后，树莓派侧的虚拟网卡一般为 `usb0`，IP 地址为：

```text frame="none"
10.42.0.1
```

连接树莓派的设备会自动获得一个 `10.42.0.x` 的地址。之后，就可以通过 `10.42.0.1` 访问树莓派了。

## 开启 OTG 功能

修改树莓派启动配置文件 `/boot/firmware/config.txt`，在文件最末尾新起一行，加入：

```text frame="code"
dtoverlay=dwc2
```

`dwc2` 是树莓派 USB OTG / Gadget 功能的驱动。添加该配置后，系统启动时会加载对应的 USB 控制器支持。

> [!NOTE]
>
> USB Gadget 模式可以让树莓派在 USB 连接中扮演“外设”角色，而不是普通电脑那样的“主机”角色。启用后，树莓派可以模拟成不同类型的 USB 设备，如虚拟网卡、串口设备、U 盘、HID 键盘或鼠标等。
>
> 本文使用的是 `g_ether` 模块，它会让树莓派通过 USB 模拟成一张以太网网卡。连接到 iPad 或 PC 后，双方会各自出现一张 USB 网卡，从而形成一个点对点局域网。

## 加载虚拟网卡模块

修改内核启动参数文件 `/boot/firmware/cmdline.txt`（注意此文件只能有一行），然后找到 `rootwait`，在后面加一个空格，输入：

```text frame="code"
modules-load=dwc2,g_ether
```

其中：

- `dwc2`：启用 USB OTG / Gadget 控制器。
- `g_ether`：加载 USB 虚拟网卡 Gadget 模块。

确认没有产生换行后，保存退出。

## 配置虚拟网卡

在终端执行以下命令，为虚拟网卡（一般是 `usb0`，可以使用 `ip addr` 确认）创建一个共享网络配置：

```bash frame="terminal"
sudo nmcli connection add type ethernet ifname usb0 ipv4.method shared con-name usb_network
```

这个名为 `usb_network` 的网络配置会自动实现以下逻辑：

1. 在接入 iPad 或 PC 时，自动唤醒树莓派内置的轻量级 DHCP 服务

2. 将树莓派的该网卡 IP 固定为 `10.42.0.1`

3. 为接入的 iPad 或 PC 自动分配一个 `10.42.0.x` 的内网 IP，并打通两者之间的路由

## 启动虚拟网卡

依次输入输入以下命令启动虚拟网卡，并将刚才的 `usb_network` 配置绑定在虚拟网卡上：

```bash frame="terminal"
sudo ip link set usb0 up
sudo nmcli connection up usb_network
```

如果没有报错，说明虚拟网卡配置已经生效。可以通过如下命令查看 IP 地址，检验网卡配置：

```bash frame="terminal"
ip addr show usb0
```

正常情况下，应能看到类似 `inet 10.42.0.1/24` 的输出。

## 连接 iPad 或 PC

至此，所有的配置已完成。现在，你可以使用一根 Type-C 数据线直接连接树莓派与 iPad 或 PC 进行通信了。

连接后，对方设备会识别到一张 USB 以太网网卡，并自动通过 DHCP 获取 IP 地址。随后可以直接访问树莓派：

```bash frame="terminal"
ssh pi@10.42.0.1
```

如果你的系统用户名不是 `pi`，请替换为实际用户名。

也可以在浏览器中访问树莓派上运行的 Web 服务，例如：

```text frame="none"
http://10.42.0.1:<端口号>
```

