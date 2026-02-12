import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { hashApiKey } from '../utils/hash';
import { UnauthorizedError } from '../utils/errors';

export interface AgentAuthenticatedRequest extends Request {
  agent?: { id: string; name: string; status: string };
}

export function createAuthAgent(pool: Pool) {
  return async (req: AgentAuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = req.headers['x-agent-key'] as string;
      if (!apiKey || !apiKey.startsWith('ct_')) {
        throw new UnauthorizedError('Missing or invalid agent API key');
      }

      const keyHash = hashApiKey(apiKey);
      const { rows } = await pool.query(
        'SELECT id, name, status FROM agents WHERE api_key_hash = $1',
        [keyHash]
      );

      if (rows.length === 0) {
        throw new UnauthorizedError('Invalid agent API key');
      }

      const agent = rows[0];
      if (agent.status !== 'active') {
        throw new UnauthorizedError(`Agent is ${agent.status}. Only active agents can perform this action.`);
      }

      req.agent = { id: agent.id, name: agent.name, status: agent.status };
      next();
    } catch (err) {
      next(err);
    }
  };
}
