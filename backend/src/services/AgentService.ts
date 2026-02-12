import { Pool } from 'pg';
import { AgentModel } from '../models/AgentModel';
import { generateApiKey, generateClaimToken, generateVerificationCode, hashApiKey } from '../utils/hash';
import { ValidationError, ConflictError, NotFoundError } from '../utils/errors';

export class AgentService {
  private agentModel: AgentModel;

  constructor(pool: Pool) {
    this.agentModel = new AgentModel(pool);
  }

  async register(input: {
    name: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    expertise_tags?: string[];
  }) {
    // Validate name (3-50 chars, alphanumeric+hyphens only)
    const namePattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (!input.name || input.name.length < 3 || input.name.length > 50) {
      throw new ValidationError('Agent name must be between 3 and 50 characters');
    }
    if (!namePattern.test(input.name)) {
      throw new ValidationError(
        'Agent name must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen'
      );
    }

    // Validate expertise_tags max 5
    if (input.expertise_tags && input.expertise_tags.length > 5) {
      throw new ValidationError('Maximum of 5 expertise tags allowed');
    }

    // Generate API key + claim token + verification code
    const { raw: api_key, hash: api_key_hash } = generateApiKey();
    const claim_token = generateClaimToken();
    const verification_code = generateVerificationCode();

    // Create agent
    let agent;
    try {
      agent = await this.agentModel.create({
        name: input.name,
        display_name: input.display_name,
        bio: input.bio,
        avatar_url: input.avatar_url,
        expertise_tags: input.expertise_tags,
        api_key_hash,
        claim_token,
        verification_code,
      });
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === '23505') {
        if (error.constraint?.includes('name')) {
          throw new ConflictError('Agent name already taken');
        }
        throw new ConflictError('Agent already exists');
      }
      throw error;
    }

    // Generate claim URL
    const claim_url = `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/claim/${claim_token}`;

    // Return { agent, api_key (raw), claim_url, verification_code }
    return {
      agent,
      api_key,
      claim_url,
      verification_code,
    };
  }

  async getByName(name: string) {
    // Find agent
    const agent = await this.agentModel.findByName(name);
    if (!agent) {
      throw new NotFoundError('Agent');
    }

    // Return public fields + recent answers (not implemented yet, just return agent)
    // Remove sensitive fields
    const { api_key_hash, claim_token, verification_code, ...publicAgent } = agent;
    return publicAgent;
  }

  async getLeaderboard(options: { tag?: string; limit?: number; offset?: number }) {
    // Delegate to model
    const agents = await this.agentModel.getLeaderboard(options);

    // Remove sensitive fields from each agent
    return agents.map(agent => {
      const { api_key_hash, claim_token, verification_code, ...publicAgent } = agent;
      return publicAgent;
    });
  }

  async updateProfile(agentId: string, input: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    expertise_tags?: string[];
  }) {
    // Validate expertise_tags max 5
    if (input.expertise_tags && input.expertise_tags.length > 5) {
      throw new ValidationError('Maximum of 5 expertise tags allowed');
    }

    // Update agent
    const agent = await this.agentModel.update(agentId, input);
    if (!agent) {
      throw new NotFoundError('Agent');
    }

    return agent;
  }
}
