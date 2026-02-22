import { Pool } from 'pg';
import { ReportModel } from '../models/ReportModel';
import { QuestionModel } from '../models/QuestionModel';
import { AnswerModel } from '../models/AnswerModel';
import { CommentModel } from '../models/CommentModel';
import { UserModel } from '../models/UserModel';
import { AgentModel } from '../models/AgentModel';
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from '../utils/errors';

const AUTO_HIDE_THRESHOLD = 3;

export class ReportService {
  private reportModel: ReportModel;
  private questionModel: QuestionModel;
  private answerModel: AnswerModel;
  private commentModel: CommentModel;
  private userModel: UserModel;
  private agentModel: AgentModel;

  constructor(pool: Pool) {
    this.reportModel = new ReportModel(pool);
    this.questionModel = new QuestionModel(pool);
    this.answerModel = new AnswerModel(pool);
    this.commentModel = new CommentModel(pool);
    this.userModel = new UserModel(pool);
    this.agentModel = new AgentModel(pool);
  }

  async create(reporterId: string, input: {
    target_type: 'question' | 'answer' | 'comment';
    target_id: string;
    reason: string;
    description?: string;
  }) {
    // 1. Validate description max 500 chars if provided
    if (input.description && input.description.length > 500) {
      throw new ValidationError('Description must be at most 500 characters');
    }

    // 2. Verify target exists based on target_type
    let target: any;
    if (input.target_type === 'question') {
      target = await this.questionModel.findById(input.target_id, { includeDeleted: true });
    } else if (input.target_type === 'answer') {
      target = await this.answerModel.findById(input.target_id);
    } else if (input.target_type === 'comment') {
      target = await this.commentModel.findById(input.target_id);
    }

    if (!target) {
      throw new NotFoundError('Target content');
    }

    // 3. For questions: prevent self-reporting
    if (input.target_type === 'question' && target.author_id === reporterId) {
      throw new ForbiddenError('You cannot report your own content');
    }

    // 4. Insert report, handle duplicate constraint
    let report;
    try {
      report = await this.reportModel.create({
        reporter_id: reporterId,
        target_type: input.target_type,
        target_id: input.target_id,
        reason: input.reason,
        description: input.description,
      });
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictError('You have already reported this content');
      }
      throw error;
    }

    // 5. Count reports for this target
    const count = await this.reportModel.countByTarget(input.target_type, input.target_id);

    // 6. If count >= AUTO_HIDE_THRESHOLD, auto-hide target if not already deleted
    if (count >= AUTO_HIDE_THRESHOLD) {
      if (input.target_type === 'question' && !target.is_deleted) {
        await this.questionModel.update(input.target_id, { is_deleted: true });
      } else if (input.target_type === 'answer' && !target.is_deleted) {
        await this.answerModel.update(input.target_id, { is_deleted: true });
      } else if (input.target_type === 'comment' && !target.is_deleted) {
        await this.commentModel.update(input.target_id, { is_deleted: true });
      }
    }

    // 7. Return the created report
    return report;
  }

  async listPending(options: { limit?: number; offset?: number }) {
    const [items, total] = await Promise.all([
      this.reportModel.findPending(options),
      this.reportModel.countPending(),
    ]);

    return { items, total };
  }

  async review(adminUserId: string, reportId: string, input: {
    action: 'approve' | 'dismiss';
    ban_target?: boolean;
  }) {
    // 1. Find report by ID
    const report = await this.reportModel.findById(reportId);
    if (!report) {
      throw new NotFoundError('Report');
    }

    // 2. Check report is still pending
    if (report.status !== 'pending') {
      throw new ValidationError('Report already reviewed');
    }

    // 3. If action === 'approve'
    if (input.action === 'approve') {
      // Mark all pending reports for this target as 'reviewed'
      await this.reportModel.reviewAllForTarget(report.target_type, report.target_id, adminUserId);

      // If ban_target: look up target content, get author, ban them
      if (input.ban_target) {
        if (report.target_type === 'question') {
          const question = await this.questionModel.findById(report.target_id, { includeDeleted: true });
          if (question) {
            await this.userModel.update(question.author_id, { is_banned: true });
          }
        } else if (report.target_type === 'answer') {
          const answer = await this.answerModel.findById(report.target_id);
          if (answer) {
            await this.agentModel.update(answer.agent_id, { status: 'suspended' });
          }
        } else if (report.target_type === 'comment') {
          const comment = await this.commentModel.findById(report.target_id);
          if (comment) {
            if (comment.author_type === 'user') {
              await this.userModel.update(comment.author_id, { is_banned: true });
            } else if (comment.author_type === 'agent') {
              await this.agentModel.update(comment.author_id, { status: 'suspended' });
            }
          }
        }
      }
    }

    // 4. If action === 'dismiss'
    if (input.action === 'dismiss') {
      // Restore the target content (set is_deleted = false)
      if (report.target_type === 'question') {
        await this.questionModel.update(report.target_id, { is_deleted: false });
      } else if (report.target_type === 'answer') {
        await this.answerModel.update(report.target_id, { is_deleted: false });
      } else if (report.target_type === 'comment') {
        await this.commentModel.update(report.target_id, { is_deleted: false });
      }

      // Mark all pending reports for this target as 'dismissed'
      await this.reportModel.dismissAllForTarget(report.target_type, report.target_id, adminUserId);
    }

    // 5. Return the updated report (re-fetch by id)
    return this.reportModel.findById(reportId);
  }

  async ban(adminUserId: string, targetType: 'user' | 'agent', targetId: string) {
    // 1. Validate targetType
    if (targetType !== 'user' && targetType !== 'agent') {
      throw new ValidationError('Target type must be "user" or "agent"');
    }

    // 2. If 'user': find user, throw NotFoundError if missing, ban
    if (targetType === 'user') {
      const user = await this.userModel.findById(targetId);
      if (!user) {
        throw new NotFoundError('User');
      }
      return this.userModel.update(targetId, { is_banned: true });
    }

    // 3. If 'agent': find agent, throw NotFoundError if missing, suspend
    const agent = await this.agentModel.findById(targetId);
    if (!agent) {
      throw new NotFoundError('Agent');
    }
    const updated = await this.agentModel.update(targetId, { status: 'suspended' });

    // Strip sensitive fields for agents
    const { api_key_hash, claim_token, verification_code, ...publicAgent } = updated;
    return publicAgent;
  }
}
