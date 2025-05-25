import { PlaywrightService } from "./PlaywrightService.js";
import { TelegramNotifier } from "./TelegramNotifier.js";

class MeetingAutomation {
  /**
   * @private
   * @type {PlaywrightService}
   */
  playwrightService;

  /**
   * @private
   * @type {TelegramNotifier}
   */
  telegramNotifier;

  /**
   * @private
   * @type {string}
   */
  meetingUrlTemplate;

  /**
   * @private
   * @type {string[]}
   */
  roomIds;

  /**
   * @private
   * @type {object[]}
   */
  cookies;

  /**
   * @private
   * @type {number}
   */
  checkIntervalMinutes;

  /**
   * @private
   * @type {boolean}
   */
  isJoined = false;

  /**
   * @private
   * @type {number | null}
   */
  checkIntervalId = null;

  /**
   * @param {string} telegramBotToken
   * @param {string} telegramChatId
   * @param {string} meetingUrlTemplate
   * @param {string[]} roomIds
   * @param {object[]} cookies
   * @param {number} checkIntervalMinutes
   * @param {string} accountName
   */
  constructor(
    telegramBotToken,
    telegramChatId,
    meetingUrlTemplate,
    roomIds,
    cookies,
    checkIntervalMinutes,
    accountName,
  ) {
    this.playwrightService = new PlaywrightService();
    this.telegramNotifier = new TelegramNotifier(
      telegramBotToken,
      telegramChatId,
      accountName,
    );
    this.meetingUrlTemplate = meetingUrlTemplate;
    this.roomIds = roomIds;
    this.cookies = cookies;
    this.checkIntervalMinutes = checkIntervalMinutes;
  }

  async start() {
    console.log("Memulai otomatisasi meeting...");
    try {
      await this.playwrightService.launchBrowser();
      await this.playwrightService.openNewPage();
      await this.playwrightService.setCookies(this.cookies);

      await this.joinMeetingLoop();

      this.startMeetingStatusCheck();

      console.log(
        "Otomatisasi meeting berjalan. Menunggu pengecekan berkala..."
      );
    } catch (error) {
      console.error("Gagal memulai otomatisasi:", error);
      await this.telegramNotifier.sendNotification(
        `<b>❌ Gagal Memulai Otomatisasi</b>\nTerjadi kesalahan saat memulai: ${error.message}`
      );
    }
  }

  /**
   * @private
   */
  async joinMeetingLoop() {
    let joinedSuccessfully = false;
    let currentRoomIndex = 0;

    const inMeetingIndicatorSelector = 'button[aria-label="leave"]';
    const hostNotStartedSelector = "text=Host has not started the meeting";

    while (!joinedSuccessfully) {
      if (currentRoomIndex >= this.roomIds.length) {
        console.warn(
          "Semua room ID telah dicoba. Mengulang dari awal daftar room ID."
        );
        currentRoomIndex = 0;
      }

      const roomId = this.roomIds[currentRoomIndex];
      const meetingUrl = this.meetingUrlTemplate.replace("{roomId}", roomId);
      console.log(
        `Mencoba bergabung ke meeting dengan Room ID: ${roomId} di URL: ${meetingUrl}`
      );

      try {
        await this.playwrightService.navigateTo(meetingUrl);
        await this.playwrightService.waitForTimeout(10000);

        const joinButtonSelector = "button#join-button";
        const joinButton = await this.playwrightService
          .getPage()
          .locator(joinButtonSelector);

        if (await joinButton.isVisible()) {
          console.log('Menemukan tombol "Join Meeting", mengklik...');
          await joinButton.click();
          await this.playwrightService.waitForTimeout(3000); 
        } else {
          console.log(
            'Tombol "Join Meeting" tidak ditemukan atau sudah diklik. Melanjutkan pemeriksaan status.'
          );
        }

        await this.playwrightService.waitForTimeout(10000);

        const hostNotStarted = await this.playwrightService
          .getPage()
          .locator(hostNotStartedSelector);
        const inMeetingElement = await this.playwrightService
          .getPage()
          .locator(inMeetingIndicatorSelector);

        const isHostNotStartedVisible = await hostNotStarted.isVisible();
        const isInMeetingVisible = await inMeetingElement.isVisible();

        if (isHostNotStartedVisible) {
          console.log(
            `Host belum memulai meeting untuk Room ID: ${roomId}. Mencoba Room ID berikutnya.`
          );
          await this.telegramNotifier.sendNotification(
            `<b>⚠️ Host Belum Memulai</b>\nHost belum memulai meeting untuk Room ID: <code>${roomId}</code>. Mencoba room ID berikutnya.`
          );
          currentRoomIndex++;
          await this.playwrightService.waitForTimeout(10000); 
        } else if (isInMeetingVisible) {
          this.isJoined = true;
          joinedSuccessfully = true;
          console.log(
            `Berhasil bergabung ke meeting dengan Room ID: ${roomId}.`
          );
          await this.telegramNotifier.sendNotification(
            `<b>✅ Berhasil Bergabung</b>\nBerhasil bergabung ke meeting dengan Room ID: <code>${roomId}</code>.`
          );
        } else {
          console.log(
            `Gagal mengonfirmasi bergabung ke meeting dengan Room ID: ${roomId}. Tidak ada pesan host dan tidak ada indikator di dalam meeting. Mencoba Room ID berikutnya.`
          );
          await this.telegramNotifier.sendNotification(
            `<b>❌ Gagal Konfirmasi Bergabung</b>\nGagal mengonfirmasi bergabung ke meeting dengan Room ID: <code>${roomId}</code>. Mencoba room ID berikutnya.`
          );
          currentRoomIndex++;
          await this.playwrightService.waitForTimeout(10000); 
        }
      } catch (error) {
        console.error(
          `Terjadi kesalahan saat mencoba bergabung atau memeriksa status untuk Room ID ${roomId}:`,
          error
        );
        await this.telegramNotifier.sendNotification(
          `<b>❌ Gagal Operasi</b>\nTerjadi kesalahan saat mencoba bergabung atau memeriksa status untuk Room ID <code>${roomId}</code>: ${error.message}`
        );
        currentRoomIndex++;
        await this.playwrightService.waitForTimeout(10000); 
      }
    }
  }

  /**
   * @private
   */
  startMeetingStatusCheck() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    const intervalMs = this.checkIntervalMinutes * 60 * 1000;
    this.checkIntervalId = setInterval(async () => {
      console.log(
        `Melakukan pengecekan status meeting (${this.checkIntervalMinutes} menit)...`
      );
      await this.checkMeetingStatus();
    }, intervalMs);
  }

  /**
   * @private
   */
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
      const inMeetingIndicatorSelector = 'button[aria-label="leave"]';
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

  /**
   * @private
   */
  async rejoinMeeting() {
    console.log("Mencoba bergabung kembali ke meeting...");
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
}

export { MeetingAutomation };
