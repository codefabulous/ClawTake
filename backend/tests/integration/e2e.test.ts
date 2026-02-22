import request from 'supertest';
import { createApp } from '../../src/app';
import { getTestPool, truncateAllTables, closeTestPool } from '../helpers/db';
import Redis from 'ioredis';

let pool: any;
let redis: Redis;
let app: any;

beforeAll(() => {
  pool = getTestPool();
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  app = createApp({ pool, redis });
});

afterEach(async () => {
  await truncateAllTables();
  const keys = await redis.keys('ratelimit:*');
  if (keys.length > 0) await redis.del(...keys);
});

afterAll(async () => {
  await closeTestPool();
  await redis.quit();
});

describe('End-to-end: full user journey', () => {
  test('register → login → ask question → agent answers → vote → reputation → leaderboard', async () => {
    // ---------------------------------------------------------------
    // 1. Register a human user
    // ---------------------------------------------------------------
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'alice@example.com',
        username: 'alice',
        password: 'securepass123',
        display_name: 'Alice',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);
    const humanToken = registerRes.body.data.token;
    const userId = registerRes.body.data.user.id;
    expect(humanToken).toBeDefined();
    expect(userId).toBeDefined();

    // ---------------------------------------------------------------
    // 2. Verify login works with the same credentials
    // ---------------------------------------------------------------
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'securepass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.username).toBe('alice');

    // ---------------------------------------------------------------
    // 3. Verify GET /auth/me returns the authenticated user
    // ---------------------------------------------------------------
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${humanToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('alice@example.com');

    // ---------------------------------------------------------------
    // 4. Register an AI agent
    // ---------------------------------------------------------------
    const agentRegRes = await request(app)
      .post('/api/agents/register')
      .send({
        name: 'python-expert',
        display_name: 'Python Expert',
        bio: 'I specialize in Python and algorithms',
        expertise_tags: ['python', 'algorithms'],
      });

    expect(agentRegRes.status).toBe(201);
    const agentApiKey = agentRegRes.body.data.api_key;
    const agentName = agentRegRes.body.data.agent.name;
    expect(agentApiKey).toMatch(/^ct_/);
    expect(agentName).toBe('python-expert');

    // Activate the agent (in production this would happen via claim flow)
    await pool.query(
      "UPDATE agents SET status = 'active', is_claimed = true WHERE name = $1",
      [agentName]
    );

    // ---------------------------------------------------------------
    // 5. Human asks a question
    // ---------------------------------------------------------------
    const askRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${humanToken}`)
      .send({
        title: 'How do I implement a binary search in Python?',
        body: 'I need to implement binary search for a sorted array. Can someone show me an efficient approach with explanation?',
        tags: ['python', 'algorithms'],
      });

    expect(askRes.status).toBe(201);
    const questionId = askRes.body.data.question.id;
    expect(questionId).toBeDefined();
    expect(askRes.body.data.question.title).toBe('How do I implement a binary search in Python?');

    // ---------------------------------------------------------------
    // 6. Verify question appears in the list
    // ---------------------------------------------------------------
    const listRes = await request(app).get('/api/questions?sort=new');

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.questions.length).toBe(1);
    expect(listRes.body.data.questions[0].id).toBe(questionId);

    // ---------------------------------------------------------------
    // 7. Verify question appears when filtered by tag
    // ---------------------------------------------------------------
    const tagFilterRes = await request(app).get('/api/questions?tag=python');

    expect(tagFilterRes.status).toBe(200);
    expect(tagFilterRes.body.data.questions.length).toBe(1);

    // ---------------------------------------------------------------
    // 8. View the question detail
    // ---------------------------------------------------------------
    const detailRes = await request(app).get(`/api/questions/${questionId}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.question.id).toBe(questionId);
    expect(detailRes.body.data.question.answer_count).toBe(0);

    // ---------------------------------------------------------------
    // 9. Agent answers the question
    // ---------------------------------------------------------------
    const answerRes = await request(app)
      .post(`/api/questions/${questionId}/answers`)
      .set('X-Agent-Key', agentApiKey)
      .send({
        content: 'Here is a binary search implementation in Python:\n\n```python\ndef binary_search(arr, target):\n    lo, hi = 0, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n```\n\nTime complexity: O(log n). Space complexity: O(1).',
      });

    expect(answerRes.status).toBe(201);
    const answerId = answerRes.body.data.answer.id;
    expect(answerId).toBeDefined();

    // ---------------------------------------------------------------
    // 10. Verify question now has answer_count = 1
    // ---------------------------------------------------------------
    const afterAnswerRes = await request(app).get(`/api/questions/${questionId}`);
    expect(afterAnswerRes.body.data.question.answer_count).toBe(1);

    // ---------------------------------------------------------------
    // 11. Agent cannot answer the same question twice
    // ---------------------------------------------------------------
    const dupAnswerRes = await request(app)
      .post(`/api/questions/${questionId}/answers`)
      .set('X-Agent-Key', agentApiKey)
      .send({ content: 'Another answer attempt.' });

    expect(dupAnswerRes.status).toBe(409);

    // ---------------------------------------------------------------
    // 12. Fetch answers list and verify agent info is included
    // ---------------------------------------------------------------
    const answersListRes = await request(app)
      .get(`/api/questions/${questionId}/answers?sort=votes`)
      .set('Authorization', `Bearer ${humanToken}`);

    expect(answersListRes.status).toBe(200);
    expect(answersListRes.body.data.answers.length).toBe(1);
    const listedAnswer = answersListRes.body.data.answers[0];
    expect(listedAnswer.agent_name).toBe('python-expert');
    expect(listedAnswer.agent_display_name).toBe('Python Expert');
    expect(listedAnswer.score).toBe(0);
    expect(listedAnswer.user_vote).toBeNull();

    // ---------------------------------------------------------------
    // 13. Human upvotes the answer
    // ---------------------------------------------------------------
    const upvoteRes = await request(app)
      .post(`/api/answers/${answerId}/vote`)
      .set('Authorization', `Bearer ${humanToken}`)
      .send({ value: 1 });

    expect(upvoteRes.status).toBe(200);
    expect(upvoteRes.body.data.new_score).toBe(1);
    expect(upvoteRes.body.data.user_vote).toBe(1);

    // ---------------------------------------------------------------
    // 14. Verify agent reputation increased (+10 for upvote)
    // ---------------------------------------------------------------
    const agentProfileRes = await request(app).get(`/api/agents/${agentName}`);

    expect(agentProfileRes.status).toBe(200);
    expect(agentProfileRes.body.data.agent.reputation_score).toBe(10);
    expect(agentProfileRes.body.data.agent.total_answers).toBe(1);

    // ---------------------------------------------------------------
    // 15. Answers list now shows user_vote for authenticated user
    // ---------------------------------------------------------------
    const answersAfterVoteRes = await request(app)
      .get(`/api/questions/${questionId}/answers`)
      .set('Authorization', `Bearer ${humanToken}`);

    expect(answersAfterVoteRes.body.data.answers[0].score).toBe(1);
    expect(answersAfterVoteRes.body.data.answers[0].user_vote).toBe(1);

    // ---------------------------------------------------------------
    // 16. Human changes vote to downvote
    // ---------------------------------------------------------------
    const downvoteRes = await request(app)
      .post(`/api/answers/${answerId}/vote`)
      .set('Authorization', `Bearer ${humanToken}`)
      .send({ value: -1 });

    expect(downvoteRes.status).toBe(200);
    expect(downvoteRes.body.data.new_score).toBe(-1);
    expect(downvoteRes.body.data.user_vote).toBe(-1);

    // ---------------------------------------------------------------
    // 17. Agent reputation decreased (reverse +10, apply -5 = net -5 from 0, floored to 0)
    // ---------------------------------------------------------------
    const agentAfterDownRes = await request(app).get(`/api/agents/${agentName}`);
    // upvote gave +10, change to downvote reverses it (-10) and applies -5 = net -5, but floors at 0
    expect(agentAfterDownRes.body.data.agent.reputation_score).toBe(0);

    // ---------------------------------------------------------------
    // 18. Human removes vote entirely
    // ---------------------------------------------------------------
    const removeVoteRes = await request(app)
      .delete(`/api/answers/${answerId}/vote`)
      .set('Authorization', `Bearer ${humanToken}`);

    expect(removeVoteRes.status).toBe(200);
    expect(removeVoteRes.body.data.new_score).toBe(0);
    expect(removeVoteRes.body.data.user_vote).toBeNull();

    // ---------------------------------------------------------------
    // 19. Human adds a comment on the answer
    // ---------------------------------------------------------------
    const commentRes = await request(app)
      .post(`/api/answers/${answerId}/comments`)
      .set('Authorization', `Bearer ${humanToken}`)
      .send({ content: 'Thanks, this is exactly what I needed!' });

    expect(commentRes.status).toBe(201);
    const commentId = commentRes.body.data.comment.id;
    expect(commentRes.body.data.comment.author_type).toBe('user');

    // ---------------------------------------------------------------
    // 20. Agent replies to the comment
    // ---------------------------------------------------------------
    const agentCommentRes = await request(app)
      .post(`/api/answers/${answerId}/comments`)
      .set('X-Agent-Key', agentApiKey)
      .send({
        content: 'Glad it helped! Feel free to ask follow-up questions.',
        parent_id: commentId,
      });

    expect(agentCommentRes.status).toBe(201);
    expect(agentCommentRes.body.data.comment.author_type).toBe('agent');
    expect(agentCommentRes.body.data.comment.depth).toBe(1);
    expect(agentCommentRes.body.data.comment.parent_id).toBe(commentId);

    // ---------------------------------------------------------------
    // 21. Fetch comment tree and verify nesting
    // ---------------------------------------------------------------
    const commentsRes = await request(app)
      .get(`/api/answers/${answerId}/comments`);

    expect(commentsRes.status).toBe(200);
    const tree = commentsRes.body.data.comments;
    expect(tree.length).toBe(1); // 1 root comment
    expect(tree[0].content).toBe('Thanks, this is exactly what I needed!');
    expect(tree[0].children.length).toBe(1); // 1 reply
    expect(tree[0].children[0].content).toBe('Glad it helped! Feel free to ask follow-up questions.');

    // ---------------------------------------------------------------
    // 22. Register a second agent and have it answer
    // ---------------------------------------------------------------
    const agent2Res = await request(app)
      .post('/api/agents/register')
      .send({
        name: 'algo-master',
        display_name: 'Algorithm Master',
        expertise_tags: ['algorithms', 'data-structures'],
      });

    expect(agent2Res.status).toBe(201);
    const agent2Key = agent2Res.body.data.api_key;

    // Activate second agent
    await pool.query(
      "UPDATE agents SET status = 'active', is_claimed = true WHERE name = 'algo-master'"
    );

    const answer2Res = await request(app)
      .post(`/api/questions/${questionId}/answers`)
      .set('X-Agent-Key', agent2Key)
      .send({
        content: 'You can also use the bisect module from the standard library for binary search.',
      });

    expect(answer2Res.status).toBe(201);
    const answer2Id = answer2Res.body.data.answer.id;

    // ---------------------------------------------------------------
    // 23. Upvote second agent's answer multiple times (different users)
    // ---------------------------------------------------------------
    // Register a second human to vote
    const user2Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'bob@example.com',
        username: 'bob',
        password: 'bobpass123',
        display_name: 'Bob',
      });
    const user2Token = user2Res.body.data.token;

    // Both humans upvote agent2's answer
    await request(app)
      .post(`/api/answers/${answer2Id}/vote`)
      .set('Authorization', `Bearer ${humanToken}`)
      .send({ value: 1 });

    await request(app)
      .post(`/api/answers/${answer2Id}/vote`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ value: 1 });

    // ---------------------------------------------------------------
    // 24. Check leaderboard - agent2 should be first (20 rep from 2 upvotes)
    // ---------------------------------------------------------------
    const leaderboardRes = await request(app).get('/api/agents/leaderboard');

    expect(leaderboardRes.status).toBe(200);
    const agents = leaderboardRes.body.data.agents;
    expect(agents.length).toBe(2);
    // algo-master has 20 rep (2 upvotes * 10), python-expert has ~0-5
    expect(agents[0].name).toBe('algo-master');
    expect(agents[0].reputation_score).toBe(20);

    // ---------------------------------------------------------------
    // 25. Filter leaderboard by tag
    // ---------------------------------------------------------------
    const tagLeaderboardRes = await request(app)
      .get('/api/agents/leaderboard?tag=python');

    expect(tagLeaderboardRes.status).toBe(200);
    // Only python-expert has the 'python' tag
    expect(tagLeaderboardRes.body.data.agents.length).toBe(1);
    expect(tagLeaderboardRes.body.data.agents[0].name).toBe('python-expert');

    // ---------------------------------------------------------------
    // 26. Verify tags endpoint works
    // ---------------------------------------------------------------
    const tagsRes = await request(app).get('/api/tags?sort=popular');

    expect(tagsRes.status).toBe(200);
    const tags = tagsRes.body.data.tags;
    expect(tags.length).toBeGreaterThanOrEqual(2);
    // python and algorithms tags should exist with question_count >= 1
    const pythonTag = tags.find((t: any) => t.name === 'python');
    expect(pythonTag).toBeDefined();
    expect(pythonTag.question_count).toBe(1);

    // ---------------------------------------------------------------
    // 27. Agent updates its profile
    // ---------------------------------------------------------------
    const updateRes = await request(app)
      .patch('/api/agents/me')
      .set('X-Agent-Key', agentApiKey)
      .send({
        bio: 'Python expert with 20 years of experience',
        expertise_tags: ['python', 'algorithms', 'machine-learning'],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.agent.bio).toBe('Python expert with 20 years of experience');
    expect(updateRes.body.data.agent.expertise_tags).toContain('machine-learning');

    // ---------------------------------------------------------------
    // 28. Verify the full question detail is consistent
    // ---------------------------------------------------------------
    const finalDetailRes = await request(app).get(`/api/questions/${questionId}`);

    expect(finalDetailRes.status).toBe(200);
    expect(finalDetailRes.body.data.question.answer_count).toBe(2);
    expect(finalDetailRes.body.data.question.view_count).toBeGreaterThanOrEqual(1);
  });

  test('E2E: Report → auto-hide → admin review flow', async () => {
    // 1. Create a question
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'author@test.com', username: 'author', password: 'testpass123', display_name: 'Author' });
    const authorToken = userRes.body.data.token;

    const askRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'A question that will be reported for testing', body: 'This question body has enough content for validation purposes.', tags: ['general'] });
    expect(askRes.status).toBe(201);
    const questionId = askRes.body.data.question.id;

    // 2. Three different users report it
    const reporters: string[] = [];
    for (let i = 0; i < 3; i++) {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ email: `reporter${i}@test.com`, username: `reporter${i}`, password: 'testpass123', display_name: `Reporter ${i}` });
      reporters.push(regRes.body.data.token);
    }

    for (const token of reporters) {
      const reportRes = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ target_type: 'question', target_id: questionId, reason: 'spam' });
      expect(reportRes.status).toBe(201);
    }

    // 3. Verify question is auto-hidden (GET returns 404)
    const hiddenRes = await request(app).get(`/api/questions/${questionId}`);
    expect(hiddenRes.status).toBe(404);

    // 4. Admin reviews (approve) → question stays deleted
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@test.com', username: 'admin', password: 'adminpass123', display_name: 'Admin' });
    const adminToken = adminRes.body.data.token;
    const adminId = adminRes.body.data.user.id;
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [adminId]);

    // Get pending reports
    const pendingRes = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.data.items.length).toBe(3);

    const reportId = pendingRes.body.data.items[0].id;
    const approveRes = await request(app)
      .patch(`/api/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });
    expect(approveRes.status).toBe(200);

    // All reports for this target should now be reviewed
    const afterApproveRes = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(afterApproveRes.body.data.items.length).toBe(0);

    // Question still hidden
    const stillHiddenRes = await request(app).get(`/api/questions/${questionId}`);
    expect(stillHiddenRes.status).toBe(404);
  });

  test('E2E: Agent feed → acknowledge → answer flow', async () => {
    // 1. Create user and question with tags
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'asker@test.com', username: 'asker', password: 'testpass123', display_name: 'Asker' });
    const askerToken = userRes.body.data.token;

    const askRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${askerToken}`)
      .send({ title: 'How to write unit tests in JavaScript?', body: 'I want to learn how to write proper unit tests for my JavaScript projects.', tags: ['javascript', 'testing'] });
    expect(askRes.status).toBe(201);
    const questionId = askRes.body.data.question.id;

    // 2. Register agent with matching expertise tags
    const agentRegRes = await request(app)
      .post('/api/agents/register')
      .send({ name: 'js-tester', display_name: 'JS Test Expert', expertise_tags: ['javascript', 'testing'] });
    expect(agentRegRes.status).toBe(201);
    const agentKey = agentRegRes.body.data.api_key;
    await pool.query("UPDATE agents SET status = 'active', is_claimed = true WHERE name = 'js-tester'");

    // 3. Agent polls feed → question appears
    const feedRes = await request(app)
      .get('/api/agents/me/feed')
      .set('X-Agent-Key', agentKey);
    expect(feedRes.status).toBe(200);
    expect(feedRes.body.data.questions.length).toBe(1);
    expect(feedRes.body.data.questions[0].id).toBe(questionId);

    // 4. Agent acknowledges the question
    const ackRes = await request(app)
      .post('/api/agents/me/feed/ack')
      .set('X-Agent-Key', agentKey)
      .send({ question_ids: [questionId] });
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.data.acknowledged).toBe(1);

    // 5. Agent polls again → no questions (acknowledged)
    const feed2Res = await request(app)
      .get('/api/agents/me/feed')
      .set('X-Agent-Key', agentKey);
    expect(feed2Res.status).toBe(200);
    expect(feed2Res.body.data.questions.length).toBe(0);

    // 6. Agent posts an answer
    const answerRes = await request(app)
      .post(`/api/questions/${questionId}/answers`)
      .set('X-Agent-Key', agentKey)
      .send({ content: 'Use Jest for unit testing. Here is how to set it up...' });
    expect(answerRes.status).toBe(201);

    // 7. Create another question with matching tags
    const ask2Res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${askerToken}`)
      .send({ title: 'What is the best JavaScript testing framework?', body: 'I need to choose a testing framework for my new JavaScript project.', tags: ['javascript'] });
    expect(ask2Res.status).toBe(201);
    const question2Id = ask2Res.body.data.question.id;

    // 8. Agent polls again → only new question appears (not the answered/acknowledged one)
    const feed3Res = await request(app)
      .get('/api/agents/me/feed')
      .set('X-Agent-Key', agentKey);
    expect(feed3Res.status).toBe(200);
    expect(feed3Res.body.data.questions.length).toBe(1);
    expect(feed3Res.body.data.questions[0].id).toBe(question2Id);
  });
});
