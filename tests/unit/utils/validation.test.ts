import {
  isValidPublicKey,
  isValidSecretKey,
  isValidAmount,
  isValidDistribution,
} from '../../../src/utils/validation';

// const VALID_KEY_G = 'GADOPTER1111111111111111111111111111111111111111111111111111';
// const VALID_KEY_S = 'SADOPTER1111111111111111111111111111111111111111111111111111';

const VALID_KEY_G = 'GAGVLQRZZTHIXM7FYEXYA3Q2HNYOZ3FLQORBQIISF6YJQIHE5UIE2JMX';
const VALID_KEY_S = 'SADOPTER111111111111111111111111111111111111111111111111';

describe('isValidPublicKey', () => {
  it('accepts a valid G... key', () => expect(isValidPublicKey(VALID_KEY_G)).toBe(true));
  it('rejects S... key', () => expect(isValidPublicKey(VALID_KEY_S)).toBe(false));
  it('rejects empty string', () => expect(isValidPublicKey('')).toBe(false));
  it('rejects short key', () => expect(isValidPublicKey('GSHORT')).toBe(false));
});

describe('isValidSecretKey', () => {
  it('accepts a valid S... key', () => expect(isValidSecretKey(VALID_KEY_S)).toBe(true));
  it('rejects G... key', () => expect(isValidSecretKey(VALID_KEY_G)).toBe(false));
  it('rejects empty string', () => expect(isValidSecretKey('')).toBe(false));
});

describe('isValidAmount', () => {
  it('accepts positive decimal', () => expect(isValidAmount('100.50')).toBe(true));
  it('accepts whole number', () => expect(isValidAmount('500')).toBe(true));
  it('rejects zero', () => expect(isValidAmount('0')).toBe(false));
  it('rejects negative', () => expect(isValidAmount('-50')).toBe(false));
  it('rejects non-numeric', () => expect(isValidAmount('abc')).toBe(false));
  it('rejects empty string', () => expect(isValidAmount('')).toBe(false));
});

describe('isValidDistribution', () => {
  it('accepts 60/40 split', () => expect(isValidDistribution([
    { recipient: VALID_KEY_G, percentage: 60 },
    { recipient: VALID_KEY_G, percentage: 40 },
  ])).toBe(true));
  it('accepts decimal percentages that sum exactly to 100', () => expect(isValidDistribution([
    { recipient: VALID_KEY_G, percentage: 33.33 },
    { recipient: VALID_KEY_G, percentage: 33.33 },
    { recipient: VALID_KEY_G, percentage: 33.34 },
  ])).toBe(true));
  it('rejects sum of 90',   () => expect(isValidDistribution([
    { recipient: VALID_KEY_G, percentage: 60 },
    { recipient: VALID_KEY_G, percentage: 30 },
  ])).toBe(false));
  it('rejects decimal percentages that do not sum exactly to 100', () => expect(isValidDistribution([
    { recipient: VALID_KEY_G, percentage: 33.33 },
    { recipient: VALID_KEY_G, percentage: 33.33 },
    { recipient: VALID_KEY_G, percentage: 33.33 },
  ])).toBe(false));
  it('rejects empty array', () => expect(isValidDistribution([])).toBe(false));
  it('rejects invalid recipient', () => expect(isValidDistribution([
    { recipient: 'BADKEY', percentage: 100 },
  ])).toBe(false));
  it('rejects zero and over-100 percentages', () => {
    expect(isValidDistribution([
      { recipient: VALID_KEY_G, percentage: 0 },
      { recipient: VALID_KEY_G, percentage: 100 },
    ])).toBe(false);

    expect(isValidDistribution([
      { recipient: VALID_KEY_G, percentage: 101 },
    ])).toBe(false);
  });

  it('handles scientific notation in percentages', () => {
    // 1.0e2 is 100
    expect(isValidDistribution([
      { recipient: VALID_KEY_G, percentage: 1.0e2 },
    ])).toBe(true);

    // 5.0e1 + 5.0e1 = 50 + 50 = 100
    expect(isValidDistribution([
      { recipient: VALID_KEY_G, percentage: 5.0e1 },
      { recipient: VALID_KEY_G, percentage: 5.0e1 },
    ])).toBe(true);
  });
});
