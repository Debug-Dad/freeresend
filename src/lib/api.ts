const API_BASE =
  process.env.NODE_ENV === "development" ? "http://localhost:3000/api" : "/api";

class ApiClient {
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Network error" }));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  }

  // Domains
  async getDomains() {
    return this.request("/domains");
  }

  async addDomain(domain: string) {
    return this.request("/domains", {
      method: "POST",
      body: JSON.stringify({ domain }),
    });
  }

  async deleteDomain(id: string) {
    return this.request(`/domains/${id}`, {
      method: "DELETE",
    });
  }

  async verifyDomain(id: string) {
    return this.request(`/domains/${id}/verify`, {
      method: "POST",
    });
  }

  async retryDigitalOceanDNS(id: string) {
    return this.request(`/domains/${id}/retry-dns`, {
      method: "POST",
    });
  }

  // API Keys
  async getApiKeys() {
    return this.request("/api-keys");
  }

  async createApiKey(
    domainId: string,
    keyName: string,
    permissions: string[] = ["send"]
  ) {
    return this.request("/api-keys", {
      method: "POST",
      body: JSON.stringify({ domainId, keyName, permissions }),
    });
  }

  async deleteApiKey(id: string) {
    return this.request(`/api-keys/${id}`, {
      method: "DELETE",
    });
  }

  // Email Logs
  async getEmailLogs(
    params: {
      page?: number;
      limit?: number;
      domain_id?: string;
      status?: string;
    } = {}
  ) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString());
    });

    const query = searchParams.toString();
    return this.request(`/emails/logs${query ? `?${query}` : ""}`);
  }

  async getEmail(id: string) {
    return this.request(`/emails/${id}`);
  }
}

export const api = new ApiClient();
