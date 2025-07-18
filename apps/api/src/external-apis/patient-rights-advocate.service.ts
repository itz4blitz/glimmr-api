import { Injectable, HttpException, HttpStatus, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { request, APIRequestContext } from 'playwright';
import { 
  ExternalServiceException, 
  RateLimitExceededException, 
  ValidationException 
} from '../common/exceptions';

export interface PRAHospitalFile {
  fileid: string;
  filename: string;
  filesuffix: string;
  filetype: string;
  retrieved: string;
  size: string;
  url: string;
  pageurl: string;
  converted: boolean;
  storage: string;
  project: string;
}

export interface PRAHospital {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  beds: string;
  lat: string;
  long: string;
  ccn: string;
  url: string;
  files: PRAHospitalFile[];
}

export interface PRASearchResponse {
  hospitals: PRAHospital[];
  total: number;
  page: number;
  limit: number;
}

export interface PRASearchOptions {
  search?: string;
  searchstate?: string;
  limit?: number;
  page?: number;
}

@Injectable()
export class PatientRightsAdvocateService implements OnModuleDestroy {
  private apiContext: APIRequestContext | null = null;
  private contextCreatedAt: number | null = null;
  private readonly baseUrl = 'https://pts.patientrightsadvocatefiles.org';
  private readonly rateLimit = {
    maxRequests: 100,
    windowMs: 180000, // 180 seconds = 3 minutes
    requests: [] as number[],
  };
  private sessionId: string | null = null;
  private sessionExpiry: number | null = null;
  private readonly sessionDuration = 30 * 60 * 1000; // 30 minutes
  private readonly contextMaxAge = 60 * 60 * 1000; // 1 hour - recreate context periodically
  private isShuttingDown = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(PatientRightsAdvocateService.name)
    private readonly logger: PinoLogger,
  ) {
    this.initializeApiContext();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;

    this.logger.info('Shutting down PatientRightsAdvocateService');

    if (this.apiContext) {
      try {
        await this.apiContext.dispose();
        this.logger.info('Playwright API context disposed successfully');
      } catch (error) {
        this.logger.error({
          error: error.message,
        }, 'Failed to dispose Playwright API context');
      } finally {
        this.apiContext = null;
        this.contextCreatedAt = null;
      }
    }
  }

  private async initializeApiContext(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Service is shutting down, cannot initialize context');
    }

    try {
      this.logger.info('Initializing Playwright API context');

      this.apiContext = await request.newContext({
        baseURL: this.baseUrl,
        timeout: 30000,
        // Production-optimized settings
        ignoreHTTPSErrors: false,
        // Connection pooling and keep-alive
        extraHTTPHeaders: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
          'Accept': '*/*',
          'Origin': 'https://hospitalpricingfiles.org',
          'Referer': 'https://hospitalpricingfiles.org/',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Sec-Ch-Ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?1',
          'Sec-Ch-Ua-Platform': '"Android"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Gpc': '1',
          'Connection': 'keep-alive',
        },
      });

      this.contextCreatedAt = Date.now();

      this.logger.info({
        contextCreatedAt: this.contextCreatedAt,
      }, 'Playwright API context initialized successfully');
    } catch (error) {
      this.logger.error({
        error: error.message,
      }, 'Failed to initialize Playwright API context');
      throw error;
    }
  }

  /**
   * Check if the API context is healthy and recreate if needed
   */
  private async ensureHealthyContext(): Promise<void> {
    const now = Date.now();

    // Check if context needs recreation due to age
    if (this.contextCreatedAt && (now - this.contextCreatedAt) > this.contextMaxAge) {
      this.logger.info({
        contextAge: now - this.contextCreatedAt,
        maxAge: this.contextMaxAge,
      }, 'Context is too old, recreating');

      await this.recreateContext();
      return;
    }

    // Check if context exists
    if (!this.apiContext) {
      this.logger.info('No API context found, initializing');
      await this.initializeApiContext();
      return;
    }

    // Context appears healthy
    this.logger.debug('API context is healthy');
  }

  /**
   * Recreate the API context
   */
  private async recreateContext(): Promise<void> {
    this.logger.info('Recreating API context');

    // Dispose old context
    if (this.apiContext) {
      try {
        await this.apiContext.dispose();
      } catch (error) {
        this.logger.warn({
          error: error.message,
        }, 'Failed to dispose old context during recreation');
      }
    }

    // Reset state
    this.apiContext = null;
    this.contextCreatedAt = null;
    this.sessionId = null;
    this.sessionExpiry = null;

    // Create new context
    await this.initializeApiContext();
  }

  private async makeRequest(method: 'GET' | 'POST', url: string, options: {
    data?: any;
    headers?: Record<string, string>;
  } = {}) {
    if (this.isShuttingDown) {
      throw new Error('Service is shutting down, cannot make requests');
    }

    // Ensure we have a healthy context
    await this.ensureHealthyContext();

    await this.enforceRateLimit();

    const headers = { ...options.headers };

    // Add session ID to headers if available and not creating a session
    if (this.sessionId && !url.includes('/user/session')) {
      headers['sessionid'] = this.sessionId;
    }

    try {
      const response = method === 'GET'
        ? await this.apiContext!.get(url, { headers })
        : await this.apiContext!.post(url, {
            data: options.data,
            headers: { 'Content-Type': 'application/json', ...headers }
          });

      // Extract rate limit info from headers
      const rateLimitHeader = response.headers()['ratelimit'];
      if (rateLimitHeader) {
        this.logger.debug({
          rateLimit: rateLimitHeader,
          url,
        }, 'Rate limit status from API');
      }

      // Extract session ID from response headers
      const sessionIdHeader = response.headers()['sessionid'];
      if (sessionIdHeader && sessionIdHeader !== this.sessionId) {
        this.sessionId = sessionIdHeader;
        this.sessionExpiry = Date.now() + this.sessionDuration;
        this.logger.debug({
          sessionId: this.sessionId,
          url,
        }, 'Session ID updated from API response');
      }

      const responseData = await response.json().catch(() => ({}));

      this.logger.debug({
        url,
        status: response.status(),
        dataLength: Array.isArray(responseData) ? responseData.length : 'N/A',
      }, 'PRA API request successful');

      return {
        status: response.status(),
        data: responseData,
        headers: response.headers(),
      };
    } catch (error) {
      this.logger.error({
        url,
        message: error.message,
        errorType: error.constructor.name,
      }, 'PRA API request failed');

      // Check if this is a context-related error that requires recreation
      if (this.isContextError(error)) {
        this.logger.warn({
          url,
          error: error.message,
        }, 'Context error detected, will recreate on next request');

        // Mark context for recreation
        this.contextCreatedAt = 0; // Force recreation on next request
      }

      throw error;
    }
  }

  /**
   * Check if an error indicates the context needs to be recreated
   */
  private isContextError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    const contextErrorIndicators = [
      'context',
      'connection',
      'socket',
      'network',
      'timeout',
      'closed',
      'disposed',
    ];

    return contextErrorIndicators.some(indicator =>
      errorMessage.includes(indicator)
    );
  }

  /**
   * Enforce rate limiting: 100 requests per 180 seconds
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Remove requests older than the window
    this.rateLimit.requests = this.rateLimit.requests.filter(
      timestamp => now - timestamp < this.rateLimit.windowMs
    );

    // Check if we're at the limit
    if (this.rateLimit.requests.length >= this.rateLimit.maxRequests) {
      const oldestRequest = Math.min(...this.rateLimit.requests);
      const waitTime = this.rateLimit.windowMs - (now - oldestRequest);
      
      this.logger.warn({
        currentRequests: this.rateLimit.requests.length,
        maxRequests: this.rateLimit.maxRequests,
        waitTimeMs: waitTime,
      }, 'Rate limit reached, waiting before next request');

      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.enforceRateLimit(); // Recursive call to check again
    }

    // Add current request timestamp
    this.rateLimit.requests.push(now);
  }

  /**
   * Create a new session with the Patient Rights Advocate API
   */
  private async createSession(): Promise<string> {
    try {
      this.logger.info('Creating new session with PRA API');

      // Generate a timestamp-based username like the browser does
      // Based on browser trace: {"username":"1750636025728","password":""}
      const username = Date.now().toString();

      const response = await this.makeRequest('POST', '/user/session', {
        data: JSON.stringify({
          username: username,
          password: ""
        }),
      });

      // Extract session ID from response body or headers
      let sessionId = response.data?.sessionid;

      // If session ID is empty in body, try to get it from headers
      if (!sessionId || sessionId.trim() === '') {
        sessionId = response.headers?.sessionid;
      }

      if (sessionId && sessionId.trim() !== '') {
        this.sessionId = sessionId;
        this.sessionExpiry = Date.now() + this.sessionDuration;

        this.logger.info({
          sessionId: this.sessionId,
          username: username,
          responseData: response.data,
          responseHeaders: response.headers,
        }, 'Successfully created PRA API session');

        return this.sessionId;
      } else {
        this.logger.error({
          responseData: response.data,
          responseHeaders: response.headers,
          username: username,
        }, 'No session ID found in response body or headers');
        throw new Error('No session ID returned from API');
      }
    } catch (error) {
      this.logger.error({
        error: error.message,
      }, 'Failed to create PRA API session');
      throw error;
    }
  }

  /**
   * Check session status with the Patient Rights Advocate API
   */
  private async checkSession(): Promise<void> {
    try {
      this.logger.debug('Checking session status with PRA API');

      const response = await this.makeRequest('GET', '/check');

      this.logger.debug({
        timestamp: response.data?.ts,
        sessionId: this.sessionId,
      }, 'Session check successful');
    } catch (error) {
      this.logger.error({
        error: error.message,
        sessionId: this.sessionId,
      }, 'Session check failed');
      throw error;
    }
  }

  /**
   * Ensure we have a valid session
   */
  private async ensureValidSession(): Promise<void> {
    const now = Date.now();

    // Check if we need a new session
    if (!this.sessionId || !this.sessionExpiry || now >= this.sessionExpiry) {
      this.logger.info({
        hasSessionId: !!this.sessionId,
        sessionExpiry: this.sessionExpiry,
        currentTime: now,
        expired: this.sessionExpiry ? now >= this.sessionExpiry : 'N/A',
      }, 'Session invalid or expired, creating new session');

      await this.createSession();
    }

    // Perform session check
    await this.checkSession();
  }

  /**
   * Search for hospitals using the Patient Rights Advocate API
   */
  async searchHospitals(options: PRASearchOptions = {}): Promise<PRAHospital[]> {
    try {
      // Ensure we have a valid session before making the request
      await this.ensureValidSession();

      const params = new URLSearchParams();

      // Always include search parameter (can be empty)
      params.append('search', options.search || '');

      if (options.searchstate) {
        params.append('searchstate', options.searchstate);
      }

      const url = `/facility/search?${params.toString()}`;

      this.logger.info({
        url,
        options,
        sessionId: this.sessionId,
      }, 'Searching hospitals via PRA API');

      const response = await this.makeRequest('GET', url);

      this.logger.debug({
        responseType: typeof response.data,
        isArray: Array.isArray(response.data),
        dataKeys: response.data ? Object.keys(response.data) : 'null',
        dataLength: response.data?.length ?? 'N/A',
        responseData: response.data,
      }, 'PRA API response details');

      // Handle case where API returns empty object instead of array
      if (response.data && typeof response.data === 'object' && Object.keys(response.data).length === 0) {
        this.logger.warn({
          options,
          sessionId: this.sessionId,
        }, 'PRA API returned empty object - no hospitals found for search criteria');
        return []; // Return empty array instead of throwing error
      }

      if (!Array.isArray(response.data)) {
        this.logger.error({
          responseData: response.data,
          responseType: typeof response.data,
        }, 'Invalid response format from PRA API');
        throw new ExternalServiceException(
          'Patient Rights Advocate API',
          'Invalid response format'
        );
      }

      this.logger.info({
        hospitalCount: response.data.length,
        state: options.searchstate,
        search: options.search,
        sessionId: this.sessionId,
      }, 'Successfully retrieved hospitals from PRA API');

      return response.data;
    } catch (error) {
      this.logger.error({
        error: error.message,
        options,
        sessionId: this.sessionId,
      }, 'Failed to search hospitals via PRA API');

      if (error.response?.status === 429) {
        throw new RateLimitExceededException('Patient Rights Advocate API');
      }

      if (error.response?.status >= 500) {
        throw new ExternalServiceException(
          'Patient Rights Advocate API',
          'Service currently unavailable'
        );
      }

      throw new ExternalServiceException(
        'Patient Rights Advocate API',
        'Failed to fetch hospital data'
      );
    }
  }

  /**
   * Get hospitals for a specific state
   */
  async getHospitalsByState(state: string): Promise<PRAHospital[]> {
    if (!state || state.length !== 2) {
      throw new ValidationException(
        'state', 
        state, 
        'must be a valid 2-letter state code'
      );
    }

    return this.searchHospitals({ searchstate: state.toUpperCase() });
  }

  /**
   * Get all hospitals for all states (use with caution due to rate limits)
   */
  async getAllHospitals(): Promise<PRAHospital[]> {
    const states = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ];

    const allHospitals: PRAHospital[] = [];
    
    this.logger.info({
      stateCount: states.length,
    }, 'Starting to fetch hospitals for all states');

    for (const state of states) {
      try {
        this.logger.info({ state }, 'Fetching hospitals for state');
        const hospitals = await this.getHospitalsByState(state);
        allHospitals.push(...hospitals);
        
        this.logger.info({
          state,
          hospitalCount: hospitals.length,
          totalCount: allHospitals.length,
        }, 'Successfully fetched hospitals for state');
        
        // Small delay between states to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error({
          state,
          error: error.message,
        }, 'Failed to fetch hospitals for state');
        // Continue with other states even if one fails
      }
    }

    this.logger.info({
      totalHospitals: allHospitals.length,
    }, 'Completed fetching hospitals for all states');

    return allHospitals;
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    const now = Date.now();
    const activeRequests = this.rateLimit.requests.filter(
      timestamp => now - timestamp < this.rateLimit.windowMs
    );

    return {
      maxRequests: this.rateLimit.maxRequests,
      currentRequests: activeRequests.length,
      remainingRequests: this.rateLimit.maxRequests - activeRequests.length,
      windowMs: this.rateLimit.windowMs,
      resetTime: activeRequests.length > 0
        ? new Date(Math.min(...activeRequests) + this.rateLimit.windowMs)
        : new Date(),
    };
  }

  /**
   * Get session status
   */
  getSessionStatus() {
    const now = Date.now();
    return {
      sessionId: this.sessionId,
      hasSession: !!this.sessionId,
      sessionExpiry: this.sessionExpiry,
      isExpired: this.sessionExpiry ? now >= this.sessionExpiry : null,
      timeUntilExpiry: this.sessionExpiry ? Math.max(0, this.sessionExpiry - now) : null,
    };
  }
}
