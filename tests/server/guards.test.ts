import { describe, expect, it } from 'vitest';
import { 
  isRecord, isString, isNumber, isBoolean, parseJsonBody,
  isClientMessage, isHelloMessage, isCommandMessage, isSettingsPatch,
  isScoreEntry, isGameCommand 
} from '../../src/server/utils/guards.js';

describe('Type Guards', () => {
  it('isRecord correctly identifies object structures', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("string")).toBe(false);
  });

  it('isString correctly identifies strings', () => {
    expect(isString("hello")).toBe(true);
    expect(isString("")).toBe(true);
    expect(isString(123)).toBe(false);
  });

  it('isNumber correctly identifies numbers', () => {
    expect(isNumber(123)).toBe(true);
    expect(isNumber(0)).toBe(true);
    expect(isNumber(NaN)).toBe(false);
    expect(isNumber("123")).toBe(false);
  });

  it('isBoolean correctly identifies booleans', () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(0)).toBe(false);
  });

  it('parseJsonBody safely parses JSON or returns raw', () => {
    expect(parseJsonBody('{"a": 1}')).toEqual({ a: 1 });
    expect(parseJsonBody('invalid')).toBe(null);
    expect(parseJsonBody({ already: 'parsed' })).toEqual({ already: 'parsed' });
  });

  it('isClientMessage identifies base client messages', () => {
    expect(isClientMessage({ type: 'hello' })).toBe(true);
    expect(isClientMessage({ type: 123 })).toBe(false);
    expect(isClientMessage({})).toBe(false);
  });

  it('isHelloMessage validates hello structure', () => {
    expect(isHelloMessage({ type: 'hello', role: 'player' })).toBe(true);
    expect(isHelloMessage({ type: 'hello' })).toBe(false);
    expect(isHelloMessage({ type: 'other', role: 'player' })).toBe(false);
  });

  it('isCommandMessage validates command messages', () => {
    expect(isCommandMessage({ type: 'command', command: 'start' })).toBe(true);
    expect(isCommandMessage({ type: 'command', command: 'start', payload: { foo: 'bar' } })).toBe(true);
    expect(isCommandMessage({ type: 'command' })).toBe(false);
    expect(isCommandMessage({ type: 'hello', command: 'start' })).toBe(false);
  });

  it('isSettingsPatch validates patch objects', () => {
    expect(isSettingsPatch({ a: 1 })).toBe(true);
    expect(isSettingsPatch("string")).toBe(false);
  });

  it('isScoreEntry validates score structure', () => {
    expect(isScoreEntry({ mode: 'normal', score: 100 })).toBe(true);
    expect(isScoreEntry({ mode: 'normal', score: '100' })).toBe(false);
    expect(isScoreEntry({ score: 100 })).toBe(false);
  });

  it('isGameCommand validates command string', () => {
    expect(isGameCommand('start')).toBe(true);
    expect(isGameCommand(123 as any)).toBe(false);
  });
});
