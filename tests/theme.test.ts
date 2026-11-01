import { colors, teamToken } from '../src/theme';

describe('teamToken', () => {
  it('gives Classic partners the same color', () => {
    const teamOf = [0, 1, 0, 1];
    expect(teamToken(teamOf[0])).toBe(teamToken(teamOf[2]));
    expect(teamToken(teamOf[1])).toBe(teamToken(teamOf[3]));
    expect(teamToken(teamOf[0])).toBe(colors.team1);
    expect(teamToken(teamOf[1])).toBe(colors.team2);
  });

  it('gives Super partners the same color', () => {
    const teamOf = [0, 1, 2, 0, 1, 2];
    expect(teamToken(teamOf[0])).toBe(teamToken(teamOf[3]));
    expect(teamToken(teamOf[1])).toBe(teamToken(teamOf[4]));
    expect(teamToken(teamOf[2])).toBe(teamToken(teamOf[5]));
    expect(teamToken(2)).toBe(colors.team3);
  });
});
