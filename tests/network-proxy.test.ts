import { describe, it, expect } from 'vitest';
import { hasEnvProxy, resolveProxyMode } from '../lib/network-proxy';

describe('network proxy options', () => {
  it('defaults to direct mode even when VPN/proxy env vars exist', () => {
    expect(resolveProxyMode(undefined)).toBe('off');
    expect(resolveProxyMode('')).toBe('off');
    expect(resolveProxyMode('off')).toBe('off');
    expect(resolveProxyMode('env')).toBe('env');
  });

  it('detects common proxy environment variables', () => {
    expect(hasEnvProxy({ HTTPS_PROXY: 'http://127.0.0.1:7890' })).toBe(true);
    expect(hasEnvProxy({ http_proxy: 'http://127.0.0.1:7890' })).toBe(true);
    expect(hasEnvProxy({})).toBe(false);
  });

  it('detects all proxy environment variables', () => {
    expect(hasEnvProxy({ HTTP_PROXY: 'http://proxy:8080' })).toBe(true);
    expect(hasEnvProxy({ https_proxy: 'http://proxy:8080' })).toBe(true);
  });

  it('returns false when no proxy variables are set', () => {
    expect(hasEnvProxy({ HTTPS_PROXY: undefined })).toBe(false);
    expect(hasEnvProxy({ HTTP_PROXY: undefined })).toBe(false);
  });
});
