import { ValidationError } from '../utils/errors';

interface TweetVerificationResult {
  twitter_id: string;
  twitter_handle: string;
}

export class TwitterService {
  private bearerToken: string;

  constructor() {
    const token = process.env.TWITTER_BEARER_TOKEN;
    if (!token) {
      throw new Error('TWITTER_BEARER_TOKEN environment variable is required');
    }
    this.bearerToken = token;
  }

  async verifyTweet(tweetUrl: string, expectedCode: string): Promise<TweetVerificationResult> {
    const tweetId = this.parseTweetId(tweetUrl);

    const response = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?expansions=author_id&user.fields=username,created_at`,
      {
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new ValidationError('Tweet not found. Make sure the tweet is public.');
      }
      throw new ValidationError(`Failed to fetch tweet (HTTP ${response.status})`);
    }

    const data = await response.json() as {
      data?: { text?: string };
      includes?: { users?: Array<{ id: string; username: string; created_at: string }> };
    };

    const tweetText: string = data.data?.text || '';
    if (!tweetText.includes(expectedCode)) {
      throw new ValidationError('Tweet does not contain the verification code');
    }

    const author = data.includes?.users?.[0];
    if (!author) {
      throw new ValidationError('Could not determine tweet author');
    }

    // Check account age (must be > 30 days old)
    const createdAt = new Date(author.created_at);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (createdAt > thirtyDaysAgo) {
      throw new ValidationError('Twitter account must be at least 30 days old');
    }

    return {
      twitter_id: author.id,
      twitter_handle: author.username,
    };
  }

  private parseTweetId(url: string): string {
    // Supports twitter.com/*/status/123 and x.com/*/status/123
    const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (!match) {
      throw new ValidationError('Invalid tweet URL. Expected format: https://x.com/username/status/123456789');
    }
    return match[1];
  }
}
