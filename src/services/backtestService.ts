// services/backtestService.ts
import {
  INDEX_NAME,
  SL_PERCENT,
  PNL_TARGET_PERCENT,
  PNL_SL_PERCENT,
  ENTRY_TIME,
  ADJUSTMENT_TIME,
  EXIT_TIME,
} from "../config/constants";
import { DataService } from "./dataService";
import {
  BacktestResult,
  OptionData,
  Position,
  TradeDay,
} from "../models/types";
import { TopicService } from "./topicService";
import * as timeUtils from "../utils/timeUtils";

export class BacktestService {
  private dataService: DataService;
  private topicService: TopicService;
  private lotSize: number;

  constructor() {
    this.dataService = new DataService();
    this.topicService = new TopicService();
    this.lotSize = this.topicService.getLotSize(INDEX_NAME); // Retrieve lot size based on index
  }

  /**
   * Runs the backtest for the specified number of trading days.
   * @param days Array of trading days in 'YYYY-MM-DD' format.
   * @returns BacktestResult containing daily results and overall statistics.
   */
  async runBacktest(days: string[]): Promise<BacktestResult> {
    const result: BacktestResult = {
      days: [],
      totalPnl: 0,
      winningDays: 0,
      losingDays: 0,
      winRate: 0,
      averageDailyPnl: 0,
    };

    for (const date of days) {
      const tradeDay = await this.processTradingDay(date);
      result.days.push(tradeDay);
      result.totalPnl += tradeDay.totalPnl;

      if (tradeDay.totalPnl >= 0) {
        result.winningDays++;
      } else {
        result.losingDays++;
      }
    }

    const numDays = result.days.length;
    result.winRate = (result.winningDays / numDays) * 100;
    result.averageDailyPnl = result.totalPnl / numDays;

    return result;
  }

  /**
   * Processes a single trading day, executing the strategy and calculating P&L.
   * @param date The trading day in 'YYYY-MM-DD' format.
   * @returns TradeDay object with daily results.
   */
  private async processTradingDay(date: string): Promise<TradeDay> {
    const atmStrike = await this.dataService.getATMStrike(date, ENTRY_TIME);

    console.log("Initial Positions:");
    if (!atmStrike) {
      // console.warn(` Skipping ${date} — no ATM strike found.`);
      return {
        date,
        atmStrike: 0,
        positions: [],
        totalPnl: 0,
        madeAdjustment: false,
        dayPnlPercent: 0,
      };
    }

    // Fetch CE and PE entry prices
    const cePrice = await this.dataService.getOptionPrice(
      date,
      ENTRY_TIME,
      atmStrike,
      "CE"
    );
    console.log(`CE: Strike ${atmStrike}, Entry Price: ${cePrice}`);

    const pePrice = await this.dataService.getOptionPrice(
      date,
      ENTRY_TIME,
      atmStrike,
      "PE"
    );
    console.log(`PE: Strike ${atmStrike}, Entry Price: ${pePrice}`);

    const positions: Position[] = [
      {
        type: "CE",
        entryPrice: cePrice,
        entryTime: timeUtils.createDateTime(date, ENTRY_TIME),
        isActive: true,
        strikePrice: atmStrike,
      },
      {
        type: "PE",
        entryPrice: pePrice,
        entryTime: timeUtils.createDateTime(date, ENTRY_TIME),
        isActive: true,
        strikePrice: atmStrike,
      },
    ];

    // Fetch time series data for CE and PE
    const ceTimeSeries = await this.dataService.getOptionPriceTimeSeries(
      date,
      ENTRY_TIME,
      EXIT_TIME,
      atmStrike,
      "CE"
    );
    const peTimeSeries = await this.dataService.getOptionPriceTimeSeries(
      date,
      ENTRY_TIME,
      EXIT_TIME,
      atmStrike,
      "PE"
    );

    const tradeDay: TradeDay = {
      date,
      atmStrike,
      positions,
      totalPnl: 0,
      madeAdjustment: false,
      dayPnlPercent: 0,
    };

    await this.processOptionPrices(tradeDay, ceTimeSeries, peTimeSeries, date);

    tradeDay.totalPnl = this.calculateDayPnL(tradeDay);
    tradeDay.dayPnlPercent =
      (tradeDay.totalPnl / ((cePrice + pePrice) * this.lotSize)) * 100;

    return tradeDay;
  }

