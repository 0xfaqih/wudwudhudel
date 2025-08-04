import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadCookies() {
  try {
    const cookieFilePath = path.resolve(__dirname, '../cookie.json');
    const cookieData = fs.readFileSync(cookieFilePath, 'utf8');
    return JSON.parse(cookieData);
  } catch (error) {
    console.warn(
      `Gagal memuat cookie dari cookie.json: ${error.message}. Menggunakan array cookie kosong.`
    );
    return [];
  }
}

export const config = {
  accountName: "Bot Meeting 1",
  telegramBotToken: process.env.TELEGRAM_TOKEN,
  telegramChatId: process.env.CHAT_ID,
  meetingUrlTemplate: "https://huddle01.app/room/{roomId}",
  roomIds: [ "fgg-oioe-cdp", "iqr-oxzx-yxl"],
  cookies: loadCookies(),
  checkIntervalMinutes: 40,
  web3ApiBaseUrl: "https://testnet.huddle01.com",
  web3RpcUrl: "https://huddle-testnet.rpc.caldera.xyz/http",
  web3PrivateKey: process.env.WEB3_PRIVATE_KEY || null,
};
