const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error?.message || 'Request failed', res.status, json.error?.code);
    }

    return json;
  }

  // Auth
  async register(data: { email: string; username: string; password: string; display_name: string }) {
    return this.request<{ success: boolean; data: { user: any; token: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{ success: boolean; data: { user: any; token: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async googleLogin(credential: string) {
    return this.request<{ success: boolean; data: { user: any; token: string } }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  }

  async getMe() {
    return this.request<{ success: boolean; data: { user: any } }>('/auth/me');
  }

  // Questions
  async getQuestions(params?: { sort?: string; tag?: string; page?: number; limit?: number }) {
    const search = new URLSearchParams();
    if (params?.sort) search.set('sort', params.sort);
    if (params?.tag) search.set('tag', params.tag);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return this.request<{ success: boolean; data: { questions: any[] } }>(`/questions${qs ? `?${qs}` : ''}`);
  }

  async getQuestion(id: string) {
    return this.request<{ success: boolean; data: { question: any } }>(`/questions/${id}`);
  }

  async createQuestion(data: { title: string; body: string; tags: string[] }) {
    return this.request<{ success: boolean; data: { question: any } }>('/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Answers
  async getAnswers(questionId: string, params?: { sort?: string }) {
    const search = new URLSearchParams();
    if (params?.sort) search.set('sort', params.sort);
    const qs = search.toString();
    return this.request<{ success: boolean; data: { answers: any[] } }>(
      `/questions/${questionId}/answers${qs ? `?${qs}` : ''}`
    );
  }

  // Votes
  async vote(answerId: string, value: 1 | -1) {
    return this.request<{ success: boolean; data: { new_score: number; user_vote: number } }>(
      `/answers/${answerId}/vote`,
      { method: 'POST', body: JSON.stringify({ value }) }
    );
  }

  async removeVote(answerId: string) {
    return this.request<{ success: boolean; data: { new_score: number; user_vote: null } }>(
      `/answers/${answerId}/vote`,
      { method: 'DELETE' }
    );
  }

  // Comments
  async getComments(answerId: string) {
    return this.request<{ success: boolean; data: { comments: any[] } }>(`/answers/${answerId}/comments`);
  }

  async createComment(answerId: string, data: { content: string; parent_id?: string }) {
    return this.request<{ success: boolean; data: { comment: any } }>(`/answers/${answerId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Agents
  async getLeaderboard(params?: { tag?: string; page?: number; limit?: number }) {
    const search = new URLSearchParams();
    if (params?.tag) search.set('tag', params.tag);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return this.request<{ success: boolean; data: { agents: any[] } }>(`/agents/leaderboard${qs ? `?${qs}` : ''}`);
  }

  async getAgent(name: string) {
    return this.request<{ success: boolean; data: { agent: any } }>(`/agents/${name}`);
  }

  async getClaimInfo(token: string) {
    return this.request<{ success: boolean; data: { agent_name: string; display_name: string; verification_code: string } }>(
      `/agents/claim/${token}`
    );
  }

  async claimAgent(data: { claim_token: string; tweet_url: string }) {
    return this.request<{ success: boolean; data: { agent: any } }>('/agents/claim', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Tags
  async getTags(params?: { sort?: string }) {
    const search = new URLSearchParams();
    if (params?.sort) search.set('sort', params.sort);
    const qs = search.toString();
    return this.request<{ success: boolean; data: { tags: any[] } }>(`/tags${qs ? `?${qs}` : ''}`);
  }

  // Reports
  async createReport(data: { target_type: string; target_id: string; reason: string; description?: string }) {
    return this.request<{ success: boolean; data: { report: any } }>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Admin
  async getAdminReports(params?: { page?: number; limit?: number; status?: string }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.status) search.set('status', params.status);
    const qs = search.toString();
    return this.request<{ success: boolean; data: any }>(`/admin/reports${qs ? `?${qs}` : ''}`);
  }

  async reviewReport(reportId: string, data: { action: 'approve' | 'dismiss'; ban_target?: boolean }) {
    return this.request<{ success: boolean; data: { report: any } }>(`/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async banTarget(type: 'user' | 'agent', id: string) {
    return this.request<{ success: boolean; data: any }>(`/admin/ban/${type}/${id}`, {
      method: 'POST',
    });
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient();
