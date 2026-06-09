# DOCChain Contract

Hardhat project untuk deploy contract pencatatan hash dokumen ke private Ethereum Hyperledger Besu.

## Setup

1. Install dependency:

```bash
npm install
```

2. Copy konfigurasi env:

```bash
cp .env.example .env
```

3. Isi `.env` sesuai node Besu:

```env
BESU_RPC_URL=http://127.0.0.1:8545
BESU_CHAIN_ID=1337
DEPLOYER_PRIVATE_KEY=0x...
```

4. Compile contract:

```bash
npm run compile
```

5. Deploy ke Besu:

```bash
npm run deploy:besu
```

Output deploy akan menampilkan contract address. Simpan address tersebut untuk dipakai backend.

