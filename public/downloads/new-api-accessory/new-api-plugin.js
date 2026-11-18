const anthropicPath = "/apps/anthropic/v1/messages";

export const meta = {
  apiVersion: 1,
  key: "qianwen",
  name: "阿里千问",
  version: "1.0.5",
  icon: "Qwen.Color",
  author: {name: "qianwen"},
  baseUrl: "https://maas.qianwenaiapi.com/compatible-mode",
  models: ["deepseek-v4-pro", "deepseek-v4.1-flash"],
  allowedHosts: ["new-api-qianwen:8787"],
  channelConfig: {
    type: "object",
    properties: {
      primaryBalance: {
        type: "string",
        title: {en: "Primary balance", zh: "主余额"},
        enum: ["auto", "coupon", "fund"],
        enumTitles: [
          {en: "Auto (voucher first)", zh: "自动（代金券优先）"},
          {en: "Voucher", zh: "代金券"},
          {en: "Available funds", zh: "可用金"},
        ],
        default: "auto",
      },
    },
  },
  relay: [
    {incoming_path: "/v1/chat/completions", upstream_path: "/v1/chat/completions"},
    {incoming_path: "/v1/completions", upstream_path: "/v1/completions"},
    {incoming_path: "/v1/responses", upstream_path: "/v1/responses"},
    {incoming_path: "/v1/models", upstream_path: "/v1/models"},
    {incoming_path: "/v1/embeddings", upstream_path: "/v1/embeddings"},
    {
      incoming_path: "/v1/messages",
      upstream_path: anthropicPath,
      models: ["re:(?i)qwen|deepseek-v4|^deepseek-flash$|kimi|glm|minimax-m"],
      auth: {type: "header", name: "x-api-key", value: "{api_key}"},
    },
    {
      incoming_path: "/v1/messages",
      upstream_path: "/v1/chat/completions",
      converter: "anthropic_messages_to_openai_chat_completions",
    },
  ],
};

export function prepareRequest(ctx, request) {
  if (ctx.path === "/v1/messages" && request.upstreamPath.endsWith(anthropicPath)) {
    const origin = /^https?:\/\/[^/]+/.exec(ctx.baseUrl)?.[0];
    if (origin) return {url: origin + anthropicPath};
  }

  const messages = request.body?.messages;
  if (!request.upstreamPath.endsWith("/v1/chat/completions") || !Array.isArray(messages)) return;

  const ops = [];
  for (const [index, message] of messages.entries()) {
    if (message?.role === "developer") {
      ops.push({op: "replace", path: "/messages/" + index + "/role", value: "system"});
    }
  }
  if (ops.length) return {effects: [{type: "json.patch", ops}]};
}

export function buildBalanceRequest(ctx) {
  return {
    url: "http://new-api-qianwen:8787/balance",
    headers: {Authorization: "Bearer " + ctx.apiKey},
  };
}

export function parseBalance(ctx, response) {
  if (response.status !== 200) return {error: "余额桥接返回 HTTP " + response.status};
  let data;
  try {
    data = JSON.parse(response.body);
  } catch {
    return {error: "余额桥接返回无效的 JSON"};
  }
  if (
    typeof data?.fundCny !== "string" || !/^-?\d+(\.\d+)?$/.test(data.fundCny) ||
    typeof data.couponCny !== "string" || !/^\d+(\.\d+)?$/.test(data.couponCny)
  ) {
    return {error: "余额桥接返回无效的金额"};
  }
  const fund = Number(data.fundCny);
  const coupon = Number(data.couponCny);
  if (!Number.isFinite(fund) || !Number.isFinite(coupon)) {
    return {error: "余额桥接返回无效的金额"};
  }
  const mode = ctx.config?.primaryBalance ?? "auto";
  const useCoupon = mode === "coupon" || (mode === "auto" && coupon !== 0);
  const other = useCoupon
    ? {name: {en: "Available funds", zh: "可用金"}, limit: fund}
    : {name: {en: "Voucher balance", zh: "代金券剩余"}, limit: coupon};
  return {
    amount: useCoupon ? coupon : fund,
    currency: "USD",
    windows: [{...other, used: 0, unit: "USD"}],
  };
}
