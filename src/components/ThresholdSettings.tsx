import React from 'react';
import { DustThresholds } from '../types/token';

interface ThresholdSettingsProps {
  thresholds: DustThresholds;
  onThresholdChange: (thresholds: Partial<DustThresholds>) => void;
}

// Icons
const SettingsIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EthIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
  </svg>
);

const DollarIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ThresholdSettings: React.FC<ThresholdSettingsProps> = ({
  thresholds,
  onThresholdChange,
}) => {
  const handleETHChange = (value: string) => {
    const ethValue = parseFloat(value) || 0;
    onThresholdChange({ eth: ethValue });
  };

  const handleUSDChange = (value: string) => {
    const usdValue = parseFloat(value) || 0;
    onThresholdChange({ usd: usdValue });
  };

  return (
    <div className="dust-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[var(--dust-sapphire)]/20 flex items-center justify-center text-[var(--dust-sapphire)]">
          <SettingsIcon />
        </div>
        <div>
          <h3 className="dust-heading-md">Dust Thresholds</h3>
          <p className="text-dust-muted text-sm">Configure what counts as dust</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ETH Threshold */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-dust-primary mb-3">
            <span className="text-dust-secondary">
              <EthIcon />
            </span>
            ETH Threshold
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.001"
              min="0"
              value={thresholds.eth}
              onChange={(e) => handleETHChange(e.target.value)}
              className="dust-input pr-16"
              placeholder="0.001"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dust-muted font-mono text-sm">
              ETH
            </span>
          </div>
          <p className="text-xs text-dust-muted mt-2">
            Tokens below this ETH value are dust
          </p>
        </div>

        {/* USD Threshold */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-dust-primary mb-3">
            <span className="text-[var(--dust-emerald)]">
              <DollarIcon />
            </span>
            USD Threshold
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dust-muted font-mono">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={thresholds.usd}
              onChange={(e) => handleUSDChange(e.target.value)}
              className="dust-input pl-8"
              placeholder="5.00"
            />
          </div>
          <p className="text-xs text-dust-muted mt-2">
            Tokens below this USD value are dust
          </p>
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-6 p-4 rounded-xl bg-[var(--dust-gold-500)]/10 border border-[var(--dust-gold-500)]/20">
        <p className="text-sm text-dust-secondary">
          <span className="text-[var(--dust-gold-400)] font-semibold">Note:</span> A token is considered "dust" if it meets <span className="text-dust-primary font-medium">either</span> threshold condition. Adjust these values to customize what tokens you want to aggregate.
        </p>
      </div>
    </div>
  );
};

export default ThresholdSettings;
