import { chromium } from 'playwright';

export class PlaywrightService {
    browser = null;
    page = null;

    async launchBrowser() {
        if (this.browser) return;
        this.browser = await chromium.launch({ headless: true });
    }

    async openNewPage() {
        if (!this.browser) throw new Error('Browser belum diluncurkan.');
        this.page = await this.browser.newPage();
    }

    async setCookies(cookies) {
        if (!this.page) throw new Error('Halaman belum dibuka.');
        await this.page.context().addCookies(cookies);
    }

    async navigateTo(url) {
        if (!this.page) throw new Error('Halaman belum dibuka.');
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    getPage() {
        return this.page;
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    async waitForTimeout(ms) {
        if (!this.page) return;
        await this.page.waitForTimeout(ms);
    }
}
