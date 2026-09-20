---
title: "使用 Dockcheck 自动更新容器"
published: 2026-09-20
description: "容器越来越多，逐个检查镜像更新既麻烦又容易遗漏？本文介绍如何安装和配置 Dockcheck 来定期检查和自动更新 Docker Compose 镜像。"
image: "./cover.png"
tags: ["自托管", "容器", "Docker", "Dockcheck"]
category: "指南"
draft: false
numbering: H2
---

随着服务器上运行的容器越来越多，镜像更新也会成为日常维护的一部分。逐个检查并手动更新不仅麻烦，也容易遗漏。Dockcheck 可以自动检查 Docker 镜像是否存在新版本，并根据配置完成自动更新、镜像备份、容器排除和消息通知等操作，让 Docker 服务的日常管理更加省心。

在开始之前，请确认：

- 已安装并启动 Docker，同时能够使用 `docker compose`
- Dockcheck 的运行用户能够直接执行 `docker` 命令，无需使用 `sudo`
- 所有需要自动更新的容器均由 Docker Compose 管理（通过 `docker run` 创建的容器即使拉取了新镜像，也无法由 Dockcheck 自动重新创建）
- 主机能够访问所使用的镜像仓库；如果启用 Dockcheck 自更新，还需要能够访问 GitHub
- 不要同时运行其他自动更新工具，例如 Watchtower，以免多个程序同时拉取或重建同一容器。

## 安装 Dockcheck

首先安装 Dockcheck 所需的基础依赖：

```bash
sudo apt update 
sudo apt install -y git curl jq findutils ca-certificates
```

然后克隆 Dockcheck 仓库：

```bash
git clone https://github.com/mag37/dockcheck.git
cd dockcheck
```

## 编辑 Dockcheck 配置

Dockcheck 官方推荐把持久化配置写在 `dockcheck.config` 中，这样在更新时不会覆盖配置。

进入仓库目录，复制并编辑 Dockcheck 配置：

```bash
cp default.config dockcheck.config
nano dockcheck.config
```

找到以下配置，取消注释后逐一修改：

|       选项       |    值    | 说明                                     |
| :--------------: | :------: | ---------------------------------------- |
|    `AutoMode`    |  `true`  | 启用无人值守自动更新                     |
| `AutoSelfUpdate` |  `true`  | 允许 Dockcheck 自动更新自身              |
| `BackupForDays`  |    7     | 更新前备份当前镜像，并保留 7 天          |
|    `DaysOld`     |    1     | 仅自动安装发布时间至少达到 1 天的镜像    |
|    `Exclude`     | 按需配置 | 完全排除指定容器，不检查也不更新         |
| `ExcludeUpdate`  | 按需配置 | 检查指定容器是否存在更新，但不自动安装   |
|    `MaxAsync`    |    2     | 检查更新时最多并发 2 个子进程            |
|     `Notify`     |  `true`  | 启用 Dockcheck 通知功能                  |
|    `Timeout`     |    30    | 将单个镜像仓库检查的超时时间设置为 30 秒 |

其他选项保持为默认或按需修改。

随后以只检查模式运行一次 Dockcheck：

```bash
./dockcheck.sh -n
```

首次运行时，如果系统中尚未安装 `regctl`，Dockcheck 会提示选择安装方式。在 `amd64` 或 `arm64` 环境中，可以选择 `s`，由 Dockcheck 下载对应架构的静态二进制文件。

## 创建通知配置

此处以使用钉钉机器人 Webhook 为例。

先在钉钉群中新建钉钉机器人，安全模式使用“自定义关键词”，关键词设置为 `Dockcheck`，获取到钉钉 Webhook 地址。

然后编辑 `dockcheck.config`，找到如下行：

```bash frame="code" title="dockcheck.config" showLineNumbers
# NOTIFY_CHANNELS="apprise bark discord DSM file generic gotify HA matrix ntfy pushbullet pushover slack smtp telegram"
```

取消注释，改为如下内容（注意修改 `<Dingtalk Webhook URL>` 处为刚才获取到的钉钉 Webhook 地址）：

```bash frame="code" title="dockcheck.config" showLineNumbers
NOTIFY_CHANNELS="dingtalk"

DINGTALK_WEBHOOK="<Dingtalk Webhook URL>"
DINGTALK_KEYWORD="Dockcheck"

DINGTALK_ALLOWEMPTY=true # 无更新时也调用通知模板，发送每日检查结果
```

