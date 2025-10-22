import { decodeJwt } from "jose";
import { z } from "zod";
import {
  PlayerProfile,
  PlayerProfileSchema,
  RefreshResponseSchema,
  TokenPayload,
  TokenPayloadSchema,
  UserMeResponse,
  UserMeResponseSchema,
} from "../core/ApiSchemas";
import { getServerConfigFromClient } from "../core/configuration/ConfigLoader";

let apiBase: string | null = null;
let audience: string | null = null;

function ensureApiConfig() {
    if (!apiBase || !audience) {
        const { hostname } = new URL(window.location.href);
        const domainname = hostname.split(".").slice(-2).join(".");
        audience = domainname;
        
        if (domainname === "localhost") {
            apiBase = localStorage.getItem("apiHost") ?? "http://localhost:8787";
        } else {
            apiBase = `https://api.${domainname}`;
        }
    }
}

export function getApiBase() {
    ensureApiConfig();
    return apiBase!;
}

function getAudience() {
    ensureApiConfig();
    return audience!;
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
    localStorage.setItem("token", token);
    __isLoggedIn = undefined; 
}

async function clearToken() {
  localStorage.removeItem("token");
  __isLoggedIn = false;
}

export function discordLogin() {
  const redirectUri = window.location.href;
  window.chrome.webview.postMessage({type: 'openBrowser', payload: { url: `${getApiBase()}/login/discord?redirect_uri=${redirectUri}`}});
}

export async function tokenLogin(token: string): Promise<string | null> {
  const response = await fetch(`${getApiBase()}/login/token?login-token=${token}`);
  if (response.status !== 200) {
    return null;
  }
  const { jwt, email } = await response.json();
  const payload = decodeJwt(jwt);
  const result = TokenPayloadSchema.safeParse(payload);
  if (!result.success) {
    return null;
  }
  await clearToken();
  setToken(jwt);
  return email;
}

export function getAuthHeader(): string {
  const token = getToken();
  return token ? `Bearer ${token}` : "";
}

export async function logOut(allSessions: boolean = false) {
  const token = getToken();
  if (token === null) return;
  await clearToken();

  await fetch(
    getApiBase() + (allSessions ? "/revoke" : "/logout"),
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    },
  );
  return true;
}

export type IsLoggedInResponse = { token: string; claims: TokenPayload } | false;
let __isLoggedIn: IsLoggedInResponse | undefined = undefined;
export function isLoggedIn(): IsLoggedInResponse {
  __isLoggedIn ??= _isLoggedIn();
  return __isLoggedIn;
}

function _isLoggedIn(): IsLoggedInResponse {
  try {
    const token = getToken();
    if (!token) return false;

    const payload = decodeJwt(token);
    const { iss, aud, exp, iat } = payload;

    if (iss !== getApiBase()) {
      logOut();
      return false;
    }
    const myAud = getAudience();
    if (myAud !== "localhost" && aud !== myAud) {
      logOut();
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    if (exp !== undefined && now >= exp) {
      logOut();
      return false;
    }
    const refreshAge: number = 3 * 24 * 3600;
    if (iat !== undefined && now >= iat + refreshAge) {
      postRefresh();
    }

    const result = TokenPayloadSchema.safeParse(payload);
    if (!result.success) return false;

    return { token, claims: result.data };
  } catch (e) {
    return false;
  }
}

export async function postRefresh(): Promise<boolean> {
  try {
    const token = getToken();
    if (!token) return false;

    const response = await fetch(getApiBase() + "/refresh", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      clearToken();
      return false;
    }
    if (!response.ok) return false;
    
    const body = await response.json();
    const result = RefreshResponseSchema.safeParse(body);
    if (!result.success) return false;
    
    setToken(result.data.token);
    return true;
  } catch (e) {
    __isLoggedIn = false;
    return false;
  }
}

export async function getUserMe(): Promise<UserMeResponse | false> {
    try {
        const token = getToken();
        if (!token) return false;
        
        const response = await fetch(getApiBase() + "/users/@me", {
            headers: { authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
            clearToken();
            return false;
        }
        if (!response.ok) return false;

        const body = await response.json();
        const result = UserMeResponseSchema.safeParse(body);
        if (!result.success) return false;
        
        return result.data;
    } catch (e) {
        __isLoggedIn = false;
        return false;
    }
}

export async function fetchPlayerById(playerId: string): Promise<PlayerProfile | false> {
    try {
        const token = getToken();
        if (!token) return false;
        const url = `${getApiBase()}/player/${encodeURIComponent(playerId)}`;

        const res = await fetch(url, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return false;

        const json = await res.json();
        const parsed = PlayerProfileSchema.safeParse(json);
        if (!parsed.success) return false;
        
        return parsed.data;
    } catch (err) {
        return false;
    }
}