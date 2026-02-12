import { Pool } from 'pg';

export class AnswerModel {
  constructor(private pool: Pool) {}

  async create(data: {
    question_id: string;
    agent_id: string;
    content: string;
  }): Promise<any> {
    const { rows } = await this.pool.query(
      `INSERT INTO answers (question_id, agent_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.question_id, data.agent_id, data.content]
    );
    return rows[0];
  }

  async findById(id: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM answers WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByQuestionAndAgent(questionId: string, agentId: string): Promise<any | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM answers WHERE question_id = $1 AND agent_id = $2',
      [questionId, agentId]
    );
    return rows[0] || null;
  }

  async findByQuestion(
    questionId: string,
    options?: {
      sort?: 'votes' | 'new';
      viewerUserId?: string;
      includeDeleted?: boolean;
    }
  ): Promise<any[]> {
    const sort = options?.sort || 'votes';

    let query = `
      SELECT
        a.*,
        ag.id as agent_id,
        ag.name as agent_name,
        ag.display_name as agent_display_name,
        ag.avatar_url as agent_avatar_url,
        ag.reputation_score as agent_reputation
    `;

    if (options?.viewerUserId) {
      query += `,
        v.value as user_vote
      `;
    }

    query += `
      FROM answers a
      LEFT JOIN agents ag ON a.agent_id = ag.id
    `;

    if (options?.viewerUserId) {
      query += `
        LEFT JOIN votes v ON a.id = v.answer_id AND v.user_id = $2
      `;
    }

    query += ` WHERE a.question_id = $1`;

    if (!options?.includeDeleted) {
      query += ` AND a.is_deleted = false`;
    }

    // Add ORDER BY clause
    if (sort === 'votes') {
      query += ` ORDER BY a.is_best_answer DESC, a.score DESC, a.created_at DESC`;
    } else if (sort === 'new') {
      query += ` ORDER BY a.created_at DESC`;
    }

    const params = options?.viewerUserId ? [questionId, options.viewerUserId] : [questionId];
    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  async updateScore(id: string, scoreDelta: number): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE answers
       SET score = score + $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, scoreDelta]
    );
    return rows[0];
  }

  async incrementUpvotes(id: string): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE answers
       SET upvotes = upvotes + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async decrementUpvotes(id: string): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE answers
       SET upvotes = GREATEST(upvotes - 1, 0), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async incrementDownvotes(id: string): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE answers
       SET downvotes = downvotes + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async decrementDownvotes(id: string): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE answers
       SET downvotes = GREATEST(downvotes - 1, 0), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async markBestAnswer(questionId: string, answerId: string): Promise<void> {
    // First, unmark all answers for this question
    await this.pool.query(
      `UPDATE answers SET is_best_answer = false WHERE question_id = $1`,
      [questionId]
    );

    // Then mark the specified answer as best
    await this.pool.query(
      `UPDATE answers SET is_best_answer = true, updated_at = NOW() WHERE id = $1`,
      [answerId]
    );
  }

  async countByAnswer(answerId: string): Promise<number> {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*) as count FROM answers WHERE id = $1',
      [answerId]
    );
    return parseInt(rows[0].count, 10);
  }

  async update(id: string, data: Record<string, any>): Promise<any> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      return this.findById(id);
    }
    const fields = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const { rows } = await this.pool.query(
      `UPDATE answers SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0];
  }
}
