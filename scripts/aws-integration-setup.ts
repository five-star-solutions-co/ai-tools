#!/usr/bin/env bun
/**
 * Provision AWS resources for ai-tools live integration tests.
 *
 * Hardcoded defaults (this package):
 *   IAM user:   integration-test-ai-tools
 *   IAM policy: integration-test-ai-tools-policy  (customer managed)
 *   S3 bucket:  integration-test-ai-tools
 *   Prefix:     integration-test-ai-tools  (queue / scheduler role names)
 *
 * Prerequisites:
 *   - AWS CLI v2 authenticated (admin or power user that can create IAM/SQS/S3)
 *   - Access key for the IT user goes in AI_TOOLS_AWS_* (script does not create keys)
 *
 * Creates / updates:
 *   - S3 bucket (optional create) + sample PDF for Textract
 *   - SQS queue (scheduler target + queue seam)
 *   - IAM role for EventBridge Scheduler → SQS
 *   - Customer managed policy on the IT user (Textract, S3 get, SQS, Scheduler, AgentCore)
 *   - Prints .env lines (optional --write-env in-place upsert of non-secret ARNs)
 *
 * Usage:
 *   bun scripts/aws-integration-setup.ts
 *   bun scripts/aws-integration-setup.ts --write-env
 *   bun scripts/aws-integration-setup.ts --dry-run
 *
 * Default region: us-east-1 (override with --region or AI_TOOLS_AWS_REGION).
 */

import { $ } from 'bun'
import { join } from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'

import { envSetMany } from './lib/env-file'

const root = join(import.meta.dir, '..')
const envFile = join(root, '.env')

/** Fixed names for this package’s live AWS IT identity. */
const DEFAULT_IAM_USER = 'integration-test-ai-tools'
const DEFAULT_IAM_POLICY = 'integration-test-ai-tools-policy'
const DEFAULT_BUCKET = 'integration-test-ai-tools'
const DEFAULT_PREFIX = 'integration-test-ai-tools'
const DEFAULT_REGION = 'us-east-1'

type Args = {
	bucket: string
	user: string
	policy: string
	region: string
	prefix: string
	writeEnv: boolean
	dryRun: boolean
	createBucket: boolean
	sourceKey: string
}

function log(msg: string): void {
	console.log(`==> ${msg}`)
}

function die(msg: string): never {
	console.error(`error: ${msg}`)
	process.exit(1)
}

function nonEmpty(value: string | undefined): string | undefined {
	if (value === undefined) return undefined
	const trimmed = value.trim()
	return trimmed === '' ? undefined : trimmed
}

function parseArgs(argv: string[]): Args {
	const get = (name: string): string | undefined => {
		const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
		if (!hit) return undefined
		if (hit.includes('=')) return nonEmpty(hit.slice(hit.indexOf('=') + 1))
		const i = argv.indexOf(hit)
		return nonEmpty(argv[i + 1])
	}
	const has = (name: string) => argv.includes(`--${name}`)
	const fromEnv = (name: string) => nonEmpty(process.env[name])

	const bucket = get('bucket') ?? fromEnv('AI_TOOLS_TEXTRACT_BUCKET') ?? DEFAULT_BUCKET
	const user = get('user') ?? fromEnv('AI_TOOLS_AWS_IAM_USER') ?? DEFAULT_IAM_USER
	const policy = get('policy') ?? fromEnv('AI_TOOLS_AWS_IAM_POLICY') ?? DEFAULT_IAM_POLICY
	const region =
		get('region') ??
		fromEnv('AI_TOOLS_AWS_REGION') ??
		fromEnv('AWS_REGION') ??
		fromEnv('AWS_DEFAULT_REGION') ??
		DEFAULT_REGION
	const prefix = get('prefix') ?? DEFAULT_PREFIX
	const sourceKey = get('source-key') ?? `${prefix}/textract/sample.pdf`

	return {
		bucket,
		user,
		policy,
		region,
		prefix,
		writeEnv: has('write-env'),
		dryRun: has('dry-run'),
		createBucket: !has('no-create-bucket'),
		sourceKey
	}
}

