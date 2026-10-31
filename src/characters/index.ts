import type { CharacterDef } from '../game/types';
import { taldan } from './taldan';
import { ben } from './ben';
import { eyal } from './eyal';
import { klein } from './klein';

/**
 * Character roster. To add a fighter: copy taldan.ts (sprite sheet) or ben.ts (frame pack), change it, and add it here.
 * The select screen and the CPU opponent pick characters from this list.
 */
export const ROSTER: CharacterDef[] = [taldan, ben, eyal, klein];

export const getCharacter = (id: string) => ROSTER.find((c) => c.id === id) ?? ROSTER[0];
