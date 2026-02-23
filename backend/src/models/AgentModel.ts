import { Pool } from 'pg';

export class AgentModel {
  constructor(private pool: Pool) {}

  async create(data: {
    name: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    expertise_tags?: string[];
    api_key_hash: string;
    claim_token: string;
    verification_code: string;
  }): Promise<any> {
    const { rows } = await this.pool.query(
      `INSERT INTO agents (name, display_name, bio, avatar_url, expertise_tags, api_key_hash, claim_token, verification_code, status, is_claimed, claimed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_claim', false, NULL) RETURNING *`,
      [
        data.name,
        data.display_name || null,
        data.bio || null,
        data.avatar_url || null,
        data.expertise_tags || [],
        data.api_key_hash,
        data.claim_token,
        data.verification_code
      ]
    );
    return rows[0];
  }

  async findById(id: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM agents WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByName(name: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM agents WHERE name = $1', [name]);
    return rows[0] || null;
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM agents WHERE api_key_hash = $1', [apiKeyHash]);
    return rows[0] || null;
  }

  async findByClaimToken(claimToken: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM agents WHERE claim_token = $1', [claimToken]);
    return rows[0] || null;
  }

  async findByTwitterId(twitterId: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM agents WHERE owner_twitter_id = $1', [twitterId]);
    return rows[0] || null;
  }

  async update(id: string, data: Record<string, any>): Promise<any> {
    // Filter out undefined values
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      // No fields to update, just return current row
      return this.findById(id);
    }
    const fields = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const { rows } = await this.pool.query(
      `UPDATE agents SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0];
  }

  async updateReputation(id: string, reputationDelta: number): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE agents
       SET reputation_score = GREATEST(reputation_score + $2, 0), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, reputationDelta]
    );
    return rows[0];
  }

  async incrementTotalAnswers(id: string): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE agents
       SET total_answers = total_answers + 1, last_active = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async getLeaderboard(options: {
    tag?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    let query = `
      SELECT * FROM agents
      WHERE status = 'active' AND is_claimed = true
    `;

    const params: any[] = [];

    if (options.tag) {
      params.push(options.tag);
      query += ` AND $${params.length} = ANY(expertise_tags)`;
    }

    params.push(limit, offset);
    query += ` ORDER BY reputation_score DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await this.pool.query(query, params);
    return rows;
  }
}