async function awsJson(args: string[], region: string): Promise<unknown> {
	const result = await $`aws ${args} --region ${region} --output json`.nothrow().quiet()
	if (result.exitCode !== 0) {
		const err = result.stderr.toString().trim() || result.stdout.toString().trim()
		die(`aws ${args.join(' ')} failed:\n${err}`)
	}
	const text = result.stdout.toString().trim()
	if (!text) return null
	return JSON.parse(text) as unknown
}

async function awsOk(args: string[], region: string): Promise<void> {
	const result = await $`aws ${args} --region ${region}`.nothrow().quiet()
	if (result.exitCode !== 0) {
		const err = result.stderr.toString().trim() || result.stdout.toString().trim()
		die(`aws ${args.join(' ')} failed:\n${err}`)
	}
}

async function awsTry(args: string[], region: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
	const result = await $`aws ${args} --region ${region} --output json`.nothrow().quiet()
	return {
		ok: result.exitCode === 0,
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString()
	}
}

function asRecord(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value : ''
}

async function callerIdentity(region: string): Promise<{ account: string; arn: string }> {
	const data = asRecord(await awsJson(['sts', 'get-caller-identity'], region))
	const account = asString(data['Account'])
	const arn = asString(data['Arn'])
	if (!account || !arn) die('could not parse sts get-caller-identity')
	return { account, arn }
}

async function ensureBucket(args: Args): Promise<void> {
	const head = await awsTry(['s3api', 'head-bucket', '--bucket', args.bucket], args.region)
	if (head.ok) {
		log(`s3 bucket exists: ${args.bucket}`)
		return
	}
	if (!args.createBucket) die(`bucket ${args.bucket} not found (pass without --no-create-bucket to create)`)
	log(`creating s3 bucket: ${args.bucket}`)
	if (args.dryRun) return
	if (args.region === 'us-east-1') {
		await awsOk(['s3api', 'create-bucket', '--bucket', args.bucket], args.region)
	} else {
		await awsOk(
			[
				's3api',
				'create-bucket',
				'--bucket',
				args.bucket,
				'--create-bucket-configuration',
				`LocationConstraint=${args.region}`
			],
			args.region
		)
	}
	// Block public access (safe default for IT sample objects)
	await awsOk(
		[
			's3api',
			'put-public-access-block',
			'--bucket',
			args.bucket,
			'--public-access-block-configuration',
			'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
		],
		args.region
	)
}

async function uploadSamplePdf(args: Args): Promise<void> {
	log(`uploading Textract sample: s3://${args.bucket}/${args.sourceKey}`)
	if (args.dryRun) return

	const pdf = await PDFDocument.create()
	const page = pdf.addPage([400, 200])
	const font = await pdf.embedFont(StandardFonts.Helvetica)
	page.drawText('ai-tools integration textract sample', {
		x: 40,
		y: 100,
		size: 14,
		font
	})
	const bytes = await pdf.save()
	const tmp = join(root, '.tmp-ai-tools-textract-sample.pdf')
	await Bun.write(tmp, bytes)
	try {
		await awsOk(
			[
				's3api',
				'put-object',
				'--bucket',
				args.bucket,
				'--key',
				args.sourceKey,
				'--body',
				tmp,
				'--content-type',
				'application/pdf'
			],
			args.region
		)
	} finally {
		await $`rm -f ${tmp}`.nothrow().quiet()
	}
}

