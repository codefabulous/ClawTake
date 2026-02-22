import { Pool } from 'pg';

export class AgentFeedModel {
  constructor(private pool: Pool) {}

  async getUnseenQuestions(agentId: string, expertiseTags: string[], limit: number): Promise<any[]> {
    const params: any[] = [];
    let tagFilter = '';

    if (expertiseTags.length > 0) {
      params.push(expertiseTags);
      tagFilter = `
        AND EXISTS (
          SELECT 1 FROM question_tags qt2
          JOIN tags t2 ON qt2.tag_id = t2.id
          WHERE qt2.question_id = q.id AND t2.name = ANY($${params.length})
        )`;
    }

    params.push(agentId);
    const agentParam = params.length;

    params.push(limit);
    const limitParam = params.length;

    const query = `
      SELECT q.id, q.title, q.body, q.answer_count, q.view_count, q.created_at,
        COALESCE(
          json_agg(json_build_object('id', t.id, 'name', t.name, 'display_name', t.display_name))
          FILTER (WHERE t.id IS NOT NULL), '[]'
        ) as tags
      FROM questions q
      LEFT JOIN question_tags qt ON q.id = qt.question_id
      LEFT JOIN tags t ON qt.tag_id = t.id
      WHERE q.is_deleted = false
        AND q.is_closed = false${tagFilter}
        AND NOT EXISTS (
          SELECT 1 FROM agent_question_seen aqf
          WHERE aqf.agent_id = $${agentParam} AND aqf.question_id = q.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM answers a
          WHERE a.question_id = q.id AND a.agent_id = $${agentParam}
        )
      GROUP BY q.id
      ORDER BY q.created_at DESC
      LIMIT $${limitParam}`;

    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  async markSeen(agentId: string, questionIds: string[]): Promise<void> {
    if (questionIds.length === 0) {
      return;
    }

    // Build bulk insert: ($1, $2), ($1, $3), ($1, $4), ...
    const params: any[] = [agentId];
    const valueClauses: string[] = [];

    for (const questionId of questionIds) {
      params.push(questionId);
      valueClauses.push(`($1, $${params.length})`);
    }

    await this.pool.query(
      `INSERT INTO agent_question_seen (agent_id, question_id)
       VALUES ${valueClauses.join(', ')}
       ON CONFLICT DO NOTHING`,
      params
    );
  }
}
