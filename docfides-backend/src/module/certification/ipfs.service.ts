import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type IpfsAddResult = {
  cid: string;
  gatewayUrl: string | null;
};

export type IpfsStatusResult = {
  configured: boolean;
  connected: boolean;
  apiUrl: string | null;
  gatewayUrl: string | null;
  version: string | null;
  error: string | null;
};

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);

  constructor(private readonly configService: ConfigService) {}

  async getStatus(): Promise<IpfsStatusResult> {
    const apiUrl = this.getApiUrl();
    const gatewayUrl = this.getGatewayBaseUrl();

    if (!apiUrl) {
      return {
        configured: false,
        connected: false,
        apiUrl: null,
        gatewayUrl,
        version: null,
        error: 'IPFS_API_URL belum dikonfigurasi',
      };
    }

    try {
      const response = await fetch(`${apiUrl}/api/v0/version`, {
        method: 'POST',
        headers: this.buildAuthHeaders(),
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(
          responseText || `IPFS API responded with ${response.status}`,
        );
      }

      const parsed = JSON.parse(responseText) as { Version?: string };

      return {
        configured: true,
        connected: true,
        apiUrl,
        gatewayUrl,
        version: parsed.Version ?? null,
        error: null,
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        apiUrl,
        gatewayUrl,
        version: null,
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }

  async addPdf(
    content: Buffer,
    fileName: string,
  ): Promise<IpfsAddResult | null> {
    const apiUrl = this.getApiUrl();

    if (!apiUrl) {
      return null;
    }

    try {
      const arrayBuffer = new ArrayBuffer(content.byteLength);
      new Uint8Array(arrayBuffer).set(content);

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([arrayBuffer], { type: 'application/pdf' }),
        fileName,
      );

      const response = await fetch(
        `${apiUrl}/api/v0/add?pin=true&cid-version=1`,
        {
          method: 'POST',
          body: formData,
          headers: this.buildAuthHeaders(),
        },
      );

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(
          responseText || `IPFS API responded with ${response.status}`,
        );
      }

      const cid = this.parseCid(responseText);
      if (!cid) {
        throw new Error('IPFS API response tidak berisi CID');
      }

      const gatewayUrl = this.buildGatewayUrl(cid);
      return { cid, gatewayUrl };
    } catch (err) {
      if (this.configService.get<string>('IPFS_UPLOAD_REQUIRED') === 'true') {
        throw err;
      }

      this.logger.warn(
        `Upload IPFS dilewati: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return null;
    }
  }

  private normalizeUrl(value?: string) {
    const url = value?.trim();
    return url ? url.replace(/\/+$/, '') : null;
  }

  private buildAuthHeaders(): HeadersInit {
    const authHeader = this.configService.get<string>('IPFS_API_AUTH_HEADER');
    return authHeader ? { Authorization: authHeader } : {};
  }

  private parseCid(responseText: string) {
    const lines = responseText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines.reverse()) {
      try {
        const parsed = JSON.parse(line) as { Hash?: string; Cid?: string };
        if (parsed.Hash || parsed.Cid) {
          return parsed.Hash ?? parsed.Cid ?? null;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  getGatewayUrl(cid: string | null | undefined) {
    return cid ? this.buildGatewayUrl(cid) : null;
  }

  private getApiUrl() {
    return this.normalizeUrl(this.configService.get<string>('IPFS_API_URL'));
  }

  private getGatewayBaseUrl() {
    return this.normalizeUrl(
      this.configService.get<string>('IPFS_GATEWAY_URL'),
    );
  }

  private buildGatewayUrl(cid: string) {
    const gatewayUrl = this.getGatewayBaseUrl();

    return gatewayUrl ? `${gatewayUrl}/ipfs/${cid}` : null;
  }
}
