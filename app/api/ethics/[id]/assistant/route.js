import { prepareEthicsAssistant } from '@/lib/ethics/records';
import { ethicsApi } from '../../_shared';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// This prepares only the reviewed user message. /api/ethics/chat reuses the
// assistant pipeline with its server-owned ethics source collection.
export const POST = (request, context) => ethicsApi(request, async (userId, input) => prepareEthicsAssistant(userId, (await context.params).id, input));
