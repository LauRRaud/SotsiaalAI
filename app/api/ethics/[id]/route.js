import { readEthics, updateEthics, deleteEthics } from '@/lib/ethics/records';
import { ethicsApi } from '../_shared';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request, context) => ethicsApi(request, async userId => ({ reflection: await readEthics(userId, (await context.params).id) }));
export const PATCH = (request, context) => ethicsApi(request, async (userId, input) => ({ reflection: await updateEthics(userId, (await context.params).id, input) }));
export const DELETE = (request, context) => ethicsApi(request, async (userId, input) => deleteEthics(userId, (await context.params).id, input.expectedVersion));