由于 Dockcheck 原生没有 DingTalk 模板，还需要额外添加通知模板。

在项目目录下，创建 `notify_dingtalk.sh`：

```bash
nano notify_dingtalk.sh
```

然后写入：

```bash title="notify_dingtalk.sh" showLineNumbers
#!/usr/bin/env bash

# Dockcheck -> DingTalk
# 中文 Markdown 通知 + 每日检查 + 运行异常报告
#
# dockcheck.config 需要：
#   Notify=true
#   NOTIFY_CHANNELS="dingtalk"
#   DINGTALK_WEBHOOK="<Dingtalk Webhook URL>"
#   DINGTALK_KEYWORD="Dockcheck"
#   DINGTALK_ALLOWEMPTY=true

export DINGTALK_EVENT_SENT="${DINGTALK_EVENT_SENT:-false}"
DINGTALK_DAILY_PENDING="${DINGTALK_DAILY_PENDING:-false}"
export DINGTALK_RUNTIME_LOG="${DINGTALK_RUNTIME_LOG:-}"
export DINGTALK_RUNTIME_TEE_INSTALLED="${DINGTALK_RUNTIME_TEE_INSTALLED:-false}"

format_csv_code() {
    local input="$1" output="" item
    local -a items=()

    IFS=',' read -ra items <<< "$input"
    for item in "${items[@]}"; do
        item="${item#"${item%%[![:space:]]*}"}"
        item="${item%"${item##*[![:space:]]}"}"
        [[ -z "$item" ]] && continue
        [[ -n "$output" ]] && output+=", "
        output+="\`${item}\`"
    done
    printf '%s' "$output"
}

format_update_list() {
    local raw="$1" output="" item

    while IFS= read -r item; do
        [[ -z "$item" ]] && continue
        item="${item#"${item%%[![:space:]]*}"}"
        item="${item%"${item##*[![:space:]]}"}"
        [[ -z "$item" ]] && continue
        [[ -n "$output" ]] && output+=$'\n'
        output+="- \`${item}\`"
    done < <(printf '%b\n' "$raw")

    printf '%s' "$output"
}

markdown_hardbreak() {
    local input="$1" output="" line

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ -n "$line" ]]; then
            output+="${line}  "$'\n'
        else
            output+=$'\n'
        fi
    done <<< "$input"

    printf '%s' "$output"
}

json_escape() {
    local s="$1"
    s=${s//\\/\\\\}
    s=${s//\"/\\\"}
    s=${s//$'\n'/\\n}
    s=${s//$'\r'/\\r}
    s=${s//$'\t'/\\t}
    printf '%s' "$s"
}

build_update_policy() {
    local auto_mode exclude_text="无" exclude_update_text="无"

    if [[ "${AutoMode:-false}" == "true" ]]; then
        auto_mode="✅ 已启用"
    else
        auto_mode="⏸️ 未启用"
    fi

    [[ -n "${Exclude:-}" ]] && exclude_text="$(format_csv_code "$Exclude")"
    [[ -n "${ExcludeUpdate:-}" ]] && exclude_update_text="$(format_csv_code "$ExcludeUpdate")"

    cat <<EOF_POLICY
#### ⚙️ 更新策略

- 自动更新：${auto_mode}
- 镜像冷却期：${DaysOld:-0} 天
- 旧镜像备份：${BackupForDays:-未启用} 天
- 完全排除：${exclude_text}
- 仅检查不更新：${exclude_update_text}
EOF_POLICY
}

dingtalk_send_markdown() {
    local title="$1" content="$2" payload response errcode errmsg

    if [[ -z "${DINGTALK_WEBHOOK:-}" ]]; then
        printf '❌ 未配置 DINGTALK_WEBHOOK，无法发送钉钉通知。\n' >&2
        return 1
    fi

    payload="$(printf \
        '{"msgtype":"markdown","markdown":{"title":"%s","text":"%s"}}' \
        "$(json_escape "$title")" \
        "$(json_escape "$content")")"

    response="$(curl -fsS \
        --connect-timeout 10 \
        --max-time 30 \
        -H 'Content-Type: application/json; charset=utf-8' \
        -d "$payload" \
        "$DINGTALK_WEBHOOK")" || {
        printf '❌ 钉钉 Webhook 请求失败。\n' >&2
        return 1
    }

    if command -v jq >/dev/null 2>&1; then
        errcode="$(jq -r '.errcode // -1' <<< "$response" 2>/dev/null)"
        errmsg="$(jq -r '.errmsg // "unknown error"' <<< "$response" 2>/dev/null)"
        if [[ "$errcode" != "0" ]]; then
            printf '❌ 钉钉通知发送失败：%s\n' "$errmsg" >&2
            printf '钉钉返回：%s\n' "$response" >&2
            return 1
        fi
    elif ! grep -Eq '"errcode"[[:space:]]*:[[:space:]]*0' <<< "$response"; then
        printf '❌ 钉钉通知发送失败。\n' >&2
        printf '钉钉返回：%s\n' "$response" >&2
        return 1
    fi

    printf '✅ 钉钉通知发送成功。\n'
}

send_dingtalk_daily_check() {
    local keyword="${DINGTALK_KEYWORD:-Dockcheck}"
    local hostname="${FromHost:-$(hostname)}"
    local now title policy content

    now="$(date '+%Y-%m-%d %H:%M:%S')"
    title="🗓️ Dockcheck · 每日检查"
    policy="$(build_update_policy)"

    content="### ${title}

🖥️ 主机：${hostname}  
🕒 时间：${now}

#### ✅ 检查完成

所有容器镜像均已是最新版本。

${policy}

🤖 由 **${keyword}** 自动发送"

    dingtalk_send_markdown "$title" "$content"
}

send_dingtalk_runtime_error() {
    local issues="$1"
    local keyword="${DINGTALK_KEYWORD:-Dockcheck}"
    local hostname="${FromHost:-$(hostname)}"
    local now title content

    now="$(date '+%Y-%m-%d %H:%M:%S')"
    title="🔔 Dockcheck · 系统通知"

    content="### ${title}

🖥️ 主机：${hostname}  
🕒 时间：${now}

#### ❌ 运行异常

${issues}

#### 🔎 排查命令

\`journalctl -u dockcheck.service -n 100 --no-pager\`

🤖 由 **${keyword}** 自动发送"

    export DINGTALK_EVENT_SENT=true
    dingtalk_send_markdown "$title" "$content"
}

collect_dockcheck_runtime_issues() {
    local exit_code="${1:-0}" item line
    local -a issue_list=()
    local -A seen=()

    add_issue() {
        local issue="$1"
        [[ -z "$issue" ]] && return 0
        if [[ -z "${seen[$issue]+x}" ]]; then
            seen["$issue"]=1
            issue_list+=("$issue")
        fi
    }

    [[ "$exit_code" -ne 0 ]] && add_issue "脚本异常退出：退出码 \`${exit_code}\`"

    if declare -p GotErrors >/dev/null 2>&1; then
        for item in "${GotErrors[@]}"; do
            [[ -n "$item" ]] && add_issue "镜像检查失败：\`${item}\`"
        done
    fi

    if declare -p FailedUpdates >/dev/null 2>&1; then
        for item in "${FailedUpdates[@]}"; do
            [[ -n "$item" ]] && add_issue "镜像拉取失败：\`${item}\`"
        done
    fi

    if [[ -n "${DINGTALK_RUNTIME_LOG:-}" && -f "${DINGTALK_RUNTIME_LOG}" ]]; then
        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            add_issue "日志：\`${line}\`"
            [[ "${#issue_list[@]}" -ge 20 ]] && break
        done < <(
            grep -E \
                'ERROR: Failed to curl latest Dockcheck\.sh release version|ERROR: Failed to curl updated Dockcheck\.sh script|ERROR: Failed to curl binary dependency|Git error, manually pull/clone|Error pulling update for .*Skipping|Failed to recreate .*skipping|Path error - skipping|Docker error, exiting|does not have permissions to the docker socket|No docker compose binary available|No docker binaries available, exiting|Required dependency .* missing|is not working .* exiting|Error response from daemon:|Attempted to send notification to channel|Could not source .*notification function|钉钉.*失败' \
                "${DINGTALK_RUNTIME_LOG}" 2>/dev/null \
            | tail -n 20 \
            | sed 's/\r$//'
        )
    fi

    for item in "${issue_list[@]}"; do
        printf -- '- %s\n' "$item"
    done
}

trigger_dingtalk_notification() {
    local keyword="${DINGTALK_KEYWORD:-Dockcheck}"
    local hostname="${FromHost:-$(hostname)}"
    local now title content

    now="$(date '+%Y-%m-%d %H:%M:%S')"

    # 容器更新；空列表则延迟到退出时发送“每日检查”。
    if [[ "${MessageTitle:-}" == *"updates "*"available."* ]]; then
        local update_list policy
        update_list="$(format_update_list "${UpdToString:-}")"

        if [[ -z "$update_list" ]]; then
            DINGTALK_DAILY_PENDING=true
            return 0
        fi

        export DINGTALK_EVENT_SENT=true
        title="🐳 Dockcheck · 容器更新"
        policy="$(build_update_policy)"

        content="### ${title}

🖥️ 主机：${hostname}  
🕒 时间：${now}

#### 📦 发现可用更新

${update_list}

${policy}

🤖 由 **${keyword}** 自动发送"

    # Dockcheck 本体更新。
    elif [[ "${MessageTitle:-}" == *"New version of dockcheck available."* ]]; then
        local body="${MessageBody:-}"

        export DINGTALK_EVENT_SENT=true
        title="🔧 Dockcheck · 程序更新"

        body="${body//dockcheck on ${hostname} has update available/#### ⬆️ Dockcheck 有可用更新}"
        body="${body//Installed version:/当前版本：}"
        body="${body//Latest version:/最新版本：}"
        body="${body//Changenotes:/更新说明：}"
        body="${body//TEST of notifications triggered./通知功能测试。}"
        body="$(markdown_hardbreak "$body")"

        content="### ${title}

🖥️ 主机：${hostname}  
🕒 时间：${now}

${body}

🤖 由 **${keyword}** 自动发送"

    # 通知组件更新，统一归入“程序更新”。
    elif [[ "${MessageTitle:-}" == *"New version of notify templates available."* ]]; then
        local update_list
        update_list="$(format_update_list "${UpdToString:-}")"
        [[ -z "$update_list" ]] && return 0

        export DINGTALK_EVENT_SENT=true
        title="🔧 Dockcheck · 程序更新"

        content="### ${title}

🖥️ 主机：${hostname}  
🕒 时间：${now}

#### 🔔 通知组件有可用更新

${update_list}

🤖 由 **${keyword}** 自动发送"

    # 其他未知 Dockcheck 通知作为系统通知。
    else
        local body="${MessageBody:-无详细信息}"

        export DINGTALK_EVENT_SENT=true
        title="🔔 Dockcheck · 系统通知"
        body="$(markdown_hardbreak "$body")"

        content="### ${title}

🖥️ 主机：${hostname}  
🕒 时间：${now}

${body}

🤖 由 **${keyword}** 自动发送"
    fi

    dingtalk_send_markdown "$title" "$content"
}

dockcheck_dingtalk_exit_handler() {
    local exit_code="${1:-0}" issues="" notify_rc=0

    trap - EXIT
    issues="$(collect_dockcheck_runtime_issues "$exit_code")"

    if [[ -n "$issues" ]]; then
        send_dingtalk_runtime_error "$issues" || notify_rc=$?
    elif [[ "${DINGTALK_DAILY_PENDING:-false}" == "true" \
         && "${DINGTALK_EVENT_SENT:-false}" != "true" ]]; then
        send_dingtalk_daily_check || notify_rc=$?
    fi

    if [[ -n "${DINGTALK_RUNTIME_LOG:-}" && -f "${DINGTALK_RUNTIME_LOG}" ]]; then
        rm -f "$DINGTALK_RUNTIME_LOG" 2>/dev/null || true
    fi

    if [[ "$exit_code" -ne 0 ]]; then
        exit "$exit_code"
    elif [[ "$notify_rc" -ne 0 ]]; then
        exit "$notify_rc"
    else
        exit 0
    fi
}

install_dingtalk_runtime_monitor() {
    if [[ -z "${DINGTALK_RUNTIME_LOG:-}" ]]; then
        DINGTALK_RUNTIME_LOG="${TMPDIR:-/tmp}/dockcheck-runtime-$$.log"
        export DINGTALK_RUNTIME_LOG

        : > "$DINGTALK_RUNTIME_LOG" 2>/dev/null || {
            printf '⚠️ 无法创建 Dockcheck 运行日志：%s\n' "$DINGTALK_RUNTIME_LOG" >&2
            DINGTALK_RUNTIME_LOG=""
            export DINGTALK_RUNTIME_LOG
        }
    fi

    if [[ -n "${DINGTALK_RUNTIME_LOG:-}" \
       && "${DINGTALK_RUNTIME_TEE_INSTALLED:-false}" != "true" ]]; then
        export DINGTALK_RUNTIME_TEE_INSTALLED=true
        exec > >(tee -a "$DINGTALK_RUNTIME_LOG") 2>&1
    fi

    # EXIT trap 不会跨 exec 保留，因此 Dockcheck 自更新后重新 source 时会再次安装。
    trap 'dockcheck_dingtalk_exit_handler "$?"' EXIT
}

install_dingtalk_runtime_monitor
```

