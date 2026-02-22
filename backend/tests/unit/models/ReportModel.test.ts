import { getTestPool, truncateAllTables, closeTestPool } from '../../helpers/db';
import { createTestUser, createTestQuestion } from '../../helpers/fixtures';
import { ReportModel } from '../../../src/models/ReportModel';

let pool: any;
let model: ReportModel;

beforeAll(() => {
  pool = getTestPool();
  model = new ReportModel(pool);
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('ReportModel', () => {
  async function setupReportScenario() {
    const reporter = await createTestUser(pool);
    const author = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);
    return { reporter, author, question };
  }

  describe('create()', () => {
    it('inserts a report and returns it with all fields', async () => {
      const { reporter, question } = await setupReportScenario();

      const report = await model.create({
        reporter_id: reporter.id,
        target_type: 'question',
        target_id: question.id,
        reason: 'spam',
        description: 'This looks like spam content',
      });

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.reporter_id).toBe(reporter.id);
      expect(report.target_type).toBe('question');
      expect(report.target_id).toBe(question.id);
      expect(report.reason).toBe('spam');
      expect(report.description).toBe('This looks like spam content');
      expect(report.status).toBe('pending');
      expect(report.reviewed_by).toBeNull();
      expect(report.reviewed_at).toBeNull();
      expect(report.created_at).toBeDefined();
    });

    it('throws on duplicate (same reporter + target_type + target_id)', async () => {
      const { reporter, question } = await setupReportScenario();

      await model.create({
        reporter_id: reporter.id,
        target_type: 'question',
        target_id: question.id,
        reason: 'spam',
      });

      try {
        await model.create({
          reporter_id: reporter.id,
          target_type: 'question',
          target_id: question.id,
          reason: 'offensive',
        });
        fail('Expected duplicate insert to throw');
      } catch (error: any) {
        expect(error.code).toBe('23505');
      }
    });
  });

  describe('findById()', () => {
    it('returns a report by id or null if not found', async () => {
      const { reporter, question } = await setupReportScenario();

      const created = await model.create({
        reporter_id: reporter.id,
        target_type: 'question',
        target_id: question.id,
        reason: 'spam',
      });

      const found = await model.findById(created.id);
      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.reporter_id).toBe(reporter.id);

      const notFound = await model.findById('00000000-0000-0000-0000-000000000000');
      expect(notFound).toBeNull();
    });
  });

  describe('countByTarget()', () => {
    it('counts reports for a specific target', async () => {
      const { question } = await setupReportScenario();

      const reporter1 = await createTestUser(pool);
      const reporter2 = await createTestUser(pool);
      const reporter3 = await createTestUser(pool);

      await model.create({ reporter_id: reporter1.id, target_type: 'question', target_id: question.id, reason: 'spam' });
      await model.create({ reporter_id: reporter2.id, target_type: 'question', target_id: question.id, reason: 'offensive' });
      await model.create({ reporter_id: reporter3.id, target_type: 'question', target_id: question.id, reason: 'misleading' });

      const count = await model.countByTarget('question', question.id);
      expect(count).toBe(3);

      // Different target should return 0
      const otherCount = await model.countByTarget('question', '00000000-0000-0000-0000-000000000000');
      expect(otherCount).toBe(0);
    });
  });

  describe('findPending()', () => {
    it('returns pending reports ordered by created_at DESC with reporter info', async () => {
      const author = await createTestUser(pool);
      const question = await createTestQuestion(pool, author.id);

      const reporter1 = await createTestUser(pool, { username: 'reporter_one', display_name: 'Reporter One' });
      const reporter2 = await createTestUser(pool, { username: 'reporter_two', display_name: 'Reporter Two' });

      await model.create({ reporter_id: reporter1.id, target_type: 'question', target_id: question.id, reason: 'spam' });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 50));

      await model.create({ reporter_id: reporter2.id, target_type: 'question', target_id: question.id, reason: 'offensive' });

      const pending = await model.findPending({ limit: 10, offset: 0 });

      expect(pending).toHaveLength(2);
      // Newest first
      expect(pending[0].reporter_id).toBe(reporter2.id);
      expect(pending[0].reporter_username).toBe('reporter_two');
      expect(pending[0].reporter_display_name).toBe('Reporter Two');
      expect(pending[1].reporter_id).toBe(reporter1.id);
      expect(pending[1].reporter_username).toBe('reporter_one');
    });
  });

  describe('updateStatus()', () => {
    it('updates status, reviewed_by, and reviewed_at', async () => {
      const { reporter, question } = await setupReportScenario();
      const admin = await createTestUser(pool);

      const report = await model.create({
        reporter_id: reporter.id,
        target_type: 'question',
        target_id: question.id,
        reason: 'spam',
      });

      const updated = await model.updateStatus(report.id, {
        status: 'reviewed',
        reviewed_by: admin.id,
      });

      expect(updated.status).toBe('reviewed');
      expect(updated.reviewed_by).toBe(admin.id);
      expect(updated.reviewed_at).toBeDefined();
      expect(updated.reviewed_at).not.toBeNull();
    });
  });

  describe('dismissAllForTarget()', () => {
    it('bulk updates all pending reports for a target to dismissed', async () => {
      const author = await createTestUser(pool);
      const question = await createTestQuestion(pool, author.id);
      const admin = await createTestUser(pool);

      const reporter1 = await createTestUser(pool);
      const reporter2 = await createTestUser(pool);
      const reporter3 = await createTestUser(pool);

      await model.create({ reporter_id: reporter1.id, target_type: 'question', target_id: question.id, reason: 'spam' });
      await model.create({ reporter_id: reporter2.id, target_type: 'question', target_id: question.id, reason: 'offensive' });
      await model.create({ reporter_id: reporter3.id, target_type: 'question', target_id: question.id, reason: 'misleading' });

      await model.dismissAllForTarget('question', question.id, admin.id);

      const pending = await model.findPending({ limit: 20, offset: 0 });
      expect(pending).toHaveLength(0);

      // Verify all three were set to dismissed
      const { rows } = await pool.query(
        "SELECT * FROM reports WHERE target_type = 'question' AND target_id = $1",
        [question.id]
      );
      expect(rows).toHaveLength(3);
      rows.forEach((row: any) => {
        expect(row.status).toBe('dismissed');
        expect(row.reviewed_by).toBe(admin.id);
        expect(row.reviewed_at).not.toBeNull();
      });
    });
  });

  describe('reviewAllForTarget()', () => {
    it('bulk updates all pending reports for a target to reviewed', async () => {
      const author = await createTestUser(pool);
      const question = await createTestQuestion(pool, author.id);
      const admin = await createTestUser(pool);

      const reporter1 = await createTestUser(pool);
      const reporter2 = await createTestUser(pool);

      await model.create({ reporter_id: reporter1.id, target_type: 'question', target_id: question.id, reason: 'spam' });
      await model.create({ reporter_id: reporter2.id, target_type: 'question', target_id: question.id, reason: 'offensive' });

      await model.reviewAllForTarget('question', question.id, admin.id);

      const pending = await model.findPending({ limit: 20, offset: 0 });
      expect(pending).toHaveLength(0);

      // Verify all were set to reviewed
      const { rows } = await pool.query(
        "SELECT * FROM reports WHERE target_type = 'question' AND target_id = $1",
        [question.id]
      );
      expect(rows).toHaveLength(2);
      rows.forEach((row: any) => {
        expect(row.status).toBe('reviewed');
        expect(row.reviewed_by).toBe(admin.id);
        expect(row.reviewed_at).not.toBeNull();
      });
    });
  });
});
