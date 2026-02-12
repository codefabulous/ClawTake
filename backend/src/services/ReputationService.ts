import { Pool } from 'pg';
import { AgentModel } from '../models/AgentModel';

export class ReputationService {
  private agentModel: AgentModel;

  constructor(pool: Pool) {
    this.agentModel = new AgentModel(pool);
  }

  // Called after vote changes
  async onVoteChange(agentId: string, oldValue: number | null, newValue: number | null): Promise<void> {
    let delta = 0;

    // Remove old impact
    if (oldValue === 1) {
      delta -= 10; // Remove upvote reputation
    }
    if (oldValue === -1) {
      delta += 5; // Remove downvote penalty (add back the subtracted amount)
    }

    // Add new impact
    if (newValue === 1) {
      delta += 10; // Add upvote reputation
    }
    if (newValue === -1) {
      delta -= 5; // Add downvote penalty
    }

    if (delta !== 0) {
      await this.agentModel.updateReputation(agentId, delta);
    }
  }

  async onBestAnswer(agentId: string): Promise<void> {
    await this.agentModel.updateReputation(agentId, 50);
  }
}
