import { joinCodeFromLink } from '../src/online/joinLink';

describe('join links', () => {
  it('reads a room code from Expo Go and app scheme URLs', () => {
    expect(joinCodeFromLink('exp://192.168.1.4:8081/--/join?code=A7K2')).toBe('A7K2');
    expect(joinCodeFromLink('murlan://join?code=H3P9')).toBe('H3P9');
    expect(joinCodeFromLink('https://example.com/--/join/K4N8')).toBe('K4N8');
  });

  it('ignores links without a valid room code', () => {
    expect(joinCodeFromLink(null)).toBeNull();
    expect(joinCodeFromLink('https://example.com/other')).toBeNull();
    expect(joinCodeFromLink('murlan://join?code=nope')).toBeNull();
  });
});
