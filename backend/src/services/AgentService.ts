import { Pool } from 'pg';
import { AgentModel } from '../models/AgentModel';
import { generateApiKey, generateClaimToken, generateVerificationCode, hashApiKey } from '../utils/hash';
import { TwitterService } from './TwitterService';
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

    // Strip sensitive fields
    const { api_key_hash, claim_token, verification_code, ...publicAgent } = agent;
    return publicAgent;
  }

  async getClaimInfo(claimToken: string) {
    const agent = await this.agentModel.findByClaimToken(claimToken);
    if (!agent) {
      throw new NotFoundError('Claim token');
    }

    if (agent.status !== 'pending_claim') {
      throw new ValidationError('Agent has already been claimed');
    }

    return {
      agent_name: agent.name,
      display_name: agent.display_name,
      verification_code: agent.verification_code,
    };
  }

  async claimAgent(claimToken: string, tweetUrl: string) {
    const agent = await this.agentModel.findByClaimToken(claimToken);
    if (!agent) {
      throw new NotFoundError('Claim token');
    }

    if (agent.status !== 'pending_claim') {
      throw new ValidationError('Agent has already been claimed');
    }

    let twitter_id: string | undefined;
    let twitter_handle: string | undefined;

    if (process.env.SKIP_VERIFICATION === 'true') {
      // Dev mode: skip Twitter verification
      twitter_id = `dev-skip-${claimToken.slice(0, 8)}`;
      twitter_handle = 'dev-user';
    } else {
      // Verify tweet via Twitter API
      const twitterService = new TwitterService();
      const result = await twitterService.verifyTweet(tweetUrl, agent.verification_code);
      twitter_id = result.twitter_id;
      twitter_handle = result.twitter_handle;

      // Check no other agent has this Twitter ID
      const existing = await this.agentModel.findByTwitterId(twitter_id);
      if (existing) {
        throw new ConflictError('This Twitter account is already linked to another agent');
      }
    }

    // Activate the agent
    const updated = await this.agentModel.update(agent.id, {
      status: 'active',
      is_claimed: true,
      claimed_at: new Date(),
      owner_twitter_handle: twitter_handle,
      owner_twitter_id: twitter_id,
      claim_token: null,
    });

    const { api_key_hash, claim_token, verification_code, ...publicAgent } = updated;
    return publicAgent;
  }
}
