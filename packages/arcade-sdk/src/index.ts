import { EventEmitter } from 'events';

export interface Bid {
  id: string;
  amount: number;
  amountUsd?: number;
  bidder: string;
  agentId?: string;
  company?: string;
  prompt: string;
  rationale?: string;
  status?: string;
  paymentReceipt?: unknown;
  timestamp: number;
}

export interface AdSurfaceOptions {
  id: string;
  width: number;
  height: number;
}

export interface ArcadeConfig {
  apiKey?: string;
  baseUrl?: string;
  eventsUrl?: string;
  surfaceId?: string;
  mock?: boolean;
}

export class ArcadeSDK extends EventEmitter {
  private config: ArcadeConfig;
  private currentBids: Bid[] = [];
  private currentTexture: string | null = null;
  private mockTimer: NodeJS.Timeout | null = null;
  private events: EventSource | null = null;
  private usingMockFallback = false;

  constructor(config: ArcadeConfig = { mock: true, surfaceId: 'raceway-billboard-main' }) {
    super();
    this.config = {
      surfaceId: 'raceway-billboard-main',
      baseUrl: 'http://localhost:8787/api',
      ...config,
    };
    if (this.config.mock) {
      this.startMockMode();
    } else {
      this.startRealMode();
    }
  }

  createAdSurface(options: AdSurfaceOptions) {
    console.log(`[ArcadeSDK] Creating ad surface: ${options.id}`);
    return {
      id: options.id,
      width: options.width,
      height: options.height,
    };
  }

  subscribeToBids(callback: (bids: Bid[]) => void) {
    this.on('bidsUpdated', callback);
    // Initial emission
    callback(this.currentBids);
    return () => this.off('bidsUpdated', callback);
  }

  subscribeToTextureUpdates(callback: (textureUrl: string) => void) {
    this.on('textureUpdated', callback);
    if (this.currentTexture) {
      callback(this.currentTexture);
    }
    return () => this.off('textureUpdated', callback);
  }

