import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = (() => {
  let loadedCookies = [];
  try {
    const cookieFilePath = path.resolve(__dirname, "../cookie.json");
    const cookieData = fs.readFileSync(cookieFilePath, "utf8");
    loadedCookies = JSON.parse(cookieData);
    console.log("Cookie berhasil dimuat dari cookie.json");
  } catch (error) {
    console.warn(
      `Gagal memuat cookie dari cookie.json: ${error.message}. Menggunakan array cookie kosong.`
    );
  }

  return {
    accountName: 'Bot Meeting',
    telegramBotToken: process.env.TELEGRAM_TOKEN,
    telegramChatId: process.env.CHAT_ID,

    meetingUrlTemplate: "https://huddle01.app/room/{roomId}",
    roomIds: ["ofs-qmul-efc", "gvd-azxf-lrq"],

    cookies: loadedCookies,
    checkIntervalMinutes: 1,
  };
})();
