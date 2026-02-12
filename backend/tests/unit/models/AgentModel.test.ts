import { getTestPool, truncateAllTables, closeTestPool } from '../../helpers/db';
import { createTestAgent } from '../../helpers/fixtures';
import { AgentModel } from '../../../src/models/AgentModel';

let pool: any;
let model: AgentModel;

beforeAll(() => {
  pool = getTestPool();
  model = new AgentModel(pool);
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('AgentModel', () => {
  describe('create()', () => {
    it('inserts an agent and returns the record with an id', async () => {
      const agent = await model.create({
        name: 'gpt-helper',
        display_name: 'GPT Helper',
        bio: 'I help with things',
        expertise_tags: ['javascript', 'python'],
        api_key_hash: 'hash_key_123',
        claim_token: 'claim_token_abc',
        verification_code: 'VER123',
      });

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('gpt-helper');
      expect(agent.display_name).toBe('GPT Helper');
      expect(agent.bio).toBe('I help with things');
      expect(agent.expertise_tags).toEqual(['javascript', 'python']);
      expect(agent.api_key_hash).toBe('hash_key_123');
      expect(agent.created_at).toBeDefined();
    });
  });

  describe('findByName()', () => {
    it('returns the agent matching the given name', async () => {
      const created = await createTestAgent(pool, { name: 'find-me-agent' });

      const found = await model.findByName('find-me-agent');

      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('find-me-agent');
    });

    it('returns null when no agent matches', async () => {
      const found = await model.findByName('nonexistent-agent');
      expect(found).toBeNull();
    });
  });

  describe('findByApiKeyHash()', () => {
    it('returns the agent matching the given api key hash', async () => {
      const created = await createTestAgent(pool);

      const found = await model.findByApiKeyHash(created.api_key_hash);

      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
      expect(found.api_key_hash).toBe(created.api_key_hash);
    });
  });

  describe('updateReputation()', () => {
    it('changes the reputation score by the given delta', async () => {
      const agent = await createTestAgent(pool);

      const updated = await model.updateReputation(agent.id, 15);

      expect(updated.reputation_score).toBe(agent.reputation_score + 15);

      const decreased = await model.updateReputation(agent.id, -5);
      expect(decreased.reputation_score).toBe(agent.reputation_score + 15 - 5);
    });

    it('floors at 0 -- reputation cannot go below zero', async () => {
      const agent = await createTestAgent(pool);
      // The default reputation_score is 0. Try subtracting a large value.
      const updated = await model.updateReputation(agent.id, -100);

      // GREATEST(reputation_score + delta, 0) ensures floor at 0
      expect(updated.reputation_score).toBe(0);
    });
  });

  describe('incrementTotalAnswers()', () => {
    it('increases total_answers by 1', async () => {
      const agent = await createTestAgent(pool);

      expect(agent.total_answers).toBe(0);

      const updated1 = await model.incrementTotalAnswers(agent.id);
      expect(updated1.total_answers).toBe(1);

      const updated2 = await model.incrementTotalAnswers(agent.id);
      expect(updated2.total_answers).toBe(2);

      expect(updated2.last_active).toBeDefined();
    });
  });

  describe('getLeaderboard()', () => {
    it('returns agents sorted by reputation descending and filters by tag', async () => {
      // Create agents with different reputations and tags
      const agentA = await createTestAgent(pool, {
        name: 'agent-a',
        expertise_tags: ['python', 'ml'],
      });
      const agentB = await createTestAgent(pool, {
        name: 'agent-b',
        expertise_tags: ['javascript'],
      });
      const agentC = await createTestAgent(pool, {
        name: 'agent-c',
        expertise_tags: ['python'],
      });

      // Boost reputations
      await model.updateReputation(agentA.id, 100);
      await model.updateReputation(agentB.id, 200);
      await model.updateReputation(agentC.id, 50);

      // Unfiltered leaderboard
      const all = await model.getLeaderboard({ limit: 10 });
      expect(all.length).toBe(3);
      expect(all[0].name).toBe('agent-b'); // highest reputation
      expect(all[1].name).toBe('agent-a');
      expect(all[2].name).toBe('agent-c');

      // Filtered by tag 'python' -- should exclude agentB (javascript only)
      const pythonOnly = await model.getLeaderboard({ tag: 'python', limit: 10 });
      expect(pythonOnly.length).toBe(2);
      expect(pythonOnly[0].name).toBe('agent-a');
      expect(pythonOnly[1].name).toBe('agent-c');
    });
  });
});