脚本定义的模板如下所示：

```md
### 🐳 Dockcheck · 容器更新

🖥️ 主机：nyapasu-pi

🕒 时间：2026-09-19 19:15:59

#### 📦 发现可用更新

- `rabbitmq`
- `sakurafrp`

#### ⚙️ 更新策略

- 自动更新：✅ 已启用
- 镜像冷却期：1 天
- 旧镜像备份：7 天
- 完全排除：`hikari-api`
- 仅检查不更新：`rabbitmq`

🤖 由 **Dockcheck** 自动发送
```

|         通知类型         | 情况                                |
| :----------------------: | :---------------------------------- |
| `🗓️ Dockcheck · 每日检查` | 容器、Dockcheck、通知模板都没有更新 |
| `🐳 Dockcheck · 容器更新` | 有容器更新                          |
| `🔧 Dockcheck · 程序更新` | Dockcheck 本体或通知模板有更新      |
| `🔔 Dockcheck · 系统通知` | 其他需要通知的异常/事件             |

接着授予脚本可执行权限：

```bash
chmod +x notify_dingtalk.sh
```

然后测试更新通知：

```bash
./dockcheck.sh -N
```

如果钉钉能收到消息，继续执行如下命令，仅检查镜像而不更新：

```bash
./dockcheck.sh -n
```

