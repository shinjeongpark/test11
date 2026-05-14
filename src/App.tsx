/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, BarChart3, Database, Info, Loader2, RefreshCw, Clock, ExternalLink, Zap, AlertTriangle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

interface HistoricalData {
  date: string;
  price: number;
  changePercent: number;
  volume: number;
  individualNetBuy: number;
  foreignerNetBuy: number;
  institutionalNetBuy: number;
  totalNetBuy: number;
  floatingMarketCap: number;
  supplyDemandRatio: number;
  isSweetSpot: boolean;
  ma48Target: number;
  ma20Target: number;
  isBuyPoint1: boolean;
  isBuyPoint2: boolean;
}

interface StockData {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  marketCap: number;
  floatShares: number;
  sharesOutstanding: number;
  currency: string;
  historicalData: HistoricalData[];
  indicators: {
    surge50: boolean;
    highVolume: boolean;
    consecutiveBullish: boolean;
    buyPoint1: boolean;
    buyPoint2: boolean;
    ma48: number;
    ma20: number;
  };
}

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stock, setStock] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [topStocks, setTopStocks] = useState<{ name: string; code: string }[]>([]);
  const [topStocksLoading, setTopStocksLoading] = useState(false);
  const [topStocksError, setTopStocksError] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchTopStocks();
    return () => clearInterval(timer);
  }, []);

  const fetchTopStocks = async () => {
    setTopStocksLoading(true);
    setTopStocksError(false);
    try {
      const response = await axios.get('/api/top-stocks');
      setTopStocks(response.data);
    } catch (err) {
      console.error('Failed to fetch top stocks:', err);
      setTopStocksError(true);
    } finally {
      setTopStocksLoading(false);
    }
  };

  const fetchStockData = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/stock/${code}`);
      if (response.data) {
        setStock(response.data);
      } else {
        setError('주식 정보를 찾을 수 없습니다.');
      }
    } catch (err: any) {
      setError('정보를 불러오는 중 오류가 발생했습니다. 종목 코드를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      fetchStockData(searchTerm.trim());
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const formatLargeNumber = (num: number) => {
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (absNum >= 1e12) return `${sign}${(absNum / 1e12).toFixed(2)}조`;
    if (absNum >= 1e8) return `${sign}${(absNum / 1e8).toFixed(2)}억`;
    if (absNum >= 1e4) return `${sign}${(absNum / 1e4).toFixed(2)}만`;
    return `${sign}${formatNumber(absNum)}`;
  };

  const getLatestData = () => {
    if (!stock || !stock.historicalData.length) return null;
    return stock.historicalData[0];
  };

  const latest = getLatestData();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans">
      <div className="flex-1 flex flex-col overflow-hidden border-[12px] border-slate-100 bg-white shadow-inner">
        {/* Header */}
        <header className="h-20 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 flex items-center justify-center shrink-0">
              <div className="w-5 h-5 border-2 border-white rotate-45"></div>
            </div>
            <span className="text-xl font-black tracking-tighter uppercase hidden md:block">KRX Insight Engine</span>
          </div>

          <div className="flex-1 max-w-lg mx-6 md:mx-12">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                placeholder="종목코드 입력 (예: 005930)..."
                className="w-full bg-slate-100 border-none px-4 py-2.5 focus:ring-2 ring-blue-600 outline-none text-sm transition-all rounded-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" className="absolute right-3 top-2 text-slate-400 group-focus-within:text-blue-600">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </form>
          </div>

          <div className="flex items-center space-x-6 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 shrink-0">
            <div className="hidden lg:flex items-center gap-2">
              <Clock className="w-3 h-3 text-blue-600" />
              <span>{currentTime.toLocaleTimeString('ko-KR')} KST</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-72 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 overflow-y-auto hidden md:flex">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Market Monitoring (Top 100)</h3>
              <div className="space-y-1">
                {topStocksLoading ? (
                  <div className="p-4 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                  </div>
                ) : topStocksError ? (
                  <div className="p-4 text-center">
                    <p className="text-[9px] font-black text-red-400 uppercase mb-2">Error Loading List</p>
                    <button 
                      onClick={fetchTopStocks}
                      className="text-[9px] font-black text-blue-600 uppercase underline hover:text-blue-800"
                    >
                      Retry
                    </button>
                  </div>
                ) : topStocks.length === 0 ? (
                  <div className="p-4 text-center text-[9px] font-black text-slate-400 uppercase">
                    No items found
                  </div>
                ) : (
                  topStocks.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => {
                        setSearchTerm(s.code);
                        fetchStockData(s.code);
                      }}
                      className={`w-full flex justify-between items-center p-3 transition-all border ${
                        searchTerm === s.code ? 'bg-white border-slate-300 shadow-sm' : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'
                      }`}
                    >
                      <span className="font-black text-[11px] uppercase tracking-tighter shrink-0">{s.code}</span>
                      <span className="text-[10px] text-slate-500 font-bold truncate ml-2 text-right">{s.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="p-6 flex-1 bg-gradient-to-b from-slate-50 to-slate-100">
              <div className="h-full border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-4 text-center">
                <div className="text-slate-300 mb-4 font-mono text-[10px] italic tracking-tighter uppercase font-bold">Historical Analysis</div>
                <div className="w-full bg-slate-200/50 mb-4 p-4 aspect-square flex items-center justify-center border border-slate-200">
                  <Calendar className="text-slate-400 w-12 h-12 opacity-10" />
                </div>
                <p className="text-[9px] text-slate-400 uppercase leading-relaxed font-black tracking-widest">
                  일자별 정밀 수급 분석을 통해<br />기관/외인 동향을 추적합니다.
                </p>
              </div>
            </div>
          </aside>

          {/* Content Area */}
          <section className="flex-1 flex flex-col overflow-y-auto bg-white relative">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rotate-45 animate-spin"></div>
                  <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">네이버 증권 데이터 기반 분석 중...</p>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 p-12"
                >
                  <div className="bg-red-50 border-t-4 border-red-600 p-8 shadow-sm">
                    <h2 className="text-lg font-black uppercase tracking-tighter text-red-600 mb-2">Analysis Error</h2>
                    <p className="text-slate-600 text-sm">{error}</p>
                  </div>
                </motion.div>
              ) : stock ? (
                <motion.div
                  key="data"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col"
                >
                  {/* Hero Stat Section */}
                  <div className="p-8 md:p-12 border-b border-slate-200">
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em]">
                            {stock.symbol.includes('.KS') ? 'KOSPI' : 'KOSDAQ'}
                          </span>
                          <span className="text-slate-400 font-mono text-xs uppercase tracking-tighter">{stock.symbol} / KR</span>
                        </div>
                        <h1 className="text-4xl md:text-7xl font-black tracking-tighter uppercase leading-none">
                          {stock.shortName} <span className="text-slate-200 block md:inline">TIMELINE</span>
                        </h1>
                      </div>
                      {latest && (
                        <div className="text-left lg:text-right w-full lg:w-auto">
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2 border-b border-slate-100 pb-1">LAST RECORDED SESSION ({latest.date})</div>
                          <div className={`text-5xl md:text-7xl font-mono font-light tracking-tighter italic ${latest.changePercent >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
                            {formatNumber(latest.price)} <span className="text-xl uppercase ml-1 font-black not-italic">{stock.currency}</span>
                          </div>
                          <div className={`mt-3 font-black text-sm uppercase tracking-widest flex items-center lg:justify-end gap-2 ${latest.changePercent >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
                            {latest.changePercent >= 0 ? '▲' : '▼'} {Math.abs(latest.changePercent).toFixed(2)}% SESSION CHANGE
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Technical Checkboxes */}
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      <div className={`p-4 border-2 flex items-center gap-4 transition-all ${stock.indicators.surge50 ? 'border-red-600 bg-red-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                        <div className={`w-10 h-10 shrink-0 border-2 flex items-center justify-center ${stock.indicators.surge50 ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 text-slate-300'}`}>
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">15거래일 50% 상승</p>
                          <p className={`text-[11px] font-black ${stock.indicators.surge50 ? 'text-red-600' : 'text-slate-400'}`}>
                            {stock.indicators.surge50 ? '포착 (SURGE)' : '미달 (STABLE)'}
                          </p>
                        </div>
                      </div>

                      <div className={`p-4 border-2 flex items-center gap-4 transition-all ${stock.indicators.highVolume ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                        <div className={`w-10 h-10 shrink-0 border-2 flex items-center justify-center ${stock.indicators.highVolume ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-300'}`}>
                          <RefreshCw className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">유통대비 거래량 100%</p>
                          <p className={`text-[11px] font-black ${stock.indicators.highVolume ? 'text-blue-600' : 'text-slate-400'}`}>
                            {stock.indicators.highVolume ? '대량거래 (TURNOVER)' : '보통 (NORMAL)'}
                          </p>
                        </div>
                      </div>

                      <div className={`p-4 border-2 flex items-center gap-4 transition-all ${stock.indicators.consecutiveBullish ? 'border-orange-600 bg-orange-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                        <div className={`w-10 h-10 shrink-0 border-2 flex items-center justify-center ${stock.indicators.consecutiveBullish ? 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300 text-slate-300'}`}>
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">5회 연속 양봉</p>
                          <p className={`text-[11px] font-black ${stock.indicators.consecutiveBullish ? 'text-orange-600' : 'text-slate-400'}`}>
                            {stock.indicators.consecutiveBullish ? '강세전환 (BULLISH)' : '혼조세 (MIXED)'}
                          </p>
                        </div>
                      </div>

                      <div className={`p-4 border-2 flex items-center gap-4 transition-all ${stock.indicators.buyPoint1 ? 'border-green-600 bg-green-50 shadow-lg' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                        <div className={`w-10 h-10 shrink-0 border-2 flex items-center justify-center ${stock.indicators.buyPoint1 ? 'border-green-600 bg-green-600 text-white animate-bounce' : 'border-slate-300 text-slate-300'}`}>
                          <Info className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">1차 매수타점 (MA48)</p>
                          <p className={`text-[11px] font-black ${stock.indicators.buyPoint1 ? 'text-green-600' : 'text-slate-400'}`}>
                            {stock.indicators.buyPoint1 ? '진입구간 (ENTRY)' : '대기중 (WAIT)'}
                          </p>
                          {stock.indicators.ma48 > 0 && <p className="text-[9px] font-mono text-slate-400">Target: {formatNumber(Math.round(stock.indicators.ma48))}</p>}
                        </div>
                      </div>

                      <div className={`p-4 border-2 flex items-center gap-4 transition-all ${stock.indicators.buyPoint2 ? 'border-purple-600 bg-purple-50 shadow-lg' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                        <div className={`w-10 h-10 shrink-0 border-2 flex items-center justify-center ${stock.indicators.buyPoint2 ? 'border-purple-600 bg-purple-600 text-white animate-bounce' : 'border-slate-300 text-slate-300'}`}>
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">2차 매수타점 (MA20-20%)</p>
                          <p className={`text-[11px] font-black ${stock.indicators.buyPoint2 ? 'text-purple-600' : 'text-slate-400'}`}>
                            {stock.indicators.buyPoint2 ? '강력매수 (STRONG)' : '관망중 (HOLD)'}
                          </p>
                          {stock.indicators.ma20 > 0 && <p className="text-[9px] font-mono text-slate-400">Target: {formatNumber(Math.round(stock.indicators.ma20 * 0.8))}</p>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Historical Table Section */}
                  <div className="p-8 md:p-12 bg-slate-50">
                    <div className="flex justify-between items-end mb-8">
                      <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em]">Historical Multi-Agent Flow Analysis</h2>
                      <div className="h-0.5 flex-1 bg-slate-200 ml-12 mb-1.5"></div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[1200px]">
                        <thead>
                          <tr className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-300">
                            <th className="pb-4 w-28">일자</th>
                            <th className="pb-4 w-32">종가</th>
                            <th className="pb-4 w-24">등락률</th>
                            <th className="pb-4 w-32">거래량</th>
                            <th className="pb-4">순매수액 (개인)</th>
                            <th className="pb-4">순매수액 (외국인)</th>
                            <th className="pb-4">순매수액 (기관)</th>
                            <th className="pb-4">유통 시가총액</th>
                            <th className="pb-4 w-24">수급상황</th>
                            <th className="pb-4 w-28">수급맥점</th>
                            <th className="pb-4 w-28">1차 매수타점</th>
                            <th className="pb-4 w-28 text-right">2차 매수타점</th>
                          </tr>
                        </thead>
                        <tbody className="text-[13px]">
                          {stock.historicalData.map((day, idx) => (
                            <tr key={day.date} className={`border-b border-slate-200 hover:bg-white transition-colors ${idx === 0 ? 'bg-blue-50/30' : ''}`}>
                              <td className="py-4 font-bold text-slate-700">{day.date}</td>
                              <td className="py-4 font-mono font-bold">{formatNumber(day.price)}</td>
                              <td className={`py-4 font-mono font-black ${day.changePercent >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
                                {day.changePercent > 0 ? '+' : ''}{day.changePercent.toFixed(2)}%
                              </td>
                              <td className="py-4 font-mono text-slate-500">{formatNumber(day.volume)}</td>
                              <td className={`py-4 font-mono font-medium ${day.individualNetBuy >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                {formatLargeNumber(day.individualNetBuy)}
                              </td>
                              <td className={`py-4 font-mono font-bold ${day.foreignerNetBuy >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                {formatLargeNumber(day.foreignerNetBuy)}
                              </td>
                              <td className={`py-4 font-mono font-bold ${day.institutionalNetBuy >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                {formatLargeNumber(day.institutionalNetBuy)}
                              </td>
                              <td className="py-4 font-mono font-medium text-slate-400">{formatLargeNumber(day.floatingMarketCap)}</td>
                              <td className={`py-4 font-mono font-black ${day.supplyDemandRatio >= 0.3 ? 'text-blue-600' : 'text-slate-900'}`}>
                                {day.supplyDemandRatio.toFixed(3)}%
                              </td>
                              <td className="py-4">
                                {day.isSweetSpot ? (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-tighter shadow-sm animate-pulse">
                                    <Zap className="w-2.5 h-2.5 fill-white" />
                                    SWEET SPOT
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-300 font-bold uppercase">Neutral</span>
                                )}
                              </td>
                              <td className="py-4">
                                {day.isBuyPoint1 ? (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-600 text-white text-[9px] font-black uppercase tracking-tighter shadow-sm">
                                    <Info className="w-2.5 h-2.5" />
                                    ENTRY
                                  </div>
                                ) : (
                                  day.ma48Target > 0 && <span className="text-[10px] text-slate-300 font-mono italic">{formatNumber(Math.round(day.ma48Target))}</span>
                                )}
                              </td>
                              <td className="py-4 text-right">
                                {day.isBuyPoint2 ? (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-600 text-white text-[9px] font-black uppercase tracking-tighter shadow-sm">
                                    <BarChart3 className="w-2.5 h-2.5" />
                                    STRONG
                                  </div>
                                ) : (
                                  day.ma20Target > 0 && <span className="text-[10px] text-slate-300 font-mono italic">{formatNumber(Math.round(day.ma20Target))}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-12 bg-slate-900 p-10 flex flex-col md:flex-row justify-between items-center gap-8">
                       <div className="space-y-2">
                          <h4 className="text-white font-black uppercase tracking-[0.2em] text-xs">Analysis Engine Methodology</h4>
                          <p className="text-slate-500 text-[10px] font-bold uppercase leading-relaxed max-w-xl">
                            수급맥점 산치: (외국인 순매수 수량 + 기관 순매수 수량) / 유통 주식수 ≥ 0.3%.<br />
                            본 지표는 특정 세력의 집중적인 유입 여부를 판단하기 위한 보조 지표로 활용됩니다.
                          </p>
                       </div>
                       <div className="flex gap-4">
                          <div className="px-6 py-3 border border-slate-700 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                             Float Ratio: {(stock.floatShares / stock.sharesOutstanding * 100).toFixed(1)}%
                          </div>
                       </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="w-24 h-24 bg-slate-100 border-4 border-slate-200 rotate-45 flex items-center justify-center mb-10 overflow-hidden group">
                    <Database className="text-slate-300 w-10 h-10 -rotate-45 group-hover:scale-125 transition-transform duration-700" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-4 whitespace-pre-line leading-none">
                    HISTORICAL ENGINE<br />READY FOR TASK
                  </h3>
                  <p className="text-slate-400 text-[11px] uppercase font-black tracking-[0.3em] max-w-xs leading-loose">
                    종목 코드를 입력하여 일자별<br />
                    수급 및 맥점 패턴 분석을 시작하십시오.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </main>

        {/* Footer */}
        <footer className="h-14 bg-slate-900 text-white flex items-center justify-between px-8 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] shrink-0">
          <div className="flex space-x-12 items-center">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              SYSTEM STATUS: NOMINAL
            </span>
            <span className="text-slate-600 hidden xl:inline">VERIFIED HISTORICAL DATA STREAM</span>
          </div>
          <div className="flex items-center gap-6">
             <span className="font-black">© 2024 KRX INSIGHTS ENGINE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
