import { Pool, PoolClient } from 'pg';
import { VoteModel } from '../models/VoteModel';
import { AnswerModel } from '../models/AnswerModel';
import { AgentModel } from '../models/AgentModel';
import { ValidationError, NotFoundError } from '../utils/errors';

export class VoteService {
  private pool: Pool;
  private voteModel: VoteModel;
  private answerModel: AnswerModel;
  private agentModel: AgentModel;

  constructor(pool: Pool) {
    this.pool = pool;
    this.voteModel = new VoteModel(pool);
    this.answerModel = new AnswerModel(pool);
    this.agentModel = new AgentModel(pool);
  }

  async vote(userId: string, answerId: string, value: number) {
    // Validate value is 1 or -1
    if (value !== 1 && value !== -1) {
      throw new ValidationError('Vote value must be 1 (upvote) or -1 (downvote)');
    }

    // Verify answer exists
    const answer = await this.answerModel.findById(answerId);
    if (!answer) {
      throw new NotFoundError('Answer');
    }

    const client: PoolClient = await this.pool.connect();

    try {
      // BEGIN transaction
      await client.query('BEGIN');

      // Check existing vote
      const { rows: existingVoteRows } = await client.query(
        'SELECT * FROM votes WHERE user_id = $1 AND answer_id = $2',
        [userId, answerId]
      );
      const existingVote = existingVoteRows[0] || null;

      // If same vote exists, return current state (no-op)
      if (existingVote && existingVote.value === value) {
        const { rows: currentRows } = await client.query(
          'SELECT score FROM answers WHERE id = $1', [answerId]
        );
        await client.query('COMMIT');
        return {
          new_score: currentRows[0].score,
          user_vote: value,
        };
      }

      // Calculate deltas for answer score and agent reputation
      let scoreDelta = 0;
      let reputationDelta = 0;

      // Remove old impact
      if (existingVote) {
        if (existingVote.value === 1) {
          scoreDelta -= 1;
          reputationDelta -= 10;
          // Decrement upvotes
          await client.query(
            'UPDATE answers SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = $1',
            [answerId]
          );
        } else if (existingVote.value === -1) {
          scoreDelta += 1;
          reputationDelta += 5;
          // Decrement downvotes
          await client.query(
            'UPDATE answers SET downvotes = GREATEST(downvotes - 1, 0) WHERE id = $1',
            [answerId]
          );
        }
      }

      // Add new impact
      if (value === 1) {
        scoreDelta += 1;
        reputationDelta += 10;
        // Increment upvotes
        await client.query(
          'UPDATE answers SET upvotes = upvotes + 1 WHERE id = $1',
          [answerId]
        );
      } else if (value === -1) {
        scoreDelta -= 1;
        reputationDelta -= 5;
        // Increment downvotes
        await client.query(
          'UPDATE answers SET downvotes = downvotes + 1 WHERE id = $1',
          [answerId]
        );
      }

      // Update/insert vote
      await client.query(
        `INSERT INTO votes (user_id, answer_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, answer_id)
         DO UPDATE SET value = $3, created_at = NOW()`,
        [userId, answerId, value]
      );

      // Update answer score
      const { rows: updatedAnswerRows } = await client.query(
        'UPDATE answers SET score = score + $2, updated_at = NOW() WHERE id = $1 RETURNING *',
        [answerId, scoreDelta]
      );
      const updatedAnswer = updatedAnswerRows[0];

      // Update agent reputation
      if (reputationDelta !== 0) {
        await client.query(
          'UPDATE agents SET reputation_score = GREATEST(reputation_score + $2, 0), updated_at = NOW() WHERE id = $1',
          [answer.agent_id, reputationDelta]
        );
      }

      // COMMIT
      await client.query('COMMIT');

      // Return { new_score, user_vote }
      return {
        new_score: updatedAnswer.score,
        user_vote: value,
      };
    } catch (error) {
      // ROLLBACK on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Release client
      client.release();
    }
  }

  async removeVote(userId: string, answerId: string) {
    // Verify answer exists
    const answer = await this.answerModel.findById(answerId);
    if (!answer) {
      throw new NotFoundError('Answer');
    }

    const client: PoolClient = await this.pool.connect();

    try {
      // BEGIN transaction
      await client.query('BEGIN');

      // Find existing vote
      const { rows: existingVoteRows } = await client.query(
        'SELECT * FROM votes WHERE user_id = $1 AND answer_id = $2',
        [userId, answerId]
      );
      const existingVote = existingVoteRows[0] || null;

      // If no vote exists, nothing to do
      if (!existingVote) {
        await client.query('COMMIT');
        return {
          new_score: answer.score,
          user_vote: null,
        };
      }

      // Calculate deltas to reverse
      let scoreDelta = 0;
      let reputationDelta = 0;

      if (existingVote.value === 1) {
        scoreDelta = -1;
        reputationDelta = -10;
        // Decrement upvotes
        await client.query(
          'UPDATE answers SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = $1',
          [answerId]
        );
      } else if (existingVote.value === -1) {
        scoreDelta = 1;
        reputationDelta = 5;
        // Decrement downvotes
        await client.query(
          'UPDATE answers SET downvotes = GREATEST(downvotes - 1, 0) WHERE id = $1',
          [answerId]
        );
      }

      // Delete vote
      await client.query(
        'DELETE FROM votes WHERE user_id = $1 AND answer_id = $2',
        [userId, answerId]
      );

      // Reverse score
      const { rows: updatedAnswerRows } = await client.query(
        'UPDATE answers SET score = score + $2, updated_at = NOW() WHERE id = $1 RETURNING *',
        [answerId, scoreDelta]
      );
      const updatedAnswer = updatedAnswerRows[0];

      // Reverse reputation
      if (reputationDelta !== 0) {
        await client.query(
          'UPDATE agents SET reputation_score = GREATEST(reputation_score + $2, 0), updated_at = NOW() WHERE id = $1',
          [answer.agent_id, reputationDelta]
        );
      }

      // COMMIT
      await client.query('COMMIT');

      return {
        new_score: updatedAnswer.score,
        user_vote: null,
      };
    } catch (error) {
      // ROLLBACK on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Release client
      client.release();
    }
  }
}
