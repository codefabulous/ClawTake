import { Pool } from 'pg';
import { QuestionModel } from '../models/QuestionModel';
import { TagModel } from '../models/TagModel';
import { ValidationError, NotFoundError } from '../utils/errors';

export class QuestionService {
  private questionModel: QuestionModel;
  private tagModel: TagModel;

  constructor(pool: Pool) {
    this.questionModel = new QuestionModel(pool);
    this.tagModel = new TagModel(pool);
  }

  async create(userId: string, input: {
    title: string;
    body: string;
    tags: string[];
  }) {
    // Validate title 10-300 chars
    if (!input.title || input.title.length < 10 || input.title.length > 300) {
      throw new ValidationError('Title must be between 10 and 300 characters');
    }

    // Validate body 20-10000 chars
    if (!input.body || input.body.length < 20 || input.body.length > 10000) {
      throw new ValidationError('Body must be between 20 and 10,000 characters');
    }

    // Validate tags 1-3
    if (!input.tags || input.tags.length < 1 || input.tags.length > 3) {
      throw new ValidationError('Must have between 1 and 3 tags');
    }

    // Normalize tag names to lowercase
    const normalizedTagNames = input.tags.map(tag => tag.toLowerCase().trim());

    // Remove duplicates
    const uniqueTagNames = [...new Set(normalizedTagNames)];

    // Find or create tags
    const tags = await this.tagModel.findOrCreateByNames(uniqueTagNames);

    // Create question
    const question = await this.questionModel.create({
      author_id: userId,
      title: input.title,
      body: input.body,
    });

    // Add tags
    const tagIds = tags.map(tag => tag.id);
    await this.questionModel.addTags(question.id, tagIds);

    // Increment tag question_counts
    await Promise.all(tags.map(tag => this.tagModel.incrementQuestionCount(tag.id)));

    // Get the full question with tags
    const fullQuestion = await this.questionModel.findById(question.id);

    return fullQuestion;
  }

  async getById(questionId: string) {
    // Find question
    const question = await this.questionModel.findById(questionId);

    // Throw NotFoundError if not found or is_deleted
    if (!question) {
      throw new NotFoundError('Question');
    }

    if (question.is_deleted) {
      throw new NotFoundError('Question');
    }

    // Increment view count (fire and forget, don't wait)
    this.questionModel.incrementViewCount(questionId).catch(() => {
      // Silently ignore errors in view count increment
    });

    // Return with details
    return question;
  }

  async list(options: {
    sort?: 'new' | 'hot' | 'unanswered';
    tag?: string;
    limit?: number;
    offset?: number;
  }) {
    // Delegate to model
    return await this.questionModel.list(options);
  }

  async search(searchText: string, options?: {
    limit?: number;
    offset?: number;
  }) {
    // Delegate to model
    return await this.questionModel.search(searchText, options);
  }
}
