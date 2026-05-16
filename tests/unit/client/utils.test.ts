import { describe, it, expect } from 'vitest';
import { formatQueueDuration, formatQueueTime } from '../../../src/client/utils/format';
import { safeUrl } from '../../../src/client/utils/image';
import { statusText } from '../../../src/client/utils/stateText';
import { safeNextPath } from '../../../src/client/utils/guards';
import { loadWifiQr, escapeWifi, wifiQrText } from '../../../src/client/utils/storage';

describe('Format Utils', () => {
  it('formatQueueDuration formats correctly', () => {
    expect(formatQueueDuration(10.5)).toBe('10s');
    expect(formatQueueDuration(0)).toBe('-');
    expect(formatQueueDuration('abc')).toBe('-');
  });

  it('formatQueueTime handles invalid values', () => {
    expect(formatQueueTime('invalid')).toBe('-');
  });
});

describe('Image Utils', () => {
  it('safeUrl avoids javascript protocol', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('http://example.com')).toBe('http://example.com/');
    expect(safeUrl('i0.hdslb.com/bfs/test.png')).toBe('https://i0.hdslb.com/bfs/test.png');
    expect(safeUrl('//i0.hdslb.com/bfs/test.png')).toBe('https://i0.hdslb.com/bfs/test.png');
  });
});

describe('StateText Utils', () => {
  it('statusText returns correct text', () => {
    expect(statusText('idle')).toBe('READY');
    expect(statusText('revealed')).toBe('ANSWER');
    expect(statusText('unknown')).toBe('READY');
  });
});

describe('Guards Utils', () => {
  it('safeNextPath ensures local paths', () => {
    expect(safeNextPath('/host')).toBe('/host');
    expect(safeNextPath('//example.com')).toBe('/host');
    expect(safeNextPath('https://example.com')).toBe('/host');
  });
});

describe('Storage Utils', () => {
  it('escapeWifi escapes special chars', () => {
    expect(escapeWifi('foo\\bar;baz:qux')).toBe('foo\\\\bar\\;baz\\:qux');
  });

  it('wifiQrText generates correct WIFI string', () => {
    expect(wifiQrText({ ssid: 'test', password: 'pwd', auth: 'WPA' })).toBe('WIFI:T:WPA;S:test;P:pwd;;');
    expect(wifiQrText({ ssid: 'test', auth: 'nopass' })).toBe('WIFI:T:nopass;S:test;P:;;');
    expect(wifiQrText({ ssid: '' })).toBe('');
  });
});
