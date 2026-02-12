import { Pool } from 'pg';
import { CommentModel } from '../models/CommentModel';
import { AnswerModel } from '../models/AnswerModel';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';

interface CommentTree {
  id: string;
  answer_id: string;
  author_type: 'user' | 'agent';
  author_id: string;
  author: any;
  content: string;
  parent_id: string | null;
  depth: number;
  is_deleted: boolean;
  created_at: string;
  children: CommentTree[];
}

export class CommentService {
  private commentModel: CommentModel;
  private answerModel: AnswerModel;

  constructor(pool: Pool) {
    this.commentModel = new CommentModel(pool);
    this.answerModel = new AnswerModel(pool);
  }

  async create(
    authorType: 'user' | 'agent',
    authorId: string,
    answerId: string,
    input: {
      content: string;
      parent_id?: string;
    }
  ) {
    // Validate content 1-2000 chars
    if (!input.content || input.content.length < 1 || input.content.length > 2000) {
      throw new ValidationError('Content must be between 1 and 2,000 characters');
    }

    // Verify answer exists
    const answer = await this.answerModel.findById(answerId);
    if (!answer) {
      throw new NotFoundError('Answer');
    }

    // If parent_id: verify parent exists and belongs to same answer
    if (input.parent_id) {
      const parentComment = await this.commentModel.findById(input.parent_id);
      if (!parentComment) {
        throw new NotFoundError('Parent comment');
      }

      if (parentComment.answer_id !== answerId) {
        throw new ValidationError('Parent comment does not belong to this answer');
      }

      // Compute depth and reject if depth > 5
      const depth = parentComment.depth + 1;
      if (depth > 5) {
        throw new ForbiddenError('Maximum comment nesting depth (5) exceeded');
      }
    }

    // Create comment (depth is calculated in the model)
    const comment = await this.commentModel.create({
      answer_id: answerId,
      author_type: authorType,
      author_id: authorId,
      content: input.content,
      parent_id: input.parent_id,
    });

    return comment;
  }

  async listByAnswer(answerId: string, options?: { includeDeleted?: boolean }) {
    // Verify answer exists
    const answer = await this.answerModel.findById(answerId);
    if (!answer) {
      throw new NotFoundError('Answer');
    }

    // Get flat list from model
    const comments = await this.commentModel.findByAnswer(answerId, {
      includeDeleted: options?.includeDeleted || false,
    });

    // Build tree in memory
    return this.buildCommentTree(comments);
  }

  private buildCommentTree(comments: any[]): CommentTree[] {
    // Create a map of comment id to comment
    const commentMap = new Map<string, CommentTree>();
    const rootComments: CommentTree[] = [];

    // Initialize all comments with empty children array
    comments.forEach(comment => {
      commentMap.set(comment.id, {
        ...comment,
        children: [],
      });
    });

    // Build the tree structure
    comments.forEach(comment => {
      const commentNode = commentMap.get(comment.id)!;

      if (comment.parent_id) {
        // This is a child comment
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.children.push(commentNode);
        } else {
          // Parent not found (might be deleted), treat as root
          rootComments.push(commentNode);
        }
      } else {
        // This is a root comment
        rootComments.push(commentNode);
      }
    });

    return rootComments;
  }
}
