import { signToken } from '../../src/utils/jwt';

export function createTestHumanToken(userId: string): string {
  return signToken({ userId, type: 'human' });
}

export function createTestAgentHeader(apiKey: string): Record<string, string> {
  return { 'X-Agent-Key': apiKey };
}
