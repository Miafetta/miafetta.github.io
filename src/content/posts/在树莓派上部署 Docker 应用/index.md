---
title: "在树莓派上部署 Docker 应用"
published: 2026-05-21
description: "想把树莓派打造成一台轻量级家庭服务器？本文以 Raspberry Pi 4B 为例，整理 WatchTower、SakuraFrp、Syncthing 和 RabbitMQ 等常用 Docker 应用的部署方法，或许这些配置思路也可以迁移到其他 Docker 应用中~"
image: "./cover.jpg"
tags: ["Raspberry Pi", "Docker"]
category: "指南"
draft: false
numbering: H2
---

树莓派虽然个头不大，但拿来当一台轻量级家庭服务器非常合适：功耗低、体积小、噪音几乎没有，往角落里一塞就能默默干活。再配合 Docker，就可以很方便地部署各种常用服务，比如自动更新、内网穿透、文件同步、消息队列等。

本文以 Raspberry Pi 4B 为例，记录几个本人常用的 Docker 应用部署过程。整体目标很简单：**少折腾、好维护、方便备份**。

首先，所有 Docker 应用的数据都会统一存放在：

```text frame="none"
~/Docker/<应用名称>/
```

例如：

```text frame="none"
~/Docker/watchtower/
~/Docker/sakurafrp/
~/Docker/syncthing/
~/Docker/rabbitmq/
```

这样做的好处是目录结构清晰，后续迁移、备份、排查问题都比较方便。（小树莓派也需要收纳美学！）

