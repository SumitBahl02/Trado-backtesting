// topicService.ts
import { Pool } from "pg";
import { PG_CONFIG } from "../config/constants";

// Create database connection pool
const pool = new Pool(PG_CONFIG);

/**
 * Service to handle mapping between index, strike prices and topic IDs
 */
export class TopicService {
  /**
   * Get the topic ID for an index
   * @param indexName The name of the index (BANKNIFTY, NIFTY, etc.)
   */
  public async getIndexTopicId(indexName: string): Promise<number> {
    const result = await pool.query(
      `SELECT topic_id FROM topics WHERE topic_name = $1 LIMIT 1`,
      [`index/${indexName}`] // 🔧 FIXED: match actual topic_name value
    );

    if (result.rowCount === 0) {
      throw new Error(`Index topic ID not found for ${indexName}`);
    }

    return result.rows[0].topic_id;
  }

  /**
   * Get the topic ID for an option
   * @param indexName The index name (BANKNIFTY, NIFTY, etc.)
   * @param strike The strike price
   * @param type The option type (CE or PE)
   */
  public async getOptionTopicId(
    indexName: string,
    strike: number,
    type: "CE" | "PE"
  ): Promise<number> {
    const result = await pool.query(
      `SELECT topic_id FROM topics WHERE index_name = $1 AND strike = $2 AND type = $3 LIMIT 1`,
      [indexName, strike, type]
    );

    if (result.rowCount === 0) {
      throw new Error(
        `Option topic ID not found for ${indexName} ${strike} ${type}`
      );
    }

    return result.rows[0].topic_id;
  }

  /**
   * Get the round value for strike prices based on the index
   * @param indexName The index name
   */
  public getRoundValue(indexName: string): number {
    switch (indexName.toUpperCase()) {
      case "BANKNIFTY":
        return 100;
      case "NIFTY":
      case "FINNIFTY":
        return 50;
      case "MIDCPNIFTY":
        return 25;
      default:
        return 100; // Default fallback
    }
  }

  /**
   * Get the lot size for an index
   * @param indexName The name of the index
   */

  public getLotSize(indexName: string): number {
    switch (indexName.toUpperCase()) {
      case "NIFTY":
        return 75;
      case "BANKNIFTY":
        return 30;
      case "MIDCPNIFTY":
        return 120;
      case "FINNIFTY":
        return 65;
      default:
        return 30; // Default fallback
    }
  }
}
