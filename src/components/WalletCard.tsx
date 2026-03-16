'use client';

import React, { useState, useEffect } from 'react';
import { redeemLoyaltyPoints } from '@/lib/firestore/users';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings } from '@/lib/firestore/settings';
import { useCurrency } from '@/context/CurrencyContext';

interface WalletCardProps {
    uid: string;
    walletBalance: number;
    loyaltyPoints: number;
    onUpdate: () => void; // Callback to refresh user data after conversion
}

const WalletCard: React.FC<WalletCardProps> = ({ uid, walletBalance, loyaltyPoints, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [pointsToConvert, setPointsToConvert] = useState<number | ''>('');
    const [settings, setSettings] = useState<Settings | null>(null);
    const { formatPrice } = useCurrency();
    
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const fetchedSettings = await getSettings();
                setSettings(fetchedSettings);
            } catch {
                // Failed to load settings
            }
        };
        loadSettings();
    }, []);
    
    // Don't show if both wallet and loyalty are disabled
    if (!settings?.payment?.enableWallet && !settings?.payment?.enableLoyaltyPoint) {
        return null;
    }
    
    // Conversion rate from settings
    const CONVERSION_RATE = settings?.payment?.loyaltyPointValue || 1; 

    const handleConvert = async () => {
        if (!pointsToConvert || pointsToConvert <= 0) {
            setMessage("Please enter valid points.");
            return;
        }
        
        if (pointsToConvert > loyaltyPoints) {
            setMessage("Insufficient loyalty points.");
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const addedAmount = await redeemLoyaltyPoints(uid, Number(pointsToConvert), CONVERSION_RATE);
            setMessage(`Successfully converted ${pointsToConvert} points to ${formatPrice(addedAmount)}!`);
            setPointsToConvert('');
            onUpdate();
        } catch {
                // Failed to convert points
            setMessage("Failed to convert points. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-r from-gray-900 to-black text-white p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-heading font-bold mb-1">My Wallet</h2>
                    <p className="text-gray-400 text-sm">Use balance for shopping</p>
                </div>
                <div className="bg-white/10 p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
                    </svg>
                </div>
            </div>

            <div className={`grid gap-4 mb-6 ${settings?.payment?.enableWallet && settings?.payment?.enableLoyaltyPoint ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {settings?.payment?.enableWallet && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Balance</p>
                        <p className="text-2xl font-bold">{formatPrice(walletBalance)}</p>
                    </div>
                )}
                {settings?.payment?.enableLoyaltyPoint && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Loyalty Points</p>
                        <p className="text-2xl font-bold text-yellow-400 flex items-center gap-1">
                            {loyaltyPoints}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                            </svg>
                        </p>
                    </div>
                )}
            </div>

            {settings?.payment?.enableLoyaltyPoint && (
                <div className="space-y-3">
                    <h3 className="font-medium text-sm">Convert Points to Cash</h3>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            value={pointsToConvert}
                            onChange={(e) => setPointsToConvert(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Points"
                            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white"
                            min="1"
                            max={loyaltyPoints}
                        />
                        <button 
                            onClick={handleConvert}
                            disabled={loading || !pointsToConvert || Number(pointsToConvert) <= 0}
                            className="bg-white text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Processing...' : 'Redeem'}
                        </button>
                    </div>
                    {message && (
                        <p className={`text-xs ${message.includes('Success') ? 'text-green-400' : 'text-red-400'}`}>
                            {message}
                        </p>
                    )}
                    <p className="text-xs text-gray-500">Rate: 1 Point = {formatPrice(CONVERSION_RATE)}</p>
                </div>
            )}
        </div>
    );
};

export default WalletCard;
