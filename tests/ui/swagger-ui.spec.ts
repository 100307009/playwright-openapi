import { test, expect } from '../../src/fixtures';
import { SwaggerUIPage } from '../../src/pageObjects/SwaggerUIPage';

/**
 * UI tests here use the SAME `credentials` and `fixtureIds` fixtures the
 * contract and flow suites use (see tests/contract, tests/flow) - the shared
 * fixture layer is the point: the exact api_key that flow tests send as a
 * header is the one this test types into the UI's Authorize dialog.
 */
test.describe('UI: Swagger UI (live API-backed)', () => {
  test('Try it out on GET /pet/{petId} returns the expected pet from the live API', async ({ page, fixtureIds }) => {
    // 'domcontentloaded' rather than the default 'load': Swagger UI keeps polling/streaming
    // long after the page is interactive, so waiting for a full network-idle 'load' event is
    // both slower and occasionally times out against the public demo.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const ui = new SwaggerUIPage(page);

    const block = await ui.tryOut('/pet/{petId}');
    await ui.execute(block, [fixtureIds.existingPetId]);

    const statusText = await ui.lastResponseStatusText(block);
    expect(statusText).toContain('200');

    const bodyText = await ui.lastResponseBodyText(block);
    expect(bodyText).toContain(`"id": ${fixtureIds.existingPetId}`);
  });

  test('Authorizing with the shared valid api_key is reflected in the UI', async ({ page, credentials }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const ui = new SwaggerUIPage(page);

    const beforeText = await ui.apiKeyAuthSectionText();
    expect(beforeText).not.toContain('Authorized');

    await ui.authorizeApiKey(credentials.valid.apiKey);

    const afterText = await ui.apiKeyAuthSectionText();
    expect(afterText).toContain('Authorized');
  });
});
