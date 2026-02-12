import { getTestPool, truncateAllTables, closeTestPool } from '../../helpers/db';
import { createTestUser, createTestAgent, createTestQuestion, createTestAnswer } from '../../helpers/fixtures';
import { CommentModel } from '../../../src/models/CommentModel';

let pool: any;
let model: CommentModel;

beforeAll(() => {
  pool = getTestPool();
  model = new CommentModel(pool);
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('CommentModel', () => {
  async function setupCommentScenario() {
    const user = await createTestUser(pool, { username: 'commenter', display_name: 'Commenter' });
    const agent = await createTestAgent(pool);
    const question = await createTestQuestion(pool, user.id);
    const answer = await createTestAnswer(pool, question.id, agent.id);
    return { user, agent, question, answer };
  }

  describe('create()', () => {
    it('inserts a comment with depth 0 when no parent_id is given', async () => {
      const { user, answer } = await setupCommentScenario();

      const comment = await model.create({
        answer_id: answer.id,
        author_type: 'user',
        author_id: user.id,
        content: 'Great answer!',
      });

      expect(comment).toBeDefined();
      expect(comment.id).toBeDefined();
      expect(comment.answer_id).toBe(answer.id);
      expect(comment.author_type).toBe('user');
      expect(comment.author_id).toBe(user.id);
      expect(comment.content).toBe('Great answer!');
      expect(comment.depth).toBe(0);
      expect(comment.parent_id).toBeNull();
      expect(comment.is_deleted).toBe(false);
      expect(comment.created_at).toBeDefined();
    });

    it('sets correct depth when parent_id is provided', async () => {
      const { user, agent, answer } = await setupCommentScenario();

      // Create root comment (depth 0)
      const root = await model.create({
        answer_id: answer.id,
        author_type: 'user',
        author_id: user.id,
        content: 'Root comment',
      });
      expect(root.depth).toBe(0);

      // Create reply to root (depth 1)
      const reply = await model.create({
        answer_id: answer.id,
        author_type: 'agent',
        author_id: agent.id,
        content: 'Reply to root',
        parent_id: root.id,
      });
      expect(reply.depth).toBe(1);
      expect(reply.parent_id).toBe(root.id);

      // Create nested reply (depth 2)
      const nestedReply = await model.create({
        answer_id: answer.id,
        author_type: 'user',
        author_id: user.id,
        content: 'Nested reply',
        parent_id: reply.id,
      });
      expect(nestedReply.depth).toBe(2);
      expect(nestedReply.parent_id).toBe(reply.id);
    });
  });

  describe('findByAnswer()', () => {
    it('returns comments with author info', async () => {
      const { user, agent, answer } = await setupCommentScenario();

      // Create a user comment and an agent comment
      await model.create({
        answer_id: answer.id,
        author_type: 'user',
        author_id: user.id,
        content: 'User comment',
      });

      await model.create({
        answer_id: answer.id,
        author_type: 'agent',
        author_id: agent.id,
        content: 'Agent comment',
      });

      const comments = await model.findByAnswer(answer.id);

      expect(comments).toHaveLength(2);

      // User comment should have user author info
      const userComment = comments.find((c: any) => c.author_type === 'user');
      expect(userComment).toBeDefined();
      expect(userComment.author).toBeDefined();
      expect(userComment.author.username).toBe('commenter');
      expect(userComment.author.display_name).toBe('Commenter');

      // Agent comment should have agent author info
      const agentComment = comments.find((c: any) => c.author_type === 'agent');
      expect(agentComment).toBeDefined();
      expect(agentComment.author).toBeDefined();
      expect(agentComment.author.name).toBeDefined();
      expect(agentComment.author.display_name).toBeDefined();
    });

    it('excludes deleted comments by default', async () => {
      const { user, answer } = await setupCommentScenario();

      const comment = await model.create({
        answer_id: answer.id,
        author_type: 'user',
        author_id: user.id,
        content: 'Soon to be deleted',
      });

      await model.delete(comment.id);

      const withoutDeleted = await model.findByAnswer(answer.id);
      expect(withoutDeleted).toHaveLength(0);

      const withDeleted = await model.findByAnswer(answer.id, { includeDeleted: true });
      expect(withDeleted).toHaveLength(1);
    });
  });

  describe('countByAnswer()', () => {
    it('returns the count of non-deleted comments for an answer', async () => {
      const { user, answer } = await setupCommentScenario();

      await model.create({
        answer_id: answer.id,
        author_type: 'user',
        author_id: user.id,
        content: 'Comment 1',
      });

      const toDelete = await model.create({
        answer_id: answer.id,
        author_type: 'user',
        author_id: user.id,
        content: 'Comment 2 (will be deleted)',
      });

      await model.create({
        answer_id: answer.id,
        author_type: 'user',
        author_id: user.id,
        content: 'Comment 3',
      });

      // Delete one comment
      await model.delete(toDelete.id);

      const count = await model.countByAnswer(answer.id);
      expect(count).toBe(2);
    });
  });

  describe('delete()', () => {
    it('soft deletes by setting is_deleted to true', async () => {
      const { user, answer } = await setupCommentScenario();

      const comment = await model.create({
        answer_id: answer.id,
        author_type: 'user',
        author_id: user.id,
        content: 'This will be soft-deleted',
      });

      expect(comment.is_deleted).toBe(false);

      await model.delete(comment.id);

      // The row should still exist in the database
      const found = await model.findById(comment.id);
      expect(found).not.toBeNull();
      expect(found.is_deleted).toBe(true);
      expect(found.content).toBe('This will be soft-deleted');
    });
  });
});
