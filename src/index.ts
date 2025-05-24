import { BacktestService } from "./services/backtestService";
import { DataService } from "./services/dataService";
import { INDEX_NAME, DAYS_TO_BACKTEST } from "./config/constants";

async function main() {
  try {
    console.log(`${INDEX_NAME} Option Backtesting Engine`);
    console.log("=====================================");

    const dataService = new DataService();
    const backtestService = new BacktestService();

    // Get last N trading days
    const tradingDays = await dataService.getLastNTradingDays(DAYS_TO_BACKTEST);
    console.log(
      `Backtesting ${tradingDays.length} trading days: ${tradingDays.join(
        ", "
      )}`
    );

    if (tradingDays.length === 0) {
      console.error(
        "No trading days found for backtest. Please check your database."
      );
      process.exit(1);
    }

    // Run backtest
    const results = await backtestService.runBacktest(tradingDays);

    // Print results
    console.log("\nBacktest Results");
    console.log("================");
    console.log(`Total P&L: ${results.totalPnl.toFixed(2)}`);
    console.log(`Winning Days: ${results.winningDays}`);
    console.log(`Losing Days: ${results.losingDays}`);
    console.log(`Win Rate: ${results.winRate.toFixed(2)}%`);
    console.log(`Average Daily P&L: ${results.averageDailyPnl.toFixed(2)}`);

    console.log("\nDaily Results:");
    for (const day of results.days) {
      console.log(
        `Date: ${day.date}, P&L: ${day.totalPnl.toFixed(
          2
        )}, PnL%: ${day.dayPnlPercent.toFixed(2)}%, Adjustment: ${
          day.madeAdjustment ? "Yes" : "No"
        }`
      );
    }
  } catch (error) {
    console.error("Error running backtest:", error);
  } finally {
    process.exit();
  }
}

// Run the main function
main();
