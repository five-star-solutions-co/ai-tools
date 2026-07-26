/**
 * Public transport (`@harryy/ai-tools/http`).
 * Inside the package prefer leaf imports: `./http-service`, `./aws-service`.
 */

export { AwsService } from './aws-service'
export type {
	AwsBytesOptions,
	AwsBytesResult,
	AwsCallOptions,
	AwsCredentials,
	AwsQueryResult,
	AwsServiceOptions
} from './aws-service'
export {
	assertHttpStatusOk,
	httpErrorCode,
	mapTransportNetworkError,
	retryAfterMsFromHeader,
	throwHttpStatus
} from './errors'
export type { StatusThrowOptions } from './errors'
export { HttpService } from './http-service'
export type {
	HttpBody,
	HttpBytesOptions,
	HttpBytesResult,
	HttpCallOptions,
	HttpQueryResult,
	HttpServiceOptions
} from './http-service'
