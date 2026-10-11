import { listEthics, createEthics } from '@/lib/ethics/records';
import { ethicsApi } from './_shared';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = request => ethicsApi(request, userId => listEthics(userId, { cursor: new URL(request.url).searchParams.get('cursor') }));
export const POST = request => ethicsApi(request, async (userId, input) => ({ reflection: await createEthics(userId, input) }));
