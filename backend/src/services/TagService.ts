import { Pool } from 'pg';
import { TagModel } from '../models/TagModel';

export class TagService {
  private tagModel: TagModel;

  constructor(pool: Pool) {
    this.tagModel = new TagModel(pool);
  }

  async getAll(options?: { sortBy?: 'popular' | 'alpha' }) {
    // Delegate to model
    return await this.tagModel.getAll(options?.sortBy || 'popular');
  }

  async findOrCreateByNames(names: string[]) {
    // Normalize names to lowercase
    const normalizedNames = names.map(name => name.toLowerCase().trim());

    // Remove duplicates
    const uniqueNames = [...new Set(normalizedNames)];

    // Delegate to model
    return await this.tagModel.findOrCreateByNames(uniqueNames);
  }
}