最后就可以正式运行服务了：

```bash
./dockcheck.sh
```

## 定时运行 Dockcheck

可以使用 `systemd` Timer 定期执行 Dockcheck。

首先创建一个 `systemd` Service，用于定义 Dockcheck 的具体执行方式。

将服务文件命名为 `dockcheck.service`，并保存到 `/etc/systemd/system` 目录：

```bash
sudo nano /etc/systemd/system/dockcheck.service
```

将 `<User>` 替换为实际运行 Docker 的用户，并将 `<Path-To-Dockcheck>` 替换为 Dockcheck 的实际安装目录：

```ini title="/etc/systemd/system/dockcheck.service"
[Unit]
Description=Dockcheck Docker Image Auto Update
Wants=network-online.target
After=network-online.target docker.service
Requires=docker.service

[Service]
Type=oneshot
User=<User>
WorkingDirectory=<Path-To-Dockcheck>
ExecStart=<Path-To-Dockcheck>/dockcheck.sh
```

其中：

- `Type=oneshot` 表示该服务仅在被触发时执行一次，Dockcheck 运行结束后服务即退出。
- `User` 指定 Dockcheck 的运行用户。该用户必须具有访问 Docker daemon 的权限。
- `WorkingDirectory` 指定 Dockcheck 的工作目录，以便脚本能够读取同目录下的 `dockcheck.config` 和自定义通知模板。

