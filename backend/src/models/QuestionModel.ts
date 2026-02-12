import { Pool } from 'pg';

export class QuestionModel {
  constructor(private pool: Pool) {}

  async create(data: {
    author_id: string;
    title: string;
    body: string;
  }): Promise<any> {
    const { rows } = await this.pool.query(
      `INSERT INTO questions (author_id, title, body)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.author_id, data.title, data.body]
    );
    return rows[0];
  }

  async findById(id: string, options?: { includeDeleted?: boolean }): Promise<any | null> {
    let query = `
      SELECT
        q.*,
        u.id as author_id,
        u.username as author_username,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'name', t.name,
              'display_name', t.display_name
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tags
      FROM questions q
      LEFT JOIN users u ON q.author_id = u.id
      LEFT JOIN question_tags qt ON q.id = qt.question_id
      LEFT JOIN tags t ON qt.tag_id = t.id
      WHERE q.id = $1
    `;

    if (!options?.includeDeleted) {
      query += ` AND q.is_deleted = false`;
    }

    query += ` GROUP BY q.id, u.id`;

    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  async list(options: {
    sort?: 'new' | 'hot' | 'unanswered';
    tag?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const sort = options.sort || 'new';

    let query = `
      SELECT
        q.*,
        u.id as author_id,
        u.username as author_username,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'name', t.name,
              'display_name', t.display_name
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tags
      FROM questions q
      LEFT JOIN users u ON q.author_id = u.id
      LEFT JOIN question_tags qt ON q.id = qt.question_id
      LEFT JOIN tags t ON qt.tag_id = t.id
      WHERE q.is_deleted = false
    `;

    const params: any[] = [];

    if (options.tag) {
      params.push(options.tag);
      query += ` AND EXISTS (
        SELECT 1 FROM question_tags qt2
        JOIN tags t2 ON qt2.tag_id = t2.id
        WHERE qt2.question_id = q.id AND t2.name = $${params.length}
      )`;
    }

    if (sort === 'unanswered') {
      query += ` AND q.answer_count = 0`;
    }

    query += ` GROUP BY q.id, u.id`;

    // Add ORDER BY clause
    if (sort === 'new') {
      query += ` ORDER BY q.created_at DESC`;
    } else if (sort === 'hot') {
      query += ` ORDER BY (q.answer_count * 2 + q.view_count) / (EXTRACT(EPOCH FROM NOW() - q.created_at)/3600 + 2) DESC`;
    } else if (sort === 'unanswered') {
      query += ` ORDER BY q.created_at DESC`;
    }

    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  async incrementViewCount(id: string): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE questions SET view_count = view_count + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async incrementAnswerCount(id: string, delta: number = 1): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE questions SET answer_count = answer_count + $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, delta]
    );
    return rows[0];
  }

  async addTags(questionId: string, tagIds: number[]): Promise<void> {
    if (tagIds.length === 0) {
      return;
    }

    const values = tagIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    await this.pool.query(
      `INSERT INTO question_tags (question_id, tag_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      [questionId, ...tagIds]
    );
  }

  async search(searchText: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const query = `
      SELECT
        q.*,
        u.id as author_id,
        u.username as author_username,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'name', t.name,
              'display_name', t.display_name
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tags,
        ts_rank(q.search_vector, plainto_tsquery($1)) as rank
      FROM questions q
      LEFT JOIN users u ON q.author_id = u.id
      LEFT JOIN question_tags qt ON q.id = qt.question_id
      LEFT JOIN tags t ON qt.tag_id = t.id
      WHERE q.is_deleted = false
        AND q.search_vector @@ plainto_tsquery($1)
      GROUP BY q.id, u.id
      ORDER BY rank DESC, q.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await this.pool.query(query, [searchText, limit, offset]);
    return rows;
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
      `UPDATE questions SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0];
  }
}
