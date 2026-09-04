import { colors } from '../src/ui';

describe('SETU mobile safety contracts', () => {
  it('uses the web emergency color', () => expect(colors.red).toBe('#C62828'));
  it('keeps the mobile app free of server secrets', () => expect(process.env.MONGO_URL).toBeUndefined());
});
