import { Agent, EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

export type ProxyMode = "off" | "env";

export function resolveProxyMode(raw?: string): ProxyMode {
  return raw?.trim().toLowerCase() === "env" ? "env" : "off";
}

export function hasEnvProxy(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.HTTPS_PROXY || env.HTTP_PROXY || env.https_proxy || env.http_proxy);
}

/**
 * 默认关闭 Node 层显式代理，避免 VPN/代理软件注入的 HTTP_PROXY
 * 影响长时间生图请求。需要显式走代理时设置 AI_COMIC_PROXY_MODE=env。
 */
export function configureNetworkProxy() {
  const mode = resolveProxyMode(process.env.AI_COMIC_PROXY_MODE);
  try {
    if (mode === "env" && hasEnvProxy()) {
      setGlobalDispatcher(new EnvHttpProxyAgent());
    } else {
      setGlobalDispatcher(new Agent());
    }
  } catch {
    // 网络代理配置失败时保持当前 dispatcher，避免阻断业务请求。
  }
}
