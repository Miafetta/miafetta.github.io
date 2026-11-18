---
title: "使用 New API 统一管理 AI 订阅与 API"
published: 2026-11-19
updated: 2026-11-19
description: "订阅额度用完后只能干等？本文记录如何用 New API、CLIProxyAPI 和 codex-proxy-rs 管理订阅账号与各平台 API，并在额度不足时自动切换渠道。"
image: "./cover.jpg"
coverCredit:
  text: "默椏_Myoasis / 祀"
  url: "https://www.pixiv.net/artworks/147773196"
tags: ["AI", "自托管", "New API", "Docker"]
category: "指南"
draft: false
numbering: H2
---

随着 AI 工具逐渐融入日常开发，订阅账号几乎成了必需品。以 Claude 和 ChatGPT 为例，订阅账号不仅附带了可观的使用额度，还支持通过 APP 远程控制电脑上的会话，即使出门在外，也可以让 AI 继续工作。然而，订阅账号的额度是按每 5 小时 / 每周窗口计算的，一旦窗口内的额度用完，在重置之前就什么也做不了，手头的工作也只能被迫中断，剩下的就只有盯着倒计时发呆了。

最直接的办法，是在额度用完时手动切换到官方 API。但对于 ChatGPT 来说，这条路并不好走：直接在 Codex 的 `config.toml` 中切换 `model_provider`，会导致原先的会话无法继续使用，聊到一半的上下文只能从头再来。因此，更合适的做法是让客户端始终连接同一个 API 中转站：订阅额度充足时优先使用订阅，额度不足时再由中转站自动切换到按量计费的官方 API，客户端这边什么都不用改。

> [!NOTE]
>
> Codex 的配置保存在 `~/.codex/` 目录下：`config.toml` 负责基本配置，其中就包括模型提供商 `model_provider`（只有 `openai` 会被识别为官方，其他值一律视作第三方中转站，连大小写不同的 `OpenAI` 也不例外）；`auth.json` 则负责保存登录凭据。由于模型提供商和登录凭据是相互独立的，可以在 `[model_providers.<provider_name>]` 中加入 `requires_openai_auth = true`，这样在使用中转站的同时，也能保留登录状态下的绝大部分功能。
>
> 不过，很多中转站都设置了模型白名单，而 Codex 自动命名会话时调用的 luna 系列模型通常不在其中。一方面，这类模型价格低廉、能力较差、使用的人很少；另一方面，luna 系列模型似乎是 OpenAI 官方风控的重点。因此，完全使用中转站时，会话一般只会显示默认名称（也就是该会话的第一条提示词），需要自己手动整理。
>
> 此外，当登录账号的 5 小时额度或周额度归零时，Codex 会直接禁止发送消息。所以最好给账号留出一部分余量，这也是本文要为 Codex 设置额度门槛、提前暂停订阅调用的原因之一。

随着接入的 API 来源和模型越来越多，每个平台都有各自的 Key 和接口地址，时间一长，光是记清楚哪个 Key 属于哪个平台就够头疼的了。于是，自建一个 New API 站，把订阅账号和各平台的 API 统一收拢到同一个入口下管理，也就成了顺理成章的选择。

本文以 Ubuntu 服务器为例，记录使用 New API、CLIProxyAPI 和 codex-proxy-rs 搭建个人 AI 中转站的过程，包括订阅账号托管、固定代理出口、失败自动降级，以及 Codex 的额度预留。Claude 则不设置预留，在订阅额度用尽后切换到 API。

> [!NOTE]
>
> Claude 不设置预留，是因为一方面国内基本无法使用 Claude 的 APP，很容易被 Anthropic 封号；另一方面，即使额度归零了，Claude Code 也不会禁止发送消息。

需要注意的是，这几个项目的迭代速度都比较快，不同版本的配置项和界面可能会有所差异。本文更偏向个人自用环境下的完整配置记录，可按需参考，具体以各项目的官方文档为准。

> [!WARNING]
>
> 本文仅记录个人自用场景下的技术实践，不构成任何使用建议。通过第三方工具转发订阅账号的请求，可能违反相关服务的使用条款，存在账号受限或被封禁的风险。请在充分了解相关条款后自行判断，由此产生的一切后果由使用者自行承担。
>
> 请勿将订阅账号共享、转售或用于对外提供服务。本文涉及的开源项目均与 Anthropic、OpenAI 等官方无关。本人不出售或提供任何 AI 相关服务，本文仅作技术分享。

## 方案概览

整套方案由三个部分组成：

- **New API**：作为统一入口，管理调用令牌、渠道与模型，并在请求失败时切换到其他渠道。
- **CLIProxyAPI**：负责 Claude 订阅账号的 OAuth 登录、令牌刷新和请求转发。下文简称 CPA，统一使用远端代理，不设置额度预留。
- **codex-proxy-rs**：负责 Codex 订阅账号及其固定代理出口，并通过内置额度门槛，在 5 小时用量达到 95% 或周用量达到 98% 时暂停调度。下文简称 CPR。

::github{repo="QuantumNous/new-api"}

::github{repo="router-for-me/CLIProxyAPI"}

::github{repo="zyycn/codex-proxy-rs"}

请求的转发路径如下：

![架构图](./media/架构图.png)

当订阅渠道返回失败时，New API 会尝试同名模型的付费渠道。这个过程不需要客户端切换地址，对于客户端来说只是一次稍慢一些的响应。

在开始之前，请确认：