  /**
   * Processes the option prices for a trading day, managing entries, exits, and adjustments.
   * @param tradeDay The TradeDay object to update.
   * @param ceTimeSeries Time series data for CE options.
   * @param peTimeSeries Time series data for PE options.
   * @param date The trading day date in 'YYYY-MM-DD' format.
   */
  private async processOptionPrices(
    tradeDay: TradeDay,
    ceTimeSeries: OptionData[],
    peTimeSeries: OptionData[],
    date: string
  ): Promise<void> {
    const times = new Set(
      [...ceTimeSeries, ...peTimeSeries].map((d) => d.received_at.toISOString())
    );
    const sortedTimes = Array.from(times).sort();

    let adjustmentDone = false;

    for (const timeStr of sortedTimes) {
      const currentTime = new Date(timeStr);
      const ceData = ceTimeSeries.find(
        (d) => d.received_at.toISOString() === timeStr
      );
      const peData = peTimeSeries.find(
        (d) => d.received_at.toISOString() === timeStr
      );

      const ce = tradeDay.positions.find((p) => p.type === "CE" && p.isActive);
      const pe = tradeDay.positions.find((p) => p.type === "PE" && p.isActive);

      if (!ce && !pe) break; // No open positions

      let exitBoth = false;

      const totalEntry = (ce?.entryPrice || 0) + (pe?.entryPrice || 0);
      const currentTotal = (ceData?.ltp || 0) + (peData?.ltp || 0);
      const totalChange = ((currentTotal - totalEntry) / totalEntry) * 100;

      // Combined P&L Target
      if (totalChange >= PNL_TARGET_PERCENT) {
        exitBoth = true;
        if (ce && ceData)
          this.exitPosition(ce, ceData.ltp, currentTime, "TOTAL_PL_TARGET");
        if (pe && peData)
          this.exitPosition(pe, peData.ltp, currentTime, "TOTAL_PL_TARGET");
      } else if (totalChange <= -PNL_SL_PERCENT) {
        // Combined Stop Loss
        exitBoth = true;
        if (ce && ceData)
          this.exitPosition(ce, ceData.ltp, currentTime, "TOTAL_PL_SL");
        if (pe && peData)
          this.exitPosition(pe, peData.ltp, currentTime, "TOTAL_PL_SL");
      }

      // Individual SL for CE
      if (ce && ceData) {
        const change = ((ceData.ltp - ce.entryPrice) / ce.entryPrice) * 100;
        if (change <= -SL_PERCENT) {
          this.exitPosition(ce, ceData.ltp, currentTime, "SL");
        }
      }

      // Individual SL for PE
      if (pe && peData) {
        const change = ((peData.ltp - pe.entryPrice) / pe.entryPrice) * 100;
        if (change <= -SL_PERCENT) {
          this.exitPosition(pe, peData.ltp, currentTime, "SL");
        }
      }

      // Adjustment Logic (if both positions exited before 2:00 PM)
      if (
        !adjustmentDone &&
        currentTime < timeUtils.createDateTime(date, ADJUSTMENT_TIME)
      ) {
        const allExited = tradeDay.positions.every((p) => !p.isActive);
        if (allExited) {
          adjustmentDone = true;
          tradeDay.madeAdjustment = true;

          if (!ceData || !peData) {
            console.warn(`Skipping adjustment: missing CE/PE data on ${date}`);
            continue;
          }

          const adjCePrice = ceData.ltp;
          const adjPePrice = peData.ltp;

          tradeDay.positions.push(
            {
              type: "CE",
              entryPrice: adjCePrice,
              entryTime: currentTime,
              isActive: true,
              strikePrice: tradeDay.atmStrike,
            },
            {
              type: "PE",
              entryPrice: adjPePrice,
              entryTime: currentTime,
              isActive: true,
              strikePrice: tradeDay.atmStrike,
            }
          );
        }
      }
    }

    // Exit remaining positions at EOD
    for (const pos of tradeDay.positions) {
      if (pos.isActive) {
        const ts = pos.type === "CE" ? ceTimeSeries : peTimeSeries;
        if (ts.length === 0) {
          console.warn(`No time series found for ${pos.type} on ${date}`);
          continue;
        }
        const final = ts[ts.length - 1];
        this.exitPosition(pos, final.ltp, final.received_at, "EOD");
      }
    }
  }

  // Helper method to exit a position
  private exitPosition(
    position: Position,
    price: number,
    time: Date,
    reason: Position["exitReason"]
  ): void {
    position.exitPrice = price;
    position.exitTime = time;
    position.isActive = false;
    position.exitReason = reason;
  }

  /**
   * Calculates the total P&L for a trading day based on the positions.
   * @param tradeDay The TradeDay object containing positions.
   * @returns Total P&L for the day.
   */
  private calculateDayPnL(tradeDay: TradeDay): number {
    let total = 0;
    for (const p of tradeDay.positions) {
      if (p.exitPrice !== undefined) {
        const pnl = (p.exitPrice - p.entryPrice) * this.lotSize;
        p.pnl = pnl;
        total += pnl;
      }
    }
    return total;
  }
}
