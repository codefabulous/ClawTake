import { Pool } from 'pg';

export class ReportModel {
  constructor(private pool: Pool) {}

  async create(data: {
    reporter_id: string;
    target_type: 'question' | 'answer' | 'comment';
    target_id: string;
    reason: string;
    description?: string;
  }): Promise<any> {
    const { rows } = await this.pool.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.reporter_id, data.target_type, data.target_id, data.reason, data.description || null]
    );
    return rows[0];
  }

  async findById(id: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async countByTarget(targetType: string, targetId: string): Promise<number> {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*) as count FROM reports WHERE target_type = $1 AND target_id = $2',
      [targetType, targetId]
    );
    return parseInt(rows[0].count, 10);
  }

  async findPending(options: { limit?: number; offset?: number }): Promise<any[]> {
    return this.findByStatus('pending', options);
  }

  async countPending(): Promise<number> {
    return this.countByStatus('pending');
  }

  async findByStatus(status: string | null, options: { limit?: number; offset?: number }): Promise<any[]> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    if (status) {
      const { rows } = await this.pool.query(
        `SELECT r.*, u.username as reporter_username, u.display_name as reporter_display_name
         FROM reports r
         JOIN users u ON r.reporter_id = u.id
         WHERE r.status = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      );
      return rows;
    }

    const { rows } = await this.pool.query(
      `SELECT r.*, u.username as reporter_username, u.display_name as reporter_display_name
       FROM reports r
       JOIN users u ON r.reporter_id = u.id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  }

  async countByStatus(status: string | null): Promise<number> {
    if (status) {
      const { rows } = await this.pool.query(
        'SELECT COUNT(*) as count FROM reports WHERE status = $1',
        [status]
      );
      return parseInt(rows[0].count, 10);
    }

    const { rows } = await this.pool.query('SELECT COUNT(*) as count FROM reports');
    return parseInt(rows[0].count, 10);
  }

  async updateStatus(id: string, data: { status: 'reviewed' | 'dismissed'; reviewed_by: string }): Promise<any> {
    const { rows } = await this.pool.query(
      `UPDATE reports SET status = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.status, data.reviewed_by]
    );
    return rows[0];
  }

  async dismissAllForTarget(targetType: string, targetId: string, reviewedBy: string): Promise<void> {
    await this.pool.query(
      `UPDATE reports SET status = 'dismissed', reviewed_by = $3, reviewed_at = NOW()
       WHERE target_type = $1 AND target_id = $2 AND status = 'pending'`,
      [targetType, targetId, reviewedBy]
    );
  }

  async reviewAllForTarget(targetType: string, targetId: string, reviewedBy: string): Promise<void> {
    await this.pool.query(
      `UPDATE reports SET status = 'reviewed', reviewed_by = $3, reviewed_at = NOW()
       WHERE target_type = $1 AND target_id = $2 AND status = 'pending'`,
      [targetType, targetId, reviewedBy]
    );
  }
}
