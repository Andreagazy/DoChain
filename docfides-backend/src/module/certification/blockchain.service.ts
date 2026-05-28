import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';

export type BlockchainRecordResult = {
  txHash: string;
  contractAddress: string;
};

const DOCUMENT_HASH_REGISTRY_ABI = [
  'function recordDocumentHash(string documentId, bytes32 documentHash, string ipfsCid) external',
];

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);

  constructor(private readonly configService: ConfigService) {}

  async recordFinalDocumentHash(
    documentId: string,
    documentHash: string,
    ipfsCid: string | null,
  ): Promise<BlockchainRecordResult | null> {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL')?.trim();
    const privateKey = this.configService
      .get<string>('BLOCKCHAIN_PRIVATE_KEY')
      ?.trim();
    const contractAddress = this.configService
      .get<string>('DOCUMENT_REGISTRY_ADDRESS')
      ?.trim();

    if (!rpcUrl || !privateKey || !contractAddress) {
      return this.handleSkipped('Konfigurasi blockchain belum lengkap');
    }

    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const wallet = new Wallet(privateKey, provider);
      const contract = new Contract(
        contractAddress,
        DOCUMENT_HASH_REGISTRY_ABI,
        wallet,
      );

      const tx = await contract.recordDocumentHash(
        documentId,
        this.toBytes32(documentHash),
        ipfsCid ?? '',
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
}

