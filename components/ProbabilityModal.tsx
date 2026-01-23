import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentChance: number;
}

const ProbabilityModal: React.FC<Props> = ({ isOpen, onClose, currentChance }) => {
  if (!isOpen) return null;

  // Calculate data points for the graph
  // Showing Expected Flips vs Probability for a 10-streak
  const data = [];
  // Extended to 0.90 (90%) to match the upgrade cap
  for (let p = 0.20; p <= 0.90; p += 0.05) {
    // Formula for expected flips to get N consecutive successes: (1/p^N - 1) / (1-p) roughly, or simpler (p^-N - 1)/(1-p)
    // Actually for N=10, the exact formula E = (p^-n - 1) / (1-p)
    const prob = parseFloat(p.toFixed(2));
    const expectedFlips = (Math.pow(prob, -10) - 1) / (1 - prob);
    
    data.push({
      chance: `${(prob * 100).toFixed(0)}%`,
      flips: Math.round(expectedFlips),
      isCurrent: Math.abs(currentChance - prob) < 0.01
    });
  }

  const currentExpected = (Math.pow(currentChance, -10) - 1) / (1 - currentChance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-noir-900 border border-noir-700 w-full max-w-2xl shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-noir-500 hover:text-white"
        >
          <X size={24} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-mono font-bold text-white mb-2">The Mathematics of Despair</h2>
          <p className="text-noir-400 text-sm mb-6 font-mono">
            Why is 20% impossible? Because probability scales exponentially.
            <br/>
            Current Expectation: <span className="text-amber-500 font-bold">{Math.round(currentExpected).toLocaleString()}</span> flips for a 10-streak.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="chance" stroke="#666" />
                <YAxis 
                   stroke="#666" 
                   scale="log" 
                   domain={['auto', 'auto']}
                   tickFormatter={(val) => val > 1000000 ? `${(val/1000000).toFixed(0)}M` : val > 1000 ? `${(val/1000).toFixed(0)}k` : val}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: number) => [value.toLocaleString(), 'Expected Flips']}
                />
                <Line 
                  type="monotone" 
                  dataKey="flips" 
                  stroke="#fbbf24" 
                  strokeWidth={2}
                  dot={({ cx, cy, payload }) => (
                    <circle cx={cx} cy={cy} r={payload.isCurrent ? 6 : 4} fill={payload.isCurrent ? '#fbbf24' : '#666'} stroke="none" />
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 text-xs text-noir-500 font-mono border-t border-noir-800 pt-4">
            Analysis based on geometric distribution chains. Upgrading your probability is the only way to make this achievable in a human lifetime.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProbabilityModal;