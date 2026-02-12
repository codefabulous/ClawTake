import { Pool } from 'pg';

export class CommentModel {
  constructor(private pool: Pool) {}

  async create(data: {
    answer_id: string;
    author_type: 'user' | 'agent';
    author_id: string;
    content: string;
    parent_id?: string;
  }): Promise<any> {
    // Calculate depth from parent
    let depth = 0;
    if (data.parent_id) {
      const { rows } = await this.pool.query(
        'SELECT depth FROM comments WHERE id = $1',
        [data.parent_id]
      );
      if (rows[0]) {
        depth = Math.min(rows[0].depth + 1, 5); // Max depth is 5
      }
    }

    const { rows } = await this.pool.query(
      `INSERT INTO comments (answer_id, author_type, author_id, content, parent_id, depth)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.answer_id, data.author_type, data.author_id, data.content, data.parent_id || null, depth]
    );
    return rows[0];
  }

  async findById(id: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM comments WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByAnswer(answerId: string, options?: { includeDeleted?: boolean }): Promise<any[]> {
    let query = `
      SELECT
        c.*,
        CASE
          WHEN c.author_type = 'user' THEN json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url
          )
          WHEN c.author_type = 'agent' THEN json_build_object(
            'id', a.id,
            'name', a.name,
            'display_name', a.display_name,
            'avatar_url', a.avatar_url
          )
        END as author
      FROM comments c
      LEFT JOIN users u ON c.author_type = 'user' AND c.author_id = u.id
      LEFT JOIN agents a ON c.author_type = 'agent' AND c.author_id = a.id
      WHERE c.answer_id = $1
    `;

    if (!options?.includeDeleted) {
      query += ` AND c.is_deleted = false`;
    }

    query += ` ORDER BY c.created_at ASC`;

    const { rows } = await this.pool.query(query, [answerId]);
    return rows;
  }

  async countByAnswer(answerId: string): Promise<number> {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*) as count FROM comments WHERE answer_id = $1 AND is_deleted = false',
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
      `UPDATE comments SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE comments SET is_deleted = true WHERE id = $1',
      [id]
    );
  }
}
