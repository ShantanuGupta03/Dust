import { ethers } from "ethers";
import { TokenInfo, TokenMetadata } from "../types/token";

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

type BasescanResponse<T> = {
  status: string; // "1" success, "0" fail/empty
  message: string;
  result: T;
};

export class ComprehensiveTokenDiscovery {
  private provider: ethers.JsonRpcProvider;
  private contracts: Map<string, ethers.Contract> = new Map();

  // ⚠️ Move this to env later (Vercel env var). Hardcoding works but not ideal.
  private basescanApiKey: string = "MAQN7PR78ADW38QBIX39VF5RRR67KJEW22";

  constructor(rpcUrl: string = "https://mainnet.base.org") {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  // ---------- helpers ----------
  private normalize(addr: string) {
    return addr.toLowerCase();
  }

  private async sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // simple concurrency limiter (no dependency)
  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, idx: number) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    let i = 0;

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    });

    await Promise.all(workers);
    return results;
  }

  private getContract(tokenAddress: string): ethers.Contract {
    if (!this.contracts.has(tokenAddress)) {
      if (tokenAddress === ethers.ZeroAddress) {
        throw new Error("ETH is not an ERC20 token");
      }
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      this.contracts.set(tokenAddress, contract);
    }
    return this.contracts.get(tokenAddress)!;
  }

  async isValidContract(address: string): Promise<boolean> {
    try {
      const code = await this.provider.getCode(address);
      return code !== "0x" && code !== "0x0";
    } catch {
      return false;
    }
  }

  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    try {
      if (tokenAddress === ethers.ZeroAddress) {
        const bal = await this.provider.getBalance(userAddress);
        return bal.toString();
      }

      const isValid = await this.isValidContract(tokenAddress);
      if (!isValid) return "0";

      const contract = this.getContract(tokenAddress);
      const balance = await Promise.race([
        contract.balanceOf(userAddress),
        new Promise<bigint>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000)),
      ]);

      return balance.toString();
    } catch {
      return "0";
    }
  }

  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
    try {
      if (tokenAddress === ethers.ZeroAddress) {
        return { name: "Ethereum", symbol: "ETH", decimals: 18 };
      }

      const contract = this.getContract(tokenAddress);
      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => "Unknown Token"),
        contract.symbol().catch(() => "UNKNOWN"),
        contract.decimals().catch(() => 18),
      ]);

      return {
        name: (name as string) || "Unknown Token",
        symbol: (symbol as string) || "UNKNOWN",
        decimals: Number(decimals) || 18,
      };
    } catch {
      return { name: "Unknown Token", symbol: "UNKNOWN", decimals: 18 };
    }
  }

  // ---------- public API ----------
  async discoverAllTokens(userAddress: string): Promise<TokenInfo[]> {
    console.log("🔍 Starting comprehensive token discovery...");

    const tokenMap = new Map<string, TokenInfo>();

    // Source 1: tokenlist (quick, but incomplete)
    await this.discoverFromBasescanTokenList(userAddress, tokenMap);

    // Source 2: token transfers with pagination (main workhorse)
    await this.discoverFromTokenTransfersPaged(userAddress, tokenMap);

    // Fallback: popular tokens
    await this.discoverPopularTokens(userAddress, tokenMap);

    // ETH
    await this.addEthBalance(userAddress, tokenMap);

    const tokens = Array.from(tokenMap.values());
    console.log(`✅ Discovered ${tokens.length} tokens with balances`);
    return tokens;
  }

  // ---------- Basescan sources ----------
  private async discoverFromBasescanTokenList(
    userAddress: string,
    tokenMap: Map<string, TokenInfo>
  ): Promise<void> {
    try {
      console.log("📋 Fetching from Basescan tokenlist API...");
      const url =
        `https://api.basescan.org/api?module=account&action=tokenlist` +
        `&address=${userAddress}&apikey=${this.basescanApiKey}`;

      const response = await fetch(url);
      const data = (await response.json()) as BasescanResponse<any[]>;

      if (data.status !== "1" || !Array.isArray(data.result)) {
        console.log("tokenlist: no results");
        return;
      }

      console.log(`tokenlist: Found ${data.result.length} tokens`);

      for (const tokenData of data.result) {
        const tokenAddress = tokenData.contractAddress ? this.normalize(tokenData.contractAddress) : "";
        if (!tokenAddress || tokenMap.has(tokenAddress)) continue;

        const balance = tokenData.balance || "0";
        if (balance === "0" || balance === "0x0") continue;

        try {
          const decimals = parseInt(tokenData.tokenDecimal) || 18;
          const balanceFormatted = ethers.formatUnits(balance, decimals);

          tokenMap.set(tokenAddress, {
            address: tokenAddress,
            symbol: tokenData.tokenSymbol || "UNKNOWN",
            name: tokenData.tokenName || "Unknown Token",
            decimals,
            balance,
            balanceFormatted,
            valueUSD: 0,
            isDust: false,
          });
        } catch {
          // ignore malformed entries
        }
      }
    } catch (error) {
      console.error("Error fetching from tokenlist API:", error);
    }
  }

  /**
   * Key improvement:
   * - Pages through tokentx until exhausted (or until maxPages)
   * - Collects unique token contracts from *all* pages
   * - Then balance-checks and metadata-fetches with concurrency limits
   */
  private async discoverFromTokenTransfersPaged(
    userAddress: string,
    tokenMap: Map<string, TokenInfo>
  ): Promise<void> {
    console.log("📜 Fetching from token transfer history (paged)...");

    const uniqueTokens = new Set<string>();

    // tune these
    const pageSize = 1000;
    const maxPages = 20; // prevents infinite/rate-limit spirals; raise if you want deeper history
    let page = 1;

    while (page <= maxPages) {
      const url =
        `https://api.basescan.org/api?module=account&action=tokentx` +
        `&address=${userAddress}&startblock=0&endblock=99999999&sort=desc` +
        `&page=${page}&offset=${pageSize}&apikey=${this.basescanApiKey}`;

      try {
        const resp = await fetch(url);
        const data = (await resp.json()) as BasescanResponse<any[]>;

        if (data.status !== "1" || !Array.isArray(data.result) || data.result.length === 0) {
          console.log(`tokentx: no more results at page ${page}`);
          break;
        }

        console.log(`tokentx: page ${page} -> ${data.result.length} transfers`);

        for (const tx of data.result) {
          if (tx.contractAddress) uniqueTokens.add(this.normalize(tx.contractAddress));
        }

        // If the page returned fewer than pageSize, we likely reached the end
        if (data.result.length < pageSize) break;

        page += 1;

        // small delay to avoid hammering Basescan
        await this.sleep(150);
      } catch (e) {
        console.warn(`tokentx: error on page ${page}, stopping paging`, e);
        break;
      }
    }

    console.log(`tokentx: Found ${uniqueTokens.size} unique token contracts from transfers`);

    // Only check those not already known
    const tokensToCheck = Array.from(uniqueTokens).filter((a) => !tokenMap.has(a));

    // Balance + metadata can be expensive -> limit concurrency
    const concurrency = 8;

    await this.mapWithConcurrency(tokensToCheck, concurrency, async (tokenAddress) => {
      try {
        const balance = await this.getTokenBalance(tokenAddress, userAddress);
        if (balance === "0" || BigInt(balance) === 0n) return;

        const meta = await this.getTokenMetadata(tokenAddress);
        const balanceFormatted = ethers.formatUnits(balance, meta.decimals);

        tokenMap.set(tokenAddress, {
          address: tokenAddress,
          symbol: meta.symbol,
          name: meta.name,
          decimals: meta.decimals,
          balance,
          balanceFormatted,
          valueUSD: 0,
          isDust: false,
        });
      } catch {
        // skip
      }
    });
  }

  private async discoverPopularTokens(
    userAddress: string,
    tokenMap: Map<string, TokenInfo>
  ): Promise<void> {
    console.log("🌟 Checking popular Base tokens...");

    const popularTokens = [
      { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6 },
      { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
      { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", symbol: "USDbC", name: "USD Base Coin", decimals: 6 },
      { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
      { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", symbol: "AERO", name: "Aerodrome", decimals: 18 },
      { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", symbol: "cbETH", name: "Coinbase Wrapped ETH", decimals: 18 },
    ];

    for (const token of popularTokens) {
      const address = this.normalize(token.address);
      if (tokenMap.has(address)) continue;

      try {
        const balance = await this.getTokenBalance(address, userAddress);
        if (balance !== "0" && BigInt(balance) > 0n) {
          tokenMap.set(address, {
            address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            balance,
            balanceFormatted: ethers.formatUnits(balance, token.decimals),
            valueUSD: 0,
            isDust: false,
          });
        }
      } catch {
        // skip
      }
    }
  }

  private async addEthBalance(
    userAddress: string,
    tokenMap: Map<string, TokenInfo>
  ): Promise<void> {
    try {
      const ethBalance = await this.provider.getBalance(userAddress);
      if (ethBalance > 0n) {
        tokenMap.set(ethers.ZeroAddress, {
          address: ethers.ZeroAddress,
          symbol: "ETH",
          name: "Ethereum",
          decimals: 18,
          balance: ethBalance.toString(),
          balanceFormatted: ethers.formatEther(ethBalance),
          valueUSD: 0,
          isDust: false,
        });
      }
    } catch (error) {
      console.error("Error fetching ETH balance:", error);
    }
  }

  async getETHBalance(userAddress: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(userAddress);
      return ethers.formatEther(balance);
    } catch {
      return "0";
    }
  }
}