async function ensureQueue(args: Args, account: string): Promise<{ queueUrl: string; queueArn: string }> {
	const name = `${args.prefix}-queue`
	log(`ensuring SQS queue: ${name}`)
	if (args.dryRun) {
		return {
			queueUrl: `https://sqs.${args.region}.amazonaws.com/${account}/${name}`,
			queueArn: `arn:aws:sqs:${args.region}:${account}:${name}`
		}
	}

	const created = await awsTry(
		['sqs', 'create-queue', '--queue-name', name, '--attributes', JSON.stringify({ VisibilityTimeout: '60' })],
		args.region
	)
	let queueUrl = ''
	if (created.ok) {
		const data = asRecord(JSON.parse(created.stdout || '{}') as unknown)
		queueUrl = asString(data['QueueUrl'])
	} else {
		const got = asRecord(await awsJson(['sqs', 'get-queue-url', '--queue-name', name], args.region))
		queueUrl = asString(got['QueueUrl'])
	}
	if (!queueUrl) die('could not resolve SQS queue URL')

	const attrs = asRecord(
		await awsJson(
			['sqs', 'get-queue-attributes', '--queue-url', queueUrl, '--attribute-names', 'QueueArn'],
			args.region
		)
	)
	const attributes = asRecord(attrs['Attributes'])
	const queueArn = asString(attributes['QueueArn'])
	if (!queueArn) die('could not resolve SQS queue ARN')
	return { queueUrl, queueArn }
}

async function ensureSchedulerRole(
	args: Args,
	account: string,
	queueArn: string
): Promise<{ roleArn: string; roleName: string }> {
	const roleName = `${args.prefix}-scheduler-role`
	const roleArn = `arn:aws:iam::${account}:role/${roleName}`
	log(`ensuring EventBridge Scheduler role: ${roleName}`)

	const trust = {
		Version: '2012-10-17',
		Statement: [
			{
				Effect: 'Allow',
				Principal: { Service: 'scheduler.amazonaws.com' },
				Action: 'sts:AssumeRole',
				Condition: {
					StringEquals: {
						'aws:SourceAccount': account
					}
				}
			}
		]
	}

	const rolePolicy = {
		Version: '2012-10-17',
		Statement: [
			{
				Sid: 'SendToItQueue',
				Effect: 'Allow',
				Action: ['sqs:SendMessage'],
				Resource: queueArn
			}
		]
	}

	if (args.dryRun) return { roleArn, roleName }

	const getRole = await awsTry(['iam', 'get-role', '--role-name', roleName], args.region)
	if (!getRole.ok) {
		const trustPath = join(root, '.tmp-ai-tools-scheduler-trust.json')
		await Bun.write(trustPath, JSON.stringify(trust))
		try {
			await awsOk(
				[
					'iam',
					'create-role',
					'--role-name',
					roleName,
					'--assume-role-policy-document',
					`file://${trustPath}`,
					'--description',
					'ai-tools live IT EventBridge Scheduler to SQS'
				],
				args.region
			)
		} finally {
			await $`rm -f ${trustPath}`.nothrow().quiet()
		}
	}

	const policyPath = join(root, '.tmp-ai-tools-scheduler-role-policy.json')
	await Bun.write(policyPath, JSON.stringify(rolePolicy))
	try {
		await awsOk(
			[
				'iam',
				'put-role-policy',
				'--role-name',
				roleName,
				'--policy-name',
				`${args.prefix}-scheduler-sqs`,
				'--policy-document',
				`file://${policyPath}`
			],
			args.region
		)
	} finally {
		await $`rm -f ${policyPath}`.nothrow().quiet()
	}

	// IAM role propagation can lag a few seconds for first schedule create.
	await Bun.sleep(3_000)
	return { roleArn, roleName }
}

