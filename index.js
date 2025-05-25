import { MeetingAutomation } from './src/MeetingAutomation.js';
import { config } from './src/config.js';

/**
 * Fungsi asinkron utama untuk memulai otomatisasi meeting.
 */
async function main() {
    try {
        const meetingAutomation = new MeetingAutomation(
            config.telegramBotToken,
            config.telegramChatId,
            config.meetingUrlTemplate,
            config.roomIds,
            config.cookies,
            config.checkIntervalMinutes
        );
        await meetingAutomation.start();
    } catch (error) {
        console.error('Terjadi kesalahan fatal dalam aplikasi:', error);
        // Notifikasi ke Telegram jika terjadi kesalahan fatal
        // Karena ini kesalahan fatal, mungkin TelegramNotifier belum terinisialisasi
        // atau ada masalah dengan koneksi.
        // Untuk kesederhanaan, kita hanya log di sini.
    }
}

// Jalankan fungsi utama
main();