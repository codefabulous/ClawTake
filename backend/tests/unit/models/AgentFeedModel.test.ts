import { getTestPool, truncateAllTables, closeTestPool } from '../../helpers/db';
import { createTestUser, createTestAgent, createTestQuestion, createTestAnswer, createTestTag } from '../../helpers/fixtures';
import { AgentFeedModel } from '../../../src/models/AgentFeedModel';

let pool: any;
let model: AgentFeedModel;

beforeAll(() => {
  pool = getTestPool();
  model = new AgentFeedModel(pool);
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('AgentFeedModel', () => {
  async function setupFeedScenario(agentOverrides?: Record<string, any>) {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool, agentOverrides);
    return { user, agent };
  }

  async function createQuestionWithTag(authorId: string, tagName: string) {
    const tag = await createTestTag(pool, tagName);
    const question = await createTestQuestion(pool, authorId);
    await pool.query(
      'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
      [question.id, tag.id]
    );
    return { question, tag };
  }

  describe('getUnseenQuestions()', () => {
    it('returns questions matching agent expertise tags', async () => {
      const { user, agent } = await setupFeedScenario({ expertise_tags: ['python'] });

      const { question: pythonQ } = await createQuestionWithTag(user.id, 'python');
      await createQuestionWithTag(user.id, 'javascript');

      const results = await model.getUnseenQuestions(agent.id, ['python'], 10);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(pythonQ.id);
    });

    it('excludes questions agent has already seen', async () => {
      const { user, agent } = await setupFeedScenario({ expertise_tags: ['python'] });

      const { question: q1 } = await createQuestionWithTag(user.id, 'python');
      const { question: q2 } = await createQuestionWithTag(user.id, 'python');

      // Mark q1 as seen
      await pool.query(
        'INSERT INTO agent_question_seen (agent_id, question_id) VALUES ($1, $2)',
        [agent.id, q1.id]
      );

      const results = await model.getUnseenQuestions(agent.id, ['python'], 10);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(q2.id);
    });

    it('excludes questions agent has already answered', async () => {
      const { user, agent } = await setupFeedScenario({ expertise_tags: ['python'] });

      const { question: q1 } = await createQuestionWithTag(user.id, 'python');
      const { question: q2 } = await createQuestionWithTag(user.id, 'python');

      // Agent answers q1
      await createTestAnswer(pool, q1.id, agent.id);

      const results = await model.getUnseenQuestions(agent.id, ['python'], 10);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(q2.id);
    });

    it('returns all questions when agent has empty expertise_tags', async () => {
      const { user, agent } = await setupFeedScenario({ expertise_tags: [] });

      await createQuestionWithTag(user.id, 'python');
      await createQuestionWithTag(user.id, 'javascript');
      await createQuestionWithTag(user.id, 'rust');

      const results = await model.getUnseenQuestions(agent.id, [], 10);

      expect(results).toHaveLength(3);
    });

    it('excludes deleted questions', async () => {
      const { user, agent } = await setupFeedScenario({ expertise_tags: ['python'] });

      const { question } = await createQuestionWithTag(user.id, 'python');

      // Soft-delete the question
      await pool.query('UPDATE questions SET is_deleted = true WHERE id = $1', [question.id]);

      const results = await model.getUnseenQuestions(agent.id, ['python'], 10);

      expect(results).toHaveLength(0);
    });

    it('excludes closed questions', async () => {
      const { user, agent } = await setupFeedScenario({ expertise_tags: ['python'] });

      const { question } = await createQuestionWithTag(user.id, 'python');

      // Close the question
      await pool.query('UPDATE questions SET is_closed = true WHERE id = $1', [question.id]);

      const results = await model.getUnseenQuestions(agent.id, ['python'], 10);

      expect(results).toHaveLength(0);
    });

    it('respects limit parameter', async () => {
      const { user, agent } = await setupFeedScenario({ expertise_tags: ['python'] });

      // Create 5 questions with the python tag
      for (let i = 0; i < 5; i++) {
        const tag = await createTestTag(pool, `python-${i}`);
        const question = await createTestQuestion(pool, user.id);
        // We need to use the same tag name 'python' for matching, so let's use a shared tag
        // Instead, create questions and tag them with one shared tag
      }

      // Clean approach: create one shared tag and multiple questions
      await truncateAllTables();
      const user2 = await createTestUser(pool);
      const agent2 = await createTestAgent(pool, { expertise_tags: ['python'] });
      const pyTag = await createTestTag(pool, 'python');

      for (let i = 0; i < 5; i++) {
        const q = await createTestQuestion(pool, user2.id);
        await pool.query(
          'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
          [q.id, pyTag.id]
        );
      }

      const results = await model.getUnseenQuestions(agent2.id, ['python'], 3);

      expect(results).toHaveLength(3);
    });
  });

  describe('markSeen()', () => {
    it('inserts records into agent_question_seen', async () => {
      const { user, agent } = await setupFeedScenario({ expertise_tags: ['python'] });

      const { question: q1 } = await createQuestionWithTag(user.id, 'python');
      const { question: q2 } = await createQuestionWithTag(user.id, 'python');

      await model.markSeen(agent.id, [q1.id, q2.id]);

      const { rows } = await pool.query(
        'SELECT * FROM agent_question_seen WHERE agent_id = $1 ORDER BY question_id',
        [agent.id]
      );

      expect(rows).toHaveLength(2);
      const questionIds = rows.map((r: any) => r.question_id).sort();
      expect(questionIds).toContain(q1.id);
      expect(questionIds).toContain(q2.id);
    });

    it('handles empty array gracefully', async () => {
      const { agent } = await setupFeedScenario({ expertise_tags: ['python'] });

      // Should not throw
      await expect(model.markSeen(agent.id, [])).resolves.toBeUndefined();

      const { rows } = await pool.query(
        'SELECT * FROM agent_question_seen WHERE agent_id = $1',
        [agent.id]
      );
      expect(rows).toHaveLength(0);
    });
  });
});
