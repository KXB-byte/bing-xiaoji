(function () {
  "use strict";

  const CONFIG_KEY = "xiaoji-supabase-config";
  const SESSION_KEY = "xiaoji-supabase-session";

  class XiaojiSyncError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = "XiaojiSyncError";
      this.status = status;
    }
  }

  class XiaojiSyncClient {
    getConfig() {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return null;
      try {
        const config = JSON.parse(raw);
        if (!config?.url || !config?.publishableKey) return null;
        return config;
      } catch (error) {
        console.error("Supabase 本地配置无法读取", error);
        return null;
      }
    }

    saveConfig(url, publishableKey, vapidPublicKey = "") {
      const normalizedUrl = normalizeProjectUrl(url);
      const normalizedKey = publishableKey.trim();
      if (!normalizedKey) throw new XiaojiSyncError("请输入 Supabase publishable key");
      const previous = this.getConfig();
      const next = {
        url: normalizedUrl,
        publishableKey: normalizedKey,
        vapidPublicKey: vapidPublicKey.trim()
      };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
      if (previous?.url !== next.url || previous?.publishableKey !== next.publishableKey) {
        localStorage.removeItem(SESSION_KEY);
      }
      return next;
    }

    clearConfig() {
      localStorage.removeItem(CONFIG_KEY);
      localStorage.removeItem(SESSION_KEY);
    }

    getSession() {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      try {
        const session = JSON.parse(raw);
        if (!session?.accessToken || !session?.refreshToken || !session?.user?.id) return null;
        return session;
      } catch (error) {
        console.error("Supabase 本地会话无法读取", error);
        return null;
      }
    }

    isConfigured() {
      return Boolean(this.getConfig());
    }

    isSignedIn() {
      return Boolean(this.getSession());
    }

    async signIn(email, password) {
      const data = await this.authRequest("/auth/v1/token?grant_type=password", { email, password });
      this.saveSession(data);
      return this.getSession();
    }

    async signOut() {
      const session = this.getSession();
      let requestError = null;
      if (session) {
        try {
          await this.request("/auth/v1/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.accessToken}` }
          });
        } catch (error) {
          requestError = error;
        }
      }
      localStorage.removeItem(SESSION_KEY);
      if (requestError) {
        throw new XiaojiSyncError(`已在本机退出，但云端退出确认失败：${requestError.message}`, requestError.status);
      }
    }

    async getRecords() {
      const accessToken = await this.getValidAccessToken();
      return this.request(
        "/rest/v1/xiaoji_sync_records?select=record_type,record_id,payload,updated_at,deleted_at&order=updated_at.asc",
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
    }

    async upsertRecords(records) {
      if (!records.length) return;
      const accessToken = await this.getValidAccessToken();
      await this.request(
        "/rest/v1/xiaoji_sync_records?on_conflict=user_id,record_type,record_id",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify(records)
        },
        true
      );
    }

    async savePushSubscription(subscription, timeZone) {
      const session = this.getSession();
      if (!session) throw new XiaojiSyncError("请先登录同步账号");
      const accessToken = await this.getValidAccessToken();
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new XiaojiSyncError("浏览器返回的推送订阅不完整");
      }
      await this.request(
        "/rest/v1/xiaoji_push_subscriptions?on_conflict=user_id,endpoint",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify({
            user_id: session.user.id,
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            time_zone: timeZone,
            updated_at: new Date().toISOString()
          })
        },
        true
      );
    }

    async deletePushSubscription(endpoint) {
      if (!endpoint) return;
      const accessToken = await this.getValidAccessToken();
      await this.request(
        `/rest/v1/xiaoji_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Prefer: "return=minimal"
          }
        },
        true
      );
    }

    async getValidAccessToken() {
      const session = this.getSession();
      if (!session) throw new XiaojiSyncError("请先登录同步账号");
      if (session.expiresAt - Date.now() > 60 * 1000) return session.accessToken;

      const data = await this.authRequest("/auth/v1/token?grant_type=refresh_token", {
        refresh_token: session.refreshToken
      });
      this.saveSession(data);
      return data.access_token;
    }

    async authRequest(path, body) {
      return this.request(path, {
        method: "POST",
        body: JSON.stringify(body)
      });
    }

    async request(path, options = {}, allowEmptyResponse = false) {
      const config = this.getConfig();
      if (!config) throw new XiaojiSyncError("请先保存 Supabase 项目配置");
      let response;
      try {
        response = await fetch(`${config.url}${path}`, {
          ...options,
          headers: {
            apikey: config.publishableKey,
            "Content-Type": "application/json",
            ...(options.headers || {})
          }
        });
      } catch (error) {
        throw new XiaojiSyncError(`无法连接 Supabase：${error.message}`);
      }

      if (!response.ok) {
        const details = await readErrorResponse(response);
        throw new XiaojiSyncError(details || `Supabase 请求失败（${response.status}）`, response.status);
      }
      if (allowEmptyResponse || response.status === 204) return null;
      return response.json();
    }

    saveSession(data) {
      if (!data?.access_token || !data?.refresh_token || !data?.user?.id) {
        throw new XiaojiSyncError("Supabase 返回的登录会话不完整");
      }
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
          user: {
            id: data.user.id,
            email: data.user.email || ""
          }
        })
      );
    }
  }

  function normalizeProjectUrl(value) {
    let url;
    try {
      url = new URL(value.trim());
    } catch {
      throw new XiaojiSyncError("请输入有效的 Supabase Project URL");
    }
    const isLocalhost = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !isLocalhost) {
      throw new XiaojiSyncError("Supabase Project URL 必须使用 HTTPS");
    }
    return url.origin;
  }

  async function readErrorResponse(response) {
    try {
      const data = await response.json();
      return data.msg || data.message || data.error_description || data.error || "";
    } catch (error) {
      console.warn("Supabase 错误响应无法解析", error);
      return "";
    }
  }

  window.XiaojiSyncClient = XiaojiSyncClient;
  window.XiaojiSyncError = XiaojiSyncError;
})();
