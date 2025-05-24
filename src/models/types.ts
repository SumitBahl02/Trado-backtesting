// models/types.ts
// Define the structure for option data points from the database
export interface OptionData {
  id: number;
  topic: string;
  ltp: number;
  received_at: Date;
}

// Position represents a single option trade
export interface Position {
  type: "CE" | "PE";
  entryPrice: number;
  exitPrice?: number;
  entryTime: Date;
  exitTime?: Date;
  isActive: boolean;
  strikePrice: number;
  pnl?: number;
  exitReason?: "SL" | "TARGET" | "EOD" | "TOTAL_PL_TARGET" | "TOTAL_PL_SL";
}

// TradeDay represents a day's trading activity and results
export interface TradeDay {
  date: string;
  atmStrike: number;
  positions: Position[];
  adjustmentPositions?: Position[];
  totalPnl: number;
  madeAdjustment: boolean;
  dayPnlPercent: number;
}

// BacktestResult contains overall results of the backtest
export interface BacktestResult {
  days: TradeDay[];
  totalPnl: number;
  winningDays: number;
  losingDays: number;
  winRate: number;
  averageDailyPnl: number;
}
