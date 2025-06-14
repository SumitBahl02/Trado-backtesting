# 📈 TRADO × IIT Ropar Hackathon – Backtesting Engine (Task 2)

This is **Part 2** of the TRADO × IIT Ropar Hackathon. In this project, we build a **backtesting engine** to evaluate a defined **options buying strategy** using historical market data stored in PostgreSQL/TimescaleDB.

---

## 📌 Problem Statement

Build a system that simulates a trading strategy over historical intraday data for Indian indices (like **BANKNIFTY, NIFTY, FINNIFTY**, etc.).

---

## 🧠 Strategy Logic

### ✅ Entry Rule (Default: 9:25 AM)

* Buy 1 lot of **ATM CE**
* Buy 1 lot of **ATM PE**

### 🚪 Exit Rules

* ❌ **Stop Loss (Individual Legs)**: Exit a leg if it loses 25%
* ✅ **Combined Target**: Exit both if total P\&L ≥ +25%
* ❌ **Combined Stop Loss**: Exit both if total P\&L ≤ -10%
* 🕒 **End of Day Exit**: Force exit at 3:15 PM

### 🔁 Adjustment Rule

* If both legs exit **before 2:00 PM**, re-enter fresh ATM CE + PE
* Only **one adjustment per day**
* Adjustments **hold till EOD** without SL/Target

---

## 🗃️ Database Schema

```sql
-- Maps token topics to IDs
CREATE TABLE topics (
  topic_id SERIAL PRIMARY KEY,
  topic_name TEXT NOT NULL UNIQUE,
  index_name TEXT,
  type TEXT,
  strike NUMERIC
);

-- Time-series price data
CREATE TABLE ltp_data (
  id INTEGER NOT NULL,
  topic_id INTEGER REFERENCES topics(topic_id),
  ltp NUMERIC(10,2) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, received_at)
);
```

---

## ⚙️ Setup Instructions

### 1. Install Prerequisites

* Node.js (v16+)
* PostgreSQL + TimescaleDB extension
* `npm` or `yarn`

### 2. Clone the Repository

```bash
git clone https://github.com/yourname/backtest-hackathon.git
cd backtest-hackathon
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment

Create your `.env` file:

```bash
cp .env.sample .env
```

Set your PostgreSQL credentials and strategy config in `.env`.

### 5. Start Backtest

```bash
npm start
```

---

## 🛠️ File Structure

```
src/
├── config/              # Environment + constants
├── models/              # TypeScript interfaces
├── services/            # Core logic (Data, Backtest, Topic services)
├── utils/               # Helper functions (time, formatting)
└── index.ts             # Entry point for execution
```

---

## 🧪 Output Example

```bash
BANKNIFTY Option Backtesting Engine
=====================================
Backtesting 3 trading days: 2025-05-23, 2025-05-22, 2025-05-21

Backtest Results
================
Total P&L: -118.50
Winning Days: 2
Losing Days: 1
Win Rate: 66.67%
Average Daily P&L: -39.50

Daily Results:
Date: 2025-05-23, P&L: -118.50, PnL%: -0.43%, Adjustment: Yes
Date: 2025-05-22, P&L: 0.00, PnL%: 0.00%, Adjustment: No
Date: 2025-05-21, P&L: 0.00, PnL%: 0.00%, Adjustment: No
```

---

## ⚠️ Notes & Recommendations

* Ensure `topics` and `ltp_data` tables are **pre-populated** with historical market data.
* All data timestamps should be in `Asia/Kolkata` time zone.
* Strategy parameters are **configurable via `.env`**.

---

## ✨ Future Improvements

* Add support for more advanced strategies.
* Export backtest results to CSV.
* Visualize daily P\&L using charts.
* Add REST API support for backtesting via POST requests.

---

## 👨‍💻 Author

Made with 💻 by Sumit Bahl as part of the TRADO × IIT Ropar Hackathon.
