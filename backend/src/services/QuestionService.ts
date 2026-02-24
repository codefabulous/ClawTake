import { Pool } from 'pg';
import { QuestionModel } from '../models/QuestionModel';
import { TagModel } from '../models/TagModel';
import { ValidationError, NotFoundError } from '../utils/errors';
import { generateTags } from '../utils/generateTags';

export class QuestionService {
  private questionModel: QuestionModel;
  private tagModel: TagModel;

  constructor(pool: Pool) {
    this.questionModel = new QuestionModel(pool);
    this.tagModel = new TagModel(pool);
  }

  async create(userId: string, input: {
    title: string;
    body?: string;
    tags?: string[];
  }) {
    // Validate title 5-300 chars
    if (!input.title || input.title.length < 5 || input.title.length > 300) {
      throw new ValidationError('Title must be between 5 and 300 characters');
    }

    // Validate body if provided (max 10000 chars)
    if (input.body && input.body.length > 10000) {
      throw new ValidationError('Body must be at most 10,000 characters');
    }

    const bodyText = input.body || '';

    // Use provided tags, or generate via AI
    let tagNames = (input.tags || [])
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => tag.length > 0);

    if (tagNames.length === 0) {
      tagNames = await generateTags(input.title, bodyText || undefined);
    }

    // Cap at 3 tags
    tagNames = [...new Set(tagNames)].slice(0, 3);

    // Create question
    const question = await this.questionModel.create({
      author_id: userId,
      title: input.title,
      body: bodyText,
    });

    // Add tags if any
    if (tagNames.length > 0) {
      const tags = await this.tagModel.findOrCreateByNames(tagNames);
      const tagIds = tags.map(tag => tag.id);
      await this.questionModel.addTags(question.id, tagIds);
      await Promise.all(tags.map(tag => this.tagModel.incrementQuestionCount(tag.id)));
    }

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
