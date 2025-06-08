import { ethers } from "ethers";
import { TelegramNotifier } from "./TelegramNotifier.js";

export class Web3Service {
  apiBaseUrl;
  wallet = null;
  telegramNotifier;
  _nonce = null;
  _verseToken = null;

  constructor(apiBaseUrl, rpcUrl, privateKey, telegramBotToken, telegramChatId, accountName) {
    this.apiBaseUrl = apiBaseUrl;
    this.telegramNotifier = new TelegramNotifier(
      telegramBotToken,
      telegramChatId,
      accountName
    );
    if (!privateKey || !rpcUrl) return;
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, provider);
    } catch (error) {
      console.error("[Web3Service] Gagal menginisialisasi wallet:", error);
    }
  }

  async _sendRequest(urlPath, method, body = null, extraHeaders = {}, nonceCookie = null, verseTokenCookie = null) {
    const url = `${this.apiBaseUrl}${urlPath}`;
    const headers = {
      "content-type": "application/json",
      ...extraHeaders,
    };
    let cookieHeader = "";
    if (nonceCookie) cookieHeader += `nonce=${nonceCookie}; `;
    if (verseTokenCookie) cookieHeader += `__VERSE_TOKEN__=${verseTokenCookie}; `;
    if (cookieHeader) headers["cookie"] = cookieHeader.trim();
    const options = {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    };
    const response = await fetch(url, options);
    const setCookieHeader = response.headers.get("Set-Cookie");
    if (setCookieHeader) {
      if (setCookieHeader.includes("nonce=;")) this._nonce = null;
      if (setCookieHeader.includes("__VERSE_TOKEN__=")) {
        const match = setCookieHeader.match(/__VERSE_TOKEN__=([^;]+)/);
        if (match && match[1]) this._verseToken = match[1];
      }
    }
    if (!response.ok) {
      let finalErrorMessage = `HTTP error! Status: ${response.status}`;
      try {
        const errorJson = await response.json();
        if (Array.isArray(errorJson) && errorJson[0]?.error?.json?.message) {
          finalErrorMessage = errorJson[0].error.json.message;
        } else {
          finalErrorMessage += `, Body: ${JSON.stringify(errorJson)}`;
        }
      } catch (jsonParseError) {
        finalErrorMessage += `, Body: ${await response.text()}`;
      }
      throw new Error(finalErrorMessage);
    }
    return response.json();
  }

  async getNonce() {
    if (!this.wallet) return null;
    try {
      const response = await this._sendRequest(
        "/api/trpc/auth.nonce?batch=1",
        "POST"
      );
      this._nonce = response[0]?.result?.data?.json;
      return this._nonce || null;
    } catch (error) {
      return null;
    }
  }

  async login(nonce) {
    if (!this.wallet || !nonce) return false;
    try {
      const address = this.wallet.address;
      const domain = "testnet.huddle01.com";
      const uri = "https://testnet.huddle01.com";
      const version = "1";
      const chainId = 2524852;
      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in with Ethereum\n\nURI: ${uri}\nVersion: ${version}\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
      const signature = await this.wallet.signMessage(message);
      const loginBody = { 0: { json: { message, signature } } };
      const response = await this._sendRequest(
        "/api/trpc/auth.login?batch=1",
        "POST",
        loginBody,
        {},
        nonce
      );
      return response[0]?.result?.data?.json === true;
    } catch (error) {
      return false;
    }
  }

  async getSession() {
    if (!this._verseToken) return null;
    try {
      const sessionUrlPath =
        "/api/trpc/auth.session?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D";
      const response = await this._sendRequest(
        sessionUrlPath,
        "GET",
        null,
        {},
        null,
        this._verseToken
      );
      return response[0]?.result?.data?.json || null;
    } catch (error) {
      return null;
    }
  }

  async authenticateWeb3Session() {
    if (!this.wallet) return false;
    const nonce = await this.getNonce();
    if (!nonce) return false;
    const loggedIn = await this.login(nonce);
    if (!loggedIn) return false;
    const session = await this.getSession();
    return !!session;
  }

  async claimMeetingQuest() {
    if (!this._verseToken) return false;
    const questApiUrlPath = "/api/trpc/quests.completeQuest?batch=1";
    const questBody = { 0: { json: { isRepeatable: true, questKey: "meet" } } };
    try {
      const response = await this._sendRequest(
        questApiUrlPath,
        "POST",
        questBody,
        {},
        null,
        this._verseToken
      );
      const errorInResponse = response?.[0]?.error?.json;
      if (errorInResponse) {
        await this.telegramNotifier.sendNotification(
          `<b>❌ Klaim Quest Gagal</b>\n${errorInResponse.message || "Error tidak diketahui"}`
        );
        if (errorInResponse.message?.includes("max HP for today")) {
          return { success: false, maxHp: true };
        }
        return { success: false, maxHp: false };
      }
      const claimResult = response?.[0]?.result?.data?.json;
      if (claimResult?.message === "Points awarded successfully!") {
        await this.telegramNotifier.sendNotification(
          `<b>✅ Quest Diklaim!</b>\n"${claimResult.message}" Poin: <code>${claimResult.points}</code>.`
        );
        return { success: true, maxHp: false };
      }
      await this.telegramNotifier.sendNotification(
        `<b>❌ Klaim Quest Gagal</b>\nRespons tidak terduga: ${JSON.stringify(response)}`
      );
      return { success: false, maxHp: false };
    } catch (error) {
      const errorMessage = error?.message || error?.toString?.() || String(error);
      await this.telegramNotifier.sendNotification(
        `<b>❌ Klaim Quest Error</b>\n${errorMessage}`
      );
      if (errorMessage.includes("max HP for today")) {
        return { success: false, maxHp: true };
      }
      return { success: false, maxHp: false };
    }
  }
}
