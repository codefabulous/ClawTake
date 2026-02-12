import { getTestPool, truncateAllTables, closeTestPool } from '../../helpers/db';
import { createTestUser } from '../../helpers/fixtures';
import { UserModel } from '../../../src/models/UserModel';

let pool: any;
let model: UserModel;

beforeAll(() => {
  pool = getTestPool();
  model = new UserModel(pool);
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('UserModel', () => {
  describe('create()', () => {
    it('inserts a user and returns the record with an id', async () => {
      const user = await model.create({
        email: 'alice@example.com',
        username: 'alice',
        display_name: 'Alice',
        password_hash: 'hash_abc123',
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('alice@example.com');
      expect(user.username).toBe('alice');
      expect(user.display_name).toBe('Alice');
      expect(user.created_at).toBeDefined();
      expect(user.updated_at).toBeDefined();
    });
  });

  describe('findById()', () => {
    it('returns the user matching the given id', async () => {
      const created = await createTestUser(pool, {
        email: 'bob@example.com',
        username: 'bob',
      });

      const found = await model.findById(created.id);

      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
      expect(found.username).toBe('bob');
    });

    it('returns null when no user exists with that id', async () => {
      const found = await model.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByEmail()', () => {
    it('is case-insensitive', async () => {
      await createTestUser(pool, {
        email: 'CasE@Example.COM',
        username: 'caseuser',
      });

      const found = await model.findByEmail('case@example.com');

      expect(found).not.toBeNull();
      expect(found.username).toBe('caseuser');

      const foundUpper = await model.findByEmail('CASE@EXAMPLE.COM');
      expect(foundUpper).not.toBeNull();
      expect(foundUpper.id).toBe(found.id);
    });
  });

  describe('findByUsername()', () => {
    it('returns the user matching the given username', async () => {
      const created = await createTestUser(pool, {
        email: 'carol@example.com',
        username: 'carol',
      });

      const found = await model.findByUsername('carol');

      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
      expect(found.email).toBe('carol@example.com');
    });
  });

  describe('duplicate constraints', () => {
    it('throws an error when inserting a duplicate email', async () => {
      await model.create({
        email: 'dupe@example.com',
        username: 'user1',
        password_hash: 'hash1',
      });

      await expect(
        model.create({
          email: 'dupe@example.com',
          username: 'user2',
          password_hash: 'hash2',
        })
      ).rejects.toThrow();
    });

    it('throws an error when inserting a duplicate username', async () => {
      await model.create({
        email: 'unique1@example.com',
        username: 'samename',
        password_hash: 'hash1',
      });

      await expect(
        model.create({
          email: 'unique2@example.com',
          username: 'samename',
          password_hash: 'hash2',
        })
      ).rejects.toThrow();
    });
  });

  describe('update()', () => {
    it('changes the specified fields and returns the updated user', async () => {
      const created = await createTestUser(pool, {
        email: 'update@example.com',
        username: 'updateme',
        display_name: 'Before',
      });

      const updated = await model.update(created.id, {
        display_name: 'After',
      });

      expect(updated.display_name).toBe('After');
      expect(updated.username).toBe('updateme');
      expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updated_at).getTime()
      );
    });
  });
});
