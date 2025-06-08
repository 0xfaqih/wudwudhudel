export class TelegramNotifier {
    botToken;
    chatId;
    accountName;

    constructor(botToken, chatId, accountName) {
        this.botToken = botToken;
        this.chatId = chatId;
        this.accountName = accountName;
    }

    async sendNotification(message) {
        if (!this.botToken || !this.chatId) return;
        const fullMessage = `<b>[${this.accountName}]</b> ${message}`;
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        const params = new URLSearchParams({
            chat_id: this.chatId,
            text: fullMessage,
            parse_mode: 'HTML',
        });
        try {
            const response = await fetch(`${url}?${params.toString()}`);
            if (!response.ok) {
                const data = await response.json();
                console.error('Gagal mengirim notifikasi Telegram:', data);
            }
        } catch (error) {
            console.error('Terjadi kesalahan saat mengirim notifikasi Telegram:', error);
        }
    }
}
