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
    console.log("Inisialisasi MeetingAutomation...");
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
    console.log("Menjalankan MeetingAutomation...");
    try {
      await this.playwrightService.launchBrowser();
      console.log("Browser berhasil diluncurkan.");
      await this.playwrightService.openNewPage();
      console.log("Halaman baru berhasil dibuka.");
      await this.playwrightService.setCookies(this.cookies);
      console.log("Cookies berhasil diset.");
      await this.joinMeetingLoop();
      this.startMeetingStatusCheck();
      this._questAutoClaimScheduler();
    } catch (error) {
      console.error("Gagal memulai MeetingAutomation:", error);
      await this.telegramNotifier.sendNotification(
        `<b>❌ Gagal Memulai Otomatisasi</b>\nTerjadi kesalahan saat memulai: ${error.message}`
      );
    }
  }

  async joinMeetingLoop() {
    console.log("Memulai loop untuk bergabung ke meeting...");
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
      console.log(`Mencoba bergabung ke Room ID: ${roomId}`);

      try {
        await this.playwrightService.navigateTo(meetingUrl);
        await this.playwrightService.waitForTimeout(10000);

        const joinButtonSelector = "button#join-button";
        const joinButton = await this.playwrightService
          .getPage()
          .locator(joinButtonSelector);

        if (await joinButton.isVisible()) {
          console.log("Tombol Join ditemukan, mencoba klik...");
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
          console.warn(`Host belum memulai meeting di Room ID: ${roomId}`);
          await this.telegramNotifier.sendNotification(
            `<b>⚠️ Host Belum Memulai</b>\nHost belum memulai meeting untuk Room ID: <code>${roomId}</code>. Mencoba room ID berikutnya.`
          );
          currentRoomIndex++;
          await this.playwrightService.waitForTimeout(10000);
        } else if (isInMeetingVisible || isInSpaceVisible) {
          this.isJoined = true;
          joinedSuccessfully = true;
          console.log(`Berhasil bergabung ke Room ID: ${roomId}`);
          await this.telegramNotifier.sendNotification(
            `<b>✅ Berhasil Bergabung</b>\nBerhasil bergabung ke meeting dengan Room ID: <code>${roomId}</code>.`
          );
        } else {
          console.warn(`Gagal konfirmasi join di Room ID: ${roomId}`);
          await this.telegramNotifier.sendNotification(
            `<b>❌ Gagal Konfirmasi Bergabung</b>\nGagal mengonfirmasi bergabung ke meeting dengan Room ID: <code>${roomId}</code>. Mencoba room ID berikutnya.`
          );
          currentRoomIndex++;
          await this.playwrightService.waitForTimeout(10000);
        }
      } catch (error) {
        console.error(`Gagal saat mencoba Room ID ${roomId}:`, error);
        await this.telegramNotifier.sendNotification(
          `<b>❌ Gagal Operasi</b>\nTerjadi kesalahan saat mencoba bergabung atau memeriksa status untuk Room ID <code>${roomId}</code>: ${error.message}`
        );
        currentRoomIndex++;
        await this.playwrightService.waitForTimeout(10000);
      }

      const isHostMeetingSelector = 'div.cursor-pointer:has-text("Locked")';
      const isHasUnlockedMeetingSelector = 'div.cursor-pointer:has-text("Unlocked")';
      const isHostMeeting = await this.playwrightService
        .getPage()
        .locator(isHostMeetingSelector);
      const isHostMeetingVisible = await isHostMeeting.isVisible();

      if (isHostMeetingVisible) {
        console.log("you are host");
        await isHostMeeting.click();

        const isHasUnlockedMeeting = await this.playwrightService
          .getPage()
          .locator(isHasUnlockedMeetingSelector);
        const isHasUnlockedMeetingVisible = await isHasUnlockedMeeting.isVisible();

        if (isHasUnlockedMeetingVisible) {
          console.log("meeting unlock successfully");
        }
      } else {
        console.log("you are not host");
      }
    }
  }

  startMeetingStatusCheck() {
    console.log("Memulai interval pemeriksaan status meeting...");
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }
    const intervalMs = this.checkIntervalMinutes * 60 * 1000;
    this.checkIntervalId = setInterval(async () => {
      await this.checkMeetingStatus();
    }, intervalMs);
  }

  async checkMeetingStatus() {
    console.log("Memeriksa status apakah masih berada di dalam meeting...");
    if (!this.playwrightService.getPage()) {
      console.warn("Browser page tidak ditemukan, mencoba rejoin...");
      this.isJoined = false;
      await this.telegramNotifier.sendNotification(
        "<b>⚠️ Peringatan</b>\nHalaman browser tidak tersedia. Mencoba bergabung kembali."
      );
      await this.rejoinMeeting();
      return;
    }

    try {
      const inMeetingIndicatorSelector = 'button[aria-label="endCall"]';
      const inMeetingElement = await this.playwrightService
        .getPage()
        .locator(inMeetingIndicatorSelector).first();

      const isInMeeting = await inMeetingElement.isVisible();

      if (!isInMeeting) {
        console.warn("Terdeteksi keluar dari meeting.");
        this.isJoined = false;
        await this.telegramNotifier.sendNotification(
          "<b>⚠️ Keluar Meeting</b>\nTerdeteksi keluar dari meeting. Mencoba bergabung kembali."
        );
        await this.rejoinMeeting();
      } else {
        console.log("Status OK: Masih berada di meeting.");
        this.isJoined = true;
        await this.telegramNotifier.sendNotification(
          `<b>✅ Masih Berada di Meeting</b>`
        );
      }
    } catch (error) {
      console.error("Error saat pengecekan status meeting:", error);
      this.isJoined = false;
      await this.telegramNotifier.sendNotification(
        `<b>❌ Kesalahan Pengecekan</b>\nTerjadi kesalahan saat memeriksa status meeting: ${error.message}. Mencoba bergabung kembali.`
      );
      await this.rejoinMeeting();
    }
  }

  async rejoinMeeting() {
    console.log("Menjalankan ulang proses join meeting...");
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
    console.log("Menjadwalkan auto klaim quest");
    const SIX_HOURS_MS = 1 * 60 * 60 * 1000;
    setInterval(async () => {
      const now = new Date();
      const currentDay = now.getDate();
      if (
        this._lastQuestClaimCheckDay === null ||
        currentDay !== this._lastQuestClaimCheckDay
      ) {
        console.log("Hari baru dimulai, reset status quest.");
        this._questMaxHpReachedToday = false;
        this._lastQuestClaimCheckDay = currentDay;
        this._lastQuestClaimTime = null;
      }

      if (this._questMaxHpReachedToday) return;

      if (
        !this._lastQuestClaimTime ||
        now - this._lastQuestClaimTime >= SIX_HOURS_MS
      ) {
        console.log("Memulai proses auto klaim quest...");
        await this.telegramNotifier.sendNotification(
          `<b>🚀 Auto Klaim Quest</b>\nKlaim quest Web3 dijalankan otomatis.`
        );

        const isAuthenticated =
          await this.web3Service.authenticateWeb3Session();
        if (isAuthenticated) {
          const result = await this.web3Service.claimMeetingQuest();
          this._lastQuestClaimTime = new Date();
          console.log("Klaim quest berhasil.");

          if (result?.maxHp) {
            this._questMaxHpReachedToday = true;
            console.log("Max HP telah tercapai hari ini.");
            await this.telegramNotifier.sendNotification(
              `<b>⚠️ Max HP Tercapai</b>\nKlaim quest akan dilanjutkan besok hari.`
            );
          }
        } else {
          console.error("Gagal otentikasi Web3 saat auto klaim quest.");
          await this.telegramNotifier.sendNotification(
            `<b>❌ Auto Klaim Quest Gagal</b>\nOtentikasi Web3 gagal sebelum klaim quest.`
          );
        }
      }
    }, 5 * 60 * 1000);
  }
}
