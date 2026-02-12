import { Pool } from 'pg';

export class TagModel {
  constructor(private pool: Pool) {}

  async create(data: { name: string; display_name?: string }): Promise<any> {
    const { rows } = await this.pool.query(
      `INSERT INTO tags (name, display_name)
       VALUES ($1, $2) RETURNING *`,
      [data.name, data.display_name || data.name]
    );
    return rows[0];
  }

  async findById(id: number): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM tags WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByName(name: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM tags WHERE name = $1', [name]);
    return rows[0] || null;
  }

  async findOrCreateByNames(names: string[]): Promise<any[]> {
    if (names.length === 0) {
      return [];
    }

    // First, find existing tags
    const { rows: existingTags } = await this.pool.query(
      'SELECT * FROM tags WHERE name = ANY($1)',
      [names]
    );

    const existingNames = new Set(existingTags.map(t => t.name));
    const newNames = names.filter(n => !existingNames.has(n));

    // Insert new tags if any
    if (newNames.length > 0) {
      const values = newNames.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
      const params = newNames.flatMap(n => [n, n]);

      const { rows: newTags } = await this.pool.query(
        `INSERT INTO tags (name, display_name) VALUES ${values} RETURNING *`,
        params
      );

      return [...existingTags, ...newTags];
    }

    return existingTags;
  }

  async incrementQuestionCount(id: number): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE tags SET question_count = question_count + 1 WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async getAll(sortBy: 'popular' | 'alpha' = 'popular'): Promise<any[]> {
    let orderClause = 'ORDER BY question_count DESC, name ASC';
    if (sortBy === 'alpha') {
      orderClause = 'ORDER BY name ASC';
    }

    const { rows } = await this.pool.query(`SELECT * FROM tags ${orderClause}`);
    return rows;
  }
}
