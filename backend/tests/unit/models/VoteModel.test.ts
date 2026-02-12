import { getTestPool, truncateAllTables, closeTestPool } from '../../helpers/db';
import { createTestUser, createTestAgent, createTestQuestion, createTestAnswer } from '../../helpers/fixtures';
import { VoteModel } from '../../../src/models/VoteModel';

let pool: any;
let model: VoteModel;

beforeAll(() => {
  pool = getTestPool();
  model = new VoteModel(pool);
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('VoteModel', () => {
  async function setupVoteScenario() {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool);
    const question = await createTestQuestion(pool, user.id);
    const answer = await createTestAnswer(pool, question.id, agent.id);
    return { user, agent, question, answer };
  }

  describe('upsert()', () => {
    it('creates a new vote', async () => {
      const { user, answer } = await setupVoteScenario();

      const vote = await model.upsert({
        user_id: user.id,
        answer_id: answer.id,
        value: 1,
      });

      expect(vote).toBeDefined();
      expect(vote.user_id).toBe(user.id);
      expect(vote.answer_id).toBe(answer.id);
      expect(vote.value).toBe(1);
      expect(vote.created_at).toBeDefined();
    });

    it('updates an existing vote value', async () => {
      const { user, answer } = await setupVoteScenario();

      // Create initial upvote
      const initial = await model.upsert({
        user_id: user.id,
        answer_id: answer.id,
        value: 1,
      });
      expect(initial.value).toBe(1);

      // Change to downvote
      const updated = await model.upsert({
        user_id: user.id,
        answer_id: answer.id,
        value: -1,
      });
      expect(updated.value).toBe(-1);
      expect(updated.user_id).toBe(user.id);
      expect(updated.answer_id).toBe(answer.id);
    });
  });

  describe('findByUserAndAnswer()', () => {
    it('returns the vote for the given user and answer', async () => {
      const { user, answer } = await setupVoteScenario();

      await model.upsert({ user_id: user.id, answer_id: answer.id, value: 1 });

      const found = await model.findByUserAndAnswer(user.id, answer.id);

      expect(found).not.toBeNull();
      expect(found.user_id).toBe(user.id);
      expect(found.answer_id).toBe(answer.id);
      expect(found.value).toBe(1);
    });

    it('returns null when no vote exists', async () => {
      const { user, answer } = await setupVoteScenario();

      const found = await model.findByUserAndAnswer(user.id, answer.id);
      expect(found).toBeNull();
    });
  });

  describe('delete()', () => {
    it('removes the vote', async () => {
      const { user, answer } = await setupVoteScenario();

      await model.upsert({ user_id: user.id, answer_id: answer.id, value: 1 });

      // Confirm vote exists
      const before = await model.findByUserAndAnswer(user.id, answer.id);
      expect(before).not.toBeNull();

      // Delete and confirm removal
      await model.delete(user.id, answer.id);

      const after = await model.findByUserAndAnswer(user.id, answer.id);
      expect(after).toBeNull();
    });
  });

  describe('getVotesByUser()', () => {
    it('returns a map of answer_id -> vote value for the given user', async () => {
      const user = await createTestUser(pool);
      const agent1 = await createTestAgent(pool, { name: 'vote-agent-1' });
      const agent2 = await createTestAgent(pool, { name: 'vote-agent-2' });
      const question = await createTestQuestion(pool, user.id);
      const answer1 = await createTestAnswer(pool, question.id, agent1.id);
      const answer2 = await createTestAnswer(pool, question.id, agent2.id);

      await model.upsert({ user_id: user.id, answer_id: answer1.id, value: 1 });
      await model.upsert({ user_id: user.id, answer_id: answer2.id, value: -1 });

      const voteMap = await model.getVotesByUser(user.id, [answer1.id, answer2.id]);

      expect(voteMap).toBeInstanceOf(Map);
      expect(voteMap.size).toBe(2);
      expect(voteMap.get(answer1.id)).toBe(1);
      expect(voteMap.get(answer2.id)).toBe(-1);
    });

    it('returns an empty map when given an empty answerIds array', async () => {
      const user = await createTestUser(pool);
      const voteMap = await model.getVotesByUser(user.id, []);
      expect(voteMap).toBeInstanceOf(Map);
      expect(voteMap.size).toBe(0);
    });
  });
});
