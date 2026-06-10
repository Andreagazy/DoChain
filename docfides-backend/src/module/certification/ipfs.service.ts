import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type IpfsAddResult = {
  cid: string;
  gatewayUrl: string | null;
  replicas: IpfsReplicaPinResult[];
};

export type IpfsReplicaPinResult = {
  apiUrl: string;
  pinned: boolean;
  error: string | null;
};

export type IpfsStatusResult = {
  configured: boolean;
  connected: boolean;
  apiUrl: string | null;
  replicaApiUrls: string[];
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
    const replicaApiUrls = this.getReplicaApiUrls();
    const gatewayUrl = this.getGatewayBaseUrl();

    if (!apiUrl) {
      return {
        configured: false,
        connected: false,
        apiUrl: null,
        replicaApiUrls,
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
        replicaApiUrls,
        gatewayUrl,
        version: parsed.Version ?? null,
        error: null,
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        apiUrl,
        replicaApiUrls,
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

      const replicas = await this.pinToReplicas(cid);
      const gatewayUrl = this.buildGatewayUrl(cid);
      return { cid, gatewayUrl, replicas };
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

  private async pinToReplicas(cid: string): Promise<IpfsReplicaPinResult[]> {
    const replicaApiUrls = this.getReplicaApiUrls();

    if (replicaApiUrls.length === 0) {
      return [];
    }

    const results = await Promise.all(
      replicaApiUrls.map((replicaApiUrl) =>
        this.pinToReplica(replicaApiUrl, cid),
      ),
    );
    const failed = results.filter((result) => !result.pinned);

    if (
      failed.length > 0 &&
      this.configService.get<string>('IPFS_REPLICA_REQUIRED') === 'true'
    ) {
      throw new Error(
        `Replikasi IPFS gagal pada ${failed
          .map((item) => item.apiUrl)
          .join(', ')}`,
      );
    }

    return results;
  }

  private async pinToReplica(
    replicaApiUrl: string,
    cid: string,
  ): Promise<IpfsReplicaPinResult> {
    try {
      const timeoutMs = Number(
        this.configService.get<string>('IPFS_REPLICA_TIMEOUT_MS') ?? '60000',
      );
      const response = await fetch(
        `${replicaApiUrl}/api/v0/pin/add?arg=${encodeURIComponent(cid)}&recursive=true`,
        {
          method: 'POST',
          headers: this.buildReplicaAuthHeaders(),
          signal: AbortSignal.timeout(
            Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
          ),
        },
      );
      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          responseText || `IPFS replica responded with ${response.status}`,
        );
      }

      this.logger.log(`CID ${cid} berhasil dipin ke replica ${replicaApiUrl}`);
      return {
        apiUrl: replicaApiUrl,
        pinned: true,
        error: null,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(
        `Pin CID ${cid} ke replica ${replicaApiUrl} gagal: ${error}`,
      );

      return {
        apiUrl: replicaApiUrl,
        pinned: false,
        error,
      };
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

  private buildReplicaAuthHeaders(): HeadersInit {
    const authHeader =
      this.configService.get<string>('IPFS_REPLICA_API_AUTH_HEADER') ??
      this.configService.get<string>('IPFS_API_AUTH_HEADER');
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

  private getReplicaApiUrls() {
    const raw =
      this.configService.get<string>('IPFS_REPLICA_API_URLS') ??
      this.configService.get<string>('IPFS_REPLICA_API_URL');

    return (raw ?? '')
      .split(',')
      .map((url) => this.normalizeUrl(url))
      .filter((url): url is string => Boolean(url));
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
