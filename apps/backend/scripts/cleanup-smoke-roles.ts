/** Dev cleanup: remove smoke-test role rows left behind by aborted runs. */
import { SQL } from 'bun';
import { appConfig } from '../config/providers/config';

const ORG = 'JPgGGmy8ILDftfleMx1JtSgAOdLIZ5cE';
const sql = new SQL(appConfig.database.url!);

const removed = await sql`
  delete from auth.roles
  where organization_id = ${ORG} and name like 'smoke_%'
  returning name
`;
console.log('removed:', removed);

await sql.end();
