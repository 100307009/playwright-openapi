import { Locator, Page } from '@playwright/test';

/**
 * Thin wrapper around the Swagger UI page served alongside the live API.
 * Petstore has no product frontend of its own; Swagger UI is a real page
 * that genuinely depends on the same API under test (its "Try it out" and
 * "Authorize" flows call the live endpoints), so it stands in for a real
 * frontend here and exercises the "UI relies on API" requirement honestly.
 */
export class SwaggerUIPage {
  constructor(private readonly page: Page) {}

  /** Locates an operation's collapsible block, e.g. pathTemplate="/pet/{petId}". */
  operationBlock(pathTemplate: string): Locator {
    return this.page.locator('.opblock', { hasText: pathTemplate }).first();
  }

  /** Swagger UI fetches and renders the spec client-side; wait for it before any interaction. */
  private async waitUntilReady(): Promise<void> {
    await this.page.locator('.opblock').first().waitFor({ timeout: 20_000 });
  }

  async tryOut(pathTemplate: string): Promise<Locator> {
    await this.waitUntilReady();
    const block = this.operationBlock(pathTemplate);
    await block.locator('.opblock-summary').click();
    await block.locator('button.try-out__btn').click();
    return block;
  }

  /** Fills the operation's parameter inputs, in DOM order, then executes the request. */
  async execute(block: Locator, paramValues: string[]): Promise<void> {
    const inputs = block.locator('input[type=text], input[type=number]');
    for (let i = 0; i < paramValues.length; i++) {
      await inputs.nth(i).fill(paramValues[i]);
    }
    await block.locator('button.execute').click();
    await block.locator('.live-responses-table').waitFor();
  }

  async lastResponseStatusText(block: Locator): Promise<string> {
    return block.locator('.live-responses-table').innerText();
  }

  async lastResponseBodyText(block: Locator): Promise<string> {
    // Scoped past the curl-command box, which also renders inside a `.microlight` element.
    return block.locator('.responses-table .response-col_description .microlight').first().innerText();
  }

  async authorizeApiKey(apiKey: string): Promise<void> {
    await this.waitUntilReady();
    await this.page.locator('button.btn.authorize').click();
    const section = this.page.locator('.auth-container').filter({ hasText: 'api_key' }).first();
    await section.locator('input[type=text]').fill(apiKey);
    await this.page.getByRole('button', { name: 'Apply credentials' }).click();
    await this.page.getByRole('button', { name: 'Close' }).first().click();
  }

  /** Reopens the Authorize dialog to read back the api_key scheme's state, then closes it again. */
  async apiKeyAuthSectionText(): Promise<string> {
    await this.waitUntilReady();
    await this.page.locator('button.btn.authorize').click();
    const section = this.page.locator('.auth-container').filter({ hasText: 'api_key' }).first();
    const text = await section.innerText();
    await this.page.getByRole('button', { name: 'Close' }).first().click();
    return text;
  }
}