随后创建对应的 `systemd` Timer，用于定时触发上述 Service：

```bash
sudo nano /etc/systemd/system/dockcheck.timer
```

写入以下内容：

```ini title="/etc/systemd/system/dockcheck.timer"
[Unit]
Description=Run Dockcheck Daily

[Timer]
OnCalendar=*-*-* 04:00:00
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
```

其中：

- `OnCalendar=*-*-* 04:00:00` 表示每天 `04:00` 触发任务。
- `RandomizedDelaySec=15m` 表示在计划时间基础上随机延迟最多 15 分钟，因此实际执行时间通常位于 `04:00–04:15` 之间。
- `Persistent=true` 表示如果主机在计划执行时间处于关机状态，重新启动后会补执行一次错过的任务。

最后重新加载 `systemd` 配置，并启用 Timer：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dockcheck.timer
```

可以通过以下命令查看 Timer 状态及下一次执行时间：

```bash
systemctl status dockcheck.timer
systemctl list-timers dockcheck.timer
```

需要注意的是，`dockcheck.service` 无需设置为开机自启，而由 `dockcheck.timer` 在设定时间自动触发。

至此，Dockcheck 将按照设定的时间定期检查容器镜像。检测到符合更新条件的新镜像后，Dockcheck 会先发送更新提醒，再按照 `dockcheck.config` 中的策略自动拉取镜像并重新创建相应的 Compose 服务；如果更新过程中出现异常，则会发送系统通知。