function itUserPolicyDocument(args: Args, account: string, queueArn: string, roleArn: string): Record<string, unknown> {
	return {
		Version: '2012-10-17',
		Statement: [
			{
				Sid: 'Textract',
				Effect: 'Allow',
				Action: ['textract:StartDocumentTextDetection', 'textract:GetDocumentTextDetection'],
				Resource: '*'
			},
			{
				Sid: 'TextractSourceRead',
				Effect: 'Allow',
				Action: ['s3:GetObject'],
				Resource: `arn:aws:s3:::${args.bucket}/*`
			},
			{
				Sid: 'TextractBucketListOptional',
				Effect: 'Allow',
				Action: ['s3:ListBucket'],
				Resource: `arn:aws:s3:::${args.bucket}`
			},
			{
				Sid: 'SqsItQueue',
				Effect: 'Allow',
				Action: [
					'sqs:SendMessage',
					'sqs:ReceiveMessage',
					'sqs:DeleteMessage',
					'sqs:ChangeMessageVisibility',
					'sqs:GetQueueAttributes',
					'sqs:GetQueueUrl'
				],
				Resource: queueArn
			},
			{
				Sid: 'EventBridgeSchedulerCrud',
				Effect: 'Allow',
				Action: [
					'scheduler:CreateSchedule',
					'scheduler:GetSchedule',
					'scheduler:ListSchedules',
					'scheduler:UpdateSchedule',
					'scheduler:DeleteSchedule'
				],
				Resource: `arn:aws:scheduler:${args.region}:${account}:schedule/*/*`
			},
			{
				Sid: 'PassSchedulerRole',
				Effect: 'Allow',
				Action: 'iam:PassRole',
				Resource: roleArn,
				Condition: {
					StringEquals: {
						'iam:PassedToService': 'scheduler.amazonaws.com'
					}
				}
			},
			{
				Sid: 'AgentCoreBrowser',
				Effect: 'Allow',
				Action: [
					'bedrock-agentcore:StartBrowserSession',
					'bedrock-agentcore:GetBrowserSession',
					'bedrock-agentcore:StopBrowserSession',
					'bedrock-agentcore:ListBrowserSessions',
					'bedrock-agentcore:ListBrowsers',
					'bedrock-agentcore:GetBrowser'
				],
				Resource: '*'
			},
			{
				Sid: 'AgentCoreCodeInterpreter',
				Effect: 'Allow',
				Action: [
					'bedrock-agentcore:StartCodeInterpreterSession',
					'bedrock-agentcore:GetCodeInterpreterSession',
					'bedrock-agentcore:StopCodeInterpreterSession',
					'bedrock-agentcore:InvokeCodeInterpreter',
					'bedrock-agentcore:ListCodeInterpreters',
					'bedrock-agentcore:GetCodeInterpreter',
					'bedrock-agentcore:ListCodeInterpreterSessions'
				],
				Resource: '*'
			}
		]
	}
}

async function ensureUserPolicy(args: Args, account: string, queueArn: string, roleArn: string): Promise<void> {
	const policyName = args.policy
	const policyArn = `arn:aws:iam::${account}:policy/${policyName}`
	log(`ensuring managed policy ${policyName} on IAM user ${args.user}`)
	if (args.dryRun) return

	const user = await awsTry(['iam', 'get-user', '--user-name', args.user], args.region)
	if (!user.ok) die(`IAM user not found: ${args.user}`)

	const doc = itUserPolicyDocument(args, account, queueArn, roleArn)
	const path = join(root, '.tmp-ai-tools-user-policy.json')
	await Bun.write(path, JSON.stringify(doc, null, 2))
	try {
		const existing = await awsTry(['iam', 'get-policy', '--policy-arn', policyArn], args.region)
		if (existing.ok) {
			// Create a new default version (IAM allows max 5 versions — prune oldest non-default if needed).
			const versions = asRecord(await awsJson(['iam', 'list-policy-versions', '--policy-arn', policyArn], args.region))
			const list = Array.isArray(versions['Versions']) ? versions['Versions'] : []
			if (list.length >= 5) {
				for (const row of list) {
					const v = asRecord(row)
					if (v['IsDefaultVersion'] === true) continue
					const id = asString(v['VersionId'])
					if (!id) continue
					await awsOk(['iam', 'delete-policy-version', '--policy-arn', policyArn, '--version-id', id], args.region)
					break
				}
			}
			await awsOk(
				[
					'iam',
					'create-policy-version',
					'--policy-arn',
					policyArn,
					'--policy-document',
					`file://${path}`,
					'--set-as-default'
				],
				args.region
			)
		} else {
			await awsOk(
				[
					'iam',
					'create-policy',
					'--policy-name',
					policyName,
					'--policy-document',
					`file://${path}`,
					'--description',
					'ai-tools live integration tests'
				],
				args.region
			)
		}

		const attached = await awsTry(['iam', 'list-attached-user-policies', '--user-name', args.user], args.region)
		const attachedList = asRecord(JSON.parse(attached.stdout || '{}') as unknown)
		const policies = Array.isArray(attachedList['AttachedPolicies']) ? attachedList['AttachedPolicies'] : []
		const already = policies.some((row) => asString(asRecord(row)['PolicyArn']) === policyArn)
		if (!already) {
			await awsOk(['iam', 'attach-user-policy', '--user-name', args.user, '--policy-arn', policyArn], args.region)
		}
	} finally {
		await $`rm -f ${path}`.nothrow().quiet()
	}
}

