export {
  BRIDGE_PROTOCOL_VERSION,
  BridgeClientError,
  callBridge,
  failure,
  isMutatingMethod,
  isRecord,
  parseBridgeRequest,
  requestFrame,
  responseFrame,
  validOperationId,
  type BridgeClientOptions,
} from './protocol.js'
export type {
  BridgeErrorCode,
  BridgeMessage,
  BridgeMethod,
  BridgeObserveResult,
  BridgeObservedEvent,
  BridgePromptResult,
  BridgeProtocolVersion,
  BridgeRegistry,
  BridgeRegistryEntry,
  BridgeRequest,
  BridgeResponse,
  BridgeSession,
  BridgeStopReason,
  MutatingBridgeMethod,
  OperationOutcome,
  OperationRecord,
} from './types.js'
export { resolveConfig, type Config, type ResolvedConfig } from './config.js'
export { emptyRegistry, readRegistry, writeRegistry } from './registry.js'
export { appendLedgerRecord, readLedger } from './ledger.js'
export {
  apply,
  inject,
  name,
  type StarBridgeConfig,
} from './plugin.js'
