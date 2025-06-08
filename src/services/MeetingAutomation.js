import { PlaywrightService } from "./PlaywrightService.js";
import { TelegramNotifier } from "./TelegramNotifier.js";
import { Web3Service } from "./Web3Service.js";

export class MeetingAutomation {
  playwrightService;
  telegramNotifier;
  web3Service;
  meetingUrlTemplate;
  roomIds;
  cookies;
  checkIntervalMinutes;
  isJoined = false;
  checkIntervalId = null;
  _lastQuestClaimTime = null;
  _questMaxHpReachedToday = false;
  _lastQuestClaimCheckDay = null;

  constructor(
    telegramBotToken,
    telegramChatId,
    meetingUrlTemplate,
    roomIds,
    cookies,
    checkIntervalMinutes,
    accountName,
    web3ApiBaseUrl,
    web3RpcUrl,
    web3PrivateKey
  ) {
    this.playwrightService = new PlaywrightService();
    this.telegramNotifier = new TelegramNotifier(
      telegramBotToken,
      telegramChatId,
      accountName
    );
    this.meetingUrlTemplate = meetingUrlTemplate;
    this.roomIds = roomIds;
    this.cookies = cookies;
    this.checkIntervalMinutes = checkIntervalMinutes;
    this.web3Service = new Web3Service(
      web3ApiBaseUrl,
      web3RpcUrl,
      web3PrivateKey,
      telegramBotToken,
      telegramChatId,
      accountName
    );
  }

  async start() {
    try {
      await this.playwrightService.launchBrowser();
      await this.playwrightService.openNewPage();
      await this.playwrightService.setCookies(this.cookies);
      await this.joinMeetingLoop();
      this.startMeetingStatusCheck();
      this._questAutoClaimScheduler();
    } catch (error) {
      await this.telegramNotifier.sendNotification(
        `<b>❌ Gagal Memulai Otomatisasi</b>\nTerjadi kesalahan saat memulai: ${error.message}`
      );
    }
  }

  async joinMeetingLoop() {
    let joinedSuccessfully = false;
    let currentRoomIndex = 0;
    const inMeetingIndicatorSelector = 'button[aria-label="leave"]';
    const inSPaceIndicator = 'button[aria-label="endCall"]';

    const hostNotStartedSelector = "text=Host has not started the meeting";
    while (!joinedSuccessfully) {
      if (currentRoomIndex >= this.roomIds.length) {
        currentRoomIndex = 0;
      }
      const roomId = this.roomIds[currentRoomIndex];
      const meetingUrl = this.meetingUrlTemplate.replace("{roomId}", roomId);
      try {
        await this.playwrightService.navigateTo(meetingUrl);
        await this.playwrightService.waitForTimeout(10000);
        const joinButtonSelector = "button#join-button";
        const joinButton = await this.playwrightService
          .getPage()
          .locator(joinButtonSelector);
        if (await joinButton.isVisible()) {
          await joinButton.click();
          await this.playwrightService.waitForTimeout(3000);
        }
        await this.playwrightService.waitForTimeout(10000);
        const hostNotStarted = await this.playwrightService
          .getPage()
          .locator(hostNotStartedSelector);
        const inMeetingElement = await this.playwrightService
          .getPage()
          .locator(inMeetingIndicatorSelector);
        const inSpaceElement = await this.playwrightService
          .getPage()
          .locator(inSPaceIndicator)
          .filter({ hasText: "Leave the spaces" });

        await this.playwrightService.waitForTimeout(20000);

        const isHostNotStartedVisible = await hostNotStarted.isVisible();
        const isInMeetingVisible = await inMeetingElement.isVisible();
        const isInSpaceVisible = await inSpaceElement.isVisible();
        if (isHostNotStartedVisible) {
          await this.telegramNotifier.sendNotification(
            `<b>⚠️ Host Belum Memulai</b>\nHost belum memulai meeting untuk Room ID: <code>${roomId}</code>. Mencoba room ID berikutnya.`
          );
          currentRoomIndex++;
          await this.playwrightService.waitForTimeout(10000);
        } else if (isInMeetingVisible || isInSpaceVisible) {
          this.isJoined = true;
          joinedSuccessfully = true;
          await this.telegramNotifier.sendNotification(
            `<b>✅ Berhasil Bergabung</b>\nBerhasil bergabung ke meeting dengan Room ID: <code>${roomId}</code>.`
          );
        } else {
          await this.telegramNotifier.sendNotification(
            `<b>❌ Gagal Konfirmasi Bergabung</b>\nGagal mengonfirmasi bergabung ke meeting dengan Room ID: <code>${roomId}</code>. Mencoba room ID berikutnya.`
          );
          currentRoomIndex++;
          await this.playwrightService.waitForTimeout(10000);
        }
      } catch (error) {
        await this.telegramNotifier.sendNotification(
          `<b>❌ Gagal Operasi</b>\nTerjadi kesalahan saat mencoba bergabung atau memeriksa status untuk Room ID <code>${roomId}</code>: ${error.message}`
        );
        currentRoomIndex++;
        await this.playwrightService.waitForTimeout(10000);
      }
    }
  }

