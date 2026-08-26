export { ConnectorHost } from './connector-host.js'
export {
  inboundOperationId,
  normalizeEnvelope,
  optionalField,
  textOf,
} from './envelope.js'
export {
  SlackSocketModeConnector,
  slackEventToEnvelope,
  type SlackMessageEvent,
  type SlackSocketModeClient,
  type SlackWebClient,
} from './slack.js'
export {
  createSlackSocketModeConnector,
  type SlackSdkConnectorOptions,
} from './slack-sdk.js'
export {
  GmailConnector,
  createGmailConnectorFromAdc,
  createGmailConnectorFromOAuth,
  gmailMessageToEnvelope,
  obtainGmailRefreshToken,
  type GmailAdcConnectorOptions,
  type GmailConnectorOptions,
  type GmailMessage,
  type GmailOAuthConnectorOptions,
} from './gmail.js'
export type {
  ChannelConnector,
  NormalizedPayload,
  OutboundMessage,
} from './types.js'
