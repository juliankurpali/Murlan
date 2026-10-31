import { legalDoc, TERMS_VERSION } from '../src/legal';

describe('legal documents', () => {
  it('ships terms and privacy in both languages', () => {
    expect(TERMS_VERSION).toBeGreaterThan(0);
    for (const language of ['en', 'sq'] as const) {
      const terms = legalDoc(language, 'terms');
      const privacy = legalDoc(language, 'privacy');
      expect(terms.sections.length).toBeGreaterThan(5);
      expect(privacy.sections.length).toBeGreaterThan(4);
      expect(terms.sections.some((row) => /gambling|bixhoz/i.test(`${row.heading} ${row.body}`))).toBe(true);
    }
  });
});
