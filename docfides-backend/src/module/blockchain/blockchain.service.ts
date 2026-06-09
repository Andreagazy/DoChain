import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { Contract, JsonRpcProvider, Wallet, type InterfaceAbi } from 'ethers';

export type BlockchainRecordResult = {
  txHash: string;
  contractAddress: string;
};

export type BlockchainDocumentRecord = {
  documentHash: string;
  ipfsCid: string;
  issuer: string;
  issuedAt: Date | null;
  revoked: boolean;
  revokedAt: Date | null;
  revokeReasonHash: string | null;
  exists: boolean;
  contractAddress: string;
};

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private registryAbi: InterfaceAbi | null = null;

  constructor(private readonly configService: ConfigService) {}

  async recordFinalDocumentHash(
    documentHash: string,
    ipfsCid: string | null,
  ): Promise<BlockchainRecordResult | null> {
    const connection = this.getWriteConnection();

    if (!connection) {
      return this.handleSkipped('Konfigurasi blockchain belum lengkap');
    }

    try {
      const { contract, contractAddress } = connection;
      const tx = await contract.registerDocument(
        this.toBytes32(documentHash),
        ipfsCid ?? '',
        this.getTransactionOverrides(),
      );
      const receipt = await tx.wait();

      return {
        txHash: receipt?.hash ?? tx.hash,
        contractAddress,
      };
    } catch (err) {
      if (
        this.configService.get<string>('BLOCKCHAIN_RECORD_REQUIRED') === 'true'
      ) {
        throw err;
      }

      this.logger.warn(
        `Pencatatan blockchain dilewati: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  async revokeDocument(
    documentHash: string,
    reason: string,
  ): Promise<BlockchainRecordResult | null> {
    const connection = this.getWriteConnection();

    if (!connection) {
      return this.handleSkipped('Konfigurasi blockchain belum lengkap');
    }

    try {
      const { contract, contractAddress } = connection;
      const tx = await contract.revokeDocument(
        this.toBytes32(documentHash),
        this.hashTextToBytes32(reason),
        this.getTransactionOverrides(),
      );
      const receipt = await tx.wait();

      return {
        txHash: receipt?.hash ?? tx.hash,
        contractAddress,
      };
    } catch (err) {
      if (
        this.configService.get<string>('BLOCKCHAIN_RECORD_REQUIRED') === 'true'
      ) {
        throw err;
      }

      this.logger.warn(
        `Pencabutan blockchain dilewati: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  async getRecordByHash(
    documentHash: string,
  ): Promise<BlockchainDocumentRecord | null> {
    const contract = this.getReadContract();
    if (!contract) {
      return null;
    }

    try {
      const record = await contract.getRecordByHash(this.toBytes32(documentHash));
      return this.mapDocumentRecord(record);
    } catch (err) {
      this.logger.warn(
        `Gagal membaca record blockchain by hash: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private getWriteConnection() {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL')?.trim();
    const privateKey = this.configService
      .get<string>('BLOCKCHAIN_PRIVATE_KEY')
      ?.trim();
    const contractAddress = this.getContractAddress();

    if (!rpcUrl || !privateKey || !contractAddress) {
      return null;
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    const contract = new Contract(contractAddress, this.getRegistryAbi(), wallet);

    return { contract, contractAddress };
  }

  private getReadContract() {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL')?.trim();
    const contractAddress = this.getContractAddress();

    if (!rpcUrl || !contractAddress) {
      this.logger.warn('Konfigurasi blockchain read belum lengkap');
      return null;
    }

    const provider = new JsonRpcProvider(rpcUrl);
    return new Contract(contractAddress, this.getRegistryAbi(), provider);
  }

  private getRegistryAbi(): InterfaceAbi {
    if (this.registryAbi) {
      return this.registryAbi;
    }

    for (const abiPath of this.getAbiCandidatePaths()) {
      try {
        if (!existsSync(abiPath)) {
          continue;
        }

        const parsed = JSON.parse(readFileSync(abiPath, 'utf8')) as unknown;
        const abi = this.extractAbi(parsed);

        if (abi) {
          this.registryAbi = abi;
          return abi;
        }
      } catch (err) {
        this.logger.warn(
          `Gagal membaca ABI ${abiPath}: ${
            err instanceof Error ? err.message : 'unknown error'
          }`,
        );
      }
    }

    throw new Error(
      'ABI DocumentHashRegistry tidak ditemukan. Jalankan deploy Hardhat atau pastikan src/module/blockchain/abi.json tersedia.',
    );
  }

  private extractAbi(parsed: unknown): InterfaceAbi | null {
    if (Array.isArray(parsed)) {
      return parsed as InterfaceAbi;
    }

    if (parsed && typeof parsed === 'object' && 'abi' in parsed) {
      const artifact = parsed as { abi?: unknown };

      if (Array.isArray(artifact.abi)) {
        return artifact.abi as InterfaceAbi;
      }
    }

    return null;
  }

  private getAbiCandidatePaths() {
    const configuredPath = this.configService
      .get<string>('DOCUMENT_REGISTRY_ABI_PATH')
      ?.trim();
    const paths = [
      configuredPath,
      resolve(__dirname, 'abi.json'),
      resolve(process.cwd(), 'src/module/blockchain/abi.json'),
      resolve(
        process.cwd(),
        '../dochain-contract/deployments/besu/DocumentHashRegistry.json',
      ),
    ].filter((path): path is string => Boolean(path));

    return paths.map((path) =>
      isAbsolute(path) ? path : resolve(process.cwd(), path),
    );
  }

  private getContractAddress() {
    return (
      this.configService.get<string>('DOCUMENT_REGISTRY_ADDRESS')?.trim() ??
      this.getContractAddressFromDeployment()
    );
  }

  private getContractAddressFromDeployment() {
    for (const abiPath of this.getAbiCandidatePaths()) {
      try {
        if (!existsSync(abiPath)) {
          continue;
        }

        const parsed = JSON.parse(readFileSync(abiPath, 'utf8')) as {
          address?: string;
        };

        if (parsed.address) {
          return parsed.address.trim();
        }
      } catch {
        continue;
      }
    }

    return '';
  }

  private getTransactionOverrides() {
    const gasPrice = this.configService.get<string>('BLOCKCHAIN_GAS_PRICE');

    if (gasPrice === undefined || gasPrice === '') {
      return {};
    }

    return { gasPrice: BigInt(gasPrice) };
  }

  private handleSkipped(message: string) {
    if (this.configService.get<string>('BLOCKCHAIN_RECORD_REQUIRED') === 'true') {
      throw new Error(message);
    }

    this.logger.warn(message);
    return null;
  }

  private toBytes32(value: string) {
    const normalized = value.trim().replace(/^0x/i, '');

    if (!/^[a-fA-F0-9]{64}$/.test(normalized)) {
      throw new Error('Hash dokumen harus berupa SHA-256 hex 32 byte');
    }

    return `0x${normalized}`;
  }

  private hashTextToBytes32(value: string) {
    return `0x${createHash('sha256').update(value.trim()).digest('hex')}`;
  }

  private mapDocumentRecord(record: any): BlockchainDocumentRecord {
    const issuedAt = Number(record.issuedAt ?? 0);
    const revokedAt = Number(record.revokedAt ?? 0);
    const exists = Boolean(record.exists);
    const revokeReasonHash = String(record.revokeReasonHash ?? '');

    return {
      documentHash: String(record.documentHash ?? ''),
      ipfsCid: String(record.ipfsCid ?? ''),
      issuer: String(record.issuer ?? ''),
      issuedAt: exists && issuedAt > 0 ? new Date(issuedAt * 1000) : null,
      revoked: Boolean(record.revoked),
      revokedAt: revokedAt > 0 ? new Date(revokedAt * 1000) : null,
      revokeReasonHash:
        revokeReasonHash &&
        revokeReasonHash !==
          '0x0000000000000000000000000000000000000000000000000000000000000000'
          ? revokeReasonHash
          : null,
      exists,
      contractAddress: this.getContractAddress(),
    };
  }
}
