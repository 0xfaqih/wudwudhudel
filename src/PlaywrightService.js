import { chromium } from 'playwright';

export class PlaywrightService {
    /**
     * @private
     * @type {import('playwright').Browser | null}
     */
    browser = null;

    /**
     * @private
     * @type {import('playwright').Page | null}
     */
    page = null;

    /**
     * @returns {Promise<void>}
     */
    async launchBrowser() {
        if (this.browser) {
            console.log('Browser sudah berjalan.');
            return;
        }
        console.log('Meluncurkan browser...');
        this.browser = await chromium.launch({ headless: false }); 
        console.log('Browser diluncurkan.');
    }

    /**
     * @returns {Promise<void>}
     */
    async openNewPage() {
        if (!this.browser) {
            throw new Error('Browser belum diluncurkan. Panggil launchBrowser() terlebih dahulu.');
        }
        console.log('Membuka halaman baru...');
        this.page = await this.browser.newPage();
        console.log('Halaman baru dibuka.');
    }

    /**
     * @param {object[]} cookies
     * @returns {Promise<void>}
     */
    async setCookies(cookies) {
        if (!this.page) {
            throw new Error('Halaman belum dibuka. Panggil openNewPage() terlebih dahulu.');
        }
        console.log('Menyuntikkan cookie...');
        await this.page.context().addCookies(cookies);
        console.log('Cookie berhasil disuntikkan.');
    }

    /**
     * @param {string} url
     * @returns {Promise<void>}
     */
    async navigateTo(url) {
        if (!this.page) {
            throw new Error('Halaman belum dibuka. Panggil openNewPage() terlebih dahulu.');
        }
        console.log(`Menavigasi ke: ${url}`);
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        console.log('Navigasi selesai.');
    }

    /**
     * @returns {import('playwright').Page | null}
     */
    getPage() {
        return this.page;
    }

    /**
     * @returns {Promise<void>}
     */
    async closeBrowser() {
        if (this.browser) {
            console.log('Menutup browser...');
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('Browser ditutup.');
        }
    }

    /**
     * @param {number} ms
     * @returns {Promise<void>}
     */
    async waitForTimeout(ms) {
        await this.page.waitForTimeout(ms);
    }
}