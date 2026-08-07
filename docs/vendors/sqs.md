# SQS

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/sqs` |
| **Kind** | vendor pack |
| **Transport** | `AwsService`, service `sqs` |

The client uses the SQS AWS JSON API with four explicit methods:

| Client method | Tool |
| --- | --- |
| `enqueue` | `sqs-send` |
| `receive` | `sqs-receive` |
| `acknowledge` | `sqs-delete` |
| `extendVisibility` | `sqs-change-visibility` |

Auth binds one `queue_url` together with AWS credentials and region. Use the provider-neutral [queue module](../modules/queue.md) for model-facing queue capability.
