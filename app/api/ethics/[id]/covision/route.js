import { handoffEthics } from '@/lib/ethics/records';
import { ethicsApi } from '../../_shared';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = (request, context) => ethicsApi(request, async (userId, input) => handoffEthics(userId, (await context.params).id, input));
