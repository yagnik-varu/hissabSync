const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://hisaabsync:hisaabsync@localhost:5432/hisaabsync'
  });
  
  await client.connect();
  const res = await client.query('SELECT * FROM treasury_accounts');
  console.log("Treasury Accounts:");
  console.log(res.rows);
  await client.end();
}

main().catch(console.error);
