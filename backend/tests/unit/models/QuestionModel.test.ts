import { getTestPool, truncateAllTables, closeTestPool } from '../../helpers/db';
import { createTestUser, createTestQuestion, createTestTag, createTestAnswer, createTestAgent } from '../../helpers/fixtures';
import { QuestionModel } from '../../../src/models/QuestionModel';

let pool: any;
let model: QuestionModel;

beforeAll(() => {
  pool = getTestPool();
  model = new QuestionModel(pool);
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('QuestionModel', () => {
  describe('create()', () => {
    it('inserts a question and returns the record', async () => {
      const user = await createTestUser(pool);

      const question = await model.create({
        author_id: user.id,
        title: 'How do I test models?',
        body: 'I want to write integration tests for my database models.',
      });

      expect(question).toBeDefined();
      expect(question.id).toBeDefined();
      expect(question.author_id).toBe(user.id);
      expect(question.title).toBe('How do I test models?');
      expect(question.body).toBe('I want to write integration tests for my database models.');
      expect(question.view_count).toBe(0);
      expect(question.answer_count).toBe(0);
      expect(question.is_deleted).toBe(false);
      expect(question.created_at).toBeDefined();
    });
  });

  describe('findById()', () => {
    it('returns the question with tags and author info', async () => {
      const user = await createTestUser(pool, { username: 'questioner', display_name: 'Questioner' });
      const question = await createTestQuestion(pool, user.id, {
        title: 'Tagged Question',
      });
      const tag = await createTestTag(pool, 'typescript', 'TypeScript');
      await model.addTags(question.id, [tag.id]);

      const found = await model.findById(question.id);

      expect(found).not.toBeNull();
      expect(found.id).toBe(question.id);
      expect(found.title).toBe('Tagged Question');
      expect(found.author_username).toBe('questioner');
      expect(found.author_display_name).toBe('Questioner');
      expect(found.tags).toHaveLength(1);
      expect(found.tags[0].name).toBe('typescript');
      expect(found.tags[0].display_name).toBe('TypeScript');
    });

    it('returns null for a non-existent question', async () => {
      const found = await model.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('list()', () => {
    it('sort=new orders by created_at DESC', async () => {
      const user = await createTestUser(pool);

      const q1 = await createTestQuestion(pool, user.id, { title: 'First' });
      // Small delay to ensure different created_at timestamps
      await new Promise(resolve => setTimeout(resolve, 50));
      const q2 = await createTestQuestion(pool, user.id, { title: 'Second' });
      await new Promise(resolve => setTimeout(resolve, 50));
      const q3 = await createTestQuestion(pool, user.id, { title: 'Third' });

      const results = await model.list({ sort: 'new', limit: 10 });

      expect(results.length).toBe(3);
      expect(results[0].title).toBe('Third');
      expect(results[1].title).toBe('Second');
      expect(results[2].title).toBe('First');
    });

    it('sort=unanswered filters to questions with answer_count=0', async () => {
      const user = await createTestUser(pool);
      const agent = await createTestAgent(pool);

      const qAnswered = await createTestQuestion(pool, user.id, { title: 'Answered' });
      const qUnanswered = await createTestQuestion(pool, user.id, { title: 'Unanswered' });

      // Create an answer for qAnswered and increment its count
      await createTestAnswer(pool, qAnswered.id, agent.id);
      await model.incrementAnswerCount(qAnswered.id);

      const results = await model.list({ sort: 'unanswered', limit: 10 });

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Unanswered');
    });

    it('filters by tag', async () => {
      const user = await createTestUser(pool);

      const q1 = await createTestQuestion(pool, user.id, { title: 'JS Question' });
      const q2 = await createTestQuestion(pool, user.id, { title: 'Python Question' });
      const q3 = await createTestQuestion(pool, user.id, { title: 'Both Tags' });

      const tagJs = await createTestTag(pool, 'javascript');
      const tagPy = await createTestTag(pool, 'python');

      await model.addTags(q1.id, [tagJs.id]);
      await model.addTags(q2.id, [tagPy.id]);
      await model.addTags(q3.id, [tagJs.id, tagPy.id]);

      const jsResults = await model.list({ tag: 'javascript', limit: 10 });
      expect(jsResults.length).toBe(2);
      const jsTitles = jsResults.map((r: any) => r.title).sort();
      expect(jsTitles).toEqual(['Both Tags', 'JS Question']);

      const pyResults = await model.list({ tag: 'python', limit: 10 });
      expect(pyResults.length).toBe(2);
      const pyTitles = pyResults.map((r: any) => r.title).sort();
      expect(pyTitles).toEqual(['Both Tags', 'Python Question']);
    });
  });

  describe('incrementViewCount()', () => {
    it('increases view_count by 1', async () => {
      const user = await createTestUser(pool);
      const question = await createTestQuestion(pool, user.id);

      expect(question.view_count).toBe(0);

      const updated1 = await model.incrementViewCount(question.id);
      expect(updated1.view_count).toBe(1);

      const updated2 = await model.incrementViewCount(question.id);
      expect(updated2.view_count).toBe(2);
    });
  });

  describe('incrementAnswerCount()', () => {
    it('increases answer_count by the given delta', async () => {
      const user = await createTestUser(pool);
      const question = await createTestQuestion(pool, user.id);

      expect(question.answer_count).toBe(0);

      const updated1 = await model.incrementAnswerCount(question.id);
      expect(updated1.answer_count).toBe(1);

      const updated2 = await model.incrementAnswerCount(question.id, 3);
      expect(updated2.answer_count).toBe(4);
    });
  });

  describe('addTags()', () => {
    it('links tags to a question and they appear in findById', async () => {
      const user = await createTestUser(pool);
      const question = await createTestQuestion(pool, user.id);
      const tag1 = await createTestTag(pool, 'node');
      const tag2 = await createTestTag(pool, 'express');

      await model.addTags(question.id, [tag1.id, tag2.id]);

      const found = await model.findById(question.id);
      expect(found.tags).toHaveLength(2);

      const tagNames = found.tags.map((t: any) => t.name).sort();
      expect(tagNames).toEqual(['express', 'node']);
    });

    it('does nothing when given an empty tagIds array', async () => {
      const user = await createTestUser(pool);
      const question = await createTestQuestion(pool, user.id);

      // Should not throw
      await model.addTags(question.id, []);

      const found = await model.findById(question.id);
      expect(found.tags).toEqual([]);
    });
  });
});
