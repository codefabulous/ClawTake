import { Pool } from 'pg';

export class UserModel {
  constructor(private pool: Pool) {}

  async create(data: { email: string; username: string; display_name?: string; password_hash: string }): Promise<any> {
    const { rows } = await this.pool.query(
      `INSERT INTO users (email, username, display_name, password_hash)
       VALUES (LOWER($1), $2, $3, $4) RETURNING *`,
      [data.email, data.username, data.display_name || null, data.password_hash]
    );
    return rows[0];
  }

  async findById(id: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByEmail(email: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE email = LOWER($1)', [email]);
    return rows[0] || null;
  }

  async findByUsername(username: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return rows[0] || null;
  }

  async findByOAuth(provider: string, oauthId: string): Promise<any | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
      [provider, oauthId]
    );
    return rows[0] || null;
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
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0];
  }
}