  startMeetingStatusCheck() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }
    const intervalMs = this.checkIntervalMinutes * 60 * 1000;
    this.checkIntervalId = setInterval(async () => {
      await this.checkMeetingStatus();
    }, intervalMs);
  }

  async checkMeetingStatus() {
    if (!this.playwrightService.getPage()) {
      console.warn(
        "Halaman browser tidak tersedia. Mungkin browser telah ditutup atau terjadi kesalahan."
      );
      this.isJoined = false;
      await this.telegramNotifier.sendNotification(
        "<b>⚠️ Peringatan</b>\nHalaman browser tidak tersedia. Mencoba bergabung kembali."
      );
      await this.rejoinMeeting();
      return;
    }

    try {
      const inMeetingIndicatorSelector = 'span[aria-label="peersCount"]';
      const inMeetingElement = await this.playwrightService
        .getPage()
        .locator(inMeetingIndicatorSelector);

      const isInMeeting = await inMeetingElement.isVisible();

      if (!isInMeeting) {
        console.log(
          "Terdeteksi tidak berada di dalam meeting. Mencoba bergabung kembali."
        );
        this.isJoined = false;
        await this.telegramNotifier.sendNotification(
          "<b>⚠️ Keluar Meeting</b>\nTerdeteksi keluar dari meeting. Mencoba bergabung kembali."
        );
        await this.rejoinMeeting();
      } else {
        console.log("Masih berada di dalam meeting.");
        await this.telegramNotifier.sendNotification(
        `<b>✅ Masih Berada di Meeting</b>`
      );
        this.isJoined = true;
      }
    } catch (error) {
      console.error("Terjadi kesalahan saat memeriksa status meeting:", error);
      this.isJoined = false;
      await this.telegramNotifier.sendNotification(
        `<b>❌ Kesalahan Pengecekan</b>\nTerjadi kesalahan saat memeriksa status meeting: ${error.message}. Mencoba bergabung kembali.`
      );
      await this.rejoinMeeting();
    }
  }

  async rejoinMeeting() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    await this.telegramNotifier.sendNotification(
      "<b>🔄 Bergabung Kembali</b>\nMencoba bergabung kembali ke meeting..."
    );
    await this.joinMeetingLoop();
    this.startMeetingStatusCheck();
  }

  _questAutoClaimScheduler() {
    const SIX_HOURS_MS = 1 * 60 * 60 * 1000;
    setInterval(async () => {
      const now = new Date();
      const currentDay = now.getDate();
      if (
        this._lastQuestClaimCheckDay === null ||
        currentDay !== this._lastQuestClaimCheckDay
      ) {
        this._questMaxHpReachedToday = false;
        this._lastQuestClaimCheckDay = currentDay;
        this._lastQuestClaimTime = null;
      }
      if (this._questMaxHpReachedToday) return;
      if (
        !this._lastQuestClaimTime ||
        now - this._lastQuestClaimTime >= SIX_HOURS_MS
      ) {
        await this.telegramNotifier.sendNotification(
          `<b>🚀 Auto Klaim Quest</b>\nKlaim quest Web3 dijalankan otomatis.`
        );
        const isAuthenticated =
          await this.web3Service.authenticateWeb3Session();
        if (isAuthenticated) {
          const result = await this.web3Service.claimMeetingQuest();
          this._lastQuestClaimTime = new Date();
          if (result?.maxHp) {
            this._questMaxHpReachedToday = true;
            await this.telegramNotifier.sendNotification(
              `<b>⚠️ Max HP Tercapai</b>\nKlaim quest akan dilanjutkan besok hari.`
            );
          }
        } else {
          await this.telegramNotifier.sendNotification(
            `<b>❌ Auto Klaim Quest Gagal</b>\nOtentikasi Web3 gagal sebelum klaim quest.`
          );
        }
      }
    }, 5 * 60 * 1000);
  }
}
