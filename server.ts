import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import YahooFinance from 'yahoo-finance2';
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

// Initialize Yahoo Finance instance correctly
// Handling both direct class import and default property wrap for ESM/CJS compatibility
const yf = new (typeof YahooFinance === 'function' ? YahooFinance : (YahooFinance as any).default)();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch stock data
  app.get("/api/stock/:symbol", async (req, res) => {
    const { symbol } = req.params;
    try {
      const code = symbol.split('.')[0];
      let targetSymbol = symbol;
      if (!symbol.includes('.')) {
        targetSymbol = `${symbol}.KS`;
      }

      // 1. Fetch data from Yahoo Finance
      let quote;
      let summary;
      
      const tryFetch = async (sym: string) => {
        const q = await yf.quote(sym);
        let s = null;
        try {
          s = await yf.quoteSummary(sym, { modules: ['defaultKeyStatistics'] });
        } catch (sumErr) {
          console.warn(`Summary fetch failed for ${sym}, continuing with quote only.`);
        }
        return { q, s };
      };

      try {
        const result = await tryFetch(targetSymbol);
        quote = result.q;
        summary = result.s;
      } catch (e) {
        // Try KQ if KS failed and no dot was provided
        if (!symbol.includes('.') && targetSymbol.endsWith('.KS')) {
          try {
            targetSymbol = `${code}.KQ`;
            const result = await tryFetch(targetSymbol);
            quote = result.q;
            summary = result.s;
          } catch (e2) {
            throw e; // Throw original error if both failed
          }
        } else {
          throw e;
        }
      }

      // 2. Fetch investor data from Naver Finance (Scraping)
      let historicalData: any[] = [];
      const floatShares = summary?.defaultKeyStatistics?.floatShares || quote.sharesOutstanding || 0;
      
      // 3. Fetch OHLC data for technical analysis
      let indicators = {
        surge50: false,
        highVolume: false,
        consecutiveBullish: false,
        buyPoint1: false, // Close to MA48
        buyPoint2: false, // Close to MA20 - 20%
        ma48: 0,
        ma20: 0
      };

      try {
        // Fetch multiple pages to get at least 48 days of history
        for (let page = 1; page <= 3; page++) {
          const naverUrl = `https://finance.naver.com/item/frgn.naver?code=${code}&page=${page}`;
          const naverRes = await axios.get(naverUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Referer': `https://finance.naver.com/item/main.naver?code=${code}`
            },
            responseType: 'arraybuffer'
          });
          const decodedNaverBody = iconv.decode(Buffer.from(naverRes.data), 'euc-kr');
          const $ = cheerio.load(decodedNaverBody);
          
          $('table.type2 tbody tr').each((i, el) => {
            const date = $(el).find('td:nth-child(1)').text().trim();
            if (!date || !/^\d{4}\.\d{2}\.\d{2}$/.test(date)) return;

            const price = parseInt($(el).find('td:nth-child(2)').text().replace(/,/g, '')) || 0;
            const changePercent = $(el).find('td:nth-child(4) span').text().trim().replace(/%/g, '');
            const volume = parseInt($(el).find('td:nth-child(5)').text().replace(/,/g, '')) || 0;
            const institutionalNetBuyVol = parseInt($(el).find('td:nth-child(6)').text().replace(/,/g, '')) || 0;
            const foreignerNetBuyVol = parseInt($(el).find('td:nth-child(7)').text().replace(/,/g, '')) || 0;

            // Estimating Individual
            const individualNetBuyVol = -(institutionalNetBuyVol + foreignerNetBuyVol);
            const totalNetBuyVol = foreignerNetBuyVol + institutionalNetBuyVol;
            const floatingMarketCap = floatShares * price;
            const supplyDemandRatio = floatShares > 0 ? (totalNetBuyVol / floatShares) * 100 : 0;

            historicalData.push({
              date,
              price,
              changePercent: parseFloat(changePercent) || 0,
              volume,
              individualNetBuy: individualNetBuyVol * price,
              foreignerNetBuy: foreignerNetBuyVol * price,
              institutionalNetBuy: institutionalNetBuyVol * price,
              totalNetBuy: totalNetBuyVol * price,
              floatingMarketCap,
              supplyDemandRatio,
              isSweetSpot: supplyDemandRatio >= 0.3
            });
          });
        }

        // Limit to 48 days
        historicalData = historicalData.slice(0, 48);

        // Technical Logic Calculations
        if (historicalData.length >= 15) {
          const latestPrice = historicalData[0].price;
          const price15DaysAgo = historicalData[14].price;
          if (price15DaysAgo > 0) {
            indicators.surge50 = (latestPrice / price15DaysAgo) >= 1.5;
          }
        }

        if (historicalData.length > 0 && floatShares > 0) {
          indicators.highVolume = historicalData[0].volume >= floatShares;
        }

        // Fetch longer history for MA calculations (Need at least 48 days)
        try {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 4); // Fetch 4 months to be safe
          const chartData = (await yf.chart(targetSymbol, { period1: threeMonthsAgo, interval: '1d' })) as any;
          
          if (chartData && chartData.quotes && chartData.quotes.length > 0) {
            const quotes = chartData.quotes.filter((q: any) => q.close !== undefined);
            const latestPrice = quotes[quotes.length - 1].close;

            // Consecutive Bullish (last 5)
            if (quotes.length >= 5) {
              const last5 = quotes.slice(-5);
              indicators.consecutiveBullish = last5.every((q: any) => q.close > q.open);
            }

            // MA Calculations
            if (quotes.length >= 20) {
              const ma20 = quotes.slice(-20).reduce((acc: number, q: any) => acc + q.close, 0) / 20;
              indicators.ma20 = ma20;
              
              const target2 = ma20 * 0.8;
              if (Math.abs(latestPrice - target2) / target2 <= 0.05) {
                indicators.buyPoint2 = true;
              }
            }

            if (quotes.length >= 48) {
              const ma48 = quotes.slice(-48).reduce((acc: number, q: any) => acc + q.close, 0) / 48;
              indicators.ma48 = ma48;

              if (Math.abs(latestPrice - ma48) / ma48 <= 0.03) {
                indicators.buyPoint1 = true;
              }
            }

            // Map MA targets back to historicalData rows
            historicalData = historicalData.map(row => {
              const rowDate = new Date(row.date.replace(/\./g, '-'));
              rowDate.setHours(0, 0, 0, 0);

              // Find index of this date in quotes
              const quoteIdx = quotes.findIndex(q => {
                const qDate = new Date(q.date);
                qDate.setHours(0, 0, 0, 0);
                return qDate.getTime() === rowDate.getTime();
              });

              let ma48Target = 0;
              let ma20Target = 0;
              let isBuyPoint1 = false;
              let isBuyPoint2 = false;

              if (quoteIdx !== -1) {
                // MA48 at that time
                if (quoteIdx >= 47) {
                  const slice = quotes.slice(quoteIdx - 47, quoteIdx + 1);
                  ma48Target = slice.reduce((acc: number, q: any) => acc + q.close, 0) / 48;
                  if (Math.abs(row.price - ma48Target) / ma48Target <= 0.03) isBuyPoint1 = true;
                }
                // MA20 at that time
                if (quoteIdx >= 19) {
                  const slice = quotes.slice(quoteIdx - 19, quoteIdx + 1);
                  const ma20Val = slice.reduce((acc: number, q: any) => acc + q.close, 0) / 20;
                  ma20Target = ma20Val * 0.8;
                  if (Math.abs(row.price - ma20Target) / ma20Target <= 0.05) isBuyPoint2 = true;
                }
              }

              return { ...row, ma48Target, ma20Target, isBuyPoint1, isBuyPoint2 };
            });
          }
        } catch (chartErr) {
          console.error('Yahoo Finance Chart error:', chartErr);
        }

      } catch (scrapErr) {
        console.error('Naver scraping error:', scrapErr);
      }

      const combinedData = {
        ...quote,
        floatShares,
        historicalData,
        indicators
      };

      res.json(combinedData);
    } catch (error: any) {
      console.error(`Error fetching stock ${symbol}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Search helper
  app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    try {
      const results = await yf.search(q as string);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Top 100 Stocks from Naver Finance
  app.get("/api/top-stocks", async (req, res) => {
    try {
      const topStocks: { name: string, code: string }[] = [];
      const etfProviders = [
        'KODEX', 'TIGER', 'ACE', 'KBSTAR', 'HANARO', 'SOL', 'KOSEF', 'ARIRANG', 
        'WOORI', 'TIMEFOLIO', 'PLUS', 'KINDEX', 'RISE', 'TREX', '파워', '마이티'
      ];
      
      // Fetch more pages as we'll be filtering out ETFs
      for (let page = 1; page <= 4; page++) {
        const url = `https://finance.naver.com/sise/sise_market_sum.naver?&page=${page}`;
        const response = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          responseType: 'arraybuffer'
        });
        
        const decodedBody = iconv.decode(Buffer.from(response.data), 'euc-kr');
        const $ = cheerio.load(decodedBody);
        
        $('table.type_2 tbody tr').each((i, el) => {
          const nameLink = $(el).find('a.tltle');
          if (nameLink.length) {
            const name = nameLink.text().trim();
            const href = nameLink.attr('href') || '';
            const codeMatch = href.match(/code=(\d+)/);
            
            if (codeMatch) {
              const code = codeMatch[1];
              // ETF Filtering
              const isETF = etfProviders.some(p => name.toUpperCase().includes(p.toUpperCase()));
              if (!isETF) {
                topStocks.push({ name, code });
              }
            }
          }
        });
        if (topStocks.length >= 100) break;
      }
      
      res.json(topStocks.slice(0, 100));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
