export async function getPrices(chainId: number, tokens: string[]) {
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/prices`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chainId, tokens }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Prices failed');
  const json = await res.json();
  return (json.prices || {}) as Record<string, number>;
}

export async function getQuote(input: {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  takerAddress: string;
}) {
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/quote`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Quote failed');
  const json = await res.json();
  return json.quote as {
    to: string;
    data: string;
    value: string;
    allowanceTarget?: string;
    buyAmount: string;
    sellAmount: string;
    price: string;
  };
}
