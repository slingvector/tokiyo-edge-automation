import { redisClient } from '../api/Server';

export class FleetRouter {
  
  /**
   * Finds the first IDLE node in the fleet and marks it as BUSY.
   * Returns the node_id if successful, or null if no nodes are available.
   */
  public static async assignIdleNode(): Promise<string | null> {
    const statuses = await redisClient.hgetall('nodeStatus');
    for (const [nodeId, status] of Object.entries(statuses)) {
      if (status === 'IDLE') {
        await redisClient.hset('nodeStatus', nodeId, 'BUSY');
        console.log(`[FleetRouter] Assigned node ${nodeId} to a new session (Marked BUSY)`);
        return nodeId;
      }
    }
    return null; // No idle nodes
  }

  /**
   * Releases a node back to the IDLE pool.
   */
  public static async releaseNode(nodeId: string): Promise<void> {
    const exists = await redisClient.hexists('nodeStatus', nodeId);
    if (exists) {
      await redisClient.hset('nodeStatus', nodeId, 'IDLE');
      console.log(`[FleetRouter] Released node ${nodeId} (Marked IDLE)`);
    }
  }
}