> 本文默认你已经安装好 Docker 和 Docker Compose。如果尚未安装，可以先参考对应系统的 Docker 安装教程，如：[安装 Docker 及 Docker Compose](https://blog.miafetta.cafe/posts/rabbitmq消息队列入门与实践/#1-安装并配置-docker)。

## 自动更新：WatchTower

WatchTower 可以监控正在运行的 Docker 容器，并在镜像有新版本时自动拉取更新。对于树莓派这种“放在角落里长期运行”的设备来说，WatchTower 非常适合用来减少日常维护成本。

### 创建配置目录

创建并进入 `watchtower` 目录：

```bash frame="terminal"
mkdir -p ~/Docker/watchtower
cd ~/Docker/watchtower
```

### 编写 Compose 配置

创建 `docker-compose.yml`：

```bash frame="terminal"
nano docker-compose.yml
```

填入以下内容，注意将 `推送URL` 替换为自己的通知地址：

```yaml title="docker-compose.yml" frame="code"
services:
  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DOCKER_API_VERSION=1.44
      - WATCHTOWER_CLEANUP=true			# 更新后自动删除旧镜像，节省存储空间
      - WATCHTOWER_SCHEDULE=0 0 4 * * * # 使用 Cron 表达式，每天凌晨 4 点检查更新
      - TZ=Asia/Shanghai
      - WATCHTOWER_NOTIFICATIONS=shoutrrr
      - WATCHTOWER_NOTIFICATION_URL=推送URL
```

参数说明：

- `WATCHTOWER_CLEANUP=true`：更新后自动删除旧镜像，节省存储空间。
- `WATCHTOWER_SCHEDULE=0 0 4 * * *`：使用 Cron 表达式，表示每天凌晨 4 点检查更新。
- `WATCHTOWER_NOTIFICATIONS=shoutrrr`：启用 Shoutrrr 通知。
- `WATCHTOWER_NOTIFICATION_URL=推送URL`：通知服务地址。

树莓派的存储空间通常比较宝贵，建议保留 `WATCHTOWER_CLEANUP=true` 设置，避免旧镜像越来越多。

### 排除特定容器的更新

WatchTower 默认会尝试更新所有正在运行的容器，但有些服务可能不适合自动更新，例如数据库、生产环境服务等。

#### 黑名单模式

WatchTower 默认使用黑名单排除容器。可以在对应容器的 `docker-compose.yml` 里增加一个特殊的标签，将它排除在自动更新之外：

```yaml frame="code"
labels:
  - "com.centurylinklabs.watchtower.enable=false"
```

#### 白名单模式

反过来，也可以配置 WatchTower 使用白名单机制，只更新那些带了特定标签的容器。

在 WatchTower 的 `docker-compose.yml` 中 `enviroment` 下添加：

```yaml frame="code"
WATCHTOWER_LABEL_ENABLE=true
```

并且在允许自动更新的容器的 `docker-compose.yml` 里增加标签：

```yaml frame="code"
labels:
  - "com.centurylinklabs.watchtower.enable=true"
```

### 配置更新通知

Watchtower 内置了一个非常强大的消息推送引擎 Shoutrrr。它几乎支持市面上所有主流的通知渠道（包括 Telegram、钉钉、企业微信、飞书、Bark、邮件甚至自定义 Webhook）。

配置时，需要在 `docker-compose.yml` 中新增两个环境变量：

```yaml frame="code"
enviroment:
  - WATCHTOWER_NOTIFICATIONS=shoutrrr
  - WATCHTOWER_NOTIFICATION_URL=<推送URL>
```

常见推送方式如下。

#### 方案 A：Bark（iOS / iPadOS）

Bark 是一款极其轻量且保护隐私的消息推送工具。

1. 在 App Store 中下载 Bark

2. 打开 App，它会自动分发一个专属的推送 URL

3. 构造的 URL 格式为：`generic+<推送URL>?title=树莓派Docker更新通知`

#### 方案 B：Telegram

如果习惯使用 Telegram Bot 接收服务器通知，可以按以下步骤使用：

1. 通过 `@BotFather` 申请一个 Bot Token

2. 获取自己的 Chat ID

3. 构造的 URL 格式为： `telegram://<Bot Token>@telegram/?channels=<Chat ID>`

#### 方案 C：微信推送 (Server酱 / PushPlus 等 Webhook 服务)

如果想直接在微信里收到提醒，通常使用 Server酱 或 PushPlus。以 PushPlus 为例：

1. 登录 PushPlus 获取专属推送 Token

2. 使用通用 Webhook 格式构造请求： `generic+http://www.pushplus.plus/send?token=<Token>&title=树莓派更新&template=html&content=`

#### 方案 D：传统邮件推送 (SMTP)

也可以使用 SMTP 发送邮件通知。以 QQ 邮箱为例，URL 格式为： `smtp://<发送方QQ号>%40qq.com:<SMTP授权码>@smtp.qq.com:465/?fromaddress=<发送方QQ号>%40qq.com&toaddresses=<接收方QQ号>%40qq.com&encryption=Auto`

### 测试通知

如果想立刻测试通知，可以通过以下命令让 WatchTower 立刻强制执行一次检查并发送通知：

```bash frame="terminal" wrap
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -e WATCHTOWER_NOTIFICATIONS=shoutrrr \
  -e WATCHTOWER_NOTIFICATION_URL="推送URL" \
  containrrr/watchtower --run-once
```

### 启动服务

执行 `docker compose up -d`，启动容器。

启动后，WatchTower 将在后台运行，并在每天凌晨 4 点拉取最新镜像。如果有容器被更新，它会通过配置的推送服务发送通知。

## 内网穿透：SakuraFrp

SakuraFrp 可以让位于内网中的树莓派被公网访问。它适合用来远程访问 SSH、Web 服务、管理后台等场景。当然，你也可以通过个人域名 + Cloudflare Tunnel 进行访问，但灵活度没有 frp 服务这么高。

### 创建配置目录

创建并进入 `sakurafrp` 目录：

```bash frame="terminal"
mkdir -p ~/Docker/sakurafrp
cd ~/Docker/sakurafrp
```

### 编写 Compose 配置

创建 `docker-compose.yml`：

```bash frame="terminal"
nano docker-compose.yml
```

填入以下内容（注意根据实际情况修改 `NATFRP_TOKEN`  和 `NATFRP_REMOTE`）：

```yaml title="docker-compose.yml" frame="code"
services:
  sakurafrp:
    image: natfrp.com/launcher:latest
    container_name: sakurafrp
    network_mode: host
    restart: always
    environment:
      - NATFRP_TOKEN=TokenFromSakuraFrp	# 从SakuraFrp控制面板获得的访问密钥
      - NATFRP_REMOTE=YourPasswordHere	# 远程访问密码（至少8位）
      - TZ=Asia/Shanghai
      - LANG=zh_CN.UTF-8
    volumes:
      - ./data:/run:z
```

参数说明：

- `NATFRP_TOKEN`：从 SakuraFrp 控制面板获取的访问密钥。
- `NATFRP_REMOTE`：远程访问密码，至少 8 位。
- `network_mode: host`：使用宿主机网络，便于 SakuraFrp 发现和转发本机服务。
- `./data:/run:z`：持久化运行数据。

### 启动服务

执行 `docker compose up -d`，启动容器。

随后，可通过 `docker logs -f sakurafrp` 查询 WebUI 密码，并且在局域网内通过浏览器访问 `https://<树莓派IP>:7102` 进入 WebUI 进行管理；或者通过访问 `https://www.natfrp.com/remote/v2` 使用 SakuraFrp 远程管理。

## 文件同步：Syncthing

Syncthing 是一款强大的跨平台点对点文件同步工具。它不依赖中心服务器，可以在多台设备之间直接同步文件。

它很适合用来做：

- 手机照片同步
- 多设备文档同步
- 轻量备份
- 局域网文件同步
- 小型家庭 NAS 的补充方案

### 创建配置目录

创建并进入 `syncthing` 目录：

```bash frame="terminal"
mkdir -p ~/Docker/syncthing
cd ~/Docker/syncthing
```

### 编写 Compose 配置

创建 `docker-compose.yml`：

```bash frame="terminal"
nano docker-compose.yml
```

填入以下内容：

```yaml title="docker-compose.yml" frame="code"
services:
  syncthing:
    image: linuxserver/syncthing:latest
    container_name: syncthing
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Asia/Shanghai
    volumes:
      - ./config:/config
      - ./data:/data
    ports:
      - "8384:8384"
      - "22000:22000/tcp"
      - "22000:22000/udp"
      - "21027:21027/udp"
    restart: unless-stopped
```

参数说明：

- `PUID=1000`、`PGID=1000`：指定容器内运行用户对应宿主机用户，一般树莓派默认用户的 UID/GID 为 `1000`。
- `./config:/config`：保存 Syncthing 配置。
- `./data:/data`：作为默认同步数据目录。
- `8384`：Web 管理界面端口。
- `22000`：设备之间同步数据的端口。
- `21027/udp`：局域网设备发现端口。

如果不确定当前用户的 UID 和 GID，可以运行：

```bash frame="terminal"
id
```

### 启动服务

执行 `docker compose up -d`，启动容器。

启动成功后，可以通过浏览器访问 `http://<树莓派IP>:8384` 进入图形化管理界面，进行设备配对与文件夹同步设置。

## 消息队列：RabbitMQ

RabbitMQ 是一个由 Erlang 语言开发的 AMQP 的开源实现，常用于应用解耦、异步任务、日志收集、事件分发等场景。具体可以参考 [RabbitMQ：消息队列入门与实践](https://blog.miafetta.cafe/posts/rabbitmq消息队列入门与实践/)。

在树莓派上部署 RabbitMQ，可以用于本地开发测试、小型自动化系统、IoT 消息中转等场景。虽然树莓派不是高性能服务器，但跑一些轻量消息队列任务还是没问题的——只要别指望它一边跑满队列一边顺手训练大模型。

本文使用了带有 Management 插件的版本（标签带 `-management`），以便在浏览器中直接查看队列状态。

### 创建配置目录

由于映射了单文件 `rabbitmq.conf`，必须在启动前手动创建宿主机目录和空文件，否则 Docker 会错误地将其创建为文件夹：

```bash frame="terminal"
mkdir -p ~/Docker/rabbitmq/{data,config,logs}
cd ~/Docker/rabbitmq
touch ./config/rabbitmq.conf
sudo chown -R 999:999 ./data ./logs
```

其中：

- `data`：保存 RabbitMQ 数据。
- `config`：保存 RabbitMQ 配置文件。
- `logs`：保存日志文件。
- `999:999`：RabbitMQ 容器内默认用户通常使用的 UID/GID。

### 编写 Compose 配置

创建 `docker-compose.yml`：

```bash frame="terminal"
nano docker-compose.yml
```

然后填入以下内容：

```yaml title="docker-compose.yml" frame="code"
services:
  rabbitmq:
     # 镜像名
    image: rabbitmq:4-management
    # 容器名
    container_name: rabbitmq
    # 主机名
    hostname: rabbitmq-server
    # 重启策略
    restart: unless-stopped
    # 端口映射
    ports:
      - "5672:5672"      # AMQP 协议端口
      - "15672:15672"    # 管理界面 Web 端口
    # 环境变量
    environment:
      # 默认用户配置
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=admin
      # Erlang cookie
      - RABBITMQ_ERLANG_COOKIE=secret_cookie_debian
      # 日志位置
      - RABBITMQ_LOGS=/var/log/rabbitmq/rabbitmq.log
      - RABBITMQ_SASL_LOGS=/var/log/rabbitmq/rabbitmq-sasl.log
    # 卷挂载
    volumes:
      # 数据持久化
      - ./data:/var/lib/rabbitmq
      # 日志持久化
      - ./logs:/var/log/rabbitmq
      # 自定义配置文件
      - ./config/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf
    # 容器间通信网络
    networks:
      - rabbitmq-network

networks:
  rabbitmq-network:
    name: rabbitmq-network
    driver: bridge
```

端口说明：

- `5672`：AMQP 协议端口，应用程序通过该端口连接 RabbitMQ。
- `15672`：RabbitMQ Management Web 管理界面端口。

环境变量说明：

- `RABBITMQ_DEFAULT_USER=admin`：默认管理员用户名。
- `RABBITMQ_DEFAULT_PASS=admin`：默认管理员密码。
- `RABBITMQ_ERLANG_COOKIE`：Erlang Cookie，集群通信时会用到。单节点也建议固定下来，避免后续迁移时出现问题。
- `RABBITMQ_LOGS`：普通日志路径。
- `RABBITMQ_SASL_LOGS`：SASL 日志路径。

> [!WARNING]
>
> 如果 RabbitMQ 会暴露到公网，务必修改默认用户名和密码。`admin/admin` 只适合本地测试，不适合正式环境。

### 启动服务

执行 `docker compose up -d`，启动容器。

随后可以通过浏览器访问 `http://<树莓派IP>:15672`，使用配置中的用户名 `admin` 和密码 `admin` 登录管理后台。进入管理后台后，可以查看队列、交换机、连接、通道、用户和虚拟主机等信息。

## 常用维护命令

所有服务都使用 Docker Compose 部署，因此日常维护命令基本一致。

进入对应应用目录后，例如：

```bash frame="terminal"
cd ~/Docker/syncthing
```

启动服务：

```bash frame="terminal"
docker compose up -d
```

停止服务：

```bash frame="terminal"
docker compose down
```

查看日志：

```bash frame="terminal"
docker compose logs -f
```

拉取最新镜像：

```bash frame="terminal"
docker compose pull
```

重新创建容器：

```bash frame="terminal"
docker compose up -d
```

查看当前运行中的容器：

```bash frame="terminal"
docker ps
```

查看所有容器，包括已停止的容器：

```bash frame="terminal"
docker ps -a
```

清理未使用的镜像：

```bash frame="terminal"
docker image prune
```

如果想清理所有未使用的 Docker 资源：

```bash frame="terminal"
docker system prune
```

该命令会删除未使用的网络、镜像、构建缓存等资源。运行前请确认自己知道自己在做什么、它会删什么。

## 备份建议

由于本文所有服务都统一放在 `~/Docker/` 下，所以备份也比较简单。

可以直接备份整个目录：

```bash frame="terminal"
tar -czvf docker-backup.tar.gz ~/Docker
```

或者只备份某个服务：

```bash frame="terminal"
tar -czvf syncthing-backup.tar.gz ~/Docker/syncthing
```

如果服务正在运行，建议先停止对应容器再备份，尤其是 RabbitMQ 这类有状态服务：

```bash frame="terminal"
cd ~/Docker/rabbitmq
docker compose down
tar -czvf rabbitmq-backup.tar.gz ~/Docker/rabbitmq
docker compose up -d
```

对于重要数据，建议定期备份到其他设备中。

## 总结

完成以上配置后，树莓派就可以承担一些轻量级家庭服务器任务：

- 使用 WatchTower 自动更新 Docker 容器
- 使用 SakuraFrp 实现远程访问
- 使用 Syncthing 进行多设备文件同步
- 使用 RabbitMQ 提供消息队列服务

这些服务都不算重，非常适合运行在 Raspberry Pi 4B 这类低功耗设备上。后续如果需要扩展，也可以继续在 `~/Docker/` 目录下添加新的应用目录，让树莓派慢慢成长为一台安静、实用、略带可爱的家庭服务器。
