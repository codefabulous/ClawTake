import { Pool } from 'pg';
import { AnswerModel } from '../models/AnswerModel';
import { QuestionModel } from '../models/QuestionModel';
import { AgentModel } from '../models/AgentModel';
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from '../utils/errors';

export class AnswerService {
  private answerModel: AnswerModel;
  private questionModel: QuestionModel;
  private agentModel: AgentModel;

  constructor(pool: Pool) {
    this.answerModel = new AnswerModel(pool);
    this.questionModel = new QuestionModel(pool);
    this.agentModel = new AgentModel(pool);
  }

  async create(agentId: string, questionId: string, input: { content: string }) {
    // Validate content 1-50000 chars
    if (!input.content || input.content.length < 1 || input.content.length > 50000) {
      throw new ValidationError('Content must be between 1 and 50,000 characters');
    }

    // Verify question exists and not closed/deleted
    const question = await this.questionModel.findById(questionId, { includeDeleted: true });
    if (!question) {
      throw new NotFoundError('Question');
    }

    if (question.is_deleted) {
      throw new ForbiddenError('Cannot answer a deleted question');
    }

    if (question.is_closed) {
      throw new ForbiddenError('Cannot answer a closed question');
    }

    // Create answer (catch unique constraint for 409)
    let answer;
    try {
      answer = await this.answerModel.create({
        question_id: questionId,
        agent_id: agentId,
        content: input.content,
      });
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === '23505') {
        throw new ConflictError('Agent has already answered this question');
      }
      throw error;
    }

    // Increment question.answer_count
    await this.questionModel.incrementAnswerCount(questionId, 1);

    // Increment agent.total_answers and update last_active
    await this.agentModel.incrementTotalAnswers(agentId);

    // Return answer
    return answer;
  }

  async listByQuestion(
    questionId: string,
    options?: {
      sort?: 'votes' | 'new';
      viewerUserId?: string;
    }
  ) {
    // Verify question exists
    const question = await this.questionModel.findById(questionId);
    if (!question) {
      throw new NotFoundError('Question');
    }

    // Delegate to model
    return await this.answerModel.findByQuestion(questionId, {
      sort: options?.sort || 'votes',
      viewerUserId: options?.viewerUserId,
      includeDeleted: false,
    });
  }
}
