import { getTestPool, truncateAllTables, closeTestPool } from '../../helpers/db';
import { createTestTag } from '../../helpers/fixtures';
import { TagModel } from '../../../src/models/TagModel';

let pool: any;
let model: TagModel;

beforeAll(() => {
  pool = getTestPool();
  model = new TagModel(pool);
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('TagModel', () => {
  describe('create()', () => {
    it('inserts a tag and returns the record', async () => {
      const tag = await model.create({ name: 'javascript', display_name: 'JavaScript' });

      expect(tag).toBeDefined();
      expect(tag.id).toBeDefined();
      expect(tag.name).toBe('javascript');
      expect(tag.display_name).toBe('JavaScript');
      expect(tag.question_count).toBe(0);
      expect(tag.created_at).toBeDefined();
    });

    it('uses name as display_name when display_name is not provided', async () => {
      const tag = await model.create({ name: 'rust' });

      expect(tag.display_name).toBe('rust');
    });
  });

  describe('findByName()', () => {
    it('returns the tag matching the given name', async () => {
      const created = await createTestTag(pool, 'python', 'Python');

      const found = await model.findByName('python');

      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('python');
      expect(found.display_name).toBe('Python');
    });

    it('returns null when no tag matches', async () => {
      const found = await model.findByName('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findOrCreateByNames()', () => {
    it('creates missing tags and returns existing ones', async () => {
      // Pre-create one tag
      const existing = await createTestTag(pool, 'go', 'Go');

      // findOrCreateByNames with a mix of existing and new
      const tags = await model.findOrCreateByNames(['go', 'typescript', 'docker']);

      expect(tags).toHaveLength(3);

      const tagNames = tags.map((t: any) => t.name).sort();
      expect(tagNames).toEqual(['docker', 'go', 'typescript']);

      // The existing tag should keep its original id
      const goTag = tags.find((t: any) => t.name === 'go');
      expect(goTag.id).toBe(existing.id);

      // New tags should have ids as well
      const tsTag = tags.find((t: any) => t.name === 'typescript');
      expect(tsTag.id).toBeDefined();
    });

    it('returns an empty array when given an empty list', async () => {
      const tags = await model.findOrCreateByNames([]);
      expect(tags).toEqual([]);
    });
  });

  describe('incrementQuestionCount()', () => {
    it('increases the question_count by 1', async () => {
      const tag = await createTestTag(pool, 'react');

      expect(tag.question_count).toBe(0);

      const updated1 = await model.incrementQuestionCount(tag.id);
      expect(updated1.question_count).toBe(1);

      const updated2 = await model.incrementQuestionCount(tag.id);
      expect(updated2.question_count).toBe(2);
    });
  });

  describe('getAll()', () => {
    it('sorts by popular (question_count DESC) and by alpha (name ASC)', async () => {
      // Create tags with different counts
      const tagA = await createTestTag(pool, 'alpha');
      const tagB = await createTestTag(pool, 'beta');
      const tagC = await createTestTag(pool, 'gamma');

      // alpha: 1, beta: 3, gamma: 2
      await model.incrementQuestionCount(tagA.id);
      await model.incrementQuestionCount(tagB.id);
      await model.incrementQuestionCount(tagB.id);
      await model.incrementQuestionCount(tagB.id);
      await model.incrementQuestionCount(tagC.id);
      await model.incrementQuestionCount(tagC.id);

      // Default sort = popular
      const popular = await model.getAll('popular');
      expect(popular.length).toBe(3);
      expect(popular[0].name).toBe('beta');   // 3
      expect(popular[1].name).toBe('gamma');  // 2
      expect(popular[2].name).toBe('alpha');  // 1

      // Alpha sort
      const alpha = await model.getAll('alpha');
      expect(alpha.length).toBe(3);
      expect(alpha[0].name).toBe('alpha');
      expect(alpha[1].name).toBe('beta');
      expect(alpha[2].name).toBe('gamma');
    });
  });
});
