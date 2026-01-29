import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for the Portfolio website
 * Provides reusable methods for interacting with portfolio sections
 */
export class PortfolioPage {
  readonly page: Page;
  readonly navLinks: Locator;
  readonly heroSection: Locator;
  readonly aboutSection: Locator;
  readonly timelineSection: Locator;
  readonly projectsSection: Locator;
  readonly skillsSection: Locator;
  readonly contactSection: Locator;
  readonly aboutCards: Locator;
  readonly careerGame: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navLinks = page.locator('nav a');
    this.heroSection = page.locator('#hero');
    this.aboutSection = page.locator('#about');
    this.timelineSection = page.locator('#timeline');
    this.projectsSection = page.locator('#projects');
    this.skillsSection = page.locator('#skills');
    this.contactSection = page.locator('#contact');
    this.aboutCards = page.locator('[data-testid="about-card"]');
    this.careerGame = page.locator('#career-game');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToSection(sectionId: string) {
    await this.page.click(`a[href="#${sectionId}"]`);
    await this.page.waitForSelector(`#${sectionId}`, { state: 'visible' });
  }

  async scrollToSection(sectionId: string) {
    await this.page.locator(`#${sectionId}`).scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500); // Allow animations to settle
  }

  async expandAboutCard(index: number) {
    await this.aboutCards.nth(index).click();
    await this.page.waitForTimeout(300); // Animation time
  }

  async getScrollPosition(): Promise<number> {
    return await this.page.evaluate(() => window.scrollY);
  }

  async waitForAnimations() {
    // Wait for Framer Motion animations to complete
    await this.page.waitForTimeout(1000);
  }
}
