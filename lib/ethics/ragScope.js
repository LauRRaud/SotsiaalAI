import collection from '../../config/ethics-sources.json' with { type: 'json' };
import { restrictPilotSources } from '../rag-v2/pilot/source-scope.js';
import { reject } from '../rag-v2/pilot/contracts.js';

export const ethicsRagConfig = config => restrictPilotSources(config, collection);

// Only the reviewed snapshot enters the room's answer. In particular, a caller
// cannot bring the general assistant's older answer or dialogue state into it.
export function validateEthicsTurn(input) {
  if (input?.contextMode !== 'new' || ['contextTurnId', 'replyToTurnId', 'replyToBlock'].some(key => input[key] !== undefined)) {
    reject('ethics_new_context_required', 400);
  }
}