function printEnvBlock(values: Record<string, string>): void {
	console.log('')
	console.log('# --- paste into .env (secrets: use the IT user access key, not printed here) ---')
	for (const [k, v] of Object.entries(values)) {
		console.log(`${k}=${v}`)
	}
	console.log('# AI_TOOLS_AWS_ACCESS_KEY_ID=…          # access key for the IT IAM user')
	console.log('# AI_TOOLS_AWS_SECRET_ACCESS_KEY=…      # secret for that key')
	console.log('# AI_TOOLS_AWS_SESSION_TOKEN=…          # only if using temporary creds')
	console.log('')
}

async function main(): Promise<void> {
	if (!Bun.which('aws')) die('aws CLI not found on PATH')

	const args = parseArgs(process.argv.slice(2))
	log(`region=${args.region} bucket=${args.bucket} user=${args.user} policy=${args.policy} prefix=${args.prefix}`)
	if (args.dryRun) log('dry-run: no writes')

	const { account, arn } = await callerIdentity(args.region)
	log(`caller ${arn} (account ${account})`)

	await ensureBucket(args)
	await uploadSamplePdf(args)
	const { queueUrl, queueArn } = await ensureQueue(args, account)
	const { roleArn } = await ensureSchedulerRole(args, account, queueArn)
	await ensureUserPolicy(args, account, queueArn, roleArn)

	const envValues: Record<string, string> = {
		AI_TOOLS_AWS_REGION: args.region,
		AI_TOOLS_TEXTRACT_BUCKET: args.bucket,
		AI_TOOLS_TEXTRACT_SOURCE_KEY: args.sourceKey,
		AI_TOOLS_SQS_QUEUE_URL: queueUrl,
		AI_TOOLS_EVENTBRIDGE_SCHEDULER_TARGET_ARN: queueArn,
		AI_TOOLS_EVENTBRIDGE_SCHEDULER_ROLE_ARN: roleArn
	}

	printEnvBlock(envValues)

	if (args.writeEnv && !args.dryRun) {
		log(`upserting resource ARNs into ${envFile}`)
		envSetMany(envFile, Object.entries(envValues))
		log('wrote .env (access keys not modified)')
	}

	console.log('Next steps:')
	console.log(`  1. Put the IAM user "${args.user}" access key into AI_TOOLS_AWS_ACCESS_KEY_ID / SECRET`)
	console.log('  2. Confirm Bedrock AgentCore Browser + Code Interpreter are available in this region')
	console.log('     (console: Amazon Bedrock → AgentCore; defaults aws.browser.v1 / aws.codeinterpreter.v1)')
	console.log('  3. Run: bun run test:integration')
	console.log('')
	console.log('Note: EventBridge schedules are created DISABLED by the live tests (safe no-fire).')
	console.log('      Scheduler target is the IT SQS queue (no Lambda required).')
}

await main()
