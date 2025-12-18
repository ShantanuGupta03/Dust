/**
 * Parses and simplifies error messages for better UX
 */
export function parseErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message;

    // User rejected transaction
    if (message.includes('User rejected') || message.includes('user rejected') || message.includes('User denied')) {
      return 'Transaction was cancelled. Please try again when ready.';
    }

    // Network errors
    if (message.includes('network') || message.includes('Network')) {
      return 'Network error. Please check your connection and try again.';
    }

    // Gas errors
    if (message.includes('gas') || message.includes('Gas')) {
      return 'Insufficient gas. Please ensure you have enough ETH for gas fees.';
    }

    // Revert errors
    if (message.includes('revert') || message.includes('execution reverted')) {
      if (message.includes('insufficient funds') || message.includes('Insufficient')) {
        return 'Insufficient funds for this transaction.';
      }
      if (message.includes('allowance') || message.includes('Allowance')) {
        return 'Token approval failed. Please try approving again.';
      }
      return 'Transaction failed. Please try again or check if you have sufficient balance.';
    }

    // CORS errors
    if (message.includes('CORS') || message.includes('cors')) {
      return 'Network request failed. Please try again.';
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('Timeout')) {
      return 'Request timed out. Please try again.';
    }

    // Liquidity errors
    if (message.includes('liquidity') || message.includes('Liquidity') || message.includes('No liquidity')) {
      return 'No liquidity available for this token pair.';
    }

    // If it's a very long error (likely JSON dump), extract key info
    if (message.length > 200) {
      // Try to extract meaningful parts
      if (message.includes('reason')) {
        const reasonMatch = message.match(/reason[:\s]+([^,\n}]+)/i);
        if (reasonMatch) {
          return `Transaction failed: ${reasonMatch[1].trim()}`;
        }
      }
      if (message.includes('code')) {
        const codeMatch = message.match(/code[:\s]+([^,\n}]+)/i);
        if (codeMatch && !codeMatch[1].includes('{')) {
          return `Error: ${codeMatch[1].trim()}`;
        }
      }
      // Fallback for long errors
      return 'Transaction failed. Please check your wallet and try again.';
    }

    // Return the error message if it's reasonable length
    return message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    if (error.length > 200) {
      return 'An error occurred. Please try again.';
    }
    return error;
  }

  // Handle objects with message property
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      return parseErrorMessage(obj.message);
    }
    if (typeof obj.error === 'string') {
      return parseErrorMessage(obj.error);
    }
    if (typeof obj.reason === 'string') {
      return parseErrorMessage(obj.reason);
    }
  }

  return 'An unknown error occurred. Please try again.';
}

