import { MeetingAutomation } from './src/services/MeetingAutomation.js';
import { config } from './src/config.js';

async function main() {
  try {
    const meetingAutomation = new MeetingAutomation(
      config.telegramBotToken,
      config.telegramChatId,
      config.meetingUrlTemplate,
      config.roomIds,
      config.cookies,
      config.checkIntervalMinutes,
      config.accountName,
      config.web3ApiBaseUrl,
      config.web3RpcUrl,
      config.web3PrivateKey
    );
    await meetingAutomation.start();
  } catch (error) {
    console.error('Terjadi kesalahan fatal dalam aplikasi:', error);
  }
}

main();
