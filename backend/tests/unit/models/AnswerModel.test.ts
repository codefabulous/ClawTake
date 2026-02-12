import { getTestPool, truncateAllTables, closeTestPool } from '../../helpers/db';
import { createTestUser, createTestAgent, createTestQuestion, createTestAnswer } from '../../helpers/fixtures';
import { AnswerModel } from '../../../src/models/AnswerModel';

let pool: any;
let model: AnswerModel;

beforeAll(() => {
  pool = getTestPool();
  model = new AnswerModel(pool);
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('AnswerModel', () => {
  describe('create()', () => {
    it('inserts an answer and returns the record', async () => {
      const user = await createTestUser(pool);
      const agent = await createTestAgent(pool);
      const question = await createTestQuestion(pool, user.id);

      const answer = await model.create({
        question_id: question.id,
        agent_id: agent.id,
        content: 'Here is the answer to your question.',
      });

      expect(answer).toBeDefined();
      expect(answer.id).toBeDefined();
      expect(answer.question_id).toBe(question.id);
      expect(answer.agent_id).toBe(agent.id);
      expect(answer.content).toBe('Here is the answer to your question.');
      expect(answer.score).toBe(0);
      expect(answer.upvotes).toBe(0);
      expect(answer.downvotes).toBe(0);
      expect(answer.is_best_answer).toBe(false);
      expect(answer.is_deleted).toBe(false);
      expect(answer.created_at).toBeDefined();
    });
  });

  describe('findByQuestionAndAgent()', () => {
    it('returns the answer for the given question and agent', async () => {
      const user = await createTestUser(pool);
      const agent = await createTestAgent(pool);
      const question = await createTestQuestion(pool, user.id);
      const answer = await createTestAnswer(pool, question.id, agent.id, {
        content: 'Specific answer content',
      });

      const found = await model.findByQuestionAndAgent(question.id, agent.id);

      expect(found).not.toBeNull();
      expect(found.id).toBe(answer.id);
      expect(found.content).toBe('Specific answer content');
    });

    it('returns null when no matching answer exists', async () => {
      const found = await model.findByQuestionAndAgent(
        '00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-000000000001'
      );
      expect(found).toBeNull();
    });
  });

  describe('unique constraint', () => {
    it('prevents duplicate answers from the same agent on the same question', async () => {
      const user = await createTestUser(pool);
      const agent = await createTestAgent(pool);
      const question = await createTestQuestion(pool, user.id);

      await model.create({
        question_id: question.id,
        agent_id: agent.id,
        content: 'First answer',
      });

      await expect(
        model.create({
          question_id: question.id,
          agent_id: agent.id,
          content: 'Second answer -- should fail',
        })
      ).rejects.toThrow();
    });
  });

  describe('findByQuestion()', () => {
    it('returns answers with agent info', async () => {
      const user = await createTestUser(pool);
      const agent1 = await createTestAgent(pool, { name: 'agent-one', display_name: 'Agent One' });
      const agent2 = await createTestAgent(pool, { name: 'agent-two', display_name: 'Agent Two' });
      const question = await createTestQuestion(pool, user.id);

      await createTestAnswer(pool, question.id, agent1.id, { content: 'Answer from agent one' });
      await createTestAnswer(pool, question.id, agent2.id, { content: 'Answer from agent two' });

      const answers = await model.findByQuestion(question.id);

      expect(answers).toHaveLength(2);

      // Each answer should have agent info attached
      answers.forEach((a: any) => {
        expect(a.agent_name).toBeDefined();
        expect(a.agent_display_name).toBeDefined();
        expect(a.agent_reputation).toBeDefined();
      });

      const agentNames = answers.map((a: any) => a.agent_name).sort();
      expect(agentNames).toEqual(['agent-one', 'agent-two']);
    });
  });

  describe('updateScore()', () => {
    it('changes the score by the given delta', async () => {
      const user = await createTestUser(pool);
      const agent = await createTestAgent(pool);
      const question = await createTestQuestion(pool, user.id);
      const answer = await createTestAnswer(pool, question.id, agent.id);

      expect(answer.score).toBe(0);

      const up = await model.updateScore(answer.id, 5);
      expect(up.score).toBe(5);

      const down = await model.updateScore(answer.id, -2);
      expect(down.score).toBe(3);
    });
  });

  describe('markBestAnswer()', () => {
    it('sets is_best_answer to true and unmarks others', async () => {
      const user = await createTestUser(pool);
      const agent1 = await createTestAgent(pool, { name: 'best-agent-1' });
      const agent2 = await createTestAgent(pool, { name: 'best-agent-2' });
      const question = await createTestQuestion(pool, user.id);

      const answer1 = await createTestAnswer(pool, question.id, agent1.id, { content: 'Answer 1' });
      const answer2 = await createTestAnswer(pool, question.id, agent2.id, { content: 'Answer 2' });

      // Mark answer1 as best
      await model.markBestAnswer(question.id, answer1.id);
      let found1 = await model.findById(answer1.id);
      let found2 = await model.findById(answer2.id);
      expect(found1.is_best_answer).toBe(true);
      expect(found2.is_best_answer).toBe(false);

      // Now mark answer2 as best -- answer1 should be unmarked
      await model.markBestAnswer(question.id, answer2.id);
      found1 = await model.findById(answer1.id);
      found2 = await model.findById(answer2.id);
      expect(found1.is_best_answer).toBe(false);
      expect(found2.is_best_answer).toBe(true);
    });
  });
});
