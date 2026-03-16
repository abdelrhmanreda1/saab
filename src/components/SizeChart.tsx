'use client';

import React, { useState, useEffect } from 'react';
import { getSizeChart } from '@/lib/firestore/product_features_db';
import { SizeChart as SizeChartType } from '@/lib/firestore/product_features';

interface SizeChartProps {
  productId: string;
}

const SizeChart: React.FC<SizeChartProps> = ({ productId }) => {
  const [chart, setChart] = useState<SizeChartType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchChart = async () => {
      try {
        const sizeChart = await getSizeChart(productId);
        setChart(sizeChart);
      } catch {
        // Failed to fetch size chart
      } finally {
        setLoading(false);
      }
    };
    fetchChart();
  }, [productId]);

  if (loading || !chart) return null;

  const measurementKeys = chart.measurements.length > 0 
    ? Object.keys(chart.measurements[0]).filter(key => key !== 'size')
    : [];

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
      >
        Size Chart
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Size Chart</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>

            {chart.notes && (
              <p className="text-gray-600 mb-4">{chart.notes}</p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Size</th>
                    {measurementKeys.map(key => (
                      <th key={key} className="border border-gray-300 px-4 py-2 text-left font-semibold capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()} ({chart.unit})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.measurements.map((measurement, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 font-medium">{measurement.size}</td>
                      {measurementKeys.map(key => (
                        <td key={key} className="border border-gray-300 px-4 py-2">
                          {measurement[key as keyof typeof measurement] != null 
                            ? String(measurement[key as keyof typeof measurement]) 
                            : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SizeChart;

