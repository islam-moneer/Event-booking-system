import knex from 'knex';
import knexConfig from '../../knexfile.js';
import { env } from './env.js';

const config = knexConfig[env.nodeEnv];
if (!config) throw new Error(`No knex config for NODE_ENV=${env.nodeEnv}`);

export const db = knex(config);
