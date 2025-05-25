class TelegramNotifier {
    /**
     * @private
     * @type {string}
     */
    botToken;

    /**
     * @private
     * @type {string}
     */
    chatId;

   /**
     * @private
     * @type {string}
     */
    accountName;

    constructor(botToken, chatId, accountName) {
        this.botToken = botToken;
        this.chatId = chatId;
        this.accountName = accountName;
        if (!this.botToken || !this.chatId) {
            console.warn('Token bot Telegram atau Chat ID tidak diatur. Notifikasi Telegram mungkin tidak berfungsi.');
        }
    }

    /**
     * @param {string} message
     * @returns {Promise<void>}
     */
    async sendNotification(message) {
        if (!this.botToken || !this.chatId) {
            console.warn('Tidak dapat mengirim notifikasi: Token bot Telegram atau Chat ID tidak diatur.');
            return;
        }

        const fullMessage = `<b>[${this.accountName}]</b> ${message}`;

        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        const params = new URLSearchParams({
            chat_id: this.chatId,
            text: fullMessage,
            parse_mode: 'HTML'
        });

        try {
            const response = await fetch(`${url}?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                console.error('Gagal mengirim notifikasi Telegram:', data);
            } else {
                console.log('Notifikasi Telegram berhasil dikirim.');
            }
        } catch (error) {
            console.error('Terjadi kesalahan saat mengirim notifikasi Telegram:', error);
        }
    }
}

export { TelegramNotifier };