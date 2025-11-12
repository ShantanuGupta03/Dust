import React from 'react';
import { DustThresholds } from '../types/token';
import { Settings, DollarSign, Coins } from 'lucide-react';

interface ThresholdSettingsProps {
  thresholds: DustThresholds;
  onThresholdChange: (thresholds: Partial<DustThresholds>) => void;
}

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
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center mb-4">
        <Settings className="w-5 h-5 mr-2" />
        <h3 className="text-lg font-semibold">Dust Threshold Settings</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            <Coins className="w-4 h-4 inline mr-1" />
            ETH Threshold
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={thresholds.eth}
            onChange={(e) => handleETHChange(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="0.001"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Tokens below this ETH value are considered dust
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            <DollarSign className="w-4 h-4 inline mr-1" />
            USD Threshold
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={thresholds.usd}
            onChange={(e) => handleUSDChange(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="5.00"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Tokens below this USD value are considered dust
          </p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-muted rounded-md">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> A token is considered "dust" if it meets either threshold condition.
          Adjust these values to customize what tokens you want to aggregate.
        </p>
      </div>
    </div>
  );
};

export default ThresholdSettings;
