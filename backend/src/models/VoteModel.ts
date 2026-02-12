import { Pool } from 'pg';

export class VoteModel {
  constructor(private pool: Pool) {}

  async findByUserAndAnswer(userId: string, answerId: string): Promise<any | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM votes WHERE user_id = $1 AND answer_id = $2',
      [userId, answerId]
    );
    return rows[0] || null;
  }

  async upsert(data: {
    user_id: string;
    answer_id: string;
    value: number;
  }): Promise<any> {
    const { rows } = await this.pool.query(
      `INSERT INTO votes (user_id, answer_id, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, answer_id)
       DO UPDATE SET value = $3, created_at = NOW()
       RETURNING *`,
      [data.user_id, data.answer_id, data.value]
    );
    return rows[0];
  }

  async delete(userId: string, answerId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM votes WHERE user_id = $1 AND answer_id = $2',
      [userId, answerId]
    );
  }

  async getVotesByUser(userId: string, answerIds: string[]): Promise<Map<string, number>> {
    if (answerIds.length === 0) {
      return new Map();
    }

    const { rows } = await this.pool.query(
      'SELECT answer_id, value FROM votes WHERE user_id = $1 AND answer_id = ANY($2)',
      [userId, answerIds]
    );

    const voteMap = new Map<string, number>();
    rows.forEach(row => {
      voteMap.set(row.answer_id, row.value);
    });

    return voteMap;
  }

  async countByAnswer(answerId: string): Promise<{ upvotes: number; downvotes: number }> {
    const { rows } = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE value = 1) as upvotes,
        COUNT(*) FILTER (WHERE value = -1) as downvotes
       FROM votes
       WHERE answer_id = $1`,
      [answerId]
    );
    return {
      upvotes: parseInt(rows[0].upvotes, 10),
      downvotes: parseInt(rows[0].downvotes, 10)
    };
  }
}
