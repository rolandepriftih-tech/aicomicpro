import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STYLE,
  getAnalysisPrefix,
  getImagePrefix,
  getStyleConfig,
  isAspectSupported,
  STYLE_LIST,
  STYLE_VALUES,
} from '../lib/style-config';

describe('style config', () => {
  it('uses an explicit neutral default without injecting an art style', () => {
    expect(DEFAULT_STYLE).toBe('none');
    expect(getImagePrefix(DEFAULT_STYLE)).toBe('');
    expect(getAnalysisPrefix(DEFAULT_STYLE)).toBe('');
  });

  it('returns style config for valid style', () => {
    const config = getStyleConfig('anime');
    expect(config).toBeDefined();
    expect(config?.label).toBe('日系动漫');
    expect(config?.value).toBe('anime');
  });

  it('returns undefined for invalid style', () => {
    const config = getStyleConfig('invalid-style');
    expect(config).toBeUndefined();
  });

  it('checks aspect ratio support', () => {
    expect(isAspectSupported('anime', '16:9')).toBe(true);
    expect(isAspectSupported('anime', '9:16')).toBe(true);
    expect(isAspectSupported('anime', '1:1')).toBe(true);
  });

  it('has all styles in STYLE_LIST', () => {
    expect(STYLE_LIST.length).toBeGreaterThan(0);
    expect(STYLE_VALUES.length).toBeGreaterThan(0);
  });

  it('provides image prefix for anime style', () => {
    const prefix = getImagePrefix('anime');
    expect(prefix).toContain('anime style');
  });

  it('provides analysis prefix for realistic style', () => {
    const prefix = getAnalysisPrefix('realistic');
    expect(prefix).toContain('真人写实');
  });
});
