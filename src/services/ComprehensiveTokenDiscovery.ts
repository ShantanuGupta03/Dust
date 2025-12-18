import { ethers } from "ethers";
import { TokenInfo, TokenMetadata } from "../types/token";

export class ComprehensiveTokenDiscovery {
  private provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string = "https://mainnet.base.org") {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  // Get token metadata (for custom tokens)
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
    if (tokenAddress === ethers.ZeroAddress) {
      return { name: "Ethereum", symbol: "ETH", decimals: 18 };
    }

    try {
      // Try to fetch from Alchemy API via serverless proxy
      const url = `/api/alchemy-token-balances?address=${tokenAddress}`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        // If we get metadata, use it (though this endpoint is for balances, not single token metadata)
        // For now, fall back to ERC20 contract calls
      }
    } catch (error) {
      console.error("Error fetching metadata from Alchemy:", error);
    }

    // Fallback: Fetch from ERC20 contract
    try {
      const erc20Abi = [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
      ];
      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => "Unknown Token"),
        contract.symbol().catch(() => "UNKNOWN"),
        contract.decimals().catch(() => 18),
      ]);
      return { name, symbol, decimals: Number(decimals) };
    } catch (error) {
      console.error(`Error fetching metadata for ${tokenAddress}:`, error);
      return { name: "Unknown Token", symbol: "UNKNOWN", decimals: 18 };
    }
  }

  async discoverAllTokens(userAddress: string): Promise<TokenInfo[]> {
    console.log("🔍 Discovering ERC20 balances via Alchemy…");

    const tokenMap = new Map<string, TokenInfo>();

    // 1) ERC20s from Alchemy (server-side proxy)
    const url = `/api/alchemy-token-balances?address=${userAddress}`;
    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text();
      console.error("Alchemy proxy failed:", r.status, txt);
      // still return ETH if available
    } else {
      const data = await r.json();
      const tokens: TokenInfo[] = data.tokens || [];
      for (const t of tokens) {
        tokenMap.set(t.address.toLowerCase(), t);
      }
      console.log(`✅ Alchemy returned ${tokens.length} ERC20 tokens`);
    }

    // 2) Add ETH balance
    await this.addEthBalance(userAddress, tokenMap);

    const tokens = Array.from(tokenMap.values());
    console.log(`✅ Total discovered (ERC20 + ETH): ${tokens.length}`);
    return tokens;
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

  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    if (tokenAddress === ethers.ZeroAddress) {
      return this.getETHBalance(userAddress);
    }

    try {
      const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const balance = await contract.balanceOf(userAddress);
      return balance.toString();
    } catch (error) {
      console.error(`Error fetching balance for ${tokenAddress}:`, error);
      return "0";
    }
  }
}
