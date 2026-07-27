export { PresentationClient } from './client'
export type { PresentationClientOptions } from './client'
export {
	MAX_SLIDES,
	presentationAuthSchema,
	presentationBuildInputSchema,
	presentationBuildOutputSchema,
	presentationEditInputSchema,
	presentationReadInputSchema,
	presentationReadOutputSchema,
	presentationReplacementSchema,
	presentationSourceSchema,
	presentationSlideSchema
} from './contracts'
export type {
	PresentationAuth,
	PresentationBuildInput,
	PresentationEditInput,
	PresentationReadInput,
	PresentationReadOutput,
	PresentationReplacement,
	PresentationSlide
} from './contracts'
export { presentationBuildTool, presentationEditTool, presentationModule, presentationReadTool } from './module'