- 已有一台能够访问 Claude 和 ChatGPT 的 Linux 服务器，并已安装 Docker 与 Docker Compose（安装方法可以参考：[在 Linux 中安装 Docker](/posts/docker-与-docker-compose入门与实践/#在-linux-中安装-docker)）
- 服务器上已经运行 Caddy 等反向代理服务，并准备好一个域名（下文以 `ai.example.com` 为例）
- 如果使用代理，则需要准备好代理出口：本机的代理客户端（本文以 mihomo 为例），或是远端 HTTP 代理
- 云服务器的安全组放行 TCP `22`、`80` 和 `443` 端口，按需放行 UDP `443` 端口

本文中所有服务的数据统一存放在 `~/docker/<服务名>/` 目录下，方便后续备份和迁移。

## 准备网络与代理

### 创建共享网络

New API、CPA 和 CPR 分别由不同的 Compose 启动，默认情况下无法相互访问，因此需要创建一个共享网络，让 New API 能用容器名访问 CPA 和 CPR。请选用与现有网络不重叠的网段，这里使用 `172.30.0.0/24`：

```bash
docker network create --subnet 172.30.0.0/24 ai-network
mkdir -p ~/docker/{cli-proxy-api/{auths,logs,plugins},codex-proxy-rs/deploy,new-api}
```

### 让容器访问本机代理

> 服务器能直接访问 Anthropic 和 OpenAI 时，创建共享网络后即可进入[部署 New API](#部署-new-api)，并在后续配置中留空账号代理。只用远端代理时，可以跳转到[测试远端代理](#远端代理)。

容器里的 `127.0.0.1` 始终指向容器自身，因此无法访问宿主机上只监听回环地址 `127.0.0.1` 的代理。

一个比较简洁的做法是，让 mihomo 额外监听 Docker 网关地址（通常为 `docker0` 的 `172.17.0.1`）。这样一来，容器可以访问代理，公网却无法访问，也不需要再引入 socat 之类的转发工具。

在修改配置之前，需要先确认 mihomo 的运行方式，因为这会影响后面处理启动顺序的方法：

- **系统级服务**：服务文件位于 `/etc/systemd/system/` 下，通过 `sudo systemctl` 管理。这种情况下，只需要在服务的 `[Unit]` 中添加 `After=docker.service`，就能保证 mihomo 在 Docker 之后启动。
- **用户级服务**：服务文件位于 `~/.config/systemd/user/` 下，通过 `systemctl --user` 管理。用户级服务无法通过 `After=docker.service` 排在系统服务之后，需要改用下文的等待脚本；同时还需要执行 `loginctl enable-linger $USER` 开启 Linger，才能在用户未登录时开机自启。

本文以用户级服务为例。

### 添加 Docker 监听

在 mihomo 的 `config.yaml` 中找到 `listeners`，在 `listeners` 中添加：

```yaml title="config.yaml" showLineNumbers ins={2-6}
listeners:
  - name: docker-proxy
    type: http
    listen: 172.17.0.1  # 换成本机 docker0 的地址
    port: 7890          # 选用空闲端口，防火墙规则和账号代理也要使用这个端口
    proxy: <固定节点名>  # 直接选择节点，避免策略组自动更换出口
```

其中：

- `listen`：绑定 Docker 网关地址；
- `port`：listener 的监听端口。本文沿用 mihomo 常见的 `7890`，也可以换成其他未被占用的端口；
- `proxy`：需要指向单个固定节点。如果指向 `url-test`、`fallback` 等会自动切换节点的策略组，账号的出口 IP 也会随之变化。

### 处理启动顺序

`docker0` 网卡是由 Docker 创建的。如果 mihomo 先于 Docker 启动，就会因为找不到该地址而绑定失败。对于系统级服务，添加 `After=docker.service` 即可；对于用户级服务，则需要在 mihomo 启动前加入一个等待脚本。

创建 `~/.local/bin/wait-docker0.sh`：

```bash
nano ~/.local/bin/wait-docker0.sh
```

写入以下内容：

```bash title="~/.local/bin/wait-docker0.sh" showLineNumbers
#!/usr/bin/env bash
set -euo pipefail

for ((i=0; i<120; i++)); do
    if ip -4 -o addr show dev docker0 2>/dev/null \
        | grep -q 'inet 172\.17\.0\.1/'; then
        echo "Docker bridge 172.17.0.1 is ready"
        exit 0
    fi

    sleep 1
done

echo "ERROR: Docker bridge 172.17.0.1 not ready" >&2
exit 1
```

脚本每秒检查一次 `docker0` 上是否已经出现 `172.17.0.1`，最多等待 120 秒；超时后输出错误信息并以非零状态退出，便于在日志中定位问题。

然后为脚本添加执行权限：

```bash
chmod +x ~/.local/bin/wait-docker0.sh
```

最后，使用 `systemctl --user edit mihomo` 编辑 mihomo 服务，写入：

```ini title="override.conf" showLineNumbers
[Service]
ExecStartPre=%h/.local/bin/wait-docker0.sh
TimeoutStartSec=150s
Restart=on-failure
RestartSec=10s
```

其中：

- `ExecStartPre`：在启动 mihomo 之前先运行等待脚本。
- `TimeoutStartSec=150s`：脚本最多等待 120 秒，因此启动超时时间要设置得比它更长。
- `Restart=on-failure`、`RestartSec=10s`：如果启动失败，10 秒后自动重试。

保存后重启 mihomo，并确认 listener 已经生效：

```bash
systemctl --user restart mihomo
ss -lntp | grep 172.17.0.1
```

如果输出中包含 `172.17.0.1:7890`，说明 listener 已经开始监听。

### 确认代理出口

配置好代理后，需要分别确认每个出口都能正常工作，各自返回的公网 IP 也应与对应节点一致。

#### 本地代理

如果按照前文方式配置了本地代理，首先在宿主机上测试 listener：

```bash
curl -s -x http://172.17.0.1:7890 https://api.ipify.org; echo
```

正常情况下，会返回 listener 所指定节点的 IP，并且多次运行的结果保持不变。

从共享网络中再测试一次：

```bash
docker run --rm --network ai-network --add-host=host.docker.internal:host-gateway \
  curlimages/curl -sS -m 10 -x http://host.docker.internal:7890 https://api.ipify.org; echo
```

如果返回的 IP 与宿主机上一致，说明容器已经可以正常使用本地代理；如果连接失败，请检查以下几处：

- 如果 mihomo 设置了 `lan-allowed-ips`，需要将 `172.30.0.0/24` 加入其中；
- 如果使用 ufw，执行 `sudo ufw allow from 172.30.0.0/24 to 172.17.0.1 port 7890 proto tcp`；
- 如果使用 iptables 管理防火墙，需要在 INPUT 链中放行该网段，具体见[放行 iptables 防火墙](#放行-iptables-防火墙)。

#### 远端代理

使用如下命令测试远端代理：

```bash
# 如果密码中含有 `@`、`:`、`/`、`#`、`%` 等字符，需要先进行 URL 编码（例如 `@` 写作 `%40`）
curl -s -x "http://<用户名>:<密码>@<远端代理地址>:<端口>" https://api.ipify.org; echo
```

正常情况下，会返回远端代理的出口 IP，并且多次运行的结果保持不变。

### 放行 iptables 防火墙

> 如果前面在共享网络中的测试已经能够正常返回 IP，或者只使用远端代理，可以跳转到[部署 New API](#部署-new-api)。

部分云服务器镜像（例如 Oracle Cloud 提供的 Ubuntu 镜像）默认使用 iptables，并在 INPUT 链的末尾添加了一条拒绝规则，立即拒绝所有未被明确放行的连接：

```text title="/etc/iptables/rules.v4" showLineNumbers
-A INPUT -j REJECT --reject-with icmp-host-prohibited
```

此时 curl 会直接报错 `(7) Could not connect to server`，而不是等待超时。

这类镜像通常通过 `netfilter-persistent` 在开机时加载 `/etc/iptables/rules.v4`，因此需要把放行规则写进该配置文件。编辑 `rules.v4`：

```bash
sudo nano /etc/iptables/rules.v4
```

在 `-A INPUT -j REJECT` 这一行之前加入：

```text title="/etc/iptables/rules.v4" showLineNumbers ins={1-2}
# 仅允许自建 Docker 网桥上的共享网段访问 mihomo 监听端口
-A INPUT -i br+ -s 172.30.0.0/24 -d 172.17.0.1/32 -p tcp -m tcp --dport 7890 -j ACCEPT
```

> [!NOTE]
>
> 如果 Caddy 的 `80`、`443` 端口通过其他脚本临时放行，建议一并写进 `rules.v4`，统一在一个地方维护：
>
> ```text title="/etc/iptables/rules.v4" showLineNumbers ins={1-4}
> # TCP 80/443 用于 HTTP/HTTPS；需要 HTTP/3 时也放行 UDP 443
> -A INPUT -p tcp -m state --state NEW -m tcp --dport 80 -j ACCEPT
> -A INPUT -p tcp -m state --state NEW -m tcp --dport 443 -j ACCEPT
> -A INPUT -p udp -m udp --dport 443 -j ACCEPT
> ```

修改完成后，先检查配置文件的语法：

```bash
sudo iptables-restore --test < /etc/iptables/rules.v4 && echo OK
```

如果输出 `OK`，可以使用 `iptables -I` 让新规则立即生效（参数与写入文件的规则相同）：

```bash
sudo iptables -I INPUT -i br+ -s 172.30.0.0/24 -d 172.17.0.1/32 -p tcp -m tcp --dport 7890 -j ACCEPT
```

或者直接重启服务器，再通过 `sudo iptables -S INPUT` 确认规则已经加载。

> [!WARNING]
>
> 不要使用 `netfilter-persistent reload` 或 `iptables-restore < /etc/iptables/rules.v4` 来立即应用规则。它们会清空整个 filter 表，同时清除 Docker 启动后自动添加的规则，导致容器网络中断。

## 部署 New API

进入部署目录，下载 New API 官方的 [Compose 文件](https://raw.githubusercontent.com/QuantumNous/new-api/main/docker-compose.yml)：

```bash
cd ~/docker/new-api
curl -fsSLO https://raw.githubusercontent.com/QuantumNous/new-api/main/docker-compose.yml
```

首先，使用 `openssl` 生成密码和会话密钥：

```bash
openssl rand -hex 16   # 生成 PostgreSQL 密码
openssl rand -hex 16   # 生成 Redis 密码
openssl rand -hex 32   # 生成 SESSION_SECRET
```

然后修改下载的 `docker-compose.yml`：

```yaml title="docker-compose.yml" showLineNumbers ins={11,12,18,19,25,26,32,33,37,38,40,41,43,44,46,47,62,63,75,76,87,88,103,104,105} del={10,17,24,31,36,39,42,45,74,86}
version: '3.4'

services:
  new-api:
    image: calciumion/new-api:latest
    container_name: new-api
    restart: always
    command: --log-dir /app/logs
    ports:
      - "3000:3000"
      # 只向宿主机开放端口，由 Caddy 提供 HTTPS 入口
      - "127.0.0.1:3000:3000"
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    environment:
      - SQL_DSN=postgresql://root:123456@postgres:5432/new-api
      # 与下方 POSTGRES_PASSWORD 使用同一个 PostgreSQL 随机密码
      - SQL_DSN=postgresql://root:<PG密码>@postgres:5432/new-api
#      - SQL_DSN=root:123456@tcp(mysql:3306)/new-api
#      - LOG_SQL_DSN=postgresql://root:123456@postgres:5432/new-api-log
#      - LOG_SQL_DSN=clickhouse://default:123456@clickhouse:9000/new_api_logs
#      - LOG_SQL_CLICKHOUSE_TTL_DAYS=0
      - REDIS_CONN_STRING=redis://:123456@redis:6379
      # 与 Redis 的 --requirepass 使用同一个 Redis 随机密码
      - REDIS_CONN_STRING=redis://:<Redis密码>@redis:6379
      - TZ=Asia/Shanghai
      - ERROR_LOG_ENABLED=true
      - BATCH_UPDATE_ENABLED=true
      - NODE_NAME=new-api-node-1
#      - DEFAULT_LANGUAGE=zh-CN
      # 默认界面、日志和提示使用简体中文
      - DEFAULT_LANGUAGE=zh-CN
#      - STREAMING_TIMEOUT=300
#      - RELAY_IDLE_CONN_TIMEOUT=90
#      - SESSION_SECRET=random_string
      # 固定会话密钥，避免会话失效
      - SESSION_SECRET=<会话密钥>
#      - SESSION_COOKIE_SECURE=true
      # 站点通过 HTTPS 访问，只通过 HTTPS 发送会话 Cookie
      - SESSION_COOKIE_SECURE=true
#      - SESSION_COOKIE_TRUSTED_URL=https://example.com,https://admin.example.com
      # 换成实际站点的 HTTPS Origin，用于刷新和退出校验
      - SESSION_COOKIE_TRUSTED_URL=https://ai.example.com
#      - TRUSTED_PROXIES=172.20.0.0/16
      # 信任 Docker 网段内反向代理转发的 X-Forwarded-* 信息
      - TRUSTED_PROXIES=172.16.0.0/12
#      - USER_SESSION_ACTIVE_LIMIT=50
#      - USER_SESSION_ISSUANCE_LIMIT=100
#      - USER_SESSION_ISSUANCE_WINDOW_SECONDS=86400
#      - USER_SESSION_REVOKED_RETENTION_DAYS=7
#      - USER_SESSION_HOURLY_ALERT_THRESHOLD=5000
#      - SYNC_FREQUENCY=60
#      - GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
#      - UMAMI_WEBSITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#      - UMAMI_SCRIPT_URL=https://analytics.umami.is/script.js
    depends_on:
      - redis
      - postgres
    networks:
      - new-api-network
      # New API 加入共享网络以访问 CPA 和 CPR
      - ai-network
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://localhost:3000/api/status | grep -o '\"success\":\\s*true' || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:latest
    container_name: redis
    restart: always
    command: ["redis-server", "--requirepass", "123456"]
    # 密码与上方 REDIS_CONN_STRING 保持一致
    command: ["redis-server", "--requirepass", "<Redis密码>"]
    networks:
      - new-api-network

  postgres:
    image: postgres:15
    container_name: postgres
    restart: always
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: 123456
      # 密码与上方 SQL_DSN 保持一致
      POSTGRES_PASSWORD: <PG密码>
      POSTGRES_DB: new-api
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - new-api-network
#    ports:
#      - "5432:5432"

volumes:
  pg_data:

networks:
  new-api-network:
    driver: bridge
  # 复用前文已创建的共享网络，不由此 Compose 创建
  ai-network:
    external: true
```

接着执行以下命令启动并检查容器：

```bash
docker compose up -d
docker compose ps
```

> [!TIP]
>
> 如果 Compose 提示 `postgres` 或 `redis` 容器名已被占用，需要修改对应的 `container_name`。Compose 内部仍通过服务名 `postgres` 和 `redis` 连接。

## 部署 CLIProxyAPI

进入先前创建的 `cli-proxy-api` 目录，下载官方 Compose 文件和配置模板，并复制一份配置文件：

```bash
cd ~/docker/cli-proxy-api
curl -fsSLO https://raw.githubusercontent.com/router-for-me/CLIProxyAPI/main/docker-compose.yml
curl -fsSLO https://raw.githubusercontent.com/router-for-me/CLIProxyAPI/main/config.example.yaml
cp config.example.yaml config.yaml
```

### 编辑 CPA 配置

在 `config.yaml` 中分别填写管理密钥、供 New API 使用的调用密钥，以及 Claude 账号的代理地址：

```yaml title="config.yaml" showLineNumbers ins={41,42,45,46,55,56,71,72,77,78,89,90} del={40,44,54,57,58,70,76,88}
config-version: 8

models:
  catalog: ""
  codex-catalog: ""
  devin-catalog: ""

server:
  host: ""

  port: 8317

  max-request-body-bytes: 0

  response-compression:
    enabled: true
    min-bytes: 1024

  github-token: ""

  trusted-proxies: []

  shutdown-timeout: 0

  tls:
    enable: false
    cert: ""
    key: ""

  commercial-mode: false

  discovery:
    enabled: false

  kv-store:
    disabled: false
    path: ""

management:
  allow-remote: false
  # 管理请求经 Docker 端口映射进入容器，需要允许容器外访问
  allow-remote: true

  secret-key: ""
  # 单独生成管理密钥，与下方调用密钥分开保存
  secret-key: "<管理密钥>"

  disable-control-panel: false

  panel-github-repository: "https://github.com/router-for-me/Cli-Proxy-API-Management-Center"

access:
  api-keys:
    - "your-api-key-1"
    # 用 openssl rand -hex 32 生成，只供 New API 调用
    - "<sk-cpa-长随机串>"
    - "your-api-key-2"
    - "your-api-key-3"

routing:
  strategy: "round-robin" # round-robin (default), weighted-round-robin, fill-first
  session-affinity: false # default: false
  session-affinity-ttl: "1h"
  session-affinity-subagents: true
  session-affinity-rebind-on: "any"

  force-model-prefix: false

  retry:
    request-retry: 3
    # 让上游错误及时返回 New API，由网关判断是否重试
    request-retry: 0

    max-retry-credentials: 0

    max-retry-interval: 30
    # 不在 CPA 内等待凭证冷却
    max-retry-interval: 0

  cooldown:
    disable-cooling: false

    save-cooldown-status: false

    transient-error-cooldown-seconds: 0

requests:
  proxy-url: ""
  # CPA 只托管 Claude，登录、刷新和推理统一使用远端代理
  proxy-url: "http://<用户名>:<URL编码后的密码>@<远端代理地址>:<端口>"

  tls-handshake-timeout-seconds: 0

  passthrough-headers: false

  nonstream-keepalive-interval: 0

client:
  codex:
    enable-apply-patch: false
    optimize-multi-agent-v2: false
    web-search-result-cache:
      enabled: false
      ttl: "24h"
      limit: 1024

  claude:
    show-codex-commentary: false

upstream:
  codex:
    response-steering: false
    upstream-request-compression: false
    upstream-request-compression-min-bytes: 1024
    websocket-compression: true
    disable-codex-cloaking: false
    stream-bootstrap-buffering: false
    stream-bootstrap-timeout: "0"
    orphan-delegation-compatibility: false
    model-level-cooling: false

  claude:
    model-level-cooling: false

    tool-search: false

    server-side-fallback: false

    session-date-pin-days: 7

    disable-claude-cloak-mode: false

    disable-cloaking-model-list: false

  xai:
    inject-x-search: false

oauth:
  auth-dir: "~/.cli-proxy-api"

  providers:
    aistudio:
      ws-auth: true

    codex:
      live-media-relay:
        enabled: false
        max-sessions: 32
        disable-private-remote-ips: false
        public-ip: ""
        udp-port-min: 0
        udp-port-max: 0

      signin-with-chatgpt-identifier: "CLIProxyAPI"

    antigravity:
      antigravity-credits: true

multimedia:
  disable-image-generation: false

  video-result-auth-cache-ttl: "3h"

observability:
  logs:
    debug: false

    logging-to-file: false

    logs-max-total-size-mb: 0

    error-logs-max-files: 10

    request-log: false

  usage:
    usage-statistics-enabled: false

    redis-usage-queue-retention-seconds: 60

  pprof:
    enable: false
    addr: "127.0.0.1:8316"

plugins:
  enabled: false
  dir: "plugins"

  configs:
    example:
      enabled: true
      priority: 1
      config1: true
      config2: "string"
      config3: 3
      mode: "safe" # enum example: safe, fast
      config-list: ["a", "b"]
      config-object:
        mode: "safe"
```

### 编辑 CPA Compose 配置

修改 CPA 的 `docker-compose.yml`：

```yaml title="docker-compose.yml" showLineNumbers ins={16,18,20,22,24,26,28,36,37,38,39,40} del={17,19,21,23,25,27}
services:
  cli-proxy-api:
    image: ${CLI_PROXY_IMAGE:-eceasy/cli-proxy-api:latest}
    pull_policy: always
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VERSION: ${VERSION:-dev}
        COMMIT: ${COMMIT:-none}
        BUILD_DATE: ${BUILD_DATE:-unknown}
    container_name: cli-proxy-api
    environment:
      DEPLOY: ${DEPLOY:-}
    ports:
      # 服务端口和登录回调端口均只向宿主机开放
      - "8317:8317"
      - "127.0.0.1:8317:8317"
      - "8085:8085"
      - "127.0.0.1:8085:8085"
      - "1455:1455"
      - "127.0.0.1:1455:1455"
      - "54545:54545"
      - "127.0.0.1:54545:54545"
      - "51121:51121"
      - "127.0.0.1:51121:51121"
      - "11451:11451"
      - "127.0.0.1:11451:11451"
    volumes:
      - ${CLI_PROXY_CONFIG_PATH:-./config.yaml}:/CLIProxyAPI/config.yaml
      - ${CLI_PROXY_AUTH_PATH:-./auths}:/root/.cli-proxy-api
      - ${CLI_PROXY_LOG_PATH:-./logs}:/CLIProxyAPI/logs
      - ${CLI_PROXY_PLUGIN_PATH:-./plugins}:/CLIProxyAPI/plugins
    restart: unless-stopped

# New API 通过共享网络访问 CPA
networks:
  default:
    external: true
    name: ai-network
```

### 启动 CPA

拉取预构建镜像后，以 `--no-build` 启动：

```bash
chmod 600 config.yaml
docker compose pull && docker compose up -d --no-build
```

## 部署 codex-proxy-rs

接下来部署负责 Codex 订阅账号的 CPR。它自带账号管理、代理配置和额度门槛。

### 下载部署文件

进入先前创建的目录，下载同一正式版本的 Compose 文件和配置模板。本文以 `v3.52.0` 为例，后续升级时，请将文件和镜像一起更新，不要混用 `main` 分支的模板与旧版镜像：

```bash
cd ~/docker/codex-proxy-rs
CPR_RELEASE_TAG=v3.52.0
curl -fsSL "https://github.com/zyycn/codex-proxy-rs/releases/download/${CPR_RELEASE_TAG}/compose.yaml" -o deploy/compose.yaml
curl -fsSL "https://github.com/zyycn/codex-proxy-rs/releases/download/${CPR_RELEASE_TAG}/config.example.yaml" -o deploy/config.example.yaml
```

CPR 的应用容器以 `10001:10001` 运行，需要先创建数据目录并设置权限，然后复制配置文件：

```bash
install -d -m 0750 .runtime/postgres .runtime/redis
sudo install -d -m 0770 -o "$(id -u)" -g 10001 .runtime/data .runtime/logs
sudo install -m 0640 -o "$(id -u)" -g 10001 deploy/config.example.yaml deploy/config.yaml
```

### 编辑 CPR 配置

首先，使用 `openssl` 生成 PostgreSQL 和 Redis 密码：

```bash
openssl rand -hex 24   # 生成 PostgreSQL 密码
openssl rand -hex 24   # 生成 Redis 密码
```

然后编辑 `deploy/config.yaml`：

```yaml title="deploy/config.yaml" showLineNumbers ins={26,27,31,32,39,40} del={25,30,38}
schema_version: 1

host:
  timezone: 'Asia/Shanghai'
  listen:
    host: '127.0.0.1'
    port: 8080
  runtime_data_dir: '../.runtime/data'
  logging:
    level: 'info'
    stdout: true
    oauth_recovery: false
    request_dump: false
    request_dump_retention_days: 1
    file:
      enabled: true
      directory: '../.runtime/logs'
      retention_days: 7
      max_file_size_mb: 20
  worker_shutdown_timeout_seconds: 30

store:
  database:
    url: 'postgres://codex_proxy@127.0.0.1:5432/codex_proxy'
    password: &postgres_password ''
    # CPR 独立数据库密码，用 openssl rand -hex 24 生成
    password: &postgres_password '<CPR PostgreSQL密码>'
  redis:
    url: 'redis://127.0.0.1:6379/'
    password: &redis_password ''
    # 单独生成 Redis 密码，文件末尾通过 YAML 锚点复用
    password: &redis_password '<CPR Redis密码>'

admin:
  session_ttl_minutes: 10080
  session_absolute_ttl_minutes: 43200
  default_username: 'admin@cpr.local'
  default_password: ''
  # 修改密码，密码至少 12 个字符，且不能包含 $；按需修改上方的 default_username
  default_password: '<CPR管理员密码>'

client:
  session_ttl_minutes: 1440

api:
  asset_directory: '../frontend/dist'
  cors_allowed_origins: []
  request_timeout_seconds: null
  request_id_header: 'x-request-id'

openai:
  residency: us
  account_routing_override: null

services:
  app-runtime:
    environment:
      GLIBC_TUNABLES: ''

  postgres-credentials:
    environment:
      POSTGRES_PASSWORD: *postgres_password

  redis-credentials:
    command:
      - redis-server
      - --appendonly
      - 'yes'
      - --requirepass
      - *redis_password
    healthcheck:
      test:
        - CMD
        - redis-cli
        - --no-auth-warning
        - -a
        - *redis_password
        - ping
```

### 编辑 CPR Compose 配置

修改 `deploy/compose.yaml`：

```yaml title="deploy/compose.yaml" showLineNumbers ins={11,12,37,48,62,72,137,138,139,140,141,142,143,144,145,151,152,153,154,155,156,157} del={35,36,60,61}
name: codex-proxy-rs

x-json-logging: &json-logging
  driver: json-file
  options:
    max-size: '10m'
    max-file: '5'

services:
  postgres:
    # 容器名加项目前缀，便于识别并避免与其他服务重名
    container_name: codex-proxy-rs-postgres
    extends:
      file: config.yaml
      service: postgres-credentials
    image: postgres:18-bookworm@sha256:bbf83594798e144bff365a9c191c5d779f181fb3135902064ab8ff11918020fc
    restart: unless-stopped
    command:
      - postgres
      - -c
      - timezone=UTC
      - -c
      - log_timezone=UTC
    environment:
      TZ: UTC
      POSTGRES_DB: codex_proxy
      POSTGRES_USER: codex_proxy
      POSTGRES_INITDB_ARGS: --auth-local=scram-sha-256 --auth-host=scram-sha-256
    volumes:
      - type: bind
        source: ../.runtime/postgres
        target: /var/lib/postgresql
        bind:
          create_host_path: false
    ports:
      - '127.0.0.1:5432:5432'
    # PostgreSQL 仅供 CPR 内部访问，删除宿主机端口映射
    healthcheck:
      test: [CMD-SHELL, pg_isready -U codex_proxy -d codex_proxy]
      interval: 5s
      timeout: 5s
      retries: 10
    security_opt:
      - no-new-privileges:true
    logging: *json-logging

  redis:
    container_name: codex-proxy-rs-redis
    extends:
      file: config.yaml
      service: redis-credentials
    image: redis:8-alpine@sha256:0bf6577d7774e592b29d093e3ac9390eb91e13d72c21e506afce736de5e0eeb0
    restart: unless-stopped
    volumes:
      - type: bind
        source: ../.runtime/redis
        target: /data
        bind:
          create_host_path: false
    ports:
      - '127.0.0.1:6379:6379'
    # Redis 仅供 CPR 内部访问，删除宿主机端口映射
    healthcheck:
      interval: 5s
      timeout: 5s
      retries: 10
    security_opt:
      - no-new-privileges:true
    logging: *json-logging

  codex-proxy-rs:
    container_name: codex-proxy-rs
    extends:
      file: config.yaml
      service: app-runtime
    image: ${CPR_IMAGE:-ghcr.io/zyycn/codex-proxy-rs:3.52.0}
    build:
      context: ..
      dockerfile: deploy/Dockerfile
      target: runtime
      args:
        CPR_WEB_BASE_PATH: ${CPR_WEB_BASE_PATH:-/}
        CPR_VERSION: ${CPR_VERSION:-}
        CPR_GIT_SHA: ${CPR_GIT_SHA:-unknown}
        CPR_BUILD_TIME: ${CPR_BUILD_TIME:-unknown}
        CPR_BUILD_TYPE: ${CPR_BUILD_TYPE:-release}
    restart: unless-stopped
    user: '10001:10001'
    init: true
    stop_grace_period: 75s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    pids_limit: 256
    ports:
      - '127.0.0.1:8080:8080'
    volumes:
      - type: bind
        source: ../.runtime/data
        target: /app/.runtime/data
        bind:
          create_host_path: false
      - type: bind
        source: ../.runtime/logs
        target: /app/.runtime/logs
        bind:
          create_host_path: false
    configs:
      - source: cpr_config
        target: /app/deploy/config.yaml
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    tmpfs:
      - /tmp:size=64m,mode=1777
    healthcheck:
      test: [CMD, curl, -fsS, http://127.0.0.1:8080/healthz]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5m
    environment:
      HOME: /app
      CPR_SERVER_HOST: 0.0.0.0
      CPR_SERVER_PORT: '8080'
      CPR_DATABASE_URL: postgres://codex_proxy@postgres:5432/codex_proxy
      CPR_REDIS_URL: redis://redis:6379/
      CPR_DEPLOYMENT_MODE: docker
      CPR_UPDATE_REPOSITORY: zyycn/codex-proxy-rs
      CPR_GITHUB_API_BASE: https://api.github.com/repos
      CPR_UPDATE_EXE_PATH: /app/bin/codex-proxy-rs
      CPR_WEB_DIST_DIR: /app/web/dist
      CPR_ENABLE_SELF_RESTART: 'true'
    # 账号通过宿主机 mihomo 出站
    extra_hosts:
      - "host.docker.internal:host-gateway"
    # 应用同时访问自己的数据库网络和 New API 共享网络
    networks:
      default: {}
      ai-network:
        # 默认出口使用已放行的共享网段，避免从私有数据库网络出站
        gw_priority: 1
    logging: *json-logging

configs:
  cpr_config:
    file: ./config.yaml

# 数据库和 Redis 留在默认私有网络，只有应用加入共享网络
networks:
  default:
    driver: bridge
  ai-network:
    external: true
```

### 启动 CPR

先前创建的 `.runtime/postgres` 属于宿主机用户，而数据库进程使用镜像内的 `postgres` 用户，容器无法直接访问挂载的根目录；而通过同一个镜像设置属主，可以避免写死 UID。

检查配置，拉取镜像并设置 PostgreSQL 数据目录的属主，再启动服务：

```bash
docker compose -f deploy/compose.yaml config --quiet
docker compose -f deploy/compose.yaml pull
# 首次启动前，将数据库挂载目录交给镜像内的 postgres 用户
docker compose -f deploy/compose.yaml run --rm --no-deps \
  --user 0 --entrypoint sh postgres \
  -c 'chown -R postgres:postgres /var/lib/postgresql && chmod 750 /var/lib/postgresql'
docker compose -f deploy/compose.yaml up -d --no-build --wait
docker compose -f deploy/compose.yaml ps
curl -i http://127.0.0.1:8080/readyz
```

正常情况下能看到 `/readyz` 返回 `204`，说明部署成功。

## 配置 Caddy 反向代理

接下来，为 New API 配置 Caddy 反向代理，通过域名提供 HTTPS 访问。

> [!TIP]
>
> 配置前，先在域名的 DNS 管理页面添加一条 A 记录，将 `ai.example.com`（请替换为实际域名）指向服务器的公网 IPv4 地址。如果使用 Cloudflare，请采用“仅 DNS”模式，由 Caddy 直接处理 HTTPS 连接和证书申请。

然后在现有 `Caddyfile` 末尾添加站点：

```text title="/etc/caddy/Caddyfile" showLineNumbers ins={1-5}
ai.example.com {
	reverse_proxy 127.0.0.1:3000 {
		flush_interval -1
	}
}
```

其中，`flush_interval -1` 表示立即转发响应数据，保证模型的流式输出不会被缓冲。

校验配置无误后，重新加载 Caddy：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

随后可以通过 `curl -I https://ai.example.com` 检查站点是否可以正常访问。

Codex 的在线模型目录也使用这个域名。完成渠道与令牌配置后，再[添加目录路由](#为-codex-提供在线模型目录)。

## 登录订阅账号

服务全部启动后，接下来分别在 CPA 和 CPR 中登录订阅账号。

### 建立 SSH 隧道

CPA 和 CPR 的管理面板都只监听宿主机的回环地址，无法从公网直接访问，因此需要通过 SSH 隧道连接。在本地电脑上运行以下命令，并保持窗口开启（注意将 `user@server.example.com` 换成自己的 SSH 登录地址）：

```bash
ssh -N -L 8317:127.0.0.1:8317 -L 54545:127.0.0.1:54545 -L 8080:127.0.0.1:8080 user@server.example.com
```

其中：

- `8317`：连接 CPA 管理面板；
- `8080`：连接 CPR 管理面板；
- `54545`：接收 Claude 授权完成后的回调请求。

隧道建立后，就可以在本地浏览器中访问两个管理面板了：

| 页面 | 地址 | 登录方式 |
| :--- | :--- | :--- |
| CPA 管理面板 | `http://127.0.0.1:8317/management.html` | CPA 管理密钥 |
| CPR 管理面板 | `http://127.0.0.1:8080` | `deploy/config.yaml` 中的管理员账号和密码 |

CPA 在命令行中登录不同的服务时，会在不同的端口上接收授权回调。本文只托管 Claude，因此上面的命令只转发了 `54545`。如果还要在 CPA 中登录其他账号，需要在命令中追加对应的 `-L <端口>:127.0.0.1:<端口>`：

| 端口 | 服务 | 登录参数 | 说明 |
| :---: | :--- | :--- | :--- |
| `54545` | Claude Code | `--claude-login` | 本文使用 |
| `1455` | OpenAI Codex | `--codex-login` | 本文的 Codex 账号由 CPR 托管，不需要转发 |
| `8085` | Gemini CLI | `--login` | |
| `51121` | Antigravity | `--antigravity-login` | |
| `11451` | iFlow | `--iflow-login` | 较早版本提供，新版文档中已不再列出 |
| `56121` | xAI（Grok） | `--xai-login` | 官方 Compose 文件没有映射该端口，需要自行在 `ports` 中添加 |

这些回调端口在前文的 CPA Compose 配置中都只向宿主机的回环地址开放，只有在登录期间才需要转发。另外，CPR 的 OpenAI OAuth 是通过手动粘贴回调地址完成授权的，因此不需要转发回调端口。

### 登录 Claude 账号

回到服务器，在 CPA 容器中执行登录命令：

```bash
cd ~/docker/cli-proxy-api
docker compose exec cli-proxy-api /CLIProxyAPI/CLIProxyAPI -no-browser --claude-login
```

命令会输出一条授权链接。将其复制到本地浏览器中打开并完成授权，回调请求会经过 SSH 隧道的 `54545` 端口回到 CPA。此后，令牌刷新和请求转发都会使用 `config.yaml` 中 `requests.proxy-url` 指定的远端代理。

> [!NOTE]
>
> 凭证单独设置的 `proxy_url` 优先于全局代理。为了让所有 Claude 账号统一使用全局代理，应将该字段留空：可以在 CPA 管理面板中修改，也可以通过 `PATCH /v8/management/credentials/fields` 将其设为空字符串。这样一来，以后更换远端代理时，只需修改 `requests.proxy-url` 并重启 CPA 即可。

### 登录 Codex 账号

与 CPA 使用全局代理不同，CPR 的代理是在面板中按账号绑定的。首先进入 CPR 面板的“代理管理”，添加一个 HTTP 代理：

- **地址**：`host.docker.internal`；
- **端口**：前文 mihomo listener 使用的 `7890`；
- **用户名、密码**：本机代理没有设置认证时留空。

然后进入“账号”页面，添加 OpenAI OAuth 账号，并在生成授权链接之前选中刚才创建的代理。这样，授权码交换、令牌刷新和后续调用都会使用同一个出口。

打开生成的链接并完成授权后，将浏览器地址栏中的完整回调地址复制回 CPR 面板，提交即可完成账号导入。

账号导入后，确认它绑定的仍是这个代理，再刷新额度、查看模型目录。如果能正常看到额度数据和模型列表，说明账号已经可以使用了。

### 准备调用密钥

New API 需要使用调用密钥访问 CPA 和 CPR：

- **CPA**：使用前文写入 `config.yaml` 中 `access.api-keys` 的 `<sk-cpa-长随机串>`；
- **CPR**：进入 CPR 面板的“API 密钥”页面，创建一个只供 New API 使用的调用密钥，并保存备用。

### 测试容器间连接

最后，从共享网络中分别访问两个服务的模型接口：

```bash
docker run --rm --network ai-network curlimages/curl -fsS \
  http://cli-proxy-api:8317/v1/models -H "Authorization: Bearer <CPA调用密钥>"
docker run --rm --network ai-network curlimages/curl -fsS \
  http://codex-proxy-rs:8080/v1/models -H "Authorization: Bearer <CPR调用密钥>"
```

如果两条命令都能列出模型，说明共享网络、服务地址和调用密钥都已经配置正确。

## 配置渠道与自动降级

订阅账号准备就绪后，回到 New API，把订阅渠道和付费渠道组织起来，实现失败时的自动降级。

### 修改请求策略

在浏览器中访问 `https://ai.example.com`，创建管理员账号，然后在“运营设置”中关闭注册功能。

接着进入“系统设置 → 请求策略”，修改以下两项：

1. **最多重试次数**：设置为 `2`。New API 默认不进行重试；而当首次请求命中会话绑定的渠道时，第一次重试仍会从最高优先级开始，因此至少需要重试 2 次，请求才能真正落到付费渠道上。
2. **会话保持规则**：找到内置的 `claude cli trace` 和 `codex cli trace` 两条规则，将“必须使用原渠道”修改为“优先原渠道，失败允许切换”。否则，来自 Claude Code 和 Codex CLI 的请求会被锁定在原渠道上，订阅额度用完后也不会降级到付费渠道。

### 添加渠道

New API 会在同一分组内，按优先级从高到低选择提供同名模型的渠道。因此，需要把订阅渠道和付费渠道放进同一个分组，再通过优先级区分主备。下面以 `default` 分组为例：

| 渠道 | 类型 | API 地址 | API 密钥 | 优先级 | 异常自动禁用 |
| :--: | :--: | :--- | :--: | :---: | :---: |
| CPA-Claude | Anthropic | `http://cli-proxy-api:8317` | CPA 的调用密钥 | 10 | 关闭 |
| CPR-Codex | OpenAI | `http://codex-proxy-rs:8080` | CPR 的调用密钥 | 10 | 关闭 |
| Anthropic 官方 | Anthropic | `https://api.anthropic.com` | 官方 API Key | 0 | 开启 |
| OpenAI 官方 | OpenAI | `https://api.openai.com` | 官方 API Key | 0 | 开启 |
| DeepSeek 官方 | DeepSeek | 保持内置 API 地址 | 官方 API Key | 0 | 开启 |
| Gemini 官方 | Gemini | 保持内置 API 地址 | 官方 API Key | 0 | 开启 |
| 第三方中转站 | 按需选择 | 中转站提供的 API 地址 | 中转站 API Key | 按需填写 | 保持默认 |

订阅渠道的优先级为 `10`，付费渠道为 `0`。正常情况下，请求会优先发往订阅渠道；只有订阅渠道返回失败时，才会重试同名模型的付费渠道。

> [!NOTE]
>
> CPA-Claude 和 CPR-Codex 需要关闭“异常自动禁用”。订阅限流和 CPR 的额度暂停都属于预期内的状态，如果 New API 因此把渠道禁用了，账号恢复后，请求也无法再回到订阅渠道。

### 订阅渠道的详细设置

New API 分别以 OpenAI 和 Anthropic 渠道连接 CPR 和 CPA，OAuth 登录和令牌刷新则由 CPR、CPA 各自处理。两个订阅渠道需要修改的选项如下：

| 页面 | 选项 | CPR-Codex | CPA-Claude |
| :--- | :--- | :--- | :--- |
| 连接与模型 | 提供商、名称 | `OpenAI`、`CPR-Codex` | `Anthropic`、`CPA-Claude` |
| 连接与模型 | API 地址 | `http://codex-proxy-rs:8080` | `http://cli-proxy-api:8317` |
| 连接与模型 | 添加模式、API 密钥 | 单密钥，CPR 的调用密钥 | 单密钥，CPA 的调用密钥 |
| 连接与模型 | 模型 | 获取 CPR 模型列表后选择 | 获取 CPA 模型列表后选择 |
| 连接与模型 | 分组 | `default` | `default` |
| 路由与映射 | 优先级、权重 | `10`、`0` | `10`、`0` |
| 路由与映射 | 测试模型 | CPR 列表中的模型，用 Responses 接口测试 | CPA 列表中的模型，用 Anthropic 接口测试 |
| 路由与映射 | 自动封禁／异常自动禁用 | 关闭 | 关闭 |
| 请求与响应 | 透传请求头 | 开启 | 开启 |
| 请求与响应 | 透传请求体 | 开启 | 开启 |
| 请求与响应 | Responses WebSocket | 开启 | — |
| 字段透传控制 | 允许透传的字段 | 仅开启 `service_tier` | 全部开启 |
| 其他设置 | 上游模型更新检查、自动同步上游模型 | 开启 | 开启 |

其中：

- **API 地址**：填写容器名和容器端口，不要在末尾加 `/v1` 或 `/`。`8080` 和 `8317` 都是容器内的端口，即使修改了宿主机的端口映射，这里也不需要改动。
- **透传请求头、请求体**：保留 Claude Code 和 Codex 发出的原始请求头和扩展字段，避免被 New API 改写。CPR 开启整段请求体透传后，`service_tier` 以外的字段不再过滤原始请求体，因此保持关闭即可。
- **Responses WebSocket**：CPR 支持该协议，可以开启；CPA-Claude 没有这一项。
- **自动同步上游模型**：CPA、CPR 发现新模型后，渠道会自动添加，不需要手动维护模型列表。

除此之外的其余选项保持默认即可。

### 创建令牌

最后，进入“令牌”页面创建客户端使用的令牌：

- **分组**：选择与渠道相同的 `default`，否则令牌无法使用这些渠道；
- **额度上限**：建议设置一个消费上限，避免降级到付费渠道后产生意料之外的费用。

创建完成后复制令牌，下文统一称为 New API 令牌。

## 配置 Codex 额度预留

前文提到，当登录账号的额度归零时，Codex 会直接禁止发送消息。因此，需要让 CPR 在额度见底之前暂停调度，为账号留出一部分余量。

在 CPR 的“账号管理”页面，点击账号左侧的箭头展开额度面板，然后在面板上方打开“额度桶设置”，为两个窗口分别填写调度上限：

| 窗口 | 调度上限 | 预留额度 |
| :--: | :---: | :---: |
| 5 小时 | `95` | 约 5% |
| 7 天 | `98` | 约 2% |

其中：

- **调度上限**：填写已用额度的百分比，例如 `95` 表示 5 小时窗口用到 95% 时暂停调度；
- **预热**：保持关闭。

任一窗口达到上限后，CPR 会将账号标记为“额度暂停”（`quota_paused`），不再为它分配新请求。此时 CPR-Codex 渠道无法完成请求，New API 会按照前文的重试策略切换到 OpenAI 官方渠道。

等到窗口倒计时归零，CPR 会重新获取用量数据。如果触发暂停的窗口都已低于各自的上限，并且账号没有其他限流或凭证错误，CPR 就会自动恢复调度，请求也会重新回到订阅渠道。

## 连接客户端

到这里，服务器端的配置就全部完成了。接下来，把本地的 Claude Code 和 Codex 指向 New API。

### 连接 Claude Code

Claude Code 可以通过环境变量指定 API 地址和令牌。编辑 `~/.claude/settings.json`，在 `env` 中加入以下两项（如果文件中已有其他配置，将它们合并到现有的 `env` 中即可）：

```json title="~/.claude/settings.json"
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://ai.example.com",
    "ANTHROPIC_AUTH_TOKEN": "<New API 令牌>"
  }
}
```

保存后重新启动 Claude Code 生效。

### 连接 Codex

修改之前，先备份 `~/.codex/config.toml`。然后编辑该文件，添加一个指向 New API 的模型提供商：

```toml title="~/.codex/config.toml" showLineNumbers
model_provider = "custom"

[model_providers.custom]
name = "New API"
base_url = "https://ai.example.com/v1"
wire_api = "responses"
requires_openai_auth = true
experimental_bearer_token = "<New API 令牌>"
```

其中：

- `model_provider`：使用下方自定义的 `custom`，Codex 会将其视作第三方中转站；
- `base_url`：New API 的地址，需要带上 `/v1`；
- `wire_api = "responses"`：使用 Responses 接口，与 CPR 渠道的测试方式一致；
- `requires_openai_auth = true`：在使用中转站的同时，保留登录状态下的绝大部分功能。

保存后重新启动 Codex 生效。

## 验证自动降级

最后，模拟订阅渠道不可用的情况，确认请求能够切换到付费渠道。

以 Codex 为例，先在服务器上暂时停止 CPR：

```bash
cd ~/docker/codex-proxy-rs
docker compose -f deploy/compose.yaml stop codex-proxy-rs
```

然后在 Codex 中发送一条消息。正常情况下，消息仍能正常返回，只是响应会稍慢一些。此时进入 New API 的“日志”页面，可以看到这条请求最终由“OpenAI 官方”渠道处理。

确认无误后，重新启动 CPR：

```bash
docker compose -f deploy/compose.yaml start codex-proxy-rs
```

新开一个会话再发送一条消息，日志中的渠道应当重新变为“CPR-Codex”。Claude 的降级可以用同样的方法验证，在 `~/docker/cli-proxy-api` 中执行 `docker compose stop cli-proxy-api` 和 `docker compose start cli-proxy-api` 即可。

> [!TIP]
>
> 如果停止 CPR 后请求直接报错，没有切换到付费渠道，请检查前文的“最多重试次数”和会话保持规则是否已经修改，以及付费渠道是否与令牌位于同一分组、提供了同名模型。

## 扩展功能

以下两项功能不是必需的，可以按需配置。

### 为 Codex 提供在线模型目录

完成前面的配置后，Codex 已经可以通过 New API 调用模型了。不过，Codex 的模型菜单中只有默认模型，要让 New API 的模型出现在 Codex 的模型菜单里，还需要提供模型目录。

问题在于，New API 的 `/v1/models` 只能查到当前令牌有哪些模型可用，而 Codex 在加载模型菜单时，还需要知道每个模型支持哪些推理等级、上下文有多长，以及是否应该出现在菜单中。

解决方法之一，是部署一个小型的目录服务，与 New API 共用同一个域名。Codex 请求 `/codex/models` 时，目录服务会：

1. 使用客户端的 New API 令牌，向 New API 查询当前可用的模型；
2. 使用单独创建的 CPR 调用密钥，读取 CPR 的原生模型目录；
3. 按模型 ID 保留两边都有的条目，顺序、能力和隐藏设置都沿用 CPR。

本文使用的 CPR v3.52.0 只在请求带上 `client_version` 时返回原生目录，因此目录服务请求的是 `/v1/models?client_version=0.169.0`。如果某个模型只出现在 New API 的列表中，目录服务会将模型名记录到日志中，并跳过这一项。

这样一来，以后在 New API 中增减模型时，只要 CPR 也有对应的目录条目，Codex 重新读取时就能拿到更新后的列表。平时发送消息仍然使用原先的 New API 地址。

#### 下载部署文件

首先检查宿主机的 `8099` 端口是否空闲：

```bash
ss -H -ltn 'sport = :8099'
```

如果没有输出，说明端口未被占用。然后创建部署目录：

```bash
mkdir -m 700 -p ~/docker/new-api-model-catalog
```

接着点击<a href="/downloads/new-api-accessory/new-api-model-catalog.zip" download>这里</a>下载部署包。在本地电脑上进入压缩包所在目录，执行以下命令上传压缩包（注意将 `user@server.example.com` 换成自己的 SSH 登录地址）：

```bash
scp new-api-model-catalog.zip user@server.example.com:docker/new-api-model-catalog/
```

上传完成后，回到服务器解压，并在解压成功后删除压缩包：

```bash
cd ~/docker/new-api-model-catalog &&
unzip new-api-model-catalog.zip &&
rm -- new-api-model-catalog.zip
```

解压后会得到 `catalog.py` 和 `compose.yaml` 两个文件，分别是目录服务脚本和 Compose 配置。

#### 配置密钥并启动服务

首先进入 CPR 面板的“API 密钥”页面，单独为目录服务创建一个调用密钥。如果在 CPR 中划分了账号组，请选择包含所需 Codex 模型的组。

然后在部署目录中执行以下命令，按提示粘贴刚才创建的密钥：

```bash
umask 077
if [ ! -e .env ]; then
  read -rsp 'CPR 调用密钥: ' cpr_key
  printf '\n'
  if [ -n "$cpr_key" ]; then printf 'CPR_CLIENT_KEY=%s\n' "$cpr_key" > .env; fi
  unset cpr_key
fi
```

这段命令只在 `.env` 不存在时写入密钥，并且不会在终端和 Shell 历史中留下明文。

压缩包中的 `compose.yaml` 已按照本文的容器名、端口和共享网络写好。如果修改过相关配置，请按下表调整：

| 配置项 | 默认值 | 何时修改 |
| :--- | :--- | :--- |
| `networks.shared.name` | `ai-network` | 共享网络使用了其他名称时，编辑 `compose.yaml` |
| `NEW_API_ORIGIN` | `http://new-api:3000` | New API 的容器名或容器端口不同时，在 `.env` 中设置 |
| `CPR_ORIGIN` | `http://codex-proxy-rs:8080` | CPR 的容器名或容器端口不同时，在 `.env` 中设置 |
| `MODEL_CATALOG_PORT` | `8099` | 宿主机端口已被占用时，在 `.env` 中更换端口，并同步修改下文的测试命令和 Caddy 反代地址 |

校验 Compose 配置后，启动目录服务：

```bash
chmod 644 catalog.py
docker compose config --quiet && docker compose up -d
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8099/codex/models
```

这里的请求没有携带令牌，正常情况下会返回 `401`，说明目录服务已经在宿主机的回环地址上开始监听。

#### 配置 Caddy 并测试目录

编辑 `/etc/caddy/Caddyfile`，在前文配置的 New API 站点块中添加目录路由：

```text title="/etc/caddy/Caddyfile" showLineNumbers ins={2-6}
ai.example.com {
	@codex_catalog {
		method GET
		path /codex/models
	}
	reverse_proxy @codex_catalog 127.0.0.1:8099
	reverse_proxy 127.0.0.1:3000 {
		flush_interval -1
	}
}
```

其中，`@codex_catalog` 匹配对 `/codex/models` 的 `GET` 请求，并将其转发给目录服务。

校验配置无误后，重新加载 Caddy：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

接下来，使用 New API 令牌测试 HTTPS 入口（注意将 `ai.example.com` 换成实际域名）：

```bash
read -rsp 'New API 令牌: ' new_key
printf '\n'
printf 'header = "Authorization: Bearer %s"\n' "$new_key" |
  curl --config - -fsS -D /dev/stderr https://ai.example.com/codex/models |
  python3 -c 'import json, sys; print(*[m["slug"] for m in json.load(sys.stdin)["models"]], sep="\n")'
unset new_key
```

正常情况下，会先输出状态码为 `200` 的响应头，再逐行列出模型名称。

为了确认筛选结果正确，可以再用同一个令牌访问 New API 的 `/v1/models` 对照一下：在线目录中列出的每个模型，都应该出现在这个令牌的可用列表中。如果有模型没有出现在目录里，可以运行 `docker compose logs --tail 30 new-api-model-catalog` 查看日志，确认是否是 CPR 没有提供对应的条目。此外，换成无效令牌时，目录接口应返回 `401`。

#### 在 Codex 中启用在线目录

服务器端测试通过后，回到本地电脑，备份后编辑前文修改过的 `~/.codex/config.toml`。如果之前用 `model_catalog_json` 指定过本地目录，先删除这一行，然后在 `[model_providers.custom]` 中加入：

```toml title="~/.codex/config.toml"
model_catalog_url = "https://ai.example.com/codex/models"
```

由于是第三方模型提供商，还需要开启远程模型发现功能。在 `config.toml` 中找到或添加 `[features]`，加入：

```toml title="~/.codex/config.toml"
[features]
api_key_model_discovery = true
```

保存后，完全退出并重新打开 Codex。正常情况下，打开模型菜单就能看到当前令牌可用的模型了。

> [!NOTE]
>
> 如果需要切回原来的配置，恢复备份的 `config.toml` 后重启 Codex 即可。如果要停用服务器上的目录服务，先从 Caddy 中移除刚才添加的路由并重新加载，再进入 `~/docker/new-api-model-catalog/` 执行 `docker compose down`。

### 为千问渠道提供余额查询

千问 AI 平台接入 New API 后，模型可以正常调用，但渠道的余额只能去阿里云控制台查看。为此，可以部署一个小型的余额服务查询阿里云账单，再通过 New API 的渠道插件，把资金账户可用金和代金券余额显示在渠道列表中。调用模型时，New API 仍然直接请求千问上游，不经过这个服务。

#### 下载并启动余额服务

首先，在阿里云 RAM 控制台创建一个专用用户，并为它生成 AccessKey。

然后进入“权限策略 → 创建权限策略”，切换到“脚本编辑”，填入以下内容：

```json showLineNumbers
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bss:DescribeBillingAccount", "bss:DescribeCoupon"],
      "Resource": "*"
    }
  ]
}
```

其中：

- `bss:DescribeBillingAccount`：查询资金账户的可用金；
- `bss:DescribeCoupon`：查询代金券余额。

保存策略后，将它授予刚才创建的用户。

此外，还需要准备好千问 AI 平台的模型 API Key，下文会同时用到这两套密钥。

在服务器上创建部署目录：

```bash
mkdir -m 700 -p ~/docker/new-api-qianwen
```

点击<a href="/downloads/new-api-accessory/new-api-qianwen.zip" download>这里</a>下载部署包。在本地电脑上进入压缩包所在目录，执行以下命令上传压缩包（注意将 `user@server.example.com` 换成自己的 SSH 登录地址）：

```bash
scp new-api-qianwen.zip user@server.example.com:docker/new-api-qianwen/
```

上传完成后，回到服务器解压，并在解压成功后删除压缩包：

```bash
cd ~/docker/new-api-qianwen &&
unzip new-api-qianwen.zip &&
rm -- new-api-qianwen.zip
```

然后复制并编辑 `.env`：

```bash
cp -n .env.example .env
chmod 600 .env
nano .env
```

需要填写的配置项如下：

| 配置项 | 填写内容 |
| :--- | :--- |
| `QIANWEN_API_KEY` | 千问 AI 平台的模型 API Key，需要与稍后在 New API 渠道中填写的密钥一致 |
| `ALIBABA_CLOUD_ACCESS_KEY_ID`、`ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 刚才创建的 RAM AccessKey ID 和 Secret |
| `NEW_API_NETWORK` | 默认使用本文的 `ai-network`。如果 New API 使用了其他共享网络，取消注释并改为实际的网络名 |

保存后，校验配置并启动服务：

```bash
docker compose config --quiet && docker compose up -d
docker compose ps
```

余额服务通过共享网络向 New API 提供 `http://new-api-qianwen:8787/balance` 接口。插件按容器名访问这个地址，因此需要保留 `new-api-qianwen` 这个容器名。由于 Compose 没有映射宿主机端口，也不需要为它添加 Caddy 路由。

#### 导入插件并添加渠道

使用超级管理员账号进入 New API 的“插件 → 上传插件”。右键复制 [new-api-plugin.js](/downloads/new-api-accessory/new-api-plugin.js) 的链接地址，粘贴到“从 URL 导入”中，加载后确认版本为 `1.0.5` 或更高，再上传并启用。也可以直接使用压缩包中的同名文件导入。

> [!NOTE]
>
> New API `v1.0.0-rc.51` 的导入预览按任务插件的字段显示信息，所以“适用渠道”可能显示为“任务插件”，接口和上游认证方式也会显示“插件未声明”，属于正常现象。

接下来回到渠道页面，添加一个渠道：

| 选项 | 填写内容或开关 |
| :--- | :--- |
| 提供商 | `阿里千问` |
| API 地址 | 留空即可 |
| 添加模式、API 密钥 | 单密钥，填写与 `.env` 中 `QIANWEN_API_KEY` 一致的千问模型 API Key |
| 模型 | 按需选择，插件预填了 `deepseek-v4-pro` 和 `deepseek-v4.1-flash` |
| 分组 | 与准备使用这个渠道的令牌一致 |
| 插件设置 → 主余额 | 默认为“自动（代金券优先）”，也可以固定显示“代金券”或“可用金” |

保存后，在渠道列表中点击余额即可更新。自动模式下，如果代金券还有余额，就优先显示代金券，否则显示可用金，另一项可以在余额详情中查看。需要注意的是，两项金额沿用阿里云返回的人民币数值，只是单位标为 `USD`，并没有进行汇率换算。

首次查询后，建议与阿里云费用中心核对一下，因为两项余额各自对应的账户和代金券的适用范围可能不同。如果无法获取余额，可以在部署目录中运行 `docker compose logs --tail 30 new-api-qianwen` 查看日志，再检查两处模型 API Key 是否一致，以及 RAM 用户是否具有账单查询权限。

#### 通过模型映射保留模型 ID

如果客户端中已经写死了某个模型 ID，可以通过模型映射继续使用它。下面以 DeepSeek Harness（下文简称 DSH）为例：DSH 中使用的模型 ID 是 `deepseek-flash`，而千问实际提供的是 `deepseek-v4.1-flash`。

此时，在千问渠道的模型列表中填写 `deepseek-flash`，再到“路由与映射”中将它映射到 `deepseek-v4.1-flash` 即可。DSH 仍然使用原来的 New API 地址和 OpenAI Chat Completions 协议。

> [!WARNING]
>
> 开启请求透传后，模型映射不会生效。如果映射已经填好，调用时却返回 `404 Model not exist`，请检查“系统设置 → 模型 → 全局模型配置”中的“启用请求透传”，以及千问渠道“请求与响应”中的“透传请求体”。这两个开关需要全部关闭，只要开启了其中一个，New API 就会把原请求体中的 `deepseek-flash` 原样发给千问。CPR 等需要透传的渠道仍然可以单独开启。

另外，DSH 调用推理模型时，会使用 `developer` 角色发送系统提示词，而千问不接受这个角色，会返回 `400 invalid_parameter_error`。“阿里千问”插件会在转发 Chat Completions 请求时，将 `developer` 角色转换为 `system`，消息内容和顺序保持不变，因此 DSH 中不需要再单独设置 `supportsDeveloperRole: false`。

## 总结

至此，一个个人使用的 AI 中转站就搭建完成了：

- 使用 New API 作为统一入口，管理令牌、模型以及各平台的官方 API 渠道；
- 使用 CPA 托管 Claude 订阅账号，通过全局配置指定远端代理；
- 使用 CPR 托管 Codex 订阅账号，通过本机 mihomo 固定出口，并用内置额度门槛为官方客户端保留一部分余量；
- 当订阅渠道无法继续调用时，由 New API 自动切换到同名模型的官方付费渠道；
- 按需为 Codex 提供在线模型目录，为千问渠道提供余额查询。

日常使用时，客户端始终连接 New API；以后需要接入其他平台的 API，也只要在 New API 中添加渠道即可。这样一来，即使订阅额度暂时不够用了，手头的工作也不必停下来等倒计时了~
