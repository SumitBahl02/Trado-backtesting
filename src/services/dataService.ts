/**
 * DataService provides methods to fetch index and option prices
 * from PostgreSQL based on provided time window and criteria.
 */
import { Pool } from "pg";
import {
  PG_CONFIG,
  INDEX_NAME,
  TIME_WINDOW_MINUTES,
} from "../config/constants";
import { OptionData } from "../models/types";
import { TopicService } from "./topicService";
import { createDateTime, formatDate, getTime } from "../utils/timeUtils";

const pool = new Pool(PG_CONFIG);

export class DataService {
  private topicService: TopicService;

  constructor() {
    this.topicService = new TopicService();
  }

  /**
   * Fetches ATM (At The Money) strike based on index LTP around a given time.
   * @param date Date in 'YYYY-MM-DD' format.
   * @param time Time in 'HH:mm:ss' format.
   * @returns ATM strike price or null if not found.
   */
  async getATMStrike(date: string, time: string): Promise<number | null> {
    const topic_id = await this.topicService.getIndexTopicId(INDEX_NAME);
    const fromTime = createDateTime(date, time);
    const toTime = new Date(fromTime.getTime() + TIME_WINDOW_MINUTES * 60000);

    const result = await pool.query(
      `SELECT ltp, received_at FROM ltp_data 
       WHERE topic_id = $1 AND received_at BETWEEN $2 AND $3
       ORDER BY received_at ASC LIMIT 1`,
      [topic_id, fromTime.toISOString(), toTime.toISOString()]
    );

    if (result.rowCount === 0) {
      console.warn(
        `No index LTP found for ${INDEX_NAME} on ${date} around ${time}`
      );
      return null;
    }

    const ltp = parseFloat(result.rows[0].ltp);
    const atmStrike =
      Math.round(ltp / this.topicService.getRoundValue(INDEX_NAME)) *
      this.topicService.getRoundValue(INDEX_NAME);
    console.log(
      `ATM Strike at ${getTime(result.rows[0].received_at)}: ${atmStrike}`
    );
    return atmStrike;
  }

  /**
   * Fetches option LTP at specific datetime.
   * @param date Date in 'YYYY-MM-DD' format.
   * @param time Time in 'HH:mm:ss' format.
   * @param strike Strike price.
   * @param type Option type: 'CE' or 'PE'.
   * @returns Option price (LTP), or 0 if not found.
   */
  async getOptionPrice(
    date: string,
    time: string,
    strike: number,
    type: "CE" | "PE"
  ): Promise<number> {
    const optionTopicID = await this.topicService.getOptionTopicId(
      INDEX_NAME,
      strike,
      type
    );

    const specificDateTime = createDateTime(date, time).toISOString();
    const query = `
      SELECT ltp FROM ltp_data
      WHERE topic_id = $1 AND received_at >= $2
      ORDER BY received_at ASC
      LIMIT 1
    `;

    const values = [optionTopicID, specificDateTime];
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      console.warn(
        `No option LTP found for ${INDEX_NAME} ${type} ${strike} at ${date} ${time}`
      );
      return 0;
    }
    return parseFloat(result.rows[0].ltp);
  }

  /**
   * Fetches time series of option prices between given start and end time.
   * @param date Date in 'YYYY-MM-DD' format.
   * @param startTime Start time in 'HH:mm:ss'.
   * @param endTime End time in 'HH:mm:ss'.
   * @param strike Strike price.
   * @param type Option type: 'CE' or 'PE'.
   * @returns Array of OptionData with price and time.
   */
  async getOptionPriceTimeSeries(
    date: string,
    startTime: string,
    endTime: string,
    strike: number,
    type: "CE" | "PE"
  ): Promise<OptionData[]> {
    const optionTopicID = await this.topicService.getOptionTopicId(
      INDEX_NAME,
      strike,
      type
    );

    const start = createDateTime(date, startTime);
    const end = createDateTime(date, endTime);

    const query = `
      SELECT id, topic_id, ltp, received_at
      FROM ltp_data
      WHERE topic_id = $1 AND received_at BETWEEN $2 AND $3
      ORDER BY received_at ASC
    `;

    const values = [optionTopicID, start.toISOString(), end.toISOString()];
    const result = await pool.query(query, values);

    const queryForTopic = `
      SELECT topic_name FROM topics
      WHERE topic_id = $1
      LIMIT 1
    `;
    const res = await pool.query(queryForTopic, [optionTopicID]);
    const topicName =
      res.rows[0]?.topic_name || `${INDEX_NAME}-${strike}-${type}`;

    return result.rows.map((row: any) => ({
      id: row.id,
      topic: topicName,
      ltp: parseFloat(row.ltp),
      received_at: new Date(row.received_at),
    }));
  }

  /**
   * Returns available trading dates from the data.
   * @returns Array of trade dates in 'YYYY-MM-DD' format.
   */
  async getAvailableDates(): Promise<string[]> {
    const query = `
      SELECT DISTINCT DATE(received_at) as trade_date
      FROM ltp_data
      ORDER BY trade_date DESC
    `;

    const result = await pool.query(query);
    return result.rows.map((row: any) =>
      row.trade_date.toISOString().slice(0, 10)
    );
  }

  /**
   * Returns last N trading dates.
   * @param n Number of days. Default = 3.
   * @returns Array of recent trading dates in 'YYYY-MM-DD'.
   */
  async getLastNTradingDays(n: number = 3): Promise<string[]> {
    const query = `
      SELECT DISTINCT DATE(received_at) as trade_date
      FROM ltp_data
      ORDER BY trade_date DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [n]);
    return result.rows.map(
      (row: any) => row.trade_date.toISOString().split("T")[0]
    );
  }
}