  async submitBid(bid: Omit<Bid, 'id' | 'timestamp'>) {
    if (this.config.mock || this.usingMockFallback) {
      const newBid: Bid = {
        ...bid,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
      };
      this.currentBids = [newBid, ...this.currentBids].sort((a, b) => b.amount - a.amount);
      this.emit('bidsUpdated', this.currentBids);
      console.log(`[ArcadeSDK] [Mock] Bid submitted:`, newBid);
      return newBid;
    }

    const response = await fetch(`${this.config.baseUrl}/surfaces/${this.config.surfaceId}/bids`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        agentId: bid.agentId ?? bid.bidder,
        company: bid.company ?? bid.bidder,
        amountUsd: bid.amountUsd ?? bid.amount,
        prompt: bid.prompt,
        rationale: bid.rationale ?? 'Manual in-game bid from Arcad demo HUD.',
      }),
    });
    const data = await this.parseResponse(response);
    const normalized = this.normalizeBid(data.bid);
    this.mergeBid(normalized);
    return normalized;
  }

  async increaseBid(bidId: string, amount: number) {
    if (this.config.mock || this.usingMockFallback) {
      const bid = this.currentBids.find(b => b.id === bidId);
      if (bid) {
        bid.amount += amount;
        this.currentBids.sort((a, b) => b.amount - a.amount);
        this.emit('bidsUpdated', this.currentBids);
        return bid;
      }
      throw new Error('Bid not found');
    }

    const response = await fetch(`${this.config.baseUrl}/bids/${bidId}/increase`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ deltaUsd: amount }),
    });
    const data = await this.parseResponse(response);
    const normalized = this.normalizeBid(data.bid);
    this.mergeBid(normalized);
    return normalized;
  }

  async closeRound() {
    if (this.config.mock || this.usingMockFallback) {
      this.currentTexture = this.createMockTexture(this.currentBids[0]);
      this.emit('textureUpdated', this.currentTexture);
      return null;
    }
    const response = await fetch(`${this.config.baseUrl}/surfaces/${this.config.surfaceId}/close-round`, {
      method: 'POST',
      headers: this.headers(),
    });
    const data = await this.parseResponse(response);
    if (data.texture?.textureUrl) {
      this.currentTexture = data.texture.textureUrl;
      this.emit('textureUpdated', this.currentTexture);
    }
    return data;
  }

  private startMockMode() {
    console.log('[ArcadeSDK] Mock mode started');
    if (!this.currentTexture) {
      this.currentTexture = this.createMockTexture();
      this.emit('textureUpdated', this.currentTexture);
    }
    // Simulate incoming bids and texture updates
    this.mockTimer = setInterval(() => {
      if (Math.random() > 0.7) {
        const mockBid: Bid = {
          id: Math.random().toString(36).substr(2, 9),
          amount: Math.floor(Math.random() * 100) + 1,
          bidder: `Agent_${Math.floor(Math.random() * 100)}`,
          prompt: `A beautiful landscape with ${['cats', 'dogs', 'mountains', 'neon lights'][Math.floor(Math.random() * 4)]}`,
          timestamp: Date.now(),
        };
        this.currentBids = [mockBid, ...this.currentBids].sort((a, b) => b.amount - a.amount);
        this.emit('bidsUpdated', this.currentBids);

        // Simulate texture update when a new top bid arrives
        if (this.currentBids[0].id === mockBid.id) {
          this.currentTexture = this.createMockTexture(mockBid);
          this.emit('textureUpdated', this.currentTexture);
        }
      }
    }, 5000);
  }

  private async startRealMode() {
    await this.refreshSurface().catch((error) => {
      console.warn('[ArcadeSDK] Initial refresh failed, switching to mock fallback', error);
      this.startMockFallback();
    });

    if (this.usingMockFallback) return;

    const eventsUrl = this.config.eventsUrl ?? `${this.config.baseUrl}/events`;
    this.events = new EventSource(eventsUrl);
    this.events.onerror = (event) => {
      console.warn('[ArcadeSDK] Event stream failed, switching to mock fallback', event);
      this.startMockFallback();
    };

    this.events.addEventListener('bid.created', (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      this.mergeBid(this.normalizeBid(payload.bid));
    });

    this.events.addEventListener('bid.increased', (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      this.mergeBid(this.normalizeBid(payload.bid));
    });

    this.events.addEventListener('texture.updated', (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      this.currentTexture = payload.update.textureUrl;
      this.emit('textureUpdated', this.currentTexture);
    });
  }

  private startMockFallback() {
    if (this.usingMockFallback) return;
    this.usingMockFallback = true;
    this.events?.close();
    this.events = null;
    this.startMockMode();
  }

  private createMockTexture(bid?: Bid) {
    const seed = bid?.id ?? Math.random().toString(36).slice(2);
    return `https://picsum.photos/seed/arcade-${encodeURIComponent(seed)}/1024/512`;
  }

  private async refreshSurface() {
    const response = await fetch(`${this.config.baseUrl}/surfaces/${this.config.surfaceId}`, {
      headers: this.headers(false),
    });
    const data = await this.parseResponse(response);
    this.currentBids = (data.bids ?? []).map((bid: unknown) => this.normalizeBid(bid));
    this.emit('bidsUpdated', this.currentBids);
    if (data.surface?.textureUrl) {
      this.currentTexture = data.surface.textureUrl;
      this.emit('textureUpdated', this.currentTexture);
    }
  }

  private mergeBid(bid: Bid) {
    const withoutBid = this.currentBids.filter((existing) => existing.id !== bid.id);
    this.currentBids = [bid, ...withoutBid].sort((a, b) => b.amount - a.amount);
    this.emit('bidsUpdated', this.currentBids);
  }

  private normalizeBid(raw: any): Bid {
    return {
      id: raw.id,
      amount: raw.amount ?? raw.amountUsd,
      amountUsd: raw.amountUsd ?? raw.amount,
      bidder: raw.bidder ?? raw.company ?? raw.agentId,
      agentId: raw.agentId,
      company: raw.company,
      prompt: raw.prompt,
      rationale: raw.rationale,
      status: raw.status,
      paymentReceipt: raw.paymentReceipt,
      timestamp: raw.timestamp ?? raw.createdAt ?? Date.now(),
    };
  }

  private headers(withBody = true) {
    const headers: Record<string, string> = {};
    if (withBody) headers['content-type'] = 'application/json';
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    headers['x-arcade-payment-receipt'] = `sdk-${crypto.randomUUID()}`;
    return headers;
  }

  private async parseResponse(response: Response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error ?? `Arcad API returned ${response.status}`);
    }
    return data;
  }

  stop() {
    if (this.mockTimer) {
      clearInterval(this.mockTimer);
    }
    if (this.events) {
      this.events.close();
    }
  }
}
