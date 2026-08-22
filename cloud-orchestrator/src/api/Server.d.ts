import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';
export declare const telemetryEvents: EventEmitter<any>;
export declare const io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const connectedNodes: Map<string, string>;
//# sourceMappingURL=Server.d.ts.map