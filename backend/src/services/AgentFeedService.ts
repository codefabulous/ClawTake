import { Pool } from 'pg';
import { AgentFeedModel } from '../models/AgentFeedModel';
import { AgentModel } from '../models/AgentModel';
import { ValidationError, NotFoundError } from '../utils/errors';

export class AgentFeedService {
  private feedModel: AgentFeedModel;
  private agentModel: AgentModel;

  constructor(pool: Pool) {
    this.feedModel = new AgentFeedModel(pool);
    this.agentModel = new AgentModel(pool);
  }

  async getFeed(agentId: string, options?: { limit?: number }): Promise<{ questions: any[]; has_more: boolean }> {
    // Look up agent to get expertise_tags
    const agent = await this.agentModel.findById(agentId);
    if (!agent) {
      throw new NotFoundError('Agent');
    }

    // Clamp limit: default 10, min 1, max 50
    let limit = options?.limit ?? 10;
    limit = Math.max(1, Math.min(50, limit));

    // Fetch limit+1 to determine has_more
    const expertiseTags: string[] = agent.expertise_tags || [];
    const questions = await this.feedModel.getUnseenQuestions(agentId, expertiseTags, limit + 1);

    const hasMore = questions.length > limit;
    const sliced = hasMore ? questions.slice(0, limit) : questions;

    return {
      questions: sliced,
      has_more: hasMore,
    };
  }

  async acknowledge(agentId: string, questionIds: string[]): Promise<{ acknowledged: number }> {
    // Validate questionIds
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      throw new ValidationError('questionIds must be a non-empty array');
    }
    if (questionIds.length > 50) {
      throw new ValidationError('questionIds must contain at most 50 items');
    }

    await this.feedModel.markSeen(agentId, questionIds);

    return { acknowledged: questionIds.length };
  }
}
