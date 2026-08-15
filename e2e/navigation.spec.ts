import { test, expect } from '@playwright/test';
import { PortfolioPage } from './fixtures/portfolio-page';

test.describe('Portfolio Navigation', () => {
  let portfolio: PortfolioPage;

  test.beforeEach(async ({ page }) => {
    portfolio = new PortfolioPage(page);
    await portfolio.goto();
  });

  test('page loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Aram|Portfolio/i);
  });

  test('hero section is visible on load', async () => {
    await expect(portfolio.heroSection).toBeVisible();
  });

  test('scrolls to about section', async ({ page }) => {
    await portfolio.scrollToSection('about');

    const scrollY = await portfolio.getScrollPosition();
    expect(scrollY).toBeGreaterThan(0);
    await expect(portfolio.aboutSection).toBeInViewport();
  });

  test('scrolls to contact section', async ({ page }) => {
    await portfolio.scrollToSection('contact');

    await expect(portfolio.contactSection).toBeInViewport();
  });
});

test.describe('Accessibility', () => {
  test('page has exactly one h1', async ({ page }) => {
    await page.goto('/?view=list');

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('all images have alt text', async ({ page }) => {
    await page.goto('/?view=list');

    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);
  });
});
